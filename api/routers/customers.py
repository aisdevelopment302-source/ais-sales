from fastapi import APIRouter, Query
from typing import Optional
from database import query, query_one

router = APIRouter(prefix="/api/customers", tags=["customers"])

ACTIVE = "COALESCE(s.invcancelflag, '') != 'Y'"


@router.get("")
def get_customers(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    conditions = [ACTIVE, "s.book = 'L1'"]
    params: list = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)
    if search:
        conditions.append("a.acname LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)

    count_row = query_one(f"""
        SELECT COUNT(DISTINCT s.party) AS total
        FROM gstsale s
        JOIN acmast a ON s.party = a.accode
        WHERE {where}
    """, tuple(params))

    offset = (page - 1) * page_size
    rows = query(f"""
        SELECT
            a.accode AS id,
            a.acname AS name,
            a.gststate AS state_code,
            gs.statename AS state_name,
            COUNT(s.vno) AS bill_count,
            SUM(s.amount) AS taxable_amount,
            SUM(s.billamt) AS total_sales
        FROM gstsale s
        JOIN acmast a ON s.party = a.accode
        LEFT JOIN gststate gs ON a.gststate = gs.statecode
        WHERE {where}
        GROUP BY s.party
        ORDER BY total_sales DESC
        LIMIT ? OFFSET ?
    """, tuple(params + [page_size, offset]))

    return {
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
        "data": rows,
    }


@router.get("/{customer_id}")
def get_customer_detail(
    customer_id: int,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    info = query_one("""
        SELECT a.*, gs.statename
        FROM acmast a
        LEFT JOIN gststate gs ON a.gststate = gs.statecode
        WHERE a.accode = ?
    """, (customer_id,))

    conditions = [
        ACTIVE,
        "s.book = 'L1'",
        "s.party = ?",
    ]
    params: list = [customer_id]

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    monthly = query(f"""
        SELECT strftime('%Y-%m', s.vdate) AS month,
               COUNT(*) AS bill_count,
               SUM(s.amount) AS taxable_amount,
               SUM(s.billamt) AS bill_amount
        FROM gstsale s
        WHERE {where}
        GROUP BY month
        ORDER BY month
    """, tuple(params))

    top_items = query(f"""
        SELECT i.itemname AS name, SUM(sd.taxableamt) AS total_sales, SUM(sd.weight) AS total_weight
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        JOIN gstsale s ON sd.book = s.book AND sd.vno = s.vno
        WHERE {where}
        GROUP BY sd.itemcode
        ORDER BY total_sales DESC
        LIMIT 10
    """, tuple(params))

    bills = query(f"""
        SELECT s.vno, s.vdate, s.billno, s.amount, s.billamt
        FROM gstsale s
        WHERE {where}
        ORDER BY s.vdate DESC
        LIMIT 50
    """, tuple(params))

    return {
        "info": info,
        "monthly": monthly,
        "top_items": top_items,
        "bills": bills,
    }
