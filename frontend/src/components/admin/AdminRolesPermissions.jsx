import React, { useEffect, useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";

const ROLES_API = "/api/admin/roles";
const PERMISSIONS_API = "/api/admin/permissions";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getHeaders = (json = false) => {
  const headers = {
    Accept: "application/json",
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const apiRequest = async (url, options = {}) => {
  try {
    const response = await apiClient.request({
      url,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });
    const payload = response.data ?? {};
    return {
      ok: true,
      status: response.status,
      json: async () => payload,
      text: async () => typeof payload === "string" ? payload : JSON.stringify(payload),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to complete the roles request."));
  }
};

const normalizeArray = (data, keys = []) => {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const getRoleId = (role) =>
  role?.roleId ??
  role?.role_id ??
  role?.id;

const getRoleName = (role) =>
  role?.name ||
  role?.roleName ||
  role?.role_name ||
  "Unnamed Role";

const getPermissionId = (permission) =>
  permission?.permissionId ??
  permission?.permission_id ??
  permission?.id;

const getPermissionName = (permission) =>
  permission?.name ||
  permission?.permissionName ||
  permission?.permission_name ||
  "";

const getPermissionGroup = (permission) =>
  permission?.group ||
  permission?.module ||
  permission?.category ||
  "General";

const getRoleStatus = (role) => {
  if (
    role?.status === false ||
    role?.isActive === false ||
    role?.active === false
  ) {
    return "Inactive";
  }

  return "Active";
};

const normalizePermissionIds = (role) => {
  const values =
    role?.permissionIds ||
    role?.permission_ids ||
    role?.permissions ||
    [];

  if (!Array.isArray(values)) return [];

  return values
    .map((permission) => {
      if (
        typeof permission === "string" ||
        typeof permission === "number"
      ) {
        return String(permission);
      }

      const id = getPermissionId(permission);

      return id !== undefined && id !== null
        ? String(id)
        : null;
    })
    .filter(Boolean);
};

export default function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] =
    useState(false);

  const [editingRole, setEditingRole] = useState(null);

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    status: "Active",
  });

  const [selectedPermissionIds, setSelectedPermissionIds] =
    useState([]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(ROLES_API, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load roles (${response.status})`
        );
      }

      const data = await response.json();

      setRoles(
        normalizeArray(data, [
          "roles",
          "data",
        ])
      );
    } catch (err) {
      console.error("Roles load error:", err);
      setError(err.message || "Unable to load roles.");
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await apiRequest(PERMISSIONS_API, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        console.warn(
          `Unable to load permissions (${response.status})`
        );
        return;
      }

      const data = await response.json();

      setPermissions(
        normalizeArray(data, [
          "permissions",
          "data",
        ])
      );
    } catch (err) {
      console.warn("Permissions load error:", err);
    }
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return roles;

    return roles.filter((role) => {
      const name = getRoleName(role).toLowerCase();

      const description = String(
        role?.description || ""
      ).toLowerCase();

      return (
        name.includes(query) ||
        description.includes(query)
      );
    });
  }, [roles, search]);

  const permissionGroups = useMemo(() => {
    const groups = {};

    permissions.forEach((permission) => {
      const group = getPermissionGroup(permission);

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(permission);
    });

    return groups;
  }, [permissions]);

  const activeRoles = roles.filter(
    (role) => getRoleStatus(role) === "Active"
  ).length;

  const inactiveRoles = roles.filter(
    (role) => getRoleStatus(role) === "Inactive"
  ).length;

  const openCreateRole = () => {
    setEditingRole(null);

    setRoleForm({
      name: "",
      description: "",
      status: "Active",
    });

    setError("");
    setSuccess("");
    setShowRoleModal(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);

    setRoleForm({
      name: getRoleName(role),
      description: role?.description || "",
      status: getRoleStatus(role),
    });

    setError("");
    setSuccess("");
    setShowRoleModal(true);
  };

  const openPermissionModal = (role) => {
    setSelectedRole(role);
    setSelectedPermissionIds(
      normalizePermissionIds(role)
    );

    setError("");
    setSuccess("");
    setShowPermissionModal(true);
  };

  const closeRoleModal = () => {
    if (saving) return;

    setShowRoleModal(false);
    setEditingRole(null);
  };

  const closePermissionModal = () => {
    if (saving) return;

    setShowPermissionModal(false);
    setSelectedRole(null);
    setSelectedPermissionIds([]);
  };

  const handleRoleChange = (event) => {
    const { name, value } = event.target;

    setRoleForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRoleSubmit = async (event) => {
    event.preventDefault();

    if (!roleForm.name.trim()) {
      setError("Role name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editing = Boolean(editingRole);
      const roleId = getRoleId(editingRole);

      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        status: roleForm.status,
        isActive: roleForm.status === "Active",
      };

      const url = editing
        ? `${ROLES_API}/${roleId}`
        : ROLES_API;

      const response = await apiRequest(url, {
        method: editing ? "PUT" : "POST",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Request failed (${response.status})`
        );
      }

      setSuccess(
        editing
          ? "Role updated successfully."
          : "Role created successfully."
      );

      setShowRoleModal(false);
      setEditingRole(null);

      await loadRoles();
    } catch (err) {
      console.error("Role save error:", err);
      setError(err.message || "Unable to save role.");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId) => {
    const id = String(permissionId);

    setSelectedPermissionIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  };

  const togglePermissionGroup = (groupPermissions) => {
    const ids = groupPermissions
      .map(getPermissionId)
      .filter((id) => id !== undefined && id !== null)
      .map(String);

    const allSelected = ids.every((id) =>
      selectedPermissionIds.includes(id)
    );

    setSelectedPermissionIds((current) => {
      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      }

      return Array.from(
        new Set([...current, ...ids])
      );
    });
  };

  const selectAllPermissions = () => {
    const ids = permissions
      .map(getPermissionId)
      .filter((id) => id !== undefined && id !== null)
      .map(String);

    setSelectedPermissionIds(ids);
  };

  const clearAllPermissions = () => {
    setSelectedPermissionIds([]);
  };

  const savePermissions = async () => {
    if (!selectedRole) {
      setError("No role selected.");
      return;
    }

    const roleId = getRoleId(selectedRole);

    if (!roleId) {
      setError("Role ID is missing.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        permissionIds: selectedPermissionIds,
        permissions: selectedPermissionIds,
      };

      const response = await apiRequest(
        `${ROLES_API}/${roleId}/permissions`,
        {
          method: "PUT",
          headers: getHeaders(true),
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();

      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Unable to update permissions (${response.status})`
        );
      }

      setSuccess("Role permissions updated successfully.");

      setShowPermissionModal(false);

      await loadRoles();
    } catch (err) {
      console.error("Permission save error:", err);
      setError(
        err.message ||
          "Unable to update role permissions."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleStatus = async (role) => {
    const roleId = getRoleId(role);

    if (!roleId) {
      setError("Role ID is missing.");
      return;
    }

    const currentStatus = getRoleStatus(role);

    const newStatus =
      currentStatus === "Active"
        ? "Inactive"
        : "Active";

    const confirmed = window.confirm(
      `${newStatus === "Active" ? "Activate" : "Deactivate"} "${getRoleName(
        role
      )}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await apiRequest(
        `${ROLES_API}/${roleId}`,
        {
          method: "PUT",
          headers: getHeaders(true),
          body: JSON.stringify({
            ...role,
            status: newStatus,
            isActive: newStatus === "Active",
          }),
        }
      );

      const text = await response.text();

      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Unable to update role (${response.status})`
        );
      }

      setSuccess(
        `Role ${newStatus === "Active"
          ? "activated"
          : "deactivated"} successfully.`
      );

      await loadRoles();
    } catch (err) {
      console.error("Role status error:", err);
      setError(
        err.message ||
          "Unable to update role status."
      );
    }
  };

  const deleteRole = async (role) => {
    const roleId = getRoleId(role);

    if (!roleId) {
      setError("Role ID is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Delete role "${getRoleName(role)}"?\n\nThis may fail if users are still assigned to this role.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await apiRequest(
        `${ROLES_API}/${roleId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const text = await response.text();

      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Unable to delete role (${response.status})`
        );
      }

      setSuccess("Role deleted successfully.");

      await loadRoles();
    } catch (err) {
      console.error("Role delete error:", err);
      setError(
        err.message || "Unable to delete role."
      );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / Organization / Roles & Permissions
          </div>

          <h1 style={styles.title}>
            Roles & Permissions
          </h1>

          <p style={styles.subtitle}>
            Manage administrative roles and control which
            system permissions are assigned to each role.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateRole}
          style={styles.primaryButton}
        >
          <span style={styles.plus}>＋</span>
          Add Role
        </button>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError("")}
        />
      )}

      {success && (
        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      )}

      <div style={styles.statsGrid}>
        <StatCard
          label="Total Roles"
          value={roles.length}
          icon="♙"
          accent="#2563EB"
        />

        <StatCard
          label="Active Roles"
          value={activeRoles}
          icon="✓"
          accent="#16A34A"
        />

        <StatCard
          label="Inactive Roles"
          value={inactiveRoles}
          icon="◷"
          accent="#DC2626"
        />

        <StatCard
          label="Available Permissions"
          value={permissions.length}
          icon="◆"
          accent="#F4C542"
        />
      </div>

      <div style={styles.layout}>
        <div style={styles.rolesCard}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>System Roles</h2>

              <p style={styles.cardSubtitle}>
                Select a role to manage its access permissions.
              </p>
            </div>

            <button
              type="button"
              onClick={loadRoles}
              style={styles.refreshButton}
            >
              ↻
            </button>
          </div>

          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search roles..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.rolesList}>
            {loading ? (
              <div style={styles.centerState}>
                <div style={styles.spinner} />
                Loading roles...
              </div>
            ) : filteredRoles.length === 0 ? (
              <div style={styles.centerState}>
                <div style={styles.emptyIcon}>♙</div>
                <strong>No roles found</strong>
                <span>
                  Create a role or change your search.
                </span>
              </div>
            ) : (
              filteredRoles.map((role, index) => {
                const roleId =
                  getRoleId(role) ?? index;

                const isSelected =
                  selectedRole &&
                  String(getRoleId(selectedRole)) ===
                    String(roleId);

                const permissionCount =
                  normalizePermissionIds(role).length;

                return (
                  <button
                    type="button"
                    key={String(roleId)}
                    onClick={() => setSelectedRole(role)}
                    style={{
                      ...styles.roleItem,
                      ...(isSelected
                        ? styles.roleItemSelected
                        : {}),
                    }}
                  >
                    <div style={styles.roleIcon}>
                      {getRoleName(role)
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div style={styles.roleInfo}>
                      <div style={styles.roleName}>
                        {getRoleName(role)}
                      </div>

                      <div style={styles.roleMeta}>
                        {permissionCount} permission
                        {permissionCount === 1
                          ? ""
                          : "s"}
                      </div>
                    </div>

                    <StatusBadge
                      status={getRoleStatus(role)}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={styles.permissionCard}>
          {selectedRole ? (
            <>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.selectedRoleTitle}>
                    <div style={styles.selectedRoleIcon}>
                      {getRoleName(selectedRole)
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <h2 style={styles.cardTitle}>
                        {getRoleName(selectedRole)}
                      </h2>

                      <p style={styles.cardSubtitle}>
                        {selectedRole?.description ||
                          "No role description provided."}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={styles.headerActions}>
                  <button
                    type="button"
                    onClick={() =>
                      openEditRole(selectedRole)
                    }
                    style={styles.secondaryButton}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openPermissionModal(selectedRole)
                    }
                    style={styles.primaryButton}
                  >
                    Manage Permissions
                  </button>
                </div>
              </div>

              <div style={styles.roleSummary}>
                <SummaryItem
                  label="Status"
                  value={getRoleStatus(selectedRole)}
                />

                <SummaryItem
                  label="Permissions"
                  value={
                    normalizePermissionIds(
                      selectedRole
                    ).length
                  }
                />

                <SummaryItem
                  label="Role ID"
                  value={String(
                    getRoleId(selectedRole) || "—"
                  )}
                />
              </div>

              <div style={styles.permissionSection}>
                <div style={styles.sectionTitle}>
                  Assigned Permissions
                </div>

                {permissions.length === 0 ? (
                  <div style={styles.noPermissions}>
                    No permissions are available from the
                    permissions API.
                  </div>
                ) : (
                  <div style={styles.permissionGroups}>
                    {Object.entries(permissionGroups).map(
                      ([group, groupPermissions]) => {
                        const selectedIds =
                          normalizePermissionIds(
                            selectedRole
                          );

                        const assigned =
                          groupPermissions.filter(
                            (permission) =>
                              selectedIds.includes(
                                String(
                                  getPermissionId(
                                    permission
                                  )
                                )
                              )
                          ).length;

                        return (
                          <div
                            key={group}
                            style={styles.permissionGroup}
                          >
                            <div
                              style={
                                styles.permissionGroupHeader
                              }
                            >
                              <div>
                                <div
                                  style={
                                    styles.permissionGroupTitle
                                  }
                                >
                                  {group}
                                </div>

                                <div
                                  style={
                                    styles.permissionGroupMeta
                                  }
                                >
                                  {assigned} of{" "}
                                  {groupPermissions.length}{" "}
                                  assigned
                                </div>
                              </div>
                            </div>

                            <div
                              style={
                                styles.permissionGrid
                              }
                            >
                              {groupPermissions.map(
                                (
                                  permission,
                                  permissionIndex
                                ) => {
                                  const permissionId =
                                    getPermissionId(
                                      permission
                                    ) ??
                                    permissionIndex;

                                  const checked =
                                    selectedIds.includes(
                                      String(
                                        permissionId
                                      )
                                    );

                                  return (
                                    <div
                                      key={String(
                                        permissionId
                                      )}
                                      style={
                                        styles.permissionItem
                                      }
                                    >
                                      <span
                                        style={{
                                          ...styles.permissionCheck,
                                          ...(checked
                                            ? styles.permissionCheckActive
                                            : {}),
                                        }}
                                      >
                                        {checked
                                          ? "✓"
                                          : ""}
                                      </span>

                                      <span>
                                        {getPermissionName(
                                          permission
                                        ) ||
                                          "Unnamed permission"}
                                      </span>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.selectRoleState}>
              <div style={styles.selectRoleIcon}>♙</div>

              <h2 style={styles.selectRoleTitle}>
                Select a Role
              </h2>

              <p style={styles.selectRoleText}>
                Choose a role from the list to view its
                permissions and manage access.
              </p>
            </div>
          )}
        </div>
      </div>

      {showRoleModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRoleModal();
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingRole
                    ? "Edit Role"
                    : "Create Role"}
                </h2>

                <p style={styles.modalSubtitle}>
                  Configure the basic role information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRoleModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRoleSubmit}>
              <div style={styles.formBody}>
                <label style={styles.formField}>
                  <span style={styles.formLabel}>
                    Role Name <b>*</b>
                  </span>

                  <input
                    name="name"
                    value={roleForm.name}
                    onChange={handleRoleChange}
                    placeholder="e.g. Asset Manager"
                    style={styles.input}
                    required
                  />
                </label>

                <label style={styles.formField}>
                  <span style={styles.formLabel}>
                    Description
                  </span>

                  <textarea
                    name="description"
                    value={roleForm.description}
                    onChange={handleRoleChange}
                    placeholder="Describe the responsibilities of this role..."
                    rows="4"
                    style={{
                      ...styles.input,
                      resize: "vertical",
                    }}
                  />
                </label>

                <label style={styles.formField}>
                  <span style={styles.formLabel}>
                    Status
                  </span>

                  <select
                    name="status"
                    value={roleForm.status}
                    onChange={handleRoleChange}
                    style={styles.input}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={closeRoleModal}
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingRole
                    ? "Update Role"
                    : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPermissionModal && selectedRole && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePermissionModal();
            }
          }}
        >
          <div style={styles.permissionModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Manage Permissions
                </h2>

                <p style={styles.modalSubtitle}>
                  Assign permissions to{" "}
                  <strong>
                    {getRoleName(selectedRole)}
                  </strong>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={closePermissionModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.permissionToolbar}>
              <span>
                <strong>
                  {selectedPermissionIds.length}
                </strong>{" "}
                selected
              </span>

              <div style={styles.permissionToolbarActions}>
                <button
                  type="button"
                  onClick={selectAllPermissions}
                  style={styles.linkButton}
                >
                  Select all
                </button>

                <button
                  type="button"
                  onClick={clearAllPermissions}
                  style={styles.linkButton}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div style={styles.permissionModalBody}>
              {permissions.length === 0 ? (
                <div style={styles.noPermissions}>
                  No permissions are available.
                </div>
              ) : (
                Object.entries(permissionGroups).map(
                  ([group, groupPermissions]) => {
                    const ids = groupPermissions
                      .map(getPermissionId)
                      .filter(
                        (id) =>
                          id !== undefined &&
                          id !== null
                      )
                      .map(String);

                    const allSelected =
                      ids.length > 0 &&
                      ids.every((id) =>
                        selectedPermissionIds.includes(
                          id
                        )
                      );

                    return (
                      <div
                        key={group}
                        style={styles.modalPermissionGroup}
                      >
                        <div
                          style={
                            styles.modalPermissionHeader
                          }
                        >
                          <div>
                            <div
                              style={
                                styles.permissionGroupTitle
                              }
                            >
                              {group}
                            </div>

                            <div
                              style={
                                styles.permissionGroupMeta
                              }
                            >
                              {groupPermissions.length}{" "}
                              permission
                              {groupPermissions.length === 1
                                ? ""
                                : "s"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              togglePermissionGroup(
                                groupPermissions
                              )
                            }
                            style={styles.smallButton}
                          >
                            {allSelected
                              ? "Clear group"
                              : "Select group"}
                          </button>
                        </div>

                        <div
                          style={styles.modalPermissionGrid}
                        >
                          {groupPermissions.map(
                            (
                              permission,
                              index
                            ) => {
                              const permissionId =
                                getPermissionId(
                                  permission
                                ) ?? index;

                              const id = String(
                                permissionId
                              );

                              const checked =
                                selectedPermissionIds.includes(
                                  id
                                );

                              return (
                                <label
                                  key={id}
                                  style={{
                                    ...styles.checkboxRow,
                                    ...(checked
                                      ? styles.checkboxRowActive
                                      : {}),
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      togglePermission(
                                        permissionId
                                      )
                                    }
                                    style={
                                      styles.checkbox
                                    }
                                  />

                                  <span>
                                    {getPermissionName(
                                      permission
                                    ) ||
                                      "Unnamed permission"}
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={closePermissionModal}
                style={styles.cancelButton}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={savePermissions}
                style={styles.primaryButton}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Alert({ type, message, onClose }) {
  const isError = type === "error";

  return (
    <div
      style={{
        ...styles.alert,
        background: isError ? "#FEF2F2" : "#F0FDF4",
        color: isError ? "#991B1B" : "#166534",
        borderColor: isError ? "#FECACA" : "#BBF7D0",
      }}
    >
      <span>{isError ? "⚠" : "✓"}</span>
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
        style={styles.alertClose}
      >
        ×
      </button>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={styles.statCard}>
      <div
        style={{
          ...styles.statIcon,
          background: `${accent}18`,
          color: accent,
        }}
      >
        {icon}
      </div>

      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const active = status === "Active";

  return (
    <span
      style={{
        ...styles.statusBadge,
        background: active ? "#DCFCE7" : "#FEE2E2",
        color: active ? "#15803D" : "#B91C1C",
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: active ? "#16A34A" : "#DC2626",
        }}
      />
      {status}
    </span>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "28px",
    background: "#F3F6F9",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "24px",
  },

  breadcrumb: {
    color: "#64748B",
    fontSize: "13px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.2,
    fontWeight: 750,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "720px",
  },

  primaryButton: {
    border: "none",
    borderRadius: "9px",
    background: "#2563EB",
    color: "#FFFFFF",
    padding: "11px 16px",
    minHeight: "42px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    whiteSpace: "nowrap",
  },

  plus: {
    fontSize: "18px",
  },

  alert: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    border: "1px solid",
    borderRadius: "9px",
    fontSize: "14px",
  },

  alertClose: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "20px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  statCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow:
      "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: 700,
    flexShrink: 0,
  },

  statLabel: {
    color: "#64748B",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "4px",
  },

  statValue: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: 750,
  },

  layout: {
    display: "grid",
    gridTemplateColumns:
      "minmax(270px, 340px) minmax(0, 1fr)",
    gap: "18px",
    alignItems: "start",
  },

  rolesCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow:
      "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  permissionCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    minHeight: "500px",
    overflow: "hidden",
    boxShadow:
      "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  cardHeader: {
    padding: "18px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
  },

  cardTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "17px",
    fontWeight: 750,
  },

  cardSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  refreshButton: {
    width: "36px",
    height: "36px",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    borderRadius: "8px",
    color: "#475569",
    cursor: "pointer",
    fontSize: "18px",
  },

  searchBox: {
    margin: "14px",
    position: "relative",
  },

  searchIcon: {
    position: "absolute",
    left: "11px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94A3B8",
    fontSize: "20px",
  },

  searchInput: {
    width: "100%",
    height: "40px",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "0 11px 0 35px",
    outline: "none",
    fontSize: "13px",
  },

  rolesList: {
    borderTop: "1px solid #F1F5F9",
  },

  roleItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #F1F5F9",
    background: "#FFFFFF",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textAlign: "left",
    cursor: "pointer",
  },

  roleItemSelected: {
    background: "#EFF6FF",
    boxShadow: "inset 3px 0 0 #2563EB",
  },

  roleIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "#E0F2FE",
    color: "#0369A1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    flexShrink: 0,
  },

  roleInfo: {
    flex: 1,
    minWidth: 0,
  },

  roleName: {
    color: "#1E293B",
    fontSize: "13px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  roleMeta: {
    color: "#94A3B8",
    fontSize: "11px",
    marginTop: "3px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "999px",
    padding: "5px 8px",
    fontSize: "10px",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },

  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },

  centerState: {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    color: "#64748B",
    fontSize: "13px",
    textAlign: "center",
    padding: "20px",
  },

  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #DBEAFE",
    borderTopColor: "#2563EB",
    borderRadius: "50%",
    marginBottom: "4px",
  },

  emptyIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94A3B8",
    fontSize: "22px",
    marginBottom: "5px",
  },

  selectedRoleTitle: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
  },

  selectedRoleIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "9px",
    background: "#E0F2FE",
    color: "#0369A1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: 800,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  secondaryButton: {
    minHeight: "40px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "0 13px",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
  },

  roleSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    borderBottom: "1px solid #E5E7EB",
  },

  summaryItem: {
    padding: "14px 18px",
    borderRight: "1px solid #E5E7EB",
  },

  summaryLabel: {
    color: "#64748B",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 750,
    marginBottom: "5px",
  },

  summaryValue: {
    color: "#1E293B",
    fontSize: "14px",
    fontWeight: 700,
  },

  permissionSection: {
    padding: "18px",
  },

  sectionTitle: {
    color: "#1E293B",
    fontSize: "14px",
    fontWeight: 750,
    marginBottom: "14px",
  },

  permissionGroups: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  permissionGroup: {
    border: "1px solid #E2E8F0",
    borderRadius: "9px",
    overflow: "hidden",
  },

  permissionGroupHeader: {
    padding: "11px 13px",
    background: "#F8FAFC",
    borderBottom: "1px solid #E2E8F0",
  },

  permissionGroupTitle: {
    color: "#334155",
    fontSize: "12px",
    fontWeight: 750,
  },

  permissionGroupMeta: {
    color: "#94A3B8",
    fontSize: "10px",
    marginTop: "3px",
  },

  permissionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1px",
    background: "#E2E8F0",
  },

  permissionItem: {
    background: "#FFFFFF",
    minHeight: "42px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#475569",
    fontSize: "12px",
  },

  permissionCheck: {
    width: "17px",
    height: "17px",
    borderRadius: "4px",
    border: "1px solid #CBD5E1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: 800,
    flexShrink: 0,
  },

  permissionCheckActive: {
    background: "#2563EB",
    borderColor: "#2563EB",
  },

  selectRoleState: {
    minHeight: "500px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "30px",
  },

  selectRoleIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "#EFF6FF",
    color: "#2563EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    marginBottom: "15px",
  },

  selectRoleTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#1E293B",
  },

  selectRoleText: {
    maxWidth: "400px",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: "7px 0 0",
  },

  noPermissions: {
    padding: "25px",
    textAlign: "center",
    background: "#F8FAFC",
    border: "1px dashed #CBD5E1",
    borderRadius: "9px",
    color: "#64748B",
    fontSize: "13px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    overflowY: "auto",
  },

  modal: {
    width: "min(520px, 100%)",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow:
      "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  permissionModal: {
    width: "min(900px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    background: "#FFFFFF",
    borderRadius: "14px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    padding: "19px 21px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "15px",
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "19px",
    fontWeight: 750,
  },

  modalSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "12px",
  },

  modalClose: {
    width: "34px",
    height: "34px",
    border: "none",
    borderRadius: "8px",
    background: "#F1F5F9",
    color: "#475569",
    cursor: "pointer",
    fontSize: "20px",
  },

  formBody: {
    padding: "21px",
    display: "flex",
    flexDirection: "column",
    gap: "17px",
  },

  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  formLabel: {
    color: "#334155",
    fontSize: "12px",
    fontWeight: 700,
  },

  input: {
    width: "100%",
    minHeight: "41px",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "9px 11px",
    outline: "none",
    color: "#111827",
    fontSize: "13px",
    background: "#FFFFFF",
  },

  modalFooter: {
    padding: "14px 21px",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },

  cancelButton: {
    minHeight: "42px",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    color: "#475569",
    borderRadius: "8px",
    padding: "0 15px",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
  },

  permissionToolbar: {
    padding: "12px 18px",
    background: "#F8FAFC",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    color: "#64748B",
    fontSize: "12px",
  },

  permissionToolbarActions: {
    display: "flex",
    gap: "10px",
  },

  linkButton: {
    border: "none",
    background: "transparent",
    color: "#2563EB",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
  },

  permissionModalBody: {
    padding: "16px 18px",
    overflowY: "auto",
    flex: 1,
  },

  modalPermissionGroup: {
    border: "1px solid #E2E8F0",
    borderRadius: "9px",
    marginBottom: "12px",
    overflow: "hidden",
  },

  modalPermissionHeader: {
    padding: "11px 13px",
    background: "#F8FAFC",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },

  smallButton: {
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    color: "#475569",
    borderRadius: "6px",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 650,
    cursor: "pointer",
  },

  modalPermissionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "10px 12px",
    borderBottom: "1px solid #F1F5F9",
    color: "#475569",
    fontSize: "12px",
    cursor: "pointer",
  },

  checkboxRowActive: {
    background: "#EFF6FF",
    color: "#1E40AF",
  },

  checkbox: {
    width: "15px",
    height: "15px",
    accentColor: "#2563EB",
    cursor: "pointer",
    flexShrink: 0,
  },
};