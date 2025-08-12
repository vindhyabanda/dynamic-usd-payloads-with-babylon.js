// telemetry-server.js - Run this as a separate server
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

class TelemetryMockServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Mock device data with different payload structures
        this.devices = new Map();
        this.setupDevices();
        
        this.setupExpress();
        this.setupWebSocket();
        this.startDataGeneration();
    }

    setupDevices() {
        // Different devices with different payload structures (dynamic payloads!)
        this.devices.set('pump001', {
            type: 'centrifugal_pump',
            location: 'Building_A_Room_101',
            payloadStructure: 'industrial',
            telemetry: {
                temperature: { current: 25, min: 15, max: 85, unit: 'celsius' },
                pressure: { current: 3.5, min: 0, max: 10, unit: 'bar' },
                vibration: { current: 0.2, min: 0, max: 2, unit: 'mm/s' },
                flow_rate: { current: 150, min: 0, max: 300, unit: 'L/min' },
                power_consumption: { current: 2.1, min: 0, max: 5, unit: 'kW' }
            }
        });

        this.devices.set('tank002', {
            type: 'storage_tank',
            location: 'Building_A_Level_2',
            payloadStructure: 'process',
            telemetry: {
                level: { current: 75, min: 0, max: 100, unit: 'percent' },
                temperature: { current: 22, min: 10, max: 40, unit: 'celsius' },
                ph_level: { current: 7.2, min: 6, max: 8, unit: 'pH' },
                conductivity: { current: 1.2, min: 0, max: 2, unit: 'mS/cm' }
            }
        });

        this.devices.set('valve003', {
            type: 'control_valve',
            location: 'Pipeline_Section_C',
            payloadStructure: 'control',
            telemetry: {
                position: { current: 45, min: 0, max: 100, unit: 'percent' },
                flow_coefficient: { current: 0.75, min: 0, max: 1, unit: 'Cv' },
                actuator_pressure: { current: 6.2, min: 4, max: 8, unit: 'bar' }
            }
        });

        this.devices.set('motor004', {
            type: 'electric_motor',
            location: 'Compressor_Room',
            payloadStructure: 'electrical',
            telemetry: {
                rpm: { current: 1750, min: 0, max: 3600, unit: 'rpm' },
                current_draw: { current: 12.5, min: 0, max: 20, unit: 'A' },
                voltage: { current: 480, min: 460, max: 500, unit: 'V' },
                temperature: { current: 65, min: 20, max: 120, unit: 'celsius' },
                efficiency: { current: 92.3, min: 80, max: 95, unit: 'percent' }
            }
        });
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', devices: this.devices.size });
        });

        // Get all devices
        this.app.get('/devices', (req, res) => {
            const deviceList = Array.from(this.devices.entries()).map(([id, device]) => ({
                id,
                type: device.type,
                location: device.location,
                payloadStructure: device.payloadStructure,
                telemetryFields: Object.keys(device.telemetry)
            }));
            res.json(deviceList);
        });

        // Get specific device current telemetry
        this.app.get('/device/:deviceId/telemetry', (req, res) => {
            const deviceId = req.params.deviceId;
            const device = this.devices.get(deviceId);
            
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }

            // Generate current payload based on device type (DYNAMIC PAYLOAD!)
            const payload = this.generateDynamicPayload(deviceId, device);
            res.json(payload);
        });

        // Get device subscription info
        this.app.get('/device/:deviceId/subscription', (req, res) => {
            const deviceId = req.params.deviceId;
            const device = this.devices.get(deviceId);
            
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }

            res.json({
                deviceId,
                websocketUrl: `ws://localhost:4000`,
                topic: `telemetry/${deviceId}`,
                payloadStructure: device.payloadStructure,
                updateInterval: 2000,
                fields: Object.keys(device.telemetry)
            });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('WebSocket client connected');

            // Send initial device list
            ws.send(JSON.stringify({
                type: 'device_list',
                devices: Array.from(this.devices.keys())
            }));

            // Send current telemetry for all devices
            this.devices.forEach((device, deviceId) => {
                const payload = this.generateDynamicPayload(deviceId, device);
                ws.send(JSON.stringify({
                    type: 'telemetry',
                    deviceId,
                    topic: `telemetry/${deviceId}`,
                    data: payload
                }));
            });

            ws.on('message', (message) => {
                try {
                    const request = JSON.parse(message.toString());
                    this.handleClientRequest(ws, request);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
            });
        });
    }

    handleClientRequest(ws, request) {
        switch (request.type) {
            case 'subscribe_device':
                // Client wants to subscribe to specific device
                const deviceId = request.deviceId;
                if (this.devices.has(deviceId)) {
                    ws.deviceSubscriptions = ws.deviceSubscriptions || new Set();
                    ws.deviceSubscriptions.add(deviceId);
                    ws.send(JSON.stringify({
                        type: 'subscription_confirmed',
                        deviceId
                    }));
                }
                break;
                
            case 'get_payload_structure':
                const device = this.devices.get(request.deviceId);
                if (device) {
                    ws.send(JSON.stringify({
                        type: 'payload_structure',
                        deviceId: request.deviceId,
                        structure: this.getPayloadStructure(device)
                    }));
                }
                break;
        }
    }

    generateDynamicPayload(deviceId, device) {
        const timestamp = Date.now();
        const basePayload = {
            deviceId,
            timestamp,
            location: device.location,
            deviceType: device.type
        };

        // Generate different payload structures based on device type
        switch (device.payloadStructure) {
            case 'industrial':
                return {
                    ...basePayload,
                    sensors: this.generateSensorReadings(device.telemetry),
                    status: this.generateDeviceStatus(),
                    alarms: this.generateAlarms(device.telemetry),
                    metadata: {
                        firmware_version: '2.1.4',
                        last_maintenance: '2024-01-15',
                        operating_hours: Math.floor(Math.random() * 8760)
                    }
                };

            case 'process':
                return {
                    ...basePayload,
                    measurements: this.generateProcessMeasurements(device.telemetry),
                    quality: this.generateQualityMetrics(device.telemetry),
                    batch_info: {
                        batch_id: `B${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
                        start_time: timestamp - Math.random() * 86400000,
                        target_volume: 1000
                    }
                };

            case 'control':
                return {
                    ...basePayload,
                    control_values: this.generateControlValues(device.telemetry),
                    setpoints: this.generateSetpoints(device.telemetry),
                    pid_parameters: {
                        kp: 1.2, ki: 0.8, kd: 0.3
                    },
                    manual_override: Math.random() > 0.9
                };

            case 'electrical':
                return {
                    ...basePayload,
                    electrical: this.generateElectricalReadings(device.telemetry),
                    power_quality: {
                        power_factor: 0.85 + Math.random() * 0.1,
                        thd: Math.random() * 5,
                        frequency: 59.8 + Math.random() * 0.4
                    },
                    protection: {
                        overcurrent: false,
                        undervoltage: false,
                        phase_imbalance: Math.random() * 2
                    }
                };

            default:
                return {
                    ...basePayload,
                    data: this.generateSensorReadings(device.telemetry)
                };
        }
    }

    generateSensorReadings(telemetryConfig) {
        const readings = {};
        Object.entries(telemetryConfig).forEach(([sensor, config]) => {
            // Add some realistic variation
            const variation = (config.max - config.min) * 0.1;
            const newValue = config.current + (Math.random() - 0.5) * variation;
            
            // Keep within bounds
            config.current = Math.max(config.min, Math.min(config.max, newValue));
            
            readings[sensor] = {
                value: Math.round(config.current * 100) / 100,
                unit: config.unit,
                quality: Math.random() > 0.95 ? 'questionable' : 'good',
                timestamp: Date.now()
            };
        });
        return readings;
    }

    generateProcessMeasurements(telemetryConfig) {
        const measurements = this.generateSensorReadings(telemetryConfig);
        
        // Add process-specific fields
        return {
            ...measurements,
            recipe_deviation: Math.random() * 2 - 1, // -1 to 1
            yield_efficiency: 92 + Math.random() * 6,
            contamination_level: Math.random() * 0.1
        };
    }

    generateControlValues(telemetryConfig) {
        const values = {};
        Object.entries(telemetryConfig).forEach(([param, config]) => {
            values[param] = {
                actual: config.current,
                target: config.current + (Math.random() - 0.5) * 5,
                unit: config.unit,
                mode: Math.random() > 0.8 ? 'manual' : 'auto'
            };
        });
        return values;
    }

    generateElectricalReadings(telemetryConfig) {
        const readings = this.generateSensorReadings(telemetryConfig);
        
        // Calculate additional electrical parameters
        const voltage = readings.voltage?.value || 480;
        const current = readings.current_draw?.value || 12;
        
        readings.power = {
            value: Math.round(voltage * current * Math.sqrt(3) / 1000 * 100) / 100,
            unit: 'kW',
            quality: 'good',
            timestamp: Date.now()
        };
        
        return readings;
    }

    generateDeviceStatus() {
        const statuses = ['running', 'idle', 'maintenance', 'fault'];
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    generateAlarms(telemetryConfig) {
        const alarms = [];
        
        Object.entries(telemetryConfig).forEach(([sensor, config]) => {
            // Random chance of alarm
            if (Math.random() > 0.9) {
                const severity = config.current > config.max * 0.9 ? 'high' : 'medium';
                alarms.push({
                    id: `ALM_${sensor.toUpperCase()}_${Date.now()}`,
                    sensor,
                    message: `${sensor} reading ${severity === 'high' ? 'critically high' : 'elevated'}`,
                    severity,
                    timestamp: Date.now(),
                    acknowledged: false
                });
            }
        });
        
        return alarms;
    }

    generateQualityMetrics(telemetryConfig) {
        return {
            purity: 98.5 + Math.random() * 1.2,
            clarity: 95 + Math.random() * 4,
            particulate_count: Math.floor(Math.random() * 100),
            specification_compliance: Math.random() > 0.1
        };
    }

    generateSetpoints(telemetryConfig) {
        const setpoints = {};
        Object.entries(telemetryConfig).forEach(([param, config]) => {
            setpoints[`${param}_setpoint`] = {
                value: config.current + (Math.random() - 0.5) * 2,
                unit: config.unit,
                auto_adjust: Math.random() > 0.7
            };
        });
        return setpoints;
    }

    getPayloadStructure(device) {
        return {
            payloadType: device.payloadStructure,
            expectedFields: Object.keys(device.telemetry),
            samplePayload: this.generateDynamicPayload('sample', device)
        };
    }

    startDataGeneration() {
        console.log('Starting telemetry data generation...');
        
        setInterval(() => {
            this.devices.forEach((device, deviceId) => {
                const payload = this.generateDynamicPayload(deviceId, device);
                
                // Broadcast to all WebSocket clients
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        // Only send if client is subscribed to this device or no specific subscription
                        if (!client.deviceSubscriptions || client.deviceSubscriptions.has(deviceId)) {
                            client.send(JSON.stringify({
                                type: 'telemetry',
                                deviceId,
                                topic: `telemetry/${deviceId}`,
                                data: payload
                            }));
                        }
                    }
                });
            });
        }, 2000); // Every 2 seconds
    }

    start(port = 4000) {
        this.server.listen(port, () => {
            console.log(`Telemetry Mock Server running on port ${port}`);
            console.log(`WebSocket available at ws://localhost:${port}`);
            console.log(`REST API available at http://localhost:${port}`);
            console.log(`Available devices: ${Array.from(this.devices.keys()).join(', ')}`);
        });
    }
}

// Start the server
const telemetryServer = new TelemetryMockServer();
telemetryServer.start(4000);

module.exports = TelemetryMockServer;