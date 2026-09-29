import React, { useEffect, useMemo, useState } from "react";

const ASSETS_API = "/api/assets";
const DISPOSALS_API = "/api/asset-disposals";

const EMPTY_FORM = {
  assetId: "",
  actionType: "Retirement",
  reason: "",
  disposalDate: new Date().toISOString().slice(0, 10),
  method: "",
  notes: "",
};

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType =
    response.headers.get("content-type") || "";

  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
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

function normalizeAsset(asset, index) {
  return {
    id:
      asset?.id ??
      asset?.assetId ??
      asset?._id ??
      `asset-${index}`,

    assetId:
      asset?.assetId ??
      asset?.id ??
      "",

    name:
      asset?.name ??
      asset?.assetName ??
      "",

    serialNumber:
      asset?.serialNumber ??
      asset?.serial_number ??
      "",

    category:
      asset?.categoryName ??
      asset?.category?.name ??
      asset?.category ??
      "",

    department:
      asset?.departmentName ??
      asset?.department?.name ??
      asset?.department ??
      "",

    location:
      asset?.locationName ??
      asset?.location?.name ??
      asset?.location ??
      "",

    condition:
      asset?.condition ??
      asset?.assetCondition ??
      "",

    status:
      asset?.status ??
      "Available",

    purchaseDate:
      asset?.purchaseDate ??
      asset?.purchase_date ??
      null,

    raw: asset,
  };
}

function normalizeRecord(item, index) {
  return {
    id:
      item?.id ??
      item?.disposalId ??
      item?.retirementId ??
      item?._id ??
      `record-${index}`,

    referenceNumber:
      item?.referenceNumber ??
      item?.disposalNumber ??
      item?.retirementNumber ??
      item?.recordNumber ??
      "",

    assetId:
      item?.assetId ??
      item?.asset?.assetId ??
      item?.asset?.id ??
      "",

    assetName:
      item?.assetName ??
      item?.asset?.name ??
      item?.asset?.assetName ??
      "",

    serialNumber:
      item?.serialNumber ??
      item?.asset?.serialNumber ??
      "",

    actionType:
      item?.actionType ??
      item?.type ??
      item?.action ??
      "Retirement",

    reason:
      item?.reason ??
      "",

    disposalDate:
      item?.disposalDate ??
      item?.retirementDate ??
      item?.actionDate ??
      item?.createdAt ??
      null,

    method:
      item?.method ??
      item?.disposalMethod ??
      "",

    status:
      item?.status ??
      "Pending",

    notes:
      item?.notes ??
      "",

    processedBy:
      item?.processedByName ??
      item?.processedBy?.name ??
      item?.processedBy ??
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

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "approved" ||
    value === "completed" ||
    value === "disposed" ||
    value === "retired"
  ) {
    return "status-success";
  }

  if (
    value === "rejected" ||
    value === "cancelled"
  ) {
    return "status-danger";
  }

  if (value === "pending") {
    return "status-warning";
  }

  return "status-default";
}

export default function DisposalRetirement() {
  const [assets, setAssets] = useState([]);
  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [assetsResponse, recordsResponse] =
        await Promise.all([
          apiRequest(ASSETS_API),
          apiRequest(DISPOSALS_API),
        ]);

      setAssets(
        extractArray(assetsResponse, ["assets"]).map(
          normalizeAsset
        )
      );

      setRecords(
        extractArray(recordsResponse, [
          "records",
          "disposals",
          "retirements",
        ]).map(normalizeRecord)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load disposal and retirement information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableAssets = useMemo(() => {
    return assets.filter((asset) => {
      const status = String(
        asset.status || ""
      ).toLowerCase();

      return (
        status !== "disposed" &&
        status !== "retired"
      );
    });
  }, [assets]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.referenceNumber
          .toLowerCase()
          .includes(query) ||
        record.assetId
          .toLowerCase()
          .includes(query) ||
        record.assetName
          .toLowerCase()
          .includes(query) ||
        record.serialNumber
          .toLowerCase()
          .includes(query) ||
        record.reason
          .toLowerCase()
          .includes(query);

      const matchesType =
        typeFilter === "All" ||
        String(record.actionType).toLowerCase() ===
          typeFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "All" ||
        String(record.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    records,
    search,
    typeFilter,
    statusFilter,
  ]);

  const retirementCount = useMemo(
    () =>
      records.filter(
        (record) =>
          String(record.actionType).toLowerCase() ===
          "retirement"
      ).length,
    [records]
  );

  const disposalCount = useMemo(
    () =>
      records.filter(
        (record) =>
          String(record.actionType).toLowerCase() ===
          "disposal"
      ).length,
    [records]
  );

  const pendingCount = useMemo(
    () =>
      records.filter(
        (record) =>
          String(record.status).toLowerCase() ===
          "pending"
      ).length,
    [records]
  );

  const completedCount = useMemo(
    () =>
      records.filter((record) => {
        const status = String(
          record.status
        ).toLowerCase();

        return (
          status === "completed" ||
          status === "disposed" ||
          status === "retired" ||
          status === "approved"
        );
      }).length,
    [records]
  );

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openForm = () => {
    setForm({
      ...EMPTY_FORM,
      disposalDate: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      setError("Please select an asset.");
      return;
    }

    if (!form.reason.trim()) {
      setError(
        "A reason is required for disposal or retirement."
      );
      return;
    }

    if (!form.disposalDate) {
      setError("The action date is required.");
      return;
    }

    if (
      form.actionType === "Disposal" &&
      !form.method.trim()
    ) {
      setError(
        "Please specify the disposal method."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        assetId: form.assetId,
        actionType: form.actionType,
        reason: form.reason.trim(),
        disposalDate: form.disposalDate,
        method: form.method.trim(),
        notes: form.notes.trim(),
      };

      await apiRequest(DISPOSALS_API, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to create the disposal or retirement request."
      );
    } finally {
      setSaving(false);
    }
  };

  const approveRecord = async (record) => {
    const confirmed = window.confirm(
      `Approve ${record.actionType.toLowerCase()} for asset ${
        record.assetId || record.assetName
      }?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${DISPOSALS_API}/${encodeURIComponent(
          record.id
        )}/approve`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to approve this record."
      );
    }
  };

  const rejectRecord = async (record) => {
    const confirmed = window.confirm(
      `Reject this ${record.actionType.toLowerCase()} request?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${DISPOSALS_API}/${encodeURIComponent(
          record.id
        )}/reject`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to reject this record."
      );
    }
  };

  const cancelRecord = async (record) => {
    const confirmed = window.confirm(
      `Cancel this ${record.actionType.toLowerCase()} request?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${DISPOSALS_API}/${encodeURIComponent(
          record.id
        )}/cancel`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to cancel this record."
      );
    }
  };

  return (
    <div className="disposal-page">
      <style>{`
        .disposal-page {
          min-height: 100%;
          padding: 24px;
          background: #f3f6f9;
          color: #111827;
          box-sizing: border-box;
        }

        .disposal-container {
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
          background: #2563eb;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #1d4ed8;
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
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .1);
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

        .records-table {
          width: 100%;
          min-width: 1150px;
          border-collapse: collapse;
        }

        .records-table th {
          padding: 13px 15px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          text-align: left;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .records-table td {
          padding: 14px 15px;
          font-size: 13px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
        }

        .records-table tr:last-child td {
          border-bottom: 0;
        }

        .reference {
          color: #1d4ed8;
          font-weight: 700;
        }

        .asset-name {
          margin-top: 3px;
          font-weight: 600;
        }

        .secondary {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .type-badge {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .type-retirement {
          color: #92400e;
          background: #fef3c7;
        }

        .type-disposal {
          color: #991b1b;
          background: #fee2e2;
        }

        .status-badge {
          display: inline-flex;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
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
          color: #1d4ed8;
          background: #eff6ff;
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

        .action-button.approve {
          color: #166534;
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .action-button.reject,
        .action-button.cancel {
          color: #b91c1c;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .action-button.view {
          color: #1d4ed8;
          background: #eff6ff;
          border-color: #bfdbfe;
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
          min-height: 100px;
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
          background: #f8fafc;
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
        }

        .detail-full {
          grid-column: 1 / -1;
        }

        @media (max-width: 950px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .disposal-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            min-width: 0;
          }

          .form-row,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-full {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="disposal-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Disposal & Retirement
            </h1>

            <p className="page-subtitle">
              Manage assets that are no longer suitable for
              active use and maintain their disposal or
              retirement records.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openForm}
          >
            + New Request
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
              Total Records
            </div>
            <div className="summary-value">
              {records.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Retirement
            </div>
            <div className="summary-value">
              {retirementCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Disposal
            </div>
            <div className="summary-value">
              {disposalCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Pending
            </div>
            <div className="summary-value">
              {pendingCount}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search asset, serial number, reference or reason..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="All">
              All Types
            </option>
            <option value="Retirement">
              Retirement
            </option>
            <option value="Disposal">
              Disposal
            </option>
          </select>

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
            <option value="Pending">
              Pending
            </option>
            <option value="Approved">
              Approved
            </option>
            <option value="Completed">
              Completed
            </option>
            <option value="Disposed">
              Disposed
            </option>
            <option value="Retired">
              Retired
            </option>
            <option value="Rejected">
              Rejected
            </option>
            <option value="Cancelled">
              Cancelled
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
              Loading disposal and retirement records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                ♻️
              </div>

              <strong>
                {search ||
                typeFilter !== "All" ||
                statusFilter !== "All"
                  ? "No matching records"
                  : "No disposal or retirement records"}
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                {search ||
                typeFilter !== "All" ||
                statusFilter !== "All"
                  ? "Try changing your filters."
                  : "Create a new request when an asset needs to be retired or disposed."}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Asset</th>
                    <th>Action</th>
                    <th>Reason</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Processed By</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => {
                    const type =
                      String(
                        record.actionType
                      ).toLowerCase();

                    return (
                      <tr key={record.id}>
                        <td>
                          <div className="reference">
                            {record.referenceNumber ||
                              record.id}
                          </div>
                        </td>

                        <td>
                          <div className="asset-name">
                            {record.assetId ||
                              "—"}
                          </div>

                          <div>
                            {record.assetName ||
                              "Unnamed Asset"}
                          </div>

                          {record.serialNumber && (
                            <div className="secondary">
                              SN:{" "}
                              {record.serialNumber}
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            className={`type-badge ${
                              type === "disposal"
                                ? "type-disposal"
                                : "type-retirement"
                            }`}
                          >
                            {record.actionType}
                          </span>
                        </td>

                        <td>
                          {record.reason || "—"}
                        </td>

                        <td>
                          {formatDate(
                            record.disposalDate
                          )}
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
                          {record.processedBy ||
                            "—"}
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
                              "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="action-button approve"
                                  onClick={() =>
                                    approveRecord(
                                      record
                                    )
                                  }
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  className="action-button reject"
                                  onClick={() =>
                                    rejectRecord(
                                      record
                                    )
                                  }
                                >
                                  Reject
                                </button>

                                <button
                                  type="button"
                                  className="action-button cancel"
                                  onClick={() =>
                                    cancelRecord(
                                      record
                                    )
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
          {records.length} records
        </div>

        {completedCount > 0 && (
          <div
            style={{
              marginTop: 6,
              color: "#64748b",
              fontSize: 12,
            }}
          >
            Completed/processed records:{" "}
            {completedCount}
          </div>
        )}
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
                New Disposal / Retirement Request
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
              onSubmit={handleSubmit}
            >
              <div className="form-group">
                <label className="form-label">
                  Asset{" "}
                  <span className="required">*</span>
                </label>

                <select
                  name="assetId"
                  className="form-input"
                  value={form.assetId}
                  onChange={updateForm}
                  required
                >
                  <option value="">
                    Select asset
                  </option>

                  {availableAssets.map((asset) => (
                    <option
                      key={asset.id}
                      value={
                        asset.assetId || asset.id
                      }
                    >
                      {asset.assetId || asset.id} —{" "}
                      {asset.name ||
                        "Unnamed Asset"}
                      {asset.serialNumber
                        ? ` — SN: ${asset.serialNumber}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Action Type{" "}
                    <span className="required">*</span>
                  </label>

                  <select
                    name="actionType"
                    className="form-input"
                    value={form.actionType}
                    onChange={updateForm}
                    required
                  >
                    <option value="Retirement">
                      Retirement
                    </option>
                    <option value="Disposal">
                      Disposal
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Action Date{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    type="date"
                    name="disposalDate"
                    className="form-input"
                    value={form.disposalDate}
                    onChange={updateForm}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason{" "}
                  <span className="required">*</span>
                </label>

                <input
                  type="text"
                  name="reason"
                  className="form-input"
                  value={form.reason}
                  onChange={updateForm}
                  placeholder="Explain why the asset is being retired or disposed"
                  required
                />
              </div>

              {form.actionType === "Disposal" && (
                <div className="form-group">
                  <label className="form-label">
                    Disposal Method{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    type="text"
                    name="method"
                    className="form-input"
                    value={form.method}
                    onChange={updateForm}
                    placeholder="e.g. auction, recycling, destruction"
                    required
                  />
                </div>
              )}

              {form.actionType === "Retirement" && (
                <div className="form-group">
                  <label className="form-label">
                    Retirement Method
                  </label>

                  <input
                    type="text"
                    name="method"
                    className="form-input"
                    value={form.method}
                    onChange={updateForm}
                    placeholder="Optional retirement method"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Notes
                </label>

                <textarea
                  name="notes"
                  className="form-textarea"
                  value={form.notes}
                  onChange={updateForm}
                  placeholder="Additional information, supporting details or remarks..."
                />
              </div>

              <div className="helper-text">
                The request will be submitted for the
                appropriate administrative approval workflow.
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
                    ? "Submitting..."
                    : "Submit Request"}
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
                Disposal / Retirement Details
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
                  Action
                </div>

                <div className="detail-value">
                  {selectedRecord.actionType}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Asset ID
                </div>

                <div className="detail-value">
                  {selectedRecord.assetId ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Asset Name
                </div>

                <div className="detail-value">
                  {selectedRecord.assetName ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Serial Number
                </div>

                <div className="detail-value">
                  {selectedRecord.serialNumber ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Date
                </div>

                <div className="detail-value">
                  {formatDate(
                    selectedRecord.disposalDate
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Method
                </div>

                <div className="detail-value">
                  {selectedRecord.method ||
                    "—"}
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

              <div className="detail-item detail-full">
                <div className="detail-label">
                  Reason
                </div>

                <div className="detail-value">
                  {selectedRecord.reason ||
                    "—"}
                </div>
              </div>

              <div className="detail-item detail-full">
                <div className="detail-label">
                  Notes
                </div>

                <div className="detail-value">
                  {selectedRecord.notes ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Processed By
                </div>

                <div className="detail-value">
                  {selectedRecord.processedBy ||
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