from fastapi import APIRouter, Query
from typing import Optional
from database import query

router = APIRouter(prefix="/api/geography", tags=["geography"])

ACTIVE = "COALESCE(s.invcancelflag, '') != 'Y'"


@router.get("/states")
def get_state_sales(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Get sales aggregated by state."""
    conditions = [ACTIVE, "s.book = 'L1'"]
    params: list = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    rows = query(f"""
        SELECT
            gs.statecode,
            gs.statename,
            COUNT(DISTINCT s.vno) AS bill_count,
            COUNT(DISTINCT a.accode) AS customer_count,
            SUM(sd.weight) AS total_weight,
            SUM(sd.taxableamt) AS total_sales,
            AVG(sd.rate) AS avg_rate
        FROM gstsale s
        JOIN gstsaledet sd ON s.book = sd.book AND s.vno = s.vno
        JOIN acmast a ON s.party = a.accode
        LEFT JOIN gststate gs ON a.gststate = gs.statecode
        WHERE {where}
        GROUP BY a.gststate, gs.statename
        ORDER BY total_sales DESC
    """, tuple(params))

    return rows


@router.get("/cities/{state_code}")
def get_city_sales(
    state_code: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Get sales by city within a state."""
    conditions = [ACTIVE, "s.book = 'L1'", "a.gststate = ?"]
    params: list = [state_code]

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    rows = query(f"""
        SELECT
            a.accode,
            a.acname,
            CASE 
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%PUNE%' THEN 'Pune'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%MUMBAI%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%MULUND%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%GHATKOPAR%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%NAVI MUMBAI%' THEN 'Navi Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%ULHASNAGAR%' THEN 'Ulhasnagar'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%BORIVALI%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%DAHISAR%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%DARUKHANA%' THEN 'Mumbai'
                WHEN UPPER(a.addrs1 || ' ' || COALESCE(a.addrs2, '') || ' ' || COALESCE(a.addrs3, '') || ' ' || COALESCE(a.addrs4, '')) LIKE '%VIKHROLI%' THEN 'Mumbai'
                ELSE 'Other'
            END AS city,
            a.addrs1 || ', ' || COALESCE(a.addrs2, '') AS address,
            COUNT(DISTINCT s.vno) AS bill_count,
            SUM(sd.weight) AS total_weight,
            SUM(sd.taxableamt) AS total_sales,
            AVG(sd.rate) AS avg_rate
        FROM gstsale s
        JOIN gstsaledet sd ON s.book = sd.book AND s.vno = s.vno
        JOIN acmast a ON s.party = a.accode
        WHERE {where}
        GROUP BY a.accode
        ORDER BY total_sales DESC
    """, tuple(params))

    return rows


@router.get("/summary")
def get_geography_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Get overall geography summary."""
    conditions = [ACTIVE, "s.book = 'L1'"]
    params: list = []

    if from_date:
        conditions.append("s.vdate >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("s.vdate <= ?")
        params.append(to_date)

    where = " AND ".join(conditions)

    summary = query(f"""
        SELECT
            COUNT(DISTINCT s.vno) AS total_bills,
            COUNT(DISTINCT a.accode) AS total_customers,
            COUNT(DISTINCT a.gststate) AS total_states,
            SUM(sd.weight) AS total_weight,
            SUM(sd.taxableamt) AS total_sales
        FROM gstsale s
        JOIN gstsaledet sd ON s.book = sd.book AND s.vno = s.vno
        JOIN acmast a ON s.party = a.accode
        WHERE {where}
    """, tuple(params))

    return summary[0] if summary else {}
