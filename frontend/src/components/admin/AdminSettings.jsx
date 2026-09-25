import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import UserAvatar from '../common/UserAvatar';

/* ============================================================
   SETTINGS CATEGORIES
============================================================ */

const CATEGORIES = [
  { id: 'organization', label: 'Organization & Branding', icon: '🏢' },
  { id: 'account', label: 'Account & Profile', icon: '👤' },
  { id: 'security', label: 'Security & Authentication', icon: '🔐' },
  { id: 'roles', label: 'Roles & Permissions', icon: '👥' },
  { id: 'notifications', label: 'Notifications & Alerts', icon: '🔔' },
  { id: 'localization', label: 'Language & Region', icon: '🌍' },
  { id: 'assets', label: 'Asset Configuration', icon: '📦' },
  { id: 'workflow', label: 'Workflow & Approval', icon: '🔄' },
  { id: 'rfid', label: 'RFID & Tracking', icon: '🏷️' },
  { id: 'maintenance', label: 'Maintenance Configuration', icon: '🔧' },
  { id: 'financial', label: 'Financial Configuration', icon: '💰' },
  { id: 'reports', label: 'Reports & Data', icon: '📊' },
  { id: 'audit', label: 'Audit & Compliance', icon: '📝' },
  { id: 'backup', label: 'Backup & Recovery', icon: '💾' },
];

/* ============================================================
   DEFAULT SETTINGS
============================================================ */

const DEFAULT_SETTINGS = {
  organization: {
    orgName: '',
    instName: '',
    orgCode: '',
    logo: '',
    website: '',
    email: '',
    phone: '',
    address: ''
  },

  security: {
    timeout: 30,
    maxAttempts: 5,
    minPass: 8,
    strongPass: true,
    mfa: false,
    lockoutDuration: 15,
    sessionRemember: false
  },

  notifications: {
    enabled: true,
    inAppEnabled: true,
    emailEnabled: false,
    events: {
      assignment_created: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
      assignment_returned: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
      maintenance_created: { enabled: true, inApp: true, email: false, recipientRule: 'Maintenance Staff', priority: 'normal' },
      maintenance_status_changed: { enabled: true, inApp: true, email: false, recipientRule: 'Requestor and Maintenance Staff', priority: 'normal' }
    }
  },

  localization: {
    lang: 'English',
    dateFmt: 'DD/MM/YYYY',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa'
  },

  assets: {
    enabled: true,
    prefix: 'MAU',
    categoryCode: 'GEN',
    year: new Date().getFullYear(),
    sequenceLength: 6,
    startNumber: 1,
    separator: '-',
    format: '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}',
    defStatus: 'Available',
    autoNumber: true,
    requireSerial: false,
    requirePurchaseDate: true,
    requireValue: true
  },

  workflow: {
    'Asset Approval': true,
    'Transfer Approval': true,
    'Disposal Approval': true,
    'Maintenance Approval': true,
    'Assignment Approval': false
  },

  rfid: {
    enabled: false,
    reader: '',
    interval: 5,
    autoRegister: false,
    scanHistory: true,
    duplicateProtection: true
  },

  maintenance: {
    preventive: true,
    remindDays: 7,
    defInterval: 90,
    autoCreate: false,
    requireApproval: true,
    maintenanceCostTracking: true
  },

  financial: {
    tax: 0,
    fiscal: '',
    depreciationMethod: 'Straight Line',
    defaultCurrency: 'ETB',
    capitalizationThreshold: 0
  },

  reports: {
    fmt: 'PDF',
    includeLogo: true,
    includeAudit: false,
    autoGenerate: false,
    retentionDays: 365
  },

  integrations: {
    email: false,
    rfid: false,
    externalApi: false,
    webhooks: false
  }
};

/* ============================================================
   MAIN COMPONENT
============================================================ */

const AdminSettings = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('section') || 'organization');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [auditLogs, setAuditLogs] = useState([]);

  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const isDark = theme === 'dark';

  /* ============================================================
     LOAD SETTINGS
  ============================================================ */

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (searchParams.get('section') !== activeTab) setSearchParams({ section: activeTab }, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);

    try {
      const response = await apiClient.get('/api/admin/settings');

      const serverSettings =
        response?.data?.settings ||
        response?.data ||
        {};

      setSettings((previous) => ({
        ...DEFAULT_SETTINGS,
        ...previous,
        ...serverSettings
      }));
    } catch (error) {
      console.error('Settings loading error:', error);

      toast.error(
        error?.response?.data?.message ||
        'Failed to load system settings'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     AUDIT LOGS
  ============================================================ */

  const fetchAuditLogs = async () => {
    try {
      const response = await apiClient.get('/api/audit?limit=50');

      const logs =
        response?.data?.logs ||
        response?.data?.data ||
        [];

      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error('Audit log error:', error);

      toast.error(
        error?.response?.data?.message ||
        'Could not load audit logs'
      );
    }
  };

  /* ============================================================
     SAVE SETTINGS
  ============================================================ */

  const handleUpdate = async (category, data) => {
    setSaving(true);

    try {
      await apiClient.put(`/api/admin/settings/${category}`, { data });

      setSettings((previous) => ({
        ...previous,
        [category]: data
      }));

      toast.success('✓ Settings saved successfully');
    } catch (error) {
      console.error('Settings save error:', error);

      toast.error(
        error?.response?.data?.message ||
        'Failed to save changes'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     MAINTENANCE ACTION
  ============================================================ */

  const handleMaintenanceAction = async (action, message) => {
    const confirmed = window.confirm(message);

    if (!confirmed) {
      return;
    }

    setMaintenanceLoading(true);

    try {
      await apiClient.post(`/api/maintenance/${action}`);

      toast.success('✓ Action executed successfully');
    } catch (error) {
      console.error('Maintenance action error:', error);

      toast.error(
        error?.response?.data?.message ||
        'Operation failed'
      );
    } finally {
      setMaintenanceLoading(false);
    }
  };

  /* ============================================================
     ACTIVE CONTENT
  ============================================================ */

  const renderActiveSetting = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading system settings...</span>
        </div>
      );
    }

    const data =
      settings[activeTab] ||
      DEFAULT_SETTINGS[activeTab] ||
      {};

    switch (activeTab) {
      case 'organization':
        return (
          <OrganizationForm
            data={data}
            onSave={(value) =>
              handleUpdate('organization', value)
            }
            onReset={fetchSettings}
            saving={saving}
          />
        );

      case 'account':
        return <AccountProfile user={user} />;

      case 'security':
        return (
          <SecurityForm
            data={data}
            onSave={(value) =>
              handleUpdate('security', value)
            }
            saving={saving}
          />
        );

      case 'roles':
        return (
          <RedirectPanel
            title="Roles & Permissions"
            path="/admin/users"
            icon="👥"
            description="Manage users, roles, permissions and access control."
            onNavigate={navigate}
          />
        );

      case 'notifications':
        return (
          <NotificationsForm
            data={data}
            onSave={(value) =>
              handleUpdate('notifications', value)
            }
            saving={saving}
          />
        );

      case 'localization':
        return (
          <LocalizationForm
            data={data}
            onSave={(value) =>
              handleUpdate('localization', value)
            }
            saving={saving}
          />
        );

      case 'assets':
        return (
          <AssetConfigForm
            data={data}
            onSave={(value) =>
              handleUpdate('assets', value)
            }
            saving={saving}
          />
        );

      case 'workflow':
        return (
          <WorkflowForm
            data={data}
            onSave={(value) =>
              handleUpdate('workflow', value)
            }
            saving={saving}
          />
        );

      case 'rfid':
        return (
          <RfidForm
            data={data}
            onSave={(value) =>
              handleUpdate('rfid', value)
            }
            saving={saving}
          />
        );

      case 'maintenance':
        return (
          <MaintenanceForm
            data={data}
            onSave={(value) =>
              handleUpdate('maintenance', value)
            }
            saving={saving}
          />
        );

      case 'financial':
        return (
          <FinancialForm
            data={data}
            onSave={(value) =>
              handleUpdate('financial', value)
            }
            saving={saving}
          />
        );

      case 'reports':
        return (
          <ReportsForm
            data={data}
            onSave={(value) =>
              handleUpdate('reports', value)
            }
            saving={saving}
          />
        );

      case 'audit':
        return (
          <AuditView
            logs={auditLogs}
            onRefresh={fetchAuditLogs}
          />
        );

      case 'monitoring':
        return (
          <RedirectPanel
            title="System Monitoring"
            path="/admin/settings/system-monitoring"
            description="View measured health, resource, performance, security, alert, and activity metrics."
            onNavigate={navigate}
          />
        );

      case 'integrations':
        return (
          <IntegrationsForm
            data={data}
            onSave={(value) =>
              handleUpdate('integrations', value)
            }
            saving={saving}
          />
        );

      case 'backup':
        return (
          <RedirectPanel
            title="Backup & Recovery"
            path="/admin/backup"
            icon="💾"
            description="Create backups, manage recovery points and restore system data."
            onNavigate={navigate}
          />
        );

      case 'maintenance_sys':
        return (
          <MaintenanceSysView
            onAction={handleMaintenanceAction}
            loading={maintenanceLoading}
          />
        );

      default:
        return (
          <div className="empty-state">
            Select a settings category.
          </div>
        );
    }
  };

  /* ============================================================
     MAIN UI
  ============================================================ */

  const activeCategory = CATEGORIES.find((category) => category.id === activeTab) || CATEGORIES[0];

  return (
    <div
      className={`admin-settings-layout ${
        isDark ? 'dark-mode' : 'light-mode'
      }`}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        .admin-settings-layout {
          min-height: 100vh;
          width: 100%;
          padding: 24px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .light-mode {
          background: #f8fafc;
          color: #0f172a;
        }

        .dark-mode {
          background: #0f172a;
          color: #f8fafc;
        }

        .settings-shell {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 24px;
          max-width: 1440px;
          margin: 0 auto;
          align-items: start;
        }

        .settings-sidebar {
          position: sticky;
          top: 20px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .dark-mode .settings-sidebar {
          background: #111827;
          border-color: #334155;
        }

        .settings-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 6px 8px 18px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 14px;
        }

        .dark-mode .settings-header {
          border-color: #334155;
        }

        .settings-header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.2;
        }

        .settings-subtitle {
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .dark-mode .settings-subtitle {
          color: #94a3b8;
        }

        .admin-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #10b981;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .settings-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          text-align: left;
          transition: all 0.2s ease;
        }

        .dark-mode .nav-item {
          color: #cbd5e1;
        }

        .nav-item:hover {
          background: #eff6ff;
          border-color: #dbeafe;
          color: #1d4ed8;
        }

        .dark-mode .nav-item:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(96, 165, 250, 0.25);
          color: #bfdbfe;
        }

        .nav-item.active {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.05);
        }

        .dark-mode .nav-item.active {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(96, 165, 250, 0.35);
          color: #dbeafe;
        }

        .nav-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          min-width: 22px;
          font-size: 14px;
        }

        .settings-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          min-height: 620px;
        }

        .dark-mode .settings-panel {
          background: #111827;
          border-color: #334155;
        }

        .settings-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 16px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark-mode .settings-panel-header {
          border-color: #334155;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 800;
          margin: 0;
        }

        .panel-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 15px;
        }

        .dark-mode .panel-badge {
          background: rgba(59, 130, 246, 0.12);
          color: #bfdbfe;
        }

        .panel-status {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: #f8fafc;
          padding: 6px 10px;
        }

        .dark-mode .panel-status {
          color: #cbd5e1;
          border-color: #334155;
          background: rgba(15, 23, 42, 0.6);
        }

        .panel-body {
          width: 100%;
        }

        .content-area {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .section-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }

        .section-description {
          margin: -12px 0 4px;
          font-size: 13px;
          color: #64748b;
        }

        .dark-mode .section-description {
          color: #94a3b8;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 18px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .dark-mode .form-group label {
          color: #cbd5e1;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 11px 12px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: border 0.2s ease, box-shadow 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        .dark-mode .form-group input,
        .dark-mode .form-group select,
        .dark-mode .form-group textarea {
          background: #0f172a;
          border-color: #475569;
          color: #f8fafc;
        }

        .form-group input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-save {
          padding: 11px 20px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 7px;
          font-weight: 700;
          cursor: pointer;
          align-self: flex-start;
          transition: all 0.2s ease;
        }

        .btn-save:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .btn-save:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .toggle-group {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 15px;
          border-radius: 9px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .dark-mode .toggle-group {
          background: #0f172a;
          border-color: #334155;
        }

        .toggle-group span {
          font-size: 13px;
          font-weight: 600;
        }

        .toggle-input {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #2563eb;
        }

        .subsection-title {
          margin: 8px 0 -8px;
          font-size: 15px;
          color: #1e3a8a;
        }

        .dark-mode .subsection-title { color: #93c5fd; }

        .channel-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        @media (max-width: 980px) {
          .settings-shell {
            grid-template-columns: 1fr;
          }

          .settings-sidebar {
            position: static;
          }

          .settings-panel {
            padding: 18px;
          }
        }
`}</style>

      <div className="settings-shell">
        <aside className="settings-sidebar">
          <div className="settings-header">
            <h1>⚙️ System Settings</h1>
            <div className="settings-subtitle">Configure system behavior and organization preferences.</div>
            <div className="admin-status"><span>●</span> Ready</div>
          </div>

          <nav className="settings-nav" aria-label="Settings navigation">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`nav-item ${activeTab === category.id ? 'active' : ''}`}
                onClick={() => setActiveTab(category.id)}
              >
                <span className="nav-icon">{category.icon}</span>
                <span>{category.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-panel">
          <header className="settings-panel-header">
            <h2 className="panel-title">
              <span className="panel-badge">{activeCategory.icon}</span>
              <span>{activeCategory.label}</span>
            </h2>
            <span className="panel-status">{loading ? 'Loading' : 'Ready'}</span>
          </header>

          <div className="panel-body">{renderActiveSetting()}</div>
        </main>
      </div>
    </div>
  );
};

/* ============================================================
   ORGANIZATION & BRANDING
============================================================ */

const OrganizationForm = ({
  data,
  onSave,
  onReset,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.organization,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        🏢 Organization & Branding
      </h2>

      <p className="section-description">
        Configure your institution identity and
        organization contact information.
      </p>

      <div className="form-grid">
        <Field
          label="Organization Name"
          value={form.orgName}
          onChange={(value) =>
            setForm({
              ...form,
              orgName: value
            })
          }
        />

        <Field
          label="Institution Name"
          value={form.instName}
          onChange={(value) =>
            setForm({
              ...form,
              instName: value
            })
          }
        />

        <Field
          label="Organization Code"
          value={form.orgCode}
          onChange={(value) =>
            setForm({
              ...form,
              orgCode: value
            })
          }
        />

        <Field
          label="Logo URL"
          value={form.logo}
          onChange={(value) =>
            setForm({
              ...form,
              logo: value
            })
          }
          placeholder="https://..."
        />

        <Field
          label="Website"
          value={form.website}
          onChange={(value) =>
            setForm({
              ...form,
              website: value
            })
          }
        />

        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) =>
            setForm({
              ...form,
              email: value
            })
          }
        />

        <Field
          label="Phone"
          value={form.phone}
          onChange={(value) =>
            setForm({
              ...form,
              phone: value
            })
          }
        />

        <Field
          label="Address"
          type="textarea"
          value={form.address}
          onChange={(value) =>
            setForm({
              ...form,
              address: value
            })
          }
          fullWidth
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <SaveButton
          saving={saving}
          onClick={() => onSave(form)}
        />
        {onReset && (
          <button
            type="button"
            className="btn-save"
            style={{ background: '#e2e8f0', color: '#0f172a' }}
            onClick={onReset}
            disabled={saving}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   ACCOUNT
============================================================ */

export const AccountProfile = ({ user }) => {
  const { updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please choose a PNG, JPG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);
      const response = await apiClient.post('/api/users/profile/photo', formData);

      const nextUser = response?.data?.user || response?.data?.data || null;
      if (nextUser) {
        updateUser(nextUser);
      }
      toast.success('Profile photo updated successfully.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update profile photo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setUploading(true);
      const response = await apiClient.delete('/api/users/profile/photo');
      const nextUser = response?.data?.user || response?.data?.data || null;
      if (nextUser) {
        updateUser(nextUser);
      }
      toast.success('Profile photo removed.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to remove profile photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-section">
      <h2 className="section-title">
        👤 Account & Profile
      </h2>

      <p className="section-description">
        Current administrator account information.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <UserAvatar user={user} size="xl" className="profile-photo-preview" />
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-save" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload photo'}
          </button>
          {user?.profilePhoto && (
            <button type="button" className="btn-save" style={{ background: '#e2e8f0', color: '#0f172a' }} onClick={handleRemovePhoto} disabled={uploading}>
              Remove photo
            </button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handlePhotoUpload} />

      <div className="form-grid">
        <Field
          label="Username"
          value={user?.username}
          disabled
        />

        <Field
          label="Full Name"
          value={
            user?.full_name ||
            user?.fullName ||
            user?.name
          }
          disabled
        />

        <Field
          label="Email"
          value={user?.email}
          disabled
        />

        <Field
          label="Role"
          value={user?.role}
          disabled
        />
      </div>

      <p
        style={{
          fontSize: '12px',
          color: '#64748b'
        }}
      >
        Account credentials are managed by the
        authentication service.
      </p>
    </div>
  );
};

/* ============================================================
   SECURITY
============================================================ */

const SecurityForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.security,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        🛡️ Security & Authentication
      </h2>

      <p className="section-description">
        Configure password policy, login protection
        and session security.
      </p>

      <div className="form-grid">
        <Field
          label="Session Timeout (Minutes)"
          type="number"
          value={form.timeout}
          onChange={(value) =>
            setForm({
              ...form,
              timeout: value
            })
          }
        />

        <Field
          label="Maximum Login Attempts"
          type="number"
          value={form.maxAttempts}
          onChange={(value) =>
            setForm({
              ...form,
              maxAttempts: value
            })
          }
        />

        <Field
          label="Minimum Password Length"
          type="number"
          value={form.minPass}
          onChange={(value) =>
            setForm({
              ...form,
              minPass: value
            })
          }
        />

        <Field
          label="Lockout Duration (Minutes)"
          type="number"
          value={form.lockoutDuration}
          onChange={(value) =>
            setForm({
              ...form,
              lockoutDuration: value
            })
          }
        />
      </div>

      <Toggle
        label="Require Strong Password"
        checked={form.strongPass}
        onChange={(value) =>
          setForm({
            ...form,
            strongPass: value
          })
        }
      />

      <Toggle
        label="Two-Factor Authentication"
        checked={form.mfa}
        onChange={(value) =>
          setForm({
            ...form,
            mfa: value
          })
        }
      />

      <Toggle
        label="Allow Remember Session"
        checked={form.sessionRemember}
        onChange={(value) =>
          setForm({
            ...form,
            sessionRemember: value
          })
        }
      />

      <SaveButton
        saving={saving}
        text="Update Security Policies"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   NOTIFICATIONS
============================================================ */

const NotificationsForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.notifications,
    data
  );

  const eventLabels = {
    assignment_created: 'Asset Assigned',
    assignment_returned: 'Asset Returned',
    maintenance_created: 'Maintenance Request Created',
    maintenance_status_changed: 'Maintenance Status Changed'
  };
  const updateEvent = (event, key, value) => setForm({ ...form, events: { ...form.events, [event]: { ...form.events[event], [key]: value } } });
  const emailConfigured = data.emailStatus?.valid === true;

  return (
    <div className="form-section">
      <h2 className="section-title">Notifications & Alerts</h2>

      <p className="section-description">
        Configure notification rules, delivery channels, and recipients for supported system events.
      </p>

      <h3 className="subsection-title">General Settings</h3>
      <Toggle label="Notifications Enabled" checked={form.enabled} onChange={(value) => setForm({ ...form, enabled: value })} />

      <h3 className="subsection-title">Notification Channels</h3>
      <Toggle label="Enable In-App Notifications" checked={form.inAppEnabled} onChange={(value) => setForm({ ...form, inAppEnabled: value })} />
      <div className="channel-row">
        <Toggle label="Enable Email Notifications" checked={form.emailEnabled && emailConfigured} onChange={(value) => setForm({ ...form, emailEnabled: value })} />
        <span className={emailConfigured ? 'channel-status enabled' : 'channel-status'}>{emailConfigured ? 'Configured' : 'Not configured'}</span>
      </div>
      <div className="channel-row unsupported"><span>Browser Push Notifications</span><span className="channel-status">Not available</span></div>
      <div className="channel-row unsupported"><span>SMS Notifications</span><span className="channel-status">Not available</span></div>

      <h3 className="subsection-title">Event Notifications</h3>
      <div className="notification-event-table">
        <div className="notification-event-head"><span>Event</span><span>Enabled</span><span>In-App</span><span>Email</span><span>Recipients</span><span>Priority</span></div>
        {Object.entries(form.events || {}).map(([event, rule]) => (
          <div className="notification-event-row" key={event}>
            <strong>{eventLabels[event] || event}</strong>
            <input type="checkbox" checked={Boolean(rule.enabled)} onChange={(e) => updateEvent(event, 'enabled', e.target.checked)} />
            <input type="checkbox" checked={Boolean(rule.inApp)} onChange={(e) => updateEvent(event, 'inApp', e.target.checked)} disabled={!form.inAppEnabled} />
            <input type="checkbox" checked={Boolean(rule.email && emailConfigured)} onChange={(e) => updateEvent(event, 'email', e.target.checked)} disabled={!form.emailEnabled || !emailConfigured} />
            <span>{rule.recipientRule}</span>
            <select value={rule.priority === 'normal' ? 'normal' : rule.priority} onChange={(e) => updateEvent(event, 'priority', e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
          </div>
        ))}
      </div>
      <p className="section-description">Recipients are resolved from assigned users, requesters, and active maintenance staff. Delivery history is available in Notification History.</p>

      <SaveButton
        saving={saving}
        text="Save Notification Settings"
        onClick={() => { const { emailStatus, ...persisted } = form; onSave(persisted); }}
      />
    </div>
  );
};

/* ============================================================
   LOCALIZATION
============================================================ */

const LocalizationForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.localization,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        🌐 Localization
      </h2>

      <p className="section-description">
        Configure system language, date format,
        currency and timezone.
      </p>

      <div className="form-grid">
        <Field
          label="Language"
          type="select"
          options={[
            'English',
            'Amharic'
          ]}
          value={form.lang}
          onChange={(value) =>
            setForm({
              ...form,
              lang: value
            })
          }
        />

        <Field
          label="Date Format"
          type="select"
          options={[
            'DD/MM/YYYY',
            'MM/DD/YYYY',
            'YYYY-MM-DD'
          ]}
          value={form.dateFmt}
          onChange={(value) =>
            setForm({
              ...form,
              dateFmt: value
            })
          }
        />

        <Field
          label="Currency"
          value={form.currency}
          onChange={(value) =>
            setForm({
              ...form,
              currency: value
            })
          }
        />

        <Field
          label="Timezone"
          type="select"
          options={[
            'Africa/Addis_Ababa',
            'UTC',
            'Europe/London',
            'America/New_York'
          ]}
          value={form.timezone}
          onChange={(value) =>
            setForm({
              ...form,
              timezone: value
            })
          }
        />
      </div>

      <SaveButton
        saving={saving}
        text="Save Localization"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   ASSET CONFIGURATION
============================================================ */

const AssetConfigForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.assets,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        📦 Asset Configuration
      </h2>

      <p className="section-description">
        Configure asset numbering, statuses and
        required asset information.
      </p>

      <div className="form-grid">
        <Field
          label="Asset Number Prefix"
          value={form.prefix}
          onChange={(value) =>
            setForm({
              ...form,
              prefix: value
            })
          }
        />

        <Field
          label="Category Code"
          value={form.categoryCode}
          onChange={(value) =>
            setForm({
              ...form,
              categoryCode: value
            })
          }
        />

        <Field
          label="Year"
          type="number"
          value={form.year}
          onChange={(value) =>
            setForm({
              ...form,
              year: value
            })
          }
        />

        <Field
          label="Sequence Length"
          type="number"
          value={form.sequenceLength}
          onChange={(value) =>
            setForm({
              ...form,
              sequenceLength: value
            })
          }
        />

        <Field
          label="Starting Number"
          type="number"
          value={form.startNumber}
          onChange={(value) =>
            setForm({
              ...form,
              startNumber: value
            })
          }
        />

        <Field
          label="Separator"
          value={form.separator}
          onChange={(value) =>
            setForm({
              ...form,
              separator: value
            })
          }
        />

        <Field
          label="Pattern"
          value={form.format}
          onChange={(value) =>
            setForm({
              ...form,
              format: value
            })
          }
          placeholder="{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}"
        />

        <Field
          label="Default Status"
          type="select"
          options={[
            'Available',
            'Assigned',
            'Under Maintenance',
            'Damaged',
            'Missing',
            'Retired'
          ]}
          value={form.defStatus}
          onChange={(value) =>
            setForm({
              ...form,
              defStatus: value
            })
          }
        />
      </div>

      <Toggle
        label="Enable Asset Number Generation"
        checked={Boolean(form.enabled)}
        onChange={(value) =>
          setForm({
            ...form,
            enabled: value
          })
        }
      />

      <Toggle
        label="Automatically Generate Asset Numbers"
        checked={form.autoNumber}
        onChange={(value) =>
          setForm({
            ...form,
            autoNumber: value
          })
        }
      />

      <Toggle
        label="Require Serial Number"
        checked={form.requireSerial}
        onChange={(value) =>
          setForm({
            ...form,
            requireSerial: value
          })
        }
      />

      <Toggle
        label="Require Purchase Date"
        checked={form.requirePurchaseDate}
        onChange={(value) =>
          setForm({
            ...form,
            requirePurchaseDate: value
          })
        }
      />

      <Toggle
        label="Require Asset Value"
        checked={form.requireValue}
        onChange={(value) =>
          setForm({
            ...form,
            requireValue: value
          })
        }
      />

      <SaveButton
        saving={saving}
        text="Save Asset Configuration"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   WORKFLOW
============================================================ */

const WorkflowForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.workflow,
    data
  );

  const workflows = [
    'Asset Approval',
    'Transfer Approval',
    'Disposal Approval',
    'Maintenance Approval',
    'Assignment Approval'
  ];

  return (
    <div className="form-section">
      <h2 className="section-title">
        🔄 Workflow & Approval
      </h2>

      <p className="section-description">
        Define which asset operations require
        administrative approval.
      </p>

      {workflows.map((workflow) => (
        <Toggle
          key={workflow}
          label={`Require ${workflow}`}
          checked={Boolean(form[workflow])}
          onChange={(value) =>
            setForm({
              ...form,
              [workflow]: value
            })
          }
        />
      ))}

      <SaveButton
        saving={saving}
        text="Update Workflows"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   RFID
============================================================ */

const RfidForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.rfid,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        📡 RFID & Tracking
      </h2>

      <p className="section-description">
        Configure RFID readers, scanning and tracking
        behavior.
      </p>

      <Toggle
        label="Enable RFID Tracking"
        checked={form.enabled}
        onChange={(value) =>
          setForm({
            ...form,
            enabled: value
          })
        }
      />

      <div className="form-grid">
        <Field
          label="Reader ID"
          value={form.reader}
          onChange={(value) =>
            setForm({
              ...form,
              reader: value
            })
          }
        />

        <Field
          label="Scan Interval (Seconds)"
          type="number"
          value={form.interval}
          onChange={(value) =>
            setForm({
              ...form,
              interval: value
            })
          }
        />
      </div>

      <Toggle
        label="Automatically Register New Tags"
        checked={form.autoRegister}
        onChange={(value) =>
          setForm({
            ...form,
            autoRegister: value
          })
        }
      />

      <Toggle
        label="Keep RFID Scan History"
        checked={form.scanHistory}
        onChange={(value) =>
          setForm({
            ...form,
            scanHistory: value
          })
        }
      />

      <Toggle
        label="Duplicate Scan Protection"
        checked={form.duplicateProtection}
        onChange={(value) =>
          setForm({
            ...form,
            duplicateProtection: value
          })
        }
      />

      <SaveButton
        saving={saving}
        text="Update RFID Configuration"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   MAINTENANCE
============================================================ */

const MaintenanceForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.maintenance,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        🔧 Maintenance Configuration
      </h2>

      <p className="section-description">
        Configure preventive maintenance schedules,
        reminders and approval rules.
      </p>

      <Toggle
        label="Preventive Maintenance"
        checked={form.preventive}
        onChange={(value) =>
          setForm({
            ...form,
            preventive: value
          })
        }
      />

      <div className="form-grid">
        <Field
          label="Reminder Days"
          type="number"
          value={form.remindDays}
          onChange={(value) =>
            setForm({
              ...form,
              remindDays: value
            })
          }
        />

        <Field
          label="Default Maintenance Interval (Days)"
          type="number"
          value={form.defInterval}
          onChange={(value) =>
            setForm({
              ...form,
              defInterval: value
            })
          }
        />
      </div>

      <Toggle
        label="Automatically Create Maintenance Tasks"
        checked={form.autoCreate}
        onChange={(value) =>
          setForm({
            ...form,
            autoCreate: value
          })
        }
      />

      <Toggle
        label="Require Maintenance Approval"
        checked={form.requireApproval}
        onChange={(value) =>
          setForm({
            ...form,
            requireApproval: value
          })
        }
      />

      <SaveButton
        saving={saving}
        text="Update Maintenance"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   FINANCIAL
============================================================ */

const FinancialForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.financial,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        💰 Financial Configuration
      </h2>

      <p className="section-description">
        Configure asset financial values,
        depreciation and fiscal settings.
      </p>

      <div className="form-grid">
        <Field
          label="Tax Rate (%)"
          type="number"
          value={form.tax}
          onChange={(value) =>
            setForm({
              ...form,
              tax: value
            })
          }
        />

        <Field
          label="Fiscal Year Start"
          type="date"
          value={form.fiscal}
          onChange={(value) =>
            setForm({
              ...form,
              fiscal: value
            })
          }
        />

        <Field
          label="Depreciation Method"
          type="select"
          options={[
            'Straight Line',
            'Declining Balance',
            'Sum of Years Digits',
            'None'
          ]}
          value={form.depreciationMethod}
          onChange={(value) =>
            setForm({
              ...form,
              depreciationMethod: value
            })
          }
        />

        <Field
          label="Default Currency"
          value={form.defaultCurrency}
          onChange={(value) =>
            setForm({
              ...form,
              defaultCurrency: value
            })
          }
        />

        <Field
          label="Capitalization Threshold"
          type="number"
          value={form.capitalizationThreshold}
          onChange={(value) =>
            setForm({
              ...form,
              capitalizationThreshold: value
            })
          }
        />
      </div>

      <SaveButton
        saving={saving}
        text="Update Financial Configuration"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   REPORTS
============================================================ */

const ReportsForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.reports,
    data
  );

  return (
    <div className="form-section">
      <h2 className="section-title">
        📊 Reports & Data
      </h2>

      <p className="section-description">
        Configure report generation and data export
        preferences.
      </p>

      <div className="form-grid">
        <Field
          label="Default Export Format"
          type="select"
          options={[
            'PDF',
            'Excel',
            'CSV'
          ]}
          value={form.fmt}
          onChange={(value) =>
            setForm({
              ...form,
              fmt: value
            })
          }
        />

        <Field
          label="Data Retention (Days)"
          type="number"
          value={form.retentionDays}
          onChange={(value) =>
            setForm({
              ...form,
              retentionDays: value
            })
          }
        />
      </div>

      <Toggle
        label="Include Organization Logo"
        checked={form.includeLogo}
        onChange={(value) =>
          setForm({
            ...form,
            includeLogo: value
          })
        }
      />

      <Toggle
        label="Include Audit Information"
        checked={form.includeAudit}
        onChange={(value) =>
          setForm({
            ...form,
            includeAudit: value
          })
        }
      />

      <Toggle
        label="Automatically Generate Reports"
        checked={form.autoGenerate}
        onChange={(value) =>
          setForm({
            ...form,
            autoGenerate: value
          })
        }
      />

      <SaveButton
        saving={saving}
        text="Save Report Preferences"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   INTEGRATIONS
============================================================ */

const IntegrationsForm = ({
  data,
  onSave,
  saving
}) => {
  const [form, setForm] = useFormState(
    DEFAULT_SETTINGS.integrations,
    data
  );

  const services = [
    ['email', '📧 Email Service'],
    ['rfid', '📡 RFID Service'],
    ['externalApi', '🔗 External API'],
    ['webhooks', '🪝 Webhooks']
  ];

  return (
    <div className="form-section">
      <h2 className="section-title">
        🔗 Integrations
      </h2>

      <p className="section-description">
        Enable external services connected to the
        University Asset Management System.
      </p>

      {services.map(([key, label]) => (
        <Toggle
          key={key}
          label={label}
          checked={Boolean(form[key])}
          onChange={(value) =>
            setForm({
              ...form,
              [key]: value
            })
          }
        />
      ))}

      <SaveButton
        saving={saving}
        text="Update Integrations"
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   AUDIT
============================================================ */

const AuditView = ({
  logs,
  onRefresh
}) => {
  return (
    <div className="form-section">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <div>
          <h2 className="section-title">
            📋 Audit & Compliance
          </h2>

          <p className="section-description">
            Review administrative and system activity.
          </p>
        </div>

        <button
          type="button"
          className="nav-item"
          onClick={onRefresh}
        >
          🔄 Refresh
        </button>
      </div>

      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>User</th>
              <th>Date</th>
              <th>IP Address</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  style={{
                    textAlign: 'center',
                    padding: '30px'
                  }}
                >
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log, index) => {
                const date =
                  log.date ||
                  log.created_at ||
                  log.createdAt ||
                  log.timestamp;

                return (
                  <tr
                    key={
                      log.id ||
                      log._id ||
                      index
                    }
                  >
                    <td>
                      {log.action ||
                        log.event ||
                        log.activity ||
                        '—'}
                    </td>

                    <td>
                      {log.user ||
                        log.username ||
                        log.user_name ||
                        '—'}
                    </td>

                    <td>
                      {date
                        ? new Date(
                            date
                          ).toLocaleString()
                        : '—'}
                    </td>

                    <td>
                      {log.ip ||
                        log.ip_address ||
                        '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================
   SYSTEM MAINTENANCE
============================================================ */

const MaintenanceSysView = ({
  onAction,
  loading
}) => {
  return (
    <div className="form-section">
      <h2 className="section-title">
        🧹 Data & System Maintenance
      </h2>

      <p className="section-description">
        Administrative tools for cache, database
        optimization and system cleanup.
      </p>

      <div className="action-grid">
        <button
          type="button"
          className="action-button"
          disabled={loading}
          onClick={() =>
            onAction(
              'clear-cache',
              'Are you sure you want to clear system cache?'
            )
          }
        >
          🧹
          <br />
          Clear Cache
        </button>

        <button
          type="button"
          className="action-button"
          disabled={loading}
          onClick={() =>
            onAction(
              'optimize-db',
              'Initialize database optimization?'
            )
          }
        >
          ⚙️
          <br />
          Optimize Database
        </button>

        <button
          type="button"
          className="action-button"
          disabled={loading}
          onClick={() =>
            onAction(
              'cleanup',
              'Run system cleanup for temporary files?'
            )
          }
        >
          📋
          <br />
          System Cleanup
        </button>

        <button
          type="button"
          className="action-button danger"
          disabled={loading}
          onClick={() =>
            onAction(
              'reset',
              'CRITICAL: Reset ALL system settings? This cannot be undone.'
            )
          }
        >
          ⚠️
          <br />
          Reset Settings
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          Processing system action...
        </div>
      )}
    </div>
  );
};

/* ============================================================
   REDIRECT PANEL
============================================================ */

const RedirectPanel = ({
  title,
  path,
  icon,
  description,
  onNavigate
}) => (
  <div className="redirect-box">
    <div className="icon">
      {icon}
    </div>

    <h2>{title}</h2>

    <p>{description}</p>

    <button
      type="button"
      className="btn-save"
      onClick={() => onNavigate(path)}
    >
      Open Module
    </button>
  </div>
);

/* ============================================================
   FIELD
============================================================ */

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  options = [],
  disabled = false,
  placeholder = '',
  fullWidth = false
}) => {
  const safeValue =
    value === null ||
    value === undefined
      ? ''
      : value;

  return (
    <div
      className={`form-group ${
        fullWidth ? 'full-width' : ''
      }`}
    >
      <label>{label}</label>

      {type === 'select' ? (
        <select
          value={safeValue}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
        >
          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={safeValue}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
          rows={4}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={safeValue}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
        />
      )}
    </div>
  );
};

/* ============================================================
   TOGGLE
============================================================ */

const Toggle = ({
  label,
  checked,
  onChange
}) => (
  <div className="toggle-group">
    <span>{label}</span>

    <input
      className="toggle-input"
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) =>
        onChange(event.target.checked)
      }
    />
  </div>
);

/* ============================================================
   SAVE BUTTON
============================================================ */

const SaveButton = ({
  saving,
  onClick,
  text = 'Save Changes'
}) => (
  <button
    type="button"
    className="btn-save"
    disabled={saving}
    onClick={onClick}
  >
    {saving ? 'Saving...' : text}
  </button>
);

/* ============================================================
   SAFE FORM STATE HOOK
============================================================ */

const useFormState = (
  defaults,
  data
) => {
  const [form, setForm] = useState({
    ...defaults,
    ...(data || {})
  });

  useEffect(() => {
    setForm({
      ...defaults,
      ...(data || {})
    });
  }, [data, defaults]);

  return [form, setForm];
};

export default AdminSettings;
