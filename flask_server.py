from app_flask import app
import os

# Get the port from environment variable or use 5001
port = int(os.environ.get('PORT', 5001))

if __name__ == '__main__':
    print(f"Starting Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)