import React, { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

const STATUS_OPTIONS = [
  "All",
  "Active",
  "Functional",
  "Damaged",
  "Replaced",
  "Expired",
  "Under Maintenance",
];

function AllAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken")
    );
  };

  const getHeaders = () => {
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
      headers: getHeaders(),
      credentials: "include",
    });

    const contentType =
      response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  const normalizeAssets = (response) => {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.assets)) {
      return response.assets;
    }

    if (Array.isArray(response?.data?.assets)) {
      return response.data.assets;
    }

    if (Array.isArray(response?.results)) {
      return response.results;
    }

    return [];
  };

  const loadAssets = async () => {
    setLoading(true);
    setError("");

    try {
      const endpoints = [
        `${API_BASE_URL}/api/assets`,
        `${API_BASE_URL}/api/assets/all`,
      ];

      let responseData = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          responseData = await fetchJson(endpoint);
          break;
        } catch (requestError) {
          lastError = requestError;
        }
      }

      if (!responseData) {
        throw (
          lastError ||
          new Error("Unable to load assets.")
        );
      }

      setAssets(normalizeAssets(responseData));
    } catch (requestError) {
      console.error("Assets loading error:", requestError);

      setError(
        requestError?.message ||
          "Unable to load assets."
      );

      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const categories = useMemo(() => {
    const values = assets
      .map(
        (asset) =>
          asset.categoryName ||
          asset.category?.name ||
          asset.category ||
          asset.assetCategory
      )
      .filter(Boolean);

    return ["All", ...new Set(values)];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const assetId =
        asset.assetId ||
        asset.asset_id ||
        asset.id ||
        "";

      const name =
        asset.assetName ||
        asset.name ||
        "";

      const serial =
        asset.serialNumber ||
        asset.serial_number ||
        "";

      const categoryName =
        asset.categoryName ||
        asset.category?.name ||
        asset.category ||
        asset.assetCategory ||
        "";

      const assetStatus =
        asset.status ||
        asset.assetStatus ||
        "";

      const department =
        asset.departmentName ||
        asset.department?.name ||
        asset.department ||
        "";

      const college =
        asset.collegeName ||
        asset.college?.name ||
        asset.college ||
        "";

      const location =
        asset.locationName ||
        asset.location?.name ||
        asset.room ||
        "";

      const matchesSearch =
        !query ||
        String(assetId).toLowerCase().includes(query) ||
        String(name).toLowerCase().includes(query) ||
        String(serial).toLowerCase().includes(query) ||
        String(categoryName).toLowerCase().includes(query) ||
        String(department).toLowerCase().includes(query) ||
        String(college).toLowerCase().includes(query) ||
        String(location).toLowerCase().includes(query);

      const matchesStatus =
        status === "All" ||
        String(assetStatus).toLowerCase() ===
          status.toLowerCase();

      const matchesCategory =
        category === "All" ||
        String(categoryName).toLowerCase() ===
          category.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory
      );
    });
  }, [assets, search, status, category]);

  const getAssetId = (asset) =>
    asset.assetId ||
    asset.asset_id ||
    asset.id ||
    "-";

  const getAssetName = (asset) =>
    asset.assetName ||
    asset.name ||
    "Unnamed Asset";

  const getCategory = (asset) =>
    asset.categoryName ||
    asset.category?.name ||
    asset.category ||
    asset.assetCategory ||
    "-";

  const getSerialNumber = (asset) =>
    asset.serialNumber ||
    asset.serial_number ||
    "-";

  const getStatus = (asset) =>
    asset.status ||
    asset.assetStatus ||
    "Unknown";

  const getDepartment = (asset) =>
    asset.departmentName ||
    asset.department?.name ||
    asset.department ||
    "-";

  const getCollege = (asset) =>
    asset.collegeName ||
    asset.college?.name ||
    asset.college ||
    "-";

  const getLocation = (asset) =>
    asset.locationName ||
    asset.location?.name ||
    asset.room ||
    asset.location ||
    "-";

  const getStatusClass = (assetStatus) => {
    const value = String(
      assetStatus || ""
    ).toLowerCase();

    if (
      value.includes("active") ||
      value.includes("functional")
    ) {
      return "success";
    }

    if (
      value.includes("damage") ||
      value.includes("expired")
    ) {
      return "danger";
    }

    if (
      value.includes("maintenance") ||
      value.includes("pending")
    ) {
      return "warning";
    }

    if (value.includes("replaced")) {
      return "info";
    }

    return "neutral";
  };

  const openDetails = (asset) => {
    setSelectedAsset(asset);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedAsset(null);
    setShowDetails(false);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div>Loading assets...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>All Assets</h1>
          <p style={styles.subtitle}>
            Centralized management and monitoring of
            university assets.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAssets}
          style={styles.refreshButton}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <div>
            <strong>Unable to load assets</strong>
            <div style={styles.errorMessage}>
              {error}
            </div>
          </div>

          <button
            type="button"
            onClick={loadAssets}
            style={styles.retryButton}
          >
            Retry
          </button>
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>⌕</span>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search asset ID, name, serial number..."
            style={styles.searchInput}
          />
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          style={styles.select}
        >
          {STATUS_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
          style={styles.select}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === "All"
                ? "All Categories"
                : item}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.summary}>
        <div style={styles.summaryCard}>
          <span>Total Assets</span>
          <strong>{assets.length}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Showing</span>
          <strong>{filteredAssets.length}</strong>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Asset ID</th>
                <th style={styles.th}>Asset Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Serial Number</th>
                <th style={styles.th}>College</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Location</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    style={styles.emptyCell}
                  >
                    No assets found.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset, index) => {
                  const assetId = getAssetId(asset);

                  return (
                    <tr
                      key={`${assetId}-${index}`}
                      style={styles.tr}
                    >
                      <td style={styles.td}>
                        <strong>{assetId}</strong>
                      </td>

                      <td style={styles.td}>
                        {getAssetName(asset)}
                      </td>

                      <td style={styles.td}>
                        {getCategory(asset)}
                      </td>

                      <td style={styles.td}>
                        {getSerialNumber(asset)}
                      </td>

                      <td style={styles.td}>
                        {getCollege(asset)}
                      </td>

                      <td style={styles.td}>
                        {getDepartment(asset)}
                      </td>

                      <td style={styles.td}>
                        {getLocation(asset)}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.status,
                            ...styles[
                              getStatusClass(
                                getStatus(asset)
                              )
                            ],
                          }}
                        >
                          {getStatus(asset)}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() =>
                            openDetails(asset)
                          }
                          style={styles.viewButton}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetails && selectedAsset && (
        <div
          style={styles.overlay}
          onClick={closeDetails}
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Asset Details
                </h2>
                <p style={styles.modalSubtitle}>
                  {getAssetName(selectedAsset)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.detailsGrid}>
              <Detail
                label="Asset ID"
                value={getAssetId(selectedAsset)}
              />

              <Detail
                label="Asset Name"
                value={getAssetName(selectedAsset)}
              />

              <Detail
                label="Category"
                value={getCategory(selectedAsset)}
              />

              <Detail
                label="Serial Number"
                value={getSerialNumber(
                  selectedAsset
                )}
              />

              <Detail
                label="Status"
                value={getStatus(selectedAsset)}
              />

              <Detail
                label="College"
                value={getCollege(selectedAsset)}
              />

              <Detail
                label="Department"
                value={getDepartment(
                  selectedAsset
                )}
              />

              <Detail
                label="Location"
                value={getLocation(selectedAsset)}
              />

              <Detail
                label="Purchase Date"
                value={
                  selectedAsset.purchaseDate ||
                  selectedAsset.purchase_date ||
                  "-"
                }
              />

              <Detail
                label="Quantity"
                value={
                  selectedAsset.quantity ?? "-"
                }
              />

              <Detail
                label="Research Grant"
                value={
                  selectedAsset.researchGrant ||
                  selectedAsset.research_grant ||
                  "-"
                }
              />

              <Detail
                label="Warranty"
                value={
                  selectedAsset.warranty || "-"
                }
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={closeDetails}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>
        {label}
      </div>

      <div style={styles.detailValue}>
        {value}
      </div>
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
    marginBottom: "24px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    fontWeight: 700,
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#64748B",
    fontSize: "14px",
  },

  refreshButton: {
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    background: "#2563EB",
    color: "#FFFFFF",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "14px 16px",
    marginBottom: "20px",
    borderRadius: "10px",
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#991B1B",
  },

  errorMessage: {
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

  toolbar: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    marginBottom: "16px",
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    flexWrap: "wrap",
  },

  searchWrapper: {
    position: "relative",
    flex: "1 1 320px",
    minWidth: "240px",
  },

  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748B",
    fontSize: "20px",
  },

  searchInput: {
    width: "100%",
    height: "42px",
    boxSizing: "border-box",
    padding: "0 12px 0 38px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
  },

  select: {
    minWidth: "170px",
    height: "42px",
    padding: "0 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    fontSize: "14px",
    cursor: "pointer",
  },

  summary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },

  summaryCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 18px",
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "10px",
    color: "#64748B",
    fontSize: "13px",
  },

  tableCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    overflow: "hidden",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1100px",
  },

  th: {
    padding: "14px 12px",
    textAlign: "left",
    background: "#F8FAFC",
    borderBottom: "1px solid #E5E7EB",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #F1F5F9",
  },

  td: {
    padding: "13px 12px",
    color: "#334155",
    fontSize: "13px",
    verticalAlign: "middle",
  },

  status: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  success: {
    background: "#DCFCE7",
    color: "#166534",
  },

  danger: {
    background: "#FEE2E2",
    color: "#991B1B",
  },

  warning: {
    background: "#FEF3C7",
    color: "#92400E",
  },

  info: {
    background: "#DBEAFE",
    color: "#1E40AF",
  },

  neutral: {
    background: "#E2E8F0",
    color: "#475569",
  },

  viewButton: {
    border: "1px solid #2563EB",
    borderRadius: "6px",
    padding: "6px 11px",
    background: "#FFFFFF",
    color: "#2563EB",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },

  emptyCell: {
    padding: "40px",
    textAlign: "center",
    color: "#64748B",
    fontSize: "14px",
  },

  loadingCard: {
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "15px",
    background: "#FFFFFF",
    borderRadius: "12px",
    color: "#64748B",
  },

  spinner: {
    width: "34px",
    height: "34px",
    border: "4px solid #E5E7EB",
    borderTop: "4px solid #2563EB",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(15, 23, 42, 0.55)",
    boxSizing: "border-box",
  },

  modal: {
    width: "100%",
    maxWidth: "800px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow:
      "0 20px 50px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "20px",
    borderBottom: "1px solid #E5E7EB",
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "20px",
  },

  modalSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "13px",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "#64748B",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    padding: "20px",
  },

  detailItem: {
    padding: "13px",
    borderRadius: "8px",
    background: "#F8FAFC",
  },

  detailLabel: {
    color: "#64748B",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },

  detailValue: {
    marginTop: "6px",
    color: "#111827",
    fontSize: "14px",
    wordBreak: "break-word",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "16px 20px",
    borderTop: "1px solid #E5E7EB",
  },

  secondaryButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
    padding: "9px 16px",
    background: "#FFFFFF",
    color: "#334155",
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default AllAssets;