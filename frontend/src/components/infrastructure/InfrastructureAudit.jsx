import React, { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import api from "../../services/api";

const pageStyle = {
  padding: "24px",
  color: "var(--color-text-primary)",
  background: "var(--color-background)",
  minHeight: "100%",
};
const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
};
const cellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

const InfrastructureAudit = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api.get("/api/infrastructure/audit", {
      params: { page, limit: 20, search: search.trim() },
    }).then((response) => {
      if (!active) return;
      const payload = response?.data?.data;
      if (!Array.isArray(payload)) throw new Error("The audit response was invalid.");
      setRecords(payload);
      setPages(Math.max(1, Number(response?.data?.pagination?.pages) || 1));
    }).catch((requestError) => {
      if (!active) return;
      setRecords([]);
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to load infrastructure audit records."
      );
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [page, search]);

  const displayDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <History size={28} color="var(--color-primary)" aria-hidden="true" />
        <div>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
            Infrastructure / Audit
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Infrastructure Audit</h1>
        </div>
      </div>

      <section style={{ ...cardStyle, padding: 16 }}>
        <label htmlFor="infrastructure-audit-search" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 440 }}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search audit records</span>
          <input
            id="infrastructure-audit-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search action, entity, or details"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 8 }}
          />
        </label>

        {loading && <p role="status" style={{ padding: 24 }}>Loading infrastructure audit records…</p>}
        {!loading && error && <p role="alert" style={{ color: "var(--color-danger-text)", padding: 24 }}>{error}</p>}
        {!loading && !error && records.length === 0 && (
          <p role="status" style={{ color: "var(--color-text-secondary)", padding: 24 }}>
            No infrastructure audit records found.
          </p>
        )}
        {!loading && !error && records.length > 0 && (
          <>
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["When", "Who", "Action", "Entity", "Details"].map((heading) => (
                      <th key={heading} scope="col" style={cellStyle}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td style={cellStyle}>{displayDate(record.createdAt)}</td>
                      <td style={cellStyle}>
                        {record.User?.fullName || record.User?.username || "System"}
                      </td>
                      <td style={cellStyle}>{record.action}</td>
                      <td style={cellStyle}>{record.entity || "—"}</td>
                      <td style={{ ...cellStyle, maxWidth: 420, wordBreak: "break-word" }}>
                        {typeof record.details === "string"
                          ? record.details
                          : JSON.stringify(record.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, paddingTop: 16 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <span aria-live="polite">Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default InfrastructureAudit;
