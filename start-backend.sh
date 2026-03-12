#!/bin/bash
# Start AIS Sales Backend API with background DB sync (SCP from Windows billing PC)

set -e

cd /home/adityajain/AIS/ais-sales

# Activate virtual environment
source venv/bin/activate

# Start DB sync in background (polls Windows PC via SCP every 5 minutes)
echo "Starting DB sync monitor (SCP from 192.168.1.59)..."
python -u api/db_sync.py &
SYNC_PID=$!

# Handle signals to cleanup
cleanup() {
    echo "Stopping services..."
    kill $SYNC_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Start FastAPI backend (run from api/ dir so relative imports resolve correctly)
echo "Starting AIS Sales API..."
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir api &
API_PID=$!

echo "Backend started (PID: $API_PID)"
echo "Sync monitor started (PID: $SYNC_PID)"
echo "API available at: http://0.0.0.0:8000"

# Wait for processes
wait $API_PID $SYNC_PID
