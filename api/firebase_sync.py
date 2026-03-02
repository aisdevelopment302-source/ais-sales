"""
Sync xcomp11.DB data to Firebase Firestore
Run this periodically to keep Firebase in sync with the billing database
"""

import firebase_admin
from firebase_admin import credentials, firestore
import sqlite3
import os
from datetime import datetime

# Initialize Firebase
cred_path = os.path.join(os.path.dirname(__file__), "..", "..", "ais-cv", "config", "firebase-service-account.json")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, options={"projectId": "ais-production-e013c"})
db_firestore = firestore.client()

# Database path (points to /home/adityajain/AIS/assets/xcomp11.DB)
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "xcomp11.DB")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def sync_customers_data():
    """Sync customer data from xcomp11.DB to Firebase"""
    print("🔄 Syncing customers...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT accode, acname, addrs1, addrs2, addrs3, gststate, mobile1, email, gstin FROM acmast")
    
    batch = db_firestore.batch()
    count = 0
    
    for row in cursor.fetchall():
        accode = row['accode']
        customer_data = {
            'accode': accode,
            'acname': row['acname'],
            'addrs1': row['addrs1'],
            'addrs2': row['addrs2'],
            'addrs3': row['addrs3'],
            'gststate': row['gststate'],
            'mobile1': row['mobile1'],
            'email': row['email'],
            'gstin': row['gstin']
        }
        
        batch.set(db_firestore.collection('customers').document(str(accode)), customer_data)
        count += 1
    
    batch.commit()
    print(f"✅ Synced {count} customers")
    conn.close()


def sync_items_data():
    """Sync items/products data"""
    print("🔄 Syncing items...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT itemcode, itemname FROM item WHERE itemcode IN (3, 11, 14)")  # MS ANGLE, MILL SCALE, MELTING SCRAP
    
    batch = db_firestore.batch()
    count = 0
    
    for row in cursor.fetchall():
        itemcode = row['itemcode']
        item_data = {
            'itemcode': itemcode,
            'itemname': row['itemname']
        }
        
        batch.set(db_firestore.collection('items').document(str(itemcode)), item_data)
        count += 1
    
    batch.commit()
    print(f"✅ Synced {count} items")
    conn.close()


def sync_sales_data():
    """Sync sales data from xcomp11.DB to Firebase"""
    print("🔄 Syncing sales...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch all sales with customer info
    cursor.execute("""
        SELECT 
            s.vno, s.vdate, s.billno, s.amount, s.billamt,
            COALESCE(s.cgstamt, 0) + COALESCE(s.sgstamt, 0) + COALESCE(s.igstamt, 0) as gst,
            COALESCE(s.cessamt, 0) as cess,
            c.accode, c.acname, c.addrs1, c.addrs2, c.addrs3, c.gststate
        FROM gstsale s
        LEFT JOIN acmast c ON s.party = c.accode
        ORDER BY s.vdate DESC
        LIMIT 500
    """)
    
    batch = db_firestore.batch()
    count = 0
    
    for row in cursor.fetchall():
        vno = row['vno']
        sale_data = {
            'vno': vno,
            'vdate': row['vdate'],
            'billno': row['billno'],
            'amount': row['amount'],
            'billamt': row['billamt'],
            'gst': row['gst'],
            'cess': row['cess'],
            'customer_accode': row['accode'],
            'customer_name': row['acname'],
            'customer_state': row['gststate'],
            'customer_address': f"{row['addrs1']} {row['addrs2']} {row['addrs3']}"
        }
        
        batch.set(db_firestore.collection('sales').document(str(vno)), sale_data)
        count += 1
    
    batch.commit()
    print(f"✅ Synced {count} sales")
    conn.close()


def sync_summary():
    """Create summary statistics for dashboard"""
    print("🔄 Creating summary...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Overall summary
    cursor.execute("""
        SELECT 
            COUNT(*) as total_bills,
            SUM(amount) as total_taxable,
            SUM(billamt) as total_bill_amount,
            SUM(COALESCE(cgstamt, 0) + COALESCE(sgstamt, 0) + COALESCE(igstamt, 0)) as total_gst
        FROM gstsale
    """)
    
    summary_row = cursor.fetchone()
    summary = {
        'total_bills': summary_row['total_bills'] or 0,
        'total_taxable': summary_row['total_taxable'] or 0,
        'total_bill_amount': summary_row['total_bill_amount'] or 0,
        'total_gst': summary_row['total_gst'] or 0,
        'last_synced': datetime.now().isoformat()
    }
    
    db_firestore.collection('_meta').document('summary').set(summary)
    print(f"✅ Summary updated")
    
    conn.close()


def main():
    """Run all syncs"""
    print(f"\n📊 Starting Firebase sync at {datetime.now()}")
    try:
        sync_customers_data()
        sync_items_data()
        sync_sales_data()
        sync_summary()
        print(f"\n✅ All syncs completed at {datetime.now()}\n")
    except Exception as e:
        print(f"\n❌ Sync error: {e}\n")
        raise


if __name__ == "__main__":
    main()
