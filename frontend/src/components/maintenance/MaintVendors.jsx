/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EMPTY_FORM = {
  name: "",
  vendorCode: "",
  category: "",
  contactPerson: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  serviceTypes: "",
  specialties: "",
  contractNumber: "",
  contractStartDate: "",
  contractEndDate: "",
  status: "active",
  rating: "",
  notes: "",
};

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
  expired: "Expired",
};

const STATUS_CLASS = {
  active: "badge-green",
  inactive: "badge-gray",
  suspended: "badge-red",
  expired: "badge-orange",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.vendors)) return data.vendors;
  return [];
}

function normalizeVendor(item) {
  const rating = Number(
    item.rating ??
      item.vendorRating ??
      item.vendor_rating ??
      0
  );

  return {
    id:
      item.id ??
      item.vendorId ??
      item.vendor_id,

    name:
      item.name ??
      item.vendorName ??
      item.vendor_name ??
      "",

    vendorCode:
      item.vendorCode ??
      item.vendor_code ??
      item.code ??
      "",

    category:
      item.category ??
      item.vendorCategory ??
      item.vendor_category ??
      "",

    contactPerson:
      item.contactPerson ??
      item.contact_person ??
      item.contactName ??
      item.contact_name ??
      "",

    phone:
      item.phone ??
      item.phoneNumber ??
      item.phone_number ??
      "",

    email:
      item.email ??
      "",

    website:
      item.website ??
      "",

    address:
      item.address ??
      "",

    city:
      item.city ??
      "",

    serviceTypes:
      item.serviceTypes ??
      item.service_types ??
      item.services ??
      "",

    specialties:
      item.specialties ??
      "",

    contractNumber:
      item.contractNumber ??
      item.contract_number ??
      "",

    contractStartDate:
      item.contractStartDate ??
      item.contract_start_date ??
      "",

    contractEndDate:
      item.contractEndDate ??
      item.contract_end_date ??
      "",

    status:
      String(
        item.status ?? "active"
      )
        .toLowerCase()
        .replace(/\s+/g, "-"),

    rating: Number.isFinite(rating)
      ? Math.max(0, Math.min(5, rating))
      : 0,

    notes:
      item.notes ??
      "",

    source: item,
  };
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "V";

  if (words.length === 1) {
    return words[0]
      .substring(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function getContractState(vendor) {
  if (!vendor.contractEndDate) {
    return {
      label: "No Contract Date",
      className: "badge-gray",
    };
  }

  const end = new Date(
    vendor.contractEndDate
  );

  if (Number.isNaN(end.getTime())) {
    return {
      label: "Unknown",
      className: "badge-gray",
    };
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diff =
    Math.ceil(
      (end.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

  if (diff < 0) {
    return {
      label: "Expired",
      className: "badge-red",
    };
  }

  if (diff <= 30) {
    return {
      label: `${diff} days left`,
      className: "badge-orange",
    };
  }

  return {
    label: "Valid",
    className: "badge-green",
  };
}

export default function Vendors() {
  const [vendors, setVendors] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [contractFilter, setContractFilter] =
    useState("all");

  const [selectedVendor, setSelectedVendor] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const [formMode, setFormMode] =
    useState("create");

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  async function fetchJson(
    url,
    options = {}
  ) {
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

  async function loadVendors() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJson(
        `${API}/maintenance/vendors`
      );

      setVendors(
        safeArray(data).map(normalizeVendor)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load vendors."
      );

      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  const categories = useMemo(() => {
    return [
      ...new Set(
        vendors
          .map((vendor) =>
            vendor.category?.trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const query =
      normalizeText(search);

    return vendors.filter((vendor) => {
      const searchable = [
        vendor.name,
        vendor.vendorCode,
        vendor.category,
        vendor.contactPerson,
        vendor.phone,
        vendor.email,
        vendor.city,
        vendor.address,
        vendor.serviceTypes,
        vendor.specialties,
        vendor.contractNumber,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(
          query
        );

      const categoryMatch =
        categoryFilter === "all" ||
        vendor.category ===
          categoryFilter;

      const statusMatch =
        statusFilter === "all" ||
        vendor.status === statusFilter;

      let contractMatch = true;

      if (
        contractFilter !== "all"
      ) {
        const contractState =
          getContractState(vendor);

        if (
          contractFilter ===
          "expired"
        ) {
          contractMatch =
            contractState.label ===
            "Expired";
        }

        if (
          contractFilter ===
          "expiring"
        ) {
          contractMatch =
            contractState.className ===
            "badge-orange";
        }

        if (
          contractFilter ===
          "valid"
        ) {
          contractMatch =
            contractState.label ===
            "Valid";
        }

        if (
          contractFilter ===
          "none"
        ) {
          contractMatch =
            !vendor.contractEndDate;
        }
      }

      return (
        searchMatch &&
        categoryMatch &&
        statusMatch &&
        contractMatch
      );
    });
  }, [
    vendors,
    search,
    categoryFilter,
    statusFilter,
    contractFilter,
  ]);

  const summary = useMemo(() => {
    const active = vendors.filter(
      (vendor) =>
        vendor.status === "active"
    );

    const inactive = vendors.filter(
      (vendor) =>
        vendor.status !== "active"
    );

    const expiring = vendors.filter(
      (vendor) =>
        getContractState(vendor)
          .className === "badge-orange"
    );

    const expired = vendors.filter(
      (vendor) =>
        getContractState(vendor)
          .label === "Expired"
    );

    const rated = vendors.filter(
      (vendor) =>
        Number(vendor.rating) > 0
    );

    const averageRating =
      rated.length > 0
        ? rated.reduce(
            (sum, vendor) =>
              sum +
              Number(
                vendor.rating || 0
              ),
            0
          ) / rated.length
        : 0;

    return {
      total: vendors.length,
      active: active.length,
      inactive: inactive.length,
      expiring: expiring.length,
      expired: expired.length,
      averageRating,
    };
  }, [vendors]);

  function updateField(
    field,
    value
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setFormMode("create");
    setSelectedVendor(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEditModal(vendor) {
    setFormMode("edit");
    setSelectedVendor(vendor);

    setForm({
      name: vendor.name || "",
      vendorCode:
        vendor.vendorCode || "",
      category:
        vendor.category || "",
      contactPerson:
        vendor.contactPerson || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      website:
        vendor.website || "",
      address:
        vendor.address || "",
      city:
        vendor.city || "",
      serviceTypes:
        vendor.serviceTypes || "",
      specialties:
        vendor.specialties || "",
      contractNumber:
        vendor.contractNumber || "",
      contractStartDate:
        vendor.contractStartDate
          ? String(
              vendor.contractStartDate
            ).slice(0, 10)
          : "",
      contractEndDate:
        vendor.contractEndDate
          ? String(
              vendor.contractEndDate
            ).slice(0, 10)
          : "",
      status:
        vendor.status || "active",
      rating:
        vendor.rating || "",
      notes:
        vendor.notes || "",
    });

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setSelectedVendor(null);
    setForm(EMPTY_FORM);
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Vendor name is required.";
    }

    if (!form.category.trim()) {
      return "Vendor category is required.";
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Enter a valid email address.";
    }

    if (
      form.rating !== "" &&
      (
        Number(form.rating) < 0 ||
        Number(form.rating) > 5
      )
    ) {
      return "Rating must be between 0 and 5.";
    }

    if (
      form.contractStartDate &&
      form.contractEndDate &&
      form.contractEndDate <
        form.contractStartDate
    ) {
      return "Contract end date cannot be before the start date.";
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
      name: form.name.trim(),

      vendorCode:
        form.vendorCode.trim(),

      category:
        form.category.trim(),

      contactPerson:
        form.contactPerson.trim(),

      phone:
        form.phone.trim(),

      email:
        form.email.trim(),

      website:
        form.website.trim(),

      address:
        form.address.trim(),

      city:
        form.city.trim(),

      serviceTypes:
        form.serviceTypes.trim(),

      specialties:
        form.specialties.trim(),

      contractNumber:
        form.contractNumber.trim(),

      contractStartDate:
        form.contractStartDate ||
        null,

      contractEndDate:
        form.contractEndDate ||
        null,

      status:
        form.status,

      rating:
        form.rating === ""
          ? null
          : Number(form.rating),

      notes:
        form.notes.trim(),
    };

    try {
      if (
        formMode === "create"
      ) {
        const data =
          await fetchJson(
            `${API}/maintenance/vendors`,
            {
              method: "POST",
              body: JSON.stringify(
                payload
              ),
            }
          );

        const created =
          data?.data ||
          data?.vendor ||
          data;

        if (created?.id) {
          setVendors((prev) => [
            normalizeVendor(created),
            ...prev,
          ]);
        } else {
          await loadVendors();
        }
      } else {
        const id =
          selectedVendor?.id;

        if (!id) {
          throw new Error(
            "Vendor ID is missing."
          );
        }

        const data =
          await fetchJson(
            `${API}/maintenance/vendors/${id}`,
            {
              method: "PUT",
              body: JSON.stringify(
                payload
              ),
            }
          );

        const updated =
          data?.data ||
          data?.vendor ||
          data;

        if (updated?.id) {
          const normalized =
            normalizeVendor(
              updated
            );

          setVendors((prev) =>
            prev.map((vendor) =>
              String(vendor.id) ===
              String(id)
                ? normalized
                : vendor
            )
          );
        } else {
          await loadVendors();
        }
      }

      closeForm();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save vendor."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await fetchJson(
        `${API}/maintenance/vendors/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      setVendors((prev) =>
        prev.filter(
          (vendor) =>
            String(vendor.id) !==
            String(
              deleteTarget.id
            )
        )
      );

      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete vendor."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setContractFilter("all");
  }

  return (
    <div className="vendors-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .vendors-page {
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

        .vendors-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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
          align-items: center;
          justify-content: space-between;
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
          min-width: 1250px;
          border-collapse: collapse;
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

        .vendor-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 230px;
        }

        .vendor-avatar {
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border-radius: 10px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
        }

        .vendor-name {
          color: #1d2939;
          font-weight: 750;
          font-size: 12px;
        }

        .vendor-code {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .contact-line {
          line-height: 1.55;
        }

        .contact-primary {
          color: #344054;
          font-weight: 600;
        }

        .contact-secondary {
          color: #98a2b3;
          font-size: 10px;
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

        .rating {
          color: #344054;
          font-weight: 750;
        }

        .stars {
          color: #f59e0b;
          letter-spacing: 1px;
          font-size: 11px;
          margin-left: 3px;
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

        .empty-state,
        .loading {
          padding: 50px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(820px, 100%);
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
          align-items: flex-start;
          justify-content: space-between;
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
          flex-wrap: wrap;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }

        .detail-avatar {
          width: 58px;
          height: 58px;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
        }

        .detail-name {
          margin: 0;
          font-size: 19px;
          font-weight: 760;
        }

        .detail-code {
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
          background: #fafbfc;
          border: 1px solid #edf0f4;
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

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .vendors-page {
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

          .form-group.full {
            grid-column: auto;
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
        }
      `}</style>

      <div className="vendors-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Maintenance Vendors
            </h1>

            <p className="page-subtitle">
              Manage external maintenance
              providers, contacts, services,
              contracts, and vendor performance.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadVendors}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={
                openCreateModal
              }
            >
              + Add Vendor
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
              Total Vendors
            </div>

            <div className="summary-value">
              {summary.total}
            </div>

            <div className="summary-note">
              Registered maintenance providers
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active
            </div>

            <div className="summary-value">
              {summary.active}
            </div>

            <div className="summary-note">
              Currently available vendors
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Other Status
            </div>

            <div className="summary-value">
              {summary.inactive}
            </div>

            <div className="summary-note">
              Inactive, suspended, or expired
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Contract Attention
            </div>

            <div className="summary-value">
              {summary.expiring +
                summary.expired}
            </div>

            <div className="summary-note">
              {summary.expiring} expiring ·{" "}
              {summary.expired} expired
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Avg. Rating
            </div>

            <div className="summary-value">
              {summary.averageRating.toFixed(
                1
              )}
            </div>

            <div className="summary-note">
              Based on recorded vendor ratings
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search">
            <input
              className="input"
              type="text"
              placeholder="Search vendor, code, contact, service..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
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

            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
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

            <option value="suspended">
              Suspended
            </option>

            <option value="expired">
              Expired
            </option>
          </select>

          <select
            className="select filter-select"
            value={contractFilter}
            onChange={(event) =>
              setContractFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Contracts
            </option>

            <option value="valid">
              Valid
            </option>

            <option value="expiring">
              Expiring Soon
            </option>

            <option value="expired">
              Expired
            </option>

            <option value="none">
              No End Date
            </option>
          </select>

          <button
            className="btn"
            onClick={
              clearFilters
            }
          >
            Clear
          </button>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h2 className="table-title">
              Vendor Directory
            </h2>

            <div className="result-count">
              Showing{" "}
              {filteredVendors.length}{" "}
              of {vendors.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading vendors...
            </div>
          ) : filteredVendors.length ===
            0 ? (
            <div className="empty-state">
              No vendors found matching the
              current filters.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Contact</th>
                    <th>Services</th>
                    <th>Contract</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredVendors.map(
                    (vendor) => {
                      const contract =
                        getContractState(
                          vendor
                        );

                      return (
                        <tr
                          key={vendor.id}
                        >
                          <td>
                            <div className="vendor-cell">
                              <div className="vendor-avatar">
                                {getInitials(
                                  vendor.name
                                )}
                              </div>

                              <div>
                                <div className="vendor-name">
                                  {vendor.name ||
                                    "Unnamed Vendor"}
                                </div>

                                <div className="vendor-code">
                                  {vendor.vendorCode ||
                                    "No vendor code"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {vendor.category ||
                              "—"}
                          </td>

                          <td>
                            <div className="contact-line">
                              <div className="contact-primary">
                                {vendor.contactPerson ||
                                  "No contact person"}
                              </div>

                              <div className="contact-secondary">
                                {vendor.phone ||
                                  vendor.email ||
                                  "No contact details"}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div
                              style={{
                                maxWidth:
                                  "180px",
                                lineHeight:
                                  1.5,
                              }}
                            >
                              {vendor.serviceTypes ||
                                vendor.specialties ||
                                "—"}
                            </div>
                          </td>

                          <td>
                            <div
                              style={{
                                lineHeight:
                                  1.5,
                              }}
                            >
                              <div>
                                {vendor.contractNumber ||
                                  "No contract"}
                              </div>

                              {vendor.contractEndDate && (
                                <div
                                  style={{
                                    marginTop:
                                      "3px",
                                  }}
                                >
                                  <span
                                    className={`badge ${contract.className}`}
                                  >
                                    {
                                      contract.label
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            {vendor.rating >
                            0 ? (
                              <div>
                                <span className="rating">
                                  {vendor.rating.toFixed(
                                    1
                                  )}
                                </span>

                                <span className="stars">
                                  {"★".repeat(
                                    Math.round(
                                      vendor.rating
                                    )
                                  )}
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            <span
                              className={`badge ${
                                STATUS_CLASS[
                                  vendor.status
                                ] ||
                                "badge-gray"
                              }`}
                            >
                              {STATUS_LABELS[
                                vendor.status
                              ] ||
                                vendor.status}
                            </span>
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                className="action-btn"
                                onClick={() =>
                                  setSelectedVendor(
                                    vendor
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                className="action-btn"
                                onClick={() =>
                                  openEditModal(
                                    vendor
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="action-btn danger"
                                onClick={() =>
                                  setDeleteTarget(
                                    vendor
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
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
                  {formMode ===
                  "create"
                    ? "Add Maintenance Vendor"
                    : "Edit Maintenance Vendor"}
                </h2>

                <div className="modal-subtitle">
                  Register vendor contact,
                  service, and contract information.
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">
                      Vendor Name{" "}
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
                      placeholder="Vendor company name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Vendor Code
                    </label>

                    <input
                      className="input"
                      value={
                        form.vendorCode
                      }
                      onChange={(event) =>
                        updateField(
                          "vendorCode",
                          event.target.value
                        )
                      }
                      placeholder="e.g. VEN-001"
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
                      value={
                        form.category
                      }
                      onChange={(event) =>
                        updateField(
                          "category",
                          event.target.value
                        )
                      }
                      placeholder="Electrical, HVAC, Plumbing..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Contact Person
                    </label>

                    <input
                      className="input"
                      value={
                        form.contactPerson
                      }
                      onChange={(event) =>
                        updateField(
                          "contactPerson",
                          event.target.value
                        )
                      }
                      placeholder="Primary contact person"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Phone
                    </label>

                    <input
                      className="input"
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value
                        )
                      }
                      placeholder="+251..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Email
                    </label>

                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      placeholder="vendor@example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Website
                    </label>

                    <input
                      className="input"
                      type="url"
                      value={
                        form.website
                      }
                      onChange={(event) =>
                        updateField(
                          "website",
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      City
                    </label>

                    <input
                      className="input"
                      value={form.city}
                      onChange={(event) =>
                        updateField(
                          "city",
                          event.target.value
                        )
                      }
                      placeholder="City"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Address
                    </label>

                    <input
                      className="input"
                      value={
                        form.address
                      }
                      onChange={(event) =>
                        updateField(
                          "address",
                          event.target.value
                        )
                      }
                      placeholder="Full business address"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Service Types
                    </label>

                    <input
                      className="input"
                      value={
                        form.serviceTypes
                      }
                      onChange={(event) =>
                        updateField(
                          "serviceTypes",
                          event.target.value
                        )
                      }
                      placeholder="Preventive maintenance, emergency repair, installation..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Specialties
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.specialties
                      }
                      onChange={(event) =>
                        updateField(
                          "specialties",
                          event.target.value
                        )
                      }
                      placeholder="Describe technical specialties..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Contract Number
                    </label>

                    <input
                      className="input"
                      value={
                        form.contractNumber
                      }
                      onChange={(event) =>
                        updateField(
                          "contractNumber",
                          event.target.value
                        )
                      }
                      placeholder="Contract reference"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Rating
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={form.rating}
                      onChange={(event) =>
                        updateField(
                          "rating",
                          event.target.value
                        )
                      }
                      placeholder="0 - 5"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Contract Start Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.contractStartDate
                      }
                      onChange={(event) =>
                        updateField(
                          "contractStartDate",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Contract End Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.contractEndDate
                      }
                      onChange={(event) =>
                        updateField(
                          "contractEndDate",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Status
                    </label>

                    <select
                      className="select"
                      value={
                        form.status
                      }
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

                      <option value="suspended">
                        Suspended
                      </option>

                      <option value="expired">
                        Expired
                      </option>
                    </select>
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
                      placeholder="Additional vendor notes..."
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
                    : formMode ===
                      "create"
                    ? "Create Vendor"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedVendor &&
        !showForm && (
          <div
            className="modal-overlay"
            onClick={() =>
              setSelectedVendor(
                null
              )
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
                    Vendor Details
                  </h2>

                  <div className="modal-subtitle">
                    Maintenance service provider
                    information
                  </div>
                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setSelectedVendor(
                      null
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="detail-header">
                  <div className="detail-avatar">
                    {getInitials(
                      selectedVendor.name
                    )}
                  </div>

                  <div>
                    <h2 className="detail-name">
                      {selectedVendor.name ||
                        "Unnamed Vendor"}
                    </h2>

                    <div className="detail-code">
                      Vendor Code:{" "}
                      {selectedVendor.vendorCode ||
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
                      {selectedVendor.category ||
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
                            selectedVendor.status
                          ] ||
                          "badge-gray"
                        }`}
                      >
                        {STATUS_LABELS[
                          selectedVendor.status
                        ] ||
                          selectedVendor.status}
                      </span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Contact Person
                    </div>

                    <div className="detail-value">
                      {selectedVendor.contactPerson ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Phone
                    </div>

                    <div className="detail-value">
                      {selectedVendor.phone ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Email
                    </div>

                    <div className="detail-value">
                      {selectedVendor.email ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Website
                    </div>

                    <div className="detail-value">
                      {selectedVendor.website ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      City
                    </div>

                    <div className="detail-value">
                      {selectedVendor.city ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Rating
                    </div>

                    <div className="detail-value">
                      {selectedVendor.rating >
                      0
                        ? `${selectedVendor.rating.toFixed(
                            1
                          )} / 5`
                        : "Not rated"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Contract Number
                    </div>

                    <div className="detail-value">
                      {selectedVendor.contractNumber ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Contract Start
                    </div>

                    <div className="detail-value">
                      {formatDate(
                        selectedVendor.contractStartDate
                      )}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Contract End
                    </div>

                    <div className="detail-value">
                      {formatDate(
                        selectedVendor.contractEndDate
                      )}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Contract Status
                    </div>

                    <div className="detail-value">
                      {(() => {
                        const state =
                          getContractState(
                            selectedVendor
                          );

                        return (
                          <span
                            className={`badge ${state.className}`}
                          >
                            {
                              state.label
                            }
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Address
                  </div>

                  <div className="description-text">
                    {selectedVendor.address ||
                      "No address recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Services
                  </div>

                  <div className="description-text">
                    {selectedVendor.serviceTypes ||
                      "No service types recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Specialties
                  </div>

                  <div className="description-text">
                    {selectedVendor.specialties ||
                      "No specialties recorded."}
                  </div>
                </div>

                {selectedVendor.notes && (
                  <div className="description-box">
                    <div className="description-label">
                      Notes
                    </div>

                    <div className="description-text">
                      {
                        selectedVendor.notes
                      }
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn"
                  onClick={() =>
                    setSelectedVendor(
                      null
                    )
                  }
                >
                  Close
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    openEditModal(
                      selectedVendor
                    )
                  }
                >
                  Edit Vendor
                </button>
              </div>
            </div>
          </div>
        )}

      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving &&
            setDeleteTarget(
              null
            )
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
                  Delete Vendor
                </h2>

                <div className="modal-subtitle">
                  Confirm vendor removal
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  !saving &&
                  setDeleteTarget(
                    null
                  )
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
                Are you sure you want to
                delete{" "}
                <strong>
                  {deleteTarget.name ||
                    "this vendor"}
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
                If this vendor is referenced by
                maintenance work orders, contracts,
                or historical records, the backend
                should enforce the appropriate
                retention or soft-delete rule.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={
                  handleDelete
                }
                disabled={saving}
              >
                {saving
                  ? "Deleting..."
                  : "Delete Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
