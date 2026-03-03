"use client";

export default function MeltingScrapAnalysisPage() {
  return (
    <>
      <div className="page-header">
        <h1>Melting Scrap Analysis</h1>
        <p>Waste by-product sales analysis (Item: Melting Scrap)</p>
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "40px 24px",
          textAlign: "center",
          color: "#64748b",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12, color: "#cbd5e1" }}>—</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#475569", marginBottom: 6 }}>
          Item-level data not available
        </div>
        <div style={{ fontSize: 13 }}>
          Sales documents in Firebase do not contain an <code>items[]</code> array.
          Item-level analysis (Melting Scrap) cannot be computed until the ETL sync includes line-item data.
        </div>
      </div>
    </>
  );
}
