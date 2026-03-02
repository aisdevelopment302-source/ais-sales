from fastapi import APIRouter, Query
from typing import Optional
from database import query, query_one

router = APIRouter(prefix="/api/items", tags=["items"])

ACTIVE = "COALESCE(s.invcancelflag, '') != 'Y'"


@router.get("")
def get_items_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    item_group: Optional[int] = Query(None),
):
    conditions = [ACTIVE, "s.book = 'L1'"]
    params: list = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)
    if item_group:
        conditions.append("i.itemgrpcode = ?")
        params.append(item_group)

    where = " AND ".join(conditions)

    rows = query(f"""
        SELECT
            i.itemcode AS id,
            i.itemname AS name,
            i.unit,
            ig.itemgrpname AS group_name,
            i.gstrate,
            COUNT(DISTINCT s.vno) AS bill_count,
            SUM(sd.weight) AS total_weight,
            SUM(sd.taxableamt) AS total_sales,
            AVG(sd.rate) AS avg_rate
        FROM gstsaledet sd
        JOIN item i ON sd.itemcode = i.itemcode
        LEFT JOIN itemgrp ig ON i.itemgrpcode = ig.itemgrpcode
        JOIN gstsale s ON sd.book = s.book AND sd.vno = s.vno
        WHERE {where}
        GROUP BY sd.itemcode
        ORDER BY total_sales DESC
    """, tuple(params))

    return rows


@router.get("/groups")
def get_item_groups():
    return query("SELECT itemgrpcode AS id, itemgrpname AS name FROM itemgrp ORDER BY itemgrpname")


@router.get("/monthly")
def get_item_monthly(
    item_id: int = Query(...),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    conditions = [
        ACTIVE,
        "s.book = 'L1'",
        "sd.itemcode = ?",
    ]
    params: list = [item_id]

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    return query(f"""
        SELECT
            strftime('%Y-%m', s.vdate) AS month,
            SUM(sd.weight) AS total_weight,
            SUM(sd.taxableamt) AS total_sales
        FROM gstsaledet sd
        JOIN gstsale s ON sd.book = s.book AND sd.vno = s.vno
        WHERE {where}
        GROUP BY month
        ORDER BY month
    """, tuple(params))
