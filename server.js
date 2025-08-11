const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());

// Serve static files from 'Scenes' folder so converted glb can be accessed by frontend
app.use('/Scenes', express.static(path.join(__dirname, 'Scenes')));

app.get('/device/:id', (req, res) => {
    const { id } = req.params;
    const validFiles = ['baseScene', 'cube']; // List of valid file names without extension

    const fileName = validFiles.includes(id) ? id : 'baseScene'; // Default to baseScene if invalid
    res.json({
        payloadPath: `${fileName}.usd`, // Use .usd extension
        status: 'on',
        temp: 72
    });
});

app.get('/convert', (req, res) => {
    const { input, output } = req.query;
    if (!input || !output) {
        return res.status(400).json({ success: false, error: 'Missing input or output parameters' });
    }

    // Sanitize input paths to avoid shell injection - keep it simple for demo
    const inputPath = path.join(__dirname, 'Scenes', path.basename(input));
    const outputPath = path.join(__dirname, 'Scenes', path.basename(output));

    exec(`usd2gltf -i "${inputPath}" -o "${outputPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Conversion error: ${stderr}`);
            return res.status(500).json({ success: false, error: stderr });
        }
        console.log(`Conversion successful: ${stdout}`);
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Mock REST API running at http://localhost:${PORT}`);
});