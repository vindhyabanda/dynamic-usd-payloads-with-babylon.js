# Dynamic USD Payloads with Babylon.js

This project demonstrates how to dynamically load USD payloads into a Babylon.js scene based on a REST API call.

## Prerequisites

1. **Node.js**: Ensure Node.js is installed on your system.
2. **Python**: Install Python (preferably 3.7 or 3.8).
3. **USD Tools**: Install USD and usd2gltf for USD-to-glTF conversion.
   - Install USD via pip:
     ```
     pip install usd-core
     pip install usd2gltf
     ```
   - Ensure `usd2gltf` is accessible in your PATH.
4. **Visual C++ Redistributable**: Install the latest version from Microsoft:
   [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

## Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd dynamic-usd-payloads-with-babylon.js
   ```

2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```
   pip install usd-core usd2gltf
   ```

4. Install Node.js dependencies:
   ```
   npm install express cors
   ```

5. Add the USD library path to your environment variables:
   - Add `C:\path\to\usd\lib\python` to `PYTHONPATH`.
   - Add `C:\path\to\usd\bin` to `PATH`.

## Running the Project

1. Start the REST API server:
   ```
   node server.js
   ```

2. Serve the frontend files:
   ```
   python -m http.server 8080
   ```

3. Open the project in your browser:
   - Navigate to [http://localhost:8080/index.html](http://localhost:8080/index.html).

4. Test the dynamic payload loading:
   - Click the button to trigger a REST call, convert the USD file to glTF, and load it into the Babylon.js scene.

## Notes

- Ensure USD files are placed in the `Scenes/` directory.
- If you encounter DLL errors, verify that Visual C++ Redistributable is installed and environment variables are correctly set.

Let me know if you need further assistance!