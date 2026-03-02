from fastapi import APIRouter, Query
from typing import Optional
from database import query, query_one

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


@router.get("")
def get_purchases_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    conditions: list = []
    params: list = []

    if from_date:
        conditions.append("p.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("p.vdate <= ?")
        params.append(to_date)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    summary = query_one(f"""
        SELECT
            COUNT(*) AS total_bills,
            SUM(amount) AS total_taxable,
            SUM(billamt) AS total_bill_amount,
            SUM(cgstamt + sgstamt + igstamt) AS total_gst
        FROM gstpurch p
        {where}
    """, tuple(params))

    monthly = query(f"""
        SELECT
            strftime('%Y-%m', p.vdate) AS month,
            COUNT(*) AS bill_count,
            SUM(p.amount) AS taxable_amount,
            SUM(p.billamt) AS bill_amount
        FROM gstpurch p
        {where}
        GROUP BY month
        ORDER BY month
    """, tuple(params))

    suppliers = query(f"""
        SELECT
            a.accode AS id,
            a.acname AS name,
            COUNT(p.vno) AS bill_count,
            SUM(p.amount) AS taxable_amount,
            SUM(p.billamt) AS total_purchases
        FROM gstpurch p
        JOIN acmast a ON p.party = a.accode
        {where}
        GROUP BY p.party
        ORDER BY total_purchases DESC
    """, tuple(params))

    top_items = query(f"""
        SELECT
            i.itemname AS name,
            SUM(pd.qty) AS total_qty,
            SUM(pd.taxableamt) AS total_amount
        FROM gstpurchdet pd
        JOIN item i ON pd.itemcode = i.itemcode
        JOIN gstpurch p ON pd.book = p.book AND pd.vno = p.vno
        {where}
        GROUP BY pd.itemcode
        ORDER BY total_amount DESC
        LIMIT 10
    """, tuple(params))

    bills = query(f"""
        SELECT p.vno, p.vdate, p.billno, a.acname AS party_name,
               p.amount, p.billamt
        FROM gstpurch p
        JOIN acmast a ON p.party = a.accode
        {where}
        ORDER BY p.vdate DESC
    """, tuple(params))

    return {
        "summary": summary,
        "monthly": monthly,
        "suppliers": suppliers,
        "top_items": top_items,
        "bills": bills,
    }
