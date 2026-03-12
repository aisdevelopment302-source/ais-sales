"use client";

import { useState, useEffect } from "react";
import DashboardCharts from "@/components/DashboardCharts";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/api";

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
}

interface SummaryData {
  company: { coname: string; fyfrom: string; fyto: string; gstin: string };
  sales: {
    total_bills: number;
    total_taxable: number;
    total_bill_amount: number;
    total_gst: number;
    total_cess: number;
  };
  top_customers: Array<{ name: string; bill_count: number; total_sales: number }>;
  top_items: Array<{ name: string; total_sales: number; total_weight: number }>;
  monthly: MonthlyRow[];
  last_synced: string | null;
}

/** Format an ISO datetime string to a readable local time, e.g. "3 Mar '26, 2:25 PM" */
function formatSyncTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function DashboardSkeleton() {
  return (
    <>
      <div className="page-header">
        <div className="skeleton-line" style={{ width: 220, marginBottom: 8 }} />
        <div className="skeleton-line" style={{ width: 160, height: 11 }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton-card" key={i} style={{ borderTop: "3px solid #e2e8f0" }}>
            <div className="skeleton-line" style={{ width: "60%" }} />
            <div className="skeleton-value" style={{ width: "80%" }} />
            <div className="skeleton-line" style={{ width: "40%", height: 11 }} />
          </div>
        ))}
      </div>
      <div className="section-card">
        <div className="skeleton-line" style={{ width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 8 }} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch sales collection + _meta/summary in parallel
        const [salesDocs, metaSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDoc(doc(db, "_meta", "summary")),
        ]);

        const last_synced: string | null = metaSnap.exists()
          ? (metaSnap.data().last_synced ?? null)
          : null;

        let total_bills = 0;
        let total_taxable = 0;
        let total_bill_amount = 0;
        let total_gst = 0;
        let total_cess = 0;

        const customerMap = new Map<string, { bill_count: number; total_sales: number }>();
        const itemMap = new Map<string, { total_sales: number; total_weight: number }>();
        const monthMap = new Map<string, MonthlyRow>();

        salesDocs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.invcancelflag === "Y") return; // skip cancelled

          total_bills++;
          total_taxable += data.amount || 0;
          total_bill_amount += data.billamt || 0;
          total_gst += data.gst || 0;
          total_cess += data.cess || 0;

          // Top customers
          const name = data.customer_name || data.customer_accode || "Unknown";
          const existing = customerMap.get(name) || { bill_count: 0, total_sales: 0 };
          customerMap.set(name, {
            bill_count: existing.bill_count + 1,
            total_sales: existing.total_sales + (data.billamt || 0),
          });

          // Monthly aggregation
          const month: string = (data.vdate || "").slice(0, 7);
          if (month) {
            const m = monthMap.get(month) ?? {
              month,
              bill_count: 0,
              taxable_amount: 0,
              bill_amount: 0,
              gst_amount: 0,
            };
            m.bill_count += 1;
            m.taxable_amount += data.amount || 0;
            m.bill_amount += data.billamt || 0;
            m.gst_amount += data.gst || 0;
            monthMap.set(month, m);
          }

          // Top items from embedded line items
          const lineItems: Array<{ itemname: string; taxableamt: number; weight: number }> =
            Array.isArray(data.items) ? data.items : [];
          lineItems.forEach((li) => {
            const iname = li.itemname || "Unknown";
            const existing = itemMap.get(iname) || { total_sales: 0, total_weight: 0 };
            itemMap.set(iname, {
              total_sales: existing.total_sales + (li.taxableamt || 0),
              total_weight: existing.total_weight + (li.weight || 0),
            });
          });
        });

        const top_customers = Array.from(customerMap.entries())
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .slice(0, 5);

        const top_items = Array.from(itemMap.entries())
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .slice(0, 5);

        const monthly = Array.from(monthMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month)
        );

        setSummary({
          company: {
            coname: "Aadinath Industries",
            fyfrom: new Date().getFullYear().toString(),
            fyto: (new Date().getFullYear() + 1).toString(),
            gstin: "24AABFU5055R1Z6",
          },
          sales: {
            total_bills,
            total_taxable,
            total_bill_amount,
            total_gst,
            total_cess,
          },
          top_customers,
          top_items,
          monthly,
          last_synced,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading dashboard");
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) return <DashboardSkeleton />;
  if (error) return <div style={{ padding: 20, color: "#ef4444" }}>Error: {error}</div>;
  if (!summary) return <DashboardSkeleton />;

  const { company, sales, top_customers, top_items, monthly, last_synced } = summary;

  const kpis = [
    {
      label: "Total Sales (Taxable)",
      value: formatCurrency(sales.total_taxable),
      sub: `${sales.total_bills.toLocaleString("en-IN")} active bills`,
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      label: "Total Bill Amount",
      value: formatCurrency(sales.total_bill_amount),
      sub: "incl. GST & cess",
      color: "#10b981",
      bg: "#f0fdf4",
    },
    {
      label: "Total GST Collected",
      value: formatCurrency(sales.total_gst),
      sub: sales.total_bill_amount > 0
        ? `${((sales.total_gst / sales.total_bill_amount) * 100).toFixed(1)}% of bill amt`
        : "GST",
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      label: "Total Cess",
      value: formatCurrency(sales.total_cess),
      sub: sales.total_cess === 0 ? "nil this period" : "cess collected",
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1>{company.coname}</h1>
        <p style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>GSTIN: {company.gstin}</span>
          <span style={{ color: "#cbd5e1" }}>·</span>
          <span>
            FY {company.fyfrom}–{company.fyto}
          </span>
          {last_synced && (
            <>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span style={{ color: "#94a3b8" }}>
                Synced: {formatSyncTime(last_synced)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label} style={{ borderTop: `3px solid ${k.color}` }}>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, margin: "6px 0 2px" }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <DashboardCharts monthly={monthly} topCustomers={top_customers} topItems={top_items} />
    </>
  );
}
