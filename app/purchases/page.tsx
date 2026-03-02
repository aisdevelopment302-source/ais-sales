"use client";

export default function PurchasesPage() {
  return (
    <>
      <div className="page-header">
        <h1>Purchases</h1>
        <p>Purchase register — supplier and item-wise analysis</p>
      </div>

      <div
        className="section-card"
        style={{ padding: "48px 24px", textAlign: "center" }}
      >
        <div style={{ fontSize: 48, color: "#cbd5e1", marginBottom: 16, lineHeight: 1 }}>—</div>
        <div style={{ fontWeight: 600, fontSize: 16, color: "#475569", marginBottom: 8 }}>
          Purchases data not available
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 400, margin: "0 auto" }}>
          Purchase sync has not been run yet. Run the ETL script with{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
            --full-sync
          </code>{" "}
          to populate purchase data in Firebase.
        </div>
      </div>
    </>
  );
}
