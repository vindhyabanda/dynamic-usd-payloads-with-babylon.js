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
    // Force .gltf extension instead of .glb for text format
    const gltfOutput = output.replace('.glb', '.gltf');
    const outputPath = path.join(__dirname, 'Scenes', 'Assets', gltfOutput);

    console.log(`Converting: ${inputPath} -> ${outputPath}`);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ success: false, error: `Input file not found: ${input}` });
    }

    // Direct USD/USDA to glTF conversion (text format for easier JSON manipulation)
    exec(`usd2gltf -i "${inputPath}" -o "${outputPath}"`, async (error, stdout, stderr) => {
        if (error) {
            console.error(`USD to glTF Conversion error: ${stderr}`);
            return res.status(500).json({ success: false, error: stderr });
        }
        console.log(`USD to glTF Conversion successful: ${stdout}`);
        
        try {
            // Extract customData from original USDA file and inject into glTF
            await injectCustomDataIntoGltf(inputPath, outputPath);
            console.log(`Successfully injected customData into glTF file`);
            
            res.json({ success: true, outputPath: `Assets/${gltfOutput}` });
        } catch (injectError) {
            console.error(`Error injecting customData: ${injectError.message}`);
            // Still return success since the conversion worked, just log the injection error
            res.json({ success: true, outputPath: `Assets/${gltfOutput}`, warning: `CustomData injection failed: ${injectError.message}` });
        }
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

// Function to extract customData from USDA and inject into glTF extras
async function injectCustomDataIntoGltf(usdaPath, gltfPath) {
    const fs = require('fs').promises;
    
    console.log(`\n=== CustomData Injection Process ===`);
    console.log(`Reading USDA file: ${usdaPath}`);
    
    // Read the original USDA file
    const usdaContent = await fs.readFile(usdaPath, 'utf8');
    console.log(`USDA file size: ${usdaContent.length} characters`);
    
    // Extract customData from USDA
    const customDataMap = extractCustomDataFromUSDA(usdaContent);
    console.log(`Extracted customData for ${Object.keys(customDataMap).length} objects:`, Object.keys(customDataMap));
    
    // Read the generated glTF file
    console.log(`Reading generated glTF file: ${gltfPath}`);
    let gltfContent;
    try {
        const gltfRaw = await fs.readFile(gltfPath, 'utf8');
        gltfContent = JSON.parse(gltfRaw);
        console.log(`glTF file loaded successfully, contains ${gltfContent.nodes?.length || 0} nodes`);
    } catch (parseError) {
        throw new Error(`Failed to parse glTF file: ${parseError.message}`);
    }
    
    // Inject customData into glTF extras
    let injectionsCount = 0;
    if (gltfContent.nodes) {
        gltfContent.nodes.forEach((node, index) => {
            const nodeName = node.name;
            if (nodeName && customDataMap[nodeName]) {
                console.log(`  Injecting customData for node "${nodeName}" at index ${index}`);
                if (!node.extras) {
                    node.extras = {};
                }
                node.extras.customData = customDataMap[nodeName];
                injectionsCount++;
                console.log(`    Injected data:`, JSON.stringify(customDataMap[nodeName], null, 2));
            }
        });
    }
    
    console.log(`Total customData injections: ${injectionsCount}`);
    
    // Save the modified glTF file
    const modifiedGltfContent = JSON.stringify(gltfContent, null, 2);
    await fs.writeFile(gltfPath, modifiedGltfContent, 'utf8');
    console.log(`Modified glTF saved successfully (${modifiedGltfContent.length} characters)`);
    console.log(`=== CustomData Injection Complete ===\n`);
}

// Function to parse USDA and extract customData (including layer-level customLayerData)
function extractCustomDataFromUSDA(usdaContent) {
    console.log(`\n--- Parsing USDA customData ---`);
    const customDataMap = {};
    
    // First, extract customLayerData (layer-level custom data)
    const layerDataRegex = /customLayerData\s*=\s*\{([\s\S]*?)\n\s*\}\s*\)/;
    const layerMatch = layerDataRegex.exec(usdaContent);
    if (layerMatch) {
        console.log(`Found customLayerData`);
        try {
            const parsedLayerData = parseUSDDictionary(layerMatch[1]);
            customDataMap['__layerData'] = parsedLayerData;
            console.log(`Successfully parsed customLayerData:`, JSON.stringify(parsedLayerData, null, 2));
        } catch (err) {
            console.warn(`Failed to parse customLayerData: ${err.message}`);
        }
    }
    
    // Then, extract object-level customData from def blocks
    const defBlockRegex = /def\s+\w+\s+"([^"]+)"\s*\(\s*customData\s*=\s*\{([\s\S]*?)\n\s*\}\s*\)/g;
    
    let match;
    while ((match = defBlockRegex.exec(usdaContent)) !== null) {
        const objectName = match[1];
        const customDataContent = match[2];
        
        console.log(`Found customData block for "${objectName}"`);
        
        try {
            const parsedCustomData = parseUSDDictionary(customDataContent);
            customDataMap[objectName] = parsedCustomData;
            console.log(`Successfully parsed customData for "${objectName}":`, JSON.stringify(parsedCustomData, null, 2));
        } catch (parseError) {
            console.warn(`Failed to parse customData for "${objectName}": ${parseError.message}`);
        }
    }
    
    console.log(`--- USDA customData parsing complete ---\n`);
    return customDataMap;
}

// Improved USD dictionary parser
function parseUSDDictionary(content) {
    console.log(`Parsing USD dictionary content (${content.length} chars)`);
    
    const result = {};
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) {
            i++;
            continue;
        }
        
        // Parse string values: string key = "value"
        const stringMatch = line.match(/^string\s+(\w+)\s*=\s*"([^"]*)"$/);
        if (stringMatch) {
            const [, key, value] = stringMatch;
            result[key] = value;
            console.log(`  Parsed string: ${key} = "${value}"`);
            i++;
            continue;
        }
        
        // Parse float values: float key = 42.0
        const floatMatch = line.match(/^float\s+(\w+)\s*=\s*([\d.-]+)$/);
        if (floatMatch) {
            const [, key, value] = floatMatch;
            result[key] = parseFloat(value);
            console.log(`  Parsed float: ${key} = ${value}`);
            i++;
            continue;
        }
        
        // Parse dictionary: dictionary key = { ... }
        const dictStartMatch = line.match(/^dictionary\s+(\w+)\s*=\s*\{$/);
        if (dictStartMatch) {
            const [, key] = dictStartMatch;
            console.log(`  Found dictionary: ${key}`);
            
            // Find the matching closing brace
            let braceCount = 1;
            let dictContent = '';
            i++; // Move past the opening line
            
            while (i < lines.length && braceCount > 0) {
                const dictLine = lines[i];
                
                // Count braces
                const openBraces = (dictLine.match(/\{/g) || []).length;
                const closeBraces = (dictLine.match(/\}/g) || []).length;
                braceCount += openBraces - closeBraces;
                
                if (braceCount > 0) {
                    dictContent += dictLine + '\n';
                }
                i++;
            }
            
            try {
                result[key] = parseUSDDictionary(dictContent);
                console.log(`  Successfully parsed dictionary: ${key}`);
            } catch (err) {
                console.warn(`  Failed to parse dictionary ${key}: ${err.message}`);
                result[key] = { _raw: dictContent.trim() };
            }
            continue;
        }
        
        // Parse string arrays: string[] key = ["value1", "value2"]
        const stringArrayMatch = line.match(/^string\[\]\s+(\w+)\s*=\s*\[(.*?)\]$/);
        if (stringArrayMatch) {
            const [, key, arrayContent] = stringArrayMatch;
            const values = arrayContent.split(',').map(v => v.trim().replace(/"/g, ''));
            result[key] = values;
            console.log(`  Parsed string array: ${key} = [${values.join(', ')}]`);
            i++;
            continue;
        }
        
        console.log(`  Skipping unrecognized line: ${line}`);
        i++;
    }
    
    return result;
}

server.listen(PORT, () => {
    console.log(`Enhanced server running at http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}`);
    
    // Start generating test data
    startTestDataGenerator();
});