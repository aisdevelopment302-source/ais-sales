from fastapi import APIRouter, Query
from typing import Optional
from database import query, query_one

router = APIRouter(prefix="/api/sales", tags=["sales"])

ACTIVE = "COALESCE(s.invcancelflag, '') != 'Y'"
CANCELLED = "COALESCE(s.invcancelflag, '') = 'Y'"


@router.get("/monthly")
def get_monthly_sales(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    conditions = [ACTIVE, "s.book = 'L1'"]
    params = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    rows = query(f"""
        SELECT
            strftime('%Y-%m', vdate) AS month,
            COUNT(*) AS bill_count,
            SUM(amount) AS taxable_amount,
            SUM(billamt) AS bill_amount,
            SUM(cgstamt + sgstamt + igstamt) AS gst_amount
        FROM gstsale s
        WHERE {where}
        GROUP BY month
        ORDER BY month
    """, tuple(params))

    return rows


@router.get("/cancelled")
def get_cancelled_bills():
    """Return all cancelled bills with party details."""
    rows = query(f"""
        SELECT s.vno, s.vdate, s.billno, a.acname AS party_name,
               s.amount, s.cgstamt, s.sgstamt, s.igstamt, s.billamt
        FROM gstsale s
        JOIN acmast a ON s.party = a.accode
        WHERE {CANCELLED} AND s.book = 'L1'
        ORDER BY s.vdate DESC
    """)
    total_amount = sum(r["billamt"] or 0 for r in rows)
    total_taxable = sum(r["amount"] or 0 for r in rows)
    return {
        "count": len(rows),
        "total_bill_amount": total_amount,
        "total_taxable": total_taxable,
        "data": rows,
    }


@router.get("/bills")
def get_bills(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    party: Optional[int] = Query(None),
    item: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    show_cancelled: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    base = CANCELLED if show_cancelled else ACTIVE
    conditions = [base, "s.book = 'L1'"]
    params: list = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)
    if party:
        conditions.append("s.party = ?")
        params.append(party)
    if search:
        conditions.append("a.acname LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)

    if item:
        join_det = "JOIN gstsaledet sd ON sd.book = s.book AND sd.vno = s.vno AND sd.itemcode = ?"
        params_with_item = [item] + params
        count_row = query_one(f"""
            SELECT COUNT(DISTINCT s.rowid) AS total
            FROM gstsale s
            JOIN acmast a ON s.party = a.accode
            {join_det}
            WHERE {where}
        """, tuple(params_with_item))

        offset = (page - 1) * page_size
        rows = query(f"""
            SELECT DISTINCT s.vno, s.vdate, s.billno, a.acname AS party_name,
                   s.amount, s.cgstamt, s.sgstamt, s.igstamt, s.billamt, s.invcancelflag
            FROM gstsale s
            JOIN acmast a ON s.party = a.accode
            {join_det}
            WHERE {where}
            ORDER BY s.vdate DESC, s.vno DESC
            LIMIT ? OFFSET ?
        """, tuple(params_with_item + [page_size, offset]))
    else:
        count_row = query_one(f"""
            SELECT COUNT(*) AS total
            FROM gstsale s
            JOIN acmast a ON s.party = a.accode
            WHERE {where}
        """, tuple(params))

        offset = (page - 1) * page_size
        rows = query(f"""
            SELECT s.vno, s.vdate, s.billno, a.acname AS party_name,
                   s.amount, s.cgstamt, s.sgstamt, s.igstamt, s.billamt, s.invcancelflag
            FROM gstsale s
            JOIN acmast a ON s.party = a.accode
            WHERE {where}
            ORDER BY s.vdate DESC, s.vno DESC
            LIMIT ? OFFSET ?
        """, tuple(params + [page_size, offset]))

    return {
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
        "data": rows,
    }


@router.get("/bill/{vno}")
def get_bill_detail(vno: int):
    header = query_one("""
        SELECT s.*, a.acname AS party_name, a.gstin AS party_gstin
        FROM gstsale s
        JOIN acmast a ON s.party = a.accode
        WHERE s.book = 'L1' AND s.vno = ?
    """, (vno,))

    details = query("""
        SELECT sd.*, i.itemname, i.unit
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        WHERE sd.book = 'L1' AND sd.vno = ?
        ORDER BY sd.srno
    """, (vno,))

    return {"header": header, "details": details}
