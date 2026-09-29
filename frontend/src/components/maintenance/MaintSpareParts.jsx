import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EMPTY_FORM = {
  partNumber: "",
  name: "",
  category: "",
  description: "",
  manufacturer: "",
  model: "",
  unit: "piece",
  quantity: "",
  minimumStock: "",
  maximumStock: "",
  reorderLevel: "",
  unitCost: "",
  supplier: "",
  location: "",
  status: "active",
  notes: "",
};

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  discontinued: "Discontinued",
};

const STATUS_CLASS = {
  active: "badge-green",
  inactive: "badge-gray",
  discontinued: "badge-red",
};

const STOCK_CLASS = {
  in_stock: "badge-green",
  low_stock: "badge-orange",
  out_of_stock: "badge-red",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizePart(item) {
  const quantity = Number(
    item.quantity ??
      item.stockQuantity ??
      item.stock_quantity ??
      item.currentStock ??
      item.current_stock ??
      0
  );

  const minimumStock = Number(
    item.minimumStock ??
      item.minimum_stock ??
      item.minStock ??
      item.min_stock ??
      0
  );

  const maximumStock =
    item.maximumStock ??
    item.maximum_stock ??
    item.maxStock ??
    item.max_stock ??
    "";

  const reorderLevel = Number(
    item.reorderLevel ??
      item.reorder_level ??
      minimumStock
  );

  let stockStatus = "in_stock";

  if (quantity <= 0) {
    stockStatus = "out_of_stock";
  } else if (quantity <= reorderLevel) {
    stockStatus = "low_stock";
  }

  return {
    id:
      item.id ||
      item.partId ||
      item.part_id,

    partNumber:
      item.partNumber ||
      item.part_number ||
      item.code ||
      "",

    name:
      item.name ||
      item.partName ||
      item.part_name ||
      "",

    category:
      item.category ||
      item.categoryName ||
      item.category_name ||
      "",

    description:
      item.description ||
      "",

    manufacturer:
      item.manufacturer ||
      "",

    model:
      item.model ||
      "",

    unit:
      item.unit ||
      item.unitOfMeasure ||
      item.unit_of_measure ||
      "piece",

    quantity,

    minimumStock,

    maximumStock,

    reorderLevel,

    unitCost: Number(
      item.unitCost ??
        item.unit_cost ??
        item.cost ??
        0
    ),

    supplier:
      item.supplier?.name ||
      item.Supplier?.name ||
      item.supplierName ||
      item.supplier_name ||
      item.supplier ||
      "",

    location:
      item.location ||
      item.storageLocation ||
      item.storage_location ||
      "",

    status:
      String(item.status || "active")
        .toLowerCase()
        .replace(/\s+/g, "-"),

    stockStatus,

    notes:
      item.notes ||
      "",

    usedQuantity: Number(
      item.usedQuantity ??
        item.used_quantity ??
        0
    ),

    receivedQuantity: Number(
      item.receivedQuantity ??
        item.received_quantity ??
        0
    ),

    source: item,
  };
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SpareParts() {
  const [parts, setParts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [stockFilter, setStockFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedPart, setSelectedPart] =
    useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] =
    useState("create");

  const [form, setForm] = useState(EMPTY_FORM);

  const [stockModal, setStockModal] =
    useState(null);

  const [stockAction, setStockAction] =
    useState("in");

  const [stockAmount, setStockAmount] =
    useState("");

  const [stockReason, setStockReason] =
    useState("");

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }),
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
  }

  async function loadParts() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJson(
        `${API}/maintenance/spare-parts`
      );

      setParts(
        safeArray(data).map(normalizePart)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load spare parts."
      );
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParts();
  }, []);

  const categories = useMemo(() => {
    return [
      ...new Set(
        parts
          .map((part) => part.category?.trim())
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [parts]);

  const filteredParts = useMemo(() => {
    const query = normalizeText(search);

    return parts.filter((part) => {
      const searchable = [
        part.partNumber,
        part.name,
        part.category,
        part.description,
        part.manufacturer,
        part.model,
        part.supplier,
        part.location,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(query);

      const categoryMatch =
        categoryFilter === "all" ||
        part.category === categoryFilter;

      const stockMatch =
        stockFilter === "all" ||
        part.stockStatus === stockFilter;

      const statusMatch =
        statusFilter === "all" ||
        part.status === statusFilter;

      return (
        searchMatch &&
        categoryMatch &&
        stockMatch &&
        statusMatch
      );
    });
  }, [
    parts,
    search,
    categoryFilter,
    stockFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const activeParts = parts.filter(
      (part) => part.status === "active"
    );

    const lowStock = activeParts.filter(
      (part) =>
        part.stockStatus === "low_stock"
    );

    const outOfStock = activeParts.filter(
      (part) =>
        part.stockStatus === "out_of_stock"
    );

    const totalUnits = activeParts.reduce(
      (sum, part) =>
        sum + Number(part.quantity || 0),
      0
    );

    const inventoryValue =
      activeParts.reduce(
        (sum, part) =>
          sum +
          Number(part.quantity || 0) *
            Number(part.unitCost || 0),
        0
      );

    return {
      totalParts: parts.length,
      activeParts: activeParts.length,
      totalUnits,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      inventoryValue,
    };
  }, [parts]);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setFormMode("create");
    setForm(EMPTY_FORM);
    setSelectedPart(null);
    setError("");
    setShowForm(true);
  }

  function openEditModal(part) {
    setFormMode("edit");
    setSelectedPart(part);

    setForm({
      partNumber: part.partNumber || "",
      name: part.name || "",
      category: part.category || "",
      description: part.description || "",
      manufacturer: part.manufacturer || "",
      model: part.model || "",
      unit: part.unit || "piece",
      quantity:
        part.quantity ?? "",
      minimumStock:
        part.minimumStock ?? "",
      maximumStock:
        part.maximumStock ?? "",
      reorderLevel:
        part.reorderLevel ?? "",
      unitCost:
        part.unitCost ?? "",
      supplier: part.supplier || "",
      location: part.location || "",
      status:
        part.status || "active",
      notes: part.notes || "",
    });

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setSelectedPart(null);
    setForm(EMPTY_FORM);
  }

  function validateForm() {
    if (!form.partNumber.trim()) {
      return "Part number is required.";
    }

    if (!form.name.trim()) {
      return "Part name is required.";
    }

    if (!form.category.trim()) {
      return "Category is required.";
    }

    if (
      form.quantity !== "" &&
      Number(form.quantity) < 0
    ) {
      return "Quantity cannot be negative.";
    }

    if (
      form.minimumStock !== "" &&
      Number(form.minimumStock) < 0
    ) {
      return "Minimum stock cannot be negative.";
    }

    if (
      form.maximumStock !== "" &&
      Number(form.maximumStock) < 0
    ) {
      return "Maximum stock cannot be negative.";
    }

    if (
      form.reorderLevel !== "" &&
      Number(form.reorderLevel) < 0
    ) {
      return "Reorder level cannot be negative.";
    }

    if (
      form.unitCost !== "" &&
      Number(form.unitCost) < 0
    ) {
      return "Unit cost cannot be negative.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      partNumber:
        form.partNumber.trim(),

      name:
        form.name.trim(),

      category:
        form.category.trim(),

      description:
        form.description.trim(),

      manufacturer:
        form.manufacturer.trim(),

      model:
        form.model.trim(),

      unit:
        form.unit.trim() || "piece",

      quantity:
        form.quantity === ""
          ? 0
          : Number(form.quantity),

      minimumStock:
        form.minimumStock === ""
          ? 0
          : Number(form.minimumStock),

      maximumStock:
        form.maximumStock === ""
          ? null
          : Number(form.maximumStock),

      reorderLevel:
        form.reorderLevel === ""
          ? 0
          : Number(form.reorderLevel),

      unitCost:
        form.unitCost === ""
          ? 0
          : Number(form.unitCost),

      supplier:
        form.supplier.trim(),

      location:
        form.location.trim(),

      status:
        form.status,

      notes:
        form.notes.trim(),
    };

    try {
      if (formMode === "create") {
        const data = await fetchJson(
          `${API}/maintenance/spare-parts`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          data?.data ||
          data?.part ||
          data;

        if (created?.id) {
          setParts((prev) => [
            normalizePart(created),
            ...prev,
          ]);
        } else {
          await loadParts();
        }
      } else {
        const id = selectedPart?.id;

        if (!id) {
          throw new Error(
            "Part ID is missing."
          );
        }

        const data = await fetchJson(
          `${API}/maintenance/spare-parts/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          data?.data ||
          data?.part ||
          data;

        if (updated?.id) {
          const normalized =
            normalizePart(updated);

          setParts((prev) =>
            prev.map((part) =>
              String(part.id) ===
              String(id)
                ? normalized
                : part
            )
          );
        } else {
          await loadParts();
        }
      }

      setShowForm(false);
      setSelectedPart(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save spare part."
      );
    } finally {
      setSaving(false);
    }
  }

  function openStockModal(
    part,
    action = "in"
  ) {
    setStockModal(part);
    setStockAction(action);
    setStockAmount("");
    setStockReason("");
    setError("");
  }

  function closeStockModal() {
    if (saving) return;

    setStockModal(null);
    setStockAmount("");
    setStockReason("");
  }

  async function handleStockAdjustment(
    event
  ) {
    event.preventDefault();

    if (!stockModal?.id) {
      setError("Part ID is missing.");
      return;
    }

    const amount = Number(stockAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        "Enter a valid quantity greater than zero."
      );
      return;
    }

    if (!stockReason.trim()) {
      setError(
        "Please provide a reason for the stock adjustment."
      );
      return;
    }

    if (
      stockAction === "out" &&
      amount > Number(stockModal.quantity || 0)
    ) {
      setError(
        "Stock out quantity cannot exceed current stock."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        quantity: amount,
        action: stockAction,
        reason: stockReason.trim(),
      };

      await fetchJson(
        `${API}/maintenance/spare-parts/${stockModal.id}/stock`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      await loadParts();

      closeStockModal();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update stock."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;

    setSaving(true);
    setError("");

    try {
      await fetchJson(
        `${API}/maintenance/spare-parts/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      setParts((prev) =>
        prev.filter(
          (part) =>
            String(part.id) !==
            String(deleteTarget.id)
        )
      );

      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete spare part."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStockFilter("all");
    setStatusFilter("all");
  }

  function getStockLabel(status) {
    if (status === "in_stock") {
      return "In Stock";
    }

    if (status === "low_stock") {
      return "Low Stock";
    }

    return "Out of Stock";
  }

  return (
    <div className="spare-parts-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .spare-parts-page {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
          padding: 24px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .parts-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 760;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #263248;
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .btn:hover {
          background: #f2f4f7;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .btn-green {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
        }

        .btn-orange {
          background: #ea580c;
          border-color: #ea580c;
          color: white;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 17px;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .summary-label {
          color: #667085;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.45px;
        }

        .summary-value {
          margin-top: 7px;
          font-size: 25px;
          font-weight: 760;
        }

        .summary-note {
          margin-top: 4px;
          color: #98a2b3;
          font-size: 11px;
        }

        .alert {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 12px;
          margin-bottom: 15px;
        }

        .filters-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search {
          flex: 1 1 270px;
          min-width: 220px;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #d7dce5;
          background: white;
          color: #344054;
          border-radius: 8px;
          padding: 10px 11px;
          font-size: 13px;
          outline: none;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37, 99, 235, 0.1);
        }

        .filter-select {
          min-width: 145px;
        }

        .table-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .table-header {
          padding: 15px 17px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .table-title {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
        }

        .result-count {
          color: #667085;
          font-size: 12px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1150px;
        }

        th {
          text-align: left;
          padding: 11px 14px;
          background: #fafbfc;
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid #e8ebf0;
          white-space: nowrap;
        }

        td {
          padding: 12px 14px;
          border-bottom: 1px solid #edf0f4;
          vertical-align: middle;
          font-size: 12px;
          color: #475467;
        }

        tbody tr:hover {
          background: #fafcff;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .part-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 210px;
        }

        .part-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          flex-shrink: 0;
        }

        .part-name {
          color: #1d2939;
          font-weight: 750;
          font-size: 12px;
        }

        .part-number {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .quantity-cell {
          min-width: 125px;
        }

        .quantity-number {
          color: #1d2939;
          font-size: 15px;
          font-weight: 760;
        }

        .quantity-unit {
          margin-left: 4px;
          color: #98a2b3;
          font-size: 10px;
        }

        .stock-bar {
          margin-top: 6px;
          width: 100%;
          max-width: 110px;
          height: 5px;
          background: #edf0f4;
          border-radius: 999px;
          overflow: hidden;
        }

        .stock-bar-fill {
          height: 100%;
          background: #2563eb;
          border-radius: 999px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 750;
          white-space: nowrap;
        }

        .badge-green {
          background: #dcfce7;
          color: #166534;
        }

        .badge-gray {
          background: #f2f4f7;
          color: #475467;
        }

        .badge-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge-orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .actions {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .action-btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #475467;
          border-radius: 7px;
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 650;
          cursor: pointer;
        }

        .action-btn:hover {
          background: #f2f4f7;
        }

        .action-btn.danger:hover {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 13px;
        }

        .loading {
          padding: 50px;
          text-align: center;
          color: #667085;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(760px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow:
            0 20px 60px
            rgba(15, 23, 42, 0.25);
        }

        .modal-small {
          width: min(450px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 760;
        }

        .modal-subtitle {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: #f2f4f7;
          color: #475467;
          font-size: 18px;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .label {
          color: #344054;
          font-size: 11px;
          font-weight: 700;
        }

        .required {
          color: #dc2626;
        }

        .textarea {
          min-height: 90px;
          resize: vertical;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }

        .detail-icon {
          width: 55px;
          height: 55px;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
        }

        .detail-name {
          margin: 0;
          font-size: 19px;
          font-weight: 760;
        }

        .detail-number {
          margin-top: 4px;
          color: #667085;
          font-size: 11px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-item {
          padding: 12px;
          background: #fafbfc;
          border: 1px solid #edf0f4;
          border-radius: 9px;
        }

        .detail-label {
          color: #98a2b3;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        .detail-value {
          margin-top: 5px;
          color: #344054;
          font-size: 12px;
          font-weight: 650;
          word-break: break-word;
        }

        .description-box {
          margin-top: 13px;
          padding: 12px;
          border: 1px solid #edf0f4;
          background: #fafbfc;
          border-radius: 9px;
        }

        .description-label {
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .description-text {
          margin-top: 6px;
          color: #475467;
          font-size: 12px;
          line-height: 1.6;
        }

        .stock-action-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .stock-action-card {
          border: 1px solid #d7dce5;
          border-radius: 9px;
          background: white;
          padding: 12px;
          cursor: pointer;
          text-align: left;
        }

        .stock-action-card.selected-in {
          border-color: #16a34a;
          background: #f0fdf4;
        }

        .stock-action-card.selected-out {
          border-color: #ea580c;
          background: #fff7ed;
        }

        .stock-action-title {
          font-weight: 750;
          font-size: 12px;
          color: #344054;
        }

        .stock-action-description {
          margin-top: 4px;
          color: #98a2b3;
          font-size: 10px;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .spare-parts-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .form-grid,
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .filters-card {
            align-items: stretch;
          }

          .search,
          .filter-select {
            width: 100%;
            min-width: 100%;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .stock-action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="parts-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Spare Parts Inventory
            </h1>

            <p className="page-subtitle">
              Manage maintenance spare parts,
              stock levels, suppliers, and inventory
              movements.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadParts}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              + Add Spare Part
            </button>
          </div>
        </div>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Total Parts
            </div>

            <div className="summary-value">
              {summary.totalParts}
            </div>

            <div className="summary-note">
              Registered inventory items
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active Parts
            </div>

            <div className="summary-value">
              {summary.activeParts}
            </div>

            <div className="summary-note">
              Currently usable inventory
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Total Units
            </div>

            <div className="summary-value">
              {summary.totalUnits.toLocaleString()}
            </div>

            <div className="summary-note">
              Units currently in stock
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Low / Out
            </div>

            <div className="summary-value">
              {summary.lowStock +
                summary.outOfStock}
            </div>

            <div className="summary-note">
              {summary.lowStock} low ·{" "}
              {summary.outOfStock} out
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Inventory Value
            </div>

            <div className="summary-value">
              {formatMoney(
                summary.inventoryValue
              )}
            </div>

            <div className="summary-note">
              Current stock × unit cost
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search">
            <input
              className="input"
              type="text"
              placeholder="Search part number, name, supplier..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="select filter-select"
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Categories
            </option>

            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>

          <select
            className="select filter-select"
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Stock
            </option>

            <option value="in_stock">
              In Stock
            </option>

            <option value="low_stock">
              Low Stock
            </option>

            <option value="out_of_stock">
              Out of Stock
            </option>
          </select>

          <select
            className="select filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>

            <option value="discontinued">
              Discontinued
            </option>
          </select>

          <button
            className="btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h2 className="table-title">
              Spare Parts Inventory
            </h2>

            <div className="result-count">
              Showing{" "}
              {filteredParts.length} of{" "}
              {parts.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading spare parts...
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="empty-state">
              No spare parts found matching the
              current filters.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Reorder Level</th>
                    <th>Unit Cost</th>
                    <th>Supplier</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredParts.map((part) => {
                    const maximum =
                      Number(
                        part.maximumStock
                      ) || 0;

                    const stockPercentage =
                      maximum > 0
                        ? Math.min(
                            100,
                            (Number(
                              part.quantity
                            ) /
                              maximum) *
                              100
                          )
                        : 0;

                    return (
                      <tr key={part.id}>
                        <td>
                          <div className="part-cell">
                            <div className="part-icon">
                              ⚙
                            </div>

                            <div>
                              <div className="part-name">
                                {part.name ||
                                  "Unnamed Part"}
                              </div>

                              <div className="part-number">
                                {part.partNumber ||
                                  "No part number"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {part.category ||
                            "—"}
                        </td>

                        <td>
                          <div className="quantity-cell">
                            <span className="quantity-number">
                              {Number(
                                part.quantity ||
                                  0
                              ).toLocaleString()}
                            </span>

                            <span className="quantity-unit">
                              {part.unit}
                            </span>

                            {maximum > 0 && (
                              <div className="stock-bar">
                                <div
                                  className="stock-bar-fill"
                                  style={{
                                    width: `${stockPercentage}%`,
                                  }}
                                />
                              </div>
                            )}

                            <div
                              style={{
                                marginTop: "5px",
                              }}
                            >
                              <span
                                className={`badge ${
                                  STOCK_CLASS[
                                    part.stockStatus
                                  ] ||
                                  "badge-gray"
                                }`}
                              >
                                {getStockLabel(
                                  part.stockStatus
                                )}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {Number(
                            part.reorderLevel ||
                              0
                          ).toLocaleString()}
                        </td>

                        <td>
                          {formatMoney(
                            part.unitCost
                          )}
                        </td>

                        <td>
                          {part.supplier ||
                            "—"}
                        </td>

                        <td>
                          {part.location ||
                            "—"}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              STATUS_CLASS[
                                part.status
                              ] ||
                              "badge-gray"
                            }`}
                          >
                            {STATUS_LABELS[
                              part.status
                            ] ||
                              part.status}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="action-btn"
                              onClick={() =>
                                setSelectedPart(
                                  part
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              className="action-btn"
                              onClick={() =>
                                openEditModal(
                                  part
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="action-btn"
                              onClick={() =>
                                openStockModal(
                                  part,
                                  "in"
                                )
                              }
                            >
                              Stock In
                            </button>

                            <button
                              className="action-btn"
                              onClick={() =>
                                openStockModal(
                                  part,
                                  "out"
                                )
                              }
                            >
                              Stock Out
                            </button>

                            <button
                              className="action-btn danger"
                              onClick={() =>
                                setDeleteTarget(
                                  part
                                )
                              }
                            >
                              Delete
                            </button>
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
      </div>

      {showForm && (
        <div
          className="modal-overlay"
          onClick={closeForm}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {formMode === "create"
                    ? "Add Spare Part"
                    : "Edit Spare Part"}
                </h2>

                <div className="modal-subtitle">
                  {formMode === "create"
                    ? "Register a new spare part in the maintenance inventory."
                    : "Update spare part information and stock settings."}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">
                      Part Number{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.partNumber}
                      onChange={(event) =>
                        updateField(
                          "partNumber",
                          event.target.value
                        )
                      }
                      placeholder="e.g. BRG-6205"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Part Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Bearing 6205"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Category{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.category}
                      onChange={(event) =>
                        updateField(
                          "category",
                          event.target.value
                        )
                      }
                      placeholder="Mechanical"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Unit
                    </label>

                    <select
                      className="select"
                      value={form.unit}
                      onChange={(event) =>
                        updateField(
                          "unit",
                          event.target.value
                        )
                      }
                    >
                      <option value="piece">
                        Piece
                      </option>

                      <option value="box">
                        Box
                      </option>

                      <option value="set">
                        Set
                      </option>

                      <option value="liter">
                        Liter
                      </option>

                      <option value="meter">
                        Meter
                      </option>

                      <option value="kg">
                        Kilogram
                      </option>

                      <option value="roll">
                        Roll
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Manufacturer
                    </label>

                    <input
                      className="input"
                      value={form.manufacturer}
                      onChange={(event) =>
                        updateField(
                          "manufacturer",
                          event.target.value
                        )
                      }
                      placeholder="Manufacturer"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Model
                    </label>

                    <input
                      className="input"
                      value={form.model}
                      onChange={(event) =>
                        updateField(
                          "model",
                          event.target.value
                        )
                      }
                      placeholder="Model / specification"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Quantity
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantity}
                      onChange={(event) =>
                        updateField(
                          "quantity",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Minimum Stock
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.minimumStock
                      }
                      onChange={(event) =>
                        updateField(
                          "minimumStock",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Reorder Level
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.reorderLevel
                      }
                      onChange={(event) =>
                        updateField(
                          "reorderLevel",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Maximum Stock
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.maximumStock
                      }
                      onChange={(event) =>
                        updateField(
                          "maximumStock",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Unit Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unitCost}
                      onChange={(event) =>
                        updateField(
                          "unitCost",
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Supplier
                    </label>

                    <input
                      className="input"
                      value={form.supplier}
                      onChange={(event) =>
                        updateField(
                          "supplier",
                          event.target.value
                        )
                      }
                      placeholder="Supplier name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Storage Location
                    </label>

                    <input
                      className="input"
                      value={form.location}
                      onChange={(event) =>
                        updateField(
                          "location",
                          event.target.value
                        )
                      }
                      placeholder="Store / Shelf / Room"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Status
                    </label>

                    <select
                      className="select"
                      value={form.status}
                      onChange={(event) =>
                        updateField(
                          "status",
                          event.target.value
                        )
                      }
                    >
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>

                      <option value="discontinued">
                        Discontinued
                      </option>
                    </select>
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Description
                    </label>

                    <textarea
                      className="textarea"
                      value={form.description}
                      onChange={(event) =>
                        updateField(
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Part description..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(event) =>
                        updateField(
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Additional inventory notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : formMode === "create"
                    ? "Create Part"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPart && !showForm && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedPart(null)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Spare Part Details
                </h2>

                <div className="modal-subtitle">
                  Inventory and stock information
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setSelectedPart(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-header">
                <div className="detail-icon">
                  ⚙
                </div>

                <div>
                  <h2 className="detail-name">
                    {selectedPart.name ||
                      "Unnamed Part"}
                  </h2>

                  <div className="detail-number">
                    Part Number:{" "}
                    {selectedPart.partNumber ||
                      "—"}
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Category
                  </div>

                  <div className="detail-value">
                    {selectedPart.category ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Stock Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${
                        STOCK_CLASS[
                          selectedPart.stockStatus
                        ] ||
                        "badge-gray"
                      }`}
                    >
                      {getStockLabel(
                        selectedPart.stockStatus
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Current Quantity
                  </div>

                  <div className="detail-value">
                    {Number(
                      selectedPart.quantity ||
                        0
                    ).toLocaleString()}{" "}
                    {selectedPart.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Reorder Level
                  </div>

                  <div className="detail-value">
                    {Number(
                      selectedPart.reorderLevel ||
                        0
                    ).toLocaleString()}{" "}
                    {selectedPart.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Minimum Stock
                  </div>

                  <div className="detail-value">
                    {Number(
                      selectedPart.minimumStock ||
                        0
                    ).toLocaleString()}{" "}
                    {selectedPart.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Maximum Stock
                  </div>

                  <div className="detail-value">
                    {selectedPart
                      .maximumStock !==
                    ""
                      ? `${Number(
                          selectedPart.maximumStock
                        ).toLocaleString()} ${
                          selectedPart.unit
                        }`
                      : "Not specified"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Unit Cost
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedPart.unitCost
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Current Value
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      Number(
                        selectedPart.quantity ||
                          0
                      ) *
                        Number(
                          selectedPart.unitCost ||
                            0
                        )
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Manufacturer
                  </div>

                  <div className="detail-value">
                    {selectedPart.manufacturer ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Model
                  </div>

                  <div className="detail-value">
                    {selectedPart.model ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Supplier
                  </div>

                  <div className="detail-value">
                    {selectedPart.supplier ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Storage Location
                  </div>

                  <div className="detail-value">
                    {selectedPart.location ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${
                        STATUS_CLASS[
                          selectedPart.status
                        ] ||
                        "badge-gray"
                      }`}
                    >
                      {STATUS_LABELS[
                        selectedPart.status
                      ] ||
                        selectedPart.status}
                    </span>
                  </div>
                </div>
              </div>

              {selectedPart.description && (
                <div className="description-box">
                  <div className="description-label">
                    Description
                  </div>

                  <div className="description-text">
                    {selectedPart.description}
                  </div>
                </div>
              )}

              {selectedPart.notes && (
                <div className="description-box">
                  <div className="description-label">
                    Notes
                  </div>

                  <div className="description-text">
                    {selectedPart.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setSelectedPart(null)
                }
              >
                Close
              </button>

              <button
                className="btn btn-orange"
                onClick={() =>
                  openStockModal(
                    selectedPart,
                    "out"
                  )
                }
              >
                Stock Out
              </button>

              <button
                className="btn btn-green"
                onClick={() =>
                  openStockModal(
                    selectedPart,
                    "in"
                  )
                }
              >
                Stock In
              </button>

              <button
                className="btn btn-primary"
                onClick={() =>
                  openEditModal(
                    selectedPart
                  )
                }
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {stockModal && (
        <div
          className="modal-overlay"
          onClick={closeStockModal}
        >
          <div
            className="modal modal-small"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Stock Adjustment
                </h2>

                <div className="modal-subtitle">
                  {stockModal.name} · Current stock:{" "}
                  {Number(
                    stockModal.quantity || 0
                  ).toLocaleString()}{" "}
                  {stockModal.unit}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeStockModal}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleStockAdjustment
              }
            >
              <div className="modal-body">
                <div className="stock-action-grid">
                  <button
                    type="button"
                    className={`stock-action-card ${
                      stockAction === "in"
                        ? "selected-in"
                        : ""
                    }`}
                    onClick={() =>
                      setStockAction("in")
                    }
                  >
                    <div className="stock-action-title">
                      + Stock In
                    </div>

                    <div className="stock-action-description">
                      Receive or add inventory.
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`stock-action-card ${
                      stockAction === "out"
                        ? "selected-out"
                        : ""
                    }`}
                    onClick={() =>
                      setStockAction("out")
                    }
                  >
                    <div className="stock-action-title">
                      − Stock Out
                    </div>

                    <div className="stock-action-description">
                      Issue or consume inventory.
                    </div>
                  </button>
                </div>

                <div
                  className="form-group"
                  style={{
                    marginBottom: "13px",
                  }}
                >
                  <label className="label">
                    Quantity{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={stockAmount}
                    onChange={(event) =>
                      setStockAmount(
                        event.target.value
                      )
                    }
                    placeholder={`Quantity in ${stockModal.unit}`}
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Reason{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <textarea
                    className="textarea"
                    value={stockReason}
                    onChange={(event) =>
                      setStockReason(
                        event.target.value
                      )
                    }
                    placeholder="Reason for stock adjustment..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeStockModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    stockAction === "in"
                      ? "btn btn-green"
                      : "btn btn-orange"
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Updating..."
                    : stockAction === "in"
                    ? "Confirm Stock In"
                    : "Confirm Stock Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving &&
            setDeleteTarget(null)
          }
        >
          <div
            className="modal modal-small"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Delete Spare Part
                </h2>

                <div className="modal-subtitle">
                  This action may affect inventory
                  history.
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  !saving &&
                  setDeleteTarget(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p
                style={{
                  margin: 0,
                  color: "#475467",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Are you sure you want to delete{" "}
                <strong>
                  {deleteTarget.name ||
                    "this spare part"}
                </strong>
                ?
              </p>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  border:
                    "1px solid #fed7aa",
                  color: "#9a3412",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                If the part has historical
                maintenance usage or stock
                transactions, the backend should
                enforce the appropriate retention
                rule.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving
                  ? "Deleting..."
                  : "Delete Part"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
