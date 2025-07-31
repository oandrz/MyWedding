#!/bin/bash
# Start Flask server in background with error handling
nohup python3 app_flask.py > flask.log 2>&1 &
FLASK_PID=$!
echo "Flask server started on port 5001 (PID: $FLASK_PID)"

# Wait a moment to check if it started successfully
sleep 2
if kill -0 $FLASK_PID 2>/dev/null; then
    echo "Flask server is running successfully"
else
    echo "Flask server failed to start, check flask.log for details"
    exit 1
fi
