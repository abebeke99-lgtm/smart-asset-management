import React, { useEffect, useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";

const EMPTY_SERVICES = [];

const normalizeData = (payload) => {
  const data =
    payload?.data ||
    payload?.monitoring ||
    payload ||
    {};

  return {
    ...data,
    system: data.system || data.overall || {},
    server: {
      ...(data.server || {}),
      cpuCores: data.server?.cpuCores ?? data.resources?.cpu?.cores,
      memoryUsage: data.server?.memoryUsage ?? data.server?.memoryUsagePercent ?? data.resources?.memory?.percentage,
      memoryTotal: data.server?.memoryTotal ?? data.resources?.memory?.total,
      diskUsage: data.server?.diskUsage ?? data.server?.storageUsagePercent ?? data.storage?.usagePercent,
      diskTotal: data.server?.diskTotal ?? data.storage?.total,
      environment: data.server?.environment ?? data.application?.environment,
    },
    database: {
      ...(data.database || {}),
      name: data.database?.name ?? data.database?.databaseName,
    },
    api: data.api || {},
    services: Array.isArray(data.services)
      ? data.services
      : [],
    activity: Array.isArray(data.activity)
      ? data.activity
      : [],
  };
};

const getServiceName = (service) =>
  service?.name ||
  service?.serviceName ||
  service?.service_name ||
  "Service";

const getServiceStatus = (service) => {
  const status =
    service?.status ||
    service?.state ||
    "";

  if (
    service?.healthy === true ||
    service?.isHealthy === true
  ) {
    return "Healthy";
  }

  if (
    service?.healthy === false ||
    service?.isHealthy === false
  ) {
    return "Down";
  }

  return (
    String(status).charAt(0).toUpperCase() +
      String(status).slice(1) ||
    "Unknown"
  );
};

const getStatusStyle = (status) => {
  const value =
    String(status).toLowerCase();

  if (
    value.includes("healthy") ||
    value.includes("online") ||
    value.includes("running") ||
    value.includes("operational")
  ) {
    return {
      background: "#ECFDF5",
      color: "#047857",
    };
  }

  if (
    value.includes("warning") ||
    value.includes("degraded") ||
    value.includes("slow")
  ) {
    return {
      background: "#FFFBEB",
      color: "#B45309",
    };
  }

  if (
    value.includes("down") ||
    value.includes("error") ||
    value.includes("failed") ||
    value.includes("offline")
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

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const formatBytes = (bytes) => {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
};

const getNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
};

export default function SystemMonitoring() {
  const [monitoring, setMonitoring] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [autoRefresh, setAutoRefresh] =
    useState(true);

  const loadMonitoring = async (
    silent = false
  ) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await apiClient.get("/api/admin/monitoring/overview");

      setMonitoring(
        normalizeData(response.data)
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error(
        "System monitoring error:",
        err
      );

      const status = err.response?.status;
      const message = status === 403
        ? "Your account is not authorized to view system monitoring. An Admin account is required."
        : status === 404
          ? "The system monitoring endpoint was not found on the backend."
          : status >= 500
            ? "The backend could not load system monitoring data. Check the server logs."
            : getApiErrorMessage(err, "Unable to load system monitoring data.");

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadMonitoring(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const system = monitoring?.system || {};
  const server = monitoring?.server || {};
  const database = monitoring?.database || {};
  const api = monitoring?.api || {};
  const services = monitoring?.services || EMPTY_SERVICES;
  const activity = monitoring?.activity || [];

  const healthyServices = useMemo(
    () =>
      services.filter((service) => {
        const status = getServiceStatus(
          service
        ).toLowerCase();

        return (
          status.includes("healthy") ||
          status.includes("online") ||
          status.includes("running") ||
          status.includes("operational")
        );
      }).length,
    [services]
  );

  const systemStatus =
    system?.status ||
    system?.health ||
    "Operational";

  const cpuUsage = getNumber(
    server?.cpuUsage,
    server?.cpu_usage,
    server?.cpu
  );

  const memoryUsage = getNumber(
    server?.memoryUsage,
    server?.memory_usage,
    server?.memoryPercent
  );

  const diskUsage = getNumber(
    server?.diskUsage,
    server?.disk_usage,
    server?.diskPercent
  );

  const uptime =
    server?.uptime ||
    system?.uptime ||
    "—";

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>
            Loading system monitoring...
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
            Administration / System / Monitoring
          </div>

          <h1 style={styles.title}>
            System Monitoring
          </h1>

          <p style={styles.subtitle}>
            Monitor application health, server
            resources, database status, APIs, and
            system services.
          </p>
        </div>

        <div style={styles.headerActions}>
          <label style={styles.autoRefresh}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) =>
                setAutoRefresh(
                  event.target.checked
                )
              }
            />

            <span>
              Auto refresh
            </span>
          </label>

          <button
            type="button"
            onClick={() =>
              loadMonitoring(true)
            }
            disabled={refreshing}
            style={{
              ...styles.refreshButton,
              opacity: refreshing
                ? 0.65
                : 1,
            }}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <strong>Error:</strong>{" "}
          {error}
        </div>
      )}

      <div style={styles.statusBanner}>
        <div style={styles.statusLeft}>
          <div
            style={{
              ...styles.statusDot,
              background:
                getStatusStyle(
                  systemStatus
                ).color,
            }}
          />

          <div>
            <div style={styles.statusTitle}>
              System Status
            </div>

            <div style={styles.statusDescription}>
              The current system health is{" "}
              <strong>
                {systemStatus}
              </strong>
              .
            </div>
          </div>
        </div>

        <div style={styles.updatedText}>
          Last updated:{" "}
          {lastUpdated
            ? lastUpdated.toLocaleTimeString()
            : "—"}
        </div>
      </div>

      <div style={styles.statsGrid}>
        <MetricCard
          title="System Status"
          value={systemStatus}
          icon="●"
          status
        />

        <MetricCard
          title="Services"
          value={`${healthyServices}/${services.length || 0}`}
          icon="◉"
          subtitle="Healthy services"
        />

        <MetricCard
          title="API Status"
          value={
            api?.status ||
            api?.health ||
            "Operational"
          }
          icon="↔"
          subtitle={
            api?.responseTime
              ? `${api.responseTime} ms response`
              : "API health"
          }
        />

        <MetricCard
          title="Uptime"
          value={uptime}
          icon="◷"
          subtitle="Server uptime"
          compact
        />
      </div>

      <div style={styles.resourceGrid}>
        <ResourceCard
          title="CPU Usage"
          value={cpuUsage}
          suffix="%"
          description={
            server?.cpuCores
              ? `${server.cpuCores} CPU cores`
              : "Processor utilization"
          }
        />

        <ResourceCard
          title="Memory Usage"
          value={memoryUsage}
          suffix="%"
          description={
            server?.memoryTotal
              ? `Total ${formatBytes(
                  server.memoryTotal
                )}`
              : "Memory utilization"
          }
        />

        <ResourceCard
          title="Disk Usage"
          value={diskUsage}
          suffix="%"
          description={
            server?.diskTotal
              ? `Total ${formatBytes(
                  server.diskTotal
                )}`
              : "Storage utilization"
          }
        />
      </div>

      <div style={styles.twoColumn}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Service Health
              </h2>

              <p style={styles.cardDescription}>
                Current status of connected system
                services.
              </p>
            </div>
          </div>

          {services.length === 0 ? (
            <EmptyState text="No service monitoring records available." />
          ) : (
            <div style={styles.serviceList}>
              {services.map(
                (service, index) => {
                  const name =
                    getServiceName(
                      service
                    );

                  const status =
                    getServiceStatus(
                      service
                    );

                  return (
                    <div
                      key={
                        service?.id ||
                        service?.serviceId ||
                        index
                      }
                      style={
                        styles.serviceRow
                      }
                    >
                      <div
                        style={
                          styles.serviceInfo
                        }
                      >
                        <div
                          style={
                            styles.serviceIcon
                          }
                        >
                          {name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div
                            style={
                              styles.serviceName
                            }
                          >
                            {name}
                          </div>

                          <div
                            style={
                              styles.serviceMeta
                            }
                          >
                            {service?.description ||
                              service?.url ||
                              "System service"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={
                          styles.serviceRight
                        }
                      >
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...getStatusStyle(
                              status
                            ),
                          }}
                        >
                          {status}
                        </span>

                        {service?.responseTime !=
                          null && (
                          <span
                            style={
                              styles.responseTime
                            }
                          >
                            {
                              service.responseTime
                            }{" "}
                            ms
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Database Health
              </h2>

              <p style={styles.cardDescription}>
                Database connection and performance
                information.
              </p>
            </div>

            <span
              style={{
                ...styles.statusBadge,
                ...getStatusStyle(
                  database?.status ||
                    database?.health ||
                    "Unknown"
                ),
              }}
            >
              {database?.status ||
                database?.health ||
                "Unknown"}
            </span>
          </div>

          <div style={styles.databaseGrid}>
            <InfoItem
              label="Database"
              value={
                database?.name ||
                database?.database ||
                "MySQL"
              }
            />

            <InfoItem
              label="Host"
              value={
                database?.host ||
                "—"
              }
            />

            <InfoItem
              label="Port"
              value={
                database?.port ||
                "—"
              }
            />

            <InfoItem
              label="Version"
              value={
                database?.version ||
                "—"
              }
            />

            <InfoItem
              label="Connections"
              value={
                database?.connections ??
                database?.activeConnections ??
                "—"
              }
            />

            <InfoItem
              label="Response"
              value={
                database?.responseTime !=
                null
                  ? `${database.responseTime} ms`
                  : "—"
              }
            />
          </div>
        </section>
      </div>

      <div style={styles.twoColumn}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Server Information
              </h2>

              <p style={styles.cardDescription}>
                Runtime and server environment
                information.
              </p>
            </div>
          </div>

          <div style={styles.infoGrid}>
            <InfoItem
              label="Hostname"
              value={
                server?.hostname ||
                server?.host ||
                "—"
              }
            />

            <InfoItem
              label="Operating System"
              value={
                server?.os ||
                server?.operatingSystem ||
                "—"
              }
            />

            <InfoItem
              label="Node Version"
              value={
                server?.nodeVersion ||
                server?.node_version ||
                "—"
              }
            />

            <InfoItem
              label="Environment"
              value={
                server?.environment ||
                process.env.NODE_ENV ||
                "—"
              }
            />

            <InfoItem
              label="CPU Cores"
              value={
                server?.cpuCores ||
                server?.cpu_cores ||
                "—"
              }
            />

            <InfoItem
              label="Uptime"
              value={uptime}
            />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                API Monitoring
              </h2>

              <p style={styles.cardDescription}>
                Backend API availability and response
                information.
              </p>
            </div>
          </div>

          <div style={styles.apiSummary}>
            <div style={styles.apiMain}>
              <div style={styles.apiStatusIcon}>
                ↔
              </div>

              <div>
                <div style={styles.apiStatusTitle}>
                  {api?.status ||
                    api?.health ||
                    "Operational"}
                </div>

                <div
                  style={
                    styles.apiStatusDescription
                  }
                >
                  Backend API service
                </div>
              </div>
            </div>

            <div style={styles.apiMetrics}>
              <InfoItem
                label="Response Time"
                value={
                  api?.responseTime !=
                  null
                    ? `${api.responseTime} ms`
                    : "—"
                }
              />

              <InfoItem
                label="Requests"
                value={
                  api?.requests ??
                  api?.requestCount ??
                  "—"
                }
              />

              <InfoItem
                label="Errors"
                value={
                  api?.errors ??
                  api?.errorCount ??
                  "—"
                }
              />

              <InfoItem
                label="Error Rate"
                value={
                  api?.errorRate !=
                  null
                    ? `${api.errorRate}%`
                    : "—"
                }
              />
            </div>
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Recent System Activity
            </h2>

            <p style={styles.cardDescription}>
              Recent monitoring events and system
              activity.
            </p>
          </div>
        </div>

        {activity.length === 0 ? (
          <EmptyState text="No recent system activity available." />
        ) : (
          <div style={styles.activityList}>
            {activity.map(
              (item, index) => {
                const title =
                  item?.title ||
                  item?.action ||
                  item?.event ||
                  "System Activity";

                const message =
                  item?.message ||
                  item?.description ||
                  "";

                const date =
                  item?.createdAt ||
                  item?.created_at ||
                  item?.timestamp ||
                  item?.date;

                return (
                  <div
                    key={
                      item?.id ||
                      item?.activityId ||
                      index
                    }
                    style={
                      styles.activityRow
                    }
                  >
                    <div
                      style={
                        styles.activityIcon
                      }
                    >
                      ✓
                    </div>

                    <div
                      style={
                        styles.activityContent
                      }
                    >
                      <div
                        style={
                          styles.activityTitle
                        }
                      >
                        {title}
                      </div>

                      {message && (
                        <div
                          style={
                            styles.activityMessage
                          }
                        >
                          {message}
                        </div>
                      )}

                      <div
                        style={
                          styles.activityDate
                        }
                      >
                        {formatDate(date)}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  subtitle,
  status = false,
  compact = false,
}) {
  return (
    <div style={styles.metricCard}>
      <div
        style={{
          ...styles.metricIcon,
          ...(status
            ? styles.metricIconStatus
            : {}),
        }}
      >
        {icon}
      </div>

      <div style={styles.metricContent}>
        <div style={styles.metricTitle}>
          {title}
        </div>

        <div
          style={{
            ...styles.metricValue,
            ...(compact
              ? styles.metricValueCompact
              : {}),
          }}
        >
          {value}
        </div>

        {subtitle && (
          <div style={styles.metricSubtitle}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceCard({
  title,
  value,
  suffix,
  description,
}) {
  const valid =
    value !== null &&
    value !== undefined;

  const percentage = valid
    ? Math.max(
        0,
        Math.min(100, Number(value))
      )
    : 0;

  return (
    <div style={styles.resourceCard}>
      <div style={styles.resourceHeader}>
        <div>
          <div style={styles.resourceTitle}>
            {title}
          </div>

          <div style={styles.resourceDescription}>
            {description}
          </div>
        </div>

        <div style={styles.resourceValue}>
          {valid
            ? `${percentage}${suffix}`
            : "—"}
        </div>
      </div>

      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressBar,
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>
        {label}
      </div>

      <div style={styles.infoValue}>
        {value ?? "—"}
      </div>
    </div>
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
    gap: "12px",
  },

  autoRefresh: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#475569",
    fontSize: "13px",
    cursor: "pointer",
  },

  refreshButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "10px 15px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorAlert: {
    marginBottom: "18px",
    padding: "13px 16px",
    borderRadius: "8px",
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#B91C1C",
    fontSize: "14px",
  },

  statusBanner: {
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

  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  statusDot: {
    width: "11px",
    height: "11px",
    borderRadius: "50%",
  },

  statusTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#1E293B",
  },

  statusDescription: {
    marginTop: "3px",
    color: "#64748B",
    fontSize: "12px",
  },

  updatedText: {
    color: "#94A3B8",
    fontSize: "12px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  metricCard: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "17px",
  },

  metricIcon: {
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

  metricIconStatus: {
    background: "#ECFDF5",
    color: "#047857",
  },

  metricContent: {
    minWidth: 0,
  },

  metricTitle: {
    color: "#64748B",
    fontSize: "12px",
    marginBottom: "4px",
  },

  metricValue: {
    color: "#111827",
    fontSize: "20px",
    fontWeight: 700,
  },

  metricValueCompact: {
    fontSize: "15px",
  },

  metricSubtitle: {
    color: "#94A3B8",
    fontSize: "11px",
    marginTop: "3px",
  },

  resourceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  resourceCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "18px",
  },

  resourceHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "14px",
  },

  resourceTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#1E293B",
  },

  resourceDescription: {
    marginTop: "4px",
    color: "#94A3B8",
    fontSize: "11px",
  },

  resourceValue: {
    color: "#2563EB",
    fontSize: "18px",
    fontWeight: 700,
  },

  progressTrack: {
    height: "7px",
    borderRadius: "999px",
    background: "#E2E8F0",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    borderRadius: "999px",
    background: "#2563EB",
    transition: "width 0.3s ease",
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
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

  serviceList: {
    padding: "5px 21px 15px",
  },

  serviceRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    padding: "13px 0",
    borderBottom:
      "1px solid #F1F5F9",
  },

  serviceInfo: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: 0,
  },

  serviceIcon: {
    width: "34px",
    height: "34px",
    flexShrink: 0,
    borderRadius: "8px",
    background: "#F1F5F9",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 700,
  },

  serviceName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1E293B",
  },

  serviceMeta: {
    marginTop: "3px",
    color: "#94A3B8",
    fontSize: "11px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "260px",
  },

  serviceRight: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    flexShrink: 0,
  },

  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  responseTime: {
    color: "#94A3B8",
    fontSize: "11px",
  },

  databaseGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    padding: "21px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    padding: "21px",
  },

  infoItem: {
    minWidth: 0,
  },

  infoLabel: {
    color: "#94A3B8",
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "5px",
  },

  infoValue: {
    color: "#334155",
    fontSize: "13px",
    fontWeight: 500,
    wordBreak: "break-word",
  },

  apiSummary: {
    padding: "21px",
  },

  apiMain: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingBottom: "18px",
    borderBottom:
      "1px solid #F1F5F9",
  },

  apiStatusIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "9px",
    background: "#ECFDF5",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },

  apiStatusTitle: {
    color: "#047857",
    fontSize: "15px",
    fontWeight: 700,
  },

  apiStatusDescription: {
    marginTop: "3px",
    color: "#94A3B8",
    fontSize: "11px",
  },

  apiMetrics: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    paddingTop: "18px",
  },

  activityList: {
    padding: "5px 21px 16px",
  },

  activityRow: {
    display: "flex",
    gap: "12px",
    padding: "14px 0",
    borderBottom:
      "1px solid #F1F5F9",
  },

  activityIcon: {
    width: "30px",
    height: "30px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#ECFDF5",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
  },

  activityContent: {
    minWidth: 0,
  },

  activityTitle: {
    color: "#1E293B",
    fontSize: "13px",
    fontWeight: 600,
  },

  activityMessage: {
    marginTop: "3px",
    color: "#64748B",
    fontSize: "12px",
  },

  activityDate: {
    marginTop: "4px",
    color: "#94A3B8",
    fontSize: "10px",
  },

  empty: {
    padding: "45px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "30px",
    color: "#94A3B8",
    marginBottom: "8px",
  },

  emptyText: {
    color: "#64748B",
    fontSize: "13px",
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