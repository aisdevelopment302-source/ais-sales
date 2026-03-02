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
  total_sales: number;
  total_weight: number;
}

export default function CustomerDetailCharts({
  monthly,
  topItems,
}: {
  monthly: MonthlyRow[];
  topItems: TopItem[];
}) {
  const monthlyData = monthly.map((r) => ({
    label: formatMonth(r.month),
    "Bill Amt (L)": +(r.bill_amount / 100000).toFixed(2),
    Bills: r.bill_count,
  }));

  const maxSales = topItems[0]?.total_sales || 1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 20 }}>
      <div className="section-card">
        <div className="section-title">Monthly Purchases (₹ Lakhs)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              formatter={(v: number, name: string) =>
                name === "Bills" ? [v, name] : [`₹${v} L`, name]
              }
            />
            <Bar dataKey="Bill Amt (L)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card">
        <div className="section-title">Top Items Bought</div>
        <div>
          {topItems.slice(0, 8).map((item) => {
            const pct = (item.total_sales / maxSales) * 100;
            return (
              <div key={item.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#334155", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                  <span style={{ color: "#64748b" }}>{item.total_weight?.toFixed(2)} MT</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6 }}>
                  <div
                    style={{ width: `${pct}%`, height: "100%", background: "#10b981", borderRadius: 4 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
