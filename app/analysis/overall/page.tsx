"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface MonthlyRow {
  month: string;
  total_sales: number;
  total_qty: number;
}

interface SummaryKPI {
  label: string;
  value: string;
  color: string;
}

export default function OverallAnalysisPage() {
  const { user } = useAuth();
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchMonthly = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const salesSnap = await getDocs(collection(db, "sales"));

      const agg: Record<string, { total_sales: number; total_qty: number }> = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.vdate || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const month = date.slice(0, 7); // "YYYY-MM"
        if (!month) return;

        if (!agg[month]) agg[month] = { total_sales: 0, total_qty: 0 };
        agg[month].total_sales += sale.billamt || sale.amount || 0;
        agg[month].total_qty += sale.billqty ?? 0;
      });

      const rows: MonthlyRow[] = Object.entries(agg)
        .map(([month, stats]) => ({ month, ...stats }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthly(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSales = monthly.reduce((sum, m) => sum + (m.total_sales || 0), 0);
  const totalQty = monthly.reduce((sum, m) => sum + (m.total_qty || 0), 0);
  const avgMonthly = monthly.length > 0 ? totalSales / monthly.length : 0;
  const avgRate = totalQty > 0 ? totalSales / totalQty : 0;

  const kpis: SummaryKPI[] = [
    { label: "Total Sales", value: formatCurrency(totalSales), color: "#3b82f6" },
    { label: "Total Qty (MT)", value: formatNumber(totalQty), color: "#10b981" },
    { label: "Avg Rate (₹/MT)", value: avgRate > 0 ? formatCurrency(avgRate) : "—", color: "#ec4899" },
    { label: "Avg Monthly Sales", value: formatCurrency(avgMonthly), color: "#f59e0b" },
    { label: "Months", value: formatNumber(monthly.length), color: "#8b5cf6" },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Overall Sales Analysis</h1>
        <p>Monthly trends across all products</p>
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
          <button className="btn-primary" onClick={fetchMonthly}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setTimeout(fetchMonthly, 50);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label} style={{ borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              {k.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, margin: "6px 0 2px" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : monthly.length > 0 ? (
        <>
          <div className="section-card">
            <div className="section-title">Monthly Sales Trend</div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)} />
                <Legend />
                <Line type="monotone" dataKey="total_sales" stroke="#3b82f6" name="Sales (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="section-card">
            <div className="section-title">Monthly Breakdown</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: "right" }}>Qty (MT)</th>
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                    <th style={{ textAlign: "right" }}>Avg Rate (₹/MT)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => {
                    const rate = row.total_qty > 0 ? row.total_sales / row.total_qty : 0;
                    return (
                      <tr key={row.month}>
                        <td style={{ fontWeight: 500 }}>{row.month}</td>
                        <td className="num">{formatNumber(row.total_qty)}</td>
                        <td className="num">{formatCurrency(row.total_sales)}</td>
                        <td className="num">{rate > 0 ? formatCurrency(rate) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
                    <td>Total</td>
                    <td className="num">{formatNumber(totalQty)}</td>
                    <td className="num">{formatCurrency(totalSales)}</td>
                    <td className="num">{avgRate > 0 ? formatCurrency(avgRate) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No data available</div>
      )}
    </>
  );
}
