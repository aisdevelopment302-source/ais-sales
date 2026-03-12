"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/api";
import SalesChart from "@/components/SalesChart";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

// ─── stable constants (not recreated on render) ───────────────────────────────

const TODAY = new Date();
const TODAY_YMD = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const BILL_WINDOW = 10;

// ─── helpers ─────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(ymd: string): string {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return ymd;
  }
}

// ─── Calendar popover ────────────────────────────────────────────────────────

interface CalendarProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  alignRight?: boolean;
}

function CalendarPicker({ label, value, onChange, alignRight }: CalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initMonth = value
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1)
    : new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  const [viewDate, setViewDate] = useState(initMonth);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!value) setViewDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const out: Array<{ day: number | null; ymd: string | null }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ day: null, ymd: null });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        day: d,
        ymd: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }
    return out;
  }, [year, month, firstDow, daysInMonth]);

  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    [year, month]
  );

  return (
    <div className="cal-wrap" ref={ref}>
      <button
        className={`cal-input-btn${open ? " active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="cal-label">{label}</span>
        <span className={`cal-value${!value ? " placeholder" : ""}`}>
          {value ? fmtDate(value) : "Any"}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
          <rect x="1" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M1 6h10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      {open && (
        <div className={`cal-popover${alignRight ? " align-right" : ""}`}>
          <div className="cal-header">
            <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))} type="button">‹</button>
            <span className="cal-month-label">{monthLabel}</span>
            <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))} type="button">›</button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => <div key={w} className="cal-day-name">{w}</div>)}
            {cells.map((cell, i) => {
              if (!cell.day || !cell.ymd) return <div key={`e-${i}`} className="cal-day empty" />;
              let cls = "cal-day";
              if (cell.ymd === value) cls += " selected";
              else if (cell.ymd === TODAY_YMD) cls += " today";
              return (
                <div key={cell.ymd} className={cls} onClick={() => { onChange(cell.ymd!); setOpen(false); }}>
                  {cell.day}
                </div>
              );
            })}
          </div>
          {value && (
            <button className="cal-clear-btn" onClick={() => { onChange(""); setOpen(false); }} type="button">
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
  vdate: string;          // YYYY-MM-DD — for filtering
  vdateFmt: string;       // pre-formatted display string
  invno: string;
  invnoLower: string;     // pre-lowercased — for search
  party_name: string;
  partyLower: string;     // pre-lowercased — for search
  amount: number;
  gst: number;
  billamt: number;
  billqty: number;
  basic_rate: number;
  cancelled: boolean;
}

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
  total_qty: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { user } = useAuth();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // searchInput: what the user is typing (drives the input value only)
  // search: debounced committed query (drives filtering)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Debounce: update `search` 250ms after the user stops typing ──────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setExpanded(false);
    }, 250);
  };

  // Immediate commit on Enter / Search button
  const commitSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch(searchInput);
    setExpanded(false);
  };

  const clearFilters = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFromDate("");
    setToDate("");
    setSearchInput("");
    setSearch("");
    setExpanded(false);
  };

  // Reset expanded when filters change
  useEffect(() => { setExpanded(false); }, [fromDate, toDate, search]);

  // ── Load all bills once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "sales"));
        if (cancelled) return;
        const bills: Bill[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as SaleDoc;
          const name = d.customer_name || String(d.customer_accode);
          const inv  = d.invno || String(d.billno || d.vno);
          bills.push({
            vno: d.vno,
            vdate: d.vdate,
            vdateFmt: fmtDate(d.vdate),   // pre-format once
            invno: inv,
            invnoLower: inv.toLowerCase(), // pre-lowercase once
            party_name: name,
            partyLower: name.toLowerCase(), // pre-lowercase once
            amount: d.amount ?? 0,
            gst: d.gst ?? 0,
            billamt: d.billamt ?? 0,
            billqty: d.billqty ?? 0,
            basic_rate: d.basic_rate ?? 0,
            cancelled: d.invcancelflag === "Y",
          });
        });
        bills.sort((a, b) => {
          if (b.vdate !== a.vdate) return b.vdate.localeCompare(a.vdate);
          return b.vno - a.vno;
        });
        setAllBills(bills);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  // ── Memoised counts (only recompute when allBills changes) ───────────────
  const { activeBillCount, cancelledCount } = useMemo(() => {
    let active = 0, canc = 0;
    for (const b of allBills) b.cancelled ? canc++ : active++;
    return { activeBillCount: active, cancelledCount: canc };
  }, [allBills]);

  // ── Memoised filter + aggregation (recompute only when deps change) ───────
  const { filteredBills, monthlyRows } = useMemo(() => {
    let filtered = allBills;
    if (fromDate) filtered = filtered.filter((b) => b.vdate >= fromDate);
    if (toDate)   filtered = filtered.filter((b) => b.vdate <= toDate);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (b) => b.partyLower.includes(q) || b.invnoLower.includes(q) || b.vdate.includes(q)
      );
    }

    const monthMap = new Map<string, MonthlyRow>();
    for (const b of filtered) {
      if (b.cancelled) continue;
      const month = b.vdate.slice(0, 7);
      if (!month) continue;
      const row = monthMap.get(month) ?? {
        month, bill_count: 0, taxable_amount: 0,
        bill_amount: 0, gst_amount: 0, total_qty: 0,
      };
      row.bill_count++;
      row.taxable_amount += b.amount;
      row.bill_amount    += b.billamt;
      row.gst_amount     += b.gst;
      row.total_qty      += b.billqty;
      monthMap.set(month, row);
    }

    const monthlyRows = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    return { filteredBills: filtered, monthlyRows };
  }, [allBills, fromDate, toDate, search]);

  const hasFilters = !!(fromDate || toDate || search);
  const displayBills = expanded ? filteredBills : filteredBills.slice(0, BILL_WINDOW);
  const hasMore = filteredBills.length > BILL_WINDOW;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <h1>Sales</h1>
        <p>
          {loading
            ? "Loading…"
            : `${activeBillCount.toLocaleString()} active bills · ${cancelledCount} cancelled`}
        </p>
      </div>

      {/* ── Sticky filter bar ── */}
      <div className="filter-bar-sticky">
        <CalendarPicker label="From" value={fromDate} onChange={setFromDate} />
        <CalendarPicker label="To" value={toDate} onChange={setToDate} alignRight />

        <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
          <input
            type="text"
            placeholder="Search invoice, party, date…"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitSearch()}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, minHeight: 40, outline: "none", background: "white", color: "#1e293b" }}
          />
        </div>

        <button className="btn-primary" onClick={commitSearch}>Search</button>

        {hasFilters && (
          <button className="btn-primary" style={{ background: "#64748b" }} onClick={clearFilters}>
            Clear
          </button>
        )}

        {hasFilters && (
          <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
            {filteredBills.length.toLocaleString()} result{filteredBills.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Bills card ── */}
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Bills</div>
          {!loading && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {hasFilters
                ? `${filteredBills.length.toLocaleString()} result${filteredBills.length !== 1 ? "s" : ""}`
                : `${activeBillCount.toLocaleString()} active`}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : (
          <>
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
                    <th style={{ textAlign: "right" }}>Bill Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBills.map((b) => (
                    <tr key={b.vno} className={b.cancelled ? "bill-cancelled" : ""}>
                      <td style={{ color: b.cancelled ? undefined : "#3b82f6", fontWeight: 600 }}>
                        {b.invno}
                        {b.cancelled && <span className="badge-void no-strike">VOID</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{b.vdateFmt}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.party_name}
                      </td>
                      <td className="num">{b.billqty ? b.billqty.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}</td>
                      <td className="num">{b.basic_rate ? formatCurrency(b.basic_rate) : "—"}</td>
                      <td className="num">{b.amount ? b.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(b.billamt)}</td>
                    </tr>
                  ))}
                  {displayBills.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  onClick={() => setExpanded((e) => !e)}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 20px", fontSize: 13, color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}
                >
                  {expanded ? "Show less ↑" : `Show all ${filteredBills.length.toLocaleString()} bills ↓`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Chart ── */}
      {!loading && monthlyRows.length > 0 && <SalesChart monthly={monthlyRows} />}
    </>
  );
}
