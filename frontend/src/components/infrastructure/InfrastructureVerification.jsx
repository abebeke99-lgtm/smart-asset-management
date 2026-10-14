import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ScanSearch, Search } from "lucide-react";
import api from "../../services/api";

const STATES = [
  ["verified", "Verified"],
  ["missing", "Missing"],
  ["wrong_location", "Wrong location"],
  ["damaged", "Damaged"],
  ["needs_review", "Needs review"],
];

const pageStyle = {
  padding: 24,
  color: "var(--color-text-primary)",
  background: "var(--color-background)",
  minHeight: "100%",
};
const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};
const cellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

const InfrastructureVerification = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [state, setState] = useState("verified");
  const [condition, setCondition] = useState("");
  const [observedLocation, setObservedLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const loadAssets = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/infrastructure/verification", {
        params: { page, limit: 20, search: search.trim() },
      });
      const data = response?.data?.data;
      if (!Array.isArray(data)) throw new Error("The verification response was invalid.");
      setRows(data);
      setPages(Math.max(1, Number(response?.data?.pagination?.pages) || 1));
    } catch (requestError) {
      setRows([]);
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to load Infrastructure assets for verification."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const startVerification = (asset) => {
    setSelected(asset);
    setState("verified");
    setCondition(asset.condition || "");
    setObservedLocation(asset.location || asset.building || "");
    setNotes("");
    setError("");
    setSuccess("");
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/api/infrastructure/verification/${selected.id}`, {
        state,
        condition: condition.trim() || undefined,
        observedLocation: observedLocation.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(`Verification recorded for ${selected.name}.`);
      setSelected(null);
      await loadAssets(true);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to save the verification result."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <ScanSearch size={28} color="var(--color-primary)" aria-hidden="true" />
        <div>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
            Infrastructure / Verification
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Infrastructure Asset Verification</h1>
        </div>
        <button
          type="button"
          onClick={() => loadAssets(true)}
          disabled={loading || refreshing}
          style={{ marginLeft: "auto" }}
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {success && <p role="status" style={{ color: "var(--color-success-text)" }}>{success}</p>}

      <section style={{ ...cardStyle, padding: 16 }}>
        <label htmlFor="infrastructure-verification-search" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 520 }}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search by asset ID, QR, RFID, name, or location</span>
          <input
            id="infrastructure-verification-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search asset ID, QR, RFID, name, or location"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 8 }}
          />
        </label>

        {loading && <p role="status" style={{ padding: 24 }}>Loading Infrastructure assets…</p>}
        {!loading && error && !selected && <p role="alert" style={{ padding: 24, color: "var(--color-danger-text)" }}>{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p role="status" style={{ padding: 24, color: "var(--color-text-secondary)" }}>
            No Infrastructure assets match this search.
          </p>
        )}
        {!loading && !error && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["Asset", "Asset ID", "QR / RFID", "Location", "Condition", "Last verified", "Action"].map((heading) => (
                    <th key={heading} scope="col" style={cellStyle}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>{rows.map((asset) => (
                  <tr key={asset.id}>
                    <td style={cellStyle}>{asset.name}</td>
                    <td style={cellStyle}>{asset.assetCode || asset.id}</td>
                    <td style={cellStyle}>{[asset.qrCode, asset.rfidTag].filter(Boolean).join(" / ") || "No tag registered"}</td>
                    <td style={cellStyle}>{asset.location || asset.building || "—"}</td>
                    <td style={cellStyle}>{asset.latestVerification?.condition || asset.condition || "—"}</td>
                    <td style={cellStyle}>
                      {asset.latestVerification
                        ? `${asset.latestVerification.state} — ${new Date(asset.latestVerification.createdAt).toLocaleString()}`
                        : "Not yet verified"}
                    </td>
                    <td style={cellStyle}>
                      <button type="button" onClick={() => startVerification(asset)}>
                        <CheckCircle2 size={15} aria-hidden="true" /> Verify
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, paddingTop: 16 }}>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <span aria-live="polite">Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {selected && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.58)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-dialog-title"
            onSubmit={submitVerification}
            style={{ ...cardStyle, width: "min(560px, 100%)", padding: 20 }}
          >
            <h2 id="verification-dialog-title" style={{ marginTop: 0 }}>Verify {selected.name}</h2>
            <p>Asset ID: {selected.assetCode || selected.id}</p>
            {error && <p role="alert" style={{ color: "var(--color-danger-text)" }}>{error}</p>}
            <label style={{ display: "block", marginBottom: 12 }}>
              Result
              <select value={state} onChange={(event) => setState(event.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: 10 }}>
                {STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              Observed condition
              <input value={condition} maxLength={100} onChange={(event) => setCondition(event.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: 10 }} />
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              Observed location
              <input value={observedLocation} maxLength={255} onChange={(event) => setObservedLocation(event.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: 10 }} />
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
              Notes
              <textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} style={{ display: "block", width: "100%", minHeight: 80, marginTop: 4, padding: 10 }} />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" disabled={saving} onClick={() => setSelected(null)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save verification"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default InfrastructureVerification;
