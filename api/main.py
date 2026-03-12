from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sales, customers, items, purchases, summary, geography
import firebase_admin
from firebase_admin import credentials
import os

app = FastAPI()

# Enable CORS for Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase if not already initialized
try:
    cred_path = os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
except:
    pass  # Firebase might already be initialized or creds not available

# Include routers
app.include_router(sales.router)
app.include_router(customers.router)
app.include_router(items.router)
app.include_router(purchases.router)
app.include_router(summary.router)
app.include_router(geography.router)

@app.get("/")
def root():
    return {"message": "AIS Sales API", "status": "healthy"}

@app.get("/health")
def health():
    return {"status": "ok"}
