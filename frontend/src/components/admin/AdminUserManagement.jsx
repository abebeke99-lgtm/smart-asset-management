import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Eye, EyeOff, KeyRound, LoaderCircle, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import { getPasswordIssue, getPasswordConfirmationIssue, PASSWORD_VALIDATION_MESSAGES } from "../../utils/passwordValidation";

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

    roleName: getRoleLabel(
      normalizeRoleName(item?.role?.name ?? item?.role ?? item?.roleName),
      item?.roleName ?? item?.role?.displayName,
    ),

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

function normalizeRoleName(value) {
  const role = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["administrator"].includes(role)) return "admin";
  if (["maintenance_coordinator", "maint"].includes(role)) return "maintenance";
  return role;
}

function getRoleLabel(role, displayName) {
  if (role === "admin") return "Admin";
  if (role === "maintenance") return "Maintenance Coordinator";
  return displayName || role.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const [storeManagerCount, setStoreManagerCount] = useState(0);
  const [storeManagerLimit, setStoreManagerLimit] = useState(8);
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
  const [formClosing, setFormClosing] = useState(false);
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
  const formCloseTimer = useRef(null);

  const loadData = useCallback(async (requestedPage = page, filters = {}) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        limit: "10",
      });
      const currentSearch = filters.search ?? debouncedSearch;
      const currentStatusFilter = filters.statusFilter ?? statusFilter;
      const currentRoleFilter = filters.roleFilter ?? roleFilter;
      if (currentSearch.trim()) params.set("search", currentSearch.trim());
      if (currentStatusFilter !== "All") params.set("status", currentStatusFilter.toLowerCase());
      if (currentRoleFilter !== "All") params.set("role", currentRoleFilter);
      const [usersResponse, statsResponse, collegesResponse, rolesResponse, storeManagerResponse] = await Promise.all([
        apiRequest(`${USERS_API}?${params.toString()}`),
        apiRequest(`${USERS_API}/stats`),
        apiRequest(`${COLLEGES_API}?limit=100`),
        apiRequest("/api/roles"),
        apiRequest(`${USERS_API}/store-manager-accounts`),
      ]);

      const userRows = extractArray(usersResponse, ["users"]).map(normalizeUser);
      setUsers(userRows);
      setStats(statsResponse?.data || { total: 0, active: 0, inactive: 0, suspended: 0 });
      setTotalUsers(Number(usersResponse?.pagination?.total ?? usersResponse?.total ?? userRows.length));
      const pages = Math.max(1, Number(usersResponse?.pagination?.pages || 1));
      setPageCount(pages);
      if (requestedPage > pages) setPage(pages);
      const roleOptions = extractArray(rolesResponse, ["roles"]).flatMap((item, index) => {
        const name = normalizeRoleName(item?.name ?? item?.role);
        if (!name) return [];
        return [{ id: name, name: getRoleLabel(name, item?.displayName), sourceIndex: index }];
      });
      const uniqueRoleOptions = [...new Map(roleOptions.map((role) => [role.id, role])).values()]
        .map(({ id, name }) => ({ id, name }));
      setRoles(uniqueRoleOptions);
      setStoreManagerCount(Number(storeManagerResponse?.data?.count) || 0);
      setStoreManagerLimit(Number(storeManagerResponse?.data?.limit) || 8);
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
  const storeManagerCapacityReached = storeManagerCount >= storeManagerLimit;
  const selectedRoleIsStoreManager = String(form.roleId).trim().toLowerCase().replace(/[\s-]+/g, "_") === "store_manager";
  const selectedRole = String(form.roleId).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const selectedRoleRequiresCollege = ["college", "college_manager", "department_head"].includes(selectedRole);
  const selectedRoleRequiresDepartment = selectedRole === "department_head";
  const showOrganizationFields = Boolean(editingUser || selectedRoleRequiresCollege || form.collegeId || form.departmentId);
  const formRoles = editingUser
    ? roles
    : roles.filter((role) => !['staff', 'student', 'technical_assistant'].includes(
      String(role.name).trim().toLowerCase().replace(/[\s-]+/g, '_'),
    ));

  const openCreateForm = () => {
    window.clearTimeout(formCloseTimer.current);
    setFormClosing(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (user) => {
    window.clearTimeout(formCloseTimer.current);
    setFormClosing(false);
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

  const closeForm = useCallback((force = false) => {
    if ((saving && !force) || formClosing) return;

    setFormClosing(true);
    formCloseTimer.current = window.setTimeout(() => {
      setShowForm(false);
      setFormClosing(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setFieldErrors({});
    }, 150);
  }, [saving, formClosing]);

  useEffect(() => {
    if (!showForm) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeForm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForm, closeForm]);

  useEffect(() => () => window.clearTimeout(formCloseTimer.current), []);

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "collegeId" ? { departmentId: "" } : {}),
    }));
    setFieldErrors((previous) => {
      const next = { ...previous, [name]: "" };
      if (name === "collegeId") next.departmentId = "";
      if (name === "password" || name === "confirmPassword") {
        const nextPassword = name === "password" ? value : form.password;
        const nextConfirmation = name === "confirmPassword" ? value : form.confirmPassword;
        const passwordIssue = getPasswordIssue(nextPassword);
        if (previous.password || nextPassword) {
          next.password = passwordIssue ? PASSWORD_VALIDATION_MESSAGES[passwordIssue] : "";
        }
        if (previous.confirmPassword || nextConfirmation) {
          const confirmationIssue = getPasswordConfirmationIssue(nextPassword, nextConfirmation);
          next.confirmPassword = confirmationIssue
            ? PASSWORD_VALIDATION_MESSAGES[confirmationIssue === "required" ? "confirmRequired" : confirmationIssue]
            : "";
        }
      }
      return next;
    });
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
    if (selectedRoleRequiresCollege && !form.collegeId) nextErrors.collegeId = "Select a college for this role.";
    if (selectedRoleRequiresDepartment && !form.departmentId) nextErrors.departmentId = "Select a department for this role.";
    if (!editingUser && selectedRoleIsStoreManager && storeManagerCapacityReached) {
      nextErrors.roleId = `The maximum of ${storeManagerLimit} Store Manager accounts has been reached.`;
    }
    if (!editingUser || form.password || form.confirmPassword) {
      const passwordIssue = getPasswordIssue(form.password);
      if (passwordIssue) nextErrors.password = PASSWORD_VALIDATION_MESSAGES[passwordIssue];
      const confirmationIssue = getPasswordConfirmationIssue(form.password, form.confirmPassword);
      if (confirmationIssue) {
        nextErrors.confirmPassword = PASSWORD_VALIDATION_MESSAGES[confirmationIssue === "required" ? "confirmRequired" : confirmationIssue];
      }
    }
    if (form.email && form.email.length > 255) nextErrors.email = "Email must be 255 characters or fewer.";
    else if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!editingUser && !form.email.trim() && !form.phone.trim()) nextErrors.email = "Provide an email address or mobile phone.";
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
        status: form.status.toLowerCase(),
      };

      if (editingUser) {
        payload.collegeId = form.collegeId || null;
        payload.departmentId = form.departmentId || null;
      } else if (showOrganizationFields) {
        payload.collegeId = form.collegeId || null;
        payload.departmentId = form.departmentId || null;
      }

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
      if (editingUser) {
        toast.success("User updated successfully.");
        await loadData();
      } else {
        toast.success("User created successfully.");
        const nextPage = Math.max(1, Math.ceil(((Number(stats.total) || 0) + 1) / 10));
        const refreshTriggeredByState = Boolean(
          debouncedSearch || statusFilter !== "All" || roleFilter !== "All" || page !== nextPage
        );
        setSearch("");
        setDebouncedSearch("");
        setStatusFilter("All");
        setRoleFilter("All");
        setPage(nextPage);
        if (!refreshTriggeredByState) {
          await loadData(nextPage, { search: "", statusFilter: "All", roleFilter: "All" });
        }
      }
    } catch (err) {
      const message = err.message || "Unable to save user.";
      const key = /username/i.test(message) ? "username" : /email/i.test(message) ? "email" : /phone/i.test(message) ? "phone" : /role/i.test(message) ? "roleId" : "";
      if (key) setFieldErrors({ [key]: message });
      if (!editingUser) {
        setForm((previous) => ({ ...previous, password: "", confirmPassword: "" }));
        setShowPassword(false);
        setShowConfirmPassword(false);
      }
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
    const passwordIssue = getPasswordIssue(temporaryPassword);
    const confirmationIssue = getPasswordConfirmationIssue(temporaryPassword, confirmTemporaryPassword);
    if (passwordIssue || confirmationIssue) {
      const issue = passwordIssue || confirmationIssue;
      setResetError(PASSWORD_VALIDATION_MESSAGES[issue === "required" && !passwordIssue ? "confirmRequired" : issue]);
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

        .users-form-backdrop {
          z-index: 1100;
          background: rgba(15, 23, 42, .62);
          backdrop-filter: blur(4px);
          animation: users-form-fade-in 160ms ease-out both;
        }

        .users-form-backdrop.is-closing {
          pointer-events: none;
          animation: users-form-fade-out 150ms ease-in both;
        }

        .users-form-modal {
          width: min(820px, 100%);
          max-height: min(90vh, 820px);
          border: 1px solid #dbe5f0;
          border-radius: 16px;
          box-shadow: 0 28px 80px rgba(15, 23, 42, .3);
          animation: users-form-rise-in 180ms cubic-bezier(.2, .8, .2, 1) both;
        }

        .users-form-backdrop.is-closing .users-form-modal {
          animation: users-form-rise-out 150ms ease-in both;
        }

        .users-form-modal .modal-header {
          position: sticky;
          top: 0;
          z-index: 1;
          gap: 20px;
          padding: 21px 26px 18px;
          background: #fff;
        }

        .users-form-modal .modal-title {
          color: #173b63;
          font-size: 21px;
          font-weight: 750;
          letter-spacing: -.02em;
        }

        .users-form-description {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .users-form-modal .close-button {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          font-size: 24px;
          transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
        }

        .users-form-modal .close-button:hover:not(:disabled) {
          transform: rotate(90deg);
          background: #eaf2fa;
          color: #245783;
        }

        .users-form-modal .form {
          padding: 22px 26px 0;
        }

        .users-form-row {
          display: grid;
          gap: 16px;
        }

        .users-form-row-identity {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .users-form-row-password,
        .users-form-row-details {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .users-form-modal .form-group {
          min-width: 0;
          margin-bottom: 18px;
        }

        .users-form-modal .form-label {
          margin-bottom: 7px;
          color: #334155;
          font-size: 13px;
          line-height: 1.35;
        }

        .users-form-modal .form-input {
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 10px 12px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          font-size: 14px;
          transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
        }

        .users-form-modal .form-input:hover:not(:disabled) {
          border-color: #94a3b8;
        }

        .users-form-modal .form-input:focus {
          border-color: #3074b3;
          outline: 0;
          box-shadow: 0 0 0 3px rgba(48, 116, 179, .16);
        }

        .users-form-modal .form-input.invalid {
          border-color: #dc2626;
        }

        .users-form-modal .field-error {
          margin-top: 5px;
          color: #b91c1c;
          font-size: 12px;
          line-height: 1.4;
        }

        .users-form-modal .password-toggle {
          transition: color 150ms ease, background-color 150ms ease;
        }

        .users-form-modal .modal-footer {
          position: sticky;
          bottom: 0;
          z-index: 1;
          margin: 0 -26px;
          padding: 16px 26px;
          background: #fff;
          box-shadow: 0 -8px 20px rgba(15, 23, 42, .035);
        }

        .users-form-modal .secondary-button,
        .users-form-modal .primary-button {
          min-height: 42px;
          border-radius: 9px;
          padding: 10px 17px;
          transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }

        .users-form-modal .secondary-button:hover:not(:disabled) {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .users-form-modal .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(37, 99, 167, .2);
        }

        .users-form-modal :where(button, input, select):focus-visible {
          outline: 3px solid rgba(48, 116, 179, .28);
          outline-offset: 2px;
        }

        .users-form-spinner {
          flex: 0 0 auto;
          animation: users-form-spin 900ms linear infinite;
        }

        @keyframes users-form-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes users-form-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes users-form-rise-in {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes users-form-rise-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(6px) scale(.99); }
        }

        @keyframes users-form-spin {
          to { transform: rotate(360deg); }
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
          .details-grid {
            grid-template-columns: 1fr;
          }

          .users-form-modal {
            max-height: calc(100dvh - 24px);
            border-radius: 13px;
          }

          .users-form-modal .modal-header {
            padding: 18px 18px 15px;
          }

          .users-form-modal .form {
            padding: 18px 18px 0;
          }

          .users-form-row-identity {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .users-form-modal .modal-footer {
            margin: 0 -18px;
            padding: 14px 18px;
          }

          .users-form-row-password,
          .users-form-row-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detail-full {
            grid-column: auto;
          }
        }

        @media (max-width: 480px) {
          .users-form-backdrop {
            padding: 12px;
          }

          .users-form-row-identity,
          .users-form-row-password,
          .users-form-row-details {
            grid-template-columns: minmax(0, 1fr);
          }

          .users-form-modal .modal-footer {
            flex-direction: column-reverse;
          }

          .users-form-modal .modal-footer button {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .users-form-backdrop,
          .users-form-modal,
          .users-form-spinner {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
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

          <div className="summary-card" aria-live="polite">
            <div className="summary-label">Store Manager Accounts</div>
            <div className="summary-value">{storeManagerCount} of {storeManagerLimit}</div>
            <div className="summary-label">registered</div>
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
          className={`modal-backdrop users-form-backdrop${formClosing ? " is-closing" : ""}`}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div
            className="modal users-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-form-title"
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="users-form-title">
                  {editingUser ? "Edit User" : "Add User"}
                </h2>
                <p className="users-form-description">
                  {editingUser ? "Update account details and access." : "Create an account for your university system."}
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                aria-label="Close user form"
                onClick={closeForm}
                disabled={saving || formClosing}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form
              className="form users-form"
              onSubmit={saveUser}
              noValidate
            >
              {loading && <div role="status">{editingUser ? "Loading roles and colleges..." : "Loading roles..."}</div>}
              {error && <div className="error-box" role="alert">{error}</div>}
              {!loading && roles.length === 0 && (
                !error && <div className="error-box" role="alert">Role options are unavailable. Please refresh and try again.</div>
              )}
              <div className="form-row users-form-row users-form-row-identity">
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

              <div className="form-row users-form-row users-form-row-password">
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-user-password">
                      {editingUser ? "Password" : "Temporary Password"} {!editingUser && <span className="required">*</span>}
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
                        minLength={8}
                        maxLength={16}
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
                      {editingUser ? "Confirm Password" : "Confirm Temporary Password"} {!editingUser && <span className="required">*</span>}
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
                        required={!editingUser || Boolean(form.password)}
                        maxLength={16}
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

              <div className="form-row users-form-row users-form-row-details">
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

                    {formRoles.map((role) => (
                      <option
                        key={role.id}
                        value={role.id}
                      >
                        {role.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.roleId && <div className="field-error">{fieldErrors.roleId}</div>}
                  {!editingUser && selectedRoleIsStoreManager && storeManagerCapacityReached && (
                    <div className="field-error" role="alert">
                      The maximum of {storeManagerLimit} Store Manager accounts has been reached.
                    </div>
                  )}
                </div>
              </div>

              {showOrganizationFields && <div className="form-row">
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
              </div>}

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
                  disabled={saving || formClosing}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving || formClosing || loading || departmentsLoading || roles.length === 0 || (!editingUser && selectedRoleIsStoreManager && storeManagerCapacityReached)}
                >
                  {saving
                    ? <><LoaderCircle className="users-form-spinner" size={17} aria-hidden="true" /> {editingUser ? "Saving..." : "Creating user..."}</>
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
                      onChange={(event) => {
                        const value = event.target.value;
                        setTemporaryPassword(value);
                        if (resetError || value || confirmTemporaryPassword) {
                          const passwordIssue = getPasswordIssue(value);
                          const confirmationIssue = getPasswordConfirmationIssue(value, confirmTemporaryPassword);
                          const issue = passwordIssue || confirmationIssue;
                          setResetError(issue ? PASSWORD_VALIDATION_MESSAGES[issue === "required" && !passwordIssue ? "confirmRequired" : issue] : "");
                        }
                      }}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={16}
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
                      onChange={(event) => {
                        const value = event.target.value;
                        setConfirmTemporaryPassword(value);
                        if (resetError || value || temporaryPassword) {
                          const passwordIssue = getPasswordIssue(temporaryPassword);
                          const confirmationIssue = getPasswordConfirmationIssue(temporaryPassword, value);
                          const issue = passwordIssue || confirmationIssue;
                          setResetError(issue ? PASSWORD_VALIDATION_MESSAGES[issue === "required" && !passwordIssue ? "confirmRequired" : issue] : "");
                        }
                      }}
                      autoComplete="new-password"
                      required
                      maxLength={16}
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
