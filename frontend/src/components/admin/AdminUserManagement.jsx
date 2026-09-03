import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/UiContext";
import { toast } from "react-toastify";
import { apiClient } from "../../utils/api";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

const SYSTEM_ROLES = [
  {
    value: "admin",
    label: "Admin",
    icon: "👑",
    description: "Full system administration access",
  },
  {
    value: "ict_officer",
    label: "ICT Officer",
    icon: "💻",
    description: "ICT, technology and asset technical management",
  },
  {
    value: "college",
    label: "College",
    icon: "🏫",
    description: "College-level asset and department management",
  },
  {
    value: "finance",
    label: "Finance",
    icon: "💰",
    description: "Financial and asset valuation management",
  },
  {
    value: "store_manager",
    label: "Store Manager",
    icon: "📦",
    description: "Store and inventory management",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    icon: "🔧",
    description: "Maintenance request and technician management",
  },
  {
    value: "staff",
    label: "Staff",
    icon: "👤",
    description: "Standard staff access",
  },
];

const PERMISSION_GROUPS = [
  {
    key: "assets",
    label: "Assets",
    icon: "📦",
    permissions: [
      "view_assets",
      "create_asset",
      "edit_asset",
      "delete_asset",
      "assign_asset",
      "transfer_asset",
      "return_asset",
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: "📋",
    permissions: [
      "view_inventory",
      "stock_in",
      "stock_out",
      "stock_movement",
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "🔧",
    permissions: [
      "view_requests",
      "create_request",
      "assign_technician",
      "update_maintenance",
      "complete_maintenance",
    ],
  },
  {
    key: "users",
    label: "Users",
    icon: "👥",
    permissions: [
      "view_users",
      "create_user",
      "edit_user",
      "delete_user",
      "activate_deactivate",
      "manage_roles",
      "manage_permissions",
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "📊",
    permissions: [
      "view_reports",
      "generate_reports",
      "export_reports",
      "print_reports",
    ],
  },
  {
    key: "system",
    label: "System",
    icon: "⚙️",
    permissions: [
      "settings",
      "backup",
      "restore",
      "audit_logs",
    ],
  },
];

const ACTION_LABELS = {
  view_assets: "View Assets",
  create_asset: "Create Asset",
  edit_asset: "Edit Asset",
  delete_asset: "Delete Asset",
  assign_asset: "Assign Asset",
  transfer_asset: "Transfer Asset",
  return_asset: "Return Asset",
  view_inventory: "View Inventory",
  stock_in: "Stock In",
  stock_out: "Stock Out",
  stock_movement: "Stock Movement",
  view_requests: "View Requests",
  create_request: "Create Request",
  assign_technician: "Assign Technician",
  update_maintenance: "Update Maintenance",
  complete_maintenance: "Complete Maintenance",
  view_users: "View Users",
  create_user: "Create User",
  edit_user: "Edit User",
  delete_user: "Delete User",
  activate_deactivate: "Activate / Deactivate",
  manage_roles: "Manage Roles",
  manage_permissions: "Manage Permissions",
  view_reports: "View Reports",
  generate_reports: "Generate Reports",
  export_reports: "Export Reports",
  print_reports: "Print Reports",
  settings: "Settings",
  backup: "Backup",
  restore: "Restore",
  audit_logs: "Audit Logs",
};

const ACTIVITY_TYPES = [
  "Login",
  "Logout",
  "Failed Login",
  "Create",
  "Update",
  "Delete",
  "Asset Assignment",
  "Asset Transfer",
  "Asset Return",
  "Maintenance Activity",
  "Report Generation",
  "Permission Change",
  "Password Change",
  "Settings Change",
];

const initialForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  role: "staff",
  department: "",
  phone: "",
  active: true,
  profilePhoto: "",
};

const AdminUserManagement = ({ initialSection = "users" }) => {
  const { user: currentUser } = useAuth();
  const { language, theme } = useLanguage();
  const isDark = theme === "dark";

  const [activeSection, setActiveSection] = useState(initialSection);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activities, setActivities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("admin");

  const [rolePermissions, setRolePermissions] = useState({});

  const [activitySearch, setActivitySearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("");

  const t =
    language === "en"
      ? {
          title: "User Management",
          users: "All Users",
          create: "Create User",
          roles: "Roles",
          permissions: "Permissions",
          activeInactive: "Active / Inactive",
          activity: "User Activity",
        }
      : {
          title: "የተጠቃሚዎች አስተዳደር",
          users: "ሁሉም ተጠቃሚዎች",
          create: "ተጠቃሚ ፍጠር",
          roles: "ሚናዎች",
          permissions: "ፈቃዶች",
          activeInactive: "ንቁ / የተዘጋ",
          activity: "የተጠቃሚ እንቅስቃሴ",
        };

  const getUserName = (user) =>
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.username ||
    "-";

  const getDepartment = (user) =>
    user?.department?.name ||
    user?.department_name ||
    user?.department ||
    "-";

  const isUserActive = (user) =>
    user?.active !== false &&
    user?.is_active !== false &&
    user?.status !== "inactive";

  const formatRole = (role) => {
    const found = SYSTEM_ROLES.find((item) => item.value === role);
    return found ? `${found.icon} ${found.label}` : role || "-";
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        search: searchQuery || undefined,
        role: roleFilter || undefined,
        active:
          statusFilter === "active"
            ? true
            : statusFilter === "inactive"
              ? false
              : undefined,
        page: currentPage,
        limit: pageSize,
      };

      const response = await apiClient.get("/api/users", { params });

      const data =
        response.data?.data ||
        response.data?.users ||
        response.data?.results ||
        [];

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load users"
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter, currentPage, pageSize]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/departments");

      const data =
        response.data?.data ||
        response.data?.departments ||
        response.data?.results ||
        [];

      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      setDepartments([]);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    setActivityLoading(true);

    try {
      const response = await apiClient.get("/api/users/activity");

      const data =
        response.data?.data ||
        response.data?.activities ||
        response.data?.results ||
        [];

      setActivities(Array.isArray(data) ? data : []);
    } catch (error) {
      /*
       * If the backend does not yet have /api/users/activity,
       * keep the page functional with an empty activity list.
       */
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (activeSection === "activity") {
      fetchActivities();
    }
  }, [activeSection, fetchActivities]);

  const validateForm = (editing = false) => {
    const errors = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    }

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      errors.email = "Invalid email format";
    }

    if (!editing && !formData.password.trim()) {
      errors.password = "Password is required";
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (!formData.role) {
      errors.role = "Role is required";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const updateForm = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setFormErrors({});
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm(false)) return;

    setSaving(true);

    try {
      await apiClient.post("/api/users", {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        role: formData.role,
        department: formData.department || "",
        phone: formData.phone || "",
        active: formData.active,
      });

      toast.success("User created successfully");

      setShowCreate(false);
      resetForm();
      setCurrentPage(1);

      await fetchUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to create user"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!selectedUser) return;

    if (!validateForm(true)) return;

    setSaving(true);

    try {
      await apiClient.put(`/api/users/${selectedUser.id}`, {
        username: formData.username.trim(),
        email: formData.email.trim(),
        ...(formData.password
          ? { password: formData.password }
          : {}),
        fullName: formData.fullName.trim(),
        role: formData.role,
        department: formData.department || "",
        phone: formData.phone || "",
        active: formData.active,
      });

      toast.success("User updated successfully");

      setShowEdit(false);
      setSelectedUser(null);
      resetForm();

      await fetchUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update user"
      );
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (user) => {
    setSelectedUser(user);

    setFormData({
      username: user.username || "",
      email: user.email || "",
      password: "",
      confirmPassword: "",
      fullName: getUserName(user) === "-" ? "" : getUserName(user),
      role: user.role || "staff",
      department:
        user?.department?.name ||
        user?.department_name ||
        (typeof user?.department === "string"
          ? user.department
          : ""),
      phone: user.phone || user.phone_number || "",
      active: isUserActive(user),
      profilePhoto: user.profilePhoto || user.profile_photo || "",
    });

    setFormErrors({});
    setShowEdit(true);
  };

  const openDetails = (user) => {
    setSelectedUser(user);
    setShowDetails(true);
  };

  const handleDelete = async (user) => {
    if (String(user.id) === String(currentUser?.id)) {
      toast.error("You cannot delete your own account");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete user "${user.username}"?`
    );

    if (!confirmed) return;

    try {
      await apiClient.delete(`/api/users/${user.id}`);

      toast.success("User deleted successfully");
      await fetchUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to delete user"
      );
    }
  };

  const toggleUserStatus = async (user) => {
    if (String(user.id) === String(currentUser?.id)) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    const currentlyActive = isUserActive(user);
    const newStatus = !currentlyActive;

    try {
      await apiClient.put(`/api/users/${user.id}`, {
        active: newStatus,
      });

      toast.success(
        newStatus
          ? "User activated successfully"
          : "User deactivated successfully"
      );

      await fetchUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to change user status"
      );
    }
  };

  const resetPassword = async (user) => {
    const confirmed = window.confirm(
      `Reset password for "${user.username}"?`
    );

    if (!confirmed) return;

    try {
      await apiClient.post(
        `/api/users/${user.id}/reset-password`
      );

      toast.success("Password reset successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Password reset endpoint is not available"
      );
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        user.username?.toLowerCase().includes(query) ||
        getUserName(user).toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        getDepartment(user).toLowerCase().includes(query);

      const matchesRole =
        !roleFilter || user.role === roleFilter;

      const active = isUserActive(user);

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(isUserActive).length;
    const inactive = total - active;

    const roleCounts = SYSTEM_ROLES.reduce((accumulator, role) => {
      accumulator[role.value] = users.filter(
        (user) => user.role === role.value
      ).length;

      return accumulator;
    }, {});

    return {
      total,
      active,
      inactive,
      roleCounts,
    };
  }, [users]);

  const filteredRoles = SYSTEM_ROLES.filter((role) =>
    `${role.label} ${role.value} ${role.description}`
      .toLowerCase()
      .includes(roleSearch.toLowerCase())
  );

  const getPermissionValue = (role, permission) => {
    if (rolePermissions[role]) {
      return rolePermissions[role].includes(permission);
    }

    /*
     * Default system permissions.
     * Admin receives every permission.
     */
    if (role === "admin") return true;

    const defaults = {
      ict_officer: [
        "view_assets",
        "edit_asset",
        "assign_asset",
        "transfer_asset",
        "return_asset",
        "view_inventory",
        "view_requests",
        "update_maintenance",
        "view_reports",
        "generate_reports",
      ],
      department_head: [
        "view_assets",
        "assign_asset",
        "transfer_asset",
        "return_asset",
        "view_inventory",
        "view_requests",
        "create_request",
        "view_reports",
      ],
      finance: [
        "view_assets",
        "view_inventory",
        "view_reports",
        "generate_reports",
        "export_reports",
        "print_reports",
      ],
      store_manager: [
        "view_assets",
        "create_asset",
        "edit_asset",
        "assign_asset",
        "transfer_asset",
        "return_asset",
        "view_inventory",
        "stock_in",
        "stock_out",
        "stock_movement",
        "view_reports",
      ],
      maintenance: [
        "view_assets",
        "view_requests",
        "create_request",
        "assign_technician",
        "update_maintenance",
        "complete_maintenance",
      ],
      staff: [
        "view_assets",
        "return_asset",
        "view_requests",
        "create_request",
      ],
    };

    return defaults[role]?.includes(permission) || false;
  };

  const togglePermission = (role, permission) => {
    setRolePermissions((previous) => {
      const current = previous[role] || PERMISSION_GROUPS.flatMap(
        (group) => group.permissions
      ).filter((item) => getPermissionValue(role, item));

      const updated = current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission];

      return {
        ...previous,
        [role]: updated,
      };
    });
  };

  const saveRolePermissions = async () => {
    try {
      await apiClient.put(`/api/roles/${selectedRole}/permissions`, {
        permissions:
          rolePermissions[selectedRole] ||
          PERMISSION_GROUPS.flatMap(
            (group) => group.permissions
          ).filter((permission) =>
            getPermissionValue(selectedRole, permission)
          ),
      });

      toast.success(
        `${formatRole(selectedRole)} permissions saved successfully`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Permissions saved locally. Backend endpoint may not be configured."
      );
    }
  };

  const filteredActivities = activities.filter((activity) => {
    const query = activitySearch.trim().toLowerCase();

    const username =
      activity.user?.username ||
      activity.username ||
      activity.user_name ||
      "";

    const description =
      activity.description ||
      activity.details ||
      "";

    const action =
      activity.action ||
      activity.activity ||
      "";

    const matchesSearch =
      !query ||
      username.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      action.toLowerCase().includes(query);

    const matchesType =
      !activityTypeFilter ||
      action.toLowerCase() === activityTypeFilter.toLowerCase();

    return matchesSearch && matchesType;
  });

  const closeAllModals = () => {
    setShowCreate(false);
    setShowEdit(false);
    setShowDetails(false);
    setSelectedUser(null);
    resetForm();
  };

  const renderStatCard = (
    icon,
    title,
    value,
    description,
    onClick
  ) => (
    <button
      type="button"
      className="um-stat-card"
      onClick={onClick}
    >
      <div className="um-stat-icon">{icon}</div>

      <div className="um-stat-info">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </button>
  );

  const renderUsers = () => (
    <>
      <div className="um-stats-grid">
        {renderStatCard(
          <Users size={23} />,
          "Total Users",
          stats.total,
          "All registered accounts",
          () => {
            setStatusFilter("");
            setRoleFilter("");
          }
        )}

        {renderStatCard(
          <UserCheck size={23} />,
          "Active Users",
          stats.active,
          "Login enabled",
          () => setStatusFilter("active")
        )}

        {renderStatCard(
          <UserX size={23} />,
          "Inactive Users",
          stats.inactive,
          "Login disabled",
          () => setStatusFilter("inactive")
        )}

        {renderStatCard(
          <Shield size={23} />,
          "Admins",
          stats.roleCounts.admin || 0,
          "System administrators",
          () => setRoleFilter("admin")
        )}
      </div>

      <div className="um-toolbar">
        <div className="um-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search username, name, email or department..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="um-icon-button"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <select
          className="um-select"
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Roles</option>

          {SYSTEM_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <select
          className="um-select"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          type="button"
          className="um-btn um-btn-primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Create User
        </button>

        <button
          type="button"
          className="um-btn um-btn-secondary"
          onClick={fetchUsers}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="um-card">
        <div className="um-card-header">
          <div>
            <h3>{t.users}</h3>
            <p>
              {filteredUsers.length} user
              {filteredUsers.length === 1 ? "" : "s"} displayed
            </p>
          </div>

          <button
            type="button"
            className="um-btn um-btn-secondary"
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("");
              setStatusFilter("");
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No Users Found"
            description={
              searchQuery ||
              roleFilter ||
              statusFilter
                ? "Try changing your filters."
                : "Create your first user."
            }
            buttonText="Create User"
            onClick={openCreate}
          />
        ) : (
          <>
            <div className="um-table-wrapper">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const active = isUserActive(user);

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="um-user-cell">
                            <div className="um-avatar">
                              {getUserName(user)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {getUserName(user)}
                              </strong>

                              <small>
                                ID: {user.id || "-"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>{user.username || "-"}</strong>
                        </td>

                        <td>{user.email || "-"}</td>

                        <td>
                          <span className="um-role-badge">
                            {formatRole(user.role)}
                          </span>
                        </td>

                        <td>{getDepartment(user)}</td>

                        <td>
                          {user.phone ||
                            user.phone_number ||
                            "-"}
                        </td>

                        <td>
                          <span
                            className={`um-status ${
                              active
                                ? "um-status-active"
                                : "um-status-inactive"
                            }`}
                          >
                            {active ? (
                              <CheckCircle size={14} />
                            ) : (
                              <UserX size={14} />
                            )}
                            {active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          {user.lastLogin ||
                            user.last_login ||
                            "-"}
                        </td>

                        <td>
                          <div className="um-action-group">
                            <button
                              type="button"
                              className="um-action view"
                              title="View Details"
                              onClick={() =>
                                openDetails(user)
                              }
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              className="um-action edit"
                              title="Edit User"
                              onClick={() =>
                                openEdit(user)
                              }
                            >
                              <Edit2 size={16} />
                            </button>

                            <button
                              type="button"
                              className="um-action password"
                              title="Reset Password"
                              onClick={() =>
                                resetPassword(user)
                              }
                            >
                              <KeyRound size={16} />
                            </button>

                            <button
                              type="button"
                              className={`um-action ${
                                active
                                  ? "deactivate"
                                  : "activate"
                              }`}
                              title={
                                active
                                  ? "Deactivate"
                                  : "Activate"
                              }
                              onClick={() =>
                                toggleUserStatus(user)
                              }
                            >
                              {active ? (
                                <UserX size={16} />
                              ) : (
                                <UserCheck size={16} />
                              )}
                            </button>

                            <button
                              type="button"
                              className="um-action delete"
                              title="Delete User"
                              onClick={() =>
                                handleDelete(user)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="um-pagination">
              <span>
                Showing {filteredUsers.length} users
              </span>

              <div>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(1, page - 1)
                    )
                  }
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="um-page-number">
                  Page {currentPage}
                </span>

                <button
                  type="button"
                  disabled={filteredUsers.length < pageSize}
                  onClick={() =>
                    setCurrentPage((page) => page + 1)
                  }
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  const renderCreateUser = () => (
    <div className="um-card um-create-card">
      <div className="um-card-header">
        <div>
          <h3>
            <UserPlus size={22} />
            Create New User
          </h3>

          <p>
            Register a new system user and assign role and
            department.
          </p>
        </div>
      </div>

      <UserForm
        formData={formData}
        formErrors={formErrors}
        departments={departments}
        roles={SYSTEM_ROLES}
        saving={saving}
        editing={false}
        isDark={isDark}
        updateForm={updateForm}
        onSubmit={handleCreateSubmit}
        onCancel={closeAllModals}
      />
    </div>
  );

  const renderRoles = () => (
    <div className="um-role-layout">
      <div className="um-card um-role-list">
        <div className="um-card-header">
          <div>
            <h3>
              <Shield size={21} />
              System Roles
            </h3>

            <p>
              Manage the seven predefined system roles.
            </p>
          </div>
        </div>

        <div className="um-search compact">
          <Search size={17} />

          <input
            placeholder="Search roles..."
            value={roleSearch}
            onChange={(event) =>
              setRoleSearch(event.target.value)
            }
          />
        </div>

        <div className="um-role-items">
          {filteredRoles.map((role) => (
            <button
              type="button"
              key={role.value}
              className={`um-role-item ${
                selectedRole === role.value
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                setSelectedRole(role.value)
              }
            >
              <span className="um-role-icon">
                {role.icon}
              </span>

              <span>
                <strong>{role.label}</strong>
                <small>{role.description}</small>
              </span>

              <em>
                {stats.roleCounts[role.value] || 0}
              </em>
            </button>
          ))}
        </div>
      </div>

      <div className="um-card um-role-details">
        <div className="um-card-header">
          <div>
            <h3>
              {
                SYSTEM_ROLES.find(
                  (role) => role.value === selectedRole
                )?.icon
              }{" "}
              {
                SYSTEM_ROLES.find(
                  (role) => role.value === selectedRole
                )?.label
              }
            </h3>

            <p>
              {
                SYSTEM_ROLES.find(
                  (role) => role.value === selectedRole
                )?.description
              }
            </p>
          </div>

          <button
            type="button"
            className="um-btn um-btn-primary"
            onClick={saveRolePermissions}
          >
            Save Role
          </button>
        </div>

        <div className="um-role-summary">
          <div>
            <strong>
              {stats.roleCounts[selectedRole] || 0}
            </strong>
            <span>Users assigned</span>
          </div>

          <div>
            <strong>
              {PERMISSION_GROUPS.reduce(
                (total, group) =>
                  total +
                  group.permissions.filter((permission) =>
                    getPermissionValue(
                      selectedRole,
                      permission
                    )
                  ).length,
                0
              )}
            </strong>
            <span>Permissions</span>
          </div>
        </div>

        <div className="um-users-by-role">
          <h4>Users by Role</h4>

          <div className="um-mini-user-grid">
            {users
              .filter(
                (user) => user.role === selectedRole
              )
              .slice(0, 12)
              .map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => openDetails(user)}
                  className="um-mini-user"
                >
                  <div className="um-avatar">
                    {getUserName(user)
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <span>
                    <strong>
                      {getUserName(user)}
                    </strong>
                    <small>
                      @{user.username}
                    </small>
                  </span>
                </button>
              ))}

            {users.filter(
              (user) => user.role === selectedRole
            ).length === 0 && (
              <div className="um-inline-empty">
                No users assigned to this role.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPermissions = () => (
    <div className="um-card">
      <div className="um-card-header">
        <div>
          <h3>
            <Lock size={21} />
            Role Permissions
          </h3>

          <p>
            Assign view, create, edit, delete, approval,
            export and system permissions.
          </p>
        </div>

        <div className="um-permission-role">
          <label>Role</label>

          <select
            value={selectedRole}
            onChange={(event) =>
              setSelectedRole(event.target.value)
            }
          >
            {SYSTEM_ROLES.map((role) => (
              <option
                key={role.value}
                value={role.value}
              >
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="um-search">
        <Search size={18} />

        <input
          placeholder="Search permissions..."
          value={permissionSearch}
          onChange={(event) =>
            setPermissionSearch(event.target.value)
          }
        />
      </div>

      <div className="um-permission-grid">
        {PERMISSION_GROUPS.map((group) => {
          const permissions = group.permissions.filter(
            (permission) =>
              !permissionSearch ||
              ACTION_LABELS[permission]
                ?.toLowerCase()
                .includes(permissionSearch.toLowerCase())
          );

          if (!permissions.length) return null;

          return (
            <div
              className="um-permission-group"
              key={group.key}
            >
              <div className="um-permission-heading">
                <span>
                  {group.icon} {group.label}
                </span>

                <small>
                  {
                    permissions.filter((permission) =>
                      getPermissionValue(
                        selectedRole,
                        permission
                      )
                    ).length
                  }
                  /{permissions.length}
                </small>
              </div>

              {permissions.map((permission) => {
                const enabled = getPermissionValue(
                  selectedRole,
                  permission
                );

                return (
                  <label
                    className="um-permission-row"
                    key={permission}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        togglePermission(
                          selectedRole,
                          permission
                        )
                      }
                    />

                    <span>
                      {ACTION_LABELS[permission]}
                    </span>

                    <em>
                      {enabled ? "Allowed" : "Denied"}
                    </em>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="um-permission-actions">
        <button
          type="button"
          className="um-btn um-btn-secondary"
          onClick={() => {
            const allPermissions =
              PERMISSION_GROUPS.flatMap(
                (group) => group.permissions
              );

            setRolePermissions((previous) => ({
              ...previous,
              [selectedRole]: allPermissions,
            }));
          }}
        >
          Allow All
        </button>

        <button
          type="button"
          className="um-btn um-btn-secondary"
          onClick={() => {
            setRolePermissions((previous) => ({
              ...previous,
              [selectedRole]: [],
            }));
          }}
        >
          Deny All
        </button>

        <button
          type="button"
          className="um-btn um-btn-primary"
          onClick={saveRolePermissions}
        >
          Save Permissions
        </button>
      </div>
    </div>
  );

  const renderActiveInactive = () => {
    const activeUsers = users.filter(isUserActive);
    const inactiveUsers = users.filter(
      (user) => !isUserActive(user)
    );

    return (
      <div className="um-active-layout">
        <StatusPanel
          title="Active Users"
          description="Users currently allowed to log in."
          icon={<UserCheck size={24} />}
          users={activeUsers}
          active
          onToggle={toggleUserStatus}
          onDetails={openDetails}
        />

        <StatusPanel
          title="Inactive Users"
          description="Accounts with login disabled."
          icon={<UserX size={24} />}
          users={inactiveUsers}
          active={false}
          onToggle={toggleUserStatus}
          onDetails={openDetails}
        />
      </div>
    );
  };

  const renderActivity = () => (
    <div className="um-card">
      <div className="um-card-header">
        <div>
          <h3>
            <Activity size={21} />
            User Activity
          </h3>

          <p>
            Monitor login, user changes, asset activity,
            permissions and security events.
          </p>
        </div>

        <button
          type="button"
          className="um-btn um-btn-secondary"
          onClick={fetchActivities}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="um-toolbar activity">
        <div className="um-search">
          <Search size={18} />

          <input
            placeholder="Search user, action or description..."
            value={activitySearch}
            onChange={(event) =>
              setActivitySearch(event.target.value)
            }
          />
        </div>

        <select
          className="um-select"
          value={activityTypeFilter}
          onChange={(event) =>
            setActivityTypeFilter(event.target.value)
          }
        >
          <option value="">All Activity</option>

          {ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {activityLoading ? (
        <LoadingState />
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={<Activity size={48} />}
          title="No Activity Found"
          description="No activity records match your filters."
        />
      ) : (
        <div className="um-table-wrapper">
          <table className="um-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Date</th>
                <th>Time</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              {filteredActivities.map(
                (activity, index) => (
                  <tr
                    key={
                      activity.id ||
                      activity._id ||
                      index
                    }
                  >
                    <td>
                      {activity.user?.username ||
                        activity.username ||
                        activity.user_name ||
                        "-"}
                    </td>

                    <td>
                      <span className="um-activity-badge">
                        {activity.action ||
                          activity.activity ||
                          "-"}
                      </span>
                    </td>

                    <td>
                      {activity.module || "-"}
                    </td>

                    <td>
                      {activity.date ||
                        activity.created_at ||
                        "-"}
                    </td>

                    <td>
                      {activity.time || "-"}
                    </td>

                    <td>
                      {activity.ipAddress ||
                        activity.ip_address ||
                        "-"}
                    </td>

                    <td>
                      {activity.device || "-"}
                    </td>

                    <td>
                      <span
                        className={`um-status ${
                          activity.status === "failed" ||
                          activity.status === "error"
                            ? "um-status-inactive"
                            : "um-status-active"
                        }`}
                      >
                        {activity.status || "Success"}
                      </span>
                    </td>

                    <td>
                      {activity.description ||
                        activity.details ||
                        "-"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className={`user-management-page ${isDark ? "dark" : "light"}`}>
      <div className="um-page-header">
        <div>
          <div className="um-breadcrumb">
            Admin / User Management
          </div>

          <h1>
            👥 {t.title}
          </h1>

          <p>
            Manage users, roles, permissions, account
            status and security activity.
          </p>
        </div>

        <div className="um-header-actions">
          <button
            type="button"
            className="um-btn um-btn-secondary"
            onClick={() => setActiveSection("activity")}
          >
            <Activity size={18} />
            Activity Log
          </button>

          <button
            type="button"
            className="um-btn um-btn-primary"
            onClick={openCreate}
          >
            <UserPlus size={18} />
            Create User
          </button>
        </div>
      </div>

      <div className="um-navigation">
        <button
          type="button"
          className={
            activeSection === "users" ? "active" : ""
          }
          onClick={() => setActiveSection("users")}
        >
          <Users size={18} />
          All Users
        </button>

        <button
          type="button"
          className={
            activeSection === "create" ? "active" : ""
          }
          onClick={() => setActiveSection("create")}
        >
          <UserPlus size={18} />
          Create User
        </button>

        <button
          type="button"
          className={
            activeSection === "roles" ? "active" : ""
          }
          onClick={() => setActiveSection("roles")}
        >
          <Shield size={18} />
          Roles
        </button>

        <button
          type="button"
          className={
            activeSection === "permissions"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection("permissions")
          }
        >
          <Lock size={18} />
          Permissions
        </button>

        <button
          type="button"
          className={
            activeSection === "status" ? "active" : ""
          }
          onClick={() => setActiveSection("status")}
        >
          <UserCheck size={18} />
          Active / Inactive
        </button>

      </div>

      <main className="um-main">
        {activeSection === "users" && renderUsers()}
        {activeSection === "create" &&
          renderCreateUser()}
        {activeSection === "roles" && renderRoles()}
        {activeSection === "permissions" &&
          renderPermissions()}
        {activeSection === "status" &&
          renderActiveInactive()}
        {activeSection === "activity" &&
          renderActivity()}
      </main>

      {showCreate && (
        <Modal
          title="Create New User"
          icon={<UserPlus size={20} />}
          onClose={closeAllModals}
          isDark={isDark}
        >
          <UserForm
            formData={formData}
            formErrors={formErrors}
            departments={departments}
            roles={SYSTEM_ROLES}
            saving={saving}
            editing={false}
            isDark={isDark}
            updateForm={updateForm}
            onSubmit={handleCreateSubmit}
            onCancel={closeAllModals}
          />
        </Modal>
      )}

      {showEdit && selectedUser && (
        <Modal
          title="Edit User"
          icon={<Edit2 size={20} />}
          onClose={closeAllModals}
          isDark={isDark}
        >
          <UserForm
            formData={formData}
            formErrors={formErrors}
            departments={departments}
            roles={SYSTEM_ROLES}
            saving={saving}
            editing
            isDark={isDark}
            updateForm={updateForm}
            onSubmit={handleEditSubmit}
            onCancel={closeAllModals}
          />
        </Modal>
      )}

      {showDetails && selectedUser && (
        <Modal
          title="User Details"
          icon={<UserCog size={20} />}
          onClose={closeAllModals}
          isDark={isDark}
        >
          <div className="um-details">
            <div className="um-details-profile">
              <div className="um-large-avatar">
                {getUserName(selectedUser)
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h3>
                  {getUserName(selectedUser)}
                </h3>

                <p>
                  @{selectedUser.username || "-"}
                </p>

                <span
                  className={`um-status ${
                    isUserActive(selectedUser)
                      ? "um-status-active"
                      : "um-status-inactive"
                  }`}
                >
                  {isUserActive(selectedUser)
                    ? "Active"
                    : "Inactive"}
                </span>
              </div>
            </div>

            <div className="um-details-grid">
              <DetailItem
                label="Full Name"
                value={getUserName(selectedUser)}
              />

              <DetailItem
                label="Username"
                value={selectedUser.username}
              />

              <DetailItem
                label="Email"
                value={selectedUser.email}
              />

              <DetailItem
                label="Phone"
                value={
                  selectedUser.phone ||
                  selectedUser.phone_number
                }
              />

              <DetailItem
                label="Role"
                value={formatRole(
                  selectedUser.role
                )}
              />

              <DetailItem
                label="Department"
                value={getDepartment(
                  selectedUser
                )}
              />

              <DetailItem
                label="Created Date"
                value={
                  selectedUser.createdAt ||
                  selectedUser.created_at
                }
              />

              <DetailItem
                label="Last Login"
                value={
                  selectedUser.lastLogin ||
                  selectedUser.last_login
                }
              />

              <DetailItem
                label="Account Status"
                value={
                  isUserActive(selectedUser)
                    ? "Login Enabled"
                    : "Login Disabled"
                }
              />
            </div>

            <div className="um-details-actions">
              <button
                type="button"
                className="um-btn um-btn-secondary"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedUser);
                }}
              >
                <Edit2 size={17} />
                Edit User
              </button>

              <button
                type="button"
                className="um-btn um-btn-secondary"
                onClick={() =>
                  resetPassword(selectedUser)
                }
              >
                <KeyRound size={17} />
                Reset Password
              </button>

              <button
                type="button"
                className="um-btn um-btn-danger"
                onClick={() =>
                  handleDelete(selectedUser)
                }
              >
                <Trash2 size={17} />
                Delete User
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .user-management-page {
          min-height: 100vh;
          width: 100%;
          padding: 24px;
          font-family: Inter, Arial, sans-serif;
          transition: background .2s ease, color .2s ease;
        }

        .user-management-page.light {
          background: #f6f8fb;
          color: #172033;
        }

        .user-management-page.dark {
          background: #111827;
          color: #f3f4f6;
        }

        .um-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .um-breadcrumb {
          font-size: 13px;
          color: #718096;
          margin-bottom: 8px;
        }

        .dark .um-breadcrumb {
          color: #94a3b8;
        }

        .um-page-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .um-page-header p {
          margin: 7px 0 0;
          color: #718096;
        }

        .dark .um-page-header p {
          color: #94a3b8;
        }

        .um-header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .um-navigation {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          padding: 7px;
          margin-bottom: 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .dark .um-navigation {
          background: #1f2937;
          border-color: #374151;
        }

        .um-navigation button {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          padding: 11px 15px;
          border: 0;
          background: transparent;
          color: #64748b;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }

        .dark .um-navigation button {
          color: #cbd5e1;
        }

        .um-navigation button:hover {
          background: #f1f5f9;
        }

        .dark .um-navigation button:hover {
          background: #374151;
        }

        .um-navigation button.active {
          background: #2563eb;
          color: white;
        }

        .um-main {
          width: 100%;
        }

        .um-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .um-stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          text-align: left;
          padding: 18px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 12px;
          cursor: pointer;
          color: inherit;
          transition: transform .2s ease, box-shadow .2s ease;
        }

        .dark .um-stat-card {
          background: #1f2937;
          border-color: #374151;
        }

        .um-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(15, 23, 42, .08);
        }

        .um-stat-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #dbeafe;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .um-stat-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .um-stat-info span {
          font-size: 13px;
          color: #64748b;
        }

        .dark .um-stat-info span {
          color: #94a3b8;
        }

        .um-stat-info strong {
          font-size: 25px;
        }

        .um-stat-info small {
          color: #94a3b8;
        }

        .um-toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .um-toolbar.activity {
          margin-top: 4px;
        }

        .um-search {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 280px;
          flex: 1;
          padding: 10px 12px;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
        }

        .dark .um-search {
          background: #111827;
          border-color: #475569;
        }

        .um-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          font-size: 14px;
        }

        .um-search.compact {
          min-width: 0;
          margin: 0 16px 14px;
        }

        .um-icon-button {
          display: flex;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }

        .um-select {
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: white;
          color: #1e293b;
          cursor: pointer;
        }

        .dark .um-select {
          background: #1f2937;
          border-color: #475569;
          color: #f8fafc;
        }

        .um-btn {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border: 0;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s ease;
        }

        .um-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .um-btn-primary {
          background: #2563eb;
          color: white;
        }

        .um-btn-primary:hover {
          background: #1d4ed8;
        }

        .um-btn-secondary {
          background: #e2e8f0;
          color: #1e293b;
        }

        .dark .um-btn-secondary {
          background: #374151;
          color: #f8fafc;
        }

        .um-btn-danger {
          background: #dc2626;
          color: white;
        }

        .um-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .dark .um-card {
          background: #1f2937;
          border-color: #374151;
        }

        .um-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .um-card-header {
          border-color: #374151;
        }

        .um-card-header h3 {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          font-size: 18px;
        }

        .um-card-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .dark .um-card-header p {
          color: #94a3b8;
        }

        .um-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .um-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .um-table th {
          padding: 13px 14px;
          background: #f8fafc;
          color: #475569;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        .dark .um-table th {
          background: #111827;
          color: #cbd5e1;
        }

        .um-table td {
          padding: 13px 14px;
          border-top: 1px solid #e2e8f0;
          font-size: 13px;
          vertical-align: middle;
        }

        .dark .um-table td {
          border-color: #374151;
        }

        .um-table tbody tr:hover {
          background: #f8fafc;
        }

        .dark .um-table tbody tr:hover {
          background: #273449;
        }

        .um-user-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 180px;
        }

        .um-user-cell > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .um-user-cell small {
          color: #94a3b8;
          font-size: 11px;
        }

        .um-avatar,
        .um-large-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #dbeafe;
          color: #1d4ed8;
          font-weight: 800;
          flex: 0 0 auto;
        }

        .um-avatar {
          width: 38px;
          height: 38px;
        }

        .um-large-avatar {
          width: 76px;
          height: 76px;
          font-size: 27px;
        }

        .um-role-badge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .dark .um-role-badge {
          background: #1e3a8a;
          color: #bfdbfe;
        }

        .um-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .um-status-active {
          background: #dcfce7;
          color: #166534;
        }

        .um-status-inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .um-action-group {
          display: flex;
          gap: 5px;
        }

        .um-action {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 7px;
          cursor: pointer;
          color: white;
        }

        .um-action.view {
          background: #0f766e;
        }

        .um-action.edit {
          background: #2563eb;
        }

        .um-action.password {
          background: #7c3aed;
        }

        .um-action.activate {
          background: #16a34a;
        }

        .um-action.deactivate {
          background: #d97706;
        }

        .um-action.delete {
          background: #dc2626;
        }

        .um-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 14px 18px;
          color: #64748b;
          font-size: 13px;
        }

        .um-pagination > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .um-pagination button {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 11px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 7px;
          cursor: pointer;
        }

        .dark .um-pagination button {
          background: #1f2937;
          border-color: #475569;
          color: #f8fafc;
        }

        .um-pagination button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .um-page-number {
          font-weight: 700;
        }

        .um-loading,
        .um-empty {
          min-height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 10px;
          padding: 30px;
          color: #64748b;
        }

        .dark .um-loading,
        .dark .um-empty {
          color: #94a3b8;
        }

        .um-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: um-spin .8s linear infinite;
        }

        @keyframes um-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .um-empty h3 {
          margin: 0;
          color: inherit;
        }

        .um-empty p {
          margin: 0 0 8px;
        }

        .um-create-card {
          max-width: 1000px;
          margin: 0 auto;
        }

        .um-role-layout {
          display: grid;
          grid-template-columns: 350px minmax(0, 1fr);
          gap: 18px;
        }

        .um-role-items {
          padding: 0 12px 12px;
        }

        .um-role-item {
          width: 100%;
          display: grid;
          grid-template-columns: 42px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 12px;
          margin-bottom: 6px;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 9px;
          text-align: left;
          color: inherit;
          cursor: pointer;
        }

        .um-role-item:hover {
          background: #f8fafc;
        }

        .dark .um-role-item:hover {
          background: #273449;
        }

        .um-role-item.selected {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .dark .um-role-item.selected {
          background: #1e3a8a;
          border-color: #2563eb;
        }

        .um-role-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          border-radius: 9px;
          font-size: 20px;
        }

        .dark .um-role-icon {
          background: #374151;
        }

        .um-role-item span:nth-child(2) {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .um-role-item small {
          color: #64748b;
          font-size: 11px;
        }

        .dark .um-role-item small {
          color: #cbd5e1;
        }

        .um-role-item em {
          font-style: normal;
          font-weight: 800;
          color: #2563eb;
        }

        .um-role-summary {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 18px;
        }

        .um-role-summary > div {
          padding: 15px;
          border-radius: 10px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dark .um-role-summary > div {
          background: #111827;
        }

        .um-role-summary strong {
          font-size: 25px;
        }

        .um-role-summary span {
          color: #64748b;
          font-size: 12px;
        }

        .um-users-by-role {
          padding: 0 18px 18px;
        }

        .um-users-by-role h4 {
          margin: 0 0 12px;
        }

        .um-mini-user-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .um-mini-user {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px;
          border: 1px solid #e2e8f0;
          background: transparent;
          color: inherit;
          border-radius: 9px;
          text-align: left;
          cursor: pointer;
        }

        .dark .um-mini-user {
          border-color: #374151;
        }

        .um-mini-user span {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .um-mini-user strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .um-mini-user small {
          color: #94a3b8;
        }

        .um-inline-empty {
          padding: 20px;
          color: #64748b;
        }

        .um-permission-role {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .um-permission-role label {
          font-size: 12px;
          color: #64748b;
        }

        .um-permission-role select {
          min-height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 0 10px;
          background: white;
        }

        .dark .um-permission-role select {
          background: #111827;
          border-color: #475569;
          color: white;
        }

        .um-permission-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
          padding: 18px;
        }

        .um-permission-group {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .dark .um-permission-group {
          border-color: #374151;
        }

        .um-permission-heading {
          display: flex;
          justify-content: space-between;
          padding: 12px 14px;
          background: #f8fafc;
          font-weight: 800;
        }

        .dark .um-permission-heading {
          background: #111827;
        }

        .um-permission-heading small {
          color: #64748b;
        }

        .um-permission-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 14px;
          border-top: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .dark .um-permission-row {
          border-color: #374151;
        }

        .um-permission-row input {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
        }

        .um-permission-row span {
          flex: 1;
          font-size: 13px;
        }

        .um-permission-row em {
          font-style: normal;
          font-size: 10px;
          color: #64748b;
        }

        .um-permission-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 0 18px 18px;
        }

        .um-active-layout {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .um-status-panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .dark .um-status-panel {
          background: #1f2937;
          border-color: #374151;
        }

        .um-status-panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .um-status-panel-header {
          border-color: #374151;
        }

        .um-status-panel-header > div {
          display: flex;
          flex-direction: column;
        }

        .um-status-panel-header p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .um-status-count {
          margin-left: auto;
          font-size: 25px;
          font-weight: 800;
        }

        .um-status-list {
          max-height: 550px;
          overflow-y: auto;
        }

        .um-status-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .um-status-user {
          border-color: #374151;
        }

        .um-status-user-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .um-status-user-info small {
          color: #94a3b8;
        }

        .um-status-user button {
          border: 0;
          border-radius: 7px;
          padding: 7px 9px;
          cursor: pointer;
          color: white;
          background: #2563eb;
        }

        .um-status-user button:last-child {
          background: #64748b;
        }

        .um-activity-badge {
          padding: 5px 7px;
          background: #f1f5f9;
          color: #334155;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .dark .um-activity-badge {
          background: #374151;
          color: #e2e8f0;
        }

        .um-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .65);
        }

        .um-modal {
          width: min(850px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          color: #172033;
          border-radius: 14px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, .25);
        }

        .dark .um-modal {
          background: #1f2937;
          color: #f8fafc;
        }

        .um-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .um-modal-header {
          border-color: #374151;
        }

        .um-modal-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .um-modal-title h3 {
          margin: 0;
        }

        .um-modal-close {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 7px;
          background: #f1f5f9;
          cursor: pointer;
        }

        .dark .um-modal-close {
          background: #374151;
          color: white;
        }

        .um-modal-body {
          padding: 20px;
        }

        .um-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .um-form-group {
          margin-bottom: 15px;
        }

        .um-form-group.full {
          grid-column: 1 / -1;
        }

        .um-form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 700;
        }

        .um-form-group input,
        .um-form-group select {
          width: 100%;
          min-height: 42px;
          padding: 9px 11px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          color: #172033;
          outline: none;
        }

        .dark .um-form-group input,
        .dark .um-form-group select {
          background: #111827;
          border-color: #475569;
          color: #f8fafc;
        }

        .um-form-group input:focus,
        .um-form-group select:focus {
          border-color: #2563eb;
        }

        .um-form-group input.error,
        .um-form-group select.error {
          border-color: #dc2626;
        }

        .um-error {
          display: block;
          margin-top: 4px;
          color: #dc2626;
          font-size: 11px;
        }

        .um-password-wrap {
          position: relative;
        }

        .um-password-wrap input {
          padding-right: 45px;
        }

        .um-password-toggle {
          position: absolute;
          right: 8px;
          top: 7px;
          width: 30px;
          height: 30px;
          border: 0;
          background: transparent;
          cursor: pointer;
          color: #64748b;
        }

        .um-checkbox {
          display: flex !important;
          align-items: center;
          gap: 9px;
          cursor: pointer;
        }

        .um-checkbox input {
          width: 18px !important;
          min-height: 18px !important;
        }

        .um-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding-top: 8px;
        }

        .um-details-profile {
          display: flex;
          align-items: center;
          gap: 15px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .um-details-profile {
          border-color: #374151;
        }

        .um-details-profile h3 {
          margin: 0 0 4px;
          font-size: 22px;
        }

        .um-details-profile p {
          margin: 0 0 8px;
          color: #64748b;
        }

        .um-details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 20px 0;
        }

        .um-detail-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 9px;
        }

        .dark .um-detail-item {
          background: #111827;
        }

        .um-detail-item label {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .um-detail-item strong {
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .um-details-actions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 8px;
        }

        @media (max-width: 1100px) {
          .um-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .um-role-layout,
          .um-active-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .user-management-page {
            padding: 15px;
          }

          .um-page-header {
            flex-direction: column;
          }

          .um-stats-grid {
            grid-template-columns: 1fr;
          }

          .um-permission-grid {
            grid-template-columns: 1fr;
          }

          .um-mini-user-grid {
            grid-template-columns: 1fr;
          }

          .um-form-grid,
          .um-details-grid {
            grid-template-columns: 1fr;
          }

          .um-form-group.full {
            grid-column: auto;
          }

          .um-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .um-pagination {
            align-items: flex-start;
            flex-direction: column;
          }

          .um-permission-role {
            width: 100%;
          }

          .um-permission-role select {
            flex: 1;
          }
        }

        @media (max-width: 550px) {
          .um-search {
            min-width: 100%;
          }

          .um-select,
          .um-toolbar .um-btn {
            width: 100%;
          }

          .um-header-actions {
            width: 100%;
          }

          .um-header-actions .um-btn {
            flex: 1;
          }

          .um-form-actions {
            flex-direction: column-reverse;
          }

          .um-form-actions .um-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const UserForm = ({
  formData,
  formErrors,
  departments,
  roles,
  saving,
  editing,
  isDark,
  updateForm,
  onSubmit,
  onCancel,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  return (
    <form onSubmit={onSubmit}>
      <div className="um-form-grid">
        <div className="um-form-group">
          <label>Full Name *</label>

          <input
            type="text"
            value={formData.fullName}
            onChange={(event) =>
              updateForm(
                "fullName",
                event.target.value
              )
            }
            className={
              formErrors.fullName ? "error" : ""
            }
            placeholder="Enter full name"
          />

          {formErrors.fullName && (
            <span className="um-error">
              {formErrors.fullName}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>Username *</label>

          <input
            type="text"
            value={formData.username}
            onChange={(event) =>
              updateForm(
                "username",
                event.target.value
              )
            }
            className={
              formErrors.username ? "error" : ""
            }
            placeholder="Enter username"
          />

          {formErrors.username && (
            <span className="um-error">
              {formErrors.username}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>Email *</label>

          <input
            type="email"
            value={formData.email}
            onChange={(event) =>
              updateForm("email", event.target.value)
            }
            className={
              formErrors.email ? "error" : ""
            }
            placeholder="user@example.com"
          />

          {formErrors.email && (
            <span className="um-error">
              {formErrors.email}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>Phone</label>

          <input
            type="tel"
            value={formData.phone}
            onChange={(event) =>
              updateForm("phone", event.target.value)
            }
            placeholder="+251..."
          />
        </div>

        <div className="um-form-group">
          <label>
            {editing
              ? "New Password (optional)"
              : "Password *"}
          </label>

          <div className="um-password-wrap">
            <input
              type={
                showPassword ? "text" : "password"
              }
              value={formData.password}
              onChange={(event) =>
                updateForm(
                  "password",
                  event.target.value
                )
              }
              className={
                formErrors.password ? "error" : ""
              }
              placeholder={
                editing
                  ? "Leave blank to keep current password"
                  : "Minimum 6 characters"
              }
            />

            <button
              type="button"
              className="um-password-toggle"
              onClick={() =>
                setShowPassword(
                  (previous) => !previous
                )
              }
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {formErrors.password && (
            <span className="um-error">
              {formErrors.password}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>
            Confirm Password{" "}
            {!editing && "*"}
          </label>

          <div className="um-password-wrap">
            <input
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              value={formData.confirmPassword}
              onChange={(event) =>
                updateForm(
                  "confirmPassword",
                  event.target.value
                )
              }
              className={
                formErrors.confirmPassword
                  ? "error"
                  : ""
              }
              placeholder="Confirm password"
            />

            <button
              type="button"
              className="um-password-toggle"
              onClick={() =>
                setShowConfirmPassword(
                  (previous) => !previous
                )
              }
            >
              {showConfirmPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {formErrors.confirmPassword && (
            <span className="um-error">
              {formErrors.confirmPassword}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>Role *</label>

          <select
            value={formData.role}
            onChange={(event) =>
              updateForm("role", event.target.value)
            }
            className={
              formErrors.role ? "error" : ""
            }
          >
            {roles.map((role) => (
              <option
                key={role.value}
                value={role.value}
              >
                {role.label}
              </option>
            ))}
          </select>

          {formErrors.role && (
            <span className="um-error">
              {formErrors.role}
            </span>
          )}
        </div>

        <div className="um-form-group">
          <label>Department</label>

          <select
            value={formData.department}
            onChange={(event) =>
              updateForm(
                "department",
                event.target.value
              )
            }
          >
            <option value="">
              -- Select Department --
            </option>

            {departments.map((department) => (
              <option
                key={department.id}
                value={
                  department.name ||
                  department.id
                }
              >
                {department.name ||
                  department.department_name ||
                  department.id}
              </option>
            ))}
          </select>
        </div>

        <div className="um-form-group full">
          <label className="um-checkbox">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(event) =>
                updateForm(
                  "active",
                  event.target.checked
                )
              }
            />

            <span>
              Active account / Enable Login
            </span>
          </label>
        </div>
      </div>

      <div className="um-form-actions">
        <button
          type="button"
          className="um-btn um-btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="um-btn um-btn-primary"
          disabled={saving}
        >
          {saving ? (
            <>
              <RefreshCw
                size={17}
                className="um-spin-icon"
              />
              Saving...
            </>
          ) : (
            <>
              {editing ? (
                <Edit2 size={17} />
              ) : (
                <UserPlus size={17} />
              )}

              {editing
                ? "Save Changes"
                : "Create User"}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const Modal = ({
  title,
  icon,
  children,
  onClose,
  isDark,
}) => (
  <div
    className={`um-modal-overlay ${
      isDark ? "dark" : ""
    }`}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div className="um-modal">
      <div className="um-modal-header">
        <div className="um-modal-title">
          {icon}
          <h3>{title}</h3>
        </div>

        <button
          type="button"
          className="um-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={19} />
        </button>
      </div>

      <div className="um-modal-body">
        {children}
      </div>
    </div>
  </div>
);

const DetailItem = ({ label, value }) => (
  <div className="um-detail-item">
    <label>{label}</label>
    <strong>{value || "-"}</strong>
  </div>
);

const LoadingState = () => (
  <div className="um-loading">
    <div className="um-spinner" />
    <strong>Loading...</strong>
    <span>Please wait.</span>
  </div>
);

const EmptyState = ({
  icon,
  title,
  description,
  buttonText,
  onClick,
}) => (
  <div className="um-empty">
    {icon}
    <h3>{title}</h3>
    <p>{description}</p>

    {buttonText && onClick && (
      <button
        type="button"
        className="um-btn um-btn-primary"
        onClick={onClick}
      >
        <Plus size={17} />
        {buttonText}
      </button>
    )}
  </div>
);

const StatusPanel = ({
  title,
  description,
  icon,
  users,
  active,
  onToggle,
  onDetails,
}) => (
  <div className="um-status-panel">
    <div className="um-status-panel-header">
      {icon}

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <span className="um-status-count">
        {users.length}
      </span>
    </div>

    <div className="um-status-list">
      {users.length === 0 ? (
        <div className="um-empty">
          <AlertCircle size={35} />
          <strong>No users</strong>
        </div>
      ) : (
        users.map((user) => (
          <div
            className="um-status-user"
            key={user.id}
          >
            <div className="um-avatar">
              {(user.fullName ||
                user.full_name ||
                user.username ||
                "?")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="um-status-user-info">
              <strong>
                {user.fullName ||
                  user.full_name ||
                  user.username ||
                  "-"}
              </strong>

              <small>
                @{user.username || "-"} •{" "}
                {formatStaticRole(user.role)}
              </small>
            </div>

            <button
              type="button"
              title="View Details"
              onClick={() => onDetails(user)}
            >
              <Eye size={15} />
            </button>

            <button
              type="button"
              title={
                active ? "Deactivate" : "Activate"
              }
              onClick={() => onToggle(user)}
            >
              {active ? (
                <UserX size={15} />
              ) : (
                <UserCheck size={15} />
              )}
            </button>
          </div>
        ))
      )}
    </div>
  </div>
);

const formatStaticRole = (role) => {
  const found = SYSTEM_ROLES.find(
    (item) => item.value === role
  );

  return found ? found.label : role || "-";
};

export default AdminUserManagement;
