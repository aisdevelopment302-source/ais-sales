"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/api";
import ItemsChart from "@/components/ItemsChart";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface ItemRow {
  id: number;
  name: string;
  unit: string;
  group_name: string;
  bill_count: number;
  total_weight: number;
  total_sales: number;
  avg_rate: number;
}

export default function ItemsPage() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [itemGroup, setItemGroup] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [salesSnap, itemsSnap] = await Promise.all([
        getDocs(collection(db, "sales")),
        getDocs(collection(db, "items")),
      ]);

      // Build items metadata map: itemcode -> {name, unit, group}
      const itemMeta: Record<number, { name: string; unit: string; group: string }> = {};
      itemsSnap.forEach((doc) => {
        const d = doc.data();
        itemMeta[Number(d.code)] = {
          name: d.name || "",
          unit: d.unit || "",
          group: d.group || "",
        };
      });

      // Collect all unique groups
      const groupSet = new Set<string>();
      Object.values(itemMeta).forEach((m) => {
        if (m.group) groupSet.add(m.group);
      });
      setGroups(Array.from(groupSet).sort());

      // Aggregate per itemcode
      const agg: Record<
        number,
        { bill_count: number; total_weight: number; total_sales: number }
      > = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.date || "";

        // Date filter
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const saleItems: { itemcode: number; weight?: number; amount?: number }[] =
          sale.items || [];

        saleItems.forEach((si) => {
          const code = Number(si.itemcode);
          const meta = itemMeta[code];
          if (!meta) return;

          // Group filter
          if (itemGroup && meta.group !== itemGroup) return;

          if (!agg[code]) agg[code] = { bill_count: 0, total_weight: 0, total_sales: 0 };
          agg[code].bill_count += 1;
          agg[code].total_weight += si.weight || 0;
          agg[code].total_sales += si.amount || 0;
        });
      });

      const rows: ItemRow[] = Object.entries(agg)
        .map(([codeStr, stats]) => {
          const code = Number(codeStr);
          const meta = itemMeta[code] || { name: String(code), unit: "", group: "" };
          return {
            id: code,
            name: meta.name,
            unit: meta.unit,
            group_name: meta.group,
            bill_count: stats.bill_count,
            total_weight: stats.total_weight,
            total_sales: stats.total_sales,
            avg_rate: stats.total_weight > 0 ? stats.total_sales / stats.total_weight : 0,
          };
        })
        .sort((a, b) => b.total_sales - a.total_sales);

      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, itemGroup, user]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSales = items.reduce((s, i) => s + (i.total_sales || 0), 0);
  const maxSales = items[0]?.total_sales || 1;

  return (
    <>
      <div className="page-header">
        <h1>Items / Products</h1>
        <p>Sales breakdown by item and item group</p>
      </div>

      <div className="section-card">
        <div className="filter-row">
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Item Group</label>
            <select value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={fetchData}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => {
              setFromDate(""); setToDate(""); setItemGroup("");
              setTimeout(fetchData, 50);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {items.length > 0 && <ItemsChart items={items.slice(0, 10)} />}

      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Item-wise Sales</div>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Total: {formatCurrency(totalSales)} across {items.length} items
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Group</th>
                  <th>Unit</th>
                  <th style={{ textAlign: "right" }}>Bills</th>
                  <th style={{ textAlign: "right" }}>Total Weight</th>
                  <th style={{ textAlign: "right" }}>Avg Rate</th>
                  <th style={{ textAlign: "right" }}>Total Sales</th>
                  <th style={{ width: 100 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const pct = (item.total_sales / maxSales) * 100;
                  return (
                    <tr key={item.id}>
                      <td style={{ color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>
                        <span className="badge badge-orange">{item.group_name || "—"}</span>
                      </td>
                      <td>{item.unit}</td>
                      <td className="num">{item.bill_count}</td>
                      <td className="num">{item.total_weight?.toFixed(3)}</td>
                      <td className="num">
                        {item.avg_rate?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(item.total_sales)}</td>
                      <td>
                        <div style={{ background: "#f1f5f9", borderRadius: 4, height: 7 }}>
                          <div
                            style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 4 }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
