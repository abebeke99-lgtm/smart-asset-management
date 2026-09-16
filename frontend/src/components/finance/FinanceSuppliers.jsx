import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  supplierCode: "",
  supplierName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  taxNumber: "",
  registrationNumber: "",
  category: "",
  paymentTerms: "",
  bankName: "",
  bankAccount: "",
  status: "Active",
  notes: "",
};

const getRows = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
};

const getPagination = (response, rowsLength, currentPage, pageSize) => {
  const root = response?.data?.pagination || response?.data?.meta || response?.data;

  const total =
    Number(
      root?.total ??
        root?.totalItems ??
        root?.count ??
        response?.data?.total ??
        rowsLength
    ) || 0;

  const pages =
    Number(
      root?.totalPages ??
        root?.pages ??
        Math.ceil(total / pageSize)
    ) || 1;

  return {
    total,
    pages: Math.max(1, pages),
    page:
      Number(root?.page ?? root?.currentPage ?? currentPage) || currentPage,
  };
};

const normalizeSupplier = (item) => ({
  id: item?.id ?? item?.supplierId ?? item?.supplier_id,
  supplierCode:
    item?.supplierCode ??
    item?.supplier_code ??
    item?.code ??
    "",
  supplierName:
    item?.supplierName ??
    item?.supplier_name ??
    item?.name ??
    item?.companyName ??
    item?.company_name ??
    "",
  contactPerson:
    item?.contactPerson ??
    item?.contact_person ??
    item?.contactName ??
    item?.contact_name ??
    "",
  phone: item?.phone ?? item?.phoneNumber ?? item?.phone_number ?? "",
  email: item?.email ?? "",
  address: item?.address ?? "",
  city: item?.city ?? "",
  country: item?.country ?? "",
  taxNumber:
    item?.taxNumber ??
    item?.tax_number ??
    item?.tin ??
    "",
  registrationNumber:
    item?.registrationNumber ??
    item?.registration_number ??
    "",
  category: item?.category ?? item?.supplierCategory ?? "",
  paymentTerms:
    item?.paymentTerms ??
    item?.payment_terms ??
    "",
  bankName: item?.bankName ?? item?.bank_name ?? "",
  bankAccount:
    item?.bankAccount ??
    item?.bank_account ??
    "",
  status: item?.status ?? "Active",
  notes: item?.notes ?? item?.remarks ?? "",
  createdAt: item?.createdAt ?? item?.created_at ?? "",
  updatedAt: item?.updatedAt ?? item?.updated_at ?? "",
});

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "active") return "status active";
  if (value === "inactive") return "status inactive";
  if (value === "suspended") return "status suspended";

  return "status";
};

export default function FinanceSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    page: 1,
  });

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/finance/suppliers", {
        params: {
          page,
          limit: pageSize,
          search: search || undefined,
          status: status || undefined,
          category: category || undefined,
        },
      });

      const rows = getRows(response).map(normalizeSupplier);
      setSuppliers(rows);

      const backendSummary =
        response?.data?.summary ||
        response?.data?.statistics ||
        response?.data?.stats ||
        null;

      setSummary(backendSummary);

      setPagination(
        getPagination(response, rows.length, page, pageSize)
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load suppliers."
      );
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, category]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const localStats = useMemo(() => {
    const total = pagination.total || suppliers.length;

    const active = suppliers.filter(
      (item) => String(item.status).toLowerCase() === "active"
    ).length;

    const inactive = suppliers.filter(
      (item) => String(item.status).toLowerCase() === "inactive"
    ).length;

    const suspended = suppliers.filter(
      (item) => String(item.status).toLowerCase() === "suspended"
    ).length;

    return {
      total,
      active,
      inactive,
      suspended,
    };
  }, [suppliers, pagination.total]);

  const stats = {
    total:
      Number(summary?.total ?? summary?.totalSuppliers) ||
      localStats.total,
    active:
      Number(summary?.active ?? summary?.activeSuppliers) ||
      localStats.active,
    inactive:
      Number(summary?.inactive ?? summary?.inactiveSuppliers) ||
      localStats.inactive,
    suspended:
      Number(summary?.suspended ?? summary?.suspendedSuppliers) ||
      localStats.suspended,
  };

  const categories = useMemo(() => {
    const values = suppliers
      .map((item) => item.category)
      .filter(Boolean);

    return [...new Set(values)];
  }, [suppliers]);

  const openCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);

    setForm({
      supplierCode: supplier.supplierCode || "",
      supplierName: supplier.supplierName || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      taxNumber: supplier.taxNumber || "",
      registrationNumber: supplier.registrationNumber || "",
      category: supplier.category || "",
      paymentTerms: supplier.paymentTerms || "",
      bankName: supplier.bankName || "",
      bankAccount: supplier.bankAccount || "",
      status: supplier.status || "Active",
      notes: supplier.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDetails(true);
  };

  const openDelete = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDelete(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.supplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        supplierCode: form.supplierCode.trim(),
        supplierName: form.supplierName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        taxNumber: form.taxNumber.trim(),
        registrationNumber: form.registrationNumber.trim(),
        category: form.category.trim(),
        paymentTerms: form.paymentTerms.trim(),
        bankName: form.bankName.trim(),
        bankAccount: form.bankAccount.trim(),
        status: form.status,
        notes: form.notes.trim(),
      };

      if (editingSupplier?.id) {
        await api.put(
          `/finance/suppliers/${editingSupplier.id}`,
          payload
        );
        setSuccess("Supplier updated successfully.");
      } else {
        await api.post("/finance/suppliers", payload);
        setSuccess("Supplier created successfully.");
      }

      setShowForm(false);
      setEditingSupplier(null);
      setForm(emptyForm);

      await loadSuppliers();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save supplier."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier?.id) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/finance/suppliers/${selectedSupplier.id}`
      );

      setSuccess("Supplier deleted successfully.");
      setShowDelete(false);
      setSelectedSupplier(null);

      if (suppliers.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await loadSuppliers();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete supplier."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    setPage(1);
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.pages) return;
    setPage(nextPage);
  };

  return (
    <div className="finance-page">
      <style>{`
        * { box-sizing: border-box; }

        .finance-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 28px;
        }

        .page-shell {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .title-wrap h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .title-wrap p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 0;
          border-radius: 10px;
          padding: 11px 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          transition: .2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn-primary {
          color: white;
          background: #0ea5e9;
        }

        .btn-secondary {
          color: #0f172a;
          background: white;
          border: 1px solid #e2e8f0;
        }

        .btn-danger {
          color: white;
          background: #dc2626;
        }

        .btn-success {
          color: white;
          background: #16a34a;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 19px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 4px 15px rgba(15, 23, 42, .04);
        }

        .summary-icon {
          width: 45px;
          height: 45px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #e0f2fe;
          color: #0284c7;
          flex-shrink: 0;
        }

        .summary-card h3 {
          margin: 0 0 5px;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .summary-card strong {
          font-size: 25px;
        }

        .filters {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(230px, 1fr) 180px 180px auto;
          gap: 12px;
          margin-bottom: 18px;
        }

        .search-box {
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        input, select, textarea {
          width: 100%;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          padding: 11px 12px;
          font: inherit;
          color: #0f172a;
          background: white;
          outline: none;
        }

        .search-box input {
          padding-left: 38px;
        }

        input:focus, select:focus, textarea:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14,165,233,.12);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(15, 23, 42, .04);
        }

        .table-top {
          padding: 17px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #eef2f7;
        }

        .table-top h2 {
          margin: 0;
          font-size: 16px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          text-align: left;
          padding: 13px 16px;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        td {
          padding: 15px 16px;
          border-top: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .supplier-name {
          font-weight: 750;
        }

        .supplier-code {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .contact {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .contact-line {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #475569;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .status.active {
          background: #dcfce7;
          color: #15803d;
        }

        .status.inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .status.suspended {
          background: #fee2e2;
          color: #b91c1c;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #475569;
        }

        .icon-btn:hover {
          border-color: #0ea5e9;
          color: #0284c7;
        }

        .icon-btn.delete:hover {
          border-color: #fecaca;
          color: #dc2626;
          background: #fef2f2;
        }

        .empty, .loading {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .alert {
          padding: 12px 15px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 18px;
          border-top: 1px solid #eef2f7;
        }

        .page-info {
          color: #64748b;
          font-size: 12px;
        }

        .page-buttons {
          display: flex;
          gap: 7px;
        }

        .page-button {
          width: 34px;
          height: 34px;
          border: 1px solid #dbe3ec;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          display: grid;
          place-items: center;
        }

        .page-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .page-button.current {
          background: #0ea5e9;
          color: white;
          border-color: #0ea5e9;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15,23,42,.25);
        }

        .modal.small {
          width: min(460px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #eef2f7;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          width: 35px;
          height: 35px;
          border: 0;
          background: #f1f5f9;
          border-radius: 8px;
          cursor: pointer;
          display: grid;
          place-items: center;
        }

        .form {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 12px;
          color: #475569;
          font-weight: 750;
        }

        textarea {
          min-height: 95px;
          resize: vertical;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #eef2f7;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .details-grid {
          padding: 20px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .detail-item {
          padding: 13px;
          background: #f8fafc;
          border-radius: 10px;
        }

        .detail-item.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          font-weight: 650;
          word-break: break-word;
        }

        .delete-content {
          padding: 24px;
          text-align: center;
        }

        .delete-icon {
          width: 55px;
          height: 55px;
          margin: 0 auto 14px;
          border-radius: 50%;
          background: #fee2e2;
          color: #dc2626;
          display: grid;
          place-items: center;
        }

        .delete-content h3 {
          margin: 0 0 8px;
        }

        .delete-content p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        @media (max-width: 1000px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 650px) {
          .finance-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .field.full,
          .detail-item.full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div className="title-wrap">
            <h1>Suppliers</h1>
            <p>
              Manage approved suppliers, supplier information, payment terms,
              and procurement relationships.
            </p>
          </div>

          <div className="header-actions">
            <Link className="btn btn-secondary" to="/finance">
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <Link className="btn btn-secondary" to="/finance/purchase-requests">
              Purchase Requests
            </Link>

            <button
              className="btn btn-secondary"
              onClick={loadSuppliers}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spinner" : ""} />
              Refresh
            </button>

            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={17} />
              Add Supplier
            </button>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <Building2 size={22} />
            </div>
            <div>
              <h3>Total Suppliers</h3>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3>Active</h3>
              <strong>{stats.active}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <XCircle size={22} />
            </div>
            <div>
              <h3>Inactive</h3>
              <strong>{stats.inactive}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <Building2 size={22} />
            </div>
            <div>
              <h3>Suspended</h3>
              <strong>{stats.suspended}</strong>
            </div>
          </div>
        </div>

        <div className="filters">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search supplier, code, contact, phone..."
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button className="btn btn-secondary" onClick={clearFilters}>
            Clear
          </button>
        </div>

        <div className="table-card">
          <div className="table-top">
            <h2>Supplier Directory</h2>
            <span className="page-info">
              {pagination.total} supplier{pagination.total === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading">
              <RefreshCw size={26} className="spinner" />
              <p>Loading suppliers...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="empty">
              <Building2 size={38} />
              <p>No suppliers found.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Contact</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Payment Terms</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td>
                          <div className="supplier-name">
                            {supplier.supplierName || "Unnamed Supplier"}
                          </div>
                          <div className="supplier-code">
                            {supplier.supplierCode || "No supplier code"}
                          </div>
                        </td>

                        <td>
                          <div className="contact">
                            {supplier.contactPerson && (
                              <span className="contact-line">
                                {supplier.contactPerson}
                              </span>
                            )}

                            {supplier.phone && (
                              <span className="contact-line">
                                <Phone size={12} />
                                {supplier.phone}
                              </span>
                            )}

                            {supplier.email && (
                              <span className="contact-line">
                                <Mail size={12} />
                                {supplier.email}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>{supplier.category || "—"}</td>

                        <td>
                          <span className="contact-line">
                            {supplier.city || supplier.address ? (
                              <MapPin size={13} />
                            ) : null}
                            {supplier.city ||
                              supplier.address ||
                              supplier.country ||
                              "—"}
                          </span>
                        </td>

                        <td>{supplier.paymentTerms || "—"}</td>

                        <td>
                          <span className={statusClass(supplier.status)}>
                            {supplier.status}
                          </span>
                        </td>

                        <td>{formatDate(supplier.createdAt)}</td>

                        <td>
                          <div className="actions">
                            <button
                              className="icon-btn"
                              title="View"
                              onClick={() => openDetails(supplier)}
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              className="icon-btn"
                              title="Edit"
                              onClick={() => openEdit(supplier)}
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              className="icon-btn delete"
                              title="Delete"
                              onClick={() => openDelete(supplier)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="page-info">
                  Page {pagination.page} of {pagination.pages}
                </div>

                <div className="page-buttons">
                  <button
                    className="page-button"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from(
                    { length: Math.min(5, pagination.pages) },
                    (_, index) => {
                      const pageNumber = index + 1;

                      return (
                        <button
                          key={pageNumber}
                          className={`page-button ${
                            pageNumber === page ? "current" : ""
                          }`}
                          onClick={() => goToPage(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      );
                    }
                  )}

                  <button
                    className="page-button"
                    disabled={page >= pagination.pages}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
              </h2>

              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={17} />
              </button>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label>Supplier Code</label>
                  <input
                    name="supplierCode"
                    value={form.supplierCode}
                    onChange={handleChange}
                    placeholder="SUP-001"
                  />
                </div>

                <div className="field">
                  <label>Supplier Name *</label>
                  <input
                    name="supplierName"
                    value={form.supplierName}
                    onChange={handleChange}
                    placeholder="Company / Supplier name"
                    required
                  />
                </div>

                <div className="field">
                  <label>Contact Person</label>
                  <input
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Category</label>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Equipment, Office, Construction..."
                  />
                </div>

                <div className="field">
                  <label>Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>City</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Country</label>
                  <input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Tax Number / TIN</label>
                  <input
                    name="taxNumber"
                    value={form.taxNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Registration Number</label>
                  <input
                    name="registrationNumber"
                    value={form.registrationNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Payment Terms</label>
                  <input
                    name="paymentTerms"
                    value={form.paymentTerms}
                    onChange={handleChange}
                    placeholder="Net 30, Advance, etc."
                  />
                </div>

                <div className="field">
                  <label>Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="field">
                  <label>Bank Name</label>
                  <input
                    name="bankName"
                    value={form.bankName}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Bank Account</label>
                  <input
                    name="bankAccount"
                    value={form.bankAccount}
                    onChange={handleChange}
                  />
                </div>

                <div className="field full">
                  <label>Address</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                  />
                </div>

                <div className="field full">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      {editingSupplier ? "Update Supplier" : "Save Supplier"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Supplier Details</h2>

              <button
                className="close-btn"
                onClick={() => setShowDetails(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="details-grid">
              {[
                ["Supplier Code", selectedSupplier.supplierCode],
                ["Supplier Name", selectedSupplier.supplierName],
                ["Contact Person", selectedSupplier.contactPerson],
                ["Phone", selectedSupplier.phone],
                ["Email", selectedSupplier.email],
                ["Category", selectedSupplier.category],
                ["City", selectedSupplier.city],
                ["Country", selectedSupplier.country],
                ["Tax Number", selectedSupplier.taxNumber],
                ["Registration Number", selectedSupplier.registrationNumber],
                ["Payment Terms", selectedSupplier.paymentTerms],
                ["Bank Name", selectedSupplier.bankName],
                ["Bank Account", selectedSupplier.bankAccount],
                ["Status", selectedSupplier.status],
                ["Created", formatDate(selectedSupplier.createdAt)],
                ["Updated", formatDate(selectedSupplier.updatedAt)],
                ["Address", selectedSupplier.address],
                ["Notes", selectedSupplier.notes],
              ].map(([label, value]) => (
                <div
                  className={`detail-item ${
                    label === "Address" || label === "Notes" ? "full" : ""
                  }`}
                  key={label}
                >
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value || "—"}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>

              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedSupplier);
                }}
              >
                <Edit3 size={15} />
                Edit Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal small">
            <div className="delete-content">
              <div className="delete-icon">
                <Trash2 size={24} />
              </div>

              <h3>Delete Supplier?</h3>

              <p>
                This will permanently delete{" "}
                <strong>{selectedSupplier.supplierName}</strong>.
                Make sure the supplier is not referenced by procurement
                records before deleting.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}