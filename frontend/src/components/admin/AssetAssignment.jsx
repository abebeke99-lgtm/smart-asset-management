import React, { useEffect, useMemo, useState } from "react";

const ASSETS_API = "/api/assets";
const ASSIGNMENTS_API = "/api/asset-assignments";
const USERS_API = "/api/users";
const DEPARTMENTS_API = "/api/departments";
const LOCATIONS_API = "/api/locations";

const EMPTY_FORM = {
  assetId: "",
  assigneeId: "",
  departmentId: "",
  locationId: "",
  assignedDate: new Date().toISOString().slice(0, 10),
  expectedReturnDate: "",
  purpose: "",
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
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function normalizeAsset(asset, index) {
  return {
    id:
      asset?.id ??
      asset?.assetId ??
      asset?._id ??
      `asset-${index}`,
    assetId: asset?.assetId ?? asset?.id ?? "",
    name: asset?.name ?? asset?.assetName ?? "",
    serialNumber:
      asset?.serialNumber ?? asset?.serial_number ?? "",
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
    status: asset?.status ?? "Available",
    condition: asset?.condition ?? "",
    raw: asset,
  };
}

function normalizeUser(user, index) {
  return {
    id:
      user?.id ??
      user?.userId ??
      user?._id ??
      `user-${index}`,
    name:
      user?.name ??
      user?.fullName ??
      (`${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        user?.username ||
        user?.email ||
        "Unnamed User"),
    email: user?.email ?? "",
    department:
      user?.departmentName ??
      user?.department?.name ??
      user?.department ??
      "",
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

function normalizeAssignment(item, index) {
  return {
    id:
      item?.id ??
      item?.assignmentId ??
      item?._id ??
      `assignment-${index}`,

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

    assigneeId:
      item?.assigneeId ??
      item?.userId ??
      item?.assignee?.id ??
      item?.user?.id ??
      "",

    assigneeName:
      item?.assigneeName ??
      item?.assignee?.name ??
      item?.user?.name ??
      item?.user?.fullName ??
      "",

    departmentId:
      item?.departmentId ??
      item?.department?.id ??
      "",

    departmentName:
      item?.departmentName ??
      item?.department?.name ??
      item?.department ??
      "",

    locationId:
      item?.locationId ??
      item?.location?.id ??
      "",

    locationName:
      item?.locationName ??
      item?.location?.name ??
      item?.location ??
      "",

    assignedDate:
      item?.assignedDate ??
      item?.assigned_date ??
      item?.createdAt ??
      null,

    expectedReturnDate:
      item?.expectedReturnDate ??
      item?.expected_return_date ??
      null,

    returnDate:
      item?.returnDate ??
      item?.return_date ??
      null,

    purpose: item?.purpose ?? "",
    notes: item?.notes ?? "",

    status:
      item?.status ??
      (item?.returned ? "Returned" : "Active"),

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
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active" || normalized === "assigned") {
    return "status-active";
  }

  if (normalized === "returned") {
    return "status-returned";
  }

  if (normalized === "overdue") {
    return "status-overdue";
  }

  return "status-default";
}

export default function AssetAssignment() {
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returningAssignment, setReturningAssignment] =
    useState(null);

  const [returnNotes, setReturnNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        assetsResponse,
        usersResponse,
        departmentsResponse,
        locationsResponse,
        assignmentsResponse,
      ] = await Promise.all([
        apiRequest(ASSETS_API),
        apiRequest(USERS_API),
        apiRequest(DEPARTMENTS_API),
        apiRequest(LOCATIONS_API),
        apiRequest(ASSIGNMENTS_API),
      ]);

      const loadedAssets = extractArray(assetsResponse, [
        "assets",
      ]).map(normalizeAsset);

      const loadedUsers = extractArray(usersResponse, [
        "users",
      ]).map(normalizeUser);

      const loadedDepartments = extractArray(departmentsResponse, [
        "departments",
      ]).map(normalizeDepartment);

      const loadedLocations = extractArray(locationsResponse, [
        "locations",
      ]).map(normalizeLocation);

      const loadedAssignments = extractArray(assignmentsResponse, [
        "assignments",
      ]).map(normalizeAssignment);

      setAssets(loadedAssets);
      setUsers(loadedUsers);
      setDepartments(loadedDepartments);
      setLocations(loadedLocations);
      setAssignments(loadedAssignments);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load asset assignment information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const assignedAssetIds = useMemo(() => {
    return new Set(
      assignments
        .filter((assignment) => {
          const status = String(
            assignment.status || ""
          ).toLowerCase();

          return (
            status === "active" ||
            status === "assigned"
          );
        })
        .map((assignment) => String(assignment.assetId))
    );
  }, [assignments]);

  const availableAssets = useMemo(() => {
    return assets.filter((asset) => {
      const assetStatus = String(
        asset.status || ""
      ).toLowerCase();

      const isCurrentlyAssigned = assignedAssetIds.has(
        String(asset.assetId || asset.id)
      );

      if (
        editingAssignment &&
        String(asset.assetId || asset.id) ===
          String(editingAssignment.assetId)
      ) {
        return true;
      }

      return (
        !isCurrentlyAssigned &&
        assetStatus !== "retired" &&
        assetStatus !== "disposed" &&
        assetStatus !== "maintenance"
      );
    });
  }, [assets, assignedAssetIds, editingAssignment]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesSearch =
        !query ||
        String(assignment.assetId)
          .toLowerCase()
          .includes(query) ||
        assignment.assetName
          .toLowerCase()
          .includes(query) ||
        assignment.serialNumber
          .toLowerCase()
          .includes(query) ||
        assignment.assigneeName
          .toLowerCase()
          .includes(query) ||
        assignment.departmentName
          .toLowerCase()
          .includes(query) ||
        assignment.locationName
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(assignment.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [assignments, search, statusFilter]);

  const activeAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const status = String(
          assignment.status || ""
        ).toLowerCase();

        return status === "active" || status === "assigned";
      }).length,
    [assignments]
  );

  const returnedAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          String(assignment.status || "").toLowerCase() ===
          "returned"
      ).length,
    [assignments]
  );

  const overdueAssignments = useMemo(() => {
    const today = new Date();

    return assignments.filter((assignment) => {
      const status = String(
        assignment.status || ""
      ).toLowerCase();

      if (
        status === "returned" ||
        !assignment.expectedReturnDate
      ) {
        return false;
      }

      const returnDate = new Date(
        assignment.expectedReturnDate
      );

      return (
        !Number.isNaN(returnDate.getTime()) &&
        returnDate < today
      );
    }).length;
  }, [assignments]);

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingAssignment(null);

    setForm({
      ...EMPTY_FORM,
      assignedDate: new Date().toISOString().slice(0, 10),
    });

    setError("");
    setShowForm(true);
  };

  const openEditForm = (assignment) => {
    setEditingAssignment(assignment);

    setForm({
      assetId: assignment.assetId || "",
      assigneeId: assignment.assigneeId || "",
      departmentId: assignment.departmentId || "",
      locationId: assignment.locationId || "",
      assignedDate: assignment.assignedDate
        ? new Date(assignment.assignedDate)
            .toISOString()
            .slice(0, 10)
        : "",
      expectedReturnDate: assignment.expectedReturnDate
        ? new Date(assignment.expectedReturnDate)
            .toISOString()
            .slice(0, 10)
        : "",
      purpose: assignment.purpose || "",
      notes: assignment.notes || "",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingAssignment(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      setError("Please select an asset.");
      return;
    }

    if (!form.assigneeId && !form.departmentId) {
      setError(
        "Select at least a user or department for the assignment."
      );
      return;
    }

    if (!form.assignedDate) {
      setError("Assigned date is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        assetId: form.assetId,
        assigneeId: form.assigneeId || null,
        userId: form.assigneeId || null,
        departmentId: form.departmentId || null,
        locationId: form.locationId || null,
        assignedDate: form.assignedDate,
        expectedReturnDate:
          form.expectedReturnDate || null,
        purpose: form.purpose.trim(),
        notes: form.notes.trim(),
      };

      if (editingAssignment) {
        await apiRequest(
          `${ASSIGNMENTS_API}/${encodeURIComponent(
            editingAssignment.id
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(ASSIGNMENTS_API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message || "Unable to save the asset assignment."
      );
    } finally {
      setSaving(false);
    }
  };

  const openReturnModal = (assignment) => {
    setReturningAssignment(assignment);
    setReturnNotes("");
    setError("");
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setReturningAssignment(null);
    setReturnNotes("");
  };

  const returnAsset = async () => {
    if (!returningAssignment) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${ASSIGNMENTS_API}/${encodeURIComponent(
          returningAssignment.id
        )}/return`,
        {
          method: "POST",
          body: JSON.stringify({
            returnDate: new Date()
              .toISOString()
              .slice(0, 10),
            notes: returnNotes.trim(),
          }),
        }
      );

      closeReturnModal();
      await loadData();
    } catch (err) {
      setError(
        err.message || "Unable to return the assigned asset."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="asset-assignment-page">
      <style>{`
        .asset-assignment-page {
          min-height: 100%;
          background: #f3f6f9;
          padding: 24px;
          color: #111827;
          box-sizing: border-box;
        }

        .assignment-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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

        .assignment-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .assignment-table th {
          padding: 13px 15px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .assignment-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .assignment-table tr:last-child td {
          border-bottom: 0;
        }

        .asset-id {
          color: #1d4ed8;
          font-weight: 700;
        }

        .asset-name {
          font-weight: 600;
          color: #111827;
        }

        .secondary-text {
          color: #64748b;
          margin-top: 3px;
          font-size: 12px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-active {
          background: #dcfce7;
          color: #166534;
        }

        .status-returned {
          background: #e2e8f0;
          color: #475569;
        }

        .status-overdue {
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

        .action-button.return {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #166534;
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
          width: min(680px, 100%);
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

        .required {
          color: #dc2626;
        }

        @media (max-width: 950px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .asset-assignment-page {
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
        }
      `}</style>

      <div className="assignment-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Asset Assignment
            </h1>

            <p className="page-subtitle">
              Assign university assets to users, departments, and
              locations and monitor their current responsibility.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Assign Asset
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
              Total Assignments
            </div>
            <div className="summary-value">
              {assignments.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active Assignments
            </div>
            <div className="summary-value">
              {activeAssignments}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Returned Assets
            </div>
            <div className="summary-value">
              {returnedAssignments}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Overdue Returns
            </div>
            <div
              className="summary-value"
              style={{
                color:
                  overdueAssignments > 0
                    ? "#b91c1c"
                    : "#111827",
              }}
            >
              {overdueAssignments}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search asset, user, department or location..."
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
            <option value="Active">Active</option>
            <option value="Assigned">Assigned</option>
            <option value="Returned">Returned</option>
            <option value="Overdue">Overdue</option>
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
              Loading assignment records...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                📋
              </div>

              <strong>
                {search || statusFilter !== "All"
                  ? "No matching assignments"
                  : "No asset assignments found"}
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                {search || statusFilter !== "All"
                  ? "Try changing your search or filter."
                  : "Create an assignment to start tracking asset responsibility."}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Assigned To</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Assigned Date</th>
                    <th>Expected Return</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAssignments.map((assignment) => {
                    const isOverdue =
                      assignment.expectedReturnDate &&
                      String(
                        assignment.status
                      ).toLowerCase() !== "returned" &&
                      new Date(
                        assignment.expectedReturnDate
                      ) < new Date();

                    const displayStatus = isOverdue
                      ? "Overdue"
                      : assignment.status;

                    return (
                      <tr key={assignment.id}>
                        <td>
                          <div className="asset-id">
                            {assignment.assetId || "—"}
                          </div>

                          <div className="asset-name">
                            {assignment.assetName ||
                              "Unnamed Asset"}
                          </div>

                          {assignment.serialNumber && (
                            <div className="secondary-text">
                              SN: {assignment.serialNumber}
                            </div>
                          )}
                        </td>

                        <td>
                          <div>
                            {assignment.assigneeName || "—"}
                          </div>
                        </td>

                        <td>
                          {assignment.departmentName || "—"}
                        </td>

                        <td>
                          {assignment.locationName || "—"}
                        </td>

                        <td>
                          {formatDate(
                            assignment.assignedDate
                          )}
                        </td>

                        <td>
                          {formatDate(
                            assignment.expectedReturnDate
                          )}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${statusClass(
                              displayStatus
                            )}`}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="action-button primary"
                              onClick={() =>
                                openEditForm(assignment)
                              }
                            >
                              Edit
                            </button>

                            {String(
                              assignment.status
                            ).toLowerCase() !== "returned" && (
                              <button
                                type="button"
                                className="action-button return"
                                onClick={() =>
                                  openReturnModal(
                                    assignment
                                  )
                                }
                              >
                                Return
                              </button>
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
          Showing {filteredAssignments.length} of{" "}
          {assignments.length} assignment records
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
                {editingAssignment
                  ? "Edit Asset Assignment"
                  : "Assign Asset"}
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
                  Asset <span className="required">*</span>
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
                      value={asset.assetId || asset.id}
                    >
                      {asset.assetId || asset.id} —{" "}
                      {asset.name || "Unnamed Asset"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Assign To User
                  </label>

                  <select
                    name="assigneeId"
                    className="form-input"
                    value={form.assigneeId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select user
                    </option>

                    {users.map((user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name}
                        {user.email
                          ? ` — ${user.email}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Department
                  </label>

                  <select
                    name="departmentId"
                    className="form-input"
                    value={form.departmentId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select department
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
                    Location
                  </label>

                  <select
                    name="locationId"
                    className="form-input"
                    value={form.locationId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select location
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
                    Assigned Date{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    type="date"
                    name="assignedDate"
                    className="form-input"
                    value={form.assignedDate}
                    onChange={updateForm}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Expected Return Date
                </label>

                <input
                  type="date"
                  name="expectedReturnDate"
                  className="form-input"
                  value={form.expectedReturnDate}
                  onChange={updateForm}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Purpose
                </label>

                <input
                  type="text"
                  name="purpose"
                  className="form-input"
                  value={form.purpose}
                  onChange={updateForm}
                  placeholder="Reason for assigning the asset"
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
                  placeholder="Additional assignment notes..."
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
                    : editingAssignment
                    ? "Save Changes"
                    : "Assign Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturnModal && returningAssignment && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReturnModal();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Return Assigned Asset
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeReturnModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <div className="form">
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <strong>
                  {returningAssignment.assetId}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  {returningAssignment.assetName}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  Currently assigned to:{" "}
                  {returningAssignment.assigneeName ||
                    "—"}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Return Notes
                </label>

                <textarea
                  className="form-textarea"
                  value={returnNotes}
                  onChange={(event) =>
                    setReturnNotes(event.target.value)
                  }
                  placeholder="Record the condition or other return information..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeReturnModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={returnAsset}
                disabled={saving}
              >
                {saving ? "Processing..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}