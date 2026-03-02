"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatMonth } from "@/lib/api";

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
}

interface TopItem {
  name: string;
  total_qty: number;
  total_amount: number;
}

export default function PurchasesCharts({
  monthly,
  topItems,
}: {
  monthly: MonthlyRow[];
  topItems: TopItem[];
}) {
  const monthlyData = monthly.map((r) => ({
    label: formatMonth(r.month),
    "Bill Amt (L)": +(r.bill_amount / 100000).toFixed(2),
  }));

  const itemData = topItems.slice(0, 8).map((i) => ({
    name: i.name.length > 20 ? i.name.slice(0, 20) + "…" : i.name,
    "Amount (L)": +(i.total_amount / 100000).toFixed(2),
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
      <div className="section-card">
        <div className="section-title">Monthly Purchases (₹ Lakhs)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip formatter={(v: number) => [`₹${v} L`, "Bill Amount"]} />
            <Bar dataKey="Bill Amt (L)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card">
        <div className="section-title">Top Items by Purchase Amount</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={itemData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}L`} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`₹${v} L`, "Amount"]} />
            <Bar dataKey="Amount (L)" fill="#10b981" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
