import React, { useCallback, useEffect, useState } from "react";
import { Package, Search } from "lucide-react";
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
};

const InfrastructureSpareParts = () => {
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPart, setSelectedPart] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/infrastructure/spare-parts", {
        params: { search: search.trim(), limit: 100 },
      });
      const rows = response?.data?.data;
      if (!Array.isArray(rows)) throw new Error("The spare-parts response was invalid.");
      setParts(rows);
    } catch (requestError) {
      setParts([]);
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to load spare parts."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadParts(); }, [loadParts]);

  const viewTransactions = async (part) => {
    setSelectedPart(part);
    setTransactions([]);
    setTransactionsLoading(true);
    setTransactionsError("");
    try {
      const response = await api.get(`/api/infrastructure/spare-parts/${part.id}/transactions`);
      const rows = response?.data?.data;
      if (!Array.isArray(rows)) throw new Error("The transaction response was invalid.");
      setTransactions(rows);
    } catch (requestError) {
      setTransactionsError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to load spare-part transactions."
      );
    } finally {
      setTransactionsLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Package size={28} color="var(--color-primary)" aria-hidden="true" />
        <div>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
            Infrastructure / Spare Parts
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Spare Parts & Materials</h1>
        </div>
      </div>

      <section style={{ ...cardStyle, padding: 16 }}>
        <p role="note" style={{ color: "var(--color-text-secondary)", marginTop: 0 }}>
          Read-only inventory. TODO: add Infrastructure-scoped stock transactions; the existing write API is restricted to the Maintenance module.
        </p>
        <label htmlFor="infrastructure-spare-parts-search" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 440 }}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search spare parts</span>
          <input
            id="infrastructure-spare-parts-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code, category, supplier, or location"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 8 }}
          />
        </label>

        {loading && <p role="status" style={{ padding: 24 }}>Loading spare parts…</p>}
        {!loading && error && <p role="alert" style={{ color: "var(--color-danger-text)", padding: 24 }}>{error}</p>}
        {!loading && !error && parts.length === 0 && (
          <p role="status" style={{ color: "var(--color-text-secondary)", padding: 24 }}>
            No spare parts are registered.
          </p>
        )}
        {!loading && !error && parts.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Part", "Code", "Category", "Quantity", "Minimum", "Location", "Transactions"].map((heading) => (
                    <th key={heading} scope="col" style={cellStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id}>
                    <td style={cellStyle}>{part.partName}</td>
                    <td style={cellStyle}>{part.partCode}</td>
                    <td style={cellStyle}>{part.category || "—"}</td>
                    <td style={cellStyle}>{Number(part.quantity || 0)} {Number(part.quantity || 0) <= Number(part.minimumStock || 0) && (
                      <strong style={{ color: "var(--color-warning-text)" }}>Low stock</strong>
                    )}</td>
                    <td style={cellStyle}>{Number(part.minimumStock || 0)}</td>
                    <td style={cellStyle}>{part.location || "—"}</td>
                    <td style={cellStyle}>
                      <button type="button" onClick={() => viewTransactions(part)}>
                        View history
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPart && (
        <section aria-labelledby="spare-part-history-title" style={{ ...cardStyle, padding: 16, marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 id="spare-part-history-title" style={{ margin: 0 }}>
              Transaction history: {selectedPart.partName}
            </h2>
            <button type="button" onClick={() => setSelectedPart(null)}>Close</button>
          </div>
          {transactionsLoading && <p role="status">Loading transaction history…</p>}
          {!transactionsLoading && transactionsError && <p role="alert">{transactionsError}</p>}
          {!transactionsLoading && !transactionsError && transactions.length === 0 && (
            <p role="status">No transactions are recorded for this spare part.</p>
          )}
          {!transactionsLoading && !transactionsError && transactions.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["Date", "Type", "Quantity", "Previous", "New", "User", "Notes"].map((heading) => (
                    <th key={heading} scope="col" style={cellStyle}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>{transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td style={cellStyle}>{transaction.transactionDate ? new Date(transaction.transactionDate).toLocaleString() : "—"}</td>
                    <td style={cellStyle}>{transaction.transactionType}</td>
                    <td style={cellStyle}>{transaction.quantity}</td>
                    <td style={cellStyle}>{transaction.previousQuantity}</td>
                    <td style={cellStyle}>{transaction.newQuantity}</td>
                    <td style={cellStyle}>{transaction.User?.fullName || transaction.User?.username || "—"}</td>
                    <td style={cellStyle}>{transaction.notes || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default InfrastructureSpareParts;
