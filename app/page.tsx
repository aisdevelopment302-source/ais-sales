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
}

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const salesDocs = await getDocs(collection(db, "sales"));

        let total_bills = 0;
        let total_taxable = 0;
        let total_bill_amount = 0;
        let total_gst = 0;
        let total_cess = 0;

        const customerMap = new Map<string, { bill_count: number; total_sales: number }>();

        salesDocs.forEach((doc) => {
          const data = doc.data();
          total_bills++;
          total_taxable += data.amount || 0;
          total_bill_amount += data.billamt || 0;
          total_gst += data.gst || 0;
          total_cess += data.cess || 0;

          // Top customers: use customer_name directly from sales doc
          const name = data.customer_name || data.customer_accode || "Unknown";
          const existing = customerMap.get(name) || { bill_count: 0, total_sales: 0 };
          customerMap.set(name, {
            bill_count: existing.bill_count + 1,
            total_sales: existing.total_sales + (data.billamt || 0),
          });
        });

        const top_customers = Array.from(customerMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .slice(0, 5);

        // No items[] in sales docs — top items not available
        const top_items: Array<{ name: string; total_sales: number; total_weight: number }> = [];

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

  if (authLoading || loading) return <div style={{ padding: 20 }}>Loading dashboard...</div>;
  if (error || !summary) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;

  const { company, sales, top_customers, top_items } = summary;

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
      sub: "GST",
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      label: "Total Cess",
      value: formatCurrency(sales.total_cess),
      sub: `${sales.total_bills} bills`,
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

      {/* Charts */}
      <DashboardCharts monthly={monthly} topCustomers={top_customers} topItems={top_items} />
    </>
  );
}
