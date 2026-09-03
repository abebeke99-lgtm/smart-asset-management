import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';

/* ============================================================
   SETTINGS CATEGORIES
============================================================ */

const CATEGORIES = [
  {
    id: 'organization',
    label: '1. 🏢 Organization & Branding'
  },
  {
    id: 'account',
    label: '2. 👤 Account & Profile'
  },
  {
    id: 'security',
    label: '3. 🛡️ Security & Authentication'
  },
  {
    id: 'roles',
    label: '4. 👥 Roles & Permissions'
  },
  {
    id: 'notifications',
    label: '5. 🔔 Notifications & Alerts'
  },
  {
    id: 'localization',
    label: '6. 🌐 Localization'
  },
  {
    id: 'assets',
    label: '7. 📦 Asset Configuration'
  },
  {
    id: 'workflow',
    label: '8. 🔄 Workflow & Approval'
  },
  {
    id: 'rfid',
    label: '9. 📡 RFID & Tracking'
  },
  {
    id: 'maintenance',
    label: '10. 🔧 Maintenance Configuration'
  },
  {
    id: 'financial',
    label: '11. 💰 Financial Configuration'
  },
  {
    id: 'reports',
    label: '12. 📊 Reports & Data'
  },
  {
    id: 'audit',
    label: '13. 📋 Audit & Compliance'
  },
  {
    id: 'monitoring',
    label: '14. 👁️ System Monitoring'
  },
  {
    id: 'integrations',
    label: '15. 🔗 Integrations'
  },
  {
    id: 'backup',
    label: '16. 💾 Backup & Recovery'
  },
  {
    id: 'maintenance_sys',
    label: '17. 🧹 Data & System Maintenance'
  }
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
    email: true,
    system: true,
    maintenance: true,
    asset: true,
    rfid: true,
    security: true,
    lowstock: true,
    overdue: true,
    approval: true
  },

  localization: {
    lang: 'English',
    dateFmt: 'DD/MM/YYYY',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa'
  },

  assets: {
    prefix: 'AST',
    numFmt: '0000',
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

  const [activeTab, setActiveTab] = useState('organization');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [auditLogs, setAuditLogs] = useState([]);

  const [sysStatus, setSysStatus] = useState({
    api: 'Checking...',
    db: 'Checking...',
    storage: 'Checking...',
    uptime: 'Checking...'
  });

  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const isDark = theme === 'dark';

  /* ============================================================
     LOAD SETTINGS
  ============================================================ */

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }

    if (activeTab === 'monitoring') {
      fetchSystemStatus();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);

    try {
      const response = await apiClient.get('/api/settings');

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
     SYSTEM MONITORING
  ============================================================ */

  const fetchSystemStatus = async () => {
    try {
      const response = await apiClient.get('/api/health');

      const data =
        response?.data?.status ||
        response?.data ||
        {};

      setSysStatus({
        api:
          data.api ||
          data.apiStatus ||
          'Operational',

        db:
          data.db ||
          data.database ||
          data.databaseStatus ||
          'Connected',

        storage:
          data.storage ||
          data.storageStatus ||
          'Healthy',

        uptime:
          data.uptime ||
          'Available'
      });
    } catch (error) {
      console.error('System health error:', error);

      setSysStatus({
        api: 'Offline',
        db: 'Error',
        storage: 'Unknown',
        uptime: 'Unavailable'
      });
    }
  };

  /* ============================================================
     SAVE SETTINGS
  ============================================================ */

  const handleUpdate = async (category, data) => {
    setSaving(true);

    try {
      await apiClient.put('/api/settings', {
        category,
        data
      });

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
          <MonitoringView
            status={sysStatus}
            onRefresh={fetchSystemStatus}
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
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .light-mode {
          background: #f8fafc;
          color: #0f172a;
        }

        .dark-mode {
          background: #0f172a;
          color: #f8fafc;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .settings-header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
        }

        .settings-subtitle {
          margin-top: 5px;
          color: #64748b;
          font-size: 13px;
        }

        .dark-mode .settings-subtitle {
          color: #94a3b8;
        }

        .admin-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #10b981;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .settings-nav {
          display: flex;
          overflow-x: auto;
          gap: 8px;
          white-space: nowrap;
          padding: 10px 0 16px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
          scrollbar-width: thin;
        }

        .dark-mode .settings-nav {
          border-color: #334155;
        }

        .nav-item {
          padding: 10px 15px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          transition: all 0.2s ease;
        }

        .dark-mode .nav-item {
          background: #1e293b;
          border-color: #334155;
          color: #cbd5e1;
        }

        .nav-item:hover {
          border-color: #3b82f6;
          color: #2563eb;
        }

        .nav-item.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
        }

        .content-area {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 26px;
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }

        .dark-mode .content-area {
          background: #1e293b;
          border-color: #334155;
          box-shadow: none;
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
          grid-template-columns:
            repeat(auto-fit, minmax(280px, 1fr));
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
          transition: border 0.2s ease,
                      box-shadow 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #3b82f6;
          box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.12);
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

        .status-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(200px, 1fr));
          gap: 18px;
        }

        .status-card {
          padding: 22px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .dark-mode .status-card {
          background: #0f172a;
          border-color: #334155;
        }

        .status-label {
          display: block;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .status-val {
          display: block;
          margin-top: 9px;
          font-size: 18px;
          font-weight: 800;
          color: #10b981;
        }

        .redirect-box {
          text-align: center;
          padding: 55px 25px;
        }

        .redirect-box .icon {
          font-size: 50px;
          margin-bottom: 15px;
        }

        .redirect-box h2 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .redirect-box p {
          max-width: 600px;
          margin: 0 auto 22px;
          color: #64748b;
          font-size: 14px;
        }

        .dark-mode .redirect-box p {
          color: #94a3b8;
        }

        .audit-table-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .dark-mode .audit-table-wrapper {
          border-color: #334155;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 700px;
          font-size: 13px;
        }

        .audit-table th,
        .audit-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark-mode .audit-table th,
        .dark-mode .audit-table td {
          border-color: #334155;
        }

        .audit-table th {
          background: #f8fafc;
          font-weight: 800;
        }

        .dark-mode .audit-table th {
          background: #0f172a;
        }

        .action-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(220px, 1fr));
          gap: 15px;
        }

        .action-button {
          min-height: 80px;
          border-radius: 9px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dark-mode .action-button {
          background: #0f172a;
          border-color: #334155;
          color: #e2e8f0;
        }

        .action-button:hover:not(:disabled) {
          border-color: #3b82f6;
          transform: translateY(-1px);
        }

        .action-button.danger {
          color: #dc2626;
        }

        .empty-state,
        .loading-state {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #64748b;
          font-size: 14px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .admin-settings-layout {
            padding: 14px;
          }

          .settings-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-header h1 {
            font-size: 21px;
          }

          .content-area {
            padding: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="settings-header">
        <div>
          <h1>⚙️ System Settings</h1>

          <div className="settings-subtitle">
            Configure organization, security, assets,
            notifications, workflows and system behavior.
          </div>
        </div>

        <div className="admin-status">
          ● Admin Verified
        </div>
      </div>

      {/* ======================================================
          CATEGORY NAVIGATION
      ====================================================== */}

      <nav
        className="settings-nav"
        aria-label="Settings categories"
      >
        {CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.id}
            className={`nav-item ${
              activeTab === category.id
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setActiveTab(category.id)
            }
          >
            {category.label}
          </button>
        ))}
      </nav>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <main className="content-area">
        {renderActiveSetting()}
      </main>
    </div>
  );
};

/* ============================================================
   ORGANIZATION & BRANDING
============================================================ */

const OrganizationForm = ({
  data,
  onSave,
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

      <SaveButton
        saving={saving}
        onClick={() => onSave(form)}
      />
    </div>
  );
};

/* ============================================================
   ACCOUNT
============================================================ */

const AccountProfile = ({ user }) => (
  <div className="form-section">
    <h2 className="section-title">
      👤 Account & Profile
    </h2>

    <p className="section-description">
      Current administrator account information.
    </p>

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

  const items = [
    ['email', 'Email Notifications'],
    ['system', 'System Notifications'],
    ['maintenance', 'Maintenance Alerts'],
    ['asset', 'Asset Notifications'],
    ['rfid', 'RFID Notifications'],
    ['security', 'Security Alerts'],
    ['lowstock', 'Low Stock Alerts'],
    ['overdue', 'Overdue Return Alerts'],
    ['approval', 'Approval Notifications']
  ];

  return (
    <div className="form-section">
      <h2 className="section-title">
        🔔 Notifications & Alerts
      </h2>

      <p className="section-description">
        Control system notifications and alert rules.
      </p>

      {items.map(([key, label]) => (
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
        text="Update Notifications"
        onClick={() => onSave(form)}
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
          label="Number Format"
          placeholder="0000"
          value={form.numFmt}
          onChange={(value) =>
            setForm({
              ...form,
              numFmt: value
            })
          }
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
        Smart University Asset Management System.
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
   MONITORING
============================================================ */

const MonitoringView = ({
  status,
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
            👁️ System Monitoring
          </h2>

          <p className="section-description">
            Monitor API, database and storage health.
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

      <div className="status-grid">
        <StatusCard
          label="API Status"
          value={status.api}
        />

        <StatusCard
          label="Database"
          value={status.db}
        />

        <StatusCard
          label="Storage"
          value={status.storage}
        />

        <StatusCard
          label="System Uptime"
          value={status.uptime}
        />
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
   STATUS CARD
============================================================ */

const StatusCard = ({
  label,
  value
}) => (
  <div className="status-card">
    <span className="status-label">
      {label}
    </span>

    <span className="status-val">
      {value}
    </span>
  </div>
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
