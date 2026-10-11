import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "./ui/PageHeader";
import "./AdminRolesPermissions.css";

const API = "/api/admin/roles-permissions";
const responseData = (response) => response?.data?.data ?? [];

const formatRoleName = (role) => role?.label || role?.displayName || role?.name || "Unnamed role";

function AdminRolesPermissions() {
  const [roles, setRoles] = useState([]);
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
      const roleResponse = await apiClient.get(`${API}/roles`);
      const nextRoles = responseData(roleResponse);
      setRoles(nextRoles);
    } catch (loadError) {
      setRoles([]);
      setError(getApiErrorMessage(loadError, "Unable to load roles and permissions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshVersion]);

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      `${formatRoleName(role)} ${role.description || ""}`.toLowerCase().includes(query),
    );
  }, [roles, roleSearch]);

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

  return (
    <main className="admin-roles-page">
      <div className="admin-roles-heading">
        <PageHeader eyebrow="Administrator / Organization" title="Roles & Permissions" subtitle="Manage roles and access." />
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

        </>
      )}
    </main>
  );
}

export default AdminRolesPermissions;
