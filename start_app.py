# start_app.py
"""
Script to start both the Express and Flask servers.
"""
import subprocess
import os
import time

def start_servers():
    """Start both the Flask and Express servers."""
    print("Starting Flask server...")
    flask_process = subprocess.Popen(
        ["python3", "app_flask.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Give the Flask server a moment to start
    time.sleep(2)

    # Check if the Flask server started successfully
    flask_status = flask_process.poll()
    if flask_status is not None:
        print("Error starting Flask server!")
        stdout, stderr = flask_process.communicate()
        print(f"STDOUT: {stdout}")
        print(f"STDERR: {stderr}")
        return

    print("Flask server started successfully on port 5001")
    
    # Start the Express server which handles the frontend
    print("Starting Express server...")
    express_env = os.environ.copy()
    express_process = subprocess.Popen(
        ["npm", "run", "dev"],
        env=express_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Wait for both servers to exit
    try:
        while True:
            flask_status = flask_process.poll()
            express_status = express_process.poll()
            
            if flask_status is not None:
                print(f"Flask server exited with code {flask_status}")
                stdout, stderr = flask_process.communicate()
                print(f"STDOUT: {stdout}")
                print(f"STDERR: {stderr}")
                break
                
            if express_status is not None:
                print(f"Express server exited with code {express_status}")
                stdout, stderr = express_process.communicate()
                print(f"STDOUT: {stdout}")
                print(f"STDERR: {stderr}")
                break
                
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down servers...")
        flask_process.terminate()
        express_process.terminate()

if __name__ == "__main__":
    start_servers()