# Dynamic USD Payloads with Babylon.js

This project demonstrates how to dynamically load consolidated USD payloads into a Babylon.js scene based on a REST API call, with direct USDA to glTF conversion and extras data display. The project uses a single consolidated USD file containing all geometry and telemetry bindings.

## Key Features

- **Consolidated USD File**: Single `cube.usda` file containing:
  - Root scene with BaseSphere and BaseCube primitives
  - Detailed CubeMesh geometry 
  - Telemetry binding metadata in USD dictionary syntax
- **Direct Conversion**: USDA/USD → glTF → Babylon.js (streamlined workflow)
- **Extras Data Display**: Shows custom data from glTF extras fields in the UI

## Prerequisites

1. **Node.js**: Ensure Node.js is installed on your system.
2. **Python**: Install Python (preferably 3.7 or 3.8).
3. **USD Tools**: Install USD tools for USDZ creation and conversion.
   - Install USD via pip:
     ```bash
     pip install usd-core
     pip install usd2gltf
     ```
   - Ensure `usdzip` and `usd2gltf` commands are accessible in your PATH.
4. **Visual C++ Redistributable**: Install the latest version from Microsoft:
   [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

## Features

- **USDZ Support**: Create USDZ files from USDA and convert them to glTF for web visualization
- **Dynamic Loading**: Load different USD/USDZ payloads based on REST API responses
- **Dual Workflow**: Support both USDZ and direct conversion workflows
- **WebSocket Integration**: Real-time telemetry data updates
- **Custom Payloads**: Load any USD/USDA file by name

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dynamic-usd-payloads-with-babylon.js
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install usd-core usd2gltf
   ```

4. Install Node.js dependencies:
   ```bash
   npm install
   ```

5. Add the USD library path to your environment variables (if needed):
   - Add `C:\path\to\usd\lib\python` to `PYTHONPATH`.
   - Add `C:\path\to\usd\bin` to `PATH`.

## Running the Project

1. Start the REST API server:
   ```bash
   npm start
   # or
   node server.js
   ```

2. Serve the frontend files:
   ```bash
   python -m http.server 8080
   ```

3. Open the project in your browser:
   - Navigate to [http://localhost:8080/index.html](http://localhost:8080/index.html).

## Usage

### Direct USD to glTF Conversion
1. Click "Load Consolidated Scene (USDA→glTF)" to test the main workflow
2. This will:
   - Convert `cube.usda` directly to `cube.glb` using `usd2gltf`
   - Load the glTF file in Babylon.js with all geometry and bindings
   - Display any extras data found in the glTF file

### Alternative Direct Workflow
1. Click "Direct Load Consolidated Scene (USDA→glTF Alternative)" for the alternative conversion method
2. This uses the same direct conversion but with different processing

### Format Selection
1. Use the dropdown to select USDA Direct to glTF or USD Direct to glTF format
2. Click "Reload with Selected Format" to process the consolidated file

### Viewing Extras Data
- The glTF extras data (containing telemetry bindings and custom metadata) will be displayed in a panel below the 3D scene
- This data comes from the USD customData fields that get converted to glTF extras during the conversion process

## API Endpoints

- `GET /device/:id?format=gltf`: Get device info and payload path (always returns cube.usda)
- `GET /convert/gltf?input=cube.usda&output=cube.glb`: Convert USDA/USD directly to glTF
- `GET /api/telemetry/current`: Get current telemetry data
- `GET /api/telemetry/mesh/cube`: Get telemetry mapping for cube geometry
- `WS ws://localhost:3000`: WebSocket for real-time updates

## File Structure

```
project/
├── Scenes/
│   ├── Assets/                # Generated files folder (gitignored)
│   │   ├── cube.usdz         # Generated USDZ file
│   │   └── cube.glb          # Generated glTF file
│   ├── cube.usda             # Consolidated scene with all geometry and bindings
│   └── baseScene.usda        # Legacy file (can be removed)
├── server.js                 # Node.js server with USDZ support
├── index.html                # Frontend with dual workflow support
└── package.json              # Node.js dependencies
```

## Consolidated USD File Structure

The `cube.usda` file contains:

1. **Layer Metadata**: Telemetry bindings in `customLayerData`
2. **Root Scene**: Xform containing all geometry
3. **Geometry Objects**:
   - `BaseSphere`: Primitive sphere with temperature/pressure bindings
   - `BaseCube`: Primitive cube with vibration bindings and detailed customData
   - `CubeMesh`: Detailed mesh geometry with temperature bindings
4. **Telemetry Integration**: Custom attributes linking meshes to data sources

## Troubleshooting

- **DLL Errors**: Ensure Visual C++ Redistributable is installed and environment variables are correctly set.
- **USDZ Creation Failed**: Verify that `usdzip` command is available and USD tools are properly installed.
- **No Rendering**: Check browser console for conversion errors. Ensure USD files contain valid geometry.
- **File Not Found**: Ensure your USDA/USD files exist in the `Scenes/` directory.

## Notes

- USDZ files are zipped USD archives optimized for AR applications
- All generated files (.usdz and .glb) are saved in the `Scenes/Assets/` folder and are gitignored
- WebSocket connection provides real-time telemetry integration
- Both USDA (ASCII) and USD (binary) formats are supported as input
- The `Assets/` folder is automatically created when needed

Let me know if you need further assistance!