"""
Sync xcomp11.DB from Google Drive periodically
Run as a background job while the API is running
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
import time
import subprocess

# Paths
WORKSPACE = Path("/home/adityajain/.openclaw/workspace")
GDRIVE_CACHE = WORKSPACE / "xcomp11.DB"  # Synced from Google Drive
AIS_DB = Path("/home/adityajain/AIS/assets/xcomp11.DB")
FIREBASE_SYNC_SCRIPT = Path("/home/adityajain/AIS/ais-sales/api/firebase_sync.py")

def check_gdrive_file():
    """Check if Google Drive file was recently updated"""
    if not GDRIVE_CACHE.exists():
        print(f"⚠️  Google Drive cache not found: {GDRIVE_CACHE}")
        return None
    
    return GDRIVE_CACHE.stat().st_mtime


def sync_to_ais():
    """Copy DB from Google Drive to AIS folder"""
    if not GDRIVE_CACHE.exists():
        print(f"❌ Google Drive file not found: {GDRIVE_CACHE}")
        return False
    
    try:
        # Check if source is newer
        gdrive_mtime = GDRIVE_CACHE.stat().st_mtime
        ais_mtime = AIS_DB.stat().st_mtime if AIS_DB.exists() else 0
        
        if gdrive_mtime > ais_mtime:
            print(f"🔄 Syncing {GDRIVE_CACHE.name} → {AIS_DB}")
            shutil.copy2(GDRIVE_CACHE, AIS_DB)
            print(f"✅ Database synced: {AIS_DB}")
            return True
        else:
            print(f"📦 Database up to date (no changes in Google Drive)")
            return False
    except Exception as e:
        print(f"❌ Sync error: {e}")
        return False


def trigger_firebase_sync():
    """Call firebase_sync.py to update Firebase"""
    try:
        result = subprocess.run(
            ["/home/adityajain/AIS/ais-sales/venv/bin/python", str(FIREBASE_SYNC_SCRIPT)],
            capture_output=True,
            text=True,
            timeout=60
        )
        print(result.stdout)
        if result.returncode != 0:
            print(f"⚠️  Firebase sync warning: {result.stderr}")
    except Exception as e:
        print(f"❌ Firebase sync error: {e}")


def start_background_sync():
    """Run periodic sync every 5 minutes"""
    print(f"🔄 Starting background sync loop (every 5 minutes)...")
    
    while True:
        try:
            # Check and sync from Google Drive
            if sync_to_ais():
                # If DB was updated, sync to Firebase
                print("🔥 Database changed, syncing to Firebase...")
                trigger_firebase_sync()
            
            # Wait 5 minutes before next check
            time.sleep(300)
        except KeyboardInterrupt:
            print("\n👋 Sync stopped")
            break
        except Exception as e:
            print(f"⚠️  Error in sync loop: {e}")
            time.sleep(60)  # Wait before retry


if __name__ == "__main__":
    print(f"📊 Google Drive sync monitor started at {datetime.now()}")
    start_background_sync()
