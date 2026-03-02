export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number | null | undefined, decimals = 3): string {
  if (value == null) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
