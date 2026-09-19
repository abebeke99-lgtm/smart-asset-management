import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Eye,
  Edit3,
  Plus,
  X,
  DollarSign,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calculator,
  Building2,
} from "lucide-react";
import { apiBase } from "../../utils/api";

const API_URL =
  `${apiBase()}/api`;

export default function Capitalization() {
  const [records, setRecords] = useState([]);
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

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    capitalizationDate: "",
    acquisitionCost: "",
    additionalCost: "",
    capitalizedAmount: "",
    usefulLife: "",
    residualValue: "",
    capitalizationType: "initial",
    accountCode: "",
    projectCode: "",
    department: "",
    status: "capitalized",
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
          `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  const toArray = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.records)) return data.records;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.assets)) return data.assets;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const number = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  };

  const getId = (item) =>
    item?.id ??
    item?.capitalization_id ??
    item?.capitalizationId ??
    "";

  const getAssetId = (item) =>
    item?.asset_id ??
    item?.assetId ??
    item?.asset?.id ??
    "";

  const getName = (item) =>
    item?.asset_name ??
    item?.assetName ??
    item?.asset?.name ??
    item?.name ??
    item?.description ??
    "Unnamed Asset";

  const getCode = (item) =>
    item?.asset_code ??
    item?.assetCode ??
    item?.asset?.asset_code ??
    item?.asset?.assetCode ??
    item?.code ??
    item?.tag_number ??
    item?.tagNumber ??
    "—";

  const getDepartment = (item) => {
    if (
      typeof item?.department === "object" &&
      item.department
    ) {
      return (
        item.department.name ||
        item.department.department_name ||
        "—"
      );
    }

    return (
      item?.department_name ??
      item?.departmentName ??
      item?.department ??
      "—"
    );
  };

  const getCategory = (item) => {
    if (
      typeof item?.category === "object" &&
      item.category
    ) {
      return (
        item.category.name ||
        item.category.category_name ||
        "—"
      );
    }

    return (
      item?.category_name ??
      item?.categoryName ??
      item?.category ??
      "—"
    );
  };

  const getStatus = (item) =>
    String(
      item?.capitalization_status ??
        item?.capitalizationStatus ??
        item?.status ??
        "capitalized"
    ).toLowerCase();

  const getCost = (item) =>
    number(
      item?.acquisition_cost,
      item?.acquisitionCost,
      item?.purchase_cost,
      item?.purchaseCost,
      item?.original_cost,
      item?.originalCost,
      item?.cost
    );

  const getAdditionalCost = (item) =>
    number(
      item?.additional_cost,
      item?.additionalCost,
      item?.capital_additions,
      item?.capitalAdditions
    );

  const getCapitalizedAmount = (item) => {
    const explicit = number(
      item?.capitalized_amount,
      item?.capitalizedAmount,
      item?.capitalization_amount,
      item?.capitalizationAmount
    );

    if (explicit > 0) {
      return explicit;
    }

    return getCost(item) + getAdditionalCost(item);
  };

  const getDate = (item) =>
    item?.capitalization_date ??
    item?.capitalizationDate ??
    item?.acquisition_date ??
    item?.acquisitionDate ??
    "";

  const getUsefulLife = (item) =>
    number(
      item?.useful_life,
      item?.usefulLife,
      item?.useful_life_years,
      item?.usefulLifeYears
    );

  const getResidualValue = (item) =>
    number(
      item?.residual_value,
      item?.residualValue
    );

  const getType = (item) =>
    item?.capitalization_type ??
    item?.capitalizationType ??
    "initial";

  const getAccountCode = (item) =>
    item?.account_code ??
    item?.accountCode ??
    "—";

  const getProjectCode = (item) =>
    item?.project_code ??
    item?.projectCode ??
    "—";

  const formatMoney = (value) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString();
  };

  const typeLabel = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const labels = {
      initial: "Initial Capitalization",
      addition: "Capital Addition",
      improvement: "Improvement",
      upgrade: "Upgrade",
      transfer: "Capital Transfer",
    };

    return labels[normalized] || value || "Initial";
  };

  const statusLabel = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const labels = {
      capitalized: "Capitalized",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      inactive: "Inactive",
    };

    return labels[normalized] || value || "Capitalized";
  };

  const statusBadge = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    let background = "#eff6ff";
    let color = "#1d4ed8";

    if (normalized === "approved") {
      background = "#ecfdf5";
      color = "#047857";
    }

    if (normalized === "pending") {
      background = "#fffbeb";
      color = "#b45309";
    }

    if (normalized === "rejected") {
      background = "#fef2f2";
      color = "#b91c1c";
    }

    if (normalized === "inactive") {
      background = "#f1f5f9";
      color = "#475569";
    }

    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      background,
      color,
      fontSize: "11px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    };
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        request(`${API_URL}/finance/capitalization`),
        request(`${API_URL}/assets`),
        request(`${API_URL}/departments`),
        request(`${API_URL}/categories`),
      ]);

      if (results[0].status === "fulfilled") {
        setRecords(toArray(results[0].value));
      } else {
        throw results[0].reason;
      }

      if (results[1].status === "fulfilled") {
        setAssets(toArray(results[1].value));
      }

      if (results[2].status === "fulfilled") {
        setDepartments(toArray(results[2].value));
      }

      if (results[3].status === "fulfilled") {
        setCategories(toArray(results[3].value));
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load capitalization records."
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

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    return records.filter((record) => {
      const searchable = [
        getName(record),
        getCode(record),
        getDepartment(record),
        getCategory(record),
        getAccountCode(record),
        getProjectCode(record),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !q || searchable.includes(q);

      const matchesDepartment =
        !department ||
        String(getDepartment(record))
          .toLowerCase()
          .trim() ===
          department.toLowerCase().trim();

      const matchesCategory =
        !category ||
        String(getCategory(record))
          .toLowerCase()
          .trim() ===
          category.toLowerCase().trim();

      const matchesStatus =
        !status ||
        getStatus(record) === status.toLowerCase();

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [
    records,
    search,
    department,
    category,
    status,
  ]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (result, record) => {
        result.assets += 1;
        result.cost += getCost(record);
        result.additional += getAdditionalCost(record);
        result.capitalized += getCapitalizedAmount(record);

        return result;
      },
      {
        assets: 0,
        cost: 0,
        additional: 0,
        capitalized: 0,
      }
    );
  }, [filteredRecords]);

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setCategory("");
    setStatus("");
  };

  const resetForm = () => {
    setForm({
      assetId: "",
      capitalizationDate: new Date()
        .toISOString()
        .slice(0, 10),
      acquisitionCost: "",
      additionalCost: "",
      capitalizedAmount: "",
      usefulLife: "",
      residualValue: "",
      capitalizationType: "initial",
      accountCode: "",
      projectCode: "",
      department: "",
      status: "capitalized",
      notes: "",
    });
  };

  const openCreate = () => {
    setEditing(false);
    setSelectedRecord(null);
    resetForm();
    setShowForm(true);
    setError("");
  };

  const openEdit = (record) => {
    setEditing(true);
    setSelectedRecord(record);

    setForm({
      assetId: getAssetId(record),
      capitalizationDate: getDate(record)
        ? String(getDate(record)).slice(0, 10)
        : "",
      acquisitionCost:
        getCost(record) || "",
      additionalCost:
        getAdditionalCost(record) || "",
      capitalizedAmount:
        getCapitalizedAmount(record) || "",
      usefulLife:
        getUsefulLife(record) || "",
      residualValue:
        getResidualValue(record) || "",
      capitalizationType:
        getType(record),
      accountCode:
        getAccountCode(record) === "—"
          ? ""
          : getAccountCode(record),
      projectCode:
        getProjectCode(record) === "—"
          ? ""
          : getProjectCode(record),
      department:
        getDepartment(record) === "—"
          ? ""
          : getDepartment(record),
      status: getStatus(record),
      notes:
        record?.notes ??
        record?.capitalization_notes ??
        record?.capitalizationNotes ??
        "",
    });

    setShowForm(true);
    setError("");
  };

  const calculateAmount = () => {
    const acquisition =
      Number(form.acquisitionCost) || 0;

    const additional =
      Number(form.additionalCost) || 0;

    const amount = acquisition + additional;

    setForm((previous) => ({
      ...previous,
      capitalizedAmount: amount.toFixed(2),
    }));

    setSuccess(
      `Capitalized amount calculated: ${formatMoney(
        amount
      )} ETB`
    );
  };

  const saveRecord = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    const acquisition =
      Number(form.acquisitionCost) || 0;

    const additional =
      Number(form.additionalCost) || 0;

    const capitalized =
      Number(form.capitalizedAmount) ||
      acquisition + additional;

    if (!form.assetId) {
      setError("Please select an asset.");
      setSaving(false);
      return;
    }

    if (capitalized <= 0) {
      setError(
        "Capitalized amount must be greater than zero."
      );
      setSaving(false);
      return;
    }

    const payload = {
      assetId: form.assetId,
      capitalizationDate:
        form.capitalizationDate || null,
      acquisitionCost: acquisition,
      additionalCost: additional,
      capitalizedAmount: capitalized,
      usefulLife:
        Number(form.usefulLife) || null,
      residualValue:
        Number(form.residualValue) || 0,
      capitalizationType:
        form.capitalizationType,
      accountCode:
        form.accountCode || null,
      projectCode:
        form.projectCode || null,
      department:
        form.department || null,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      if (editing && selectedRecord) {
        await request(
          `${API_URL}/finance/capitalization/${getId(
            selectedRecord
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        setSuccess(
          "Capitalization record updated successfully."
        );
      } else {
        await request(
          `${API_URL}/finance/capitalization`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setSuccess(
          "Capitalization record created successfully."
        );
      }

      setShowForm(false);
      setSelectedRecord(null);

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save capitalization record."
      );
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (!filteredRecords.length) {
      setError(
        "No capitalization records to export."
      );
      return;
    }

    const header = [
      "Asset Code",
      "Asset Name",
      "Department",
      "Category",
      "Capitalization Date",
      "Capitalization Type",
      "Acquisition Cost",
      "Additional Cost",
      "Capitalized Amount",
      "Useful Life",
      "Residual Value",
      "Account Code",
      "Project Code",
      "Status",
    ];

    const rows = filteredRecords.map((record) => [
      getCode(record),
      getName(record),
      getDepartment(record),
      getCategory(record),
      formatDate(getDate(record)),
      typeLabel(getType(record)),
      getCost(record),
      getAdditionalCost(record),
      getCapitalizedAmount(record),
      getUsefulLife(record),
      getResidualValue(record),
      getAccountCode(record),
      getProjectCode(record),
      statusLabel(getStatus(record)),
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
    link.download = `capitalization-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const assetOptions =
    assets.length > 0 ? assets : [];

  return (
    <div className="capitalization-page">
      <style>{styles}</style>

      <div className="page-header">
        <div>
          <div className="eyebrow">
            FINANCE / ASSET FINANCE
          </div>

          <h1>Asset Capitalization</h1>

          <p>
            Record and manage capitalized university
            assets, additions, improvements and
            capitalization values.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="btn btn-export"
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Add Capitalization
          </button>
        </div>
      </div>

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

      <div className="summary-grid">
        <Summary
          icon={<Package size={21} />}
          title="Capitalized Assets"
          value={totals.assets}
          subtitle="Records in current view"
        />

        <Summary
          icon={<DollarSign size={21} />}
          title="Acquisition Cost"
          value={`${formatMoney(totals.cost)} ETB`}
          subtitle="Original acquisition"
        />

        <Summary
          icon={<Building2 size={21} />}
          title="Capital Additions"
          value={`${formatMoney(
            totals.additional
          )} ETB`}
          subtitle="Additional capital cost"
        />

        <Summary
          icon={<Calculator size={21} />}
          title="Capitalized Value"
          value={`${formatMoney(
            totals.capitalized
          )} ETB`}
          subtitle="Total capitalized amount"
        />
      </div>

      <div className="filter-card">
        <div className="filters">
          <div>
            <label>Search</label>

            <div className="search-box">
              <Search size={17} />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search asset, code, account..."
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
                value: "capitalized",
                label: "Capitalized",
              },
              {
                value: "pending",
                label: "Pending",
              },
              {
                value: "approved",
                label: "Approved",
              },
              {
                value: "rejected",
                label: "Rejected",
              },
              {
                value: "inactive",
                label: "Inactive",
              },
            ]}
          />

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-secondary clear-btn"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div>
            <h2>Capitalization Records</h2>

            <span>
              {filteredRecords.length} record
              {filteredRecords.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : filteredRecords.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <Th>Asset</Th>
                  <Th>Department</Th>
                  <Th>Category</Th>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th align="right">
                    Acquisition
                  </Th>
                  <Th align="right">
                    Additions
                  </Th>
                  <Th align="right">
                    Capitalized
                  </Th>
                  <Th>Status</Th>
                  <Th align="center">
                    Actions
                  </Th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={
                      getId(record) ||
                      `${getCode(record)}-${getDate(
                        record
                      )}`
                    }
                  >
                    <td className="asset-cell">
                      <strong>
                        {getName(record)}
                      </strong>

                      <span>
                        {getCode(record)}
                      </span>
                    </td>

                    <td>
                      {getDepartment(record)}
                    </td>

                    <td>
                      {getCategory(record)}
                    </td>

                    <td>
                      {formatDate(
                        getDate(record)
                      )}
                    </td>

                    <td>
                      {typeLabel(
                        getType(record)
                      )}
                    </td>

                    <td className="money">
                      {formatMoney(
                        getCost(record)
                      )}{" "}
                      ETB
                    </td>

                    <td className="money">
                      {formatMoney(
                        getAdditionalCost(record)
                      )}{" "}
                      ETB
                    </td>

                    <td className="money strong-money">
                      {formatMoney(
                        getCapitalizedAmount(
                          record
                        )
                      )}{" "}
                      ETB
                    </td>

                    <td>
                      <span
                        style={statusBadge(
                          getStatus(record)
                        )}
                      >
                        {statusLabel(
                          getStatus(record)
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="action-buttons">
                        <IconButton
                          title="View"
                          onClick={() => {
                            setSelectedRecord(
                              record
                            );
                            setShowDetails(true);
                          }}
                        >
                          <Eye size={16} />
                        </IconButton>

                        <IconButton
                          title="Edit"
                          onClick={() =>
                            openEdit(record)
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

      {showDetails && selectedRecord && (
        <Modal
          title="Capitalization Details"
          onClose={() => {
            setShowDetails(false);
            setSelectedRecord(null);
          }}
        >
          <div className="details-grid">
            <Detail
              label="Asset Name"
              value={getName(selectedRecord)}
            />

            <Detail
              label="Asset Code"
              value={getCode(selectedRecord)}
            />

            <Detail
              label="Department"
              value={getDepartment(
                selectedRecord
              )}
            />

            <Detail
              label="Category"
              value={getCategory(
                selectedRecord
              )}
            />

            <Detail
              label="Capitalization Date"
              value={formatDate(
                getDate(selectedRecord)
              )}
            />

            <Detail
              label="Capitalization Type"
              value={typeLabel(
                getType(selectedRecord)
              )}
            />

            <Detail
              label="Acquisition Cost"
              value={`${formatMoney(
                getCost(selectedRecord)
              )} ETB`}
            />

            <Detail
              label="Additional Cost"
              value={`${formatMoney(
                getAdditionalCost(
                  selectedRecord
                )
              )} ETB`}
            />

            <Detail
              label="Capitalized Amount"
              value={`${formatMoney(
                getCapitalizedAmount(
                  selectedRecord
                )
              )} ETB`}
            />

            <Detail
              label="Residual Value"
              value={`${formatMoney(
                getResidualValue(
                  selectedRecord
                )
              )} ETB`}
            />

            <Detail
              label="Useful Life"
              value={
                getUsefulLife(selectedRecord)
                  ? `${getUsefulLife(
                      selectedRecord
                    )} years`
                  : "—"
              }
            />

            <Detail
              label="Account Code"
              value={getAccountCode(
                selectedRecord
              )}
            />

            <Detail
              label="Project Code"
              value={getProjectCode(
                selectedRecord
              )}
            />

            <Detail
              label="Status"
              value={statusLabel(
                getStatus(selectedRecord)
              )}
            />

            <Detail
              label="Notes"
              value={
                selectedRecord?.notes ??
                selectedRecord?.capitalization_notes ??
                selectedRecord?.capitalizationNotes ??
                "—"
              }
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => {
                setShowDetails(false);
                openEdit(selectedRecord);
              }}
              className="btn btn-primary"
            >
              <Edit3 size={16} />
              Edit Record
            </button>
          </div>
        </Modal>
      )}

      {showForm && (
        <Modal
          title={
            editing
              ? "Update Capitalization"
              : "Add Capitalization"
          }
          onClose={() => {
            if (!saving) {
              setShowForm(false);
              setSelectedRecord(null);
            }
          }}
        >
          <form onSubmit={saveRecord}>
            <div className="form-grid">
              <div>
                <label>Asset *</label>

                <select
                  required
                  value={form.assetId}
                  onChange={(e) => {
                    const selected =
                      assetOptions.find(
                        (asset) =>
                          String(
                            getId(asset)
                          ) ===
                          String(
                            e.target.value
                          )
                      );

                    setForm((previous) => ({
                      ...previous,
                      assetId:
                        e.target.value,
                      acquisitionCost:
                        selected &&
                        getCost(selected)
                          ? getCost(
                              selected
                            )
                          : previous.acquisitionCost,
                      department:
                        selected
                          ? getDepartment(
                              selected
                            )
                          : previous.department,
                    }));
                  }}
                >
                  <option value="">
                    Select asset
                  </option>

                  {assetOptions.map(
                    (asset) => (
                      <option
                        key={getId(asset)}
                        value={getId(asset)}
                      >
                        {getCode(asset)} —{" "}
                        {getName(asset)}
                      </option>
                    )
                  )}
                </select>
              </div>

              <FormInput
                label="Capitalization Date"
                type="date"
                required
                value={
                  form.capitalizationDate
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    capitalizationDate:
                      value,
                  })
                }
              />

              <FormInput
                label="Acquisition Cost"
                type="number"
                min="0"
                step="0.01"
                value={
                  form.acquisitionCost
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    acquisitionCost:
                      value,
                  })
                }
              />

              <FormInput
                label="Additional Cost"
                type="number"
                min="0"
                step="0.01"
                value={
                  form.additionalCost
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    additionalCost:
                      value,
                  })
                }
              />

              <FormInput
                label="Capitalized Amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={
                  form.capitalizedAmount
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    capitalizedAmount:
                      value,
                  })
                }
              />

              <FormInput
                label="Useful Life (Years)"
                type="number"
                min="0"
                step="1"
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
                value={
                  form.residualValue
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    residualValue: value,
                  })
                }
              />

              <div>
                <label>
                  Capitalization Type
                </label>

                <select
                  value={
                    form.capitalizationType
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      capitalizationType:
                        e.target.value,
                    })
                  }
                >
                  <option value="initial">
                    Initial Capitalization
                  </option>

                  <option value="addition">
                    Capital Addition
                  </option>

                  <option value="improvement">
                    Improvement
                  </option>

                  <option value="upgrade">
                    Upgrade
                  </option>

                  <option value="transfer">
                    Capital Transfer
                  </option>
                </select>
              </div>

              <FormInput
                label="Account Code"
                type="text"
                value={form.accountCode}
                onChange={(value) =>
                  setForm({
                    ...form,
                    accountCode: value,
                  })
                }
              />

              <FormInput
                label="Project Code"
                type="text"
                value={form.projectCode}
                onChange={(value) =>
                  setForm({
                    ...form,
                    projectCode: value,
                  })
                }
              />

              <div>
                <label>Department</label>

                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      department:
                        e.target.value,
                    })
                  }
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (item) => {
                      const value =
                        item.name ??
                        item.department_name ??
                        item.id;

                      return (
                        <option
                          key={
                            item.id ?? value
                          }
                          value={value}
                        >
                          {value}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>

              <div>
                <label>Status</label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status:
                        e.target.value,
                    })
                  }
                >
                  <option value="capitalized">
                    Capitalized
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  <option value="approved">
                    Approved
                  </option>

                  <option value="rejected">
                    Rejected
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={calculateAmount}
              className="btn btn-secondary calculate-btn"
            >
              <Calculator size={16} />
              Calculate Capitalized Amount
            </button>

            <div className="notes-field">
              <label>Notes</label>

              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                placeholder="Capitalization notes..."
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowForm(false);
                  setSelectedRecord(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    {editing
                      ? "Update Record"
                      : "Save Record"}
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Summary({
  icon,
  title,
  value,
  subtitle,
}) {
  return (
    <div className="summary-card">
      <div className="summary-icon">
        {icon}
      </div>

      <div className="summary-title">
        {title}
      </div>

      <div className="summary-value">
        {value}
      </div>

      <div className="summary-subtitle">
        {subtitle}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label>{label}</label>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        <option value="">All</option>

        {options.map((option) => (
          <option
            key={String(option.value)}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormInput({
  label,
  type,
  required = false,
  value,
  onChange,
  min,
  step,
}) {
  return (
    <div>
      <label>
        {label}
        {required ? " *" : ""}
      </label>

      <input
        type={type}
        required={required}
        min={min}
        step={step}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      />
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="modal-close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div className="detail-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function Alert({
  type,
  message,
  onClose,
}) {
  const isError = type === "error";

  return (
    <div
      className={
        isError
          ? "alert alert-error"
          : "alert alert-success"
      }
    >
      {isError ? (
        <AlertCircle size={18} />
      ) : (
        <CheckCircle size={18} />
      )}

      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="state-box">
      <Loader2 size={32} className="spin" />

      <p>
        Loading capitalization records...
      </p>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="state-box">
      <Package size={42} />

      <h3>No capitalization records</h3>

      <p>
        No records match the current filters.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="btn btn-primary"
      >
        <Plus size={16} />
        Add Capitalization
      </button>
    </div>
  );
}

function Th({
  children,
  align = "left",
}) {
  return (
    <th style={{ textAlign: align }}>
      {children}
    </th>
  );
}

function IconButton({
  children,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="icon-button"
    >
      {children}
    </button>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .capitalization-page {
    min-height: 100vh;
    background: #f6f8fb;
    color: #0f172a;
    padding: 24px;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .page-header {
    background: #ffffff;
    border: 1px solid #e5eaf1;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
  }

  .eyebrow {
    color: #0ea5e9;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    margin-bottom: 7px;
  }

  .page-header h1 {
    margin: 0;
    font-size: 27px;
    line-height: 1.2;
    font-weight: 750;
  }

  .page-header p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .btn {
    min-height: 40px;
    border-radius: 8px;
    padding: 9px 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: .18s ease;
  }

  .btn:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }

  .btn-secondary {
    background: #fff;
    color: #334155;
    border-color: #dbe3ef;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }

  .btn-export {
    background: #0ea5e9;
    color: #fff;
    border-color: #0ea5e9;
  }

  .btn-export:hover {
    background: #0284c7;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .summary-card {
    background: #fff;
    border: 1px solid #e5eaf1;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
  }

  .summary-icon {
    width: 40px;
    height: 40px;
    border-radius: 9px;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .summary-title {
    color: #64748b;
    font-size: 13px;
  }

  .summary-value {
    color: #0f172a;
    font-size: 21px;
    font-weight: 750;
    margin-top: 4px;
    overflow-wrap: anywhere;
  }

  .summary-subtitle {
    color: #94a3b8;
    font-size: 12px;
    margin-top: 4px;
  }

  .filter-card,
  .table-card {
    background: #fff;
    border: 1px solid #e5eaf1;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, .035);
  }

  .filter-card {
    padding: 18px;
    margin-bottom: 20px;
  }

  .filters {
    display: grid;
    grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(150px, 1fr)) auto;
    gap: 12px;
    align-items: end;
  }

  label {
    display: block;
    margin-bottom: 6px;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-size: 14px;
    outline: none;
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  input,
  select {
    height: 40px;
    padding: 0 12px;
  }

  textarea {
    padding: 10px 12px;
    resize: vertical;
    min-height: 100px;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, .10);
  }

  .search-box {
    position: relative;
  }

  .search-box svg {
    position: absolute;
    left: 11px;
    top: 11px;
    color: #94a3b8;
    pointer-events: none;
  }

  .search-box input {
    padding-left: 36px;
  }

  .clear-btn {
    height: 40px;
  }

  .table-card {
    overflow: hidden;
  }

  .table-header {
    padding: 17px 20px;
    border-bottom: 1px solid #e5eaf1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-header h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 750;
  }

  .table-header span {
    color: #64748b;
    font-size: 12px;
    display: block;
    margin-top: 3px;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 1250px;
    border-collapse: collapse;
  }

  th {
    padding: 12px 14px;
    background: #f8fafc;
    color: #475569;
    font-size: 12px;
    font-weight: 750;
    white-space: nowrap;
  }

  td {
    padding: 13px 14px;
    border-top: 1px solid #edf1f5;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
    white-space: nowrap;
  }

  tbody tr:hover {
    background: #fbfdff;
  }

  .asset-cell {
    white-space: normal;
    min-width: 220px;
  }

  .asset-cell strong {
    display: block;
    color: #0f172a;
    font-size: 13px;
    margin-bottom: 3px;
  }

  .asset-cell span {
    color: #64748b;
    font-size: 12px;
  }

  .money {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .strong-money {
    color: #0f172a;
    font-weight: 750;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    border: 1px solid #dbe3ef;
    border-radius: 7px;
    background: #fff;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon-button:hover {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
  }

  .alert {
    margin-bottom: 16px;
    padding: 13px 16px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
  }

  .alert span {
    flex: 1;
  }

  .alert button {
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    display: flex;
  }

  .alert-error {
    border: 1px solid #fecaca;
    background: #fff7f7;
    color: #b91c1c;
  }

  .alert-success {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #15803d;
  }

  .state-box {
    min-height: 300px;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    text-align: center;
  }

  .state-box h3 {
    color: #334155;
    margin: 12px 0 5px;
  }

  .state-box p {
    margin: 0 0 16px;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, .58);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal {
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 25px 60px rgba(15, 23, 42, .25);
  }

  .modal-header {
    padding: 18px 20px;
    border-bottom: 1px solid #e5eaf1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 2;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
  }

  .modal-close {
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    display: flex;
  }

  .modal-content {
    padding: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .calculate-btn {
    margin-top: 16px;
  }

  .notes-field {
    margin-top: 16px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  .details-grid {
    display: flex;
    flex-direction: column;
  }

  .detail-row {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 15px;
    padding: 11px 0;
    border-bottom: 1px solid #eef2f7;
  }

  .detail-row strong {
    color: #64748b;
    font-size: 13px;
  }

  .detail-row span {
    color: #0f172a;
    font-size: 14px;
    overflow-wrap: anywhere;
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

  @media (max-width: 1100px) {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .clear-btn {
      width: 100%;
    }
  }

  @media (max-width: 700px) {
    .capitalization-page {
      padding: 14px;
    }

    .summary-grid,
    .filters,
    .form-grid {
      grid-template-columns: 1fr;
    }

    .page-header {
      padding: 18px;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions .btn {
      flex: 1;
    }

    .modal-overlay {
      padding: 10px;
    }

    .modal {
      max-height: 95vh;
    }

    .detail-row {
      grid-template-columns: 1fr;
      gap: 5px;
    }
  }
`;