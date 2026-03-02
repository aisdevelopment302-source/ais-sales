"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface MonthlyRow {
  month: string;
  total_weight: number;
  total_sales: number;
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

      const agg: Record<string, { total_weight: number; total_sales: number }> = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.date || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const month = date.slice(0, 7); // "YYYY-MM"
        if (!month) return;

        if (!agg[month]) agg[month] = { total_weight: 0, total_sales: 0 };
        agg[month].total_weight += sale.total_weight || 0;
        agg[month].total_sales += sale.bill_amount || sale.amount || 0;
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
  const totalWeight = monthly.reduce((sum, m) => sum + (m.total_weight || 0), 0);
  const avgMonthly = monthly.length > 0 ? totalSales / monthly.length : 0;

  const kpis: SummaryKPI[] = [
    { label: "Total Sales", value: formatCurrency(totalSales), color: "#3b82f6" },
    { label: "Total Weight (MT)", value: (totalWeight / 1000).toFixed(2), color: "#10b981" },
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
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="total_sales" stroke="#3b82f6" name="Sales (₹)" />
                <Line yAxisId="right" type="monotone" dataKey="total_weight" stroke="#10b981" name="Weight (kg)" />
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
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                    <th style={{ textAlign: "right" }}>Weight (kg)</th>
                    <th style={{ textAlign: "right" }}>Avg Price/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.month}>
                      <td style={{ fontWeight: 500 }}>{row.month}</td>
                      <td className="num">{formatCurrency(row.total_sales)}</td>
                      <td className="num">{row.total_weight?.toFixed(0)}</td>
                      <td className="num">
                        {row.total_weight > 0
                          ? (row.total_sales / row.total_weight).toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
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
