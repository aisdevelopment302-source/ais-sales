"""
Firebase Firestore Configuration
================================
Connects to the same Firebase project as ais-cv
Project: ais-central (ais-production-e013c)
"""

import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

# Firebase credentials path
CREDS_PATH = Path.home() / ".config" / "firebase" / "ais-central-key.json"

def init_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        if firebase_admin._apps:
            return firestore.client()
        
        if not CREDS_PATH.exists():
            raise FileNotFoundError(f"Firebase credentials not found at {CREDS_PATH}")
        
        cred = credentials.Certificate(str(CREDS_PATH))
        firebase_admin.initialize_app(cred)
        print(f"✓ Firebase initialized from {CREDS_PATH}")
        return firestore.client()
    except Exception as e:
        print(f"❌ Firebase init failed: {e}")
        raise

def get_firestore_client():
    """Get Firestore client instance."""
    try:
        if not firebase_admin._apps:
            init_firebase()
        return firestore.client()
    except Exception as e:
        print(f"Error getting Firestore client: {e}")
        raise

# Initialize on import
_db = None

def db():
    """Lazy-load Firestore client."""
    global _db
    if _db is None:
        _db = get_firestore_client()
    return _db
