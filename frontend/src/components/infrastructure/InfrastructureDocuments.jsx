import React from "react";
import { FileText } from "lucide-react";

const InfrastructureDocuments = () => (
  <main
    style={{
      padding: 24,
      color: "var(--color-text-primary)",
      background: "var(--color-background)",
      minHeight: "100%",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <FileText size={28} color="var(--color-primary)" aria-hidden="true" />
      <div>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
          Infrastructure / Documents
        </p>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Infrastructure Documents</h1>
      </div>
    </div>
    <section
      role="status"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Document linking is not available</h2>
      <p>
        The existing asset documents API links files to the general assets table,
        while Infrastructure assets are stored separately. No documents are shown
        here because that relationship cannot safely identify an Infrastructure
        asset.
      </p>
      <p style={{ marginBottom: 0 }}>
        TODO: add an Infrastructure-compatible document relationship and API before
        enabling uploads or downloads. This requires an approved schema change.
      </p>
    </section>
  </main>
);

export default InfrastructureDocuments;
