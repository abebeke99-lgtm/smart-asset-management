import React, { useEffect, useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";

const CHEMICALS_API = "/api/admin/inventory";
const QUARANTINE_API = `${CHEMICALS_API}/quarantine`;

const EMPTY_FORM = {
  chemicalId: "",
  reason: "",
  storageLocation: "",
};

async function apiRequest(url, options = {}) {
  try {
    const response = await apiClient.request({
      url,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to complete the chemical quarantine request."));
  }
}

function extractArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function normalizeChemical(item, index) {
  return {
    id:
      item?.id ??
      item?.chemicalId ??
      item?._id ??
      `chemical-${index}`,

    chemicalId:
      item?.chemicalId ??
      item?.id ??
      "",

    name:
      item?.name ??
      item?.chemicalName ??
      item?.productName ??
      "",

    casNumber:
      item?.casNumber ??
      item?.cas_number ??
      item?.casNo ??
      "",

    category:
      item?.categoryName ??
      item?.category ??
      "",

    quantity:
      item?.quantity ??
      item?.availableQuantity ??
      item?.stockQuantity ??
      0,

    unit:
      item?.unit ??
      item?.unitOfMeasure ??
      "",

    location:
      item?.locationName ??
      item?.storageLocation ??
      item?.location ??
      "",

    expiryDate:
      item?.expiryDate ??
      item?.expirationDate ??
      null,

    hazardClass:
      item?.hazardClass ??
      item?.hazard_class ??
      item?.hazardCategory ??
      "",

    status:
      item?.status ??
      "Available",

    raw: item,
  };
}

function normalizeRecord(item, index) {
  return {
    id:
      item?.id ??
      item?.quarantineId ??
      item?._id ??
      `quarantine-${index}`,

    referenceNumber:
      item?.referenceNumber ??
      item?.quarantineNumber ??
      item?.recordNumber ??
      item?.chemicalCode ??
      item?.chemical_code ??
      "",

    chemicalId:
      item?.chemicalId ??
      item?.chemical?.chemicalId ??
      item?.chemical?.id ??
      "",

    chemicalName:
      item?.chemicalName ??
      item?.chemical?.name ??
      item?.chemical?.chemicalName ??
      "",

    casNumber:
      item?.casNumber ??
      item?.chemical?.casNumber ??
      "",

    reason:
      item?.reason ??
      item?.quarantineReason ??
      "",

    quarantineDate:
      item?.quarantineDate ??
      item?.date ??
      item?.updatedAt ??
      item?.createdAt ??
      null,

    storageLocation:
      item?.storageLocation ??
      item?.locationName ??
      item?.location ??
      "",

    status:
      (item?.quarantine ? "Quarantined" : item?.status) ??
      "Quarantined",

    createdBy:
      item?.createdByName ??
      item?.createdBy?.name ??
      item?.createdBy ??
      "",

    raw: item,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function daysUntil(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();

  return Math.ceil(
    (date.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getExpiryLabel(expiryDate) {
  const days = daysUntil(expiryDate);

  if (days === null) {
    return {
      text: "No expiry date",
      className: "expiry-normal",
    };
  }

  if (days < 0) {
    return {
      text: `Expired ${Math.abs(days)}d ago`,
      className: "expiry-danger",
    };
  }

  if (days <= 30) {
    return {
      text: `${days}d remaining`,
      className: "expiry-warning",
    };
  }

  return {
    text: `${days}d remaining`,
    className: "expiry-normal",
  };
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "released" ||
    value === "cleared" ||
    value === "resolved"
  ) {
    return "status-success";
  }

  if (
    value === "rejected" ||
    value === "cancelled"
  ) {
    return "status-danger";
  }

  if (
    value === "quarantined" ||
    value === "pending"
  ) {
    return "status-warning";
  }

  return "status-default";
}

export default function ChemicalQuarantine() {
  const [chemicals, setChemicals] = useState([]);
  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [showForm, setShowForm] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [chemicalsResponse, quarantineResponse] =
        await Promise.all([
          apiRequest(CHEMICALS_API),
          apiRequest(QUARANTINE_API),
        ]);

      const chemicalList = extractArray(
        chemicalsResponse,
        ["chemicals"]
      ).map(normalizeChemical);

      const quarantineList = extractArray(
        quarantineResponse,
        [
          "records",
          "quarantines",
          "quarantineRecords",
        ]
      ).map(normalizeRecord);

      setChemicals(chemicalList);
      setRecords(quarantineList);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load chemical quarantine information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const quarantineCount = records.filter(
    (record) =>
      String(record.status).toLowerCase() ===
      "quarantined"
  ).length;

  const expiredChemicalCount = chemicals.filter(
    (chemical) => {
      const days = daysUntil(
        chemical.expiryDate
      );

      return days !== null && days < 0;
    }
  ).length;

  const expiringSoonCount = chemicals.filter(
    (chemical) => {
      const days = daysUntil(
        chemical.expiryDate
      );

      return (
        days !== null &&
        days >= 0 &&
        days <= 30
      );
    }
  ).length;

  const availableChemicals = useMemo(() => {
    return chemicals.filter((chemical) => {
      const status = String(
        chemical.status || ""
      ).toLowerCase();

      const alreadyQuarantined =
        records.some(
          (record) =>
            String(record.chemicalId) ===
              String(chemical.chemicalId) &&
            String(
              record.status
            ).toLowerCase() === "quarantined"
        );

      return (
        status !== "quarantined" &&
        !alreadyQuarantined
      );
    });
  }, [chemicals, records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.referenceNumber
          .toLowerCase()
          .includes(query) ||
        record.chemicalId
          .toLowerCase()
          .includes(query) ||
        record.chemicalName
          .toLowerCase()
          .includes(query) ||
        record.casNumber
          .toLowerCase()
          .includes(query) ||
        record.reason
          .toLowerCase()
          .includes(query) ||
        record.storageLocation
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(record.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    records,
    search,
    statusFilter,
  ]);

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openForm = () => {
    setForm(EMPTY_FORM);

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const submitQuarantine = async (event) => {
    event.preventDefault();

    if (!form.chemicalId) {
      setError("Please select a chemical.");
      return;
    }

    if (!form.reason.trim()) {
      setError(
        "A quarantine reason is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const selectedChemical = chemicals.find((chemical) => String(chemical.id) === String(form.chemicalId));
      await apiRequest(`${CHEMICALS_API}/${encodeURIComponent(selectedChemical.id)}/quarantine`, {
        method: "POST",
        body: JSON.stringify({
          reason: form.reason.trim(),
          storageLocation:
            form.storageLocation.trim(),
        }),
      });

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to quarantine the chemical."
      );
    } finally {
      setSaving(false);
    }
  };

  const releaseChemical = async (record) => {
    const confirmed = window.confirm(
      `Release chemical ${
        record.chemicalName ||
        record.chemicalId
      } from quarantine?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${CHEMICALS_API}/${encodeURIComponent(record.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ remove_quarantine: true }),
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to release the chemical."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quarantine-page">
      <style>{`
        .quarantine-page {
          min-height: 100%;
          padding: 24px;
          background: #f3f6f9;
          color: #111827;
          box-sizing: border-box;
        }

        .quarantine-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .primary-button {
          border: 0;
          border-radius: 8px;
          padding: 11px 17px;
          background: #3074B3;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #245783;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
        }

        .summary-label {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .summary-value {
          font-size: 26px;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 16px;
          margin-bottom: 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .search-input,
        .filter-select {
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #fff;
          color: #111827;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
        }

        .search-input {
          flex: 1;
          min-width: 250px;
        }

        .search-input:focus,
        .filter-select:focus,
        .form-input:focus,
        .form-textarea:focus {
          border-color: #3074B3;
          box-shadow: 0 0 0 3px rgba(48, 116, 179, .1);
        }

        .refresh-button {
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #fff;
          color: #334155;
          padding: 10px 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .table-card {
          overflow: hidden;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .quarantine-table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        .quarantine-table th {
          padding: 13px 15px;
          background: #F5F7FA;
          color: #475569;
          font-size: 12px;
          text-align: left;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .quarantine-table td {
          padding: 14px 15px;
          font-size: 13px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
        }

        .quarantine-table tr:last-child td {
          border-bottom: 0;
        }

        .reference {
          color: #245783;
          font-weight: 700;
        }

        .chemical-name {
          margin-top: 3px;
          font-weight: 600;
        }

        .secondary {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .status-badge,
        .expiry-badge {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-success {
          color: #166534;
          background: #dcfce7;
        }

        .status-warning {
          color: #92400e;
          background: #fef3c7;
        }

        .status-danger {
          color: #b91c1c;
          background: #fee2e2;
        }

        .status-default {
          color: #245783;
          background: #EAF2FA;
        }

        .expiry-normal {
          color: #166534;
          background: #dcfce7;
        }

        .expiry-warning {
          color: #92400e;
          background: #fef3c7;
        }

        .expiry-danger {
          color: #b91c1c;
          background: #fee2e2;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .action-button {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 9px;
          background: #fff;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .action-button.view {
          color: #245783;
          background: #EAF2FA;
          border-color: #bfdbfe;
        }

        .action-button.release {
          color: #166534;
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .action-button.cancel {
          color: #b91c1c;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .error-box {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 14px;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .55);
        }

        .modal {
          width: min(650px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, .25);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 18px;
          cursor: pointer;
        }

        .form {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .form-label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .required {
          color: #dc2626;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 10px 12px;
          background: #fff;
          color: #111827;
          font-size: 14px;
          outline: none;
        }

        .form-textarea {
          min-height: 95px;
          resize: vertical;
          font-family: inherit;
        }

        .helper-text {
          margin-top: 6px;
          color: #64748b;
          font-size: 12px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .secondary-button {
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 10px 15px;
          background: #fff;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 20px;
        }

        .detail-item {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #F5F7FA;
        }

        .detail-full {
          grid-column: 1 / -1;
        }

        .detail-label {
          margin-bottom: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .detail-value {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          word-break: break-word;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .quarantine-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            min-width: 0;
          }

          .summary-grid,
          .form-row,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-full {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="quarantine-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Chemical Quarantine
            </h1>

            <p className="page-subtitle">
              Isolate chemicals that require
              administrative review, safety inspection,
              or controlled handling.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openForm}
          >
            + Quarantine Chemical
          </button>
        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Active Quarantine
            </div>

            <div className="summary-value">
              {quarantineCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Expired Chemicals
            </div>

            <div className="summary-value">
              {expiredChemicalCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Expiring Within 30 Days
            </div>

            <div className="summary-value">
              {expiringSoonCount}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search chemical, CAS number, reference, reason..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">
              All Statuses
            </option>

            <option value="Quarantined">
              Quarantined
            </option>

          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading chemical quarantine records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                ⚠️
              </div>

              <strong>
                No quarantine records found
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                Try changing your search or status
                filter.
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="quarantine-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Chemical</th>
                    <th>CAS Number</th>
                    <th>Reason</th>
                    <th>Quarantine Date</th>
                    <th>Expiry</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record) => {
                      const expiryChemical =
                        chemicals.find(
                          (chemical) =>
                            String(
                              chemical.chemicalId
                            ) ===
                            String(
                              record.chemicalId
                            )
                        );

                      const expiry =
                        getExpiryLabel(
                          expiryChemical?.expiryDate
                        );

                      return (
                        <tr key={record.id}>
                          <td>
                            <div className="reference">
                              {record.referenceNumber ||
                                record.id}
                            </div>
                          </td>

                          <td>
                            <div className="chemical-name">
                              {record.chemicalName ||
                                "Unknown Chemical"}
                            </div>

                            <div className="secondary">
                              ID:{" "}
                              {record.chemicalId ||
                                "—"}
                            </div>
                          </td>

                          <td>
                            {record.casNumber ||
                              "—"}
                          </td>

                          <td>
                            {record.reason || "—"}
                          </td>

                          <td>
                            {formatDate(
                              record.quarantineDate
                            )}
                          </td>

                          <td>
                            <span
                              className={`expiry-badge ${expiry.className}`}
                            >
                              {expiry.text}
                            </span>
                          </td>

                          <td>
                            {record.storageLocation ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${statusClass(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                type="button"
                                className="action-button view"
                                onClick={() =>
                                  setSelectedRecord(
                                    record
                                  )
                                }
                              >
                                View
                              </button>

                              {String(
                                record.status
                              ).toLowerCase() ===
                                "quarantined" && (
                                <>
                                  <button
                                    type="button"
                                    className="action-button release"
                                    onClick={() =>
                                      releaseChemical(
                                        record
                                      )
                                    }
                                    disabled={
                                      saving
                                    }
                                  >
                                    Release
                                  </button>

                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            color: "#64748b",
            fontSize: 13,
          }}
        >
          Showing {filteredRecords.length} of{" "}
          {records.length} quarantine records
        </div>
      </div>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Quarantine Chemical
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="form"
              onSubmit={submitQuarantine}
            >
              <div className="form-group">
                <label className="form-label">
                  Chemical{" "}
                  <span className="required">*</span>
                </label>

                <select
                  name="chemicalId"
                  className="form-input"
                  value={form.chemicalId}
                  onChange={updateForm}
                  required
                >
                  <option value="">
                    Select chemical
                  </option>

                  {availableChemicals.map(
                    (chemical) => (
                      <option
                        key={chemical.id}
                        value={
                          chemical.chemicalId
                        }
                      >
                        {chemical.chemicalId} —{" "}
                        {chemical.name}
                        {chemical.casNumber
                          ? ` — CAS ${chemical.casNumber}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {availableChemicals.length ===
                  0 && (
                  <div className="helper-text">
                    No chemicals are currently
                    available for quarantine.
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Storage Location
                  </label>

                  <input
                    type="text"
                    name="storageLocation"
                    className="form-input"
                    value={
                      form.storageLocation
                    }
                    onChange={updateForm}
                    placeholder="Quarantine storage area"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason{" "}
                  <span className="required">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  name="reason"
                  className="form-input"
                  value={form.reason}
                  onChange={updateForm}
                  placeholder="Reason for quarantine"
                  required
                />
              </div>

              <div className="helper-text">
                Quarantined chemicals should remain
                isolated until the responsible authority
                completes the required review.
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Quarantine Chemical"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRecord(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Quarantine Details
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                ×
              </button>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">
                  Reference
                </div>

                <div className="detail-value">
                  {selectedRecord.referenceNumber ||
                    selectedRecord.id}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Status
                </div>

                <div className="detail-value">
                  {selectedRecord.status}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Chemical ID
                </div>

                <div className="detail-value">
                  {selectedRecord.chemicalId ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Chemical
                </div>

                <div className="detail-value">
                  {selectedRecord.chemicalName ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  CAS Number
                </div>

                <div className="detail-value">
                  {selectedRecord.casNumber ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Quarantine Date
                </div>

                <div className="detail-value">
                  {formatDate(
                    selectedRecord.quarantineDate
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Storage Location
                </div>

                <div className="detail-value">
                  {selectedRecord.storageLocation ||
                    "—"}
                </div>
              </div>

              <div className="detail-item detail-full">
                <div className="detail-label">
                  Reason
                </div>

                <div className="detail-value">
                  {selectedRecord.reason ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Created By
                </div>

                <div className="detail-value">
                  {selectedRecord.createdBy ||
                    "—"}
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}