#!/bin/bash
# Start AIS Sales Backend API with background Google Drive sync

set -e

cd /home/adityajain/AIS/ais-sales

# Activate virtual environment
source venv/bin/activate

# Start Google Drive sync in background
echo "🔄 Starting Google Drive sync monitor..."
python api/gdrive_sync.py &
SYNC_PID=$!

# Handle signals to cleanup
cleanup() {
    echo "👋 Stopping services..."
    kill $SYNC_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Start FastAPI backend
echo "🚀 Starting AIS Sales API..."
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!

echo "✅ Backend started (PID: $API_PID)"
echo "✅ Sync monitor started (PID: $SYNC_PID)"
echo "📊 API available at: http://0.0.0.0:8000"

# Wait for processes
wait $API_PID $SYNC_PID
