"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface ItemStats {
  itemname: string;
  group_name: string;
  bill_count: number;
  total_qty: number;   // sum of weight across all line items
  total_sales: number; // sum of taxableamt across all line items
}

// Each row is one month; keys beyond "month" are itemname → sales ₹
type MonthlyItemRow = Record<string, string | number> & { month: string };

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function ItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyItemRow[]>([]);
  const [topItemNames, setTopItemNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const salesSnap = await getDocs(collection(db, "sales"));

      // Per-item totals
      const agg: Record<string, { group_name: string; bill_count: number; total_qty: number; total_sales: number }> = {};
      // Per-month per-item: monthlyByItem[month][itemname] = { sales, qty }
      const monthlyByItem: Record<string, Record<string, { sales: number; qty: number }>> = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        if (sale.invcancelflag === "Y") return;

        const date: string = sale.vdate || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const month = date.slice(0, 7);
        const lineItems: Array<{
          itemname: string;
          weight: number;
          taxableamt: number;
          gstper?: number;
        }> = Array.isArray(sale.items) ? sale.items : [];

        // Track which item names appeared in this bill (for bill_count — count once per bill)
        const seenInBill = new Set<string>();

        lineItems.forEach((li) => {
          const name = li.itemname || "Unknown";
          const qty = li.weight || 0;
          const sales = li.taxableamt || 0;
          const group = ""; // group_name not in items[] array, we'll pick it up later

          if (!agg[name]) agg[name] = { group_name: group, bill_count: 0, total_qty: 0, total_sales: 0 };
          agg[name].total_qty += qty;
          agg[name].total_sales += sales;
          if (!seenInBill.has(name)) {
            agg[name].bill_count += 1;
            seenInBill.add(name);
          }

          // Monthly
          if (month) {
            if (!monthlyByItem[month]) monthlyByItem[month] = {};
            if (!monthlyByItem[month][name]) monthlyByItem[month][name] = { sales: 0, qty: 0 };
            monthlyByItem[month][name].sales += sales;
            monthlyByItem[month][name].qty += qty;
          }
        });
      });

      // Also pull group_name from the items master collection
      const itemsMasterSnap = await getDocs(collection(db, "items"));
      const groupMap: Record<string, string> = {};
      itemsMasterSnap.forEach((doc) => {
        const d = doc.data();
        if (d.itemname) groupMap[d.itemname] = d.group_name || "";
      });
      Object.keys(agg).forEach((name) => {
        agg[name].group_name = groupMap[name] || "";
      });

      const rows: ItemStats[] = Object.entries(agg)
        .map(([itemname, stats]) => ({ itemname, ...stats }))
        .sort((a, b) => b.total_sales - a.total_sales);

      setItems(rows);

      const top5 = rows.slice(0, 5).map((r) => r.itemname);
      setTopItemNames(top5);

      const monthlyRows: MonthlyItemRow[] = Object.entries(monthlyByItem)
        .map(([month, byItem]) => {
          const row: MonthlyItemRow = { month };
          top5.forEach((name) => {
            row[name] = byItem[name]?.sales || 0;
            row[`${name}_qty`] = byItem[name]?.qty || 0;
          });
          return row;
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyData(monthlyRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSales = items.reduce((s, r) => s + r.total_sales, 0);
  const totalQty   = items.reduce((s, r) => s + r.total_qty, 0);

  return (
    <>
      <div className="page-header">
        <h1>Item Sales Analysis</h1>
        <p>Sales breakdown by product</p>
      </div>

      {/* Filters */}
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
          <button className="btn-primary" onClick={fetchData}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => { setFromDate(""); setToDate(""); setTimeout(fetchData, 50); }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Sales (Taxable)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", margin: "6px 0 2px" }}>{formatCurrency(totalSales)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Qty (MT)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", margin: "6px 0 2px" }}>{formatNumber(totalQty)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Distinct Items</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", margin: "6px 0 2px" }}>{items.length}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ec4899" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Avg Rate (₹/MT)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#ec4899", margin: "6px 0 2px" }}>
            {totalQty > 0 ? formatCurrency(totalSales / totalQty) : "—"}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : (
        <>
          {/* Monthly trend chart */}
          {monthlyData.length > 0 && topItemNames.length > 0 && (
            <div className="section-card">
              <div className="section-title">Monthly Sales Trend — Top Items</div>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={monthlyData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend />
                  {topItemNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      name={name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Monthly breakdown table */}
              <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      {topItemNames.map((name) => (
                        <React.Fragment key={name}>
                          <th style={{ textAlign: "right" }}>{name}</th>
                          <th style={{ textAlign: "right" }}>Qty (MT)</th>
                        </React.Fragment>
                      ))}
                      <th style={{ textAlign: "right" }}>Total Sales</th>
                      <th style={{ textAlign: "right" }}>Total Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row) => {
                      const rowSales = topItemNames.reduce((s, n) => s + ((row[n] as number) || 0), 0);
                      const rowQty   = topItemNames.reduce((s, n) => s + ((row[`${n}_qty`] as number) || 0), 0);
                      return (
                        <tr key={row.month}>
                          <td style={{ fontWeight: 500 }}>{row.month}</td>
                          {topItemNames.map((name) => (
                            <React.Fragment key={name}>
                              <td className="num">{formatCurrency((row[name] as number) || 0)}</td>
                              <td className="num">{formatNumber((row[`${name}_qty`] as number) || 0)}</td>
                            </React.Fragment>
                          ))}
                          <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(rowSales)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{formatNumber(rowQty)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td>Total</td>
                      {topItemNames.map((name) => (
                        <React.Fragment key={name}>
                          <td className="num">
                            {formatCurrency(monthlyData.reduce((s, r) => s + ((r[name] as number) || 0), 0))}
                          </td>
                          <td className="num">
                            {formatNumber(monthlyData.reduce((s, r) => s + ((r[`${name}_qty`] as number) || 0), 0))}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatCurrency(monthlyData.reduce(
                          (s, r) => s + topItemNames.reduce((ss, n) => ss + ((r[n] as number) || 0), 0), 0
                        ))}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatNumber(monthlyData.reduce(
                          (s, r) => s + topItemNames.reduce((ss, n) => ss + ((r[`${n}_qty`] as number) || 0), 0), 0
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Item Rankings table */}
          <div className="section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Item Rankings</div>
              <span style={{ fontSize: 12, color: "#64748b" }}>{items.length} items</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Group</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Qty (MT)</th>
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                    <th style={{ textAlign: "right" }}>Avg Rate (₹/MT)</th>
                    <th style={{ width: 100 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const pct = (item.total_sales / (totalSales || 1)) * 100;
                    const avgRate = item.total_qty > 0 ? item.total_sales / item.total_qty : 0;
                    return (
                      <tr key={item.itemname}>
                        <td style={{ color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.itemname}</td>
                        <td>
                          {item.group_name
                            ? <span className="badge badge-blue">{item.group_name}</span>
                            : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td className="num">{item.bill_count}</td>
                        <td className="num">{formatNumber(item.total_qty)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(item.total_sales)}</td>
                        <td className="num">{avgRate > 0 ? formatCurrency(avgRate) : "—"}</td>
                        <td>
                          <div style={{ background: "#f1f5f9", borderRadius: 4, height: 7 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length > 0 && (() => {
                    const totAvg = totalQty > 0 ? totalSales / totalQty : 0;
                    return (
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td />
                        <td style={{ fontWeight: 700 }}>Total</td>
                        <td />
                        <td className="num">{formatNumber(items.reduce((s, r) => s + r.bill_count, 0))}</td>
                        <td className="num">{formatNumber(totalQty)}</td>
                        <td className="num">{formatCurrency(totalSales)}</td>
                        <td className="num">{totAvg > 0 ? formatCurrency(totAvg) : "—"}</td>
                        <td />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
