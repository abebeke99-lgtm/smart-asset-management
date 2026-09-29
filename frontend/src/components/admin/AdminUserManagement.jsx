import React, { useEffect, useMemo, useState } from "react";

const USERS_API = "/api/users";
const ROLES_API = "/api/roles";
const COLLEGES_API = "/api/colleges";
const DEPARTMENTS_API = "/api/departments";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
  collegeId: "",
  departmentId: "",
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

function normalizeUser(item, index) {
  return {
    id:
      item?.id ??
      item?.userId ??
      item?._id ??
      `user-${index}`,

    name:
      item?.name ??
      item?.fullName ??
      [item?.firstName, item?.lastName]
        .filter(Boolean)
        .join(" ") ??
      "",

    firstName: item?.firstName ?? "",
    lastName: item?.lastName ?? "",

    email:
      item?.email ??
      item?.emailAddress ??
      "",

    phone:
      item?.phone ??
      item?.phoneNumber ??
      "",

    roleId:
      item?.roleId ??
      item?.role?.id ??
      "",

    roleName:
      item?.roleName ??
      item?.role?.name ??
      item?.role ??
      "",

    collegeId:
      item?.collegeId ??
      item?.college?.id ??
      "",

    collegeName:
      item?.collegeName ??
      item?.college?.name ??
      "",

    departmentId:
      item?.departmentId ??
      item?.department?.id ??
      "",

    departmentName:
      item?.departmentName ??
      item?.department?.name ??
      "",

    status:
      item?.status ??
      (item?.isActive === false
        ? "Inactive"
        : "Active"),

    createdAt:
      item?.createdAt ??
      item?.created_at ??
      null,

    lastLogin:
      item?.lastLogin ??
      item?.lastLoginAt ??
      null,

    raw: item,
  };
}

function normalizeOption(item, index) {
  return {
    id:
      item?.id ??
      item?.roleId ??
      item?.collegeId ??
      item?.departmentId ??
      item?._id ??
      `option-${index}`,

    name:
      item?.name ??
      item?.roleName ??
      item?.collegeName ??
      item?.departmentName ??
      "",
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
    value === "active" ||
    value === "enabled"
  ) {
    return "status-active";
  }

  if (
    value === "inactive" ||
    value === "disabled"
  ) {
    return "status-inactive";
  }

  if (value === "suspended") {
    return "status-suspended";
  }

  return "status-default";
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [roleFilter, setRoleFilter] =
    useState("All");

  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] =
    useState(null);

  const [editingUser, setEditingUser] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        usersResponse,
        rolesResponse,
        collegesResponse,
        departmentsResponse,
      ] = await Promise.all([
        apiRequest(USERS_API),
        apiRequest(ROLES_API),
        apiRequest(COLLEGES_API),
        apiRequest(DEPARTMENTS_API),
      ]);

      setUsers(
        extractArray(usersResponse, [
          "users",
        ]).map(normalizeUser)
      );

      setRoles(
        extractArray(rolesResponse, [
          "roles",
        ]).map(normalizeOption)
      );

      setColleges(
        extractArray(collegesResponse, [
          "colleges",
        ]).map(normalizeOption)
      );

      setDepartments(
        extractArray(departmentsResponse, [
          "departments",
        ]).map(normalizeOption)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeUsers = users.filter(
    (user) =>
      String(user.status).toLowerCase() ===
      "active"
  ).length;

  const inactiveUsers = users.filter(
    (user) =>
      String(user.status).toLowerCase() ===
      "inactive"
  ).length;

  const suspendedUsers = users.filter(
    (user) =>
      String(user.status).toLowerCase() ===
      "suspended"
  ).length;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name
          .toLowerCase()
          .includes(query) ||
        user.email
          .toLowerCase()
          .includes(query) ||
        user.phone
          .toLowerCase()
          .includes(query) ||
        user.roleName
          .toLowerCase()
          .includes(query) ||
        user.collegeName
          .toLowerCase()
          .includes(query) ||
        user.departmentName
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(user.status).toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesRole =
        roleFilter === "All" ||
        String(user.roleId) ===
          String(roleFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    });
  }, [
    users,
    search,
    statusFilter,
    roleFilter,
  ]);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.roleId || "",
      collegeId: user.collegeId || "",
      departmentId: user.departmentId || "",
      status: user.status || "Active",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveUser = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("User name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!form.roleId) {
      setError("Please select a role.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        roleId: form.roleId,
        collegeId: form.collegeId || null,
        departmentId:
          form.departmentId || null,
        status: form.status,
      };

      if (editingUser) {
        await apiRequest(
          `${USERS_API}/${encodeURIComponent(
            editingUser.id
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(USERS_API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save user."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const current =
      String(user.status).toLowerCase();

    const nextStatus =
      current === "active"
        ? "Inactive"
        : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Active" ? "Activate" : "Deactivate"} ${user.name}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${USERS_API}/${encodeURIComponent(
          user.id
        )}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update user status."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    const confirmed = window.confirm(
      `Delete user "${user.name}"? This action may be permanent.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${USERS_API}/${encodeURIComponent(
          user.id
        )}`,
        {
          method: "DELETE",
        }
      );

      if (
        selectedUser &&
        String(selectedUser.id) ===
          String(user.id)
      ) {
        setSelectedUser(null);
      }

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete user."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="users-page">
      <style>{`
        .users-page {
          min-height: 100%;
          padding: 24px;
          background: #f3f6f9;
          color: #111827;
          box-sizing: border-box;
        }

        .users-container {
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
        .form-input:focus {
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

        .users-table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        .users-table th {
          padding: 13px 15px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .users-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .users-table tr:last-child td {
          border-bottom: 0;
        }

        .user-name {
          font-weight: 700;
        }

        .user-email {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
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

        .status-suspended {
          background: #fee2e2;
          color: #991b1b;
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
          color: #334155;
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
          width: min(700px, 100%);
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

        .form-input {
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
          .users-page {
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

      <div className="users-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Users
            </h1>

            <p className="page-subtitle">
              Manage university users, roles,
              organizational assignments, and account
              status.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Add User
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
              Total Users
            </div>
            <div className="summary-value">
              {users.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active Users
            </div>
            <div className="summary-value">
              {activeUsers}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Inactive Users
            </div>
            <div className="summary-value">
              {inactiveUsers}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Suspended Users
            </div>
            <div className="summary-value">
              {suspendedUsers}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search name, email, phone, role, college..."
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
            <option value="Active">
              Active
            </option>
            <option value="Inactive">
              Inactive
            </option>
            <option value="Suspended">
              Suspended
            </option>
          </select>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value)
            }
          >
            <option value="All">
              All Roles
            </option>

            {roles.map((role) => (
              <option
                key={role.id}
                value={role.id}
              >
                {role.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadData}
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
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                👥
              </div>

              <strong>
                No users found
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
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>College</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-name">
                          {user.name ||
                            "Unnamed User"}
                        </div>

                        <div className="user-email">
                          {user.email || "—"}
                        </div>
                      </td>

                      <td>
                        {user.phone || "—"}
                      </td>

                      <td>
                        {user.roleName || "—"}
                      </td>

                      <td>
                        {user.collegeName || "—"}
                      </td>

                      <td>
                        {user.departmentName ||
                          "—"}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${statusClass(
                            user.status
                          )}`}
                        >
                          {user.status}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          user.lastLogin
                        )}
                      </td>

                      <td>
                        {formatDate(
                          user.createdAt
                        )}
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="action-button view"
                            onClick={() =>
                              setSelectedUser(
                                user
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
                                user
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={`action-button ${
                              String(
                                user.status
                              ).toLowerCase() ===
                              "active"
                                ? "deactivate"
                                : "activate"
                            }`}
                            onClick={() =>
                              toggleUserStatus(
                                user
                              )
                            }
                            disabled={saving}
                          >
                            {String(
                              user.status
                            ).toLowerCase() ===
                            "active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            className="action-button delete"
                            onClick={() =>
                              deleteUser(user)
                            }
                            disabled={saving}
                          >
                            Delete
                          </button>
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
          Showing {filteredUsers.length} of{" "}
          {users.length} users
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
                {editingUser
                  ? "Edit User"
                  : "Add User"}
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
              onSubmit={saveUser}
            >
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Full Name{" "}
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
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={form.email}
                    onChange={updateForm}
                    placeholder="user@university.edu"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
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

                <div className="form-group">
                  <label className="form-label">
                    Role{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    name="roleId"
                    className="form-input"
                    value={form.roleId}
                    onChange={updateForm}
                    required
                  >
                    <option value="">
                      Select role
                    </option>

                    {roles.map((role) => (
                      <option
                        key={role.id}
                        value={role.id}
                      >
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    College
                  </label>

                  <select
                    name="collegeId"
                    className="form-input"
                    value={form.collegeId}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select college
                    </option>

                    {colleges.map(
                      (college) => (
                        <option
                          key={college.id}
                          value={college.id}
                        >
                          {college.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Department
                  </label>

                  <select
                    name="departmentId"
                    className="form-input"
                    value={
                      form.departmentId
                    }
                    onChange={updateForm}
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(
                      (department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Account Status
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

                  <option value="Suspended">
                    Suspended
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
                    : editingUser
                    ? "Save Changes"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedUser(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                User Details
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setSelectedUser(null)
                }
              >
                ×
              </button>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">
                  Name
                </div>

                <div className="detail-value">
                  {selectedUser.name ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Status
                </div>

                <div className="detail-value">
                  {selectedUser.status ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Email
                </div>

                <div className="detail-value">
                  {selectedUser.email ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Phone
                </div>

                <div className="detail-value">
                  {selectedUser.phone ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Role
                </div>

                <div className="detail-value">
                  {selectedUser.roleName ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  College
                </div>

                <div className="detail-value">
                  {selectedUser.collegeName ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Department
                </div>

                <div className="detail-value">
                  {selectedUser.departmentName ||
                    "—"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Last Login
                </div>

                <div className="detail-value">
                  {formatDate(
                    selectedUser.lastLogin
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Created
                </div>

                <div className="detail-value">
                  {formatDate(
                    selectedUser.createdAt
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSelectedUser(null)
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