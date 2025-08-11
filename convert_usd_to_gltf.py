import os
import subprocess

def convert_usd_to_gltf(input_usd, output_gltf):
    """
    Converts a USD file to glTF using usd2gltf.

    Args:
        input_usd (str): Path to the input USD file.
        output_gltf (str): Path to the output glTF file.
    """
    try:
        # Ensure usd2gltf is installed and available in PATH
        result = subprocess.run(["usd2gltf", input_usd, "-o", output_gltf], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(result.stdout.decode())
        print(f"Conversion successful: {output_gltf}")
    except subprocess.CalledProcessError as e:
        print(f"Error during conversion: {e.stderr.decode()}")
    except FileNotFoundError:
        print("usd2gltf tool not found. Please install it and add it to your PATH.")

if __name__ == "__main__":
    # Example usage
    input_usd = "Scenes/universalrobots-ur3e.usd"
    output_gltf = "Scenes/universalrobots-ur3e.glb"

    if os.path.exists(input_usd):
        convert_usd_to_gltf(input_usd, output_gltf)
    else:
        print(f"Input USD file not found: {input_usd}")
