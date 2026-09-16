import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Eye,
  Edit3,
  X,
  Calculator,
  DollarSign,
  TrendingDown,
  Package,
  AlertCircle,
  CheckCircle,
  Loader2,
  CalendarDays,
} from "lucide-react";

const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const Depreciation = () => {
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
  const [method, setMethod] = useState("");

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    acquisitionCost: "",
    acquisitionDate: "",
    usefulLife: "",
    residualValue: "",
    depreciationMethod: "straight_line",
    depreciationRate: "",
    accumulatedDepreciation: "",
    currentBookValue: "",
    lastDepreciationDate: "",
    notes: "",
  });

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
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
          `Request failed: ${response.status}`
      );
    }

    return data;
  };

  const toArray = (data) => {
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
      let assetData;

      try {
        assetData = await request(
          `${API_URL}/finance/depreciation`
        );
      } catch {
        assetData = await request(`${API_URL}/assets`);
      }

      setAssets(toArray(assetData));

      const results = await Promise.allSettled([
        request(`${API_URL}/departments`),
        request(`${API_URL}/categories`),
      ]);

      if (results[0].status === "fulfilled") {
        setDepartments(toArray(results[0].value));
      }

      if (results[1].status === "fulfilled") {
        setCategories(toArray(results[1].value));
      }
    } catch (err) {
      setError(
        err.message || "Unable to load depreciation data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [success]);

  const getId = (asset) =>
    asset.id ??
    asset.asset_id ??
    asset.assetId ??
    "";

  const getName = (asset) =>
    asset.name ??
    asset.asset_name ??
    asset.assetName ??
    asset.description ??
    "Unnamed Asset";

  const getCode = (asset) =>
    asset.asset_code ??
    asset.assetCode ??
    asset.code ??
    asset.tag_number ??
    asset.tagNumber ??
    "—";

  const getDepartment = (asset) => {
    if (
      typeof asset.department === "object" &&
      asset.department
    ) {
      return (
        asset.department.name ||
        asset.department.department_name ||
        "—"
      );
    }

    return (
      asset.department_name ??
      asset.departmentName ??
      asset.department ??
      "—"
    );
  };

  const getCategory = (asset) => {
    if (
      typeof asset.category === "object" &&
      asset.category
    ) {
      return (
        asset.category.name ||
        asset.category.category_name ||
        "—"
      );
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

  const number = (...values) => {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        const n = Number(value);

        if (Number.isFinite(n)) {
          return n;
        }
      }
    }

    return 0;
  };

  const getAcquisitionCost = (asset) =>
    number(
      asset.acquisition_cost,
      asset.acquisitionCost,
      asset.purchase_price,
      asset.purchasePrice,
      asset.original_cost,
      asset.originalCost,
      asset.cost
    );

  const getResidualValue = (asset) =>
    number(
      asset.residual_value,
      asset.residualValue,
      asset.salvage_value,
      asset.salvageValue
    );

  const getUsefulLife = (asset) =>
    number(
      asset.useful_life,
      asset.usefulLife,
      asset.useful_life_years,
      asset.usefulLifeYears
    );

  const getAccumulatedDepreciation = (asset) =>
    number(
      asset.accumulated_depreciation,
      asset.accumulatedDepreciation,
      asset.total_depreciation,
      asset.totalDepreciation,
      asset.depreciation_amount,
      asset.depreciationAmount
    );

  const getBookValue = (asset) => {
    const explicit = number(
      asset.current_book_value,
      asset.currentBookValue,
      asset.net_book_value,
      asset.netBookValue,
      asset.book_value,
      asset.bookValue
    );

    if (explicit > 0) return explicit;

    return Math.max(
      0,
      getAcquisitionCost(asset) -
        getAccumulatedDepreciation(asset)
    );
  };

  const getMethod = (asset) =>
    asset.depreciation_method ??
    asset.depreciationMethod ??
    "straight_line";

  const getAcquisitionDate = (asset) =>
    asset.acquisition_date ??
    asset.acquisitionDate ??
    asset.purchase_date ??
    asset.purchaseDate ??
    "";

  const getLastDepreciationDate = (asset) =>
    asset.last_depreciation_date ??
    asset.lastDepreciationDate ??
    "";

  const getRate = (asset) => {
    const explicit = number(
      asset.depreciation_rate,
      asset.depreciationRate,
      asset.rate
    );

    if (explicit > 0) return explicit;

    const life = getUsefulLife(asset);

    return life > 0 ? 100 / life : 0;
  };

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !q ||
        [
          getName(asset),
          getCode(asset),
          getDepartment(asset),
          getCategory(asset),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesDepartment =
        !department ||
        String(getDepartment(asset)).toLowerCase() ===
          department.toLowerCase();

      const matchesCategory =
        !category ||
        String(getCategory(asset)).toLowerCase() ===
          category.toLowerCase();

      const matchesStatus =
        !status ||
        getStatus(asset) === status.toLowerCase();

      const matchesMethod =
        !method ||
        getMethod(asset).toLowerCase() ===
          method.toLowerCase();

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesCategory &&
        matchesStatus &&
        matchesMethod
      );
    });
  }, [
    assets,
    search,
    department,
    category,
    status,
    method,
  ]);

  const totals = useMemo(() => {
    return filteredAssets.reduce(
      (result, asset) => {
        result.cost += getAcquisitionCost(asset);
        result.depreciation +=
          getAccumulatedDepreciation(asset);
        result.bookValue += getBookValue(asset);

        return result;
      },
      {
        cost: 0,
        depreciation: 0,
        bookValue: 0,
      }
    );
  }, [filteredAssets]);

  const formatMoney = (value) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString();
  };

  const methodLabel = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[-\s]/g, "_");

    const labels = {
      straight_line: "Straight Line",
      declining_balance: "Declining Balance",
      units_of_production: "Units of Production",
    };

    return labels[normalized] || value || "Straight Line";
  };

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setCategory("");
    setStatus("");
    setMethod("");
  };

  const calculateDepreciation = () => {
    const cost = Number(form.acquisitionCost) || 0;
    const residual = Number(form.residualValue) || 0;
    const life = Number(form.usefulLife) || 0;

    if (cost <= 0 || life <= 0) {
      setError(
        "Acquisition cost and useful life must be greater than zero."
      );
      return;
    }

    const depreciableAmount = Math.max(
      0,
      cost - residual
    );

    let annual = 0;

    if (form.depreciationMethod === "straight_line") {
      annual = depreciableAmount / life;
    } else if (
      form.depreciationMethod === "declining_balance"
    ) {
      const rate =
        Number(form.depreciationRate) || 0;

      annual =
        rate > 0
          ? cost * (rate / 100)
          : depreciableAmount / life;
    } else {
      annual = depreciableAmount / life;
    }

    const accumulated =
      Number(form.accumulatedDepreciation) || 0;

    setForm((previous) => ({
      ...previous,
      currentBookValue: Math.max(
        0,
        cost - accumulated
      ).toFixed(2),
      depreciationRate:
        form.depreciationMethod === "straight_line"
          ? (100 / life).toFixed(2)
          : form.depreciationRate,
    }));

    setSuccess(
      `Estimated annual depreciation: ${formatMoney(
        annual
      )} ETB`
    );
  };

  const openEdit = (asset) => {
    setSelectedAsset(asset);

    setForm({
      assetId: getId(asset),
      acquisitionCost:
        getAcquisitionCost(asset) || "",
      acquisitionDate: getAcquisitionDate(asset)
        ? String(getAcquisitionDate(asset)).slice(
            0,
            10
          )
        : "",
      usefulLife: getUsefulLife(asset) || "",
      residualValue: getResidualValue(asset) || "",
      depreciationMethod: getMethod(asset),
      depreciationRate:
        getRate(asset) || "",
      accumulatedDepreciation:
        getAccumulatedDepreciation(asset) || "",
      currentBookValue:
        getBookValue(asset) || "",
      lastDepreciationDate:
        getLastDepreciationDate(asset)
          ? String(
              getLastDepreciationDate(asset)
            ).slice(0, 10)
          : "",
      notes:
        asset.depreciation_notes ??
        asset.depreciationNotes ??
        "",
    });

    setShowEdit(true);
  };

  const saveDepreciation = async (event) => {
    event.preventDefault();

    if (!selectedAsset) {
      setError("No asset selected.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      assetId: form.assetId,
      acquisitionCost:
        Number(form.acquisitionCost) || 0,
      acquisitionDate: form.acquisitionDate || null,
      usefulLife:
        Number(form.usefulLife) || null,
      residualValue:
        Number(form.residualValue) || 0,
      depreciationMethod:
        form.depreciationMethod,
      depreciationRate:
        Number(form.depreciationRate) || 0,
      accumulatedDepreciation:
        Number(form.accumulatedDepreciation) || 0,
      currentBookValue:
        Number(form.currentBookValue) || 0,
      lastDepreciationDate:
        form.lastDepreciationDate || null,
      notes: form.notes,
    };

    try {
      await request(
        `${API_URL}/finance/depreciation/${getId(
          selectedAsset
        )}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      setSuccess(
        "Depreciation record updated successfully."
      );

      setShowEdit(false);
      setSelectedAsset(null);

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update depreciation record."
      );
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (!filteredAssets.length) {
      setError("No depreciation records available.");
      return;
    }

    const header = [
      "Asset Code",
      "Asset Name",
      "Department",
      "Category",
      "Status",
      "Acquisition Cost",
      "Accumulated Depreciation",
      "Current Book Value",
      "Useful Life",
      "Depreciation Method",
      "Rate",
    ];

    const rows = filteredAssets.map((asset) => [
      getCode(asset),
      getName(asset),
      getDepartment(asset),
      getCategory(asset),
      getStatus(asset),
      getAcquisitionCost(asset),
      getAccumulatedDepreciation(asset),
      getBookValue(asset),
      getUsefulLife(asset),
      methodLabel(getMethod(asset)),
      getRate(asset),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value ?? "").replace(
                /"/g,
                '""'
              )}"`
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
    link.download = `depreciation-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    width: "100%",
    height: "40px",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    padding: "0 12px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "24px",
        color: "#0f172a",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5eaf1",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
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
            Depreciation
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Manage asset depreciation, book value,
            useful life and depreciation methods.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
          }}
        >
          <button
            onClick={loadData}
            disabled={loading}
            style={secondaryButton}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            style={{
              ...secondaryButton,
              background: "#0ea5e9",
              color: "#fff",
              borderColor: "#0ea5e9",
            }}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError("")}
        />
      )}

      {success && (
        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      )}

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <Summary
          icon={<Package size={21} />}
          title="Total Assets"
          value={filteredAssets.length}
          subtitle="assets in view"
        />

        <Summary
          icon={<DollarSign size={21} />}
          title="Asset Cost"
          value={`${formatMoney(
            totals.cost
          )} ETB`}
          subtitle="acquisition cost"
        />

        <Summary
          icon={<TrendingDown size={21} />}
          title="Accumulated Depreciation"
          value={`${formatMoney(
            totals.depreciation
          )} ETB`}
          subtitle="total depreciation"
        />

        <Summary
          icon={<Calculator size={21} />}
          title="Current Book Value"
          value={`${formatMoney(
            totals.bookValue
          )} ETB`}
          subtitle="net book value"
        />
      </div>

      {/* FILTERS */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5eaf1",
          borderRadius: "12px",
          padding: "18px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 2fr) repeat(4, minmax(140px, 1fr)) auto",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>
              Search
            </label>

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
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search asset..."
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
              {
                value: "active",
                label: "Active",
              },
              {
                value: "under_maintenance",
                label: "Under Maintenance",
              },
              {
                value: "inactive",
                label: "Inactive",
              },
              {
                value: "disposed",
                label: "Disposed",
              },
            ]}
          />

          <Select
            label="Method"
            value={method}
            onChange={setMethod}
            options={[
              {
                value: "straight_line",
                label: "Straight Line",
              },
              {
                value: "declining_balance",
                label: "Declining Balance",
              },
              {
                value: "units_of_production",
                label: "Units of Production",
              },
            ]}
          />

          <button
            onClick={clearFilters}
            style={{
              ...secondaryButton,
              alignSelf: "end",
              height: "40px",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5eaf1",
          borderRadius: "12px",
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
              Depreciation Records
            </h2>

            <span
              style={{
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              {filteredAssets.length} record
              {filteredAssets.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : filteredAssets.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "1150px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                  }}
                >
                  <Th>Asset</Th>
                  <Th>Department</Th>
                  <Th>Category</Th>
                  <Th>Method</Th>
                  <Th>Useful Life</Th>
                  <Th align="right">
                    Acquisition Cost
                  </Th>
                  <Th align="right">
                    Accumulated Dep.
                  </Th>
                  <Th align="right">
                    Book Value
                  </Th>
                  <Th>Last Depreciation</Th>
                  <Th align="center">
                    Actions
                  </Th>
                </tr>
              </thead>

              <tbody>
                {filteredAssets.map((asset) => (
                  <tr
                    key={
                      getId(asset) ||
                      `${getCode(asset)}-${getName(
                        asset
                      )}`
                    }
                    style={{
                      borderTop:
                        "1px solid #edf1f5",
                    }}
                  >
                    <td style={tdStyle}>
                      <strong
                        style={{
                          display: "block",
                        }}
                      >
                        {getName(asset)}
                      </strong>

                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                        }}
                      >
                        {getCode(asset)}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {getDepartment(asset)}
                    </td>

                    <td style={tdStyle}>
                      {getCategory(asset)}
                    </td>

                    <td style={tdStyle}>
                      {methodLabel(
                        getMethod(asset)
                      )}
                    </td>

                    <td style={tdStyle}>
                      {getUsefulLife(asset) || "—"}{" "}
                      {getUsefulLife(asset)
                        ? "years"
                        : ""}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(
                        getAcquisitionCost(asset)
                      )}{" "}
                      ETB
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(
                        getAccumulatedDepreciation(
                          asset
                        )
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
                      {formatMoney(
                        getBookValue(asset)
                      )}{" "}
                      ETB
                    </td>

                    <td style={tdStyle}>
                      {formatDate(
                        getLastDepreciationDate(
                          asset
                        )
                      )}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "center",
                          gap: "6px",
                        }}
                      >
                        <IconButton
                          title="View"
                          onClick={() => {
                            setSelectedAsset(
                              asset
                            );
                            setShowDetails(true);
                          }}
                        >
                          <Eye size={16} />
                        </IconButton>

                        <IconButton
                          title="Edit"
                          onClick={() =>
                            openEdit(asset)
                          }
                        >
                          <Edit3 size={16} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILS MODAL */}
      {showDetails && selectedAsset && (
        <Modal
          title="Depreciation Details"
          onClose={() => {
            setShowDetails(false);
            setSelectedAsset(null);
          }}
        >
          <Detail
            label="Asset Name"
            value={getName(selectedAsset)}
          />

          <Detail
            label="Asset Code"
            value={getCode(selectedAsset)}
          />

          <Detail
            label="Department"
            value={getDepartment(
              selectedAsset
            )}
          />

          <Detail
            label="Category"
            value={getCategory(
              selectedAsset
            )}
          />

          <Detail
            label="Acquisition Cost"
            value={`${formatMoney(
              getAcquisitionCost(
                selectedAsset
              )
            )} ETB`}
          />

          <Detail
            label="Residual Value"
            value={`${formatMoney(
              getResidualValue(
                selectedAsset
              )
            )} ETB`}
          />

          <Detail
            label="Useful Life"
            value={`${getUsefulLife(
              selectedAsset
            ) || "—"} years`}
          />

          <Detail
            label="Depreciation Method"
            value={methodLabel(
              getMethod(selectedAsset)
            )}
          />

          <Detail
            label="Depreciation Rate"
            value={`${getRate(
              selectedAsset
            ).toFixed(2)}%`}
          />

          <Detail
            label="Accumulated Depreciation"
            value={`${formatMoney(
              getAccumulatedDepreciation(
                selectedAsset
              )
            )} ETB`}
          />

          <Detail
            label="Current Book Value"
            value={`${formatMoney(
              getBookValue(selectedAsset)
            )} ETB`}
          />

          <Detail
            label="Acquisition Date"
            value={formatDate(
              getAcquisitionDate(
                selectedAsset
              )
            )}
          />

          <Detail
            label="Last Depreciation"
            value={formatDate(
              getLastDepreciationDate(
                selectedAsset
              )
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
                setShowDetails(false);
                openEdit(selectedAsset);
              }}
              style={primaryButton}
            >
              <Edit3 size={16} />
              Edit Depreciation
            </button>
          </div>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {showEdit && selectedAsset && (
        <Modal
          title="Update Depreciation"
          onClose={() => {
            setShowEdit(false);
            setSelectedAsset(null);
          }}
        >
          <form onSubmit={saveDepreciation}>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: "9px",
                padding: "12px",
                marginBottom: "18px",
              }}
            >
              <strong>
                {getName(selectedAsset)}
              </strong>

              <div
                style={{
                  color: "#64748b",
                  fontSize: "12px",
                  marginTop: "3px",
                }}
              >
                {getCode(selectedAsset)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
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
                label="Acquisition Date"
                type="date"
                value={form.acquisitionDate}
                onChange={(value) =>
                  setForm({
                    ...form,
                    acquisitionDate: value,
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

              <div>
                <label style={labelStyle}>
                  Depreciation Method
                </label>

                <select
                  value={
                    form.depreciationMethod
                  }
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

              <FormInput
                label="Depreciation Rate (%)"
                type="number"
                min="0"
                step="0.01"
                value={form.depreciationRate}
                onChange={(value) =>
                  setForm({
                    ...form,
                    depreciationRate: value,
                  })
                }
              />

              <FormInput
                label="Accumulated Depreciation"
                type="number"
                min="0"
                step="0.01"
                value={
                  form.accumulatedDepreciation
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    accumulatedDepreciation:
                      value,
                  })
                }
              />

              <FormInput
                label="Current Book Value"
                type="number"
                min="0"
                step="0.01"
                value={form.currentBookValue}
                onChange={(value) =>
                  setForm({
                    ...form,
                    currentBookValue: value,
                  })
                }
              />

              <FormInput
                label="Last Depreciation Date"
                type="date"
                value={
                  form.lastDepreciationDate
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    lastDepreciationDate:
                      value,
                  })
                }
              />
            </div>

            <button
              type="button"
              onClick={calculateDepreciation}
              style={{
                marginTop: "15px",
                ...secondaryButton,
              }}
            >
              <Calculator size={16} />
              Calculate
            </button>

            <div
              style={{
                marginTop: "15px",
              }}
            >
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
                placeholder="Depreciation notes..."
                style={{
                  ...inputStyle,
                  height: "auto",
                  padding: "10px 12px",
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
                  setShowEdit(false);
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
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .depreciation-filters {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 700px) {
          .depreciation-filters {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

/* =========================
   SUMMARY CARD
========================= */

const Summary = ({
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
        "0 2px 8px rgba(15,23,42,.04)",
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
        marginBottom: "12px",
      }}
    >
      {icon}
    </div>

    <div
      style={{
        color: "#64748b",
        fontSize: "13px",
      }}
    >
      {title}
    </div>

    <div
      style={{
        fontSize: "21px",
        fontWeight: 700,
        marginTop: "4px",
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

/* =========================
   SELECT
========================= */

const Select = ({
  label,
  value,
  onChange,
  options,
}) => (
  <div>
    <label style={labelStyle}>
      {label}
    </label>

    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      style={{
        width: "100%",
        height: "40px",
        border: "1px solid #dbe3ef",
        borderRadius: "8px",
        padding: "0 10px",
        background: "#fff",
        fontSize: "13px",
      }}
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

/* =========================
   FORM INPUT
========================= */

const FormInput = ({
  label,
  type,
  value,
  onChange,
  min,
  step,
}) => (
  <div>
    <label style={labelStyle}>
      {label}
    </label>

    <input
      type={type}
      value={value}
      min={min}
      step={step}
      onChange={(e) =>
        onChange(e.target.value)
      }
      style={{
        width: "100%",
        height: "40px",
        border: "1px solid #dbe3ef",
        borderRadius: "8px",
        padding: "0 12px",
        boxSizing: "border-box",
        fontSize: "14px",
      }}
    />
  </div>
);

/* =========================
   MODAL
========================= */

const Modal = ({
  title,
  children,
  onClose,
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.55)",
      zIndex: 1000,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px",
    }}
  >
    <div
      style={{
        background: "#fff",
        width: "100%",
        maxWidth: "720px",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: "14px",
        boxShadow:
          "0 20px 50px rgba(15,23,42,.2)",
      }}
    >
      <div
        style={{
          padding: "18px 20px",
          borderBottom:
            "1px solid #e5eaf1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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

/* =========================
   DETAIL
========================= */

const Detail = ({
  label,
  value,
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "190px 1fr",
      gap: "15px",
      padding: "11px 0",
      borderBottom:
        "1px solid #eef2f7",
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

    <span
      style={{
        color: "#0f172a",
        fontSize: "14px",
      }}
    >
      {value}
    </span>
  </div>
);

/* =========================
   ALERT
========================= */

const Alert = ({
  type,
  message,
  onClose,
}) => {
  const isError = type === "error";

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "13px 16px",
        borderRadius: "10px",
        border: `1px solid ${
          isError
            ? "#fecaca"
            : "#bbf7d0"
        }`,
        background: isError
          ? "#fff7f7"
          : "#f0fdf4",
        color: isError
          ? "#b91c1c"
          : "#15803d",
        display: "flex",
        alignItems: "center",
        gap: "9px",
      }}
    >
      {isError ? (
        <AlertCircle size={18} />
      ) : (
        <CheckCircle size={18} />
      )}

      <span style={{ flex: 1 }}>
        {message}
      </span>

      <button
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

/* =========================
   LOADING
========================= */

const Loading = () => (
  <div
    style={{
      minHeight: "280px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#64748b",
    }}
  >
    <Loader2
      size={30}
      style={{
        animation:
          "spin 1s linear infinite",
      }}
    />

    <p>Loading depreciation records...</p>
  </div>
);

/* =========================
   EMPTY
========================= */

const EmptyState = () => (
  <div
    style={{
      minHeight: "280px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#64748b",
      textAlign: "center",
    }}
  >
    <CalendarDays size={40} />

    <h3
      style={{
        color: "#334155",
        marginBottom: "5px",
      }}
    >
      No depreciation records
    </h3>

    <p style={{ margin: 0 }}>
      No assets match the selected filters.
    </p>
  </div>
);

/* =========================
   TABLE
========================= */

const Th = ({
  children,
  align = "left",
}) => (
  <th
    style={{
      padding: "12px 14px",
      textAlign: align,
      fontSize: "12px",
      color: "#475569",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);

/* =========================
   ICON BUTTON
========================= */

const IconButton = ({
  children,
  title,
  onClick,
}) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: "32px",
      height: "32px",
      border: "1px solid #dbe3ef",
      borderRadius: "7px",
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

/* =========================
   STYLES
========================= */

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
  padding: "10px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
};

export default Depreciation;