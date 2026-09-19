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
  Trash2,
  FileText,
} from "lucide-react";
import { apiBase } from "../../utils/api";

const API_URL =
  `${apiBase()}/api`;

export default function DisposalFinancialRecords() {
  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    disposalDate: "",
    disposalMethod: "sale",
    originalCost: "",
    accumulatedDepreciation: "",
    netBookValue: "",
    disposalProceeds: "",
    disposalCost: "",
    gainLoss: "",
    department: "",
    referenceNumber: "",
    buyer: "",
    approvalNumber: "",
    status: "pending",
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
    item?.disposal_id ??
    item?.disposalId ??
    item?.financial_record_id ??
    item?.financialRecordId ??
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
    item?.asset?.asset_name ??
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
      item?.asset?.department_name ??
      item?.department ??
      "—"
    );
  };

  const getDate = (item) =>
    item?.disposal_date ??
    item?.disposalDate ??
    "";

  const getMethod = (item) =>
    item?.disposal_method ??
    item?.disposalMethod ??
    item?.method ??
    "sale";

  const getOriginalCost = (item) =>
    number(
      item?.original_cost,
      item?.originalCost,
      item?.acquisition_cost,
      item?.acquisitionCost,
      item?.asset?.acquisition_cost,
      item?.asset?.acquisitionCost,
      item?.cost
    );

  const getAccumulatedDepreciation = (item) =>
    number(
      item?.accumulated_depreciation,
      item?.accumulatedDepreciation,
      item?.depreciation_amount,
      item?.depreciationAmount
    );

  const getNetBookValue = (item) => {
    const explicit = number(
      item?.net_book_value,
      item?.netBookValue,
      item?.book_value,
      item?.bookValue
    );

    if (explicit > 0) return explicit;

    return Math.max(
      0,
      getOriginalCost(item) -
        getAccumulatedDepreciation(item)
    );
  };

  const getProceeds = (item) =>
    number(
      item?.disposal_proceeds,
      item?.disposalProceeds,
      item?.proceeds,
      item?.sale_proceeds,
      item?.saleProceeds
    );

  const getDisposalCost = (item) =>
    number(
      item?.disposal_cost,
      item?.disposalCost,
      item?.disposal_expense,
      item?.disposalExpense,
      item?.expenses
    );

  const getGainLoss = (item) => {
    const explicit = number(
      item?.gain_loss,
      item?.gainLoss,
      item?.gain_or_loss,
      item?.gainOrLoss
    );

    if (
      item?.gain_loss !== undefined ||
      item?.gainLoss !== undefined ||
      item?.gain_or_loss !== undefined ||
      item?.gainOrLoss !== undefined
    ) {
      return explicit;
    }

    return (
      getProceeds(item) -
      getNetBookValue(item) -
      getDisposalCost(item)
    );
  };

  const getReference = (item) =>
    item?.reference_number ??
    item?.referenceNumber ??
    item?.disposal_reference ??
    item?.disposalReference ??
    "—";

  const getBuyer = (item) =>
    item?.buyer ??
    item?.buyer_name ??
    item?.buyerName ??
    "";

  const getApprovalNumber = (item) =>
    item?.approval_number ??
    item?.approvalNumber ??
    "";

  const getStatus = (item) =>
    String(
      item?.status ??
        item?.disposal_status ??
        item?.disposalStatus ??
        "pending"
    ).toLowerCase();

  const getNotes = (item) =>
    item?.notes ??
    item?.disposal_notes ??
    item?.disposalNotes ??
    "";

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

  const methodLabel = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const labels = {
      sale: "Sale",
      auction: "Auction",
      donation: "Donation",
      transfer: "Transfer",
      destruction: "Destruction",
      write_off: "Write-Off",
      writeoff: "Write-Off",
      scrap: "Scrap",
      trade_in: "Trade-In",
      other: "Other",
    };

    return labels[normalized] || value || "Sale";
  };

  const statusLabel = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const labels = {
      pending: "Pending",
      approved: "Approved",
      completed: "Completed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };

    return labels[normalized] || value || "Pending";
  };

  const gainLossLabel = (value) => {
    if (value > 0) return "Gain";
    if (value < 0) return "Loss";
    return "No Gain/Loss";
  };

  const statusBadge = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    let background = "#fffbeb";
    let color = "#b45309";

    if (
      normalized === "approved" ||
      normalized === "completed"
    ) {
      background = "#ecfdf5";
      color = "#047857";
    }

    if (
      normalized === "rejected" ||
      normalized === "cancelled"
    ) {
      background = "#fef2f2";
      color = "#b91c1c";
    }

    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 9px",
      borderRadius: "999px",
      background,
      color,
      fontSize: "11px",
      fontWeight: 700,
    };
  };

  const gainLossBadge = (value) => {
    if (value > 0) {
      return {
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: "999px",
        background: "#ecfdf5",
        color: "#047857",
        fontSize: "11px",
        fontWeight: 700,
      };
    }

    if (value < 0) {
      return {
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: "999px",
        background: "#fef2f2",
        color: "#b91c1c",
        fontSize: "11px",
        fontWeight: 700,
      };
    }

    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 9px",
      borderRadius: "999px",
      background: "#f1f5f9",
      color: "#475569",
      fontSize: "11px",
      fontWeight: 700,
    };
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await Promise.allSettled([
        request(`${API_URL}/finance/disposal-financial-records`),
        request(`${API_URL}/assets`),
        request(`${API_URL}/departments`),
      ]);

      if (result[0].status === "fulfilled") {
        setRecords(toArray(result[0].value));
      } else {
        throw result[0].reason;
      }

      if (result[1].status === "fulfilled") {
        setAssets(toArray(result[1].value));
      }

      if (result[2].status === "fulfilled") {
        setDepartments(toArray(result[2].value));
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load disposal financial records."
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

    const timer = setTimeout(
      () => setSuccess(""),
      4000
    );

    return () => clearTimeout(timer);
  }, [success]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    return records.filter((record) => {
      const searchable = [
        getName(record),
        getCode(record),
        getDepartment(record),
        methodLabel(getMethod(record)),
        getReference(record),
        getBuyer(record),
        getApprovalNumber(record),
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

      const matchesStatus =
        !status ||
        getStatus(record) === status.toLowerCase();

      const matchesMethod =
        !disposalMethod ||
        getMethod(record).toLowerCase() ===
          disposalMethod.toLowerCase();

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus &&
        matchesMethod
      );
    });
  }, [
    records,
    search,
    department,
    status,
    disposalMethod,
  ]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (result, record) => {
        result.records += 1;
        result.originalCost += getOriginalCost(record);
        result.accumulatedDepreciation +=
          getAccumulatedDepreciation(record);
        result.netBookValue +=
          getNetBookValue(record);
        result.proceeds += getProceeds(record);
        result.disposalCost +=
          getDisposalCost(record);
        result.gainLoss += getGainLoss(record);

        return result;
      },
      {
        records: 0,
        originalCost: 0,
        accumulatedDepreciation: 0,
        netBookValue: 0,
        proceeds: 0,
        disposalCost: 0,
        gainLoss: 0,
      }
    );
  }, [filteredRecords]);

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setStatus("");
    setDisposalMethod("");
  };

  const resetForm = () => {
    setForm({
      assetId: "",
      disposalDate: new Date()
        .toISOString()
        .slice(0, 10),
      disposalMethod: "sale",
      originalCost: "",
      accumulatedDepreciation: "",
      netBookValue: "",
      disposalProceeds: "",
      disposalCost: "",
      gainLoss: "",
      department: "",
      referenceNumber: "",
      buyer: "",
      approvalNumber: "",
      status: "pending",
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
      disposalDate: getDate(record)
        ? String(getDate(record)).slice(0, 10)
        : "",
      disposalMethod: getMethod(record),
      originalCost:
        getOriginalCost(record) || "",
      accumulatedDepreciation:
        getAccumulatedDepreciation(record) || "",
      netBookValue:
        getNetBookValue(record) || "",
      disposalProceeds:
        getProceeds(record) || "",
      disposalCost:
        getDisposalCost(record) || "",
      gainLoss: getGainLoss(record),
      department:
        getDepartment(record) === "—"
          ? ""
          : getDepartment(record),
      referenceNumber:
        getReference(record) === "—"
          ? ""
          : getReference(record),
      buyer: getBuyer(record),
      approvalNumber:
        getApprovalNumber(record),
      status: getStatus(record),
      notes: getNotes(record),
    });

    setShowForm(true);
    setError("");
  };

  const calculateValues = () => {
    const originalCost =
      Number(form.originalCost) || 0;

    const accumulated =
      Number(form.accumulatedDepreciation) || 0;

    const proceeds =
      Number(form.disposalProceeds) || 0;

    const disposalCost =
      Number(form.disposalCost) || 0;

    const netBookValue = Math.max(
      0,
      originalCost - accumulated
    );

    const gainLoss =
      proceeds - netBookValue - disposalCost;

    setForm((previous) => ({
      ...previous,
      netBookValue: netBookValue.toFixed(2),
      gainLoss: gainLoss.toFixed(2),
    }));

    setSuccess(
      `Calculated NBV: ${formatMoney(
        netBookValue
      )} ETB | ${gainLossLabel(gainLoss)}: ${formatMoney(
        Math.abs(gainLoss)
      )} ETB`
    );
  };

  const saveRecord = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    const originalCost =
      Number(form.originalCost) || 0;

    const accumulated =
      Number(form.accumulatedDepreciation) || 0;

    const proceeds =
      Number(form.disposalProceeds) || 0;

    const disposalCost =
      Number(form.disposalCost) || 0;

    const netBookValue = Math.max(
      0,
      originalCost - accumulated
    );

    const gainLoss =
      proceeds - netBookValue - disposalCost;

    if (!form.assetId) {
      setError("Please select an asset.");
      setSaving(false);
      return;
    }

    if (!form.disposalDate) {
      setError("Please select the disposal date.");
      setSaving(false);
      return;
    }

    const payload = {
      assetId: form.assetId,
      disposalDate: form.disposalDate,
      disposalMethod: form.disposalMethod,
      originalCost,
      accumulatedDepreciation: accumulated,
      netBookValue,
      disposalProceeds: proceeds,
      disposalCost,
      gainLoss,
      department: form.department || null,
      referenceNumber:
        form.referenceNumber || null,
      buyer: form.buyer || null,
      approvalNumber:
        form.approvalNumber || null,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      if (editing && selectedRecord) {
        await request(
          `${API_URL}/finance/disposal-financial-records/${getId(
            selectedRecord
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        setSuccess(
          "Disposal financial record updated successfully."
        );
      } else {
        await request(
          `${API_URL}/finance/disposal-financial-records`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setSuccess(
          "Disposal financial record created successfully."
        );
      }

      setShowForm(false);
      setSelectedRecord(null);
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save disposal financial record."
      );
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (!filteredRecords.length) {
      setError(
        "No disposal financial records to export."
      );
      return;
    }

    const header = [
      "Asset Code",
      "Asset Name",
      "Department",
      "Disposal Date",
      "Disposal Method",
      "Original Cost",
      "Accumulated Depreciation",
      "Net Book Value",
      "Disposal Proceeds",
      "Disposal Cost",
      "Gain/Loss",
      "Reference Number",
      "Buyer",
      "Approval Number",
      "Status",
    ];

    const rows = filteredRecords.map((record) => [
      getCode(record),
      getName(record),
      getDepartment(record),
      formatDate(getDate(record)),
      methodLabel(getMethod(record)),
      getOriginalCost(record),
      getAccumulatedDepreciation(record),
      getNetBookValue(record),
      getProceeds(record),
      getDisposalCost(record),
      getGainLoss(record),
      getReference(record),
      getBuyer(record),
      getApprovalNumber(record),
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
    link.download = `disposal-financial-records-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const assetOptions = assets.length
    ? assets
    : records;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "24px",
        color: "#0f172a",
      }}
    >
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .disposal-filters {
          display: grid;
          grid-template-columns:
            minmax(220px, 2fr)
            repeat(3, minmax(150px, 1fr))
            auto;
          gap: 12px;
        }

        .disposal-form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1000px) {
          .disposal-filters {
            grid-template-columns: 1fr 1fr;
          }

          .disposal-form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .disposal-filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
            Disposal Financial Records
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Manage financial records, book values,
            proceeds, expenses and gains or losses
            from disposed university assets.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
            flexWrap: "wrap",
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

          <button
            onClick={openCreate}
            style={primaryButton}
          >
            <Plus size={16} />
            Add Disposal Record
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
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <Summary
          icon={<Package size={21} />}
          title="Disposed Assets"
          value={totals.records}
          subtitle="records in current view"
        />

        <Summary
          icon={<DollarSign size={21} />}
          title="Original Cost"
          value={`${formatMoney(
            totals.originalCost
          )} ETB`}
          subtitle="original asset cost"
        />

        <Summary
          icon={<Calculator size={21} />}
          title="Net Book Value"
          value={`${formatMoney(
            totals.netBookValue
          )} ETB`}
          subtitle="book value at disposal"
        />

        <Summary
          icon={<DollarSign size={21} />}
          title="Disposal Proceeds"
          value={`${formatMoney(
            totals.proceeds
          )} ETB`}
          subtitle="amount recovered"
        />

        <Summary
          icon={<FileText size={21} />}
          title="Disposal Costs"
          value={`${formatMoney(
            totals.disposalCost
          )} ETB`}
          subtitle="disposal expenses"
        />

        <Summary
          icon={
            totals.gainLoss >= 0 ? (
              <CheckCircle size={21} />
            ) : (
              <AlertCircle size={21} />
            )
          }
          title={
            totals.gainLoss >= 0
              ? "Net Gain"
              : "Net Loss"
          }
          value={`${formatMoney(
            Math.abs(totals.gainLoss)
          )} ETB`}
          subtitle="current filtered records"
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
        <div className="disposal-filters">
          <div>
            <label style={labelStyle}>
              Search
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
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
                placeholder="Search asset, reference, buyer..."
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
            options={departments.map((item) => {
              const value =
                item.name ??
                item.department_name ??
                item.id;

              return {
                value,
                label:
                  item.name ??
                  item.department_name ??
                  `Department ${item.id}`,
              };
            })}
          />

          <Select
            label="Disposal Method"
            value={disposalMethod}
            onChange={setDisposalMethod}
            options={[
              {
                value: "sale",
                label: "Sale",
              },
              {
                value: "auction",
                label: "Auction",
              },
              {
                value: "donation",
                label: "Donation",
              },
              {
                value: "transfer",
                label: "Transfer",
              },
              {
                value: "destruction",
                label: "Destruction",
              },
              {
                value: "write_off",
                label: "Write-Off",
              },
              {
                value: "scrap",
                label: "Scrap",
              },
              {
                value: "trade_in",
                label: "Trade-In",
              },
              {
                value: "other",
                label: "Other",
              },
            ]}
          />

          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              {
                value: "pending",
                label: "Pending",
              },
              {
                value: "approved",
                label: "Approved",
              },
              {
                value: "completed",
                label: "Completed",
              },
              {
                value: "rejected",
                label: "Rejected",
              },
              {
                value: "cancelled",
                label: "Cancelled",
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
            borderBottom:
              "1px solid #e5eaf1",
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
              Disposal Financial Records
            </h2>

            <span
              style={{
                color: "#64748b",
                fontSize: "12px",
              }}
            >
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
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "1450px",
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
                  <Th>Date</Th>
                  <Th>Method</Th>
                  <Th align="right">
                    Original Cost
                  </Th>
                  <Th align="right">
                    Accum. Depreciation
                  </Th>
                  <Th align="right">
                    NBV
                  </Th>
                  <Th align="right">
                    Proceeds
                  </Th>
                  <Th align="right">
                    Disposal Cost
                  </Th>
                  <Th>Gain / Loss</Th>
                  <Th>Status</Th>
                  <Th align="center">
                    Actions
                  </Th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => {
                  const gainLoss =
                    getGainLoss(record);

                  return (
                    <tr
                      key={
                        getId(record) ||
                        `${getCode(record)}-${getDate(
                          record
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
                          {getName(record)}
                        </strong>

                        <span
                          style={{
                            color: "#64748b",
                            fontSize: "12px",
                          }}
                        >
                          {getCode(record)}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {getDepartment(record)}
                      </td>

                      <td style={tdStyle}>
                        {formatDate(
                          getDate(record)
                        )}
                      </td>

                      <td style={tdStyle}>
                        {methodLabel(
                          getMethod(record)
                        )}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                        }}
                      >
                        {formatMoney(
                          getOriginalCost(record)
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
                            record
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
                          getNetBookValue(record)
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
                          getProceeds(record)
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
                          getDisposalCost(record)
                        )}{" "}
                        ETB
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={gainLossBadge(
                            gainLoss
                          )}
                        >
                          {gainLossLabel(
                            gainLoss
                          )}{" "}
                          {formatMoney(
                            Math.abs(gainLoss)
                          )}{" "}
                          ETB
                        </span>
                      </td>

                      <td style={tdStyle}>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILS MODAL */}
      {showDetails && selectedRecord && (
        <Modal
          title="Disposal Financial Details"
          onClose={() => {
            setShowDetails(false);
            setSelectedRecord(null);
          }}
        >
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
            label="Disposal Date"
            value={formatDate(
              getDate(selectedRecord)
            )}
          />

          <Detail
            label="Disposal Method"
            value={methodLabel(
              getMethod(selectedRecord)
            )}
          />

          <Detail
            label="Original Cost"
            value={`${formatMoney(
              getOriginalCost(selectedRecord)
            )} ETB`}
          />

          <Detail
            label="Accumulated Depreciation"
            value={`${formatMoney(
              getAccumulatedDepreciation(
                selectedRecord
              )
            )} ETB`}
          />

          <Detail
            label="Net Book Value"
            value={`${formatMoney(
              getNetBookValue(selectedRecord)
            )} ETB`}
          />

          <Detail
            label="Disposal Proceeds"
            value={`${formatMoney(
              getProceeds(selectedRecord)
            )} ETB`}
          />

          <Detail
            label="Disposal Cost"
            value={`${formatMoney(
              getDisposalCost(selectedRecord)
            )} ETB`}
          />

          <Detail
            label="Gain / Loss"
            value={`${gainLossLabel(
              getGainLoss(selectedRecord)
            )}: ${formatMoney(
              Math.abs(
                getGainLoss(selectedRecord)
              )
            )} ETB`}
          />

          <Detail
            label="Reference Number"
            value={getReference(selectedRecord)}
          />

          <Detail
            label="Buyer"
            value={getBuyer(selectedRecord) || "—"}
          />

          <Detail
            label="Approval Number"
            value={
              getApprovalNumber(
                selectedRecord
              ) || "—"
            }
          />

          <Detail
            label="Status"
            value={statusLabel(
              getStatus(selectedRecord)
            )}
          />

          {getNotes(selectedRecord) && (
            <Detail
              label="Notes"
              value={getNotes(selectedRecord)}
            />
          )}

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
                openEdit(selectedRecord);
              }}
              style={primaryButton}
            >
              <Edit3 size={16} />
              Edit Record
            </button>
          </div>
        </Modal>
      )}

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <Modal
          title={
            editing
              ? "Update Disposal Financial Record"
              : "Add Disposal Financial Record"
          }
          onClose={() => {
            if (!saving) {
              setShowForm(false);
              setSelectedRecord(null);
            }
          }}
          wide
        >
          <form onSubmit={saveRecord}>
            <div className="disposal-form-grid">
              {/* ASSET */}
              <div>
                <label style={labelStyle}>
                  Asset *
                </label>

                <select
                  required
                  value={form.assetId}
                  onChange={(e) => {
                    const selected =
                      assetOptions.find(
                        (asset) =>
                          String(
                            getAssetId(asset) ||
                              getId(asset)
                          ) ===
                          String(e.target.value)
                      );

                    setForm((previous) => ({
                      ...previous,
                      assetId:
                        e.target.value,
                      originalCost:
                        selected &&
                        getOriginalCost(selected)
                          ? getOriginalCost(
                              selected
                            )
                          : previous.originalCost,
                      department:
                        selected &&
                        getDepartment(selected) !==
                          "—"
                          ? getDepartment(
                              selected
                            )
                          : previous.department,
                    }));
                  }}
                  style={inputStyle}
                >
                  <option value="">
                    Select asset
                  </option>

                  {assetOptions.map((asset) => {
                    const id =
                      getAssetId(asset) ||
                      getId(asset);

                    return (
                      <option
                        key={id}
                        value={id}
                      >
                        {getCode(asset)} —{" "}
                        {getName(asset)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <FormInput
                label="Disposal Date"
                type="date"
                required
                value={form.disposalDate}
                onChange={(value) =>
                  setForm({
                    ...form,
                    disposalDate: value,
                  })
                }
              />

              {/* METHOD */}
              <div>
                <label style={labelStyle}>
                  Disposal Method *
                </label>

                <select
                  required
                  value={form.disposalMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      disposalMethod:
                        e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="sale">
                    Sale
                  </option>
                  <option value="auction">
                    Auction
                  </option>
                  <option value="donation">
                    Donation
                  </option>
                  <option value="transfer">
                    Transfer
                  </option>
                  <option value="destruction">
                    Destruction
                  </option>
                  <option value="write_off">
                    Write-Off
                  </option>
                  <option value="scrap">
                    Scrap
                  </option>
                  <option value="trade_in">
                    Trade-In
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <FormInput
                label="Original Cost"
                type="number"
                min="0"
                step="0.01"
                value={form.originalCost}
                onChange={(value) =>
                  setForm({
                    ...form,
                    originalCost: value,
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
                label="Net Book Value"
                type="number"
                min="0"
                step="0.01"
                value={form.netBookValue}
                onChange={(value) =>
                  setForm({
                    ...form,
                    netBookValue: value,
                  })
                }
              />

              <FormInput
                label="Disposal Proceeds"
                type="number"
                min="0"
                step="0.01"
                value={form.disposalProceeds}
                onChange={(value) =>
                  setForm({
                    ...form,
                    disposalProceeds: value,
                  })
                }
              />

              <FormInput
                label="Disposal Cost"
                type="number"
                min="0"
                step="0.01"
                value={form.disposalCost}
                onChange={(value) =>
                  setForm({
                    ...form,
                    disposalCost: value,
                  })
                }
              />

              <FormInput
                label="Gain / Loss"
                type="number"
                step="0.01"
                value={form.gainLoss}
                onChange={(value) =>
                  setForm({
                    ...form,
                    gainLoss: value,
                  })
                }
              />

              {/* DEPARTMENT */}
              <div>
                <label style={labelStyle}>
                  Department
                </label>

                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      department:
                        e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map((item) => {
                    const value =
                      item.name ??
                      item.department_name ??
                      item.id;

                    return (
                      <option
                        key={item.id ?? value}
                        value={value}
                      >
                        {value}
                      </option>
                    );
                  })}
                </select>
              </div>

              <FormInput
                label="Reference Number"
                type="text"
                value={form.referenceNumber}
                onChange={(value) =>
                  setForm({
                    ...form,
                    referenceNumber: value,
                  })
                }
              />

              <FormInput
                label="Buyer / Recipient"
                type="text"
                value={form.buyer}
                onChange={(value) =>
                  setForm({
                    ...form,
                    buyer: value,
                  })
                }
              />

              <FormInput
                label="Approval Number"
                type="text"
                value={form.approvalNumber}
                onChange={(value) =>
                  setForm({
                    ...form,
                    approvalNumber: value,
                  })
                }
              />

              {/* STATUS */}
              <div>
                <label style={labelStyle}>
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="pending">
                    Pending
                  </option>

                  <option value="approved">
                    Approved
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="rejected">
                    Rejected
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </div>
            </div>

            {/* CALCULATE */}
            <button
              type="button"
              onClick={calculateValues}
              style={{
                ...secondaryButton,
                marginTop: "16px",
              }}
            >
              <Calculator size={16} />
              Calculate NBV & Gain/Loss
            </button>

            {/* NOTES */}
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
                placeholder="Disposal financial notes..."
                style={{
                  ...inputStyle,
                  height: "auto",
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
            </div>

            {/* FORM ACTIONS */}
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
                disabled={saving}
                onClick={() => {
                  setShowForm(false);
                  setSelectedRecord(null);
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

/* =========================================================
   SUMMARY CARD
========================================================= */

function Summary({
  icon,
  title,
  value,
  subtitle,
}) {
  return (
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
}

/* =========================================================
   SELECT
========================================================= */

function Select({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        style={inputStyle}
      >
        <option value="">
          All
        </option>

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
}

/* =========================================================
   FORM INPUT
========================================================= */

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
      <label style={labelStyle}>
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
        style={inputStyle}
      />
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function Modal({
  title,
  children,
  onClose,
  wide = false,
}) {
  return (
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
          maxWidth: wide ? "900px" : "760px",
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
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 2,
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
            type="button"
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
}

/* =========================================================
   DETAIL
========================================================= */

function Detail({
  label,
  value,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "210px 1fr",
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
}

/* =========================================================
   ALERT
========================================================= */

function Alert({
  type,
  message,
  onClose,
}) {
  const isError = type === "error";

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "13px 16px",
        borderRadius: "10px",
        border: `1px solid ${
          isError ? "#fecaca" : "#bbf7d0"
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
        type="button"
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
}

/* =========================================================
   LOADING
========================================================= */

function Loading() {
  return (
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

      <p>
        Loading disposal financial records...
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({ onAdd }) {
  return (
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
      <Trash2 size={42} />

      <h3
        style={{
          color: "#334155",
          marginBottom: "5px",
        }}
      >
        No disposal financial records
      </h3>

      <p
        style={{
          margin: "0 0 15px",
        }}
      >
        No records match the current filters.
      </p>

      <button
        onClick={onAdd}
        style={primaryButton}
      >
        <Plus size={16} />
        Add Disposal Record
      </button>
    </div>
  );
}

/* =========================================================
   TABLE HEADER
========================================================= */

function Th({
  children,
  align = "left",
}) {
  return (
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
}

/* =========================================================
   ICON BUTTON
========================================================= */

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
}

/* =========================================================
   STYLES
========================================================= */

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

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
};

const tdStyle = {
  padding: "13px 14px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
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