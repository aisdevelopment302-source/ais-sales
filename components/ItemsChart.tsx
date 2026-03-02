"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/api";

interface ItemRow {
  id: number;
  name: string;
  total_sales: number;
  total_weight: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export default function ItemsChart({ items }: { items: ItemRow[] }) {
  const data = items.map((i) => ({
    name: i.name.length > 22 ? i.name.slice(0, 22) + "…" : i.name,
    "Sales (L)": +(i.total_sales / 100000).toFixed(2),
    "Weight (MT)": +(i.total_weight || 0).toFixed(2),
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
      <div className="section-card">
        <div className="section-title">Top 10 Items by Sales (₹ Lakhs)</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}L`} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`₹${v} L`, "Sales"]} />
            <Bar dataKey="Sales (L)" radius={[0, 3, 3, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card">
        <div className="section-title">Top 10 Items by Weight (MT)</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}MT`} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`${v} MT`, "Weight"]} />
            <Bar dataKey="Weight (MT)" radius={[0, 3, 3, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
