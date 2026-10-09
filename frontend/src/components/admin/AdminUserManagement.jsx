import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Eye, EyeOff, KeyRound, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";

const USERS_API = "/api/users";
const COLLEGES_API = "/api/colleges";

const EMPTY_FORM = {
  name: "",
  username: "",
  email: "",
  phone: "",
  roleId: "",
  collegeId: "",
  departmentId: "",
  status: "Active",
  password: "",
  confirmPassword: "",
};

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await apiClient.request({
      url,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });
  } catch (error) {
    console.error("User management API request failed", {
      url,
      method: options.method || "GET",
      status: error.response?.status || 0,
      code: error.code || "",
    });
    throw new Error(getApiErrorMessage(error, error.message || "Unable to complete the user management request."));
  }
  if (response.data?.success === false) {
    throw new Error(response.data.message || "Unable to complete the user management request.");
  }
  return response.data;
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
      item?.role ??
      "",

    roleName:
      item?.roleName ??
      item?.role?.name ??
      (typeof item?.role === "string"
        ? item.role.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
        : "") ??
      "",

    collegeId:
      item?.collegeId ??
      item?.college?.id ??
      "",

    collegeName:
      item?.collegeName ??
      item?.College?.collegeName ??
      item?.college?.collegeName ??
      item?.college?.name ??
      "",

    departmentId:
      item?.departmentId ??
      item?.department?.id ??
      "",

    departmentName:
      item?.departmentName ??
      item?.DepartmentRecord?.name ??
      item?.department?.name ??
      "",

    status:
      item?.status ??
      (item?.active === false || item?.isActive === false ? "inactive" : "active"),

    createdAt:
      item?.createdAt ??
      item?.created_at ??
      null,

    lastLogin:
      item?.lastLogin ??
      item?.lastLoginAt ??
      item?.last_login ??
      null,

    raw: item,
  };
}


function normalizeOption(item, index) {
  return {
    id:
      item?.id ??
      item?.collegeId ??
      item?.departmentId ??
      item?._id ??
      `option-${index}`,

    name:
      item?.name ??
      item?.collegeName ??
      item?.departmentName ??
      item?.displayName ??
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

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, suspended: 0 });
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const saveInProgress = useRef(false);

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [showConfirmTemporaryPassword, setShowConfirmTemporaryPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [activityUser, setActivityUser] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadData = useCallback(async (requestedPage = page) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        limit: "10",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "All") params.set("status", statusFilter.toLowerCase());
      if (roleFilter !== "All") params.set("role", roleFilter);
      const [usersResponse, statsResponse, collegesResponse, rolesResponse] = await Promise.all([
        apiRequest(`${USERS_API}?${params.toString()}`),
        apiRequest(`${USERS_API}/stats`),
        apiRequest(`${COLLEGES_API}?limit=100`),
        apiRequest("/api/roles"),
      ]);

      const userRows = extractArray(usersResponse, ["users"]).map(normalizeUser);
      setUsers(userRows);
      setStats(statsResponse?.data || { total: 0, active: 0, inactive: 0, suspended: 0 });
      setTotalUsers(Number(usersResponse?.pagination?.total ?? usersResponse?.total ?? userRows.length));
      const pages = Math.max(1, Number(usersResponse?.pagination?.pages || 1));
      setPageCount(pages);
      if (requestedPage > pages) setPage(pages);
      setRoles(extractArray(rolesResponse, ["roles"]).map((item, index) => ({
        id: item?.name ?? item?.role ?? `role-${index}`,
        name: item?.displayName ?? item?.name ?? item?.role ?? "",
      })));
      setColleges(extractArray(collegesResponse, ["colleges"]).map(normalizeOption));
    } catch (err) {
      setError(
        err.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, roleFilter, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  useEffect(() => {
    if (!showForm || !form.collegeId) {
      setDepartments([]);
      setDepartmentsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDepartmentsLoading(true);
    apiRequest(`${COLLEGES_API}/${encodeURIComponent(form.collegeId)}/departments`)
      .then((response) => {
        if (!cancelled) setDepartments(extractArray(response, ["departments"]).map(normalizeOption));
      })
      .catch((requestError) => {
        if (!cancelled) {
          setDepartments([]);
          setFieldErrors((previous) => ({ ...previous, departmentId: requestError.message || "Unable to load departments." }));
        }
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [showForm, form.collegeId]);

  const filteredUsers = useMemo(() => users, [users]);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setFieldErrors({});

    setForm({
      name: user.name || "",
      username: user.raw?.username || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.roleId || "",
      collegeId: user.collegeId || "",
      departmentId: user.departmentId || "",
      status: user.status || "Active",
      password: "",
      confirmPassword: "",
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setShowForm(true);
  };

  const closeForm = (force = false) => {
    if (saving && !force) return;

    setShowForm(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
  };

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "collegeId" ? { departmentId: "" } : {}),
    }));
    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
      ...(name === "collegeId" ? { departmentId: "" } : {}),
    }));
    setError("");
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (saveInProgress.current) return;
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Full name is required.";
    if (!form.username.trim()) nextErrors.username = "Username is required.";
    else if (form.username.trim().length < 3) nextErrors.username = "Username must be at least 3 characters.";
    else if (form.username.trim().length > 100) nextErrors.username = "Username must be 100 characters or fewer.";
    if (!form.roleId) nextErrors.roleId = "Role is required.";
    if (!editingUser && !form.password) nextErrors.password = "Password is required.";
    if (form.password || form.confirmPassword) {
      if (form.password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
      else if (!/[A-Z]/.test(form.password)) nextErrors.password = "Password must contain an uppercase letter.";
      else if (!/[a-z]/.test(form.password)) nextErrors.password = "Password must contain a lowercase letter.";
      else if (!/\d/.test(form.password)) nextErrors.password = "Password must contain a number.";
      else if (!/[^A-Za-z0-9]/.test(form.password)) nextErrors.password = "Password must contain a special character.";
    }
    if ((form.password || form.confirmPassword) && form.password !== form.confirmPassword) nextErrors.confirmPassword = "Password and Confirm Password must match.";
    if (form.email && form.email.length > 255) nextErrors.email = "Email must be 255 characters or fewer.";
    else if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (form.phone.trim() && (!/^\+?[\d\s().-]+$/.test(form.phone.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15)) nextErrors.phone = "Enter a valid phone number.";
    if (Object.values(nextErrors).some(Boolean)) {
      setFieldErrors(nextErrors);
      toast.error("Please correct the highlighted fields.");
      return;
    }

    saveInProgress.current = true;
    setSaving(true);
    setError("");

    try {
      const payload = {
        fullName: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim(),
        role: form.roleId,
        collegeId: form.collegeId || null,
        departmentId: form.departmentId || null,
        status: form.status.toLowerCase(),
      };

      if (form.password) {
        payload.password = form.password;
        payload.confirmPassword = form.confirmPassword;
      }

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

      closeForm(true);
      toast.success(editingUser ? "User updated successfully." : "User created successfully.");
      await loadData();
    } catch (err) {
      const message = err.message || "Unable to save user.";
      const key = /username/i.test(message) ? "username" : /email/i.test(message) ? "email" : /phone/i.test(message) ? "phone" : /role/i.test(message) ? "roleId" : "";
      if (key) setFieldErrors({ [key]: message });
      setError(message);
      toast.error(message);
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const current =
      String(user.status).toLowerCase();

    const nextStatus = current === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} ${user.name}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`${USERS_API}/${encodeURIComponent(user.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      await loadData();
      toast.success(`User ${nextStatus} successfully.`);
    } catch (err) {
      toast.error(err.message || "Unable to update user status.");
    } finally {
      setSaving(false);
    }
  };

  const openResetPassword = (user) => {
    setResettingUser(user);
    setTemporaryPassword("");
    setConfirmTemporaryPassword("");
    setShowTemporaryPassword(false);
    setShowConfirmTemporaryPassword(false);
    setResetError("");
  };

  const closeResetPassword = (force = false) => {
    if (saving && !force) return;
    setResettingUser(null);
    setTemporaryPassword("");
    setConfirmTemporaryPassword("");
    setShowTemporaryPassword(false);
    setShowConfirmTemporaryPassword(false);
  };

  const resetUserPassword = async (event) => {
    event.preventDefault();
    if (!temporaryPassword) {
      setResetError("Temporary password is required.");
      return;
    }
    if (temporaryPassword.length < 8) {
      setResetError("Temporary password must be at least 8 characters.");
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      setResetError("Temporary passwords must match.");
      return;
    }

    setSaving(true);
    setResetError("");
    try {
      await apiRequest(
        `${USERS_API}/${encodeURIComponent(resettingUser.id)}/reset-password`,
        { method: "POST", body: JSON.stringify({ password: temporaryPassword, confirmPassword: confirmTemporaryPassword }) }
      );
      closeResetPassword(true);
      toast.success("Password reset successfully.");
      await loadData();
    } catch (err) {
      setResetError(err.message || "Unable to reset user password.");
      toast.error(err.message || "Unable to reset user password.");
    } finally {
      setSaving(false);
    }
  };

  const viewUserActivity = async (user) => {
    setActivityUser(user);
    setActivityLogs([]);
    setActivityError("");
    setActivityLoading(true);
    try {
      const response = await apiRequest(`${USERS_API}/${encodeURIComponent(user.id)}/activity`);
      setActivityLogs(extractArray(response, ["logs"]));
    } catch (err) {
      setActivityError(err.message || "Unable to load user activity.");
      toast.error(err.message || "Unable to load user activity.");
    } finally {
      setActivityLoading(false);
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
      toast.success("User deleted successfully.");
    } catch (err) {
      toast.error(err.message || "Unable to delete user.");
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
          background: #3074B3;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #245783;
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
          border-color: #3074B3;
          box-shadow: 0 0 0 3px rgba(48, 116, 179, .1);
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
          background: #F5F7FA;
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
          background: #EAF2FA;
          color: #245783;
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: nowrap;
          gap: 4px;
        }

        .actions .action-button {
          display: grid;
          flex: 0 0 30px;
          width: 30px;
          height: 30px;
          padding: 0;
          place-items: center;
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
          background: #EAF2FA;
          border-color: #bfdbfe;
          color: #245783;
        }

        .action-button.edit {
          background: #F5F7FA;
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

        .field-error {
          margin-top: 5px;
          color: #b91c1c;
          font-size: 12px;
        }

        .form-input.invalid {
          border-color: #dc2626;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
        }

        .pagination-controls {
          display: flex;
          gap: 8px;
        }

        .pagination-button {
          padding: 7px 11px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: white;
          color: #334155;
          cursor: pointer;
        }

        .pagination-button:disabled {
          opacity: .5;
          cursor: not-allowed;
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

        .password-field {
          position: relative;
        }

        .password-field .form-input {
          padding-right: 44px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 7px;
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 0;
          border-radius: 6px;
          color: #64748b;
          background: transparent;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .password-toggle:hover {
          color: #245783;
          background: #EAF2FA;
        }

        .password-toggle:focus-visible {
          outline: 2px solid #3074B3;
          outline-offset: 1px;
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

          .pagination {
            align-items: flex-start;
            flex-direction: column;
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

        {error && !showForm && (
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
              {stats.total}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active Users
            </div>
            <div className="summary-value">
              {stats.active}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Inactive Users
            </div>
            <div className="summary-value">
              {stats.inactive}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Suspended Users
            </div>
            <div className="summary-value">
              {stats.suspended}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search name, email, phone, role, college..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
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
            onClick={() => loadData(page)}
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
                          {String(user.status).charAt(0).toUpperCase() + String(user.status).slice(1)}
                        </span>
                      </td>

                      <td>
                        {formatDateTime(
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
                          <button type="button" className="action-button view" onClick={() => setSelectedUser(user)} title="View user" aria-label={`View ${user.name}`}><Eye size={15} /></button>
                          <button type="button" className="action-button edit" onClick={() => openEditForm(user)} title="Edit user" aria-label={`Edit ${user.name}`}><Pencil size={15} /></button>
                          <button type="button" className="action-button edit" onClick={() => openResetPassword(user)} disabled={saving} title="Reset password" aria-label={`Reset password for ${user.name}`}><KeyRound size={15} /></button>
                          <button type="button" className="action-button view" onClick={() => viewUserActivity(user)} title="View activity" aria-label={`View activity for ${user.name}`}><Activity size={15} /></button>
                          <button type="button" className={`action-button ${String(user.status).toLowerCase() === "active" ? "deactivate" : "activate"}`} onClick={() => toggleUserStatus(user)} disabled={saving} title={String(user.status).toLowerCase() === "active" ? "Deactivate user" : "Activate user"} aria-label={`${String(user.status).toLowerCase() === "active" ? "Deactivate" : "Activate"} ${user.name}`}><Power size={15} /></button>
                          <button type="button" className="action-button delete" onClick={() => deleteUser(user)} disabled={saving} title="Delete user" aria-label={`Delete ${user.name}`}><Trash2 size={15} /></button>
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
          Showing {totalUsers ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, totalUsers)} of {totalUsers} users
        </div>
        <div className="pagination">
          <span>Page {page} of {pageCount}</span>
          <div className="pagination-controls">
            <button type="button" className="pagination-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
            <button type="button" className="pagination-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading}>Next</button>
          </div>
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
              noValidate
            >
              {loading && <div role="status">Loading roles and colleges...</div>}
              {error && <div className="error-box" role="alert">{error}</div>}
              {!loading && roles.length === 0 && (
                !error && <div className="error-box" role="alert">Role options are unavailable. Please refresh and try again.</div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-full-name">
                    Full Name{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    id="new-user-full-name"
                    type="text"
                    name="name"
                    className={`form-input ${fieldErrors.name ? "invalid" : ""}`}
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Enter full name"
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-required="true"
                  />
                  {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-username">
                    Username <span className="required">*</span>
                  </label>
                  <input
                    id="new-user-username"
                    type="text"
                    name="username"
                    className={`form-input ${fieldErrors.username ? "invalid" : ""}`}
                    value={form.username}
                    onChange={updateForm}
                    autoComplete="username"
                    required
                    minLength={3}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-required="true"
                  />
                  {fieldErrors.username && <div className="field-error">{fieldErrors.username}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-email">
                    Email
                  </label>

                  <input
                    id="new-user-email"
                    type="email"
                    inputMode="email"
                    name="email"
                    className={`form-input ${fieldErrors.email ? "invalid" : ""}`}
                    value={form.email}
                    onChange={updateForm}
                    placeholder="user@university.edu"
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
                </div>
              </div>

              <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-user-password">
                      Password {!editingUser && <span className="required">*</span>}
                    </label>
                    <div className="password-field">
                      <input
                        id="new-user-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className={`form-input ${fieldErrors.password ? "invalid" : ""}`}
                        value={form.password}
                        onChange={updateForm}
                        autoComplete="new-password"
                        required={!editingUser}
                        minLength={editingUser ? undefined : 8}
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-required={!editingUser}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="new-user-confirm-password">
                      Confirm Password {!editingUser && <span className="required">*</span>}
                    </label>
                    <div className="password-field">
                      <input
                        id="new-user-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        className={`form-input ${fieldErrors.confirmPassword ? "invalid" : ""}`}
                        value={form.confirmPassword}
                        onChange={updateForm}
                        autoComplete="new-password"
                        required={!editingUser}
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-required={!editingUser}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && <div className="field-error">{fieldErrors.confirmPassword}</div>}
                  </div>
                </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-phone">
                    Phone
                  </label>

                  <input
                    id="new-user-phone"
                    type="tel"
                    name="phone"
                    className={`form-input ${fieldErrors.phone ? "invalid" : ""}`}
                    value={form.phone}
                    onChange={updateForm}
                    placeholder="Phone number"
                    aria-invalid={Boolean(fieldErrors.phone)}
                  />
                  {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-role">
                    Role{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    id="new-user-role"
                    name="roleId"
                    className={`form-input ${fieldErrors.roleId ? "invalid" : ""}`}
                    value={form.roleId}
                    onChange={updateForm}
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.roleId)}
                    aria-required="true"
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
                  {fieldErrors.roleId && <div className="field-error">{fieldErrors.roleId}</div>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-college">
                    College
                  </label>

                  <select
                    id="new-user-college"
                    name="collegeId"
                    className="form-input"
                    value={form.collegeId}
                    onChange={updateForm}
                    disabled={loading}
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
                  <label className="form-label" htmlFor="new-user-department">
                    Department
                  </label>

                  <select
                    id="new-user-department"
                    name="departmentId"
                    className="form-input"
                    value={
                      form.departmentId
                    }
                    onChange={updateForm}
                    disabled={!form.collegeId || departmentsLoading}
                  >
                    <option value="">
                      {departmentsLoading ? "Loading departments..." : "Select department"}
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
                  {fieldErrors.departmentId && <div className="field-error">{fieldErrors.departmentId}</div>}
                  {departmentsLoading && <div role="status">Loading departments...</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-user-status">
                  Account Status
                </label>

                <select
                  id="new-user-status"
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
                  disabled={saving || loading || departmentsLoading || roles.length === 0}
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
                  {formatDateTime(
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

      {resettingUser && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResetPassword();
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Reset Password</h2>
              <button
                type="button"
                className="close-button"
                onClick={closeResetPassword}
                disabled={saving}
                aria-label="Close reset password dialog"
              >
                ×
              </button>
            </div>

            <form className="form" onSubmit={resetUserPassword}>
              <p>Set a temporary password for {resettingUser.name || resettingUser.email}.</p>
              {resetError && <div className="error-box" role="alert">{resetError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="temporary-user-password">Temporary Password *</label>
                  <div className="password-field">
                    <input
                      id="temporary-user-password"
                      type={showTemporaryPassword ? "text" : "password"}
                      className="form-input"
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      autoComplete="new-password"
                      aria-required="true"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showTemporaryPassword ? "Hide temporary password" : "Show temporary password"}
                      onClick={() => setShowTemporaryPassword((visible) => !visible)}
                    >
                      {showTemporaryPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-temporary-user-password">Confirm Temporary Password *</label>
                  <div className="password-field">
                    <input
                      id="confirm-temporary-user-password"
                      type={showConfirmTemporaryPassword ? "text" : "password"}
                      className="form-input"
                      value={confirmTemporaryPassword}
                      onChange={(event) => setConfirmTemporaryPassword(event.target.value)}
                      autoComplete="new-password"
                      aria-required="true"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showConfirmTemporaryPassword ? "Hide confirm temporary password" : "Show confirm temporary password"}
                      onClick={() => setShowConfirmTemporaryPassword((visible) => !visible)}
                    >
                      {showConfirmTemporaryPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={closeResetPassword} disabled={saving}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Resetting..." : "Reset Password"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activityUser && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivityUser(null);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Activity: {activityUser.name || activityUser.email}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setActivityUser(null)}
                aria-label="Close user activity"
              >
                ×
              </button>
            </div>

            {activityLoading ? (
              <div className="loading-state">Loading activity...</div>
            ) : activityError ? (
              <div className="error-box" role="alert">{activityError}</div>
            ) : activityLogs.length === 0 ? (
              <div className="empty-state">No user activity found.</div>
            ) : (
              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr><th>Action</th><th>IP Address</th><th>Timestamp</th></tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log, index) => (
                      <tr key={log.id || `${log.action}-${log.createdAt}-${index}`}>
                        <td>{log.action || "—"}</td>
                        <td>{log.ip || "—"}</td>
                        <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
