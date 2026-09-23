import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../utils/api';
import { Activity, Check, ChevronRight, CircleOff, Eye, KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';

const STATUS_OPTIONS = ['all', 'active', 'inactive'];

const formatPermissionLabel = (permission) =>
  String(permission || '')
    .split('.')
    .filter(Boolean)
    .map((part) => part.replace(/[_-]+/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

const normalizeStatus = (value) => {
  const normalized = String(value || 'active').toLowerCase();
  return normalized === 'inactive' ? 'inactive' : 'active';
};

const styles = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 },
  breadcrumb: { color: '#64748b', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 },
  title: { margin: 0, fontSize: 32, color: '#0f172a' },
  subtitle: { margin: '8px 0 0', color: '#475569', fontSize: 15 },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  primaryBtn: { border: 'none', background: '#2563eb', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 },
  secondaryBtn: { border: '1px solid #dbe3ee', background: '#fff', color: '#0f172a', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 },
  dangerBtn: { border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 22 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)', padding: 18 },
  statCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14 },
  statIcon: { width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', display: 'grid', placeItems: 'center' },
  statValue: { fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  statMeta: { fontSize: 12, color: '#475569', marginTop: 4 },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
  searchWrap: { position: 'relative', flex: 1, minWidth: 220 },
  searchInput: { width: '100%', border: '1px solid #d9dfeb', borderRadius: 10, padding: '10px 14px 10px 38px', fontSize: 14, outline: 'none' },
  iconLeft: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' },
  select: { border: '1px solid #d9dfeb', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#fff', minWidth: 150 },
  tableWrap: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 920 },
  th: { textAlign: 'left', padding: '14px 16px', background: '#f8fafc', fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#0f172a', fontSize: 14, verticalAlign: 'top' },
  roleName: { fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  roleMeta: { color: '#64748b', fontSize: 12 },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, border: '1px solid #dbe3ee', fontWeight: 600, fontSize: 12, background: '#f8fafc' },
  badgeActive: { background: '#ecfdf5', borderColor: '#bbf7d0', color: '#166534' },
  badgeInactive: { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' },
  smallAction: { border: '1px solid #dbe3ee', background: '#fff', color: '#0f172a', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  actionGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginTop: 20 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 },
  panelTitle: { margin: 0, fontSize: 22, color: '#0f172a' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(240px, 2fr)', gap: 20 },
  infoCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  detailLabel: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 },
  detailValue: { color: '#0f172a', fontSize: 16, fontWeight: 600 },
  permissionList: { display: 'grid', gap: 12 },
  permissionSection: { border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: 14 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontWeight: 700, color: '#0f172a' },
  permissionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #e2e8f0', padding: '10px 0', color: '#0f172a' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 12, flex: 1 },
  checkbox: { width: 16, height: 16, accentColor: '#2563eb' },
  unsaved: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', color: '#9a5b00', fontSize: 14 },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: '#64748b' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.3)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 40 },
  modal: { width: 'min(540px, 100%)', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { margin: 0, fontSize: 23, color: '#0f172a' },
  form: { display: 'grid', gap: 14 },
  field: { display: 'grid', gap: 8 },
  input: { width: '100%', border: '1px solid #d9dfeb', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 96, border: '1px solid #d9dfeb', borderRadius: 10, padding: '10px 12px', fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 18 },
};

export default function AdminRolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'active' });
  const [formError, setFormError] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.name === selectedRoleName) || null,
    [roles, selectedRoleName]
  );

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesSearch = !query || [role.name, role.label, role.description].join(' ').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || normalizeStatus(role.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [roles, search, statusFilter]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map();
    permissions.forEach((permission) => {
      const [groupKey] = String(permission.name || permission.key || permission || '').split('.');
      const key = groupKey || 'general';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(permission);
    });

    return Array.from(groups.entries()).map(([groupKey, groupPermissions]) => ({
      key: groupKey,
      label: groupKey.split(/[_-]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      permissions: groupPermissions.filter((permission) => {
        const label = String(permission.name || permission.key || permission).toLowerCase();
        const query = permissionSearch.trim().toLowerCase();
        return !query || label.includes(query) || formatPermissionLabel(permission.name || permission.key || permission).toLowerCase().includes(query);
      }),
    })).filter((group) => group.permissions.length > 0);
  }, [permissions, permissionSearch]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedRole) return false;
    const base = new Set((selectedRole.permissions || []).map((value) => String(value)));
    const current = new Set(selectedPermissions.map((value) => String(value)));
    if (base.size !== current.size) return true;
    for (const value of base) {
      if (!current.has(value)) return true;
    }
    return false;
  }, [selectedPermissions, selectedRole]);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/admin/roles');
      const list = Array.isArray(response.data?.roles)
        ? response.data.roles
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
      setRoles(list);
      if (!selectedRoleName && list[0]) {
        setSelectedRoleName(list[0].name || list[0].id);
      }
      if (selectedRoleName && !list.some((role) => (role.name || role.id) === selectedRoleName)) {
        setSelectedRoleName(list[0]?.name || list[0]?.id || '');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load roles. Please try again.');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const response = await apiClient.get('/api/admin/permissions');
      const list = Array.isArray(response.data?.permissions)
        ? response.data.permissions
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
      setPermissions(list);
    } catch (requestError) {
      setError((current) => current || (requestError.response?.data?.message || 'Unable to load permissions.'));
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const loadSelectedPermissions = async (roleName) => {
    if (!roleName) {
      setSelectedPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    try {
      const response = await apiClient.get(`/api/admin/roles/${encodeURIComponent(roleName)}/permissions`);
      const permissionsList = response.data?.permissions || response.data?.data?.permissions || [];
      setSelectedPermissions(Array.isArray(permissionsList) ? permissionsList : []);
    } catch (requestError) {
      setSelectedPermissions([]);
      setError((current) => current || (requestError.response?.data?.message || 'Unable to load role permissions.'));
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  useEffect(() => {
    if (!selectedRoleName && roles.length) {
      setSelectedRoleName(roles[0].name || roles[0].id);
    }
  }, [roles, selectedRoleName]);

  useEffect(() => {
    if (selectedRoleName) {
      loadSelectedPermissions(selectedRoleName);
    }
  }, [selectedRoleName]);

  const handleCreateRole = async (event) => {
    event.preventDefault();
    setFormError('');
    const trimmedName = String(form.name || '').trim();
    if (!trimmedName) {
      setFormError('Role name is required.');
      return;
    }
    if (trimmedName.length > 100) {
      setFormError('Role name must be 100 characters or fewer.');
      return;
    }
    if (String(form.description || '').length > 500) {
      setFormError('Role description must be 500 characters or fewer.');
      return;
    }

    try {
      await apiClient.post('/api/admin/roles', {
        name: trimmedName,
        description: String(form.description || '').trim(),
        status: normalizeStatus(form.status),
      });
      setShowCreateModal(false);
      setForm({ name: '', description: '', status: 'active' });
      await loadRoles();
      const nextRoleName = trimmedName.toLowerCase();
      setSelectedRoleName(nextRoleName);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to create role.';
      setFormError(message === 'Role not found.' ? 'A role with this name already exists.' : message);
    }
  };

  const handleEditRole = async (event) => {
    event.preventDefault();
    if (!selectedRole) return;
    const trimmedName = String(form.name || '').trim();
    if (!trimmedName) {
      setFormError('Role name is required.');
      return;
    }

    try {
      await apiClient.put(`/api/admin/roles/${encodeURIComponent(selectedRole.name)}`, {
        name: trimmedName,
        description: String(form.description || '').trim(),
        status: normalizeStatus(form.status),
      });
      setShowEditModal(false);
      await loadRoles();
      setSelectedRoleName(trimmedName.toLowerCase());
    } catch (requestError) {
      setFormError(requestError.response?.data?.message || 'Unable to update role.');
    }
  };

  const openEditModal = () => {
    if (!selectedRole) return;
    setForm({
      name: selectedRole.name || '',
      description: selectedRole.description || '',
      status: normalizeStatus(selectedRole.status),
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleStatusToggle = async (roleName) => {
    const role = roles.find((item) => (item.name || item.id) === roleName);
    if (!role) return;
    try {
      const nextStatus = normalizeStatus(role.status) === 'active' ? 'inactive' : 'active';
      await apiClient.patch(`/api/admin/roles/${encodeURIComponent(roleName)}/status`, { status: nextStatus });
      await loadRoles();
      if (selectedRoleName === roleName) {
        const nextSelected = roles.find((item) => (item.name || item.id) === roleName);
        if (nextSelected) setSelectedRoleName(nextSelected.name || nextSelected.id);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update role status.');
    }
  };

  const handleDeleteRole = async (roleName) => {
    const role = roles.find((item) => (item.name || item.id) === roleName);
    if (!role) return;
    if ((role.users || 0) > 0) {
      setError('Cannot delete this role because it is assigned to existing users.');
      return;
    }
    if (!window.confirm(`Delete role "${role.label || role.name}"?`)) return;
    try {
      await apiClient.delete(`/api/admin/roles/${encodeURIComponent(roleName)}`);
      await loadRoles();
      setSelectedRoleName('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete role.');
    }
  };

  const handlePermissionSave = async () => {
    if (!selectedRoleName) return;
    setSavingPermissions(true);
    setError('');
    try {
      await apiClient.put(`/api/admin/roles/${encodeURIComponent(selectedRoleName)}/permissions`, {
        permissions: selectedPermissions,
      });
      await loadRoles();
      await loadSelectedPermissions(selectedRoleName);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update permissions. No changes were applied.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const togglePermission = (permissionKey) => {
    setSelectedPermissions((current) => {
      const exists = current.includes(permissionKey);
      return exists ? current.filter((permission) => permission !== permissionKey) : [...current, permissionKey];
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPermissionSearch('');
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}><div style={styles.emptyState}>Loading roles...</div></div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>Admin / Roles & Permissions</div>
          <h1 style={styles.title}>Roles & Permissions</h1>
          <p style={styles.subtitle}>Manage system roles and control which permissions are assigned to each role.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.secondaryBtn} onClick={() => { loadRoles(); loadPermissions(); }}><RefreshCw size={16} /> Refresh</button>
          <button type="button" style={styles.primaryBtn} onClick={() => { setForm({ name: '', description: '', status: 'active' }); setFormError(''); setShowCreateModal(true); }}><Plus size={16} /> Create Role</button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.summaryGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><ShieldCheck size={20} /></div>
          <div>
            <div style={styles.statLabel}>Total Roles</div>
            <div style={styles.statValue}>{roles.length}</div>
            <div style={styles.statMeta}>Current registered roles</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><Check size={20} /></div>
          <div>
            <div style={styles.statLabel}>Active Roles</div>
            <div style={styles.statValue}>{roles.filter((role) => normalizeStatus(role.status) === 'active').length}</div>
            <div style={styles.statMeta}>Enabled in RBAC</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><CircleOff size={20} /></div>
          <div>
            <div style={styles.statLabel}>Inactive Roles</div>
            <div style={styles.statValue}>{roles.filter((role) => normalizeStatus(role.status) !== 'active').length}</div>
            <div style={styles.statMeta}>Disabled access</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><KeyRound size={20} /></div>
          <div>
            <div style={styles.statLabel}>Total Permissions</div>
            <div style={styles.statValue}>{permissions.length}</div>
            <div style={styles.statMeta}>Available permission records</div>
          </div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={16} style={styles.iconLeft} />
          <input style={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles by name or description" />
        </div>
        <select style={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status === 'all' ? 'All Status' : status === 'active' ? 'Active' : 'Inactive'}</option>
          ))}
        </select>
      </div>

      {filteredRoles.length === 0 ? (
        <div style={styles.card}>
          <div style={styles.emptyState}>
            <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>No roles match your current filters.</h3>
            <button type="button" style={styles.primaryBtn} onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Users</th>
                <th style={styles.th}>Permissions</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => {
                const roleId = role.name || role.id;
                const isActive = normalizeStatus(role.status) === 'active';
                return (
                  <tr key={roleId} onClick={() => setSelectedRoleName(roleId)} style={{ cursor: 'pointer' }}>
                    <td style={styles.td}>
                      <div style={styles.roleName}>{role.label || role.name || roleId}</div>
                      <div style={styles.roleMeta}>{role.name || roleId}</div>
                    </td>
                    <td style={styles.td}>{role.description || 'No description provided.'}</td>
                    <td style={styles.td}>{role.users ?? 0}</td>
                    <td style={styles.td}>{role.permissionCount ?? role.permissions?.length ?? 0}</td>
                    <td style={styles.td}><span style={{ ...styles.badge, ...(isActive ? styles.badgeActive : styles.badgeInactive) }}>{isActive ? 'Active' : 'Inactive'}</span></td>
                    <td style={styles.td}>{formatDate(role.createdAt || role.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup} onClick={(event) => event.stopPropagation()}>
                        <button type="button" style={styles.smallAction} onClick={() => setSelectedRoleName(roleId)}><Eye size={12} /> View</button>
                        <button type="button" style={styles.smallAction} onClick={openEditModal}><Pencil size={12} /> Edit</button>
                        <button type="button" style={styles.smallAction} onClick={() => setSelectedRoleName(roleId)}><KeyRound size={12} /> Permissions</button>
                        <button type="button" style={styles.smallAction} onClick={() => handleStatusToggle(roleId)}>{isActive ? 'Deactivate' : 'Activate'}</button>
                        {!role.protected && (
                          <button type="button" style={styles.dangerBtn} onClick={() => handleDeleteRole(roleId)}><Trash2 size={12} /> Delete</button>
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

      {selectedRole && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.breadcrumb}>Role Details</div>
              <h2 style={styles.panelTitle}>{selectedRole.label || selectedRole.name}</h2>
            </div>
            <button type="button" style={styles.primaryBtn} onClick={handlePermissionSave} disabled={!hasUnsavedChanges || savingPermissions}>
              {savingPermissions ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>

          <div style={styles.grid}>
            <div style={styles.infoCard}>
              <div style={{ ...styles.detailLabel, marginBottom: 8 }}>Description</div>
              <div style={{ ...styles.detailValue, fontSize: 15, lineHeight: 1.6 }}>{selectedRole.description || 'No description provided.'}</div>
              <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
                <div>
                  <div style={styles.detailLabel}>Status</div>
                  <div><span style={{ ...styles.badge, ...(normalizeStatus(selectedRole.status) === 'active' ? styles.badgeActive : styles.badgeInactive) }}>{normalizeStatus(selectedRole.status) === 'active' ? 'Active' : 'Inactive'}</span></div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Users</div>
                  <div style={styles.detailValue}>{selectedRole.users ?? 0}</div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Permissions</div>
                  <div style={styles.detailValue}>{selectedRole.permissionCount ?? (selectedPermissions.length || 0)}</div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Created</div>
                  <div style={styles.detailValue}>{formatDate(selectedRole.createdAt || selectedRole.created_at)}</div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Updated</div>
                  <div style={styles.detailValue}>{formatDate(selectedRole.updatedAt || selectedRole.updated_at)}</div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <div style={styles.searchWrap}>
                  <Search size={16} style={styles.iconLeft} />
                  <input style={styles.searchInput} value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search permissions..." />
                </div>
                <button type="button" style={styles.secondaryBtn} onClick={() => setSelectedPermissions((current) => Array.from(new Set([...current, ...permissions.map((permission) => permission.name || permission.key)])))}>Add All</button>
              </div>

              {permissionsLoading ? (
                <div style={styles.card}><div style={styles.emptyState}>Loading permissions...</div></div>
              ) : (
                <div style={styles.permissionList}>
                  {groupedPermissions.length === 0 ? (
                    <div style={styles.card}><div style={styles.emptyState}>No permissions assigned.</div></div>
                  ) : (
                    groupedPermissions.map((group) => (
                      <div key={group.key} style={styles.permissionSection}>
                        <div style={styles.sectionHeader}>
                          <span>{group.label}</span>
                          <span>{group.permissions.filter((permission) => selectedPermissions.includes(permission.name || permission.key)).length}/{group.permissions.length}</span>
                        </div>
                        {group.permissions.map((permission) => {
                          const permissionKey = permission.name || permission.key;
                          const checked = selectedPermissions.includes(permissionKey);
                          return (
                            <div key={permissionKey} style={styles.permissionRow}>
                              <label style={styles.checkboxLabel}>
                                <input checked={checked} type="checkbox" style={styles.checkbox} onChange={() => togglePermission(permissionKey)} />
                                <span>{formatPermissionLabel(permissionKey)}</span>
                              </label>
                              <span style={{ color: checked ? '#166534' : '#64748b', fontWeight: 600 }}>{checked ? 'Assigned' : 'Unassigned'}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}

              {hasUnsavedChanges && (
                <div style={styles.unsaved}>
                  <span>Unsaved changes</span>
                  <div style={styles.actionGroup}>
                    <button type="button" style={styles.secondaryBtn} onClick={() => loadSelectedPermissions(selectedRoleName)}>Cancel</button>
                    <button type="button" style={styles.primaryBtn} onClick={handlePermissionSave}>Save Permissions</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Create Role</h3>
              <button type="button" style={{ ...styles.smallAction, border: 'none', background: 'transparent', padding: 0 }} onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form style={styles.form} onSubmit={handleCreateRole}>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Role Name *</label>
                <input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="System Administrator" />
              </div>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Description</label>
                <textarea style={styles.textarea} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the operational purpose of this role." />
              </div>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Status</label>
                <select style={styles.select} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
              <div style={styles.modalActions}>
                <button type="button" style={styles.secondaryBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" style={styles.primaryBtn}>Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedRole && (
        <div style={styles.modalBackdrop} onClick={() => setShowEditModal(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Role</h3>
              <button type="button" style={{ ...styles.smallAction, border: 'none', background: 'transparent', padding: 0 }} onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <form style={styles.form} onSubmit={handleEditRole}>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Role Name *</label>
                <input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Description</label>
                <textarea style={styles.textarea} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={{ fontWeight: 600, color: '#0f172a' }}>Status</label>
                <select style={styles.select} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
              <div style={styles.modalActions}>
                <button type="button" style={styles.secondaryBtn} onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" style={styles.primaryBtn}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
