"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatNumber, formatMonth } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

interface CityRow {
  accode: string;
  acname: string;
  city: string;
  bill_count: number;
  total_sales: number;
  total_qty: number;
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
  const [monthlyRows, setMonthlyRows] = useState<
    { month: string; label: string; bill_count: number; total_sales: number; total_qty: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchCities = async (stateCode: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const salesSnap = await getDocs(collection(db, "sales"));

      // Aggregate sales per customer_accode for customers in the selected state
      const agg: Record<
        string,
        { name: string; city: string; bill_count: number; total_sales: number; total_qty: number }
      > = {};
      const monthlyMap: Record<string, { bill_count: number; total_sales: number; total_qty: number }> = {};

        salesSnap.forEach((doc) => {
          const sale = doc.data();
          if (sale.invcancelflag === "Y") return;
          const date: string = sale.vdate || "";
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;

        // Filter by state
        if (String(sale.customer_state) !== stateCode) return;

        const accode = String(sale.customer_accode || "");
        const name = sale.customer_name || accode;
        const city = sale.customer_address || "";
        const billAmt = sale.billamt || sale.amount || 0;
        const qty = sale.billqty ?? 0;

        if (!agg[accode]) {
          agg[accode] = { name, city, bill_count: 0, total_sales: 0, total_qty: 0 };
        }
        agg[accode].bill_count += 1;
        agg[accode].total_sales += billAmt;
        agg[accode].total_qty += qty;

        // Monthly aggregation
        const month = date.slice(0, 7);
        if (month) {
          if (!monthlyMap[month]) monthlyMap[month] = { bill_count: 0, total_sales: 0, total_qty: 0 };
          monthlyMap[month].bill_count += 1;
          monthlyMap[month].total_sales += billAmt;
          monthlyMap[month].total_qty += qty;
        }
      });

      const rows: CityRow[] = Object.entries(agg)
        .map(([accode, stats]) => ({
          accode,
          acname: stats.name,
          city: stats.city,
          bill_count: stats.bill_count,
          total_sales: stats.total_sales,
          total_qty: stats.total_qty,
        }))
        .sort((a, b) => b.total_sales - a.total_sales);

      const monthly = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, stats]) => ({ month, label: formatMonth(month), ...stats }));

      setCities(rows);
      setMonthlyRows(monthly);
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

  // Group by city (customer_address)
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
      sales: customers.reduce((sum, c) => sum + (c.total_sales || 0), 0),
      qty: customers.reduce((sum, c) => sum + (c.total_qty || 0), 0),
    }))
    .sort((a, b) => b.sales - a.sales);

  const chartData = citySummary.map((c) => ({ name: c.city, sales: c.sales }));
  const totalSales = citySummary.reduce((sum, c) => sum + c.sales, 0);
  const totalQty = citySummary.reduce((sum, c) => sum + c.qty, 0);

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
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Qty (MT)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", margin: "6px 0 2px" }}>
            {formatNumber(totalQty)}
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
          {monthlyRows.length > 0 && (
            <div className="section-card">
              <div className="section-title">Monthly Sales Trend</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} width={90} />
                  <Tooltip formatter={(value) => (typeof value === "number" ? formatCurrency(value) : value)} />
                  <Legend />
                  <Bar dataKey="total_sales" fill="#3b82f6" name="Sales (₹)" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: "right" }}>Bills</th>
                      <th style={{ textAlign: "right" }}>Qty (MT)</th>
                      <th style={{ textAlign: "right" }}>Total Sales</th>
                      <th style={{ textAlign: "right" }}>Avg Rate (₹/MT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row) => {
                      const avgRate = row.total_qty > 0 ? row.total_sales / row.total_qty : 0;
                      return (
                        <tr key={row.month}>
                          <td style={{ fontWeight: 500 }}>{row.label}</td>
                          <td className="num">{row.bill_count}</td>
                          <td className="num">{formatNumber(row.total_qty)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(row.total_sales)}</td>
                          <td className="num">{avgRate > 0 ? formatCurrency(avgRate) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
                      <td>Total</td>
                      <td className="num">{monthlyRows.reduce((s, r) => s + r.bill_count, 0)}</td>
                      <td className="num">{formatNumber(monthlyRows.reduce((s, r) => s + r.total_qty, 0))}</td>
                      <td className="num">{formatCurrency(monthlyRows.reduce((s, r) => s + r.total_sales, 0))}</td>
                      <td className="num">
                        {(() => {
                          const totQtyFoot = monthlyRows.reduce((s, r) => s + r.total_qty, 0);
                          const totSalesFoot = monthlyRows.reduce((s, r) => s + r.total_sales, 0);
                          return totQtyFoot > 0 ? formatCurrency(totSalesFoot / totQtyFoot) : "—";
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="section-card">
              <div className="section-title">Sales by City</div>
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
                    <th style={{ textAlign: "right" }}>Total Sales</th>
                    <th style={{ textAlign: "right" }}>Qty (MT)</th>
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
                        <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(city.sales)}</td>
                        <td className="num">{formatNumber(city.qty)}</td>
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
                    <th style={{ textAlign: "right" }}>Qty (MT)</th>
                    <th style={{ textAlign: "right" }}>Sales (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((customer) => (
                    <tr key={customer.accode}>
                      <td style={{ color: "#64748b", fontSize: 12 }}>{customer.city}</td>
                      <td style={{ fontWeight: 500 }}>{customer.acname}</td>
                      <td className="num">{customer.bill_count}</td>
                      <td className="num">{formatNumber(customer.total_qty)}</td>
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
