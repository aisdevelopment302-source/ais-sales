"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface CityRow {
  accode: string;
  acname: string;
  city: string;
  bill_count: number;
  total_weight: number;
  total_sales: number;
  avg_rate: number;
}

interface StateOption {
  statecode: string;
  statename: string;
}

const STATE_OPTIONS: StateOption[] = [
  { statecode: "27", statename: "Maharashtra" },
  { statecode: "24", statename: "Gujarat" },
];

export default function CitiesPage() {
  const { user } = useAuth();
  const [selectedState, setSelectedState] = useState("27");
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchCities = async (stateCode: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const [salesSnap, customersSnap] = await Promise.all([
        getDocs(collection(db, "sales")),
        getDocs(collection(db, "customers")),
      ]);

      // Build customer map for the selected state: customer_id -> {name, city}
      const custMap: Record<number, { name: string; city: string }> = {};
      customersSnap.forEach((doc) => {
        const d = doc.data();
        if (d.gst_state === stateCode) {
          custMap[Number(d.code)] = {
            name: d.name || "",
            city: d.address?.line1 || "",
          };
        }
      });

      // Aggregate sales per customer (only those in the selected state)
      const agg: Record<
        number,
        { bill_count: number; total_weight: number; total_sales: number }
      > = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const date: string = sale.date || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        const custId = Number(sale.customer_id);
        if (!custMap[custId]) return; // not in selected state

        if (!agg[custId]) agg[custId] = { bill_count: 0, total_weight: 0, total_sales: 0 };
        agg[custId].bill_count += 1;
        agg[custId].total_weight += sale.total_weight || 0;
        agg[custId].total_sales += sale.bill_amount || sale.amount || 0;
      });

      const rows: CityRow[] = Object.entries(agg)
        .map(([idStr, stats]) => {
          const id = Number(idStr);
          const meta = custMap[id];
          return {
            accode: String(id),
            acname: meta.name,
            city: meta.city,
            bill_count: stats.bill_count,
            total_weight: stats.total_weight,
            total_sales: stats.total_sales,
            avg_rate: stats.total_weight > 0 ? stats.total_sales / stats.total_weight : 0,
          };
        })
        .sort((a, b) => b.total_sales - a.total_sales);

      setCities(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities(selectedState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleStateChange = (stateCode: string) => {
    setSelectedState(stateCode);
    fetchCities(stateCode);
  };

  // Group by city (address.line1)
  const cityGroups: Record<string, CityRow[]> = {};
  cities.forEach((c) => {
    const key = c.city || "Unknown";
    if (!cityGroups[key]) cityGroups[key] = [];
    cityGroups[key].push(c);
  });

  const citySummary = Object.entries(cityGroups)
    .map(([cityName, customers]) => ({
      city: cityName,
      customers: customers.length,
      weight: customers.reduce((sum, c) => sum + (c.total_weight || 0), 0),
      sales: customers.reduce((sum, c) => sum + (c.total_sales || 0), 0),
    }))
    .sort((a, b) => b.sales - a.sales);

  const chartData = citySummary.map((c) => ({ name: c.city, sales: c.sales, weight: c.weight }));
  const totalSales = citySummary.reduce((sum, c) => sum + c.sales, 0);
  const totalWeight = citySummary.reduce((sum, c) => sum + c.weight, 0);

  return (
    <>
      <div className="page-header">
        <h1>City-wise Analysis</h1>
        <p>Sales breakdown by city within states</p>
      </div>

      <div className="section-card">
        <div className="filter-row">
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>State</label>
            <select value={selectedState} onChange={(e) => handleStateChange(e.target.value)}>
              {STATE_OPTIONS.map((s) => (
                <option key={s.statecode} value={s.statecode}>
                  {s.statename}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => fetchCities(selectedState)}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setTimeout(() => fetchCities(selectedState), 50);
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
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Weight</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", margin: "6px 0 2px" }}>
            {(totalWeight / 1000).toFixed(2)} MT
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Cities</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", margin: "6px 0 2px" }}>
            {formatNumber(citySummary.length)}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Customers</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6", margin: "6px 0 2px" }}>
            {formatNumber(cities.length)}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="section-card">
              <div className="section-title">Sales by City</div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(0) : value)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="sales" fill="#3b82f6" name="Sales (₹)" />
                  <Bar yAxisId="right" dataKey="weight" fill="#10b981" name="Weight (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="section-card">
            <div className="section-title">City Summary</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>City</th>
                    <th style={{ textAlign: "right" }}>Customers</th>
                    <th style={{ textAlign: "right" }}>Weight (kg)</th>
                    <th style={{ textAlign: "right" }}>Avg Weight/Customer</th>
                    <th style={{ textAlign: "right" }}>Total Sales</th>
                    <th style={{ width: 100 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {citySummary.map((city, i) => {
                    const pct = (city.sales / (totalSales || 1)) * 100;
                    return (
                      <tr key={city.city}>
                        <td style={{ color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{city.city}</td>
                        <td className="num">{city.customers}</td>
                        <td className="num">{city.weight?.toFixed(2)}</td>
                        <td className="num">{(city.weight / (city.customers || 1)).toFixed(2)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(city.sales)}</td>
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

          <div className="section-card">
            <div className="section-title">Customers by City</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>Customer Name</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Weight (kg)</th>
                    <th style={{ textAlign: "right" }}>Avg Rate/kg</th>
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((customer) => (
                    <tr key={customer.accode}>
                      <td style={{ color: "#64748b", fontSize: 12 }}>{customer.city}</td>
                      <td style={{ fontWeight: 500 }}>{customer.acname}</td>
                      <td className="num">{customer.bill_count}</td>
                      <td className="num">{customer.total_weight?.toFixed(2)}</td>
                      <td className="num">
                        {customer.avg_rate?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(customer.total_sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
