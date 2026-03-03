"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatNumber, formatMonth } from "@/lib/api";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PAGE_SIZE = 50;

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
  "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

interface Customer {
  accode: string;
  name: string;
  state_code: string;
  state_name: string;
  bill_count: number;
  taxable_amount: number;
  total_sales: number;
  total_qty: number;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<{ month: string; label: string; bill_count: number; total_sales: number; total_qty: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const salesSnap = await getDocs(collection(db, "sales"));

        // Aggregate per customer_accode directly from sales docs
        const aggMap = new Map<
          string,
          { name: string; state_code: string; bill_count: number; taxable_amount: number; total_sales: number; total_qty: number }
        >();
        const monthlyMap: Record<string, { bill_count: number; total_sales: number; total_qty: number }> = {};

        salesSnap.forEach((doc) => {
          const d = doc.data();
          const accode = String(d.customer_accode ?? "");
          const name = d.customer_name || accode;
          const state_code = String(d.customer_state ?? "");
          const existing = aggMap.get(accode) ?? {
            name,
            state_code,
            bill_count: 0,
            taxable_amount: 0,
            total_sales: 0,
            total_qty: 0,
          };
          existing.bill_count += 1;
          existing.taxable_amount += d.amount ?? 0;
          existing.total_sales += d.billamt ?? 0;
          existing.total_qty += d.billqty ?? 0;
          aggMap.set(accode, existing);

          // Monthly aggregation (all customers, no filter)
          const month = String(d.vdate || "").slice(0, 7);
          if (month) {
            if (!monthlyMap[month]) monthlyMap[month] = { bill_count: 0, total_sales: 0, total_qty: 0 };
            monthlyMap[month].bill_count += 1;
            monthlyMap[month].total_sales += d.billamt ?? 0;
            monthlyMap[month].total_qty += d.billqty ?? 0;
          }
        });

        const customers: Customer[] = Array.from(aggMap.entries()).map(([accode, agg]) => ({
          accode,
          name: agg.name,
          state_code: agg.state_code,
          state_name: GST_STATES[agg.state_code] ?? agg.state_code,
          bill_count: agg.bill_count,
          taxable_amount: agg.taxable_amount,
          total_sales: agg.total_sales,
          total_qty: agg.total_qty,
        }));

        customers.sort((a, b) => b.total_sales - a.total_sales);
        setAllCustomers(customers);

        const monthly = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, stats]) => ({ month, label: formatMonth(month), ...stats }));
        setMonthlyRows(monthly);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const filtered = useCallback(() => {
    let result = allCustomers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [allCustomers, search, fromDate, toDate])();

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const maxSales = filtered[0]?.total_sales || 1;

  return (
    <>
      <div className="page-header">
        <h1>Customers</h1>
        <p>Party-wise sales analysis</p>
      </div>

      <div className="section-card">
        <div className="filter-row">
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Search</label>
            <input
              type="text"
              placeholder="Customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
              onKeyDown={(e) => e.key === "Enter" && setPage(1)}
            />
          </div>
          <button className="btn-primary" onClick={() => setPage(1)}>Apply</button>
          <button
            className="btn-primary"
            style={{ background: "#64748b" }}
            onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setPage(1); }}
          >
            Clear
          </button>
        </div>
      </div>

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
                  <td className="num">{(() => { const tq = monthlyRows.reduce((s,r)=>s+r.total_qty,0); const ts = monthlyRows.reduce((s,r)=>s+r.total_sales,0); return tq > 0 ? formatCurrency(ts/tq) : "—"; })()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Customer Rankings</div>
          {!loading && (
            <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} customers</span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>State</th>
                  <th style={{ textAlign: "right" }}>Bills</th>
                  <th style={{ textAlign: "right" }}>Qty (MT)</th>
                  <th style={{ textAlign: "right" }}>Avg Rate (₹/MT)</th>
                  <th style={{ textAlign: "right" }}>Taxable Amt</th>
                  <th style={{ textAlign: "right" }}>Total Sales</th>
                  <th style={{ width: 120 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const pct = (c.total_sales / maxSales) * 100;
                  const rank = (page - 1) * PAGE_SIZE + i + 1;
                  const avgRate = c.total_qty > 0 ? c.total_sales / c.total_qty : 0;
                  return (
                    <tr key={c.accode}>
                      <td style={{ color: "#94a3b8", fontWeight: 600 }}>{rank}</td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>
                        <span className="badge badge-blue">{c.state_name || c.state_code || "—"}</span>
                      </td>
                      <td className="num">{c.bill_count}</td>
                      <td className="num">{formatNumber(c.total_qty)}</td>
                      <td className="num">{avgRate > 0 ? formatCurrency(avgRate) : "—"}</td>
                      <td className="num">{formatCurrency(c.taxable_amount)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(c.total_sales)}</td>
                      <td>
                        <div style={{ background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "#3b82f6",
                              borderRadius: 4,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>
                      No customers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
