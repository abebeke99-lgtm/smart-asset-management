import React, { useEffect, useMemo, useState } from "react";

const API_URL = "/api/enam";

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
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
};

const normalizeData = (payload) => {
  const data =
    payload?.data ||
    payload?.integration ||
    payload ||
    {};

  return {
    ...data,
    settings: data.settings || {},
    statistics: data.statistics || {},
    logs: Array.isArray(data.logs)
      ? data.logs
      : [],
    mappings: Array.isArray(data.mappings)
      ? data.mappings
      : [],
  };
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const statusStyle = (status) => {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("connected") ||
    value.includes("active") ||
    value.includes("success") ||
    value.includes("healthy") ||
    value.includes("enabled")
  ) {
    return {
      background: "#ECFDF5",
      color: "#047857",
    };
  }

  if (
    value.includes("pending") ||
    value.includes("warning") ||
    value.includes("syncing")
  ) {
    return {
      background: "#FFFBEB",
      color: "#B45309",
    };
  }

  if (
    value.includes("failed") ||
    value.includes("error") ||
    value.includes("disconnected") ||
    value.includes("disabled")
  ) {
    return {
      background: "#FEF2F2",
      color: "#B91C1C",
    };
  }

  return {
    background: "#F1F5F9",
    color: "#475569",
  };
};

export default function EnamIntegration() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showSettings, setShowSettings] = useState(false);

  const [form, setForm] = useState({
    enabled: false,
    baseUrl: "",
    apiKey: "",
    organizationCode: "",
    syncAssets: true,
    syncUsers: true,
    syncOrganizations: true,
    autoSync: false,
    syncInterval: "60",
  });

  const loadIntegration = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load ENAM integration: ${response.status} ${response.statusText}`
        );
      }

      const payload = await response.json();
      const normalized = normalizeData(payload);

      setData(normalized);

      const settings =
        normalized.settings || {};

      setForm({
        enabled:
          settings.enabled ??
          normalized.enabled ??
          false,

        baseUrl:
          settings.baseUrl ||
          settings.base_url ||
          normalized.baseUrl ||
          "",

        apiKey:
          settings.apiKey ||
          settings.api_key ||
          "",

        organizationCode:
          settings.organizationCode ||
          settings.organization_code ||
          "",

        syncAssets:
          settings.syncAssets ??
          settings.sync_assets ??
          true,

        syncUsers:
          settings.syncUsers ??
          settings.sync_users ??
          true,

        syncOrganizations:
          settings.syncOrganizations ??
          settings.sync_organizations ??
          true,

        autoSync:
          settings.autoSync ??
          settings.auto_sync ??
          false,

        syncInterval:
          String(
            settings.syncInterval ??
              settings.sync_interval ??
              60
          ),
      });
    } catch (err) {
      console.error(
        "ENAM integration error:",
        err
      );

      setError(
        err.message ||
          "Unable to load ENAM integration."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegration();
  }, []);

  const saveSettings = async (event) => {
    event?.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        API_URL,
        {
          method: "PUT",
          headers: getHeaders(true),
          body: JSON.stringify({
            enabled: form.enabled,
            baseUrl: form.baseUrl,
            apiKey: form.apiKey,
            organizationCode:
              form.organizationCode,
            syncAssets:
              form.syncAssets,
            syncUsers:
              form.syncUsers,
            syncOrganizations:
              form.syncOrganizations,
            autoSync:
              form.autoSync,
            syncInterval:
              Number(form.syncInterval) || 60,
          }),
        }
      );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          message ||
            `Unable to save ENAM settings: ${response.status}`
        );
      }

      setSuccess(
        "ENAM integration settings saved successfully."
      );

      await loadIntegration();
      setShowSettings(false);
    } catch (err) {
      console.error(
        "Save ENAM settings error:",
        err
      );

      setError(
        err.message ||
          "Unable to save ENAM settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/sync`,
        {
          method: "POST",
          headers: getHeaders(true),
          body: JSON.stringify({
            syncAssets:
              form.syncAssets,
            syncUsers:
              form.syncUsers,
            syncOrganizations:
              form.syncOrganizations,
          }),
        }
      );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          message ||
            `ENAM synchronization failed: ${response.status}`
        );
      }

      const payload =
        await response.json();

      setSuccess(
        payload?.message ||
          "ENAM synchronization completed successfully."
      );

      await loadIntegration();
    } catch (err) {
      console.error(
        "ENAM sync error:",
        err
      );

      setError(
        err.message ||
          "Unable to synchronize with ENAM."
      );
    } finally {
      setSyncing(false);
    }
  };

  const testConnection = async () => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/test`,
        {
          method: "POST",
          headers: getHeaders(true),
          body: JSON.stringify({
            baseUrl: form.baseUrl,
            apiKey: form.apiKey,
            organizationCode:
              form.organizationCode,
          }),
        }
      );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          message ||
            `Connection test failed: ${response.status}`
        );
      }

      const payload =
        await response.json();

      setSuccess(
        payload?.message ||
          "ENAM connection test completed successfully."
      );

      await loadIntegration();
    } catch (err) {
      console.error(
        "ENAM connection test error:",
        err
      );

      setError(
        err.message ||
          "Unable to test ENAM connection."
      );
    }
  };

  const statistics =
    data?.statistics || {};

  const logs = data?.logs || [];
  const mappings = data?.mappings || [];

  const connectionStatus =
    data?.status ||
    data?.connectionStatus ||
    data?.connection_status ||
    (form.enabled
      ? "Enabled"
      : "Disabled");

  const totalSynced = useMemo(() => {
    return (
      Number(
        statistics.totalSynced ??
          statistics.total_synced ??
          0
      ) || 0
    );
  }, [statistics]);

  const successfulSyncs =
    Number(
      statistics.successfulSyncs ??
        statistics.successful_syncs ??
        0
    ) || 0;

  const failedSyncs =
    Number(
      statistics.failedSyncs ??
        statistics.failed_syncs ??
        0
    ) || 0;

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>
            Loading ENAM integration...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / ENAM Integration
          </div>

          <h1 style={styles.title}>
            ENAM Integration
          </h1>

          <p style={styles.subtitle}>
            Manage the university asset system
            integration with ENAM and monitor
            synchronization activity.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={testConnection}
            style={styles.secondaryButton}
          >
            Test Connection
          </button>

          <button
            type="button"
            onClick={() =>
              setShowSettings(true)
            }
            style={styles.primaryButton}
          >
            Integration Settings
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <strong>Error:</strong>{" "}
          {error}
        </div>
      )}

      {success && (
        <div style={styles.successAlert}>
          <strong>Success:</strong>{" "}
          {success}
        </div>
      )}

      <section style={styles.connectionBanner}>
        <div style={styles.connectionLeft}>
          <div
            style={{
              ...styles.connectionIcon,
              ...statusStyle(
                connectionStatus
              ),
            }}
          >
            ↔
          </div>

          <div>
            <div style={styles.connectionTitle}>
              ENAM Integration
            </div>

            <div style={styles.connectionText}>
              {data?.lastSync ||
              data?.last_sync
                ? `Last synchronization: ${formatDate(
                    data.lastSync ||
                      data.last_sync
                  )}`
                : "No synchronization record available."}
            </div>
          </div>
        </div>

        <span
          style={{
            ...styles.statusBadge,
            ...statusStyle(
              connectionStatus
            ),
          }}
        >
          {connectionStatus}
        </span>
      </section>

      <div style={styles.statsGrid}>
        <StatCard
          title="Total Synced"
          value={totalSynced}
          icon="↻"
        />

        <StatCard
          title="Successful Syncs"
          value={successfulSyncs}
          icon="✓"
        />

        <StatCard
          title="Failed Syncs"
          value={failedSyncs}
          icon="!"
        />

        <StatCard
          title="Data Mappings"
          value={mappings.length}
          icon="⇄"
        />
      </div>

      <div style={styles.mainGrid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Integration Overview
              </h2>

              <p style={styles.cardDescription}>
                Current ENAM integration configuration.
              </p>
            </div>
          </div>

          <div style={styles.overviewBody}>
            <OverviewItem
              label="Integration Status"
              value={
                form.enabled
                  ? "Enabled"
                  : "Disabled"
              }
              badge
            />

            <OverviewItem
              label="ENAM Endpoint"
              value={
                form.baseUrl || "Not configured"
              }
            />

            <OverviewItem
              label="Organization Code"
              value={
                form.organizationCode ||
                "Not configured"
              }
            />

            <OverviewItem
              label="Automatic Synchronization"
              value={
                form.autoSync
                  ? `Enabled — every ${form.syncInterval} minutes`
                  : "Disabled"
              }
            />

            <OverviewItem
              label="Asset Synchronization"
              value={
                form.syncAssets
                  ? "Enabled"
                  : "Disabled"
              }
            />

            <OverviewItem
              label="User Synchronization"
              value={
                form.syncUsers
                  ? "Enabled"
                  : "Disabled"
              }
            />

            <OverviewItem
              label="Organization Synchronization"
              value={
                form.syncOrganizations
                  ? "Enabled"
                  : "Disabled"
              }
            />

            <OverviewItem
              label="Last Synchronization"
              value={formatDate(
                data?.lastSync ||
                  data?.last_sync
              )}
            />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Synchronization
              </h2>

              <p style={styles.cardDescription}>
                Start a manual synchronization with
                ENAM.
              </p>
            </div>
          </div>

          <div style={styles.syncBody}>
            <div style={styles.syncIcon}>
              ↻
            </div>

            <h3 style={styles.syncTitle}>
              Synchronize Now
            </h3>

            <p style={styles.syncText}>
              The synchronization will use the
              currently enabled data categories.
            </p>

            <div style={styles.syncOptions}>
              <SyncOption
                label="Assets"
                enabled={form.syncAssets}
              />

              <SyncOption
                label="Users"
                enabled={form.syncUsers}
              />

              <SyncOption
                label="Organizations"
                enabled={
                  form.syncOrganizations
                }
              />
            </div>

            <button
              type="button"
              onClick={syncNow}
              disabled={
                syncing || !form.enabled
              }
              style={{
                ...styles.syncButton,
                opacity:
                  syncing || !form.enabled
                    ? 0.55
                    : 1,
                cursor:
                  syncing || !form.enabled
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {syncing
                ? "Synchronizing..."
                : "Synchronize Now"}
            </button>

            {!form.enabled && (
              <div style={styles.disabledNote}>
                Enable the ENAM integration before
                starting synchronization.
              </div>
            )}
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Data Mapping
            </h2>

            <p style={styles.cardDescription}>
              Mapping information between the local
              asset system and ENAM.
            </p>
          </div>
        </div>

        {mappings.length === 0 ? (
          <EmptyState text="No ENAM data mappings are available." />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    Local Field
                  </th>

                  <th style={styles.th}>
                    ENAM Field
                  </th>

                  <th style={styles.th}>
                    Entity
                  </th>

                  <th style={styles.th}>
                    Status
                  </th>

                  <th style={styles.th}>
                    Last Updated
                  </th>
                </tr>
              </thead>

              <tbody>
                {mappings.map(
                  (mapping, index) => (
                    <tr
                      key={
                        mapping?.id ||
                        mapping?.mappingId ||
                        index
                      }
                    >
                      <td style={styles.td}>
                        {mapping?.localField ||
                          mapping?.local_field ||
                          "—"}
                      </td>

                      <td style={styles.td}>
                        {mapping?.enamField ||
                          mapping?.enam_field ||
                          "—"}
                      </td>

                      <td style={styles.td}>
                        {mapping?.entity ||
                          mapping?.module ||
                          "—"}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...statusStyle(
                              mapping?.status ||
                                "Active"
                            ),
                          }}
                        >
                          {mapping?.status ||
                            "Active"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {formatDate(
                          mapping?.updatedAt ||
                            mapping?.updated_at
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          ...styles.card,
          marginTop: "18px",
        }}
      >
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Synchronization History
            </h2>

            <p style={styles.cardDescription}>
              Recent ENAM integration events.
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState text="No synchronization history is available." />
        ) : (
          <div style={styles.logList}>
            {logs.map((log, index) => {
              const status =
                log?.status ||
                log?.result ||
                "Unknown";

              return (
                <div
                  key={
                    log?.id ||
                    log?.logId ||
                    index
                  }
                  style={styles.logRow}
                >
                  <div
                    style={{
                      ...styles.logIcon,
                      ...statusStyle(status),
                    }}
                  >
                    {String(status)
                      .toLowerCase()
                      .includes("fail")
                      ? "!"
                      : "✓"}
                  </div>

                  <div style={styles.logContent}>
                    <div style={styles.logTitle}>
                      {log?.action ||
                        log?.operation ||
                        log?.event ||
                        "Synchronization"}
                    </div>

                    <div style={styles.logMessage}>
                      {log?.message ||
                        log?.description ||
                        "ENAM integration activity"}
                    </div>

                    <div style={styles.logDate}>
                      {formatDate(
                        log?.createdAt ||
                          log?.created_at ||
                          log?.timestamp ||
                          log?.date
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.statusBadge,
                      ...statusStyle(status),
                    }}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showSettings && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowSettings(false);
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  ENAM Integration Settings
                </h2>

                <p style={styles.modalSubtitle}>
                  Configure the ENAM connection and
                  synchronization options.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowSettings(false)
                }
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveSettings}
              style={styles.form}
            >
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      enabled:
                        event.target.checked,
                    })
                  }
                />

                <span>
                  Enable ENAM Integration
                </span>
              </label>

              <div style={styles.formGrid}>
                <Field
                  label="ENAM Base URL"
                  value={form.baseUrl}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      baseUrl: value,
                    })
                  }
                  placeholder="https://example.gov.et/api"
                />

                <Field
                  label="Organization Code"
                  value={
                    form.organizationCode
                  }
                  onChange={(value) =>
                    setForm({
                      ...form,
                      organizationCode:
                        value,
                    })
                  }
                  placeholder="University code"
                />

                <Field
                  label="API Key"
                  type="password"
                  value={form.apiKey}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      apiKey: value,
                    })
                  }
                  placeholder="Enter API key"
                />

                <Field
                  label="Sync Interval (minutes)"
                  type="number"
                  min="1"
                  value={form.syncInterval}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      syncInterval:
                        value,
                    })
                  }
                />
              </div>

              <div style={styles.sectionTitle}>
                Synchronization Options
              </div>

              <div style={styles.optionsBox}>
                <label style={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={
                      form.syncAssets
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        syncAssets:
                          event.target
                            .checked,
                      })
                    }
                  />

                  <span>
                    Synchronize Assets
                  </span>
                </label>

                <label style={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={
                      form.syncUsers
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        syncUsers:
                          event.target
                            .checked,
                      })
                    }
                  />

                  <span>
                    Synchronize Users
                  </span>
                </label>

                <label style={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={
                      form.syncOrganizations
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        syncOrganizations:
                          event.target
                            .checked,
                      })
                    }
                  />

                  <span>
                    Synchronize Organizations
                  </span>
                </label>

                <label style={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={form.autoSync}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        autoSync:
                          event.target
                            .checked,
                      })
                    }
                  />

                  <span>
                    Enable Automatic Synchronization
                  </span>
                </label>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() =>
                    setShowSettings(false)
                  }
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    ...styles.primaryButton,
                    opacity: saving
                      ? 0.6
                      : 1,
                  }}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1100px) {
            .enam-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}
      </style>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>
        {icon}
      </div>

      <div>
        <div style={styles.statTitle}>
          {title}
        </div>

        <div style={styles.statValue}>
          {value}
        </div>
      </div>
    </div>
  );
}

function OverviewItem({
  label,
  value,
  badge = false,
}) {
  return (
    <div style={styles.overviewItem}>
      <div style={styles.overviewLabel}>
        {label}
      </div>

      {badge ? (
        <span
          style={{
            ...styles.statusBadge,
            ...statusStyle(value),
          }}
        >
          {value}
        </span>
      ) : (
        <div style={styles.overviewValue}>
          {value}
        </div>
      )}
    </div>
  );
}

function SyncOption({
  label,
  enabled,
}) {
  return (
    <div style={styles.syncOption}>
      <span
        style={{
          ...styles.syncCheck,
          background: enabled
            ? "#ECFDF5"
            : "#F1F5F9",
          color: enabled
            ? "#047857"
            : "#94A3B8",
        }}
      >
        {enabled ? "✓" : "—"}
      </span>

      <span>{label}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>
        {label}
      </span>

      <input
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={styles.input}
      />
    </label>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>
        ◌
      </div>

      <div style={styles.emptyText}>
        {text}
      </div>
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
    fontWeight: 700,
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#64748B",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    border: "none",
    borderRadius: "8px",
    background: "#2563EB",
    color: "#FFFFFF",
    padding: "10px 15px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorAlert: {
    marginBottom: "16px",
    padding: "13px 16px",
    borderRadius: "8px",
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#B91C1C",
    fontSize: "13px",
  },

  successAlert: {
    marginBottom: "16px",
    padding: "13px 16px",
    borderRadius: "8px",
    border: "1px solid #A7F3D0",
    background: "#ECFDF5",
    color: "#047857",
    fontSize: "13px",
  },

  connectionBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "16px 20px",
    marginBottom: "18px",
  },

  connectionLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  connectionIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: 700,
  },

  connectionTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#1E293B",
  },

  connectionText: {
    marginTop: "4px",
    color: "#64748B",
    fontSize: "12px",
  },

  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "17px",
  },

  statIcon: {
    width: "40px",
    height: "40px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9px",
    background: "#EFF6FF",
    color: "#2563EB",
    fontSize: "17px",
    fontWeight: 700,
  },

  statTitle: {
    color: "#64748B",
    fontSize: "12px",
    marginBottom: "4px",
  },

  statValue: {
    color: "#111827",
    fontSize: "21px",
    fontWeight: 700,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.25fr) minmax(320px, 0.75fr)",
    gap: "18px",
    marginBottom: "18px",
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    overflow: "hidden",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "15px",
    padding: "19px 21px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  cardTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "#111827",
  },

  cardDescription: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  overviewBody: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    padding: "21px",
  },

  overviewItem: {
    minWidth: 0,
  },

  overviewLabel: {
    color: "#94A3B8",
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "6px",
  },

  overviewValue: {
    color: "#334155",
    fontSize: "13px",
    fontWeight: 500,
    wordBreak: "break-word",
  },

  syncBody: {
    padding: "25px 21px",
    textAlign: "center",
  },

  syncIcon: {
    width: "50px",
    height: "50px",
    margin: "0 auto 12px",
    borderRadius: "12px",
    background: "#EFF6FF",
    color: "#2563EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 700,
  },

  syncTitle: {
    margin: 0,
    fontSize: "17px",
    color: "#1E293B",
  },

  syncText: {
    margin: "7px auto 18px",
    maxWidth: "360px",
    color: "#64748B",
    fontSize: "12px",
    lineHeight: 1.6,
  },

  syncOptions: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "20px",
  },

  syncOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: "1px solid #E2E8F0",
    borderRadius: "7px",
    padding: "8px 5px",
    color: "#475569",
    fontSize: "11px",
  },

  syncCheck: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 700,
  },

  syncButton: {
    width: "100%",
    border: "none",
    borderRadius: "8px",
    padding: "11px 15px",
    background: "#2563EB",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: 600,
  },

  disabledNote: {
    marginTop: "9px",
    color: "#B45309",
    fontSize: "11px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "700px",
  },

  th: {
    padding: "11px 18px",
    textAlign: "left",
    background: "#F8FAFC",
    color: "#64748B",
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom:
      "1px solid #E2E8F0",
  },

  td: {
    padding: "13px 18px",
    color: "#334155",
    fontSize: "12px",
    borderBottom:
      "1px solid #F1F5F9",
  },

  logList: {
    padding: "5px 21px 16px",
  },

  logRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 0",
    borderBottom:
      "1px solid #F1F5F9",
  },

  logIcon: {
    width: "31px",
    height: "31px",
    flexShrink: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
  },

  logContent: {
    flex: 1,
    minWidth: 0,
  },

  logTitle: {
    color: "#1E293B",
    fontSize: "13px",
    fontWeight: 600,
  },

  logMessage: {
    marginTop: "3px",
    color: "#64748B",
    fontSize: "11px",
  },

  logDate: {
    marginTop: "4px",
    color: "#94A3B8",
    fontSize: "10px",
  },

  empty: {
    padding: "42px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "29px",
    color: "#94A3B8",
    marginBottom: "7px",
  },

  emptyText: {
    color: "#64748B",
    fontSize: "13px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background:
      "rgba(15, 23, 42, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },

  modal: {
    width: "100%",
    maxWidth: "680px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "12px",
    boxShadow:
      "0 20px 60px rgba(15, 23, 42, 0.2)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "15px",
    padding: "20px 22px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  modalTitle: {
    margin: 0,
    fontSize: "19px",
    fontWeight: 700,
    color: "#111827",
  },

  modalSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "12px",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "#64748B",
    fontSize: "26px",
    lineHeight: 1,
    cursor: "pointer",
  },

  form: {
    padding: "22px",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "11px 12px",
    borderRadius: "8px",
    background: "#F8FAFC",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "20px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  fieldLabel: {
    color: "#475569",
    fontSize: "12px",
    fontWeight: 600,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
    padding: "10px 11px",
    outline: "none",
    color: "#1E293B",
    background: "#FFFFFF",
    fontSize: "13px",
  },

  sectionTitle: {
    marginTop: "22px",
    marginBottom: "10px",
    color: "#1E293B",
    fontSize: "13px",
    fontWeight: 700,
  },

  optionsBox: {
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    overflow: "hidden",
  },

  optionRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "12px",
    color: "#475569",
    fontSize: "13px",
    borderBottom:
      "1px solid #F1F5F9",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "24px",
    paddingTop: "18px",
    borderTop:
      "1px solid #E2E8F0",
  },

  cancelButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#475569",
    padding: "10px 15px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  loadingCard: {
    minHeight: "320px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
  },

  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #E2E8F0",
    borderTop:
      "3px solid #2563EB",
    borderRadius: "50%",
    animation:
      "spin 0.8s linear infinite",
  },

  loadingText: {
    marginTop: "13px",
    color: "#64748B",
    fontSize: "14px",
  },
};