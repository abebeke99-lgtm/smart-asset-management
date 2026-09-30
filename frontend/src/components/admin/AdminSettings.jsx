import React, { useEffect, useState } from "react";
import { apiClient } from '../../utils/api';

const API_URL = "/api/settings";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getHeaders = (json = false) => {
  const token = getToken();

  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const defaultSettings = {
  systemName: "University Asset Management System",
  institutionName: "",
  institutionCode: "",
  email: "",
  phone: "",
  address: "",
  timezone: "Africa/Addis_Ababa",
  dateFormat: "YYYY-MM-DD",
  currency: "ETB",
  language: "English",
  maintenanceMode: false,
  emailNotifications: true,
  assetNotifications: true,
  maintenanceNotifications: true,
  lowStockNotifications: true,
  overdueNotifications: true,
};

const normalizeSettings = (payload) => {
  const data =
    payload?.settings ||
    payload?.data ||
    payload ||
    {};

  return {
    ...defaultSettings,
    ...data,
    maintenanceMode:
      Boolean(data.maintenanceMode ?? data.maintenance_mode ?? false),
    emailNotifications:
      Boolean(
        data.emailNotifications ??
          data.email_notifications ??
          true
      ),
    assetNotifications:
      Boolean(
        data.assetNotifications ??
          data.asset_notifications ??
          true
      ),
    maintenanceNotifications:
      Boolean(
        data.maintenanceNotifications ??
          data.maintenance_notifications ??
          true
      ),
    lowStockNotifications:
      Boolean(
        data.lowStockNotifications ??
          data.low_stock_notifications ??
          true
      ),
    overdueNotifications:
      Boolean(
        data.overdueNotifications ??
          data.overdue_notifications ??
          true
      ),
  };
};

export function AccountProfile({ user, onUserUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/users/profile/photo', formData);
      const nextUser = response?.data?.user || response?.data || user;
      if (onUserUpdate) onUserUpdate(nextUser);
    } catch (err) {
      setError(err?.message || 'Unable to upload profile photo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="account-profile-upload">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <span>Uploading...</span>}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] =
    useState(defaultSettings);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [activeSection, setActiveSection] =
    useState("general");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        API_URL,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load settings: ${response.status} ${response.statusText}`
        );
      }

      const payload =
        await response.json();

      setSettings(
        normalizeSettings(payload)
      );
    } catch (err) {
      console.error(
        "Settings load error:",
        err
      );

      setError(
        err.message ||
          "Unable to load system settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setSettings((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setSuccess("");
  };

  const saveSettings = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...settings,
        maintenance_mode:
          settings.maintenanceMode,
        email_notifications:
          settings.emailNotifications,
        asset_notifications:
          settings.assetNotifications,
        maintenance_notifications:
          settings.maintenanceNotifications,
        low_stock_notifications:
          settings.lowStockNotifications,
        overdue_notifications:
          settings.overdueNotifications,
      };

      const response = await fetch(
        API_URL,
        {
          method: "PUT",
          headers: getHeaders(true),
          body: JSON.stringify(payload),
        }
      );

      const text =
        await response.text();

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
            `Unable to save settings: ${response.status}`
        );
      }

      if (data) {
        setSettings(
          normalizeSettings(data)
        );
      }

      setSuccess(
        "System settings saved successfully."
      );
    } catch (err) {
      console.error(
        "Settings save error:",
        err
      );

      setError(
        err.message ||
          "Unable to save system settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    const confirmed =
      window.confirm(
        "Reset the current form to the default settings?"
      );

    if (!confirmed) return;

    setSettings(defaultSettings);
    setError("");
    setSuccess(
      "Default settings loaded. Click Save Changes to apply them."
    );
  };

  const sections = [
    {
      id: "general",
      label: "General",
      icon: "⚙️",
    },
    {
      id: "localization",
      label: "Localization",
      icon: "🌐",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: "🔔",
    },
    {
      id: "system",
      label: "System",
      icon: "🖥️",
    },
  ];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>
            Loading system settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / System / Settings
          </div>

          <h1 style={styles.title}>
            System Settings
          </h1>

          <p style={styles.subtitle}>
            Configure the university asset management
            system and administrative preferences.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={resetSettings}
            style={styles.secondaryButton}
          >
            Reset
          </button>

          <button
            type="submit"
            form="settings-form"
            disabled={saving}
            style={{
              ...styles.primaryButton,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={styles.successAlert}>
          {success}
        </div>
      )}

      <form
        id="settings-form"
        onSubmit={saveSettings}
      >
        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <div style={styles.sidebarTitle}>
              Settings
            </div>

            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() =>
                  setActiveSection(
                    section.id
                  )
                }
                style={{
                  ...styles.navButton,
                  ...(activeSection ===
                  section.id
                    ? styles.navButtonActive
                    : {}),
                }}
              >
                <span style={styles.navIcon}>
                  {section.icon}
                </span>

                <span>
                  {section.label}
                </span>
              </button>
            ))}
          </aside>

          <main style={styles.content}>
            {activeSection === "general" && (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>
                      General Settings
                    </h2>

                    <p style={styles.cardDescription}>
                      Basic information used throughout
                      the system.
                    </p>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      System Name
                    </label>

                    <input
                      name="systemName"
                      value={
                        settings.systemName
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="University Asset Management System"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Institution Name
                    </label>

                    <input
                      name="institutionName"
                      value={
                        settings.institutionName
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="University name"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Institution Code
                    </label>

                    <input
                      name="institutionCode"
                      value={
                        settings.institutionCode
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="University code"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Email
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={settings.email}
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="admin@university.edu"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Phone
                    </label>

                    <input
                      name="phone"
                      value={settings.phone}
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="+251..."
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Address
                    </label>

                    <input
                      name="address"
                      value={
                        settings.address
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                      placeholder="University address"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection ===
              "localization" && (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>
                      Localization
                    </h2>

                    <p style={styles.cardDescription}>
                      Configure regional formats and
                      system language preferences.
                    </p>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Timezone
                    </label>

                    <select
                      name="timezone"
                      value={
                        settings.timezone
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                    >
                      <option value="Africa/Addis_Ababa">
                        Africa/Addis_Ababa
                      </option>

                      <option value="UTC">
                        UTC
                      </option>
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Date Format
                    </label>

                    <select
                      name="dateFormat"
                      value={
                        settings.dateFormat
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                    >
                      <option value="YYYY-MM-DD">
                        YYYY-MM-DD
                      </option>

                      <option value="DD/MM/YYYY">
                        DD/MM/YYYY
                      </option>

                      <option value="MM/DD/YYYY">
                        MM/DD/YYYY
                      </option>
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Currency
                    </label>

                    <select
                      name="currency"
                      value={
                        settings.currency
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                    >
                      <option value="ETB">
                        ETB — Ethiopian Birr
                      </option>

                      <option value="USD">
                        USD — US Dollar
                      </option>
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Language
                    </label>

                    <select
                      name="language"
                      value={
                        settings.language
                      }
                      onChange={
                        handleChange
                      }
                      style={styles.input}
                    >
                      <option value="English">
                        English
                      </option>

                      <option value="Amharic">
                        Amharic
                      </option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {activeSection ===
              "notifications" && (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>
                      Notification Settings
                    </h2>

                    <p style={styles.cardDescription}>
                      Control system notifications and
                      administrative alerts.
                    </p>
                  </div>
                </div>

                <div style={styles.toggleList}>
                  <ToggleRow
                    name="emailNotifications"
                    checked={
                      settings.emailNotifications
                    }
                    onChange={
                      handleChange
                    }
                    title="Email Notifications"
                    description="Enable system-generated email notifications."
                  />

                  <ToggleRow
                    name="assetNotifications"
                    checked={
                      settings.assetNotifications
                    }
                    onChange={
                      handleChange
                    }
                    title="Asset Notifications"
                    description="Notify administrators about important asset events."
                  />

                  <ToggleRow
                    name="maintenanceNotifications"
                    checked={
                      settings.maintenanceNotifications
                    }
                    onChange={
                      handleChange
                    }
                    title="Maintenance Notifications"
                    description="Notify users about maintenance requests and status changes."
                  />

                  <ToggleRow
                    name="lowStockNotifications"
                    checked={
                      settings.lowStockNotifications
                    }
                    onChange={
                      handleChange
                    }
                    title="Low Stock Notifications"
                    description="Alert administrators when inventory reaches low levels."
                  />

                  <ToggleRow
                    name="overdueNotifications"
                    checked={
                      settings.overdueNotifications
                    }
                    onChange={
                      handleChange
                    }
                    title="Overdue Notifications"
                    description="Alert administrators about overdue maintenance and operational tasks."
                  />
                </div>
              </section>
            )}

            {activeSection === "system" && (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>
                      System Controls
                    </h2>

                    <p style={styles.cardDescription}>
                      Administrative controls that affect
                      system operation.
                    </p>
                  </div>
                </div>

                <div style={styles.warningBox}>
                  <strong>
                    Maintenance Mode
                  </strong>

                  <p>
                    When enabled, the system can be
                    placed into maintenance mode while
                    administrators perform system work.
                  </p>
                </div>

                <ToggleRow
                  name="maintenanceMode"
                  checked={
                    settings.maintenanceMode
                  }
                  onChange={
                    handleChange
                  }
                  title="Enable Maintenance Mode"
                  description="Enable maintenance mode for system administration and maintenance activities."
                  warning
                />
              </section>
            )}
          </main>
        </div>
      </form>
    </div>
  );
}

function ToggleRow({
  name,
  checked,
  onChange,
  title,
  description,
  warning = false,
}) {
  return (
    <div style={styles.toggleRow}>
      <div style={styles.toggleText}>
        <div style={styles.toggleTitle}>
          {title}
        </div>

        <div style={styles.toggleDescription}>
          {description}
        </div>
      </div>

      <label
        style={{
          ...styles.switch,
          ...(warning && checked
            ? styles.switchWarning
            : {}),
        }}
      >
        <input
          type="checkbox"
          name={name}
          checked={Boolean(checked)}
          onChange={onChange}
          style={styles.hiddenCheckbox}
        />

        <span
          style={{
            ...styles.slider,
            ...(checked
              ? styles.sliderActive
              : {}),
          }}
        />
      </label>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    background: "#F3F6F9",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, Arial, sans-serif",
    color: "#111827",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    fontWeight: 700,
    color: "#111827",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexShrink: 0,
  },

  primaryButton: {
    border: "none",
    borderRadius: "8px",
    background: "#2563EB",
    color: "#FFFFFF",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorAlert: {
    marginBottom: "18px",
    padding: "13px 16px",
    borderRadius: "8px",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#B91C1C",
    fontSize: "14px",
  },

  successAlert: {
    marginBottom: "18px",
    padding: "13px 16px",
    borderRadius: "8px",
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    color: "#166534",
    fontSize: "14px",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "230px minmax(0, 1fr)",
    gap: "20px",
    alignItems: "start",
  },

  sidebar: {
    background: "#111827",
    borderRadius: "10px",
    padding: "12px",
    boxSizing: "border-box",
  },

  sidebarTitle: {
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: 700,
    padding: "10px 12px 14px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  navButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "none",
    borderRadius: "7px",
    background: "transparent",
    color: "#CBD5E1",
    padding: "11px 12px",
    textAlign: "left",
    fontSize: "14px",
    cursor: "pointer",
    marginBottom: "4px",
  },

  navButtonActive: {
    background: "#2563EB",
    color: "#FFFFFF",
  },

  navIcon: {
    width: "22px",
    textAlign: "center",
  },

  content: {
    minWidth: 0,
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    boxShadow:
      "0 1px 3px rgba(15, 23, 42, 0.05)",
    overflow: "hidden",
  },

  cardHeader: {
    padding: "22px 24px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#111827",
  },

  cardDescription: {
    margin: "6px 0 0",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "20px",
    padding: "24px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
    padding: "11px 12px",
    background: "#FFFFFF",
    color: "#111827",
    fontSize: "14px",
    outline: "none",
  },

  toggleList: {
    padding: "8px 24px",
  },

  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "18px 0",
    borderBottom:
      "1px solid #E2E8F0",
  },

  toggleText: {
    minWidth: 0,
  },

  toggleTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1E293B",
  },

  toggleDescription: {
    marginTop: "5px",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  switch: {
    position: "relative",
    width: "46px",
    height: "25px",
    display: "block",
    flexShrink: 0,
    cursor: "pointer",
  },

  switchWarning: {
    outline:
      "2px solid rgba(244, 197, 66, 0.25)",
    borderRadius: "20px",
  },

  hiddenCheckbox: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
  },

  slider: {
    position: "absolute",
    inset: 0,
    borderRadius: "20px",
    background: "#CBD5E1",
    transition: "0.2s",
  },

  sliderActive: {
    background: "#2563EB",
  },

  warningBox: {
    margin: "24px 24px 8px",
    padding: "16px",
    borderRadius: "8px",
    background: "#FFFBEB",
    border:
      "1px solid #FDE68A",
    color: "#92400E",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  loadingCard: {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid #E2E8F0",
  },

  spinner: {
    width: "32px",
    height: "32px",
    border:
      "3px solid #E2E8F0",
    borderTop:
      "3px solid #2563EB",
    borderRadius: "50%",
    animation:
      "spin 0.8s linear infinite",
  },

  loadingText: {
    marginTop: "14px",
    color: "#64748B",
    fontSize: "14px",
  },
};