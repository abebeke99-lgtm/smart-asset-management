import React, { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState({
    assets: {
      total: 0,
      active: 0,
      damaged: 0,
      replaced: 0,
      expired: 0,
    },
    users: 0,
    colleges: 0,
    departments: 0,
    maintenance: {
      submitted: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      escalated: 0,
    },
    inventory: {
      lowStock: 0,
      outOfStock: 0,
      expiringChemicals: 0,
      expiredChemicals: 0,
      quarantinedChemicals: 0,
    },
    recentActivity: [],
  });

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken")
    );
  };

  const buildHeaders = () => {
    const token = getToken();

    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      credentials: "include",
    });

    const contentType = response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data;
  };

  const normalizeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const normalizeDashboard = (data) => {
    const source = data?.data || data || {};

    const assets = source.assets || source.assetSummary || {};
    const maintenance =
      source.maintenance || source.maintenanceSummary || {};
    const inventory =
      source.inventory || source.inventorySummary || {};

    return {
      assets: {
        total: normalizeNumber(
          assets.total ??
            assets.totalAssets ??
            source.totalAssets
        ),
        active: normalizeNumber(
          assets.active ??
            assets.activeAssets ??
            source.activeAssets
        ),
        damaged: normalizeNumber(
          assets.damaged ??
            assets.damagedAssets ??
            source.damagedAssets
        ),
        replaced: normalizeNumber(
          assets.replaced ??
            assets.replacedAssets ??
            source.replacedAssets
        ),
        expired: normalizeNumber(
          assets.expired ??
            assets.expiredAssets ??
            source.expiredAssets
        ),
      },

      users: normalizeNumber(
        source.users ??
          source.totalUsers ??
          source.userCount
      ),

      colleges: normalizeNumber(
        source.colleges ??
          source.totalColleges ??
          source.collegeCount
      ),

      departments: normalizeNumber(
        source.departments ??
          source.totalDepartments ??
          source.departmentCount
      ),

      maintenance: {
        submitted: normalizeNumber(
          maintenance.submitted ??
            maintenance.submittedRequests ??
            source.submittedMaintenance
        ),
        scheduled: normalizeNumber(
          maintenance.scheduled ??
            maintenance.scheduledRequests ??
            source.scheduledMaintenance
        ),
        inProgress: normalizeNumber(
          maintenance.inProgress ??
            maintenance.in_progress ??
            maintenance.inProgressRequests ??
            source.inProgressMaintenance
        ),
        completed: normalizeNumber(
          maintenance.completed ??
            maintenance.completedRequests ??
            source.completedMaintenance
        ),
        escalated: normalizeNumber(
          maintenance.escalated ??
            maintenance.escalatedRequests ??
            source.escalatedMaintenance
        ),
      },

      inventory: {
        lowStock: normalizeNumber(
          inventory.lowStock ??
            inventory.low_stock ??
            source.lowStock
        ),
        outOfStock: normalizeNumber(
          inventory.outOfStock ??
            inventory.out_of_stock ??
            source.outOfStock
        ),
        expiringChemicals: normalizeNumber(
          inventory.expiringChemicals ??
            inventory.expiring_chemicals ??
            source.expiringChemicals
        ),
        expiredChemicals: normalizeNumber(
          inventory.expiredChemicals ??
            inventory.expired_chemicals ??
            source.expiredChemicals
        ),
        quarantinedChemicals: normalizeNumber(
          inventory.quarantinedChemicals ??
            inventory.quarantined_chemicals ??
            source.quarantinedChemicals
        ),
      },

      recentActivity: Array.isArray(source.recentActivity)
        ? source.recentActivity
        : Array.isArray(source.activities)
        ? source.activities
        : [],
    };
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * The Administrator documentation defines:
       * /admin as the dashboard route and
       * /api/maintenance/* as the maintenance API group.
       *
       * Reuse the existing dashboard endpoint when available.
       */
      const endpoints = [
        `${API_BASE_URL}/api/admin/dashboard`,
        `${API_BASE_URL}/api/dashboard`,
        `${API_BASE_URL}/api/analytics/dashboard`,
      ];

      let result = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          result = await fetchJson(endpoint);
          break;
        } catch (requestError) {
          lastError = requestError;
        }
      }

      if (!result) {
        throw lastError || new Error("Unable to load dashboard");
      }

      setDashboard(normalizeDashboard(result));
    } catch (requestError) {
      console.error("Dashboard loading error:", requestError);

      setError(
        requestError?.message ||
          "Unable to load administrator dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const statCards = [
    {
      title: "Total Assets",
      value: dashboard.assets.total,
      icon: "📦",
    },
    {
      title: "Active Assets",
      value: dashboard.assets.active,
      icon: "✓",
    },
    {
      title: "Damaged Assets",
      value: dashboard.assets.damaged,
      icon: "⚠",
    },
    {
      title: "Users",
      value: dashboard.users,
      icon: "👥",
    },
    {
      title: "Colleges",
      value: dashboard.colleges,
      icon: "🏫",
    },
    {
      title: "Departments",
      value: dashboard.departments,
      icon: "🏢",
    },
  ];

  const maintenanceCards = [
    {
      title: "Submitted",
      value: dashboard.maintenance.submitted,
    },
    {
      title: "Scheduled",
      value: dashboard.maintenance.scheduled,
    },
    {
      title: "In Progress",
      value: dashboard.maintenance.inProgress,
    },
    {
      title: "Completed",
      value: dashboard.maintenance.completed,
    },
    {
      title: "Escalated",
      value: dashboard.maintenance.escalated,
    },
  ];

  const inventoryCards = [
    {
      title: "Low Stock",
      value: dashboard.inventory.lowStock,
    },
    {
      title: "Out of Stock",
      value: dashboard.inventory.outOfStock,
    },
    {
      title: "Expiring Chemicals",
      value: dashboard.inventory.expiringChemicals,
    },
    {
      title: "Expired Chemicals",
      value: dashboard.inventory.expiredChemicals,
    },
    {
      title: "Quarantined",
      value: dashboard.inventory.quarantinedChemicals,
    },
  ];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>
            Loading administrator dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Administrator Dashboard</h1>
          <p style={styles.subtitle}>
            Central overview of university assets, maintenance,
            inventory and system activity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          style={styles.refreshButton}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <div>
            <strong>Unable to load dashboard</strong>
            <div style={styles.errorText}>{error}</div>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            style={styles.retryButton}
          >
            Retry
          </button>
        </div>
      )}

      <section>
        <h2 style={styles.sectionTitle}>Asset Overview</h2>

        <div style={styles.grid}>
          {statCards.map((card) => (
            <div key={card.title} style={styles.card}>
              <div style={styles.cardIcon}>{card.icon}</div>

              <div>
                <div style={styles.cardLabel}>{card.title}</div>
                <div style={styles.cardValue}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Maintenance Overview</h2>

        <div style={styles.grid}>
          {maintenanceCards.map((card) => (
            <div key={card.title} style={styles.card}>
              <div style={styles.cardLabel}>{card.title}</div>
              <div style={styles.cardValue}>{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Inventory Alerts</h2>

        <div style={styles.grid}>
          {inventoryCards.map((card) => (
            <div key={card.title} style={styles.card}>
              <div style={styles.cardLabel}>{card.title}</div>
              <div style={styles.cardValue}>{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            Recent Activity
          </h2>
        </div>

        <div style={styles.activityCard}>
          {dashboard.recentActivity.length === 0 ? (
            <div style={styles.emptyState}>
              No recent activity available.
            </div>
          ) : (
            dashboard.recentActivity.map((activity, index) => (
              <div
                key={
                  activity.id ||
                  activity.activityId ||
                  `activity-${index}`
                }
                style={styles.activityRow}
              >
                <div style={styles.activityDot} />

                <div style={styles.activityContent}>
                  <div style={styles.activityTitle}>
                    {activity.title ||
                      activity.action ||
                      activity.description ||
                      "System activity"}
                  </div>

                  {(activity.description ||
                    activity.message) && (
                    <div style={styles.activityDescription}>
                      {activity.description ||
                        activity.message}
                    </div>
                  )}

                  {(activity.createdAt ||
                    activity.date ||
                    activity.timestamp) && (
                    <div style={styles.activityDate}>
                      {new Date(
                        activity.createdAt ||
                          activity.date ||
                          activity.timestamp
                      ).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "24px",
    background: "#F3F6F9",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "28px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    fontWeight: 700,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  refreshButton: {
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    background: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 600,
  },

  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "14px 16px",
    marginBottom: "24px",
    borderRadius: "10px",
    border: "1px solid #FCA5A5",
    background: "#FEF2F2",
    color: "#991B1B",
  },

  errorText: {
    marginTop: "4px",
    fontSize: "13px",
  },

  retryButton: {
    border: "1px solid #991B1B",
    borderRadius: "7px",
    padding: "8px 14px",
    background: "#FFFFFF",
    color: "#991B1B",
    cursor: "pointer",
    fontWeight: 600,
  },

  loadingCard: {
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#FFFFFF",
    borderRadius: "12px",
  },

  spinner: {
    width: "34px",
    height: "34px",
    border: "4px solid #E5E7EB",
    borderTop: "4px solid #2563EB",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  loadingText: {
    marginTop: "14px",
    color: "#64748B",
  },

  section: {
    marginTop: "30px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: "0 0 14px",
    color: "#111827",
    fontSize: "18px",
    fontWeight: 700,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minHeight: "100px",
    padding: "18px",
    background: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
    boxSizing: "border-box",
  },

  cardIcon: {
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background: "#EFF6FF",
    fontSize: "20px",
  },

  cardLabel: {
    color: "#64748B",
    fontSize: "13px",
    fontWeight: 500,
  },

  cardValue: {
    marginTop: "5px",
    color: "#111827",
    fontSize: "25px",
    fontWeight: 700,
  },

  activityCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    overflow: "hidden",
  },

  activityRow: {
    display: "flex",
    gap: "14px",
    padding: "16px 18px",
    borderBottom: "1px solid #F1F5F9",
  },

  activityDot: {
    width: "9px",
    height: "9px",
    marginTop: "6px",
    borderRadius: "50%",
    background: "#2563EB",
    flexShrink: 0,
  },

  activityContent: {
    minWidth: 0,
    flex: 1,
  },

  activityTitle: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 600,
  },

  activityDescription: {
    marginTop: "4px",
    color: "#64748B",
    fontSize: "13px",
  },

  activityDate: {
    marginTop: "6px",
    color: "#94A3B8",
    fontSize: "12px",
  },

  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#64748B",
    fontSize: "14px",
  },
};

export default Dashboard;