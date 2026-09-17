import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  CloudCog,
  Droplets,
  Factory,
  FileText,
  Gauge,
  HardHat,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  SolarPanel,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const InfrastructureDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const getDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/api/infrastructure/dashboard");

      const payload = response?.data?.data ?? response?.data ?? {};
      const summary = payload?.summary && typeof payload.summary === "object"
        ? payload.summary
        : {};
      const operational = payload?.operational && typeof payload.operational === "object"
        ? payload.operational
        : {};

      setDashboard({
        ...payload,
        ...summary,
        ...operational,
        operationalAssets: payload?.operationalAssets ?? operational?.operationalAssets ?? operational?.assets ?? 0,
        generators: payload?.generators ?? operational?.generators ?? 0,
        transformers: payload?.transformers ?? operational?.transformers ?? 0,
        criticalAlerts: payload?.criticalAlerts ?? summary?.criticalAlerts ?? 0,
      });
    } catch (err) {
      console.error("Infrastructure dashboard error:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load Infrastructure Directorate dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getDashboard();
  }, [getDashboard]);

  const stats = useMemo(() => {
    return {
      totalInfrastructureAssets:
        Number(dashboard?.totalInfrastructureAssets) || 0,

      buildings: Number(dashboard?.buildings) || 0,

      electricalSystems: Number(dashboard?.electricalSystems) || 0,

      underMaintenance: Number(dashboard?.underMaintenance) || 0,

      openWorkOrders: Number(dashboard?.openWorkOrders) || 0,

      criticalAlerts: Number(dashboard?.criticalAlerts) || 0,

      operationalAssets: Number(dashboard?.operationalAssets) || 0,

      generators: Number(dashboard?.generators) || 0,

      transformers: Number(dashboard?.transformers) || 0,
    };
  }, [dashboard]);

  const statusBreakdown = dashboard?.statusBreakdown || {};

  const recentAssets = Array.isArray(dashboard?.recentAssets)
    ? dashboard.recentAssets
    : [];

  const recentWorkOrders = Array.isArray(dashboard?.recentWorkOrders)
    ? dashboard.recentWorkOrders
    : [];

  const categories = [
    {
      title: "Asset Management",
      description: "Register, track, and manage infrastructure assets",
      icon: Package,
      path: "/infrastructure/assets",
    },
    {
      title: "Buildings & Facilities",
      description: "Manage buildings, blocks, floors, and rooms",
      icon: Building2,
      path: "/infrastructure/buildings",
    },
    {
      title: "Electrical Systems",
      description: "Monitor and maintain electrical infrastructure",
      icon: Zap,
      path: "/infrastructure/electrical",
    },
    {
      title: "Power Equipment",
      description: "Generators, transformers, UPS, and solar systems",
      icon: Factory,
      path: "/infrastructure/generators",
    },
    {
      title: "Water Systems",
      description: "Manage water pumps, tanks, and pipelines",
      icon: Droplets,
      path: "/infrastructure/water",
    },
    {
      title: "Facility Maintenance",
      description: "Request and track maintenance work orders",
      icon: Wrench,
      path: "/infrastructure/maintenance",
    },
    {
      title: "Work Orders",
      description: "Create and manage work order assignments",
      icon: ClipboardList,
      path: "/infrastructure/work-orders",
    },
    {
      title: "Inspection & Tracking",
      description: "Conduct inspections and track equipment",
      icon: ShieldCheck,
      path: "/infrastructure/inspection",
    },
    {
      title: "Reports & Analytics",
      description: "View infrastructure performance reports",
      icon: BarChart3,
      path: "/infrastructure/reports",
    },
  ];

  const statCards = [
    {
      title: "Total Infrastructure Assets",
      value: stats.totalInfrastructureAssets,
      description: "Registered infrastructure assets",
      icon: Package,
      className: "primary",
      path: "/infrastructure/assets",
    },
    {
      title: "Buildings",
      value: stats.buildings,
      description: "Facilities managed",
      icon: Building2,
      className: "blue",
      path: "/infrastructure/buildings",
    },
    {
      title: "Electrical Systems",
      value: stats.electricalSystems,
      description: "Equipment & circuits",
      icon: Zap,
      className: "amber",
      path: "/infrastructure/electrical",
    },
    {
      title: "Under Maintenance",
      value: stats.underMaintenance,
      description: "Active maintenance",
      icon: Wrench,
      className: "orange",
      path: "/infrastructure/maintenance",
    },
    {
      title: "Open Work Orders",
      value: stats.openWorkOrders,
      description: "Pending assignment",
      icon: ClipboardList,
      className: "purple",
      path: "/infrastructure/work-orders",
    },
    {
      title: "Critical Alerts",
      value: stats.criticalAlerts,
      description: "Requires attention",
      icon: AlertTriangle,
      className: "danger",
      path: "/infrastructure/notifications",
    },
  ];

  const quickActions = [
    {
      title: "Register Asset",
      description: "Add infrastructure asset",
      icon: Package,
      path: "/infrastructure/assets/register",
    },
    {
      title: "Asset Verification",
      description: "Verify infrastructure assets",
      icon: ShieldCheck,
      path: "/infrastructure/verification",
    },
    {
      title: "Create Work Order",
      description: "Create maintenance work",
      icon: ClipboardList,
      path: "/infrastructure/work-orders",
    },
    {
      title: "Inspection",
      description: "Inspect infrastructure",
      icon: HardHat,
      path: "/infrastructure/inspection",
    },
    {
      title: "Energy Management",
      description: "Monitor energy systems",
      icon: Gauge,
      path: "/infrastructure/energy",
    },
    {
      title: "Reports",
      description: "View infrastructure reports",
      icon: BarChart3,
      path: "/infrastructure/reports",
    },
  ];

  const getStatusClass = (status) => {
    const normalized = String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (
      ["active", "operational", "available", "good", "completed"].includes(
        normalized
      )
    ) {
      return "status-success";
    }

    if (
      ["maintenance", "under_maintenance", "pending", "in_progress"].includes(
        normalized
      )
    ) {
      return "status-warning";
    }

    if (
      ["critical", "damaged", "failed", "missing", "overdue"].includes(
        normalized
      )
    ) {
      return "status-danger";
    }

    return "status-neutral";
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return String(date);
    }

    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <style>{css}</style>

        <div style={styles.loadingContainer}>
          <div style={styles.loadingCard}>
            <Loader2
              size={36}
              style={{
                animation: "spin 1s linear infinite",
                color: "#0EA5E9",
              }}
            />

            <h3 style={styles.loadingTitle}>
              Loading Infrastructure Dashboard
            </h3>

            <p style={styles.loadingText}>
              Connecting to the infrastructure management system...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* HEADER */}
      <div className="infra-header">
        <div>
          <div className="infra-breadcrumb">
            <Link to="/infrastructure">Infrastructure</Link>
            <span>/</span>
            <span>Dashboard</span>
          </div>

          <h1 className="infra-title">Infrastructure Directorate</h1>

          <p className="infra-subtitle">
            Manage and monitor all university infrastructure assets and systems
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={() => getDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-banner">
          <div className="error-icon">
            <AlertTriangle size={20} />
          </div>

          <div className="error-content">
            <strong>Dashboard data could not be loaded</strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            className="retry-button"
            onClick={() => getDashboard()}
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              to={card.path}
              key={card.title}
              className={`stat-card ${card.className}`}
            >
              <div className="stat-top">
                <div className="stat-icon">
                  <Icon size={22} />
                </div>

                <ArrowRight size={17} className="stat-arrow" />
              </div>

              <div className="stat-value">{card.value.toLocaleString()}</div>

              <div className="stat-title">{card.title}</div>

              <div className="stat-description">
                {card.description}
              </div>
            </Link>
          );
        })}
      </section>

      {/* MAIN GRID */}
      <div className="main-grid">
        {/* CATEGORIES */}
        <section className="panel categories-panel">
          <div className="panel-header">
            <div>
              <h2>Infrastructure Categories</h2>
              <p>Manage major infrastructure functions</p>
            </div>

            <CloudCog size={23} />
          </div>

          <div className="category-grid">
            {categories.map((category) => {
              const Icon = category.icon;

              return (
                <Link
                  to={category.path}
                  className="category-card"
                  key={category.title}
                >
                  <div className="category-icon">
                    <Icon size={21} />
                  </div>

                  <div className="category-content">
                    <h3>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>

                  <ArrowRight
                    size={17}
                    className="category-arrow"
                  />
                </Link>
              );
            })}
          </div>
        </section>

        {/* OPERATIONAL OVERVIEW */}
        <section className="panel operational-panel">
          <div className="panel-header">
            <div>
              <h2>Operational Overview</h2>
              <p>Current infrastructure status</p>
            </div>

            <Activity size={23} />
          </div>

          <div className="operational-main">
            <div className="operational-number">
              {stats.operationalAssets.toLocaleString()}
            </div>

            <div className="operational-label">
              Operational Assets
            </div>

            <div className="operational-progress">
              <div
                className="operational-progress-fill"
                style={{
                  width:
                    stats.totalInfrastructureAssets > 0
                      ? `${Math.min(
                          100,
                          (stats.operationalAssets /
                            stats.totalInfrastructureAssets) *
                            100
                        )}%`
                      : "0%",
                }}
              />
            </div>

            <div className="operational-percent">
              {stats.totalInfrastructureAssets > 0
                ? Math.round(
                    (stats.operationalAssets /
                      stats.totalInfrastructureAssets) *
                      100
                  )
                : 0}
              % operational
            </div>
          </div>

          <div className="operational-list">
            <div className="operational-row">
              <div className="row-left">
                <span className="row-icon generator">
                  <Factory size={17} />
                </span>
                <span>Generators</span>
              </div>

              <strong>{stats.generators.toLocaleString()}</strong>
            </div>

            <div className="operational-row">
              <div className="row-left">
                <span className="row-icon transformer">
                  <Zap size={17} />
                </span>
                <span>Transformers</span>
              </div>

              <strong>{stats.transformers.toLocaleString()}</strong>
            </div>

            <div className="operational-row">
              <div className="row-left">
                <span className="row-icon maintenance">
                  <Wrench size={17} />
                </span>
                <span>Under Maintenance</span>
              </div>

              <strong>{stats.underMaintenance.toLocaleString()}</strong>
            </div>

            <div className="operational-row">
              <div className="row-left">
                <span className="row-icon work">
                  <ClipboardList size={17} />
                </span>
                <span>Open Work Orders</span>
              </div>

              <strong>{stats.openWorkOrders.toLocaleString()}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* STATUS + QUICK ACTIONS */}
      <div className="secondary-grid">
        {/* STATUS BREAKDOWN */}
        <section className="panel status-panel">
          <div className="panel-header">
            <div>
              <h2>Asset Status</h2>
              <p>Current infrastructure asset condition</p>
            </div>

            <TrendingUp size={22} />
          </div>

          {Object.keys(statusBreakdown).length === 0 ? (
            <div className="empty-state compact">
              <Activity size={28} />
              <span>No status data available</span>
            </div>
          ) : (
            <div className="status-list">
              {Object.entries(statusBreakdown).map(([status, value]) => (
                <div className="status-row" key={status}>
                  <div className="status-name">
                    <span
                      className={`status-dot ${getStatusClass(status)}`}
                    />

                    <span>{formatStatus(status)}</span>
                  </div>

                  <strong>{Number(value || 0).toLocaleString()}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section className="panel quick-panel">
          <div className="panel-header">
            <div>
              <h2>Quick Actions</h2>
              <p>Frequently used infrastructure operations</p>
            </div>

            <Settings size={22} />
          </div>

          <div className="quick-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  to={action.path}
                  className="quick-action"
                  key={action.title}
                >
                  <div className="quick-icon">
                    <Icon size={19} />
                  </div>

                  <div>
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                  </div>

                  <ArrowRight size={15} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* RECENT ASSETS */}
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Recent Infrastructure Assets</h2>
            <p>Latest assets registered in the system</p>
          </div>

          <Link to="/infrastructure/assets" className="view-all">
            View All
            <ArrowRight size={15} />
          </Link>
        </div>

        {recentAssets.length === 0 ? (
          <div className="empty-state">
            <Package size={36} />
            <h3>No infrastructure assets found</h3>
            <p>
              Registered infrastructure assets will appear here.
            </p>

            <Link
              to="/infrastructure/assets/register"
              className="empty-action"
            >
              Register Asset
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Asset Tag</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>

              <tbody>
                {recentAssets.map((asset, index) => (
                  <tr key={asset.id || asset.asset_id || index}>
                    <td>
                      <div className="asset-name">
                        <div className="asset-avatar">
                          <Package size={17} />
                        </div>

                        <div>
                          <strong>
                            {asset.name ||
                              asset.asset_name ||
                              "Unnamed Asset"}
                          </strong>

                          {asset.serial_number && (
                            <span>
                              SN: {asset.serial_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      {asset.asset_tag ||
                        asset.tag ||
                        "—"}
                    </td>

                    <td>
                      {asset.category ||
                        asset.asset_category ||
                        "—"}
                    </td>

                    <td>
                      <div className="location-cell">
                        <MapPin size={15} />
                        {asset.location || "—"}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${getStatusClass(
                          asset.status
                        )}`}
                      >
                        {formatStatus(asset.status)}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        asset.created_at ||
                          asset.registration_date
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* WORK ORDERS */}
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Recent Work Orders</h2>
            <p>Latest infrastructure maintenance activities</p>
          </div>

          <Link
            to="/infrastructure/work-orders"
            className="view-all"
          >
            View All
            <ArrowRight size={15} />
          </Link>
        </div>

        {recentWorkOrders.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h3>No work orders found</h3>
            <p>
              Infrastructure work orders will appear here when
              created.
            </p>

            <Link
              to="/infrastructure/work-orders"
              className="empty-action"
            >
              Manage Work Orders
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Work Order</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {recentWorkOrders.map((workOrder, index) => (
                  <tr
                    key={
                      workOrder.id ||
                      workOrder.work_order_id ||
                      index
                    }
                  >
                    <td>
                      <strong>
                        {workOrder.work_order_number ||
                          workOrder.work_order_code ||
                          workOrder.id ||
                          "—"}
                      </strong>
                    </td>

                    <td>
                      {workOrder.title ||
                        workOrder.description ||
                        "—"}
                    </td>

                    <td>
                      <span
                        className={`priority-badge ${getStatusClass(
                          workOrder.priority
                        )}`}
                      >
                        {formatStatus(workOrder.priority)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${getStatusClass(
                          workOrder.status
                        )}`}
                      >
                        {formatStatus(workOrder.status)}
                      </span>
                    </td>

                    <td>
                      {workOrder.assigned_to ||
                        workOrder.assigned_name ||
                        "Unassigned"}
                    </td>

                    <td>
                      {formatDate(
                        workOrder.created_at ||
                          workOrder.requested_at
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FOOTER INFO */}
      <div className="dashboard-footer">
        <div>
          <ShieldCheck size={16} />
          <span>Infrastructure Management System</span>
        </div>

        <span>
          Data displayed from the university asset database
        </span>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100%",
    background: "#F8FAFC",
    color: "#0F172A",
  },

  loadingContainer: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
  },

  loadingCard: {
    textAlign: "center",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "16px",
    padding: "40px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  loadingTitle: {
    margin: "18px 0 6px",
    fontSize: "20px",
    fontWeight: 700,
  },

  loadingText: {
    margin: 0,
    color: "#64748B",
    fontSize: "14px",
  },
};

const css = `
  * {
    box-sizing: border-box;
  }

  .infra-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 30px 24px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
  }

  .infra-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
  }

  .infra-breadcrumb a {
    color: #0ea5e9;
    text-decoration: none;
  }

  .infra-title {
    margin: 0;
    color: #0f172a;
    font-size: 27px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .infra-subtitle {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
  }

  .refresh-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 15px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #ffffff;
    color: #334155;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-button:hover {
    border-color: #0ea5e9;
    color: #0284c7;
    background: #f0f9ff;
  }

  .refresh-button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 13px;
    margin: 20px 30px 0;
    padding: 14px 16px;
    border: 1px solid #fecaca;
    border-radius: 11px;
    background: #fff7f7;
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    color: #dc2626;
    background: #fee2e2;
  }

  .error-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .error-content strong {
    color: #991b1b;
    font-size: 13px;
  }

  .error-content span {
    color: #b91c1c;
    font-size: 12px;
  }

  .retry-button {
    border: 0;
    border-radius: 7px;
    padding: 8px 13px;
    color: #ffffff;
    background: #dc2626;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 15px;
    padding: 24px 30px 0;
  }

  .stat-card {
    min-width: 0;
    padding: 17px;
    border: 1px solid #e2e8f0;
    border-radius: 13px;
    background: #ffffff;
    text-decoration: none;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    border-color: #bae6fd;
    box-shadow: 0 9px 24px rgba(15,23,42,0.07);
  }

  .stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }

  .stat-arrow {
    color: #94a3b8;
  }

  .stat-card.primary .stat-icon {
    color: #0284c7;
    background: #e0f2fe;
  }

  .stat-card.blue .stat-icon {
    color: #2563eb;
    background: #dbeafe;
  }

  .stat-card.amber .stat-icon {
    color: #d97706;
    background: #fef3c7;
  }

  .stat-card.orange .stat-icon {
    color: #ea580c;
    background: #ffedd5;
  }

  .stat-card.purple .stat-icon {
    color: #7c3aed;
    background: #ede9fe;
  }

  .stat-card.danger .stat-icon {
    color: #dc2626;
    background: #fee2e2;
  }

  .stat-value {
    margin-top: 17px;
    color: #0f172a;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .stat-title {
    margin-top: 4px;
    color: #334155;
    font-size: 12px;
    font-weight: 800;
  }

  .stat-description {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.85fr);
    gap: 18px;
    padding: 20px 30px 0;
  }

  .secondary-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 18px;
    padding: 18px 30px 0;
  }

  .panel {
    min-width: 0;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(15,23,42,0.025);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 19px 20px;
    border-bottom: 1px solid #eef2f7;
  }

  .panel-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 800;
  }

  .panel-header p {
    margin: 5px 0 0;
    color: #94a3b8;
    font-size: 12px;
  }

  .panel-header > svg {
    color: #0ea5e9;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 11px;
    padding: 17px;
  }

  .category-card {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 78px;
    padding: 12px;
    border: 1px solid #e8eef5;
    border-radius: 10px;
    background: #ffffff;
    text-decoration: none;
    transition: all 0.18s ease;
  }

  .category-card:hover {
    border-color: #bae6fd;
    background: #f8fdff;
    transform: translateY(-1px);
  }

  .category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .category-content {
    min-width: 0;
    flex: 1;
  }

  .category-content h3 {
    margin: 0;
    color: #1e293b;
    font-size: 12px;
    font-weight: 800;
  }

  .category-content p {
    display: -webkit-box;
    margin: 4px 0 0;
    overflow: hidden;
    color: #94a3b8;
    font-size: 10.5px;
    line-height: 1.35;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .category-arrow {
    flex: 0 0 auto;
    color: #cbd5e1;
  }

  .operational-main {
    padding: 23px 20px 19px;
    text-align: center;
  }

  .operational-number {
    color: #0f172a;
    font-size: 38px;
    line-height: 1;
    font-weight: 850;
  }

  .operational-label {
    margin-top: 7px;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .operational-progress {
    height: 8px;
    margin-top: 18px;
    overflow: hidden;
    border-radius: 20px;
    background: #e2e8f0;
  }

  .operational-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #0ea5e9, #2563eb);
    transition: width 0.5s ease;
  }

  .operational-percent {
    margin-top: 7px;
    color: #0284c7;
    font-size: 11px;
    font-weight: 800;
  }

  .operational-list {
    border-top: 1px solid #eef2f7;
  }

  .operational-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 12px 20px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    font-size: 12px;
  }

  .operational-row:last-child {
    border-bottom: 0;
  }

  .operational-row strong {
    color: #0f172a;
    font-size: 13px;
  }

  .row-left {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
  }

  .row-icon.generator {
    color: #7c3aed;
    background: #ede9fe;
  }

  .row-icon.transformer {
    color: #d97706;
    background: #fef3c7;
  }

  .row-icon.maintenance {
    color: #ea580c;
    background: #ffedd5;
  }

  .row-icon.work {
    color: #0284c7;
    background: #e0f2fe;
  }

  .status-list {
    padding: 8px 20px 14px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
  }

  .status-row:last-child {
    border-bottom: 0;
  }

  .status-name {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #475569;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .status-dot.status-success {
    background: #16a34a;
  }

  .status-dot.status-warning {
    background: #f59e0b;
  }

  .status-dot.status-danger {
    background: #dc2626;
  }

  .status-row strong {
    color: #0f172a;
  }

  .quick-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 16px;
  }

  .quick-action {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 11px;
    border: 1px solid #e8eef5;
    border-radius: 9px;
    text-decoration: none;
    transition: all 0.18s ease;
  }

  .quick-action:hover {
    border-color: #bae6fd;
    background: #f8fdff;
  }

  .quick-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 35px;
    height: 35px;
    border-radius: 8px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .quick-action > div:nth-child(2) {
    min-width: 0;
    flex: 1;
  }

  .quick-action strong {
    display: block;
    overflow: hidden;
    color: #334155;
    font-size: 11px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-action span {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 9.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-action > svg {
    flex: 0 0 auto;
    color: #cbd5e1;
  }

  .table-panel {
    margin: 18px 30px 0;
    overflow: hidden;
  }

  .view-all {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #0284c7;
    font-size: 11px;
    font-weight: 800;
    text-decoration: none;
  }

  .view-all:hover {
    color: #0369a1;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 800px;
    border-collapse: collapse;
  }

  th {
    padding: 11px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.35px;
  }

  td {
    padding: 13px 20px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    font-size: 11px;
    vertical-align: middle;
  }

  tbody tr:hover {
    background: #f8fdff;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .asset-name {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 190px;
  }

  .asset-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .asset-name strong {
    display: block;
    max-width: 190px;
    overflow: hidden;
    color: #1e293b;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-name span {
    display: block;
    margin-top: 2px;
    color: #94a3b8;
    font-size: 9.5px;
  }

  .location-cell {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .location-cell svg {
    color: #94a3b8;
  }

  .status-badge,
  .priority-badge {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 20px;
    font-size: 9.5px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-success {
    color: #166534;
    background: #dcfce7;
  }

  .status-warning {
    color: #92400e;
    background: #fef3c7;
  }

  .status-danger {
    color: #991b1b;
    background: #fee2e2;
  }

  .status-neutral {
    color: #475569;
    background: #f1f5f9;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 210px;
    padding: 35px 20px;
    color: #94a3b8;
    text-align: center;
  }

  .empty-state.compact {
    min-height: 170px;
  }

  .empty-state svg {
    color: #cbd5e1;
  }

  .empty-state h3 {
    margin: 12px 0 5px;
    color: #475569;
    font-size: 14px;
  }

  .empty-state p {
    max-width: 400px;
    margin: 0;
    color: #94a3b8;
    font-size: 11px;
  }

  .empty-state span {
    margin-top: 10px;
    color: #94a3b8;
    font-size: 11px;
  }

  .empty-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 15px;
    min-height: 34px;
    padding: 0 13px;
    border-radius: 8px;
    color: #ffffff;
    background: #0ea5e9;
    font-size: 11px;
    font-weight: 800;
    text-decoration: none;
  }

  .empty-action:hover {
    background: #0284c7;
  }

  .dashboard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin: 20px 30px 0;
    padding: 16px 0 25px;
    color: #94a3b8;
    font-size: 10px;
  }

  .dashboard-footer > div {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dashboard-footer svg {
    color: #0ea5e9;
  }

  @media (max-width: 1400px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .category-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1050px) {
    .main-grid,
    .secondary-grid {
      grid-template-columns: 1fr;
    }

    .category-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .infra-header {
      align-items: flex-start;
      flex-direction: column;
      padding: 22px 18px;
    }

    .refresh-button {
      width: 100%;
      justify-content: center;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 18px 18px 0;
    }

    .main-grid,
    .secondary-grid {
      padding-left: 18px;
      padding-right: 18px;
    }

    .category-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .table-panel {
      margin-left: 18px;
      margin-right: 18px;
    }

    .dashboard-footer {
      margin-left: 18px;
      margin-right: 18px;
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (max-width: 560px) {
    .infra-title {
      font-size: 23px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .category-grid,
    .quick-grid {
      grid-template-columns: 1fr;
    }

    .panel-header {
      padding: 16px;
    }

    .category-grid {
      padding: 13px;
    }

    .quick-grid {
      padding: 13px;
    }

    .secondary-grid {
      gap: 14px;
    }

    .stat-card {
      padding: 15px;
    }
  }
`;

export default InfrastructureDashboard;