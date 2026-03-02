"use client";

import { useState, useEffect } from "react";
import DashboardCharts from "@/components/DashboardCharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | null | undefined, decimals = 3): string {
  if (value == null) return "-";
  return value.toLocaleString("en-IN", { maximumFractionDigits: decimals });
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
  cancelled: {
    cancelled_bills: number;
    cancelled_amount: number;
    cancelled_taxable: number;
  };
  credit_notes: { cr_bills: number; cr_amount: number };
  purchases: {
    total_purchase_bills: number;
    total_purchase_taxable: number;
    total_purchase_amount: number;
  };
  top_customers: Array<{ name: string; bill_count: number; total_sales: number }>;
  top_items: Array<{ name: string; total_sales: number; total_weight: number }>;
}

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // Fetch from Firestore collections
        const salesDocs = await getDocs(collection(db, "sales"));
        const purchaseDocs = await getDocs(collection(db, "purchases_data"));
        const customerDocs = await getDocs(collection(db, "customers"));
        const itemDocs = await getDocs(collection(db, "items"));

        // Aggregate sales data
        let total_bills = 0;
        let total_taxable = 0;
        let total_bill_amount = 0;
        let total_gst = 0;
        let total_cess = 0;
        let cancelled_bills = 0;
        let cancelled_amount = 0;
        let cancelled_taxable = 0;
        let cr_bills = 0;
        let cr_amount = 0;

        salesDocs.forEach((doc) => {
          const data = doc.data();
          if (data.status === "cancelled") {
            cancelled_bills++;
            cancelled_amount += data.bill_amount || 0;
            cancelled_taxable += data.taxable_amount || 0;
          } else if (data.type === "credit_note") {
            cr_bills++;
            cr_amount += data.bill_amount || 0;
          } else {
            total_bills++;
            total_taxable += data.taxable_amount || 0;
            total_bill_amount += data.bill_amount || 0;
            total_gst += (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0);
            total_cess += data.cess || 0;
          }
        });

        // Aggregate purchase data
        let total_purchase_bills = 0;
        let total_purchase_taxable = 0;
        let total_purchase_amount = 0;

        purchaseDocs.forEach((doc) => {
          const data = doc.data();
          total_purchase_bills++;
          total_purchase_taxable += data.taxable_amount || 0;
          total_purchase_amount += data.bill_amount || 0;
        });

        // Get top customers from sales docs
        const customerNameMap = new Map<string, string>();
        customerDocs.forEach((doc) => {
          const data = doc.data();
          customerNameMap.set(String(data.code ?? doc.id), data.name ?? doc.id);
        });

        const customerMap = new Map<string, { bill_count: number; total_sales: number }>();
        salesDocs.forEach((doc) => {
          const data = doc.data();
          if (data.status === "cancelled" || data.type === "credit_note") return;
          const cid = String(data.customer_id ?? "");
          const name = customerNameMap.get(cid) ?? cid;
          const existing = customerMap.get(name) || { bill_count: 0, total_sales: 0 };
          customerMap.set(name, {
            bill_count: existing.bill_count + 1,
            total_sales: existing.total_sales + (data.bill_amount || 0),
          });
        });
        const top_customers = Array.from(customerMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .slice(0, 5);

        // Get top items from sales docs
        const itemNameMap = new Map<string, string>();
        itemDocs.forEach((doc) => {
          const data = doc.data();
          itemNameMap.set(String(data.code ?? doc.id), data.name ?? doc.id);
        });

        const itemMap = new Map<string, { total_sales: number; total_weight: number }>();
        salesDocs.forEach((doc) => {
          const data = doc.data();
          if (data.status === "cancelled" || data.type === "credit_note") return;
          (data.items || []).forEach((item: { itemcode?: number; qty?: number; amount?: number }) => {
            const iid = String(item.itemcode ?? "");
            const name = itemNameMap.get(iid) ?? iid;
            const existing = itemMap.get(name) || { total_sales: 0, total_weight: 0 };
            itemMap.set(name, {
              total_sales: existing.total_sales + (item.amount || 0),
              total_weight: existing.total_weight + (item.qty || 0),
            });
          });
        });
        const top_items = Array.from(itemMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .slice(0, 5);

        const summaryData: SummaryData = {
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
          cancelled: {
            cancelled_bills,
            cancelled_amount,
            cancelled_taxable,
          },
          credit_notes: { cr_bills, cr_amount },
          purchases: {
            total_purchase_bills,
            total_purchase_taxable,
            total_purchase_amount,
          },
          top_customers,
          top_items,
        };

        setSummary(summaryData);
        setMonthly([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading dashboard");
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <div style={{ padding: 20 }}>Loading dashboard...</div>;
  if (error || !summary) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;

  const { company, sales, cancelled, credit_notes, purchases, top_customers, top_items } = summary;

  const kpis = [
    {
      label: "Total Sales (Taxable)",
      value: formatCurrency(sales.total_taxable),
      sub: `${sales.total_bills} bills`,
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      label: "Total Bill Amount",
      value: formatCurrency(sales.total_bill_amount),
      sub: "incl. GST",
      color: "#10b981",
      bg: "#f0fdf4",
    },
    {
      label: "Total GST Collected",
      value: formatCurrency(sales.total_gst),
      sub: "CGST + SGST + IGST",
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      label: "Purchases",
      value: formatCurrency(purchases.total_purchase_amount),
      sub: `${purchases.total_purchase_bills} bills`,
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1>{company.coname}</h1>
        <p>
          GSTIN: {company.gstin} &nbsp;·&nbsp; FY {company.fyfrom} to {company.fyto}
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
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {k.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, margin: "6px 0 2px" }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cancelled Bills Warning */}
      {cancelled && cancelled.cancelled_bills > 0 && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 10,
            padding: "14px 20px",
            marginBottom: 24,
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 20, color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>!</div>
          <div>
            <span style={{ fontWeight: 700, color: "#dc2626" }}>
              {cancelled.cancelled_bills} cancelled bill{cancelled.cancelled_bills !== 1 ? "s" : ""} excluded from revenue
            </span>
            <span style={{ color: "#b91c1c", fontSize: 13 }}>
              {" "}- {formatCurrency(cancelled.cancelled_amount)} total bill amount excluded.
              View details in Sales &rarr; Cancelled Bills tab.
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <DashboardCharts monthly={monthly} topCustomers={top_customers} topItems={top_items} />

      {/* Credit notes note */}
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
        Credit notes: {credit_notes.cr_bills} bills totalling {formatCurrency(credit_notes.cr_amount)} (not deducted from above)
      </div>
    </>
  );
}
