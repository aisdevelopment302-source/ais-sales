"""
Sync xcomp11.DB from Windows billing PC via SFTP, then push to Firebase.
Runs as a background job alongside the API (5-minute poll loop).

Source:   /D:/CraftInv/xcomp11.DB  (live DB — readable via SFTP even while billing app is open)
Dest:     /home/adityajain/AIS/assets/xcomp11.DB
Auth:     SSH key (no password) — key must be in ~/.ssh/id_rsa

Change detection: after a successful download, the local DB file size is compared
against the size recorded in LAST_SIZE_FILE. Firebase sync is only triggered when
the size changes (i.e. new bills were added). This avoids re-syncing to Firebase
on every 5-minute poll when nothing has changed.

Note: SCP truncates binary files on Windows OpenSSH (CR/LF text mode issue).
      SFTP handles binary transfers correctly.
"""

import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime
import time

# ── Paths ─────────────────────────────────────────────────────────────────────
AIS_DB = Path("/home/adityajain/AIS/assets/xcomp11.DB")
FIREBASE_SYNC_SCRIPT = Path("/home/adityajain/AIS/ais-sales/api/firebase_sync.py")
VENV_PYTHON = Path("/home/adityajain/AIS/ais-sales/venv/bin/python")
# Persists the file size of the last successfully synced DB across restarts
LAST_SIZE_FILE = Path("/home/adityajain/AIS/assets/.last_synced_size")

# ── Windows PC ────────────────────────────────────────────────────────────────
WINDOWS_USER = "HP"
WINDOWS_HOST = "192.168.1.59"
WINDOWS_DB_PATH = "/D:/CraftInv/xcomp11.DB"  # /D:/ prefix required by Windows OpenSSH sftp

POLL_INTERVAL = 300  # seconds (5 minutes)


def get_last_synced_size() -> int:
    """Return the file size recorded in LAST_SIZE_FILE, or 0 if none."""
    try:
        return int(LAST_SIZE_FILE.read_text().strip())
    except (FileNotFoundError, ValueError):
        return 0


def set_last_synced_size(size: int) -> None:
    """Persist the file size of the successfully synced DB."""
    LAST_SIZE_FILE.parent.mkdir(parents=True, exist_ok=True)
    LAST_SIZE_FILE.write_text(str(size))


def is_valid_sqlite(path: Path) -> bool:
    """Quick sanity check: open the DB and run a trivial query."""
    try:
        conn = sqlite3.connect(str(path))
        conn.execute("PRAGMA integrity_check(1)")
        conn.close()
        return True
    except Exception:
        return False


def sftp_pull(remote_path: str, local_path: Path) -> bool:
    """
    Download a file from Windows via SFTP (handles binary correctly unlike SCP on Windows).
    remote_path must use /D:/ style (e.g. /D:/CraftInv/xcomp11.DB).
    Returns True on success.
    """
    sftp_commands = f'get "{remote_path}" {local_path}\nquit\n'
    cmd = [
        "sftp",
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=8",
        f"{WINDOWS_USER}@{WINDOWS_HOST}",
    ]
    try:
        result = subprocess.run(
            cmd,
            input=sftp_commands,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            # Likely means the billing PC is off — not an error worth alarming on
            print(f"[db_sync] Billing PC unreachable or transfer failed (PC may be off)")
            return False
        if "not found" in result.stdout.lower() or "not found" in result.stderr.lower():
            print(f"[db_sync] SFTP: remote file not found: {remote_path}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("[db_sync] SFTP timed out — billing PC may be off")
        return False
    except Exception as e:
        print(f"[db_sync] SFTP exception: {e}")
        return False


def pull() -> bool:
    """
    SFTP the live xcomp11.DB from the Windows billing PC to the Pi.
    Downloads to a temp file, validates integrity, then atomically replaces AIS_DB.

    Change detection: compares the downloaded file size against the last recorded
    size in LAST_SIZE_FILE. Firebase sync is only triggered when the size differs
    (i.e. bills were added or the DB was modified since the last poll).

    Returns True if the DB changed and Firebase should be synced, False otherwise.
    """
    AIS_DB.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = AIS_DB.with_suffix(".tmp")

    if not sftp_pull(WINDOWS_DB_PATH, tmp_path):
        return False

    # Validate before touching the live DB
    if not is_valid_sqlite(tmp_path):
        print("[db_sync] Downloaded DB failed integrity check — skipping")
        tmp_path.unlink(missing_ok=True)
        return False

    new_size = tmp_path.stat().st_size
    last_size = get_last_synced_size()

    if new_size == last_size:
        print(f"[db_sync] No change (size {new_size:,} bytes — same as last sync)")
        tmp_path.unlink(missing_ok=True)
        return False

    # Atomically replace the live DB
    tmp_path.replace(AIS_DB)
    set_last_synced_size(new_size)
    print(f"[db_sync] DB updated — size {last_size:,} → {new_size:,} bytes")
    return True


def trigger_firebase_sync():
    """Run firebase_sync.py in a subprocess to push DB changes to Firestore."""
    print("[db_sync] Triggering Firebase sync...")
    try:
        result = subprocess.run(
            [str(VENV_PYTHON), str(FIREBASE_SYNC_SCRIPT)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.stdout:
            print(result.stdout)
        if result.returncode != 0:
            print(f"[db_sync] Firebase sync stderr: {result.stderr.strip()}")
    except subprocess.TimeoutExpired:
        print("[db_sync] Firebase sync timed out after 120s")
    except Exception as e:
        print(f"[db_sync] Firebase sync exception: {e}")


def start_background_sync():
    """Poll every 5 minutes: pull live DB from Windows, sync to Firebase if changed."""
    print(f"[db_sync] Started at {datetime.now()} — polling every {POLL_INTERVAL}s")
    print(f"[db_sync] Source: {WINDOWS_USER}@{WINDOWS_HOST}:{WINDOWS_DB_PATH}")
    print(f"[db_sync] Destination: {AIS_DB}")

    while True:
        try:
            print(f"\n[db_sync] Checking for DB update at {datetime.now()}")
            if pull():
                trigger_firebase_sync()
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n[db_sync] Stopped")
            break
        except Exception as e:
            print(f"[db_sync] Unexpected error: {e}")
            time.sleep(60)


if __name__ == "__main__":
    start_background_sync()
