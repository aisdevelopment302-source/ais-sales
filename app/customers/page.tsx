"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/api";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

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
  id: number;
  name: string;
  state_code: string;
  state_name: string;
  bill_count: number;
  taxable_amount: number;
  total_sales: number;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [salesSnap, customerSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "customers")),
        ]);

        // Build customer info map
        const customerInfoMap = new Map<number, { name: string; gst_state: string }>();
        customerSnap.forEach((doc) => {
          const d = doc.data();
          customerInfoMap.set(Number(d.code), {
            name: d.name as string,
            gst_state: d.gst_state as string ?? "",
          });
        });

        // Aggregate per customer_id
        const aggMap = new Map<number, { bill_count: number; taxable_amount: number; total_sales: number }>();
        salesSnap.forEach((doc) => {
          const d = doc.data();
          const id = Number(d.customer_id);
          const existing = aggMap.get(id) ?? { bill_count: 0, taxable_amount: 0, total_sales: 0 };
          existing.bill_count += 1;
          existing.taxable_amount += d.amount ?? 0;
          existing.total_sales += d.bill_amount ?? 0;
          aggMap.set(id, existing);
        });

        const customers: Customer[] = Array.from(aggMap.entries()).map(([id, agg]) => {
          const info = customerInfoMap.get(id);
          const state_code = info?.gst_state ?? "";
          return {
            id,
            name: info?.name ?? String(id),
            state_code,
            state_name: GST_STATES[state_code] ?? state_code,
            ...agg,
          };
        });

        // Default sort: total_sales desc
        customers.sort((a, b) => b.total_sales - a.total_sales);
        setAllCustomers(customers);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Derived: filtered + paginated
  const filtered = useCallback(() => {
    let result = allCustomers;
    if (fromDate || toDate) {
      // Date filter not applicable at the customer level without re-aggregating.
      // For simplicity, show all and note — full date filtering would require
      // re-aggregating sales docs. Currently shows lifetime totals.
    }
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
                  <th style={{ textAlign: "right" }}>Taxable Amt</th>
                  <th style={{ textAlign: "right" }}>Total Sales</th>
                  <th style={{ width: 120 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const pct = (c.total_sales / maxSales) * 100;
                  const rank = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr key={c.id}>
                      <td style={{ color: "#94a3b8", fontWeight: 600 }}>{rank}</td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>
                        <span className="badge badge-blue">{c.state_name || c.state_code || "—"}</span>
                      </td>
                      <td className="num">{c.bill_count}</td>
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
                    <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>
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
