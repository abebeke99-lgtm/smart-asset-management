import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "./ui/PageHeader";
import "./AdminRolesPermissions.css";

const ROLE_API = "/api/admin/roles";
const PERMISSION_API = "/api/admin/permissions";
const LOAD_ERROR = "Unable to load roles and permissions. Please try again.";
const EMPTY_MESSAGE = "No roles or permissions found.";

const PERMISSION_TYPES = [
  "View",
  "Create",
  "Edit",
  "Delete",
  "Approve",
  "Assign",
  "Transfer",
  "Maintain",
  "Report",
  "Configure",
];

const getPayloadData = (response) => response?.data?.data ?? response?.data;

const getList = (value, key) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const getRoleId = (role) => String(role?.id ?? role?.roleId ?? role?.role_id ?? "");
const getRoleName = (role) => role?.label || role?.displayName || role?.name || "Unnamed role";
const getPermissionName = (permission) => {
  if (typeof permission === "string") return permission;
  return String(permission?.name || permission?.key || permission?.permissionName || permission?.permission_name || "");
};
const getPermissionModule = (permissionName) => permissionName.split(".")[0] || "other";
const getPermissionType = (permissionName) => {
  const action = permissionName.split(".").at(-1)?.toLowerCase();
  const actionTypes = {
    view: "View",
    create: "Create",
    import: "Create",
    update: "Edit",
    edit: "Edit",
    delete: "Delete",
    approve: "Approve",
    assign: "Assign",
    transfer: "Transfer",
    maintain: "Maintain",
    complete: "Maintain",
    generate: "Report",
    export: "Report",
    print: "Report",
    report: "Report",
    manage: "Configure",
    configure: "Configure",
  };
  return actionTypes[action] || "";
};

const formatLabel = (value) =>
  String(value || "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const responsePermissions = (response) => {
  const payload = getPayloadData(response);
  const values = payload?.permissions ?? response?.data?.permissions ?? [];
  return Array.isArray(values) ? values.map(getPermissionName).filter(Boolean) : [];
};

function AdminRolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [permissionTypeFilter, setPermissionTypeFilter] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [roleResponse, permissionResponse] = await Promise.all([
        apiClient.get(ROLE_API),
        apiClient.get(PERMISSION_API),
      ]);
      const nextRoles = getList(getPayloadData(roleResponse), "roles");
      const nextPermissions = getList(getPayloadData(permissionResponse), "permissions")
        .map(getPermissionName)
        .filter(Boolean);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setSelectedRoleId((current) =>
        nextRoles.some((role) => getRoleId(role) === current)
          ? current
          : getRoleId(nextRoles[0]),
      );
    } catch (loadError) {
      console.error("Roles and permissions loading error:", loadError);
      setRoles([]);
      setPermissions([]);
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog, refreshVersion]);

  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedPermissions([]);
      return undefined;
    }

    if (selectedRoleId === "admin") {
      setSelectedPermissions([...permissions]);
      setPermissionsLoading(false);
      return undefined;
    }

    let active = true;
    setPermissionsLoading(true);
    setError("");
    apiClient
      .get(`${ROLE_API}/${encodeURIComponent(selectedRoleId)}/permissions`)
      .then((response) => {
        if (active) setSelectedPermissions(responsePermissions(response));
      })
      .catch((loadError) => {
        console.error("Role permissions loading error:", loadError);
        if (active) {
          setSelectedPermissions([]);
          setError(LOAD_ERROR);
        }
      })
      .finally(() => {
        if (active) setPermissionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedRoleId, refreshVersion, permissions]);

  const selectedRole = roles.find((role) => getRoleId(role) === selectedRoleId);
  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      `${getRoleName(role)} ${role?.description || ""}`.toLowerCase().includes(query),
    );
  }, [roles, roleSearch]);

  const permissionMatrix = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    return permissions.reduce((groups, permissionName) => {
      if (query && !permissionName.toLowerCase().includes(query)) return groups;
      const permissionType = getPermissionType(permissionName);
      if (permissionTypeFilter && permissionType !== permissionTypeFilter) return groups;
      const moduleName = getPermissionModule(permissionName);
      groups[moduleName] ||= { types: {}, additional: [] };
      if (permissionType) {
        groups[moduleName].types[permissionType] ||= [];
        groups[moduleName].types[permissionType].push(permissionName);
      } else {
        groups[moduleName].additional.push(permissionName);
      }
      return groups;
    }, {});
  }, [permissions, permissionSearch, permissionTypeFilter]);

  const isReadOnlyRole = selectedRoleId === "admin";

  const isDirty = useMemo(() => {
    const rolePermissions = (selectedRole?.permissions || []).map(getPermissionName).sort();
    const currentPermissions = [...selectedPermissions].sort();
    return rolePermissions.length !== currentPermissions.length
      || rolePermissions.some((permission, index) => permission !== currentPermissions[index]);
  }, [selectedPermissions, selectedRole]);

  const togglePermission = (permissionName) => {
    if (isReadOnlyRole) return;
    setSuccess("");
    setSelectedPermissions((current) =>
      current.includes(permissionName)
        ? current.filter((permission) => permission !== permissionName)
        : [...current, permissionName],
    );
  };

  const savePermissions = async () => {
    if (!selectedRoleId || !isDirty) return;
    const revoked = (selectedRole?.permissions || [])
      .map(getPermissionName)
      .filter((permission) => !selectedPermissions.includes(permission));
    if (revoked.length && !window.confirm(`Revoke ${revoked.length} permission${revoked.length === 1 ? "" : "s"} from ${getRoleName(selectedRole)}?`)) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiClient.put(
        `${ROLE_API}/${encodeURIComponent(selectedRoleId)}/permissions`,
        { permissions: selectedPermissions },
      );
      if (response?.data?.success !== true) {
        throw new Error("The backend did not confirm the permission update.");
      }
      const savedPermissions = responsePermissions(response);
      setSelectedPermissions(savedPermissions);
      setRoles((current) =>
        current.map((role) =>
          getRoleId(role) === selectedRoleId
            ? { ...role, permissions: savedPermissions, permissionCount: savedPermissions.length }
            : role,
        ),
      );
      setSuccess("Permissions updated successfully.");
    } catch (saveError) {
      console.error("Role permissions update error:", saveError);
      setError(getApiErrorMessage(saveError, "Unable to update permissions. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => setRefreshVersion((version) => version + 1);

  return (
    <main className="admin-roles-page">
      <div className="admin-roles-heading">
        <PageHeader
          eyebrow="Administrator / Organization"
          title="Roles & Permissions"
          subtitle="Review system roles and configure the permissions assigned to each role."
        />
        <button className="admin-roles-button admin-roles-button-secondary" type="button" onClick={refresh} disabled={loading || saving} aria-label="Refresh roles and permissions">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div className="admin-roles-alert admin-roles-alert-error" role="alert">{error}</div>}
      {success && <div className="admin-roles-alert admin-roles-alert-success" role="status"><Check size={17} aria-hidden="true" />{success}</div>}

      {loading ? (
        <div className="admin-roles-state" role="status">Loading roles and permissions...</div>
      ) : roles.length === 0 || permissions.length === 0 ? (
        <div className="admin-roles-state">{EMPTY_MESSAGE}</div>
      ) : (
        <div className="admin-roles-layout">
          <section className="admin-roles-panel" aria-labelledby="admin-roles-list-title">
            <div className="admin-roles-panel-heading">
              <div>
                <h2 id="admin-roles-list-title">System roles</h2>
                <p>Select a role to inspect its saved permissions.</p>
              </div>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <label className="admin-roles-search">
              <Search size={16} aria-hidden="true" />
              <span className="admin-roles-visually-hidden">Search roles</span>
              <input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Search roles" />
            </label>
            <div className="admin-roles-list">
              {filteredRoles.length === 0 ? (
                <p className="admin-roles-empty">No roles or permissions found.</p>
              ) : filteredRoles.map((role) => {
                const roleId = getRoleId(role);
                return (
                  <button
                    type="button"
                    key={roleId}
                    className={`admin-roles-list-item${roleId === selectedRoleId ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedRoleId(roleId);
                      setSelectedPermissions([]);
                      setSuccess("");
                    }}
                    aria-pressed={roleId === selectedRoleId}
                  >
                    <span className="admin-roles-role-mark" aria-hidden="true">{getRoleName(role).charAt(0).toUpperCase()}</span>
                    <span className="admin-roles-role-copy">
                      <strong>{getRoleName(role)}</strong>
                      <span>{Number(role.permissionCount ?? role.permissions?.length ?? 0)} permissions</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="admin-roles-panel admin-roles-permission-panel" aria-labelledby="admin-role-permissions-title">
            <div className="admin-roles-panel-heading admin-roles-permission-heading">
              <div>
                <h2 id="admin-role-permissions-title">{selectedRole ? getRoleName(selectedRole) : "Role permissions"}</h2>
                <p>{selectedRole?.description || "Permissions loaded from the saved role configuration."}</p>
              </div>
              <div className="admin-roles-actions">
                <button
                  className="admin-roles-button admin-roles-button-primary"
                  type="button"
                  onClick={savePermissions}
                  disabled={!isDirty || saving || permissionsLoading || isReadOnlyRole}
                >
                  <Save size={16} aria-hidden="true" /> {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="admin-roles-permission-filters">
              <label className="admin-roles-search admin-roles-permission-search">
                <Search size={16} aria-hidden="true" />
                <span className="admin-roles-visually-hidden">Search permissions</span>
                <input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search permissions" />
              </label>
              <label className="admin-roles-type-filter">
                <span>Permission type</span>
                <select value={permissionTypeFilter} onChange={(event) => setPermissionTypeFilter(event.target.value)}>
                  <option value="">All types</option>
                  {PERMISSION_TYPES.map((permissionType) => <option key={permissionType} value={permissionType}>{permissionType}</option>)}
                </select>
              </label>
            </div>

            {permissionsLoading ? (
              <div className="admin-roles-state" role="status">Loading role permissions...</div>
            ) : Object.keys(permissionMatrix).length === 0 ? (
              <div className="admin-roles-state">{EMPTY_MESSAGE}</div>
            ) : (
              <div className="admin-roles-matrix-scroll">
                <table className="admin-roles-matrix">
                  <thead>
                    <tr>
                      <th scope="col">Module</th>
                      {PERMISSION_TYPES.map((permissionType) => <th scope="col" key={permissionType}>{permissionType}</th>)}
                      <th scope="col">Other supported permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(permissionMatrix).map(([moduleName, modulePermissions]) => (
                      <tr key={moduleName}>
                        <th scope="row" data-label="Module">{formatLabel(moduleName)}</th>
                        {PERMISSION_TYPES.map((permissionType) => {
                          const names = modulePermissions.types[permissionType] || [];
                          return (
                            <td key={permissionType} data-label={permissionType}>
                              {names.length ? (
                                <div className="admin-roles-permission-items">
                                  {names.map((permissionName) => (
                                    <label className="admin-roles-permission-toggle" key={permissionName}>
                                      <input
                                        type="checkbox"
                                        checked={selectedPermissions.includes(permissionName)}
                                        onChange={() => togglePermission(permissionName)}
                                        disabled={saving || permissionsLoading || isReadOnlyRole}
                                        aria-label={`${permissionName} permission`}
                                      />
                                      <code>{permissionName}</code>
                                    </label>
                                  ))}
                                </div>
                              ) : <span className="admin-roles-not-defined">Not defined</span>}
                            </td>
                          );
                        })}
                        <td data-label="Other supported permissions">
                          {modulePermissions.additional.length ? (
                            <div className="admin-roles-permission-items">
                              {modulePermissions.additional.map((permissionName) => (
                                <label className="admin-roles-permission-toggle" key={permissionName}>
                                  <input
                                    type="checkbox"
                                    checked={selectedPermissions.includes(permissionName)}
                                    onChange={() => togglePermission(permissionName)}
                                    disabled={saving || permissionsLoading}
                                    aria-label={`${permissionName} permission`}
                                  />
                                  <code>{permissionName}</code>
                                </label>
                              ))}
                            </div>
                          ) : <span className="admin-roles-not-defined">Not defined</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default AdminRolesPermissions;
