import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  X,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Building2,
  CalendarDays,
  Printer,
  ArrowLeft,
  Banknote,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  paymentNumber: "",
  invoiceId: "",
  invoiceNumber: "",
  supplierId: "",
  supplierName: "",
  purchaseOrderId: "",
  purchaseOrderNumber: "",
  departmentId: "",
  departmentName: "",
  paymentDate: "",
  amount: "",
  currency: "ETB",
  paymentMethod: "Bank Transfer",
  referenceNumber: "",
  bankName: "",
  bankAccount: "",
  status: "Pending",
  notes: "",
};

const firstValue = (...values) =>
  values.find(
    (value) => value !== undefined && value !== null && value !== ""
  );

const extractRows = (response) => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.rows)) return payload.rows;

  return [];
};

const extractPagination = (
  response,
  fallbackTotal = 0,
  page = 1,
  pageSize = 10
) => {
  const payload = response?.data ?? response;

  const pagination =
    payload?.pagination ||
    payload?.meta?.pagination ||
    payload?.meta ||
    payload?.pageInfo ||
    {};

  const total = Number(
    firstValue(
      pagination.total,
      pagination.totalItems,
      pagination.totalRecords,
      payload?.total,
      payload?.totalItems,
      fallbackTotal
    )
  );

  const currentPage = Number(
    firstValue(
      pagination.page,
      pagination.currentPage,
      payload?.page,
      page
    )
  );

  const limit = Number(
    firstValue(
      pagination.pageSize,
      pagination.limit,
      pagination.perPage,
      payload?.pageSize,
      pageSize
    )
  );

  const totalPages = Number(
    firstValue(
      pagination.totalPages,
      pagination.pages,
      payload?.totalPages,
      Math.max(1, Math.ceil(total / Math.max(limit, 1)))
    )
  );

  return {
    total: Number.isFinite(total) ? total : fallbackTotal,
    page: Number.isFinite(currentPage) ? currentPage : page,
    pageSize: Number.isFinite(limit) ? limit : pageSize,
    totalPages:
      Number.isFinite(totalPages) && totalPages > 0
        ? totalPages
        : 1,
  };
};

const normalizePayment = (item) => ({
  ...item,

  id: firstValue(
    item.id,
    item.payment_id,
    item.paymentId
  ),

  paymentNumber: firstValue(
    item.paymentNumber,
    item.payment_number,
    item.number,
    item.paymentNo,
    item.payment_no,
    ""
  ),

  invoiceId: firstValue(
    item.invoiceId,
    item.invoice_id,
    ""
  ),

  invoiceNumber: firstValue(
    item.invoiceNumber,
    item.invoice_number,
    item.invoice?.invoiceNumber,
    item.invoice?.invoice_number,
    ""
  ),

  supplierId: firstValue(
    item.supplierId,
    item.supplier_id,
    ""
  ),

  supplierName: firstValue(
    item.supplierName,
    item.supplier_name,
    item.supplier?.name,
    item.vendorName,
    item.vendor_name,
    ""
  ),

  purchaseOrderId: firstValue(
    item.purchaseOrderId,
    item.purchase_order_id,
    ""
  ),

  purchaseOrderNumber: firstValue(
    item.purchaseOrderNumber,
    item.purchase_order_number,
    item.poNumber,
    item.po_number,
    ""
  ),

  departmentId: firstValue(
    item.departmentId,
    item.department_id,
    ""
  ),

  departmentName: firstValue(
    item.departmentName,
    item.department_name,
    item.department?.name,
    ""
  ),

  paymentDate: firstValue(
    item.paymentDate,
    item.payment_date,
    item.date,
    ""
  ),

  amount: Number(
    firstValue(
      item.amount,
      item.paymentAmount,
      item.payment_amount,
      item.totalAmount,
      item.total_amount,
      0
    )
  ),

  currency: firstValue(item.currency, "ETB"),

  paymentMethod: firstValue(
    item.paymentMethod,
    item.payment_method,
    item.method,
    ""
  ),

  referenceNumber: firstValue(
    item.referenceNumber,
    item.reference_number,
    item.reference,
    ""
  ),

  bankName: firstValue(
    item.bankName,
    item.bank_name,
    ""
  ),

  bankAccount: firstValue(
    item.bankAccount,
    item.bank_account,
    ""
  ),

  status: firstValue(
    item.status,
    "Pending"
  ),

  notes: firstValue(
    item.notes,
    ""
  ),

  createdAt: firstValue(
    item.createdAt,
    item.created_at,
    ""
  ),

  updatedAt: firstValue(
    item.updatedAt,
    item.updated_at,
    ""
  ),
});

const formatMoney = (value, currency = "ETB") => {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("paid") ||
    value.includes("completed") ||
    value.includes("approved")
  ) {
    return "status success";
  }

  if (
    value.includes("cancel") ||
    value.includes("rejected") ||
    value.includes("failed") ||
    value.includes("void")
  ) {
    return "status danger";
  }

  if (
    value.includes("pending") ||
    value.includes("draft") ||
    value.includes("processing")
  ) {
    return "status warning";
  }

  return "status info";
};

export default function FinancePayments() {
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [supplier, setSupplier] = useState("");
  const [department, setDepartment] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editingPayment, setEditingPayment] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadPayments = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        pageSize,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (status) {
        params.status = status;
      }

      if (paymentMethod) {
        params.paymentMethod = paymentMethod;
      }

      if (supplier) {
        params.supplier = supplier;
      }

      if (department) {
        params.department = department;
      }

      const response = await api.get(
        "/finance/payments",
        { params }
      );

      const rows = extractRows(response).map(
        normalizePayment
      );

      setPayments(rows);

      setPagination(
        extractPagination(
          response,
          rows.length,
          page,
          pageSize
        )
      );
    } catch (err) {
      console.error(
        "Failed to load payments:",
        err
      );

      setPayments([]);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load payments from the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [
    page,
    pageSize,
    status,
    paymentMethod,
    supplier,
    department,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        loadPayments();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => {
    const total = payments.length;

    const pending = payments.filter((item) =>
      ["pending", "processing", "draft"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const paid = payments.filter((item) =>
      ["paid", "completed"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const failed = payments.filter((item) =>
      ["failed", "rejected", "cancelled", "canceled"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const totalAmount = payments.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0),
      0
    );

    return {
      total,
      pending,
      paid,
      failed,
      totalAmount,
    };
  }, [payments]);

  const openCreate = () => {
    setEditingPayment(null);

    setForm({
      ...emptyForm,
      paymentDate: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (payment) => {
    setEditingPayment(payment);

    setForm({
      paymentNumber:
        payment.paymentNumber || "",

      invoiceId:
        payment.invoiceId || "",

      invoiceNumber:
        payment.invoiceNumber || "",

      supplierId:
        payment.supplierId || "",

      supplierName:
        payment.supplierName || "",

      purchaseOrderId:
        payment.purchaseOrderId || "",

      purchaseOrderNumber:
        payment.purchaseOrderNumber || "",

      departmentId:
        payment.departmentId || "",

      departmentName:
        payment.departmentName || "",

      paymentDate: payment.paymentDate
        ? String(payment.paymentDate).slice(0, 10)
        : "",

      amount:
        payment.amount ?? "",

      currency:
        payment.currency || "ETB",

      paymentMethod:
        payment.paymentMethod ||
        "Bank Transfer",

      referenceNumber:
        payment.referenceNumber || "",

      bankName:
        payment.bankName || "",

      bankAccount:
        payment.bankAccount || "",

      status:
        payment.status || "Pending",

      notes:
        payment.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openDetails = (payment) => {
    setSelectedPayment(payment);
    setShowDetails(true);
  };

  const openDelete = (payment) => {
    setDeleteTarget(payment);
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

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const amount = Number(form.amount || 0);

      if (!form.paymentNumber.trim()) {
        throw new Error(
          "Payment number is required."
        );
      }

      if (!form.supplierName.trim()) {
        throw new Error(
          "Supplier name is required."
        );
      }

      if (!form.paymentDate) {
        throw new Error(
          "Payment date is required."
        );
      }

      if (amount <= 0) {
        throw new Error(
          "Payment amount must be greater than zero."
        );
      }

      const payload = {
        paymentNumber:
          form.paymentNumber.trim(),

        invoiceId:
          form.invoiceId || null,

        invoiceNumber:
          form.invoiceNumber.trim(),

        supplierId:
          form.supplierId || null,

        supplierName:
          form.supplierName.trim(),

        purchaseOrderId:
          form.purchaseOrderId || null,

        purchaseOrderNumber:
          form.purchaseOrderNumber.trim(),

        departmentId:
          form.departmentId || null,

        departmentName:
          form.departmentName.trim(),

        paymentDate:
          form.paymentDate,

        amount,

        currency:
          form.currency,

        paymentMethod:
          form.paymentMethod,

        referenceNumber:
          form.referenceNumber.trim(),

        bankName:
          form.bankName.trim(),

        bankAccount:
          form.bankAccount.trim(),

        status:
          form.status,

        notes:
          form.notes.trim(),
      };

      if (editingPayment?.id) {
        await api.put(
          `/finance/payments/${editingPayment.id}`,
          payload
        );

        setSuccess(
          "Payment updated successfully."
        );
      } else {
        await api.post(
          "/finance/payments",
          payload
        );

        setSuccess(
          "Payment created successfully."
        );
      }

      setShowForm(false);
      setEditingPayment(null);
      setForm(emptyForm);

      await loadPayments();
    } catch (err) {
      console.error(
        "Payment save failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save payment."
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async () => {
    if (!deleteTarget?.id) return;

    setProcessingId(deleteTarget.id);
    setError("");
    setSuccess("");

    try {
      await api.delete(
        `/finance/payments/${deleteTarget.id}`
      );

      setShowDelete(false);
      setDeleteTarget(null);

      setSuccess(
        "Payment deleted successfully."
      );

      if (
        payments.length === 1 &&
        page > 1
      ) {
        setPage(
          (current) => current - 1
        );
      } else {
        await loadPayments();
      }
    } catch (err) {
      console.error(
        "Payment deletion failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to delete payment."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const updateStatus = async (
    payment,
    nextStatus
  ) => {
    if (!payment?.id) return;

    setProcessingId(payment.id);
    setError("");
    setSuccess("");

    try {
      await api.put(
        `/finance/payments/${payment.id}`,
        {
          status: nextStatus,
        }
      );

      setSuccess(
        `Payment marked as ${nextStatus}.`
      );

      await loadPayments();

      if (
        selectedPayment?.id === payment.id
      ) {
        setSelectedPayment({
          ...selectedPayment,
          status: nextStatus,
        });
      }
    } catch (err) {
      console.error(
        "Payment status update failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to update payment status."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentMethod("");
    setSupplier("");
    setDepartment("");
    setPage(1);
  };

  const canApprove = (payment) => {
    const value = String(
      payment.status || ""
    ).toLowerCase();

    return ["pending", "draft"].includes(
      value
    );
  };

  const canCancel = (payment) => {
    const value = String(
      payment.status || ""
    ).toLowerCase();

    return ![
      "paid",
      "completed",
      "cancelled",
      "canceled",
      "void",
    ].includes(value);
  };

  const printPayment = (payment) => {
    const popup = window.open(
      "",
      "_blank",
      "width=850,height=700"
    );

    if (!popup) {
      setError(
        "Please allow pop-ups to print the payment."
      );
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>
          Payment ${payment.paymentNumber || ""}
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #111827;
          }

          h1 {
            margin: 0 0 5px;
          }

          .muted {
            color: #64748b;
          }

          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 35px;
          }

          .section {
            border: 1px solid #d1d5db;
            padding: 18px;
            margin-top: 20px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            padding: 9px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .amount {
            font-size: 24px;
            font-weight: bold;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>Mekdela Amba University</h1>
            <div class="muted">
              Smart University Asset Management System
            </div>
          </div>

          <div>
            <strong>PAYMENT RECEIPT</strong>
            <br/>
            ${payment.paymentNumber || "—"}
          </div>
        </div>

        <div class="section">
          <div class="row">
            <strong>Payment Number</strong>
            <span>
              ${payment.paymentNumber || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Invoice</strong>
            <span>
              ${payment.invoiceNumber || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Supplier</strong>
            <span>
              ${payment.supplierName || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Purchase Order</strong>
            <span>
              ${payment.purchaseOrderNumber || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Department</strong>
            <span>
              ${payment.departmentName || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Payment Date</strong>
            <span>
              ${formatDate(payment.paymentDate)}
            </span>
          </div>

          <div class="row">
            <strong>Payment Method</strong>
            <span>
              ${payment.paymentMethod || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Reference</strong>
            <span>
              ${payment.referenceNumber || "—"}
            </span>
          </div>

          <div class="row">
            <strong>Status</strong>
            <span>
              ${payment.status || "—"}
            </span>
          </div>
        </div>

        <div class="section">
          <div class="amount">
            Amount:
            ${formatMoney(
              payment.amount,
              payment.currency
            )}
          </div>
        </div>
      </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="finance-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .finance-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .finance-container {
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
        }

        .title-area {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .page-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          background:
            linear-gradient(
              135deg,
              #0ea5e9,
              #2563eb
            );
          box-shadow:
            0 10px 25px
            rgba(37, 99, 235, .18);
        }

        .title-area h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
        }

        .title-area p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .top-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 42px;
          padding: 0 15px;
          border-radius: 10px;
          border: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: .2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
          box-shadow:
            0 7px 18px
            rgba(37, 99, 235, .2);
        }

        .btn-secondary {
          background: white;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        .btn-danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .quick-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 22px;
        }

        .quick-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          color: #334155;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        .quick-link:hover {
          color: #2563eb;
          border-color: #93c5fd;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 22px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 17px;
          box-shadow:
            0 5px 20px
            rgba(15, 23, 42, .04);
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 11px;
        }

        .stat-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .stat-icon {
          width: 35px;
          height: 35px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
        }

        .stat-value {
          font-size: 21px;
          font-weight: 800;
        }

        .filters-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 16px;
          margin-bottom: 18px;
        }

        .filters {
          display: grid;
          grid-template-columns:
            minmax(230px, 1.8fr)
            repeat(4, minmax(140px, 1fr))
            auto;
          gap: 10px;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          min-height: 42px;
          border-radius: 9px;
          border: 1px solid #dbe3ed;
          background: white;
          padding: 0 12px;
          outline: none;
          color: #0f172a;
          font-size: 13px;
        }

        .input-wrap .input {
          padding-left: 38px;
        }

        .textarea {
          min-height: 100px;
          padding: 12px;
          resize: vertical;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #60a5fa;
          box-shadow:
            0 0 0 3px
            rgba(59, 130, 246, .1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow:
            0 5px 20px
            rgba(15, 23, 42, .04);
        }

        .table-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .table-header strong {
          font-size: 15px;
        }

        .table-header span {
          color: #64748b;
          font-size: 12px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .5px;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .payment-number {
          color: #2563eb;
          font-weight: 800;
        }

        .supplier-name {
          font-weight: 700;
        }

        .muted {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.success {
          color: #166534;
          background: #dcfce7;
        }

        .status.warning {
          color: #92400e;
          background: #fef3c7;
        }

        .status.danger {
          color: #991b1b;
          background: #fee2e2;
        }

        .status.info {
          color: #1e40af;
          background: #dbeafe;
        }

        .row-actions {
          display: flex;
          gap: 5px;
        }

        .icon-btn {
          width: 33px;
          height: 33px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: #2563eb;
          border-color: #93c5fd;
          background: #eff6ff;
        }

        .icon-btn.danger:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          margin: 0 auto 12px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state h3 {
          margin: 0 0 6px;
          color: #0f172a;
        }

        .empty-state p {
          margin: 0 0 16px;
          font-size: 13px;
        }

        .spinner {
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

        .pagination {
          padding: 13px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border-top: 1px solid #e2e8f0;
          flex-wrap: wrap;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .page-btn {
          width: 35px;
          height: 35px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .page-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .page-number {
          min-width: 35px;
          height: 35px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          color: white;
          border-radius: 8px;
          font-weight: 800;
        }

        .alert {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(900px, 100%);
          max-height: 92vh;
          overflow: auto;
          background: white;
          border-radius: 17px;
          box-shadow:
            0 25px 70px
            rgba(15, 23, 42, .25);
        }

        .modal.small {
          width: min(480px, 100%);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 18px 20px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-title h2 {
          margin: 0;
          font-size: 18px;
        }

        .modal-title p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .close-btn {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
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

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .required {
          color: #dc2626;
        }

        .modal-footer {
          position: sticky;
          bottom: 0;
          padding: 14px 20px;
          background: white;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .detail-box {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fafcff;
        }

        .detail-box span.label {
          display: block;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .4px;
          margin-bottom: 5px;
          font-weight: 800;
        }

        .detail-box strong {
          font-size: 13px;
          word-break: break-word;
        }

        .amount-box {
          padding: 20px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          margin-top: 15px;
          text-align: center;
        }

        .amount-box span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .amount-box strong {
          font-size: 27px;
          color: #1d4ed8;
        }

        .delete-warning {
          padding: 10px 0 15px;
          color: #475569;
          line-height: 1.6;
          font-size: 13px;
        }

        @media (max-width: 1250px) {
          .stats-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .finance-container {
            padding: 16px;
          }

          .topbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .modal-body {
            padding: 15px;
          }

          .modal-footer {
            padding: 12px 15px;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .top-actions,
          .top-actions .btn {
            width: 100%;
          }

          .title-area h1 {
            font-size: 21px;
          }
        }
      `}</style>

      <div className="finance-container">

        {/* HEADER */}
        <div className="topbar">
          <div className="title-area">
            <div className="page-icon">
              <CreditCard size={25} />
            </div>

            <div>
              <h1>Payments</h1>

              <p>
                Manage supplier payments,
                payment methods, references and
                financial settlement status.
              </p>
            </div>
          </div>

          <div className="top-actions">
            <button
              className="btn btn-secondary"
              onClick={loadPayments}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "spinner" : ""
                }
              />
              Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              New Payment
            </button>
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="quick-links">
          <Link
            className="quick-link"
            to="/finance"
          >
            <ArrowLeft size={14} />
            Finance Dashboard
          </Link>

          <Link
            className="quick-link"
            to="/finance/invoices"
          >
            <Receipt size={14} />
            Invoices
          </Link>

          <Link
            className="quick-link"
            to="/finance/transactions"
          >
            <DollarSign size={14} />
            Transactions
          </Link>

          <Link
            className="quick-link"
            to="/finance/purchase-orders"
          >
            <Building2 size={14} />
            Purchase Orders
          </Link>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="alert error">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert success">
            <CheckCircle size={17} />
            <span>{success}</span>
          </div>
        )}

        {/* STATS */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Payments
              </span>

              <div className="stat-icon">
                <CreditCard size={17} />
              </div>
            </div>

            <div className="stat-value">
              {pagination.total ||
                stats.total}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Pending
              </span>

              <div className="stat-icon">
                <Clock size={17} />
              </div>
            </div>

            <div className="stat-value">
              {stats.pending}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Paid
              </span>

              <div className="stat-icon">
                <CheckCircle size={17} />
              </div>
            </div>

            <div className="stat-value">
              {stats.paid}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Failed / Cancelled
              </span>

              <div className="stat-icon">
                <XCircle size={17} />
              </div>
            </div>

            <div className="stat-value">
              {stats.failed}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Payment Value
              </span>

              <div className="stat-icon">
                <Banknote size={17} />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(
                stats.totalAmount
              )}
            </div>
          </div>

        </div>

        {/* FILTERS */}
        <div className="filters-card">
          <div className="filters">

            <div className="input-wrap">
              <Search size={16} />

              <input
                className="input"
                placeholder="Search payment, invoice, supplier, reference..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Statuses
              </option>

              <option value="Draft">
                Draft
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Approved">
                Approved
              </option>

              <option value="Processing">
                Processing
              </option>

              <option value="Paid">
                Paid
              </option>

              <option value="Completed">
                Completed
              </option>

              <option value="Failed">
                Failed
              </option>

              <option value="Cancelled">
                Cancelled
              </option>
            </select>

            <select
              className="select"
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(
                  e.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Methods
              </option>

              <option value="Bank Transfer">
                Bank Transfer
              </option>

              <option value="Cheque">
                Cheque
              </option>

              <option value="Cash">
                Cash
              </option>

              <option value="Mobile Money">
                Mobile Money
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <input
              className="input"
              placeholder="Supplier"
              value={supplier}
              onChange={(e) => {
                setSupplier(
                  e.target.value
                );
                setPage(1);
              }}
            />

            <input
              className="input"
              placeholder="Department"
              value={department}
              onChange={(e) => {
                setDepartment(
                  e.target.value
                );
                setPage(1);
              }}
            />

            <button
              className="btn btn-secondary"
              onClick={clearFilters}
            >
              <Filter size={15} />
              Clear
            </button>

          </div>
        </div>

        {/* TABLE */}
        <div className="table-card">

          <div className="table-header">
            <div>
              <strong>
                Supplier Payments
              </strong>

              <span>
                {" "}
                — page{" "}
                {pagination.page} of{" "}
                {pagination.totalPages}
              </span>
            </div>

            <span>
              {pagination.total} record
              {pagination.total === 1
                ? ""
                : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw
                size={25}
                className="spinner"
              />

              <p>
                Loading payments from
                the backend...
              </p>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                <CreditCard size={24} />
              </div>

              <h3>
                No payments found
              </h3>

              <p>
                No payment records match
                the current filters.
              </p>

              <button
                className="btn btn-primary"
                onClick={openCreate}
              >
                <Plus size={16} />
                Create Payment
              </button>

            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>

                  <thead>
                    <tr>
                      <th>
                        Payment
                      </th>

                      <th>
                        Supplier
                      </th>

                      <th>
                        Invoice
                      </th>

                      <th>
                        Purchase Order
                      </th>

                      <th>
                        Department
                      </th>

                      <th>
                        Payment Date
                      </th>

                      <th>
                        Method
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map(
                      (payment) => (
                        <tr
                          key={
                            payment.id ||
                            payment.paymentNumber
                          }
                        >

                          <td>
                            <div className="payment-number">
                              {payment.paymentNumber ||
                                "—"}
                            </div>

                            {payment.referenceNumber && (
                              <div className="muted">
                                Ref:{" "}
                                {
                                  payment.referenceNumber
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="supplier-name">
                              {payment.supplierName ||
                                "—"}
                            </div>
                          </td>

                          <td>
                            {payment.invoiceNumber ||
                              "—"}
                          </td>

                          <td>
                            {payment.purchaseOrderNumber ||
                              "—"}
                          </td>

                          <td>
                            {payment.departmentName ||
                              "—"}
                          </td>

                          <td>
                            {formatDate(
                              payment.paymentDate
                            )}
                          </td>

                          <td>
                            {payment.paymentMethod ||
                              "—"}
                          </td>

                          <td>
                            <div className="amount">
                              {formatMoney(
                                payment.amount,
                                payment.currency
                              )}
                            </div>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                payment.status
                              )}
                            >
                              {
                                payment.status
                              }
                            </span>
                          </td>

                          <td>
                            <div className="row-actions">

                              <button
                                className="icon-btn"
                                title="View"
                                onClick={() =>
                                  openDetails(
                                    payment
                                  )
                                }
                              >
                                <Eye
                                  size={15}
                                />
                              </button>

                              <button
                                className="icon-btn"
                                title="Edit"
                                onClick={() =>
                                  openEdit(
                                    payment
                                  )
                                }
                              >
                                <Pencil
                                  size={15}
                                />
                              </button>

                              {canApprove(
                                payment
                              ) && (
                                <button
                                  className="icon-btn"
                                  title="Approve"
                                  disabled={
                                    processingId ===
                                    payment.id
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      payment,
                                      "Approved"
                                    )
                                  }
                                >
                                  <CheckCircle
                                    size={15}
                                  />
                                </button>
                              )}

                              {canCancel(
                                payment
                              ) && (
                                <button
                                  className="icon-btn"
                                  title="Cancel"
                                  disabled={
                                    processingId ===
                                    payment.id
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      payment,
                                      "Cancelled"
                                    )
                                  }
                                >
                                  <XCircle
                                    size={15}
                                  />
                                </button>
                              )}

                              <button
                                className="icon-btn"
                                title="Print"
                                onClick={() =>
                                  printPayment(
                                    payment
                                  )
                                }
                              >
                                <Printer
                                  size={15}
                                />
                              </button>

                              <button
                                className="icon-btn danger"
                                title="Delete"
                                onClick={() =>
                                  openDelete(
                                    payment
                                  )
                                }
                              >
                                <Trash2
                                  size={15}
                                />
                              </button>

                            </div>
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>
              </div>

              {/* PAGINATION */}
              <div className="pagination">

                <div className="pagination-info">
                  Showing{" "}
                  {payments.length} of{" "}
                  {pagination.total} payments
                </div>

                <div className="pagination-actions">

                  <select
                    className="select"
                    style={{
                      width: 100,
                      minHeight: 35,
                    }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(
                        Number(
                          e.target.value
                        )
                      );
                      setPage(1);
                    }}
                  >
                    <option value={10}>
                      10 / page
                    </option>

                    <option value={25}>
                      25 / page
                    </option>

                    <option value={50}>
                      50 / page
                    </option>

                    <option value={100}>
                      100 / page
                    </option>
                  </select>

                  <button
                    className="page-btn"
                    disabled={
                      page <= 1
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                  >
                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <div className="page-number">
                    {pagination.page}
                  </div>

                  <button
                    className="page-btn"
                    disabled={
                      page >=
                      pagination.totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            pagination.totalPages,
                            current + 1
                          )
                      )
                    }
                  >
                    <ChevronRight
                      size={16}
                    />
                  </button>

                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal">

            <div className="modal-header">

              <div className="modal-title">

                <div className="stat-icon">
                  <CreditCard
                    size={18}
                  />
                </div>

                <div>
                  <h2>
                    {editingPayment
                      ? "Edit Payment"
                      : "Create Payment"}
                  </h2>

                  <p>
                    Record a real financial
                    payment transaction.
                  </p>
                </div>

              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={17} />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
            >
              <div className="modal-body">

                <div className="form-grid">

                  <div className="field">
                    <label>
                      Payment Number{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      name="paymentNumber"
                      value={
                        form.paymentNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="PAY-2026-0001"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Status
                    </label>

                    <select
                      className="select"
                      name="status"
                      value={form.status}
                      onChange={
                        handleChange
                      }
                    >
                      <option value="Draft">
                        Draft
                      </option>

                      <option value="Pending">
                        Pending
                      </option>

                      <option value="Approved">
                        Approved
                      </option>

                      <option value="Processing">
                        Processing
                      </option>

                      <option value="Paid">
                        Paid
                      </option>

                      <option value="Completed">
                        Completed
                      </option>

                      <option value="Failed">
                        Failed
                      </option>

                      <option value="Cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Supplier Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      name="supplierName"
                      value={
                        form.supplierName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Registered supplier"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Supplier ID
                    </label>

                    <input
                      className="input"
                      name="supplierId"
                      value={
                        form.supplierId
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Supplier database ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Invoice Number
                    </label>

                    <input
                      className="input"
                      name="invoiceNumber"
                      value={
                        form.invoiceNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="INV-2026-0001"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Invoice ID
                    </label>

                    <input
                      className="input"
                      name="invoiceId"
                      value={
                        form.invoiceId
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Invoice database ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Purchase Order Number
                    </label>

                    <input
                      className="input"
                      name="purchaseOrderNumber"
                      value={
                        form.purchaseOrderNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="PO-2026-0001"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Purchase Order ID
                    </label>

                    <input
                      className="input"
                      name="purchaseOrderId"
                      value={
                        form.purchaseOrderId
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="PO database ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Department
                    </label>

                    <input
                      className="input"
                      name="departmentName"
                      value={
                        form.departmentName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Department name"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Department ID
                    </label>

                    <input
                      className="input"
                      name="departmentId"
                      value={
                        form.departmentId
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Department database ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Payment Date{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="paymentDate"
                      value={
                        form.paymentDate
                      }
                      onChange={
                        handleChange
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Amount{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      name="amount"
                      value={form.amount}
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Currency
                    </label>

                    <select
                      className="select"
                      name="currency"
                      value={
                        form.currency
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="ETB">
                        ETB
                      </option>

                      <option value="USD">
                        USD
                      </option>

                      <option value="EUR">
                        EUR
                      </option>

                      <option value="GBP">
                        GBP
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Payment Method
                    </label>

                    <select
                      className="select"
                      name="paymentMethod"
                      value={
                        form.paymentMethod
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="Bank Transfer">
                        Bank Transfer
                      </option>

                      <option value="Cheque">
                        Cheque
                      </option>

                      <option value="Cash">
                        Cash
                      </option>

                      <option value="Mobile Money">
                        Mobile Money
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Reference Number
                    </label>

                    <input
                      className="input"
                      name="referenceNumber"
                      value={
                        form.referenceNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Bank / cheque reference"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Bank Name
                    </label>

                    <input
                      className="input"
                      name="bankName"
                      value={
                        form.bankName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Bank name"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Bank Account
                    </label>

                    <input
                      className="input"
                      name="bankAccount"
                      value={
                        form.bankAccount
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Account reference"
                    />
                  </div>

                  <div className="field full">
                    <label>
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      name="notes"
                      value={form.notes}
                      onChange={
                        handleChange
                      }
                      placeholder="Additional financial notes..."
                    />
                  </div>

                </div>

              </div>

              <div className="modal-footer">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw
                      size={16}
                      className="spinner"
                    />
                  ) : (
                    <Save size={16} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingPayment
                    ? "Update Payment"
                    : "Create Payment"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetails &&
        selectedPayment && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowDetails(false);
              }
            }}
          >
            <div className="modal">

              <div className="modal-header">

                <div className="modal-title">

                  <div className="stat-icon">
                    <Eye size={18} />
                  </div>

                  <div>
                    <h2>
                      Payment Details
                    </h2>

                    <p>
                      {
                        selectedPayment.paymentNumber
                      }
                    </p>
                  </div>

                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setShowDetails(false)
                  }
                >
                  <X size={17} />
                </button>

              </div>

              <div className="modal-body">

                <div className="details-grid">

                  <div className="detail-box">
                    <span className="label">
                      Payment Number
                    </span>

                    <strong>
                      {
                        selectedPayment.paymentNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Status
                    </span>

                    <strong>
                      <span
                        className={statusClass(
                          selectedPayment.status
                        )}
                      >
                        {
                          selectedPayment.status ||
                          "—"
                        }
                      </span>
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Payment Date
                    </span>

                    <strong>
                      {formatDate(
                        selectedPayment.paymentDate
                      )}
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Supplier
                    </span>

                    <strong>
                      {
                        selectedPayment.supplierName ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Invoice
                    </span>

                    <strong>
                      {
                        selectedPayment.invoiceNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Purchase Order
                    </span>

                    <strong>
                      {
                        selectedPayment.purchaseOrderNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Department
                    </span>

                    <strong>
                      {
                        selectedPayment.departmentName ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Payment Method
                    </span>

                    <strong>
                      {
                        selectedPayment.paymentMethod ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Reference
                    </span>

                    <strong>
                      {
                        selectedPayment.referenceNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Bank
                    </span>

                    <strong>
                      {
                        selectedPayment.bankName ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Bank Account
                    </span>

                    <strong>
                      {
                        selectedPayment.bankAccount ||
                        "—"
                      }
                    </strong>
                  </div>

                </div>

                <div className="amount-box">
                  <span>
                    Payment Amount
                  </span>

                  <strong>
                    {formatMoney(
                      selectedPayment.amount,
                      selectedPayment.currency
                    )}
                  </strong>
                </div>

                {selectedPayment.notes && (
                  <div
                    className="detail-box"
                    style={{
                      marginTop: 15,
                    }}
                  >
                    <span className="label">
                      Notes
                    </span>

                    <strong>
                      {
                        selectedPayment.notes
                      }
                    </strong>
                  </div>
                )}

              </div>

              <div className="modal-footer">

                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    printPayment(
                      selectedPayment
                    )
                  }
                >
                  <Printer size={15} />
                  Print
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    openEdit(
                      selectedPayment
                    );
                  }}
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setShowDetails(false)
                  }
                >
                  Close
                </button>

              </div>
            </div>
          </div>
        )}

      {/* DELETE MODAL */}
      {showDelete &&
        deleteTarget && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowDelete(false);
              }
            }}
          >
            <div className="modal small">

              <div className="modal-header">

                <div className="modal-title">

                  <div
                    className="stat-icon"
                    style={{
                      color: "#dc2626",
                      background:
                        "#fef2f2",
                    }}
                  >
                    <Trash2 size={18} />
                  </div>

                  <div>
                    <h2>
                      Delete Payment
                    </h2>

                    <p>
                      This action cannot
                      be undone.
                    </p>
                  </div>

                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setShowDelete(false)
                  }
                >
                  <X size={17} />
                </button>

              </div>

              <div className="modal-body">
                <div className="delete-warning">
                  Are you sure you want to
                  delete payment{" "}
                  <strong>
                    {
                      deleteTarget.paymentNumber ||
                      "this payment"
                    }
                  </strong>
                  ?
                  <br />
                  The backend will process
                  the deletion according to
                  its configured financial
                  rules.
                </div>
              </div>

              <div className="modal-footer">

                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowDelete(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className="btn btn-danger"
                  onClick={
                    deletePayment
                  }
                  disabled={
                    processingId ===
                    deleteTarget.id
                  }
                >
                  {processingId ===
                  deleteTarget.id ? (
                    <RefreshCw
                      size={15}
                      className="spinner"
                    />
                  ) : (
                    <Trash2 size={15} />
                  )}

                  Delete Payment
                </button>

              </div>

            </div>
          </div>
        )}
    </div>
  );
}