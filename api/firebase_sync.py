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

    BATCH_SIZE = 500
    batch = db_firestore.batch()
    count = 0
    batch_count = 0

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
            'gstin': row['gstin'],
        }

        batch.set(db_firestore.collection('customers').document(str(accode)), customer_data)
        count += 1
        batch_count += 1

        if batch_count == BATCH_SIZE:
            batch.commit()
            batch = db_firestore.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    print(f"✅ Synced {count} customers")
    conn.close()


def sync_items_data():
    """Sync all items that appear in actual sales data"""
    print("🔄 Syncing items...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Sync every item that has been sold at least once (book L1)
    cursor.execute("""
        SELECT DISTINCT i.itemcode, i.itemname, i.unit, i.hsncode, i.gstrate,
               ig.itemgrpname AS group_name
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        JOIN gstsale s ON sd.book = s.book AND sd.vno = s.vno
        LEFT JOIN itemgrp ig ON i.itemgrpcode = ig.itemgrpcode
        WHERE s.book = 'L1'
        ORDER BY i.itemcode
    """)
    
    batch = db_firestore.batch()
    count = 0
    
    for row in cursor.fetchall():
        itemcode = row['itemcode']
        item_data = {
            'itemcode': itemcode,
            'itemname': row['itemname'],
            'unit': row['unit'],
            'hsncode': row['hsncode'],
            'gstrate': row['gstrate'],
            'group_name': row['group_name'],
        }
        
        batch.set(db_firestore.collection('items').document(str(itemcode)), item_data)
        count += 1
    
    batch.commit()
    print(f"✅ Synced {count} items")
    conn.close()


def sync_sales_data():
    """Sync all sales data from xcomp11.DB to Firebase, including line-item detail"""
    print("🔄 Syncing sales...")

    conn = get_db_connection()
    cursor = conn.cursor()

    # ── 1. Fetch all bill headers (no LIMIT — full history) ──────────────────
    cursor.execute("""
        SELECT
            s.vno, s.vdate, s.billno, s.invno, s.amount, s.billamt,
            COALESCE(s.cgstamt, 0) + COALESCE(s.sgstamt, 0) + COALESCE(s.igstamt, 0) AS gst,
            COALESCE(s.cessamt, 0) AS cess,
            COALESCE(s.invcancelflag, '') AS invcancelflag,
            c.accode, c.acname, c.addrs1, c.addrs2, c.addrs3, c.gststate,
            COALESCE(SUM(sd.weight), 0) AS billqty,
            CASE WHEN SUM(sd.weight) > 0
                 THEN SUM(sd.taxableamt) / SUM(sd.weight)
                 ELSE 0 END AS basic_rate
        FROM gstsale s
        LEFT JOIN acmast c ON s.party = c.accode
        LEFT JOIN gstsaledet sd ON sd.book = s.book AND sd.vno = s.vno
        WHERE s.book = 'L1'
        GROUP BY s.vno
        ORDER BY s.vdate DESC
    """)
    headers = cursor.fetchall()

    # ── 2. Fetch all line items, indexed by vno ───────────────────────────────
    cursor.execute("""
        SELECT
            sd.vno, sd.srno, sd.itemcode, i.itemname, i.unit,
            sd.weight, sd.rate, sd.taxableamt, sd.gstper
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        WHERE sd.book = 'L1'
        ORDER BY sd.vno, sd.srno
    """)
    line_items_by_vno: dict = {}
    for li in cursor.fetchall():
        vno = li['vno']
        if vno not in line_items_by_vno:
            line_items_by_vno[vno] = []
        line_items_by_vno[vno].append({
            'srno': li['srno'],
            'itemcode': li['itemcode'],
            'itemname': li['itemname'],
            'unit': li['unit'],
            'weight': round(float(li['weight'] or 0), 3),
            'rate': round(float(li['rate'] or 0), 2),
            'taxableamt': round(float(li['taxableamt'] or 0), 2),
            'gstper': li['gstper'],
        })

    # ── 3. Write to Firestore in batches of 500 ───────────────────────────────
    BATCH_SIZE = 500
    batch = db_firestore.batch()
    count = 0
    batch_count = 0

    for row in headers:
        vno = row['vno']
        sale_data = {
            'vno': vno,
            'vdate': row['vdate'],
            'billno': row['billno'],
            'invno': row['invno'],
            'amount': row['amount'],
            'billamt': row['billamt'],
            'gst': row['gst'],
            'cess': row['cess'],
            'invcancelflag': row['invcancelflag'],
            'customer_accode': row['accode'],
            'customer_name': row['acname'],
            'customer_state': row['gststate'],
            'customer_address': f"{row['addrs1'] or ''} {row['addrs2'] or ''} {row['addrs3'] or ''}".strip(),
            'billqty': round(float(row['billqty'] or 0), 3),
            'basic_rate': round(float(row['basic_rate'] or 0), 2),
            'items': line_items_by_vno.get(vno, []),
        }

        batch.set(db_firestore.collection('sales').document(str(vno)), sale_data)
        count += 1
        batch_count += 1

        if batch_count == BATCH_SIZE:
            batch.commit()
            print(f"  → committed batch ({count} so far)...")
            batch = db_firestore.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    print(f"✅ Synced {count} sales")
    conn.close()


def sync_summary():
    """Create summary statistics for dashboard"""
    print("🔄 Creating summary...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Overall summary — book='L1' only, excluding cancelled bills
    cursor.execute("""
        SELECT 
            COUNT(*) as total_bills,
            SUM(amount) as total_taxable,
            SUM(billamt) as total_bill_amount,
            SUM(COALESCE(cgstamt, 0) + COALESCE(sgstamt, 0) + COALESCE(igstamt, 0)) as total_gst
        FROM gstsale
        WHERE book = 'L1' AND COALESCE(invcancelflag, '') != 'Y'
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
