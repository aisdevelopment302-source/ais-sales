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
  invno: string;
  vdate: string;
  customer_accode: number;
  customer_name: string;
  amount: number;
  billamt: number;
  gst: number;
  cess: number;
  billqty: number;
  basic_rate: number;
  invcancelflag: string;
}

interface Bill {
  vno: number;
  vdate: string;
  invno: string;
  party_name: string;
  amount: number;
  gst: number;
  billamt: number;
  billqty: number;
  basic_rate: number;
}

interface CancelledBill {
  vno: number;
  vdate: string;
  invno: string;
  party_name: string;
  billamt: number;
}

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
  total_qty: number;
}

export default function SalesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "cancelled">("active");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [cancelledBills, setCancelledBills] = useState<CancelledBill[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const salesSnap = await getDocs(collection(db, "sales"));

        const bills: Bill[] = [];
        const cancelled: CancelledBill[] = [];

        salesSnap.forEach((doc) => {
          const d = doc.data() as SaleDoc;
          if (d.invcancelflag === "Y") {
            cancelled.push({
              vno: d.vno,
              vdate: d.vdate,
              invno: d.invno || String(d.billno || d.vno),
              party_name: d.customer_name || String(d.customer_accode),
              billamt: d.billamt,
            });
          } else {
            bills.push({
              vno: d.vno,
              vdate: d.vdate,
              invno: d.invno || String(d.billno || d.vno),
              party_name: d.customer_name || String(d.customer_accode),
              amount: d.amount,
              gst: d.gst ?? 0,
              billamt: d.billamt,
              billqty: d.billqty ?? 0,
              basic_rate: d.basic_rate ?? 0,
            });
          }
        });

        bills.sort((a, b) => {
          if (b.vdate !== a.vdate) return b.vdate.localeCompare(a.vdate);
          return b.vno - a.vno;
        });
        cancelled.sort((a, b) => b.vdate.localeCompare(a.vdate));

        setAllBills(bills);
        setCancelledBills(cancelled);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const { filteredBills, monthlyRows } = useCallback(() => {
    let filtered = allBills;

    if (fromDate) filtered = filtered.filter((b) => b.vdate >= fromDate);
    if (toDate) filtered = filtered.filter((b) => b.vdate <= toDate);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((b) => b.party_name.toLowerCase().includes(q));
    }

    const monthMap = new Map<string, MonthlyRow>();
    filtered.forEach((b) => {
      const month = b.vdate?.slice(0, 7);
      if (!month) return;
      const existing = monthMap.get(month) ?? {
        month,
        bill_count: 0,
        taxable_amount: 0,
        bill_amount: 0,
        gst_amount: 0,
        total_qty: 0,
      };
      existing.bill_count += 1;
      existing.taxable_amount += b.amount;
      existing.bill_amount += b.billamt;
      existing.gst_amount += b.gst;
      existing.total_qty += b.billqty;
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
          Active Bills {!loading ? `(${allBills.length.toLocaleString()})` : ""}
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
          Cancelled {!loading && cancelledBills.length > 0 ? `(${cancelledBills.length})` : ""}
        </button>
      </div>

      {/* ── ACTIVE BILLS TAB ── */}
      {activeTab === "active" && (
        <>
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
                  onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                />
              </div>
              <button className="btn-primary" onClick={() => setPage(1)}>Apply</button>
              <button
                className="btn-primary"
                style={{ background: "#64748b" }}
                onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setPage(1); }}
              >
                Clear
              </button>
            </div>
          </div>

          {monthlyRows.length > 0 && <SalesChart monthly={monthlyRows} />}

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
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Party</th>
                      <th style={{ textAlign: "right" }}>Qty (MT)</th>
                      <th style={{ textAlign: "right" }}>Rate (₹/MT)</th>
                      <th style={{ textAlign: "right" }}>Taxable</th>
                      <th style={{ textAlign: "right" }}>GST</th>
                      <th style={{ textAlign: "right" }}>Bill Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBills.map((b) => (
                      <tr key={b.vno}>
                        <td style={{ color: "#3b82f6", fontWeight: 600 }}>{b.invno}</td>
                        <td>{b.vdate}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.party_name}
                        </td>
                        <td className="num">{b.billqty ? b.billqty.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}</td>
                        <td className="num">{b.basic_rate ? formatCurrency(b.basic_rate) : "—"}</td>
                        <td className="num">{b.amount?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num">{b.gst?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(b.billamt)}</td>
                      </tr>
                    ))}
                    {pagedBills.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {filteredBills.length > PAGE_SIZE && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CANCELLED BILLS TAB ── */}
      {activeTab === "cancelled" && (
        <div className="section-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Cancelled Bills</div>
            {!loading && (
              <span style={{ fontSize: 12, color: "#64748b" }}>{cancelledBills.length} records</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
          ) : cancelledBills.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "#94a3b8" }}>
              No cancelled bills found
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Party</th>
                    <th style={{ textAlign: "right" }}>Bill Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledBills.map((b) => (
                    <tr key={b.vno}>
                      <td style={{ color: "#ef4444", fontWeight: 600 }}>{b.invno}</td>
                      <td>{b.vdate}</td>
                      <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.party_name}
                      </td>
                      <td className="num" style={{ color: "#ef4444" }}>{formatCurrency(b.billamt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
