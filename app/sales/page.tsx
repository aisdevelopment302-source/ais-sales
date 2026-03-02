"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatMonth } from "@/lib/api";
import SalesChart from "@/components/SalesChart";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 50;

interface SaleDoc {
  vno: number;
  billno: string;
  date: string;
  customer_id: number;
  amount: number;
  bill_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_weight: number;
  items: Array<{ itemcode: number; itemname: string; weight: number; rate: number; amount: number }>;
}

interface Bill {
  vno: number;
  date: string;
  billno: string;
  party_name: string;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  bill_amount: number;
}

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
}

export default function SalesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "cancelled">("active");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all data once from Firestore
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [salesSnap, customerSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "customers")),
        ]);

        // Build customer id -> name map
        const customerMap = new Map<number, string>();
        customerSnap.forEach((doc) => {
          const d = doc.data();
          customerMap.set(Number(d.code), d.name as string);
        });

        const bills: Bill[] = [];
        salesSnap.forEach((doc) => {
          const d = doc.data() as SaleDoc;
          bills.push({
            vno: d.vno,
            date: d.date,
            billno: d.billno,
            party_name: customerMap.get(d.customer_id) ?? String(d.customer_id),
            amount: d.amount,
            cgst: d.cgst ?? 0,
            sgst: d.sgst ?? 0,
            igst: d.igst ?? 0,
            bill_amount: d.bill_amount,
          });
        });

        // Sort by date desc, vno desc
        bills.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return b.vno - a.vno;
        });

        setAllBills(bills);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Derived: filtered bills + monthly rows
  const { filteredBills, monthlyRows } = useCallback(() => {
    let filtered = allBills;

    if (fromDate) filtered = filtered.filter((b) => b.date >= fromDate);
    if (toDate) filtered = filtered.filter((b) => b.date <= toDate);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((b) => b.party_name.toLowerCase().includes(q));
    }

    // Monthly aggregation from the same filtered set
    const monthMap = new Map<string, MonthlyRow>();
    filtered.forEach((b) => {
      const month = b.date.slice(0, 7);
      const existing = monthMap.get(month) ?? {
        month,
        bill_count: 0,
        taxable_amount: 0,
        bill_amount: 0,
        gst_amount: 0,
      };
      existing.bill_count += 1;
      existing.taxable_amount += b.amount;
      existing.bill_amount += b.bill_amount;
      existing.gst_amount += (b.cgst + b.sgst + b.igst);
      monthMap.set(month, existing);
    });

    const monthlyRows = Array.from(monthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    return { filteredBills: filtered, monthlyRows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBills, fromDate, toDate, search])();

  const totalPages = Math.ceil(filteredBills.length / PAGE_SIZE);
  const pagedBills = filteredBills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilter = () => setPage(1);

  return (
    <>
      <div className="page-header">
        <h1>Sales</h1>
        <p>Tax invoices — filter, browse and analyse bills</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab("active")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            background: activeTab === "active" ? "#3b82f6" : "#f1f5f9",
            color: activeTab === "active" ? "#fff" : "#475569",
          }}
        >
          Active Bills {!loading ? `(${filteredBills.length.toLocaleString()})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("cancelled")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            background: activeTab === "cancelled" ? "#ef4444" : "#f1f5f9",
            color: activeTab === "cancelled" ? "#fff" : "#475569",
          }}
        >
          Cancelled Bills
        </button>
      </div>

      {/* ── ACTIVE BILLS TAB ── */}
      {activeTab === "active" && (
        <>
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
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Search Party</label>
                <input
                  type="text"
                  placeholder="Customer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 200 }}
                  onKeyDown={(e) => e.key === "Enter" && handleFilter()}
                />
              </div>
              <button className="btn-primary" onClick={handleFilter}>
                Apply
              </button>
              <button
                className="btn-primary"
                style={{ background: "#64748b" }}
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Chart */}
          {monthlyRows.length > 0 && <SalesChart monthly={monthlyRows} />}

          {/* Bills Table */}
          <div className="section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Bills</div>
              {!loading && (
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {filteredBills.length.toLocaleString()} records
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Loading...</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vno</th>
                      <th>Date</th>
                      <th>Bill No</th>
                      <th>Party</th>
                      <th style={{ textAlign: "right" }}>Taxable Amt</th>
                      <th style={{ textAlign: "right" }}>CGST</th>
                      <th style={{ textAlign: "right" }}>SGST</th>
                      <th style={{ textAlign: "right" }}>IGST</th>
                      <th style={{ textAlign: "right" }}>Bill Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBills.map((b) => (
                      <tr key={b.vno}>
                        <td style={{ color: "#3b82f6", fontWeight: 600 }}>{b.vno}</td>
                        <td>{b.date}</td>
                        <td>{b.billno}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.party_name}
                        </td>
                        <td className="num">{b.amount?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num">{b.cgst?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num">{b.sgst?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num">{b.igst?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {formatCurrency(b.bill_amount)}
                        </td>
                      </tr>
                    ))}
                    {pagedBills.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredBills.length > PAGE_SIZE && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Prev
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CANCELLED BILLS TAB ── */}
      {activeTab === "cancelled" && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, color: "#cbd5e1" }}>—</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: "#475569", marginBottom: 6 }}>
            Cancelled bills are not stored in Firebase
          </div>
          <div style={{ fontSize: 13 }}>
            The ETL sync only imports active (non-cancelled) bills. Cancelled bills are excluded from Firebase and are not shown here.
          </div>
        </div>
      )}
    </>
  );
}
