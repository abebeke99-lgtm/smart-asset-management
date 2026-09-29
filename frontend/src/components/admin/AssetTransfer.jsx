import React, { useEffect, useMemo, useState } from "react";

const ASSETS_API = "/api/assets";
const TRANSFERS_API = "/api/asset-transfers";
const DEPARTMENTS_API = "/api/departments";
const LOCATIONS_API = "/api/locations";

const EMPTY_FORM = {
  assetId: "",
  fromDepartmentId: "",
  toDepartmentId: "",
  fromLocationId: "",
  toLocationId: "",
  transferDate: new Date().toISOString().slice(0, 10),
  reason: "",
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
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";

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

    departmentId:
      asset?.departmentId ??
      asset?.department?.id ??
      "",

    departmentName:
      asset?.departmentName ??
      asset?.department?.name ??
      asset?.department ??
      "",

    locationId:
      asset?.locationId ??
      asset?.location?.id ??
      "",

    locationName:
      asset?.locationName ??
      asset?.location?.name ??
      asset?.location ??
      "",

    status: asset?.status ?? "Available",

    raw: asset,
  };
}

function normalizeDepartment(department, index) {
  return {
    id:
      department?.id ??
      department?.departmentId ??
      department?._id ??
      `department-${index}`,

    name:
      department?.name ??
      department?.departmentName ??
      "Unnamed Department",
  };
}

function normalizeLocation(location, index) {
  return {
    id:
      location?.id ??
      location?.locationId ??
      location?._id ??
      `location-${index}`,

    name:
      location?.name ??
      location?.locationName ??
      "Unnamed Location",
  };
}

function normalizeTransfer(item, index) {
  return {
    id:
      item?.id ??
      item?.transferId ??
      item?._id ??
      `transfer-${index}`,

    transferNumber:
      item?.transferNumber ??
      item?.transferNo ??
      item?.referenceNumber ??
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

    fromDepartment:
      item?.fromDepartmentName ??
      item?.fromDepartment?.name ??
      item?.fromDepartment ??
      "",

    toDepartment:
      item?.toDepartmentName ??
      item?.toDepartment?.name ??
      item?.toDepartment ??
      "",

    fromLocation:
      item?.fromLocationName ??
      item?.fromLocation?.name ??
      item?.fromLocation ??
      "",

    toLocation:
      item?.toLocationName ??
      item?.toLocation?.name ??
      item?.toLocation ??
      "",

    transferDate:
      item?.transferDate ??
      item?.transfer_date ??
      item?.createdAt ??
      null,

    reason: item?.reason ?? "",
    notes: item?.notes ?? "",

    status: item?.status ?? "Completed",

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

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "completed" || value === "approved") {
    return "status-completed";
  }

  if (value === "pending") {
    return "status-pending";
  }

  if (value === "cancelled" || value === "rejected") {
    return "status-cancelled";
  }

  return "status-default";
}

export default function AssetTransfer() {
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        assetsResponse,
        departmentsResponse,
        locationsResponse,
        transfersResponse,
      ] = await Promise.all([
        apiRequest(ASSETS_API),
        apiRequest(DEPARTMENTS_API),
        apiRequest(LOCATIONS_API),
        apiRequest(TRANSFERS_API),
      ]);

      setAssets(
        extractArray(assetsResponse, ["assets"]).map(
          normalizeAsset
        )
      );

      setDepartments(
        extractArray(departmentsResponse, [
          "departments",
        ]).map(normalizeDepartment)
      );

      setLocations(
        extractArray(locationsResponse, ["locations"]).map(
          normalizeLocation
        )
      );

      setTransfers(
        extractArray(transfersResponse, ["transfers"]).map(
          normalizeTransfer
        )
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load asset transfer information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const matchesSearch =
        !query ||
        transfer.transferNumber
          .toLowerCase()
          .includes(query) ||
        transfer.assetId
          .toLowerCase()
          .includes(query) ||
        transfer.assetName
          .toLowerCase()
          .includes(query) ||
        transfer.serialNumber
          .toLowerCase()
          .includes(query) ||
        transfer.fromDepartment
          .toLowerCase()
          .includes(query) ||
        transfer.toDepartment
          .toLowerCase()
          .includes(query) ||
        transfer.fromLocation
          .toLowerCase()
          .includes(query) ||
        transfer.toLocation
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(transfer.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [transfers, search, statusFilter]);

  const completedCount = useMemo(
    () =>
      transfers.filter(
        (transfer) =>
          String(transfer.status).toLowerCase() ===
          "completed"
      ).length,
    [transfers]
  );

  const pendingCount = useMemo(
    () =>
      transfers.filter(
        (transfer) =>
          String(transfer.status).toLowerCase() ===
          "pending"
      ).length,
    [transfers]
  );

  const cancelledCount = useMemo(
    () =>
      transfers.filter((transfer) => {
        const status = String(
          transfer.status
        ).toLowerCase();

        return (
          status === "cancelled" ||
          status === "rejected"
        );
      }).length,
    [transfers]
  );

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAssetChange = (event) => {
    const assetId = event.target.value;

    const selectedAsset = assets.find(
      (asset) =>
        String(asset.assetId || asset.id) ===
        String(assetId)
    );

    setForm((previous) => ({
      ...previous,
      assetId,
      fromDepartmentId:
        selectedAsset?.departmentId ||
        previous.fromDepartmentId,
      fromLocationId:
        selectedAsset?.locationId ||
        previous.fromLocationId,
    }));
  };

  const openCreateForm = () => {
    setEditingTransfer(null);
    setForm({
      ...EMPTY_FORM,
      transferDate: new Date()
        .toISOString()
        .slice(0, 10),
    });
    setError("");
    setShowForm(true);
  };

  const openEditForm = (transfer) => {
    const asset = assets.find(
      (item) =>
        String(item.assetId || item.id) ===
        String(transfer.assetId)
    );

    const fromDepartment = departments.find(
      (item) =>
        item.name === transfer.fromDepartment
    );

    const toDepartment = departments.find(
      (item) =>
        item.name === transfer.toDepartment
    );

    const fromLocation = locations.find(
      (item) =>
        item.name === transfer.fromLocation
    );

    const toLocation = locations.find(
      (item) =>
        item.name === transfer.toLocation
    );

    setEditingTransfer(transfer);

    setForm({
      assetId: transfer.assetId || "",
      fromDepartmentId:
        transfer.raw?.fromDepartmentId ||
        fromDepartment?.id ||
        asset?.departmentId ||
        "",
      toDepartmentId:
        transfer.raw?.toDepartmentId ||
        toDepartment?.id ||
        "",
      fromLocationId:
        transfer.raw?.fromLocationId ||
        fromLocation?.id ||
        asset?.locationId ||
        "",
      toLocationId:
        transfer.raw?.toLocationId ||
        toLocation?.id ||
        "",
      transferDate: transfer.transferDate
        ? new Date(transfer.transferDate)
            .toISOString()
            .slice(0, 10)
        : "",
      reason: transfer.reason || "",
      notes: transfer.notes || "",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingTransfer(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      setError("Please select an asset.");
      return;
    }

    if (!form.toDepartmentId && !form.toLocationId) {
      setError(
        "Select at least a destination department or destination location."
      );
      return;
    }

    if (
      form.fromDepartmentId &&
      form.toDepartmentId &&
      String(form.fromDepartmentId) ===
        String(form.toDepartmentId) &&
      form.fromLocationId &&
      form.toLocationId &&
      String(form.fromLocationId) ===
        String(form.toLocationId)
    ) {
      setError(
        "The source and destination cannot be exactly the same."
      );
      return;
    }

    if (!form.transferDate) {
      setError("Transfer date is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        assetId: form.assetId,

        fromDepartmentId:
          form.fromDepartmentId || null,

        toDepartmentId:
          form.toDepartmentId || null,

        fromLocationId:
          form.fromLocationId || null,

        toLocationId:
          form.toLocationId || null,

        transferDate: form.transferDate,

        reason: form.reason.trim(),

        notes: form.notes.trim(),
      };

      if (editingTransfer) {
        await apiRequest(
          `${TRANSFERS_API}/${encodeURIComponent(
            editingTransfer.id
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(TRANSFERS_API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save the asset transfer."
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelTransfer = async (transfer) => {
    const confirmed = window.confirm(
      `Cancel transfer ${
        transfer.transferNumber ||
        transfer.id
      }?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${TRANSFERS_API}/${encodeURIComponent(
          transfer.id
        )}/cancel`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to cancel the asset transfer."
      );
    }
  };

  const approveTransfer = async (transfer) => {
    const confirmed = window.confirm(
      `Approve transfer ${
        transfer.transferNumber ||
        transfer.id
      }?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${TRANSFERS_API}/${encodeURIComponent(
          transfer.id
        )}/approve`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to approve the asset transfer."
      );
    }
  };

  return (
    <div className="asset-transfer-page">
      <style>{`
        .asset-transfer-page {
          min-height: 100%;
          background: #f3f6f9;
          padding: 24px;
          color: #111827;
          box-sizing: border-box;
        }

        .transfer-container {
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
          background: #2563eb;
          color: white;
          padding: 11px 17px;
          font-size: 14px;
          font-weight: 600;
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
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .summary-label {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .summary-value {
          color: #111827;
          font-size: 26px;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          margin-bottom: 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .search-input,
        .filter-select {
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 10px 12px;
          font-size: 14px;
          background: white;
          color: #111827;
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
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .refresh-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 7px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .transfer-table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        .transfer-table th {
          padding: 13px 15px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .transfer-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .transfer-table tr:last-child td {
          border-bottom: 0;
        }

        .transfer-number {
          color: #1d4ed8;
          font-weight: 700;
        }

        .asset-name {
          color: #111827;
          font-weight: 600;
          margin-top: 3px;
        }

        .secondary-text {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .movement {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 230px;
        }

        .movement-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 7px 9px;
          min-width: 80px;
        }

        .movement-label {
          color: #94a3b8;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 3px;
        }

        .movement-value {
          color: #334155;
          font-size: 12px;
          font-weight: 600;
        }

        .arrow {
          color: #2563eb;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-completed {
          background: #dcfce7;
          color: #166534;
        }

        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-default {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .action-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 6px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .action-button:hover {
          background: #f8fafc;
        }

        .action-button.primary {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .action-button.approve {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #166534;
        }

        .action-button.danger {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 12px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
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
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(700px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: 0;
          background: #f1f5f9;
          border-radius: 7px;
          cursor: pointer;
          font-size: 18px;
          color: #475569;
        }

        .form {
          padding: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
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
          font-size: 14px;
          background: white;
          outline: none;
        }

        .form-textarea {
          min-height: 95px;
          resize: vertical;
          font-family: inherit;
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
          background: white;
          color: #334155;
          border-radius: 7px;
          padding: 10px 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .helper-text {
          color: #64748b;
          font-size: 12px;
          margin-top: 6px;
        }

        @media (max-width: 950px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .asset-transfer-page {
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

          .form-row {
            grid-template-columns: 1fr;
          }

          .movement {
            flex-direction: column;
            align-items: stretch;
          }

          .arrow {
            text-align: center;
          }
        }
      `}</style>

      <div className="transfer-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Asset Transfer
            </h1>

            <p className="page-subtitle">
              Transfer assets between departments and locations
              while maintaining a complete movement record.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Transfer Asset
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
              Total Transfers
            </div>
            <div className="summary-value">
              {transfers.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Completed
            </div>
            <div className="summary-value">
              {completedCount}
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

          <div className="summary-card">
            <div className="summary-label">
              Cancelled
            </div>
            <div className="summary-value">
              {cancelledCount}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search transfer, asset, department or location..."
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
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rejected">Rejected</option>
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
              Loading transfer records...
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                🔄
              </div>

              <strong>
                {search || statusFilter !== "All"
                  ? "No matching transfers"
                  : "No asset transfers found"}
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                {search || statusFilter !== "All"
                  ? "Try changing your search or filter."
                  : "Create a transfer to begin tracking asset movement."}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="transfer-table">
                <thead>
                  <tr>
                    <th>Transfer</th>
                    <th>Asset</th>
                    <th>Department Movement</th>
                    <th>Location Movement</th>
                    <th>Transfer Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td>
                        <div className="transfer-number">
                          {transfer.transferNumber ||
                            transfer.id}
                        </div>

                        {transfer.createdBy && (
                          <div className="secondary-text">
                            By: {transfer.createdBy}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="asset-name">
                          {transfer.assetId || "—"}
                        </div>

                        <div>
                          {transfer.assetName ||
                            "Unnamed Asset"}
                        </div>

                        {transfer.serialNumber && (
                          <div className="secondary-text">
                            SN: {transfer.serialNumber}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="movement">
                          <div className="movement-box">
                            <div className="movement-label">
                              From
                            </div>

                            <div className="movement-value">
                              {transfer.fromDepartment ||
                                "—"}
                            </div>
                          </div>

                          <span className="arrow">
                            →
                          </span>

                          <div className="movement-box">
                            <div className="movement-label">
                              To
                            </div>

                            <div className="movement-value">
                              {transfer.toDepartment ||
                                "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="movement">
                          <div className="movement-box">
                            <div className="movement-label">
                              From
                            </div>

                            <div className="movement-value">
                              {transfer.fromLocation ||
                                "—"}
                            </div>
                          </div>

                          <span className="arrow">
                            →
                          </span>

                          <div className="movement-box">
                            <div className="movement-label">
                              To
                            </div>

                            <div className="movement-value">
                              {transfer.toLocation ||
                                "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {formatDate(
                          transfer.transferDate
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            transfer.status
                          )}`}
                        >
                          {transfer.status}
                        </span>
                      </td>

                      <td>
                        <div className="actions">
                          {String(
                            transfer.status
                          ).toLowerCase() === "pending" && (
                            <button
                              type="button"
                              className="action-button approve"
                              onClick={() =>
                                approveTransfer(transfer)
                              }
                            >
                              Approve
                            </button>
                          )}

                          {String(
                            transfer.status
                          ).toLowerCase() !==
                            "completed" &&
                            String(
                              transfer.status
                            ).toLowerCase() !==
                              "cancelled" &&
                            String(
                              transfer.status
                            ).toLowerCase() !==
                              "rejected" && (
                              <>
                                <button
                                  type="button"
                                  className="action-button primary"
                                  onClick={() =>
                                    openEditForm(
                                      transfer
                                    )
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="action-button danger"
                                  onClick={() =>
                                    cancelTransfer(
                                      transfer
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
                  ))}
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
          Showing {filteredTransfers.length} of{" "}
          {transfers.length} transfer records
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
                {editingTransfer
                  ? "Edit Asset Transfer"
                  : "Transfer Asset"}
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
                  onChange={handleAssetChange}
                  required
                >
                  <option value="">
                    Select asset
                  </option>

                  {assets.map((asset) => (
                    <option
                      key={asset.id}
                      value={asset.assetId || asset.id}
                    >
                      {asset.assetId || asset.id} —{" "}
                      {asset.name || "Unnamed Asset"}
                    </option>
                  ))}
                </select>

                <div className="helper-text">
                  Selecting an asset automatically loads its
                  current department and location when available.
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    From Department
                  </label>

                  <select
                    name="fromDepartmentId"
                    className="form-input"
                    value={form.fromDepartmentId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select source department
                    </option>

                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    To Department
                  </label>

                  <select
                    name="toDepartmentId"
                    className="form-input"
                    value={form.toDepartmentId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select destination department
                    </option>

                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    From Location
                  </label>

                  <select
                    name="fromLocationId"
                    className="form-input"
                    value={form.fromLocationId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select source location
                    </option>

                    {locations.map((location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    To Location
                  </label>

                  <select
                    name="toLocationId"
                    className="form-input"
                    value={form.toLocationId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select destination location
                    </option>

                    {locations.map((location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Transfer Date{" "}
                  <span className="required">*</span>
                </label>

                <input
                  type="date"
                  name="transferDate"
                  className="form-input"
                  value={form.transferDate}
                  onChange={updateForm}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason
                </label>

                <input
                  type="text"
                  name="reason"
                  className="form-input"
                  value={form.reason}
                  onChange={updateForm}
                  placeholder="Reason for transferring the asset"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Notes
                </label>

                <textarea
                  name="notes"
                  className="form-textarea"
                  value={form.notes}
                  onChange={updateForm}
                  placeholder="Additional transfer information..."
                />
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
                    : editingTransfer
                    ? "Save Changes"
                    : "Transfer Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}