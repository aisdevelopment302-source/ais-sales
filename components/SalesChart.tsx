"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMonth, formatCurrency, formatNumber } from "@/lib/api";

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
  total_qty: number;
}

export default function SalesChart({ monthly }: { monthly: MonthlyRow[] }) {
  const data = monthly.map((r) => ({
    label: formatMonth(r.month),
    "Bill Amount (L)": +(r.bill_amount / 100000).toFixed(2),
    "Taxable (L)": +(r.taxable_amount / 100000).toFixed(2),
    "GST (L)": +(r.gst_amount / 100000).toFixed(2),
    Bills: r.bill_count,
  }));

  const totalQty = monthly.reduce((s, r) => s + (r.total_qty || 0), 0);
  const totalSales = monthly.reduce((s, r) => s + (r.bill_amount || 0), 0);
  const overallAvgRate = totalQty > 0 ? totalSales / totalQty : 0;

  return (
    <>
      <div className="section-card">
        <div className="section-title">Monthly Sales Overview</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `₹${v}L`}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) =>
                name === "Bills" ? [v, name] : [`₹${v} L`, name]
              }
              labelStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Bill Amount (L)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="GST (L)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="Bills" stroke="#ef4444" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card">
        <div className="section-title">Monthly Breakdown</div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: "right" }}>Bills</th>
                <th style={{ textAlign: "right" }}>Qty (MT)</th>
                <th style={{ textAlign: "right" }}>Sales (₹)</th>
                <th style={{ textAlign: "right" }}>Avg Rate (₹/MT)</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => {
                const avgRate = row.total_qty > 0 ? row.bill_amount / row.total_qty : 0;
                return (
                  <tr key={row.month}>
                    <td style={{ fontWeight: 500 }}>{formatMonth(row.month)}</td>
                    <td className="num">{row.bill_count}</td>
                    <td className="num">{formatNumber(row.total_qty)}</td>
                    <td className="num">{formatCurrency(row.bill_amount)}</td>
                    <td className="num">{avgRate > 0 ? formatCurrency(avgRate) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{monthly.reduce((s, r) => s + r.bill_count, 0)}</td>
                <td className="num">{formatNumber(totalQty)}</td>
                <td className="num">{formatCurrency(totalSales)}</td>
                <td className="num">{overallAvgRate > 0 ? formatCurrency(overallAvgRate) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
