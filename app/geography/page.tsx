"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
  "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh (New)", "38": "Ladakh",
  "97": "Other Territory", "99": "Centre Jurisdiction",
};

interface StateRow {
  statecode: string;
  statename: string;
  bill_count: number;
  customer_count: number;
  total_sales: number;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function GeographyPage() {
  const { user } = useAuth();
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const salesSnap = await getDocs(collection(db, "sales"));

      // Aggregate per state using customer_state directly from sales docs
      const agg: Record<
        string,
        { bill_count: number; customers: Set<string>; total_sales: number }
      > = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.vdate || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const stateCode = String(sale.customer_state || "99");
        const accode = String(sale.customer_accode || "");

        if (!agg[stateCode]) {
          agg[stateCode] = { bill_count: 0, customers: new Set(), total_sales: 0 };
        }
        agg[stateCode].bill_count += 1;
        agg[stateCode].customers.add(accode);
        agg[stateCode].total_sales += sale.billamt || sale.amount || 0;
      });

      const rows: StateRow[] = Object.entries(agg)
        .map(([code, stats]) => ({
          statecode: code,
          statename: GST_STATES[code] || `State ${code}`,
          bill_count: stats.bill_count,
          customer_count: stats.customers.size,
          total_sales: stats.total_sales,
        }))
        .sort((a, b) => b.total_sales - a.total_sales);

      setStates(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSales = states.reduce((s, r) => s + r.total_sales, 0);
  const totalCustomers = states.reduce((s, r) => s + r.customer_count, 0);

  const chartData = states.map((s) => ({
    name: s.statename,
    sales: s.total_sales,
  }));

  const pieData = states.map((s) => ({
    name: s.statename,
    value: s.total_sales,
  }));

  return (
    <>
      <div className="page-header">
        <h1>Geographic Analysis</h1>
        <p>Sales breakdown by state and region</p>
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
          <button className="btn-primary" onClick={fetchData}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setTimeout(fetchData, 50);
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
        <div className="kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Sales</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", margin: "6px 0 2px" }}>
            {formatCurrency(totalSales)}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Bills</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", margin: "6px 0 2px" }}>
            {states.reduce((s, r) => s + r.bill_count, 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>States</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", margin: "6px 0 2px" }}>
            {formatNumber(states.length)}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Customers</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6", margin: "6px 0 2px" }}>
            {formatNumber(totalCustomers)}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : (
        <>
          <div className="section-card">
            <div className="section-title">Sales by State</div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(0) : value)} />
                <Legend />
                <Bar dataKey="sales" fill="#3b82f6" name="Sales (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-card">
            <div className="section-title">Sales Distribution</div>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / (totalSales || 1)) * 100).toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="section-card">
            <div className="section-title">State-wise Breakdown</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>State</th>
                    <th style={{ textAlign: "right" }}>Customers</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Total Sales</th>
                    <th style={{ width: 100 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((state, i) => {
                    const pct = (state.total_sales / (totalSales || 1)) * 100;
                    return (
                      <tr key={state.statecode}>
                        <td style={{ color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{state.statename}</td>
                        <td className="num">{state.customer_count}</td>
                        <td className="num">{state.bill_count}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(state.total_sales)}</td>
                        <td>
                          <div style={{ background: "#f1f5f9", borderRadius: 4, height: 7 }}>
                            <div
                              style={{ width: `${pct}%`, height: "100%", background: "#3b82f6", borderRadius: 4 }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
