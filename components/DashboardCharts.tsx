"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatMonth } from "@/lib/api";

interface MonthlyRow {
  month: string;
  bill_count: number;
  taxable_amount: number;
  bill_amount: number;
  gst_amount: number;
}

interface TopItem {
  name: string;
  total_sales: number;
  total_weight: number;
}

interface TopCustomer {
  name: string;
  bill_count: number;
  total_sales: number;
}

interface Props {
  monthly: MonthlyRow[];
  topCustomers: TopCustomer[];
  topItems: TopItem[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function DashboardCharts({ monthly, topCustomers, topItems }: Props) {
  const chartData = monthly.map((r) => ({
    ...r,
    label: formatMonth(r.month),
    bill_amount_L: +(r.bill_amount / 100000).toFixed(2),
    taxable_L: +(r.taxable_amount / 100000).toFixed(2),
  }));

  return (
    <div>
      {/* Monthly Sales Chart */}
      <div className="section-card">
        <div className="section-title">Monthly Sales Trend (Bill Amount, ₹ Lakhs)</div>
        {chartData.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            No sales data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
              <Tooltip
                formatter={(v: number) => [`₹${v.toFixed(2)} L`, "Bill Amount"]}
                labelStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="bill_amount_L" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Bill Amount" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Customers + Top Items side by side */}
      <div className="grid-2-cols">
        {/* Top Customers */}
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-title">Top 5 Customers</div>
          {topCustomers.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No data
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th style={{ textAlign: "right" }}>Bills</th>
                  <th style={{ textAlign: "right" }}>Sales</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={c.name}>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: COLORS[i] || "#94a3b8",
                          color: "white",
                          fontSize: 10,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </td>
                    <td className="num">{c.bill_count}</td>
                    <td className="num">{formatCurrency(c.total_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Items */}
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-title">Top 5 Items by Sales</div>
          {topItems.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No item data (bills may have no line items)
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Wt (MT)</th>
                  <th style={{ textAlign: "right" }}>Sales</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, i) => (
                  <tr key={item.name}>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: COLORS[i] || "#94a3b8",
                          color: "white",
                          fontSize: 10,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </td>
                    <td className="num">
                      {item.total_weight != null ? item.total_weight.toFixed(3) : "—"}
                    </td>
                    <td className="num">{formatCurrency(item.total_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
