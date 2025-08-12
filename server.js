const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// Optional: MQTT client (install with: npm install mqtt)
// const mqtt = require('mqtt');

const app = express();
const PORT = 3000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Serve static files from 'Scenes' folder so converted glb can be accessed by frontend
app.use('/Scenes', express.static(path.join(__dirname, 'Scenes')));

// Telemetry data storage
const telemetryData = new Map();
const meshMappings = new Map();

// Initialize mappings for consolidated cube.usda file
meshMappings.set('cube', {
    topics: ['sensors/room1/temperature', 'sensors/room1/pressure', 'sensors/room2/vibration', 'sensors/room3/temperature'],
    visualProperties: {
        'sensors/room1/temperature': { property: 'color', mapping: 'temperature_to_color', mesh: 'BaseSphere' },
        'sensors/room1/pressure': { property: 'scale', mapping: 'pressure_to_scale', mesh: 'BaseSphere' },
        'sensors/room2/vibration': { property: 'rotation', mapping: 'vibration_to_rotation', mesh: 'BaseCube' },
        'sensors/room3/temperature': { property: 'color', mapping: 'temperature_to_color', mesh: 'CubeMesh' }
    }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send current telemetry data immediately
    ws.send(JSON.stringify({
        type: 'initial_data',
        data: getCurrentTelemetryData()
    }));

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Existing endpoints
app.get('/device/:id', (req, res) => {
    const { id } = req.params;
    const { format = 'usda' } = req.query; // Default to usda format
    
    // Since we only use cube.usda now, always return cube
    const fileName = 'cube';
    
    // Support different file formats
    let payloadPath;
    switch (format.toLowerCase()) {
        case 'usdz':
            payloadPath = `${fileName}.usdz`;
            break;
        case 'usd':
            payloadPath = `${fileName}.usd`;
            break;
        default:
            payloadPath = `${fileName}.usda`;
    }
    
    // Enhanced response with telemetry info
    res.json({
        payloadPath: payloadPath,
        format: format,
        status: 'on',
        temp: 72,
        telemetryEndpoints: {
            current: `/api/telemetry/current`,
            mesh: `/api/telemetry/mesh/${fileName}`,
            websocket: `ws://localhost:${PORT}`
        }
    });
});

// Get list of USD files in Scenes folder
app.get('/scenes', (req, res) => {
    const fs = require('fs');
    const scenesDir = path.join(__dirname, 'Scenes');
    
    try {
        const files = fs.readdirSync(scenesDir).filter(file => 
            file.endsWith('.usda') || file.endsWith('.usd')
        );
        res.json({ success: true, files: files });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Convert USDA directly to glTF (removed USDZ step)
app.get('/convert/gltf', (req, res) => {
    const { input, output } = req.query;
    if (!input || !output) {
        return res.status(400).json({ success: false, error: 'Missing input or output parameters' });
    }

    const fs = require('fs');
    const assetsDir = path.join(__dirname, 'Scenes', 'Assets');
    
    // Create Assets directory if it doesn't exist
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Input is always from Scenes/ folder (USDA files)
    const inputPath = path.join(__dirname, 'Scenes', input);
    const outputPath = path.join(__dirname, 'Scenes', 'Assets', output);

    console.log(`Converting: ${inputPath} -> ${outputPath}`);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ success: false, error: `Input file not found: ${input}` });
    }

    // Direct USD/USDA to glTF conversion
    exec(`usd2gltf -i "${inputPath}" -o "${outputPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`USD to glTF Conversion error: ${stderr}`);
            return res.status(500).json({ success: false, error: stderr });
        }
        console.log(`USD to glTF Conversion successful: ${stdout}`);
        res.json({ success: true, outputPath: `Assets/${output}` });
    });
});

// NEW TELEMETRY ENDPOINTS
app.get('/api/telemetry/current', (req, res) => {
    res.json(getCurrentTelemetryData());
});

app.get('/api/telemetry/mesh/:meshId', (req, res) => {
    const meshId = req.params.meshId;
    const mapping = meshMappings.get(meshId);
    
    if (!mapping) {
        return res.status(404).json({ error: 'Mesh not found' });
    }

    const result = {};
    mapping.topics.forEach(topic => {
        const data = telemetryData.get(topic);
        if (data) {
            result[topic] = data.current;
        }
    });

    res.json({ meshId, data: result, mapping });
});

app.post('/api/config/mesh-mapping', (req, res) => {
    const { meshId, topics, visualProperties } = req.body;
    
    meshMappings.set(meshId, {
        topics,
        visualProperties,
        updatedAt: Date.now()
    });

    res.json({ success: true, meshId });
});

// Simulate telemetry data (for testing without MQTT)
app.post('/api/telemetry/simulate', (req, res) => {
    const { topic, data } = req.body;
    
    const enrichedPayload = {
        ...data,
        topic,
        timestamp: Date.now(),
        messageId: generateMessageId()
    };

    storeTelemetryData(topic, enrichedPayload);
    broadcastTelemetryUpdate(topic, enrichedPayload);
    
    res.json({ success: true, topic, data: enrichedPayload });
});

// MQTT Setup (uncomment if you have MQTT broker)
/*
const mqttClient = mqtt.connect('mqtt://localhost:1883');

mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('sensors/+/temperature');
    mqttClient.subscribe('sensors/+/pressure');
    mqttClient.subscribe('sensors/+/vibration');
});

mqttClient.on('message', (topic, message) => {
    try {
        let payload;
        try {
            payload = JSON.parse(message.toString());
        } catch (e) {
            payload = { value: parseFloat(message.toString()) || message.toString(), timestamp: Date.now() };
        }

        const enrichedPayload = {
            ...payload,
            topic,
            receivedAt: Date.now(),
            messageId: generateMessageId()
        };

        storeTelemetryData(topic, enrichedPayload);
        broadcastTelemetryUpdate(topic, enrichedPayload);
        
        console.log(`MQTT: ${topic} ->`, enrichedPayload);
    } catch (error) {
        console.error(`Error processing MQTT message from ${topic}:`, error);
    }
});
*/

// Helper functions
function getCurrentTelemetryData() {
    const result = {};
    for (const [topic, data] of telemetryData.entries()) {
        result[topic] = data.current;
    }
    return result;
}

function storeTelemetryData(topic, payload) {
    if (!telemetryData.has(topic)) {
        telemetryData.set(topic, {
            current: null,
            history: []
        });
    }

    const topicData = telemetryData.get(topic);
    topicData.current = payload;
    topicData.history.push(payload);
    
    // Keep last 100 entries
    if (topicData.history.length > 100) {
        topicData.history.shift();
    }
}

function broadcastTelemetryUpdate(topic, payload) {
    const message = JSON.stringify({
        type: 'telemetry_update',
        topic,
        data: payload
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Test data generator (runs automatically for demo)
function startTestDataGenerator() {
    console.log('Starting test data generator...');
    
    setInterval(() => {
        // Generate random temperature data
        const temperature = 20 + Math.random() * 60; // 20-80°C
        const tempPayload = {
            temperature,
            unit: 'celsius',
            timestamp: Date.now()
        };
        
        storeTelemetryData('sensors/room1/temperature', tempPayload);
        broadcastTelemetryUpdate('sensors/room1/temperature', tempPayload);
        
        // Generate random pressure data
        const pressure = 2 + Math.random() * 6; // 2-8 bar
        const pressurePayload = {
            pressure,
            unit: 'bar',
            timestamp: Date.now()
        };
        
        storeTelemetryData('sensors/room1/pressure', pressurePayload);
        broadcastTelemetryUpdate('sensors/room1/pressure', pressurePayload);
        
    }, 2000); // Every 2 seconds
}

server.listen(PORT, () => {
    console.log(`Enhanced server running at http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}`);
    
    // Start generating test data
    startTestDataGenerator();
});