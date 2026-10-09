import React, { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../utils/api";

const COLLEGES_API = `${apiBase()}/api/admin/colleges`;
const CAMPUSES_API = `${apiBase()}/api/locations/campuses`;

const EMPTY_FORM = {
  name: "",
  code: "",
  campusId: "",
  description: "",
  dean: "",
  phone: "",
  email: "",
  location: "",
  status: "Active",
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

function extractArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.colleges)) {
    return data.colleges;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  return [];
}

function normalizeCollege(item, index) {
  return {
    id:
      item?.id ??
      item?.collegeId ??
      item?._id ??
      `college-${index}`,

    name:
      item?.name ??
      item?.collegeName ??
      "",

    code:
      item?.code ??
      item?.collegeCode ??
      "",
    campusId: item?.campusId ?? item?.campus_id ?? "",

    description:
      item?.description ??
      "",

    dean:
      item?.dean ??
      item?.deanName ??
      "",

    phone:
      item?.phone ??
      item?.phoneNumber ??
      "",

    email:
      item?.email ??
      "",

    location:
      item?.location ??
      "",

    status:
      item?.status ??
      (item?.isActive === false
        ? "Inactive"
        : "Active"),

    departmentCount:
      item?.departmentCount ??
      item?.departmentsCount ??
      item?.departments?.length ??
      0,

    assetCount:
      item?.assetCount ??
      item?.assetsCount ??
      0,

    createdAt:
      item?.createdAt ??
      item?.created_at ??
      null,

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

export default function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [campuses, setCampuses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [showForm, setShowForm] = useState(false);
  const [selectedCollege, setSelectedCollege] =
    useState(null);
  const [editingCollege, setEditingCollege] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadColleges = async () => {
    setLoading(true);
    setError("");

    try {
      const [response, campusResponse] = await Promise.all([
        apiRequest(`${COLLEGES_API}?limit=100`),
        apiRequest(`${CAMPUSES_API}?status=active&limit=500`),
      ]);

      setColleges(
        extractArray(response).map(
          normalizeCollege
        )
      );
      setCampuses(extractArray(campusResponse).filter((campus) => String(campus.status || "active").toLowerCase() === "active"));
    } catch (err) {
      setError(
        err.message ||
          "Unable to load colleges."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadColleges();
  }, []);

  const filteredColleges = useMemo(() => {
    const query = search.trim().toLowerCase();

    return colleges.filter((college) => {
      const matchesSearch =
        !query ||
        college.name
          .toLowerCase()
          .includes(query) ||
        college.code
          .toLowerCase()
          .includes(query) ||
        college.dean
          .toLowerCase()
          .includes(query) ||
        college.email
          .toLowerCase()
          .includes(query) ||
        college.location
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(college.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    colleges,
    search,
    statusFilter,
  ]);

  const activeCount = colleges.filter(
    (college) =>
      String(college.status).toLowerCase() ===
      "active"
  ).length;

  const inactiveCount = colleges.filter(
    (college) =>
      String(college.status).toLowerCase() ===
      "inactive"
  ).length;

  const totalDepartments = colleges.reduce(
    (total, college) =>
      total +
      Number(college.departmentCount || 0),
    0
  );

  const totalAssets = colleges.reduce(
    (total, college) =>
      total +
      Number(college.assetCount || 0),
    0
  );

  const openCreateForm = () => {
    setEditingCollege(null);
    setForm({
      ...EMPTY_FORM,
    });
    setError("");
    setShowForm(true);
  };

  const openEditForm = (college) => {
    setEditingCollege(college);

    setForm({
      name: college.name || "",
      code: college.code || "",
      campusId: college.campusId || "",
      description:
        college.description || "",
      dean: college.dean || "",
      phone: college.phone || "",
      email: college.email || "",
      location: college.location || "",
      status: college.status || "Active",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingCollege(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveCollege = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("College name is required.");
      return;
    }

    if (!form.code.trim()) {
      setError("College code is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        campusId: form.campusId ? Number(form.campusId) : null,
        description:
          form.description.trim(),
        dean: form.dean.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        status: form.status,
      };

      if (editingCollege) {
        await apiRequest(
          `${COLLEGES_API}/${encodeURIComponent(
            editingCollege.id
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(COLLEGES_API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await loadColleges();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save college."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (college) => {
    const current =
      String(college.status).toLowerCase();

    const nextStatus =
      current === "active"
        ? "Inactive"
        : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Active" ? "Activate" : "Deactivate"} "${college.name}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${COLLEGES_API}/${encodeURIComponent(
          college.id
        )}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      await loadColleges();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update college status."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCollege = async (college) => {
    if (Number(college.departmentCount) > 0) {
      window.alert(
        "This college has departments assigned to it. Remove or reassign those departments before deleting the college."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete college "${college.name}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${COLLEGES_API}/${encodeURIComponent(
          college.id
        )}`,
        {
          method: "DELETE",
        }
      );

      if (
        selectedCollege &&
        String(selectedCollege.id) ===
          String(college.id)
      ) {
        setSelectedCollege(null);
      }

      await loadColleges();
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete college."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="colleges-page">
      <style>{`
        .colleges-page {
          min-height: 100%;
          padding: 24px;
          background: #f3f6f9;
          color: #111827;
          box-sizing: border-box;
        }

        .colleges-container {
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

        .primary-button:disabled,
        .secondary-button:disabled,
        .action-button:disabled {
          opacity: .55;
          cursor: not-allowed;
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
          margin-bottom: 8px;
          color: #64748b;
          font-size: 13px;
        }

        .summary-value {
          font-size: 26px;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
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
          min-width: 260px;
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
          padding: 10px 14px;
          background: #fff;
          color: #334155;
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

        .colleges-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .colleges-table th {
          padding: 13px 15px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .colleges-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .colleges-table tr:last-child td {
          border-bottom: 0;
        }

        .college-name {
          font-weight: 700;
        }

        .college-description {
          max-width: 300px;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .code-badge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-active {
          background: #dcfce7;
          color: #166534;
        }

        .status-inactive {
          background: #f1f5f9;
          color: #475569;
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
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .action-button.edit {
          background: #f8fafc;
        }

        .action-button.activate {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #166534;
        }

        .action-button.deactivate {
          background: #fff7ed;
          border-color: #fed7aa;
          color: #9a3412;
        }

        .action-button.delete {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
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

        .loading-state,
        .empty-state {
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
          width: min(760px, 100%);
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
          min-height: 90px;
          resize: vertical;
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

        @media (max-width: 950px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .colleges-page {
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

      <div className="colleges-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Colleges
            </h1>

            <p className="page-subtitle">
              Manage university colleges and their
              organizational information.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Add College
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
              Total Colleges
            </div>

            <div className="summary-value">
              {colleges.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active Colleges
            </div>

            <div className="summary-value">
              {activeCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Departments
            </div>

            <div className="summary-value">
              {totalDepartments}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Assets
            </div>

            <div className="summary-value">
              {totalAssets}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search college, code, dean, email, location..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Statuses
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>
          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadColleges}
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading colleges...
            </div>
          ) : filteredColleges.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                🏛️
              </div>

              <strong>
                No colleges found
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                Try changing your search or filters.
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="colleges-table">
                <thead>
                  <tr>
                    <th>College</th>
                    <th>Code</th>
                    <th>Dean</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Departments</th>
                    <th>Assets</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredColleges.map(
                    (college) => (
                      <tr
                        key={college.id}
                      >
                        <td>
                          <div className="college-name">
                            {college.name ||
                              "Unnamed College"}
                          </div>

                          <div className="college-description">
                            {college.description ||
                              "No description"}
                          </div>
                        </td>

                        <td>
                          <span className="code-badge">
                            {college.code ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          {college.dean || "—"}
                        </td>

                        <td>
                          <div>
                            {college.email ||
                              "—"}
                          </div>

                          <div
                            style={{
                              marginTop: 3,
                              color: "#64748b",
                              fontSize: 12,
                            }}
                          >
                            {college.phone ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          {college.location ||
                            "—"}
                        </td>

                        <td>
                          {college.departmentCount}
                        </td>

                        <td>
                          {college.assetCount}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${
                              String(
                                college.status
                              ).toLowerCase() ===
                              "active"
                                ? "status-active"
                                : "status-inactive"
                            }`}
                          >
                            {college.status}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="action-button view"
                              onClick={() =>
                                setSelectedCollege(
                                  college
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="action-button edit"
                              onClick={() =>
                                openEditForm(
                                  college
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={`action-button ${
                                String(
                                  college.status
                                ).toLowerCase() ===
                                "active"
                                  ? "deactivate"
                                  : "activate"
                              }`}
                              onClick={() =>
                                toggleStatus(
                                  college
                                )
                              }
                              disabled={saving}
                            >
                              {String(
                                college.status
                              ).toLowerCase() ===
                              "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            <button
                              type="button"
                              className="action-button delete"
                              onClick={() =>
                                deleteCollege(
                                  college
                                )
                              }
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
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
          Showing {filteredColleges.length} of{" "}
          {colleges.length} colleges ·{" "}
          {inactiveCount} inactive
        </div>
      </div>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCollege
                  ? "Edit College"
                  : "Add College"}
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
              onSubmit={saveCollege}
            >
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Campus</label>
                  <select
                    name="campusId"
                    className="form-input"
                    value={form.campusId}
                    onChange={updateForm}
                  >
                    <option value="">Campus not mapped</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.campusName || campus.campus_name || campus.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    College Name{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Enter college name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    College Code{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    name="code"
                    className="form-input"
                    value={form.code}
                    onChange={updateForm}
                    placeholder="e.g. CSE"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Dean
                  </label>

                  <input
                    type="text"
                    name="dean"
                    className="form-input"
                    value={form.dean}
                    onChange={updateForm}
                    placeholder="Dean name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Phone
                  </label>

                  <input
                    type="text"
                    name="phone"
                    className="form-input"
                    value={form.phone}
                    onChange={updateForm}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={form.email}
                    onChange={updateForm}
                    placeholder="college@university.edu"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Location
                  </label>

                  <input
                    type="text"
                    name="location"
                    className="form-input"
                    value={form.location}
                    onChange={updateForm}
                    placeholder="Campus or location"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Description
                </label>

                <textarea
                  name="description"
                  className="form-textarea"
                  value={form.description}
                  onChange={updateForm}
                  placeholder="Describe the college."
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Status
                </label>

                <select
                  name="status"
                  className="form-input"
                  value={form.status}
                  onChange={updateForm}
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>
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
                    : editingCollege
                    ? "Save Changes"
                    : "Create College"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCollege && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedCollege(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                College Details
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setSelectedCollege(null)
                }
              >
                ×
              </button>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">
                  College
                </div>

                <div className="detail-value">
                  {selectedCollege.name ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Code
                </div>

                <div className="detail-value">
                  {selectedCollege.code ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Dean
                </div>

                <div className="detail-value">
                  {selectedCollege.dean ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Status
                </div>

                <div className="detail-value">
                  {selectedCollege.status ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Email
                </div>

                <div className="detail-value">
                  {selectedCollege.email ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Phone
                </div>

                <div className="detail-value">
                  {selectedCollege.phone ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Location
                </div>

                <div className="detail-value">
                  {selectedCollege.location ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Created
                </div>

                <div className="detail-value">
                  {formatDate(
                    selectedCollege.createdAt
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Departments
                </div>

                <div className="detail-value">
                  {
                    selectedCollege.departmentCount
                  }
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Assets
                </div>

                <div className="detail-value">
                  {selectedCollege.assetCount}
                </div>
              </div>

              <div className="detail-item detail-full">
                <div className="detail-label">
                  Description
                </div>

                <div className="detail-value">
                  {selectedCollege.description ||
                    "No description"}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSelectedCollege(null)
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