// frontend/src/pages/finance/AssetValuation.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Plus,
  Eye,
  Edit3,
  X,
  DollarSign,
  TrendingUp,
  Package,
  Calculator,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const AssetValuation = () => {
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [valuationStatus, setValuationStatus] = useState("");

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    valuationDate: new Date().toISOString().split("T")[0],
    acquisitionCost: "",
    currentValue: "",
    residualValue: "",
    usefulLife: "",
    depreciationMethod: "straight_line",
    notes: "",
  });

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const authHeaders = () => {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
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

  const normalizeArray = (data) => {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.assets)) return data.assets;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;

    return [];
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [assetResult, departmentResult, categoryResult] =
        await Promise.allSettled([
          fetchJSON(`${API_URL}/finance/valuation`),
          fetchJSON(`${API_URL}/departments`),
          fetchJSON(`${API_URL}/categories`),
        ]);

      if (assetResult.status === "fulfilled") {
        setAssets(normalizeArray(assetResult.value));
      } else {
        // Fallback to general assets endpoint if valuation endpoint
        // is not available in the current backend.
        try {
          const fallback = await fetchJSON(`${API_URL}/assets`);
          setAssets(normalizeArray(fallback));
        } catch (fallbackError) {
          throw assetResult.reason || fallbackError;
        }
      }

      if (departmentResult.status === "fulfilled") {
        setDepartments(normalizeArray(departmentResult.value));
      }

      if (categoryResult.status === "fulfilled") {
        setCategories(normalizeArray(categoryResult.value));
      }
    } catch (err) {
      setError(err.message || "Unable to load asset valuation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const getAssetId = (asset) =>
    asset.id ??
    asset.asset_id ??
    asset.assetId ??
    asset.assetID ??
    "";

  const getAssetName = (asset) =>
    asset.name ??
    asset.asset_name ??
    asset.assetName ??
    asset.description ??
    "Unnamed Asset";

  const getAssetCode = (asset) =>
    asset.asset_code ??
    asset.assetCode ??
    asset.code ??
    asset.tag_number ??
    asset.tagNumber ??
    "—";

  const getDepartmentName = (asset) => {
    if (typeof asset.department === "object" && asset.department) {
      return asset.department.name || asset.department.department_name || "—";
    }

    return (
      asset.department_name ??
      asset.departmentName ??
      asset.department ??
      "—"
    );
  };

  const getCategoryName = (asset) => {
    if (typeof asset.category === "object" && asset.category) {
      return asset.category.name || asset.category.category_name || "—";
    }

    return (
      asset.category_name ??
      asset.categoryName ??
      asset.category ??
      "—"
    );
  };

  const getStatus = (asset) =>
    String(
      asset.status ??
        asset.asset_status ??
        asset.assetStatus ??
        "active"
    ).toLowerCase();

  const numberValue = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        const number = Number(value);

        if (Number.isFinite(number)) return number;
      }
    }

    return 0;
  };

  const getAcquisitionCost = (asset) =>
    numberValue(
      asset.acquisition_cost,
      asset.acquisitionCost,
      asset.purchase_price,
      asset.purchasePrice,
      asset.cost,
      asset.original_cost,
      asset.originalCost
    );

  const getCurrentValue = (asset) =>
    numberValue(
      asset.current_value,
      asset.currentValue,
      asset.book_value,
      asset.bookValue,
      asset.net_book_value,
      asset.netBookValue,
      getAcquisitionCost(asset)
    );

  const getAccumulatedDepreciation = (asset) =>
    numberValue(
      asset.accumulated_depreciation,
      asset.accumulatedDepreciation,
      asset.depreciation_amount,
      asset.depreciationAmount
    );

  const getValuationDate = (asset) =>
    asset.valuation_date ??
    asset.valuationDate ??
    asset.last_valuation_date ??
    asset.lastValuationDate ??
    "";

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !query ||
        [
          getAssetName(asset),
          getAssetCode(asset),
          getDepartmentName(asset),
          getCategoryName(asset),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDepartment =
        !department ||
        String(getDepartmentName(asset)).toLowerCase() ===
          department.toLowerCase();

      const matchesCategory =
        !category ||
        String(getCategoryName(asset)).toLowerCase() ===
          category.toLowerCase();

      const matchesStatus =
        !status || getStatus(asset) === status.toLowerCase();

      const valuationDate = getValuationDate(asset);

      const matchesValuation =
        !valuationStatus ||
        (valuationStatus === "valued" && Boolean(valuationDate)) ||
        (valuationStatus === "not_valued" && !valuationDate);

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesCategory &&
        matchesStatus &&
        matchesValuation
      );
    });
  }, [
    assets,
    search,
    department,
    category,
    status,
    valuationStatus,
  ]);

  const totals = useMemo(() => {
    return filteredAssets.reduce(
      (result, asset) => {
        result.acquisition += getAcquisitionCost(asset);
        result.current += getCurrentValue(asset);
        result.depreciation += getAccumulatedDepreciation(asset);
        return result;
      },
      {
        acquisition: 0,
        current: 0,
        depreciation: 0,
      }
    );
  }, [filteredAssets]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  };

  const formatDate = (value) => {
    if (!value) return "Not valued";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString();
  };

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setCategory("");
    setStatus("");
    setValuationStatus("");
  };

  const openCreate = () => {
    setForm({
      assetId: "",
      valuationDate: new Date().toISOString().split("T")[0],
      acquisitionCost: "",
      currentValue: "",
      residualValue: "",
      usefulLife: "",
      depreciationMethod: "straight_line",
      notes: "",
    });

    setShowCreateModal(true);
  };

  const openEdit = (asset) => {
    setSelectedAsset(asset);

    setForm({
      assetId: getAssetId(asset),
      valuationDate:
        getValuationDate(asset) ||
        new Date().toISOString().split("T")[0],
      acquisitionCost: getAcquisitionCost(asset) || "",
      currentValue: getCurrentValue(asset) || "",
      residualValue:
        asset.residual_value ??
        asset.residualValue ??
        "",
      usefulLife:
        asset.useful_life ??
        asset.usefulLife ??
        "",
      depreciationMethod:
        asset.depreciation_method ??
        asset.depreciationMethod ??
        "straight_line",
      notes: asset.valuation_notes ?? asset.valuationNotes ?? "",
    });

    setShowEditModal(true);
  };

  const saveValuation = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      setError("Please select an asset.");
      return;
    }

    if (!form.currentValue && form.currentValue !== 0) {
      setError("Current value is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      assetId: form.assetId,
      valuationDate: form.valuationDate,
      acquisitionCost: Number(form.acquisitionCost) || 0,
      currentValue: Number(form.currentValue) || 0,
      residualValue: Number(form.residualValue) || 0,
      usefulLife: Number(form.usefulLife) || null,
      depreciationMethod: form.depreciationMethod,
      notes: form.notes,
    };

    try {
      const endpoint = selectedAsset
        ? `${API_URL}/finance/valuation/${getAssetId(selectedAsset)}`
        : `${API_URL}/finance/valuation`;

      const method = selectedAsset ? "PUT" : "POST";

      await fetchJSON(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      setSuccess(
        selectedAsset
          ? "Asset valuation updated successfully."
          : "Asset valuation created successfully."
      );

      setShowEditModal(false);
      setShowCreateModal(false);
      setSelectedAsset(null);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to save valuation.");
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (!filteredAssets.length) {
      setError("There are no valuation records to export.");
      return;
    }

    const headers = [
      "Asset Code",
      "Asset Name",
      "Department",
      "Category",
      "Status",
      "Acquisition Cost",
      "Current Value",
      "Accumulated Depreciation",
      "Valuation Date",
    ];

    const rows = filteredAssets.map((asset) => [
      getAssetCode(asset),
      getAssetName(asset),
      getDepartmentName(asset),
      getCategoryName(asset),
      getStatus(asset),
      getAcquisitionCost(asset),
      getCurrentValue(asset),
      getAccumulatedDepreciation(asset),
      formatDate(getValuationDate(asset)),
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `asset-valuation-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
    background: "#fff",
    boxSizing: "border-box",
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e5eaf1",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "24px",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          ...cardStyle,
          padding: "20px 22px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            Asset Valuation
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Review and maintain financial values of university assets.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              border: "1px solid #dbe3ef",
              background: "#fff",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            style={{
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
            }}
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={openCreate}
            style={{
              border: "none",
              background: "#2563eb",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
            }}
          >
            <Plus size={16} />
            New Valuation
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div
          style={{
            ...cardStyle,
            padding: "13px 16px",
            marginBottom: "16px",
            borderColor: "#fecaca",
            background: "#fff7f7",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            gap: "9px",
          }}
        >
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{error}</span>

          <button
            onClick={() => setError("")}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          style={{
            ...cardStyle,
            padding: "13px 16px",
            marginBottom: "16px",
            borderColor: "#bbf7d0",
            background: "#f0fdf4",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            gap: "9px",
          }}
        >
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <SummaryCard
          icon={<Package size={21} />}
          title="Assets"
          value={filteredAssets.length}
          subtitle="valuation records"
        />

        <SummaryCard
          icon={<DollarSign size={21} />}
          title="Acquisition Cost"
          value={`${formatCurrency(totals.acquisition)} ETB`}
          subtitle="original asset cost"
        />

        <SummaryCard
          icon={<TrendingUp size={21} />}
          title="Current Value"
          value={`${formatCurrency(totals.current)} ETB`}
          subtitle="current book value"
        />

        <SummaryCard
          icon={<Calculator size={21} />}
          title="Accumulated Depreciation"
          value={`${formatCurrency(
            totals.depreciation
          )} ETB`}
          subtitle="recorded depreciation"
        />
      </div>

      {/* FILTERS */}
      <div
        style={{
          ...cardStyle,
          padding: "18px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 2fr) repeat(4, minmax(150px, 1fr)) auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelStyle}>Search</label>

            <div style={{ position: "relative" }}>
              <Search
                size={17}
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "12px",
                  color: "#94a3b8",
                }}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Asset name, code..."
                style={{
                  ...inputStyle,
                  paddingLeft: "36px",
                }}
              />
            </div>
          </div>

          <Select
            label="Department"
            value={department}
            onChange={setDepartment}
            options={departments.map((item) => ({
              value:
                item.name ??
                item.department_name ??
                item.id,
              label:
                item.name ??
                item.department_name ??
                `Department ${item.id}`,
            }))}
          />

          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={categories.map((item) => ({
              value:
                item.name ??
                item.category_name ??
                item.id,
              label:
                item.name ??
                item.category_name ??
                `Category ${item.id}`,
            }))}
          />

          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              {
                value: "under_maintenance",
                label: "Under Maintenance",
              },
              { value: "inactive", label: "Inactive" },
              { value: "disposed", label: "Disposed" },
            ]}
          />

          <Select
            label="Valuation"
            value={valuationStatus}
            onChange={setValuationStatus}
            options={[
              { value: "valued", label: "Valued" },
              {
                value: "not_valued",
                label: "Not Valued",
              },
            ]}
          />

          <button
            onClick={clearFilters}
            style={{
              height: "40px",
              border: "1px solid #dbe3ef",
              background: "#fff",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              padding: "0 13px",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div
        style={{
          ...cardStyle,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "17px 20px",
            borderBottom: "1px solid #e5eaf1",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
              }}
            >
              Asset Valuation Records
            </h2>

            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              {filteredAssets.length} record
              {filteredAssets.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <Loader2
              size={28}
              style={{
                animation: "spin 1s linear infinite",
              }}
            />

            <p>Loading valuation records...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <Package size={38} />

            <h3
              style={{
                color: "#334155",
                marginBottom: "6px",
              }}
            >
              No valuation records found
            </h3>

            <p style={{ margin: 0 }}>
              Adjust the filters or create a new valuation.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1050px",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <Th>Asset</Th>
                  <Th>Department</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th align="right">Acquisition Cost</Th>
                  <Th align="right">Current Value</Th>
                  <Th align="right">Depreciation</Th>
                  <Th>Valuation Date</Th>
                  <Th align="center">Actions</Th>
                </tr>
              </thead>

              <tbody>
                {filteredAssets.map((asset) => {
                  const id = getAssetId(asset);
                  const assetStatus = getStatus(asset);

                  return (
                    <tr
                      key={id || `${getAssetCode(asset)}-${getAssetName(asset)}`}
                      style={{
                        borderTop: "1px solid #edf1f5",
                      }}
                    >
                      <td style={tdStyle}>
                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#0f172a",
                            }}
                          >
                            {getAssetName(asset)}
                          </strong>

                          <span
                            style={{
                              color: "#64748b",
                              fontSize: "12px",
                            }}
                          >
                            {getAssetCode(asset)}
                          </span>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {getDepartmentName(asset)}
                      </td>

                      <td style={tdStyle}>
                        {getCategoryName(asset)}
                      </td>

                      <td style={tdStyle}>
                        <StatusBadge status={assetStatus} />
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(
                          getAcquisitionCost(asset)
                        )}{" "}
                        ETB
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {formatCurrency(
                          getCurrentValue(asset)
                        )}{" "}
                        ETB
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(
                          getAccumulatedDepreciation(asset)
                        )}{" "}
                        ETB
                      </td>

                      <td style={tdStyle}>
                        {formatDate(
                          getValuationDate(asset)
                        )}
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <IconButton
                            title="View"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowViewModal(true);
                            }}
                          >
                            <Eye size={16} />
                          </IconButton>

                          <IconButton
                            title="Edit valuation"
                            onClick={() => openEdit(asset)}
                          >
                            <Edit3 size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      {showViewModal && selectedAsset && (
        <Modal
          title="Asset Valuation Details"
          onClose={() => {
            setShowViewModal(false);
            setSelectedAsset(null);
          }}
        >
          <DetailRow
            label="Asset Name"
            value={getAssetName(selectedAsset)}
          />

          <DetailRow
            label="Asset Code"
            value={getAssetCode(selectedAsset)}
          />

          <DetailRow
            label="Department"
            value={getDepartmentName(selectedAsset)}
          />

          <DetailRow
            label="Category"
            value={getCategoryName(selectedAsset)}
          />

          <DetailRow
            label="Status"
            value={
              <StatusBadge
                status={getStatus(selectedAsset)}
              />
            }
          />

          <DetailRow
            label="Acquisition Cost"
            value={`${formatCurrency(
              getAcquisitionCost(selectedAsset)
            )} ETB`}
          />

          <DetailRow
            label="Current Value"
            value={`${formatCurrency(
              getCurrentValue(selectedAsset)
            )} ETB`}
          />

          <DetailRow
            label="Accumulated Depreciation"
            value={`${formatCurrency(
              getAccumulatedDepreciation(selectedAsset)
            )} ETB`}
          />

          <DetailRow
            label="Valuation Date"
            value={formatDate(
              getValuationDate(selectedAsset)
            )}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <button
              onClick={() => {
                setShowViewModal(false);
                openEdit(selectedAsset);
              }}
              style={primaryButton}
            >
              <Edit3 size={16} />
              Edit Valuation
            </button>
          </div>
        </Modal>
      )}

      {/* CREATE / EDIT MODAL */}
      {(showCreateModal || showEditModal) && (
        <Modal
          title={
            selectedAsset
              ? "Update Asset Valuation"
              : "Create Asset Valuation"
          }
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedAsset(null);
          }}
        >
          <form onSubmit={saveValuation}>
            {!selectedAsset && (
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>
                  Asset *
                </label>

                <select
                  required
                  value={form.assetId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assetId: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select asset
                  </option>

                  {assets.map((asset) => (
                    <option
                      key={getAssetId(asset)}
                      value={getAssetId(asset)}
                    >
                      {getAssetCode(asset)} —{" "}
                      {getAssetName(asset)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              <FormInput
                label="Valuation Date"
                type="date"
                value={form.valuationDate}
                onChange={(value) =>
                  setForm({
                    ...form,
                    valuationDate: value,
                  })
                }
              />

              <FormInput
                label="Acquisition Cost"
                type="number"
                min="0"
                step="0.01"
                value={form.acquisitionCost}
                onChange={(value) =>
                  setForm({
                    ...form,
                    acquisitionCost: value,
                  })
                }
              />

              <FormInput
                label="Current Value *"
                type="number"
                min="0"
                step="0.01"
                value={form.currentValue}
                onChange={(value) =>
                  setForm({
                    ...form,
                    currentValue: value,
                  })
                }
              />

              <FormInput
                label="Residual Value"
                type="number"
                min="0"
                step="0.01"
                value={form.residualValue}
                onChange={(value) =>
                  setForm({
                    ...form,
                    residualValue: value,
                  })
                }
              />

              <FormInput
                label="Useful Life (Years)"
                type="number"
                min="0"
                value={form.usefulLife}
                onChange={(value) =>
                  setForm({
                    ...form,
                    usefulLife: value,
                  })
                }
              />

              <div>
                <label style={labelStyle}>
                  Depreciation Method
                </label>

                <select
                  value={form.depreciationMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      depreciationMethod:
                        e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="straight_line">
                    Straight Line
                  </option>

                  <option value="declining_balance">
                    Declining Balance
                  </option>

                  <option value="units_of_production">
                    Units of Production
                  </option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={labelStyle}>
                Notes
              </label>

              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                placeholder="Valuation notes..."
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedAsset(null);
                }}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={primaryButton}
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      style={{
                        animation:
                          "spin 1s linear infinite",
                      }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Save Valuation
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1100px) {
          .valuation-filter-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 700px) {
          .valuation-filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

/* =========================
   COMPONENTS
========================= */

const SummaryCard = ({
  icon,
  title,
  value,
  subtitle,
}) => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e5eaf1",
      borderRadius: "12px",
      padding: "18px",
      boxShadow:
        "0 2px 8px rgba(15, 23, 42, 0.04)",
    }}
  >
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "9px",
        background: "#eff6ff",
        color: "#2563eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "13px",
      }}
    >
      {icon}
    </div>

    <div
      style={{
        color: "#64748b",
        fontSize: "13px",
        marginBottom: "5px",
      }}
    >
      {title}
    </div>

    <div
      style={{
        fontSize: "21px",
        fontWeight: 700,
        color: "#0f172a",
      }}
    >
      {value}
    </div>

    <div
      style={{
        color: "#94a3b8",
        fontSize: "12px",
        marginTop: "4px",
      }}
    >
      {subtitle}
    </div>
  </div>
);

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #dbe3ef",
  borderRadius: "8px",
  boxSizing: "border-box",
  background: "#fff",
};

const Select = ({
  label,
  value,
  onChange,
  options,
}) => (
  <div>
    <label style={labelStyle}>{label}</label>

    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    >
      <option value="">All</option>

      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const FormInput = ({
  label,
  type,
  value,
  onChange,
  min,
  step,
}) => (
  <div>
    <label style={labelStyle}>{label}</label>

    <input
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const normalized = String(status || "active")
    .toLowerCase()
    .replace(/\s+/g, "_");

  const styles = {
    active: {
      background: "#dcfce7",
      color: "#166534",
    },
    under_maintenance: {
      background: "#fef3c7",
      color: "#92400e",
    },
    inactive: {
      background: "#f1f5f9",
      color: "#475569",
    },
    disposed: {
      background: "#fee2e2",
      color: "#991b1b",
    },
  };

  const current =
    styles[normalized] || styles.inactive;

  return (
    <span
      style={{
        ...current,
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {normalized.replace(/_/g, " ")}
    </span>
  );
};

const IconButton = ({
  children,
  title,
  onClick,
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width: "32px",
      height: "32px",
      borderRadius: "7px",
      border: "1px solid #dbe3ef",
      background: "#fff",
      color: "#475569",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

const Modal = ({
  title,
  children,
  onClose,
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        background: "#fff",
        width: "100%",
        maxWidth: "700px",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: "14px",
        boxShadow:
          "0 20px 50px rgba(15, 23, 42, 0.2)",
      }}
    >
      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid #e5eaf1",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {title}
        </h2>

        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      gap: "15px",
      padding: "12px 0",
      borderBottom: "1px solid #eef2f7",
    }}
  >
    <strong
      style={{
        color: "#64748b",
        fontSize: "13px",
      }}
    >
      {label}
    </strong>

    <div
      style={{
        color: "#0f172a",
        fontSize: "14px",
      }}
    >
      {value}
    </div>
  </div>
);

const Th = ({ children, align = "left" }) => (
  <th
    style={{
      padding: "12px 14px",
      textAlign: align,
      fontSize: "12px",
      fontWeight: 700,
      color: "#475569",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);

const tdStyle = {
  padding: "13px 14px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
};

const primaryButton = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "10px 15px",
  borderRadius: "8px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
};

const secondaryButton = {
  border: "1px solid #dbe3ef",
  background: "#fff",
  color: "#334155",
  padding: "10px 15px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
};

export default AssetValuation;