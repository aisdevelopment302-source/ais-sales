from fastapi import APIRouter
from database import query, query_one

router = APIRouter(prefix="/api/summary", tags=["summary"])

# Active bills: invcancelflag is not 'Y'
ACTIVE = "COALESCE(s.invcancelflag, '') != 'Y'"
ACTIVE_BARE = "COALESCE(invcancelflag, '') != 'Y'"


@router.get("")
def get_summary():
    sales = query_one(f"""
        SELECT
            COUNT(*) AS total_bills,
            SUM(amount) AS total_taxable,
            SUM(billamt) AS total_bill_amount,
            SUM(cgstamt + sgstamt + igstamt) AS total_gst,
            SUM(cessamt) AS total_cess
        FROM gstsale
        WHERE {ACTIVE_BARE}
    """)

    cancelled = query_one("""
        SELECT
            COUNT(*) AS cancelled_bills,
            SUM(billamt) AS cancelled_amount,
            SUM(amount) AS cancelled_taxable
        FROM gstsale
        WHERE COALESCE(invcancelflag, '') = 'Y'
    """)

    cr_notes = query_one(f"""
        SELECT
            COUNT(*) AS cr_bills,
            SUM(billamt) AS cr_amount
        FROM gstsale s
        WHERE book = 'L6' AND {ACTIVE}
    """)

    purchases = query_one("""
        SELECT
            COUNT(*) AS total_purchase_bills,
            SUM(amount) AS total_purchase_taxable,
            SUM(billamt) AS total_purchase_amount
        FROM gstpurch
    """)

    top_customers = query(f"""
        SELECT a.acname AS name, COUNT(s.vno) AS bill_count, SUM(s.billamt) AS total_sales
        FROM gstsale s
        JOIN acmast a ON s.party = a.accode
        WHERE {ACTIVE} AND s.book = 'L1'
        GROUP BY s.party
        ORDER BY total_sales DESC
        LIMIT 5
    """)

    top_items = query(f"""
        SELECT i.itemname AS name, SUM(sd.taxableamt) AS total_sales, SUM(sd.weight) AS total_weight
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        JOIN gstsale s ON sd.book = s.book AND sd.vno = s.vno
        WHERE {ACTIVE} AND s.book = 'L1'
        GROUP BY sd.itemcode
        ORDER BY total_sales DESC
        LIMIT 5
    """)

    company = query_one("SELECT coname, fyfrom, fyto, gstin FROM cosetup LIMIT 1")

    return {
        "company": company,
        "sales": sales,
        "cancelled": cancelled,
        "credit_notes": cr_notes,
        "purchases": purchases,
        "top_customers": top_customers,
        "top_items": top_items,
    }
