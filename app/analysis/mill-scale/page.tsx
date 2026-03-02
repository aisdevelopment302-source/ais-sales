"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

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

const MILL_SCALE_ID = 11;

export default function MillScaleAnalysisPage() {
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchMonthly = async () => {
    setLoading(true);
    try {
      const salesSnap = await getDocs(collection(db, "sales"));

      const agg: Record<string, { total_weight: number; total_sales: number }> = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.date || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const month = date.slice(0, 7);
        if (!month) return;

        const saleItems: { itemcode: number; weight?: number; amount?: number }[] = sale.items || [];
        saleItems.forEach((si) => {
          if (Number(si.itemcode) !== MILL_SCALE_ID) return;

          if (!agg[month]) agg[month] = { total_weight: 0, total_sales: 0 };
          agg[month].total_weight += si.weight || 0;
          agg[month].total_sales += si.amount || 0;
        });
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
  }, []);

  const totalSales = monthly.reduce((sum, m) => sum + (m.total_sales || 0), 0);
  const totalWeight = monthly.reduce((sum, m) => sum + (m.total_weight || 0), 0);
  const avgRate = totalWeight > 0 ? totalSales / totalWeight : 0;
  const avgMonthly = monthly.length > 0 ? totalSales / monthly.length : 0;

  const kpis: SummaryKPI[] = [
    { label: "Total Sales (₹)", value: formatCurrency(totalSales), color: "#ef4444" },
    { label: "Total Weight (kg)", value: formatNumber(Math.round(totalWeight)), color: "#f97316" },
    { label: "Avg Rate/kg", value: avgRate.toFixed(2), color: "#eab308" },
    { label: "Avg Monthly Sales", value: formatCurrency(avgMonthly), color: "#dc2626" },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Mill Scale Analysis</h1>
        <p>Waste by-product sales analysis (Item: Mill Scale)</p>
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
            <div className="section-title">Monthly Weight & Sales Trend</div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)} />
                <Legend />
                <Bar yAxisId="left" dataKey="total_weight" fill="#f97316" name="Weight (kg)" />
                <Bar yAxisId="right" dataKey="total_sales" fill="#ef4444" name="Sales (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-card">
            <div className="section-title">Monthly Breakdown</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: "right" }}>Weight (kg)</th>
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                    <th style={{ textAlign: "right" }}>Rate/kg (₹)</th>
                    <th style={{ textAlign: "right" }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.month}>
                      <td style={{ fontWeight: 500 }}>{row.month}</td>
                      <td className="num">{row.total_weight?.toFixed(0)}</td>
                      <td className="num">{formatCurrency(row.total_sales)}</td>
                      <td className="num">
                        {row.total_weight > 0
                          ? (row.total_sales / row.total_weight).toFixed(2)
                          : "—"}
                      </td>
                      <td className="num">
                        {totalSales > 0 ? ((row.total_sales / totalSales) * 100).toFixed(1) : "0"}%
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
