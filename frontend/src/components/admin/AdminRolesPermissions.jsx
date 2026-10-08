import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Save, Search, ShieldCheck, UserPlus } from "lucide-react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "./ui/PageHeader";
import "./AdminRolesPermissions.css";

const API = "/api/admin/roles-permissions";
const ACTIONS = ["view", "create", "edit", "delete", "approve", "assign", "transfer", "maintain", "report", "configure"];
const HIGH_RISK_ACTIONS = new Set(["delete", "approve", "transfer", "configure"]);
const SCOPES = ["system", "college", "department", "store", "location", "own"];
const SCOPE_LABELS = {
  system: "System-wide",
  college: "College",
  department: "Department",
  store: "Store",
  location: "Location",
  own: "Own records",
};
const responseData = (response) => response?.data?.data ?? [];
const emptyCell = () => ({ state: "none", scopeType: "college" });

const createMatrix = (roles, permissions) => Object.fromEntries(roles.map((role) => {
  const cells = Object.fromEntries(permissions.map((permission) => [permission.id, emptyCell()]));
  (role.permissions || []).forEach((grant) => {
    cells[grant.id] = {
      state: grant.limited ? "limited" : "full",
      scopeType: grant.limited ? grant.scopeType : "system",
    };
  });
  return [String(role.id), cells];
}));

const formatRoleName = (role) => role?.label || role?.displayName || role?.name || "Unnamed role";

function AdminRolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [newRoleId, setNewRoleId] = useState("");
  const [newScopeType, setNewScopeType] = useState("system");
  const [newScopeId, setNewScopeId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editingRoleName, setEditingRoleName] = useState("");
  const [editingRoleDescription, setEditingRoleDescription] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roleResponse, permissionResponse, userResponse] = await Promise.all([
        apiClient.get(`${API}/roles`),
        apiClient.get(`${API}/permissions`),
        apiClient.get(`${API}/users`),
      ]);
      const nextRoles = responseData(roleResponse);
      const nextPermissions = responseData(permissionResponse).sort((left, right) => ACTIONS.indexOf(left.action) - ACTIONS.indexOf(right.action));
      const nextUsers = responseData(userResponse);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setUsers(nextUsers);
      setMatrix(createMatrix(nextRoles, nextPermissions));
      setSelectedUserId((current) => nextUsers.some((user) => String(user.id) === current)
        ? current
        : String(nextUsers[0]?.id || ""));
    } catch (loadError) {
      setRoles([]);
      setPermissions([]);
      setUsers([]);
      setError(getApiErrorMessage(loadError, "Unable to load roles and permissions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshVersion]);

  const selectedUser = users.find((user) => String(user.id) === selectedUserId);
  useEffect(() => {
    setAssignments((selectedUser?.roles || []).map((role) => ({
      roleId: Number(role.id),
      scopeType: role.scopeType || "system",
      scopeId: role.scopeId == null ? "" : String(role.scopeId),
    })));
  }, [selectedUser]);

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      `${formatRoleName(role)} ${role.description || ""}`.toLowerCase().includes(query),
    );
  }, [roles, roleSearch]);

  const setCell = (roleId, permissionId, update) => {
    setMatrix((current) => ({
      ...current,
      [roleId]: {
        ...current[roleId],
        [permissionId]: { ...current[roleId][permissionId], ...update },
      },
    }));
    setSuccess("");
  };

  const changedRoles = useMemo(() => roles.filter((role) => {
    const cells = matrix[String(role.id)] || {};
    const baseline = createMatrix([role], permissions)[String(role.id)] || {};
    return permissions.some((permission) => {
      const current = cells[permission.id] || emptyCell();
      const initial = baseline[permission.id] || emptyCell();
      return current.state !== initial.state
        || (current.state === "limited" && current.scopeType !== initial.scopeType);
    });
  }), [matrix, roles, permissions]);

  const saveMatrix = async () => {
    if (!changedRoles.length) return;
    const criticalChanges = changedRoles.flatMap((role) => permissions
      .filter((permission) => HIGH_RISK_ACTIONS.has(permission.action))
      .filter((permission) => {
        const original = (role.permissions || []).find((grant) => grant.id === permission.id);
        const current = matrix[String(role.id)]?.[permission.id] || emptyCell();
        const originalState = !original ? "none" : original.limited ? "limited" : "full";
        return originalState !== current.state
          || (current.state === "limited" && original?.scopeType !== current.scopeType);
      })
      .map((permission) => `${role.label}: ${permission.action} (${role.userCount} assigned user${role.userCount === 1 ? "" : "s"})`));
    if (criticalChanges.length && !window.confirm(`Confirm these high-risk permission changes:\n${criticalChanges.join("\n")}`)) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiClient.put(`${API}/matrix`, {
        roles: roles.map((role) => ({
          roleId: role.id,
          grants: permissions.map((permission) => ({
            permissionId: permission.id,
            ...(matrix[String(role.id)]?.[permission.id] || emptyCell()),
          })),
        })),
      });
      if (response?.data?.success !== true) throw new Error("The permission matrix was not saved.");
      setSuccess("Permission matrix saved successfully.");
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to save the permission matrix."));
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.post(`${API}/roles`, { name: newRoleName, displayName: newRoleName, description: newRoleDescription });
      setNewRoleName("");
      setNewRoleDescription("");
      setSuccess("Role created successfully.");
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to create the role."));
    } finally {
      setSaving(false);
    }
  };

  const beginRoleEdit = (role) => {
    setEditingRoleId(String(role.id));
    setEditingRoleName(role.label || role.name);
    setEditingRoleDescription(role.description || "");
  };

  const saveRoleEdit = async (event) => {
    event.preventDefault();
    const role = roles.find((item) => String(item.id) === editingRoleId);
    if (!role || !editingRoleName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`${API}/roles/${role.id}`, {
        displayName: editingRoleName.trim(),
        description: editingRoleDescription,
      });
      setEditingRoleId("");
      setSuccess("Role updated successfully.");
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to update this role."));
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleActive = async (role) => {
    if (role.name === "admin") return;
    const action = role.active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${formatRoleName(role)}? This affects ${role.userCount} assigned user${role.userCount === 1 ? "" : "s"}.`)) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`${API}/roles/${role.id}`, { active: !role.active });
      setSuccess(`${formatRoleName(role)} ${action}d.`);
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, `Unable to ${action} this role.`));
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (role.isSystem) return;
    if (!window.confirm(`Delete ${formatRoleName(role)}? This role has ${role.userCount} assigned users.`)) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.delete(`${API}/roles/${role.id}`);
      setSuccess("Role deleted.");
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to delete this role."));
    } finally {
      setSaving(false);
    }
  };

  const searchUsers = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await apiClient.get(`${API}/users?search=${encodeURIComponent(userSearch.trim())}`);
      const nextUsers = responseData(response);
      setUsers(nextUsers);
      setSelectedUserId((current) => nextUsers.some((user) => String(user.id) === current)
        ? current
        : String(nextUsers[0]?.id || ""));
    } catch (searchError) {
      setError(getApiErrorMessage(searchError, "Unable to search users."));
    }
  };

  const addAssignment = () => {
    if (!newRoleId || assignments.some((item) => item.roleId === Number(newRoleId))) return;
    setAssignments((current) => [...current, {
      roleId: Number(newRoleId),
      scopeType: newScopeType,
      scopeId: newScopeType === "system" || newScopeType === "own" ? "" : newScopeId,
    }]);
    setNewRoleId("");
    setNewScopeId("");
  };

  const saveAssignments = async () => {
    if (!selectedUser) return;
    const assignmentsChanged = JSON.stringify(assignments) !== JSON.stringify((selectedUser.roles || []).map((role) => ({
      roleId: Number(role.id),
      scopeType: role.scopeType || "system",
      scopeId: role.scopeId == null ? "" : String(role.scopeId),
    })));
    if (!assignmentsChanged) return;
    const summary = assignments.map((assignment) => {
      const role = roles.find((item) => Number(item.id) === assignment.roleId);
      return `${formatRoleName(role)} (${SCOPE_LABELS[assignment.scopeType]}${assignment.scopeId ? ` #${assignment.scopeId}` : ""})`;
    }).join(", ") || "no roles";
    if (!window.confirm(`Update roles for ${selectedUser.fullName || selectedUser.username} to: ${summary}?`)) return;

    setSaving(true);
    setError("");
    try {
      await apiClient.put(`${API}/users/${selectedUser.id}/roles`, {
        assignments: assignments.map((item) => ({
          roleId: item.roleId,
          scopeType: item.scopeType,
          scopeId: item.scopeId ? Number(item.scopeId) : null,
        })),
      });
      setSuccess("User role assignments updated.");
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to update user roles."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-roles-page">
      <div className="admin-roles-heading">
        <PageHeader eyebrow="Administrator / Organization" title="Roles & Permissions" subtitle="Manage role access and scoped user assignments." />
        <button className="admin-roles-button admin-roles-button-secondary" type="button" onClick={() => setRefreshVersion((value) => value + 1)} disabled={loading || saving} aria-label="Refresh roles and permissions">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>
      {error && <div className="admin-roles-alert admin-roles-alert-error" role="alert">{error}</div>}
      {success && <div className="admin-roles-alert admin-roles-alert-success" role="status"><Check size={17} aria-hidden="true" />{success}</div>}
      {loading ? <div className="admin-roles-state" role="status">Loading roles and permissions...</div> : (
        <>
          <section className="admin-roles-panel" aria-labelledby="roles-heading">
            <div className="admin-roles-panel-heading">
              <div><h2 id="roles-heading">Roles</h2><p>System roles are protected from deletion. Inactive roles cannot be assigned.</p></div>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <form className="admin-roles-permission-filters" onSubmit={createRole}>
              <label className="admin-roles-search"><span>New role name</span><input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} required maxLength={150} /></label>
              <label className="admin-roles-search"><span>Description</span><input value={newRoleDescription} onChange={(event) => setNewRoleDescription(event.target.value)} maxLength={500} /></label>
              <button className="admin-roles-button admin-roles-button-primary" type="submit" disabled={saving || !newRoleName.trim()}><UserPlus size={16} /> Create role</button>
            </form>
            <label className="admin-roles-search"><Search size={16} aria-hidden="true" /><span className="admin-roles-visually-hidden">Search roles</span><input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Search roles" /></label>
            <div className="admin-roles-list">
              {filteredRoles.map((role) => (
                <div className="admin-roles-list-item" key={role.id}>
                  <span className="admin-roles-role-mark" aria-hidden="true">{formatRoleName(role).charAt(0).toUpperCase()}</span>
                  <span className="admin-roles-role-copy"><strong>{formatRoleName(role)}</strong><span>{role.description} · {role.userCount} users · {role.isSystem ? "System" : "Custom"} · {role.active ? "Active" : "Inactive"}</span></span>
                  <button type="button" className="admin-roles-button admin-roles-button-secondary" onClick={() => beginRoleEdit(role)} disabled={saving}>Edit</button>
                  <button type="button" className="admin-roles-button admin-roles-button-secondary" onClick={() => toggleRoleActive(role)} disabled={saving || role.name === "admin"}>{role.active ? "Deactivate" : "Activate"}</button>
                  {!role.isSystem && <button type="button" className="admin-roles-button admin-roles-button-secondary" onClick={() => deleteRole(role)} disabled={saving}>Delete</button>}
                </div>
              ))}
            </div>
            {editingRoleId && (
              <form className="admin-roles-permission-filters" onSubmit={saveRoleEdit}>
                <label className="admin-roles-search"><span>Edit role name</span><input value={editingRoleName} onChange={(event) => setEditingRoleName(event.target.value)} required maxLength={150} /></label>
                <label className="admin-roles-search"><span>Edit description</span><input value={editingRoleDescription} onChange={(event) => setEditingRoleDescription(event.target.value)} maxLength={500} /></label>
                <button className="admin-roles-button admin-roles-button-primary" type="submit" disabled={saving}>Save role</button>
                <button className="admin-roles-button admin-roles-button-secondary" type="button" onClick={() => setEditingRoleId("")}>Cancel</button>
              </form>
            )}
          </section>

          <section className="admin-roles-panel admin-roles-permission-panel" aria-labelledby="matrix-heading">
            <div className="admin-roles-panel-heading">
              <div><h2 id="matrix-heading">Permission matrix</h2><p>Each cell is Full, Limited, or None. Limited is restricted to the selected organizational scope and the user’s assigned scope.</p></div>
              <button className="admin-roles-button admin-roles-button-primary" type="button" onClick={saveMatrix} disabled={saving || !changedRoles.length}><Save size={16} /> Save changes</button>
            </div>
            <div className="admin-roles-matrix-scroll">
              <table className="admin-roles-matrix">
                <thead><tr><th scope="col">Role</th>{ACTIONS.map((action) => <th key={action} scope="col">{action.charAt(0).toUpperCase() + action.slice(1)}</th>)}</tr></thead>
                <tbody>{filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <th scope="row" data-label="Role">{formatRoleName(role)}<small>{role.userCount} users</small></th>
                    {permissions.map((permission) => {
                      const cell = matrix[String(role.id)]?.[permission.id] || emptyCell();
                      return (
                        <td key={permission.id} data-label={permission.action}>
                          <select aria-label={`${formatRoleName(role)} ${permission.action} permission`} value={cell.state} disabled={saving || (role.name === "admin" && permission.action === "configure")} onChange={(event) => setCell(String(role.id), permission.id, { state: event.target.value, scopeType: cell.scopeType })}>
                            <option value="full">Full</option><option value="limited">Limited</option><option value="none">None</option>
                          </select>
                          {cell.state === "limited" && (
                            <select aria-label={`${formatRoleName(role)} ${permission.action} scope`} value={cell.scopeType} disabled={saving} onChange={(event) => setCell(String(role.id), permission.id, { scopeType: event.target.value })}>
                              {SCOPES.filter((scope) => scope !== "system").map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="admin-roles-state">Full = system-wide role grant. Limited = only records matching both the selected scope and the user’s role-assignment scope. None = no grant.</p>
          </section>

          <section className="admin-roles-panel" aria-labelledby="assignment-heading">
            <div className="admin-roles-panel-heading"><div><h2 id="assignment-heading">User role assignments</h2><p>Each role may be assigned with an independent organizational scope.</p></div></div>
            <form className="admin-roles-permission-filters" onSubmit={searchUsers}>
              <label className="admin-roles-search"><span>Find user</span><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Name, username, or email" /></label>
              <button className="admin-roles-button admin-roles-button-secondary" type="submit">Search users</button>
            </form>
            <div className="admin-roles-permission-filters">
              <label className="admin-roles-search"><span>User</span><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username} ({user.username})</option>)}</select></label>
              <label className="admin-roles-search"><span>Role</span><select value={newRoleId} onChange={(event) => setNewRoleId(event.target.value)}><option value="">Choose role</option>{roles.filter((role) => role.active && !assignments.some((item) => item.roleId === role.id)).map((role) => <option key={role.id} value={role.id}>{formatRoleName(role)}</option>)}</select></label>
              <label className="admin-roles-search"><span>Scope</span><select value={newScopeType} onChange={(event) => setNewScopeType(event.target.value)}>{SCOPES.map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}</select></label>
              {!["system", "own"].includes(newScopeType) && <label className="admin-roles-search"><span>Scope ID</span><input type="number" min="1" value={newScopeId} onChange={(event) => setNewScopeId(event.target.value)} /></label>}
              <button className="admin-roles-button admin-roles-button-secondary" type="button" onClick={addAssignment} disabled={!newRoleId || (!["system", "own"].includes(newScopeType) && !newScopeId)}>Add role</button>
            </div>
            <div className="admin-roles-list">{assignments.map((assignment) => {
              const role = roles.find((item) => item.id === assignment.roleId);
              return <div className="admin-roles-list-item" key={assignment.roleId}><span className="admin-roles-role-copy"><strong>{formatRoleName(role)}</strong><span>{SCOPE_LABELS[assignment.scopeType]}{assignment.scopeId ? ` · ID ${assignment.scopeId}` : ""}</span></span><button type="button" className="admin-roles-button admin-roles-button-secondary" onClick={() => setAssignments((current) => current.filter((item) => item.roleId !== assignment.roleId))}>Remove</button></div>;
            })}</div>
            <button className="admin-roles-button admin-roles-button-primary" type="button" onClick={saveAssignments} disabled={saving || !selectedUser}>Save user assignments</button>
          </section>
        </>
      )}
    </main>
  );
}

export default AdminRolesPermissions;
