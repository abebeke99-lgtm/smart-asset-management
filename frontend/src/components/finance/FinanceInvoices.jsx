import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
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
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import api from "../../services/api";

const emptyItem = {
  description: "",
  quantity: 1,
  unit: "pcs",
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
};

const INVOICE_STATUS_OPTIONS = ["Draft", "Pending", "Approved", "Due", "Paid", "Cancelled"];

const emptyForm = {
  invoiceNumber: "",
  supplierId: "",
  supplierName: "",
  purchaseOrderId: "",
  purchaseOrderNumber: "",
  departmentId: "",
  departmentName: "",
  invoiceDate: "",
  dueDate: "",
  currency: "ETB",
  status: "Pending",
  paymentTerms: "",
  taxNumber: "",
  referenceNumber: "",
  notes: "",
  items: [{ ...emptyItem }],
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const extractRows = (response) => {
  const root = response?.data ?? response;
  const candidates = [root, root?.data, root?.payload];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;

    if (candidate && typeof candidate === 'object') {
      for (const key of ['invoices', 'items', 'records', 'results', 'rows']) {
        if (Array.isArray(candidate[key])) return candidate[key];
      }
    }
  }

  if (root && typeof root === 'object') {
    const nested = root?.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const key of ['invoices', 'items', 'records', 'results', 'rows']) {
        if (Array.isArray(nested[key])) return nested[key];
      }
    }
  }

  return [];
};

export const extractPagination = (response, fallbackTotal = 0, page = 1, pageSize = 10) => {
  const root = response?.data ?? response;
  const paginationSource =
    root?.pagination ||
    root?.meta?.pagination ||
    root?.meta ||
    root?.pageInfo ||
    root?.data?.pagination ||
    root?.data?.meta ||
    root?.data?.pageInfo ||
    {};

  const total = Number(
    firstValue(
      paginationSource.total,
      paginationSource.totalItems,
      paginationSource.totalRecords,
      root?.total,
      root?.totalItems,
      root?.data?.total,
      root?.data?.totalItems,
      fallbackTotal
    )
  );

  const currentPage = Number(
    firstValue(
      paginationSource.page,
      paginationSource.currentPage,
      root?.page,
      root?.data?.page,
      page
    )
  );

  const limit = Number(
    firstValue(
      paginationSource.pageSize,
      paginationSource.limit,
      paginationSource.perPage,
      root?.pageSize,
      root?.data?.pageSize,
      pageSize
    )
  );

  const totalPages = Number(
    firstValue(
      paginationSource.totalPages,
      paginationSource.pages,
      root?.totalPages,
      root?.data?.totalPages,
      Math.max(1, Math.ceil(total / Math.max(limit, 1)))
    )
  );

  return {
    total: Number.isFinite(total) ? total : fallbackTotal,
    page: Number.isFinite(currentPage) ? currentPage : page,
    pageSize: Number.isFinite(limit) ? limit : pageSize,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
  };
};

const normalizeSupplierOption = (item) => ({
  id: firstValue(item?.id, item?.supplierId, item?.supplier_id, ""),
  supplierCode: firstValue(item?.supplierCode, item?.supplier_code, ""),
  supplierName: firstValue(item?.supplierName, item?.supplier_name, item?.name, ""),
  status: firstValue(item?.status, "active"),
  email: firstValue(item?.email, ""),
  phone: firstValue(item?.phone, ""),
});

const normalizePurchaseOrderOption = (item) => ({
  id: firstValue(item?.id, item?.purchaseOrderId, item?.purchase_order_id, ""),
  poNumber: firstValue(item?.poNumber, item?.po_number, item?.orderNumber, item?.order_number, ""),
  supplierName: firstValue(item?.supplierName, item?.supplier_name, item?.supplier?.name, ""),
  departmentName: firstValue(item?.departmentName, item?.department_name, item?.department?.name, ""),
  orderDate: firstValue(item?.orderDate, item?.order_date, item?.createdAt, ""),
  totalAmount: Number(firstValue(item?.totalAmount, item?.total_amount, item?.grandTotal, item?.grand_total, 0)),
  status: firstValue(item?.status, "Draft"),
});

const normalizeInvoice = (item) => ({
  ...item,
  id: firstValue(item.id, item.invoice_id, item.invoiceId),
  invoiceNumber: firstValue(
    item.invoiceNumber,
    item.invoice_number,
    item.number,
    item.invoiceNo,
    item.invoice_no,
    ""
  ),
  supplierId: firstValue(item.supplierId, item.supplier_id, ""),
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
    item.poId,
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
  invoiceDate: firstValue(
    item.invoiceDate,
    item.invoice_date,
    item.date,
    ""
  ),
  dueDate: firstValue(
    item.dueDate,
    item.due_date,
    ""
  ),
  currency: firstValue(item.currency, "ETB"),
  status: firstValue(item.status, "Pending"),
  paymentTerms: firstValue(
    item.paymentTerms,
    item.payment_terms,
    ""
  ),
  taxNumber: firstValue(
    item.taxNumber,
    item.tax_number,
    ""
  ),
  referenceNumber: firstValue(
    item.referenceNumber,
    item.reference_number,
    ""
  ),
  notes: firstValue(item.notes, ""),
  subtotal: Number(
    firstValue(item.subtotal, item.sub_total, item.netAmount, 0)
  ),
  taxAmount: Number(
    firstValue(item.taxAmount, item.tax_amount, 0)
  ),
  discountAmount: Number(
    firstValue(item.discountAmount, item.discount_amount, 0)
  ),
  totalAmount: Number(
    firstValue(
      item.totalAmount,
      item.total_amount,
      item.grandTotal,
      item.grand_total,
      item.amount,
      0
    )
  ),
  paidAmount: Number(
    firstValue(item.paidAmount, item.paid_amount, 0)
  ),
  balanceAmount: Number(
    firstValue(
      item.balanceAmount,
      item.balance_amount,
      item.outstandingAmount,
      item.outstanding_amount,
      0
    )
  ),
  items: Array.isArray(item.items)
    ? item.items.map((line) => ({
        ...line,
        description: firstValue(
          line.description,
          line.itemName,
          line.item_name,
          ""
        ),
        quantity: Number(firstValue(line.quantity, 1)),
        unit: firstValue(line.unit, "pcs"),
        unitPrice: Number(
          firstValue(line.unitPrice, line.unit_price, 0)
        ),
        taxRate: Number(
          firstValue(line.taxRate, line.tax_rate, 0)
        ),
        discount: Number(
          firstValue(line.discount, line.discountAmount, 0)
        ),
      }))
    : [],
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
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusClass = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized.includes("paid") ||
    normalized.includes("approved") ||
    normalized.includes("completed")
  ) {
    return "status success";
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("rejected") ||
    normalized.includes("void")
  ) {
    return "status danger";
  }

  if (
    normalized.includes("draft") ||
    normalized.includes("pending") ||
    normalized.includes("due")
  ) {
    return "status warning";
  }

  return "status info";
};

const getInvoiceTotals = (items = []) => {
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    const taxRate = Number(item.taxRate || 0);

    const gross = quantity * unitPrice;
    const taxable = Math.max(gross - discount, 0);

    subtotal += gross;
    discountAmount += discount;
    taxAmount += taxable * (taxRate / 100);
  });

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
  };
};

export default function FinanceInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
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

  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState([]);
  const [invoiceSummary, setInvoiceSummary] = useState({ total: 0, totalValue: 0, outstanding: 0 });

  const [form, setForm] = useState(emptyForm);

  const loadReferenceData = async () => {
    try {
      const [supplierResponse, poResponse] = await Promise.all([
        api.get("/finance/suppliers", { params: { page: 1, limit: 200 } }),
        api.get("/finance/purchase-orders", { params: { page: 1, limit: 200 } }),
      ]);

      const supplierRows = extractRows(supplierResponse).map(normalizeSupplierOption);
      const purchaseRows = extractRows(poResponse).map(normalizePurchaseOrderOption);

      setSupplierOptions(supplierRows.filter((item) => item.supplierName));
      setPurchaseOrderOptions(purchaseRows.filter((item) => item.poNumber));
    } catch (error) {
      console.error("Failed to load invoice reference data:", error);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        pageSize,
      };

      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (supplier) params.supplier = supplier;
      if (department) params.department = department;

      const response = await api.get("/finance/invoices", { params });

      const rows = extractRows(response).map(normalizeInvoice);
      const summary = response?.data?.summary || response?.summary || response?.data?.data?.summary || {};

      setInvoices(rows);
      setInvoiceSummary({
        total: Number(summary.total ?? rows.length ?? 0),
        totalValue: Number(summary.totalValue ?? rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0)),
        outstanding: Number(summary.outstanding ?? rows.reduce((sum, row) => sum + Number(row.balanceAmount || 0), 0)),
      });
      setPagination(
        extractPagination(response, rows.length, page, pageSize)
      );
    } catch (err) {
      console.error("Failed to load invoices:", err);

      setInvoices([]);
      setInvoiceSummary({ total: 0, totalValue: 0, outstanding: 0 });
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load invoices from the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [page, pageSize, status, supplier, department]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        loadInvoices();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => {
    const total = invoiceSummary.total || invoices.length;

    const pending = invoices.filter((item) =>
      ["pending", "draft", "due"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const paid = invoices.filter((item) =>
      String(item.status).toLowerCase().includes("paid")
    ).length;

    const cancelled = invoices.filter((item) =>
      ["cancelled", "canceled", "rejected", "void"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const totalValue = invoiceSummary.totalValue || invoices.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0
    );

    const outstanding = invoiceSummary.outstanding || invoices.reduce(
      (sum, item) =>
        sum +
        Number(
          item.balanceAmount ||
            Math.max(
              Number(item.totalAmount || 0) -
                Number(item.paidAmount || 0),
              0
            )
        ),
      0
    );

    return {
      total,
      pending,
      paid,
      cancelled,
      totalValue,
      outstanding,
    };
  }, [invoices, invoiceSummary]);

  const openCreate = () => {
    setEditingInvoice(null);
    setForm({
      ...emptyForm,
      invoiceDate: new Date().toISOString().slice(0, 10),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const setSupplierSelection = (supplierId) => {
    const selectedSupplier = supplierOptions.find((option) => String(option.id) === String(supplierId));
    setForm((previous) => ({
      ...previous,
      supplierId: supplierId || "",
      supplierName: selectedSupplier?.supplierName || previous.supplierName,
    }));
  };

  const setPurchaseOrderSelection = (purchaseOrderId) => {
    const selectedOrder = purchaseOrderOptions.find((option) => String(option.id) === String(purchaseOrderId));
    setForm((previous) => ({
      ...previous,
      purchaseOrderId: purchaseOrderId || "",
      purchaseOrderNumber: selectedOrder?.poNumber || previous.purchaseOrderNumber,
      supplierName: selectedOrder?.supplierName || previous.supplierName,
    }));
  };

  const openEdit = (invoice) => {
    setEditingInvoice(invoice);

    setForm({
      invoiceNumber: invoice.invoiceNumber || "",
      supplierId: invoice.supplierId || "",
      supplierName: invoice.supplierName || "",
      purchaseOrderId: invoice.purchaseOrderId || "",
      purchaseOrderNumber: invoice.purchaseOrderNumber || "",
      departmentId: invoice.departmentId || "",
      departmentName: invoice.departmentName || "",
      invoiceDate: invoice.invoiceDate
        ? String(invoice.invoiceDate).slice(0, 10)
        : "",
      dueDate: invoice.dueDate
        ? String(invoice.dueDate).slice(0, 10)
        : "",
      currency: invoice.currency || "ETB",
      status: invoice.status || "Pending",
      paymentTerms: invoice.paymentTerms || "",
      taxNumber: invoice.taxNumber || "",
      referenceNumber: invoice.referenceNumber || "",
      notes: invoice.notes || "",
      items:
        invoice.items?.length > 0
          ? invoice.items.map((item) => ({
              description: item.description || "",
              quantity: Number(item.quantity || 1),
              unit: item.unit || "pcs",
              unitPrice: Number(item.unitPrice || 0),
              taxRate: Number(item.taxRate || 0),
              discount: Number(item.discount || 0),
            }))
          : [{ ...emptyItem }],
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const loadInvoicePaymentHistory = async (invoiceId) => {
    if (!invoiceId) {
      setInvoicePayments([]);
      return;
    }

    setPaymentHistoryLoading(true);
    try {
      const response = await api.get(`/finance/invoices/${invoiceId}/payments`);
      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      setInvoicePayments(rows);
    } catch (err) {
      console.error("Failed to load invoice payment history:", err);
      setInvoicePayments([]);
    } finally {
      setPaymentHistoryLoading(false);
    }
  };

  const openDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setInvoicePayments([]);
    setShowDetails(true);
    loadInvoicePaymentHistory(invoice?.id);
  };

  const openDelete = (invoice) => {
    setDeleteTarget(invoice);
    setShowDelete(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "supplierId") {
      const selectedSupplier = supplierOptions.find((option) => String(option.id) === String(value));
      setForm((previous) => ({
        ...previous,
        supplierId: value,
        supplierName: selectedSupplier?.supplierName || previous.supplierName,
      }));
      return;
    }

    if (name === "purchaseOrderId") {
      const selectedOrder = purchaseOrderOptions.find((option) => String(option.id) === String(value));
      setForm((previous) => ({
        ...previous,
        purchaseOrderId: value,
        purchaseOrderNumber: selectedOrder?.poNumber || previous.purchaseOrderNumber,
        supplierId: selectedOrder?.supplierName ? previous.supplierId : previous.supplierId,
        supplierName: selectedOrder?.supplierName || previous.supplierName,
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setForm((previous) => {
      const items = [...previous.items];

      items[index] = {
        ...items[index],
        [field]:
          ["quantity", "unitPrice", "taxRate", "discount"].includes(field)
            ? value
            : value,
      };

      return {
        ...previous,
        items,
      };
    });
  };

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [...previous.items, { ...emptyItem }],
    }));
  };

  const removeItem = (index) => {
    setForm((previous) => {
      if (previous.items.length === 1) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const formTotals = useMemo(
    () => getInvoiceTotals(form.items),
    [form.items]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        invoiceNumber: form.invoiceNumber.trim(),
        supplierId: form.supplierId || null,
        supplierName: form.supplierName.trim(),
        purchaseOrderId: form.purchaseOrderId || null,
        purchaseOrderNumber: form.purchaseOrderNumber.trim(),
        departmentId: form.departmentId || null,
        departmentName: form.departmentName.trim(),
        invoiceDate: form.invoiceDate || null,
        dueDate: form.dueDate || null,
        currency: form.currency,
        status: form.status,
        paymentTerms: form.paymentTerms.trim(),
        taxNumber: form.taxNumber.trim(),
        referenceNumber: form.referenceNumber.trim(),
        notes: form.notes.trim(),

        items: form.items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity || 0),
          unit: item.unit,
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate || 0),
          discount: Number(item.discount || 0),
        })),

        subtotal: formTotals.subtotal,
        discountAmount: formTotals.discountAmount,
        taxAmount: formTotals.taxAmount,
        totalAmount: formTotals.total,
      };

      if (!payload.invoiceNumber) {
        throw new Error("Invoice number is required.");
      }

      if (!payload.supplierName) {
        throw new Error("Supplier name is required.");
      }

      if (!payload.invoiceDate) {
        throw new Error("Invoice date is required.");
      }

      if (!payload.items.length) {
        throw new Error("At least one invoice item is required.");
      }

      if (editingInvoice?.id) {
        await api.put(
          `/finance/invoices/${editingInvoice.id}`,
          payload
        );

        setSuccess("Invoice updated successfully.");
      } else {
        await api.post("/finance/invoices", payload);

        setSuccess("Invoice created successfully.");
      }

      setShowForm(false);
      setEditingInvoice(null);
      setForm(emptyForm);

      await loadInvoices();
    } catch (err) {
      console.error("Invoice save failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save invoice."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoice = async () => {
    if (!deleteTarget?.id) return;

    setProcessingId(deleteTarget.id);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/finance/invoices/${deleteTarget.id}`);

      setShowDelete(false);
      setDeleteTarget(null);

      setSuccess("Invoice deleted successfully.");

      if (invoices.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadInvoices();
      }
    } catch (err) {
      console.error("Invoice deletion failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to delete invoice."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const updateStatus = async (invoice, nextStatus) => {
    if (!invoice?.id) return;

    setProcessingId(invoice.id);
    setError("");
    setSuccess("");

    try {
      const endpoint = nextStatus === "Verified"
        ? `/finance/invoices/${invoice.id}/verify`
        : nextStatus === "Approved"
          ? `/finance/invoices/${invoice.id}/approve`
          : `/finance/invoices/${invoice.id}`;
      if (nextStatus === "Cancelled") {
        await api.put(endpoint, { status: nextStatus });
      } else {
        await api.post(endpoint);
      }

      setSuccess(`Invoice marked as ${nextStatus}.`);

      await loadInvoices();

      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: nextStatus,
        });
      }
    } catch (err) {
      console.error("Invoice status update failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to update invoice status."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const printInvoice = (invoice) => {
    const popup = window.open("", "_blank", "width=900,height=700");

    if (!popup) {
      setError("Please allow pop-ups to print the invoice.");
      return;
    }

    const totals = getInvoiceTotals(invoice.items || []);

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoiceNumber || ""}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #111827;
          }
          h1 { margin-bottom: 4px; }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .muted { color: #6b7280; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 10px;
            text-align: left;
          }
          th { background: #f3f4f6; }
          .totals {
            margin-left: auto;
            margin-top: 25px;
            width: 320px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
          }
          .grand {
            border-top: 2px solid #111827;
            font-weight: bold;
            font-size: 18px;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Mekdela Amba University</h1>
            <div class="muted">University Asset Management System</div>
          </div>
          <div>
            <strong>INVOICE</strong><br/>
            ${invoice.invoiceNumber || "—"}
          </div>
        </div>

        <p><strong>Supplier:</strong> ${
          invoice.supplierName || "—"
        }</p>
        <p><strong>Department:</strong> ${
          invoice.departmentName || "—"
        }</p>
        <p><strong>Invoice Date:</strong> ${
          formatDate(invoice.invoiceDate)
        }</p>
        <p><strong>Due Date:</strong> ${
          formatDate(invoice.dueDate)
        }</p>
        <p><strong>Status:</strong> ${
          invoice.status || "—"
        }</p>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Tax</th>
              <th>Discount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || [])
              .map((item) => {
                const quantity = Number(item.quantity || 0);
                const price = Number(item.unitPrice || 0);
                const discount = Number(item.discount || 0);
                const taxRate = Number(item.taxRate || 0);
                const gross = quantity * price;
                const taxable = Math.max(gross - discount, 0);
                const tax = taxable * (taxRate / 100);
                const total = taxable + tax;

                return `
                  <tr>
                    <td>${item.description || "—"}</td>
                    <td>${quantity}</td>
                    <td>${item.unit || "pcs"}</td>
                    <td>${formatMoney(price, invoice.currency)}</td>
                    <td>${taxRate}%</td>
                    <td>${formatMoney(
                      discount,
                      invoice.currency
                    )}</td>
                    <td>${formatMoney(
                      total,
                      invoice.currency
                    )}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${formatMoney(
              totals.subtotal,
              invoice.currency
            )}</span>
          </div>
          <div class="total-row">
            <span>Discount</span>
            <span>${formatMoney(
              totals.discountAmount,
              invoice.currency
            )}</span>
          </div>
          <div class="total-row">
            <span>Tax</span>
            <span>${formatMoney(
              totals.taxAmount,
              invoice.currency
            )}</span>
          </div>
          <div class="total-row grand">
            <span>Total</span>
            <span>${formatMoney(
              totals.total,
              invoice.currency
            )}</span>
          </div>
        </div>
      </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setSupplier("");
    setDepartment("");
    setPage(1);
  };

  const supplierFilterOptions = supplierOptions.map((supplier) => ({
    value: supplier.supplierName,
    label: supplier.supplierName,
  }));

  const canApprove = (invoice) => {
    const current = String(invoice.status || "").toLowerCase();

    return ["pending", "draft"].includes(current) && invoice.verificationStatus === "Verified";
  };

  const canVerify = (invoice) => String(invoice.verificationStatus || "Pending").toLowerCase() === "pending";

  const canCancel = (invoice) => {
    const current = String(invoice.status || "").toLowerCase();

    return !["paid", "cancelled", "canceled", "void"].includes(current);
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
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .finance-container {
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 25px;
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
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color: white;
          box-shadow: 0 10px 25px rgba(37, 99, 235, .18);
        }

        .title-area h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -.4px;
        }

        .title-area p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 0;
          border-radius: 10px;
          min-height: 42px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          transition: .2s ease;
          text-decoration: none;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn-primary {
          color: white;
          background: #2563eb;
          box-shadow: 0 7px 18px rgba(37, 99, 235, .2);
        }

        .btn-secondary {
          color: #0f172a;
          background: white;
          border: 1px solid #e2e8f0;
        }

        .btn-danger {
          color: #b91c1c;
          background: #fee2e2;
        }

        .btn-success {
          color: #166534;
          background: #dcfce7;
        }

        .quick-links {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .quick-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          text-decoration: none;
          color: #334155;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 700;
        }

        .quick-link:hover {
          color: #2563eb;
          border-color: #93c5fd;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 22px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 17px;
          box-shadow: 0 5px 20px rgba(15, 23, 42, .04);
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
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
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-value {
          font-size: 21px;
          font-weight: 800;
          color: #0f172a;
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
          grid-template-columns: minmax(220px, 1.8fr) repeat(3, minmax(150px, 1fr)) auto;
          gap: 10px;
          align-items: center;
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
          border: 1px solid #dbe3ed;
          background: white;
          border-radius: 9px;
          min-height: 42px;
          padding: 0 12px;
          outline: none;
          font-size: 13px;
          color: #0f172a;
        }

        .input-wrap .input {
          padding-left: 38px;
        }

        .textarea {
          padding: 12px;
          min-height: 95px;
          resize: vertical;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, .1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 5px 20px rgba(15, 23, 42, .04);
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
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .5px;
          padding: 13px 15px;
          border-bottom: 1px solid #e2e8f0;
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

        .invoice-number {
          font-weight: 800;
          color: #2563eb;
        }

        .supplier-name {
          font-weight: 700;
          color: #0f172a;
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
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .empty-state h3 {
          color: #0f172a;
          margin: 0 0 6px;
        }

        .empty-state p {
          margin: 0 0 16px;
          font-size: 13px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pagination {
          padding: 13px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          border: 0;
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
          width: min(950px, 100%);
          max-height: 92vh;
          overflow: auto;
          background: white;
          border-radius: 17px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, .25);
        }

        .modal.small {
          width: min(480px, 100%);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          background: white;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
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

        .items-section {
          margin-top: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .items-header {
          padding: 12px 14px;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .items-header strong {
          font-size: 13px;
        }

        .items-table {
          overflow-x: auto;
        }

        .items-table table {
          min-width: 800px;
        }

        .items-table td {
          padding: 9px;
        }

        .item-input {
          min-height: 37px;
          width: 100%;
          border: 1px solid #dbe3ed;
          border-radius: 7px;
          padding: 0 8px;
          font-size: 12px;
        }

        .form-summary {
          display: flex;
          justify-content: flex-end;
          margin-top: 15px;
        }

        .summary-box {
          width: min(360px, 100%);
          background: #f8fafc;
          border-radius: 11px;
          padding: 13px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 5px 0;
          color: #475569;
          font-size: 13px;
        }

        .summary-row.total {
          border-top: 1px solid #cbd5e1;
          margin-top: 7px;
          padding-top: 11px;
          color: #0f172a;
          font-size: 16px;
          font-weight: 800;
        }

        .modal-footer {
          position: sticky;
          bottom: 0;
          background: white;
          border-top: 1px solid #e2e8f0;
          padding: 14px 20px;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .detail-box {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          background: #fafcff;
        }

        .detail-box span {
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

        .delete-warning {
          padding: 10px 0 15px;
          color: #475569;
          line-height: 1.6;
          font-size: 13px;
        }

        .delete-warning strong {
          color: #0f172a;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .finance-container {
            padding: 16px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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

          .top-actions .btn {
            justify-content: center;
          }

          .title-area h1 {
            font-size: 21px;
          }
        }
      `}</style>

      <div className="finance-container">
        <div className="topbar">
          <div className="title-area">
            <div className="page-icon">
              <Receipt size={25} />
            </div>

            <div>
              <h1>Invoices</h1>
              <p>
                Manage supplier invoices, amounts, due dates and payment status.
              </p>
            </div>
          </div>

          <div className="top-actions">
            <button
              className="btn btn-secondary"
              onClick={loadInvoices}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spinner" : ""}
              />
              Refresh
            </button>

            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={17} />
              Register Invoice
            </button>
          </div>
        </div>

        <div className="quick-links">
          <Link className="quick-link" to="/finance">
            <ArrowLeft size={14} />
            Finance Dashboard
          </Link>

          <Link className="quick-link" to="/finance/purchase-orders">
            <FileText size={14} />
            Purchase Orders
          </Link>

          <Link className="quick-link" to="/finance/payments">
            <CreditCard size={14} />
            Payments
          </Link>

          <Link className="quick-link" to="/finance/transactions">
            <DollarSign size={14} />
            Transactions
          </Link>
        </div>

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

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Invoices</span>
              <div className="stat-icon">
                <Receipt size={17} />
              </div>
            </div>
            <div className="stat-value">
              {pagination.total || stats.total}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Pending</span>
              <div className="stat-icon">
                <Clock size={17} />
              </div>
            </div>
            <div className="stat-value">{stats.pending}</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Paid</span>
              <div className="stat-icon">
                <CheckCircle size={17} />
              </div>
            </div>
            <div className="stat-value">{stats.paid}</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Invoice Value</span>
              <div className="stat-icon">
                <DollarSign size={17} />
              </div>
            </div>
            <div className="stat-value">
              {formatMoney(stats.totalValue)}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Outstanding</span>
              <div className="stat-icon">
                <AlertCircle size={17} />
              </div>
            </div>
            <div className="stat-value">
              {formatMoney(stats.outstanding)}
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="filters">
            <div className="input-wrap">
              <Search size={16} />
              <input
                className="input"
                placeholder="Search invoice, supplier, PO, tax number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              <option value="">All Statuses</option>
              {INVOICE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              className="select"
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Suppliers</option>
              {supplierFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <input
              className="input"
              placeholder="Department"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
            />

            <button className="btn btn-secondary" onClick={clearFilters}>
              <Filter size={15} />
              Clear
            </button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <strong>Supplier Invoices</strong>
              <span>
                {" "}
                — page {pagination.page} of {pagination.totalPages}
              </span>
            </div>

            <span>
              {pagination.total} record
              {pagination.total === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw size={25} className="spinner" />
              <p>Loading invoices from the backend...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Receipt size={24} />
              </div>

              <h3>No invoices found</h3>

              <p>
                No invoice records match the current filters.
                Create an invoice when a real supplier invoice is available.
              </p>

              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={16} />
                Register Invoice
              </button>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>PO</th>
                      <th>Department</th>
                      <th>Invoice Date</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id || invoice.invoiceNumber}>
                        <td>
                          <div className="invoice-number">
                            {invoice.invoiceNumber || "—"}
                          </div>

                          {invoice.referenceNumber && (
                            <div className="muted">
                              Ref: {invoice.referenceNumber}
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="supplier-name">
                            {invoice.supplierName || "—"}
                          </div>

                          {invoice.taxNumber && (
                            <div className="muted">
                              TIN: {invoice.taxNumber}
                            </div>
                          )}
                        </td>

                        <td>
                          {invoice.purchaseOrderNumber || "—"}
                        </td>

                        <td>
                          {invoice.departmentName || "—"}
                        </td>

                        <td>
                          {formatDate(invoice.invoiceDate)}
                        </td>

                        <td>
                          {formatDate(invoice.dueDate)}
                        </td>

                        <td>
                          <div className="amount">
                            {formatMoney(
                              invoice.totalAmount,
                              invoice.currency
                            )}
                          </div>

                          {invoice.paidAmount > 0 && (
                            <div className="muted">
                              Paid:{" "}
                              {formatMoney(
                                invoice.paidAmount,
                                invoice.currency
                              )}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className={statusClass(invoice.status)}>
                            {String(invoice.status || "Pending")}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              title="View"
                              onClick={() => openDetails(invoice)}
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              className="icon-btn"
                              title="Edit"
                              onClick={() => openEdit(invoice)}
                            >
                              <Pencil size={15} />
                            </button>

                            {canApprove(invoice) && (
                              <button
                                className="icon-btn"
                                title="Approve"
                                disabled={processingId === invoice.id}
                                onClick={() =>
                                  updateStatus(invoice, "Approved")
                                }
                              >
                                <CheckCircle size={15} />
                              </button>
                            )}

                            {canVerify(invoice) && (
                              <button
                                className="icon-btn"
                                title="Verify"
                                disabled={processingId === invoice.id}
                                onClick={() => updateStatus(invoice, "Verified")}
                              >
                                <CheckCircle size={15} />
                              </button>
                            )}

                            {canCancel(invoice) && (
                              <button
                                className="icon-btn"
                                title="Cancel"
                                disabled={processingId === invoice.id}
                                onClick={() =>
                                  updateStatus(invoice, "Cancelled")
                                }
                              >
                                <XCircle size={15} />
                              </button>
                            )}

                            <button
                              className="icon-btn"
                              title="Print"
                              onClick={() => printInvoice(invoice)}
                            >
                              <Printer size={15} />
                            </button>

                            <button
                              className="icon-btn danger"
                              title="Delete"
                              onClick={() => openDelete(invoice)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing {invoices.length} of {pagination.total} invoices
                </div>

                <div className="pagination-actions">
                  <select
                    className="select"
                    style={{ width: 100, minHeight: 35 }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>

                  <button
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="page-number">{pagination.page}</div>

                  <button
                    className="page-btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.totalPages,
                          current + 1
                        )
                      )
                    }
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
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                <div className="stat-icon">
                  <Receipt size={18} />
                </div>

                <div>
                  <h2>
                    {editingInvoice
                      ? "Edit Invoice"
                      : "Create Invoice"}
                  </h2>

                  <p>
                    Enter the real supplier invoice information.
                  </p>
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Invoice Number <span className="required">*</span>
                    </label>

                    <input
                      className="input"
                      name="invoiceNumber"
                      value={form.invoiceNumber}
                      onChange={handleChange}
                      placeholder="INV-2026-0001"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Status</label>

                    <select
                      className="select"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      {INVOICE_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Supplier <span className="required">*</span>
                    </label>

                    <select
                      className="select"
                      name="supplierId"
                      value={form.supplierId || ""}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select real supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Supplier Name</label>

                    <input
                      className="input"
                      name="supplierName"
                      value={form.supplierName}
                      onChange={handleChange}
                      placeholder="Selected supplier name"
                    />
                  </div>

                  <div className="field">
                    <label>Purchase Order</label>

                    <select
                      className="select"
                      name="purchaseOrderId"
                      value={form.purchaseOrderId || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select purchase order</option>
                      {purchaseOrderOptions.map((order) => (
                        <option key={order.id} value={order.id}>{order.poNumber} — {order.supplierName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Purchase Order Number</label>

                    <input
                      className="input"
                      name="purchaseOrderNumber"
                      value={form.purchaseOrderNumber}
                      onChange={handleChange}
                      placeholder="Selected PO number"
                    />
                  </div>

                  <div className="field">
                    <label>Department</label>

                    <input
                      className="input"
                      name="departmentName"
                      value={form.departmentName}
                      onChange={handleChange}
                      placeholder="Department name"
                    />
                  </div>

                  <div className="field">
                    <label>Department ID</label>

                    <input
                      className="input"
                      name="departmentId"
                      value={form.departmentId}
                      onChange={handleChange}
                      placeholder="Department database ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Invoice Date <span className="required">*</span>
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="invoiceDate"
                      value={form.invoiceDate}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Due Date</label>

                    <input
                      className="input"
                      type="date"
                      name="dueDate"
                      value={form.dueDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="field">
                    <label>Currency</label>

                    <select
                      className="select"
                      name="currency"
                      value={form.currency}
                      onChange={handleChange}
                    >
                      <option value="ETB">ETB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Payment Terms</label>

                    <input
                      className="input"
                      name="paymentTerms"
                      value={form.paymentTerms}
                      onChange={handleChange}
                      placeholder="30 days"
                    />
                  </div>

                  <div className="field">
                    <label>Tax Number / TIN</label>

                    <input
                      className="input"
                      name="taxNumber"
                      value={form.taxNumber}
                      onChange={handleChange}
                      placeholder="Supplier TIN"
                    />
                  </div>

                  <div className="field">
                    <label>Reference Number</label>

                    <input
                      className="input"
                      name="referenceNumber"
                      value={form.referenceNumber}
                      onChange={handleChange}
                      placeholder="External/reference number"
                    />
                  </div>

                  <div className="field full">
                    <label>Notes</label>

                    <textarea
                      className="textarea"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Additional financial notes..."
                    />
                  </div>
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <strong>Invoice Items</strong>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addItem}
                    >
                      <Plus size={14} />
                      Add Item
                    </button>
                  </div>

                  <div className="items-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Tax %</th>
                          <th>Discount</th>
                          <th></th>
                        </tr>
                      </thead>

                      <tbody>
                        {form.items.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                className="item-input"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "description",
                                    e.target.value
                                  )
                                }
                                placeholder="Item/service"
                              />
                            </td>

                            <td style={{ width: 90 }}>
                              <input
                                className="item-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                              />
                            </td>

                            <td style={{ width: 90 }}>
                              <input
                                className="item-input"
                                value={item.unit}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "unit",
                                    e.target.value
                                  )
                                }
                              />
                            </td>

                            <td style={{ width: 130 }}>
                              <input
                                className="item-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "unitPrice",
                                    e.target.value
                                  )
                                }
                              />
                            </td>

                            <td style={{ width: 90 }}>
                              <input
                                className="item-input"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.taxRate}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "taxRate",
                                    e.target.value
                                  )
                                }
                              />
                            </td>

                            <td style={{ width: 110 }}>
                              <input
                                className="item-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "discount",
                                    e.target.value
                                  )
                                }
                              />
                            </td>

                            <td>
                              <button
                                type="button"
                                className="icon-btn danger"
                                onClick={() => removeItem(index)}
                                disabled={form.items.length === 1}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="form-summary">
                  <div className="summary-box">
                    <div className="summary-row">
                      <span>Subtotal</span>
                      <strong>
                        {formatMoney(
                          formTotals.subtotal,
                          form.currency
                        )}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Discount</span>
                      <strong>
                        {formatMoney(
                          formTotals.discountAmount,
                          form.currency
                        )}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Tax</span>
                      <strong>
                        {formatMoney(
                          formTotals.taxAmount,
                          form.currency
                        )}
                      </strong>
                    </div>

                    <div className="summary-row total">
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          formTotals.total,
                          form.currency
                        )}
                      </strong>
                    </div>
                  </div>
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
                    <RefreshCw size={16} className="spinner" />
                  ) : (
                    <Save size={16} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingInvoice
                    ? "Update Invoice"
                    : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedInvoice && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
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
                  <h2>Invoice Details</h2>
                  <p>{selectedInvoice.invoiceNumber || "Invoice"}</p>
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() => setShowDetails(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-box">
                  <span>Invoice Number</span>
                  <strong>
                    {selectedInvoice.invoiceNumber || "—"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Status</span>
                  <strong>
                    <span
                      className={statusClass(
                        selectedInvoice.status
                      )}
                    >
                      {selectedInvoice.status || "—"}
                    </span>
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Supplier</span>
                  <strong>
                    {selectedInvoice.supplierName || "—"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Purchase Order</span>
                  <strong>
                    {selectedInvoice.purchaseOrderNumber || "—"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Department</span>
                  <strong>
                    {selectedInvoice.departmentName || "—"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Invoice Date</span>
                  <strong>
                    {formatDate(selectedInvoice.invoiceDate)}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Due Date</span>
                  <strong>
                    {formatDate(selectedInvoice.dueDate)}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Payment Terms</span>
                  <strong>
                    {selectedInvoice.paymentTerms || "—"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Tax Number</span>
                  <strong>
                    {selectedInvoice.taxNumber || "—"}
                  </strong>
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <strong>Invoice Items</strong>
                </div>

                <div className="items-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Unit Price</th>
                        <th>Tax</th>
                        <th>Discount</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedInvoice.items || []).map(
                        (item, index) => {
                          const quantity = Number(
                            item.quantity || 0
                          );
                          const unitPrice = Number(
                            item.unitPrice || 0
                          );
                          const discount = Number(
                            item.discount || 0
                          );
                          const taxRate = Number(
                            item.taxRate || 0
                          );

                          const gross =
                            quantity * unitPrice;
                          const taxable = Math.max(
                            gross - discount,
                            0
                          );
                          const tax =
                            taxable * (taxRate / 100);
                          const total = taxable + tax;

                          return (
                            <tr key={index}>
                              <td>
                                {item.description || "—"}
                              </td>
                              <td>{quantity}</td>
                              <td>{item.unit || "pcs"}</td>
                              <td>
                                {formatMoney(
                                  unitPrice,
                                  selectedInvoice.currency
                                )}
                              </td>
                              <td>{taxRate}%</td>
                              <td>
                                {formatMoney(
                                  discount,
                                  selectedInvoice.currency
                                )}
                              </td>
                              <td className="amount">
                                {formatMoney(
                                  total,
                                  selectedInvoice.currency
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="form-summary">
                <div className="summary-box">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <strong>
                      {formatMoney(
                        selectedInvoice.subtotal,
                        selectedInvoice.currency
                      )}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Tax</span>
                    <strong>
                      {formatMoney(
                        selectedInvoice.taxAmount,
                        selectedInvoice.currency
                      )}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Paid</span>
                    <strong>
                      {formatMoney(
                        selectedInvoice.paidAmount,
                        selectedInvoice.currency
                      )}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Outstanding</span>
                    <strong>
                      {formatMoney(
                        selectedInvoice.balanceAmount,
                        selectedInvoice.currency
                      )}
                    </strong>
                  </div>

                  <div className="summary-row total">
                    <span>Total</span>
                    <strong>
                      {formatMoney(
                        selectedInvoice.totalAmount,
                        selectedInvoice.currency
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="items-header" style={{ marginBottom: 12 }}>
                  <strong>Payment History</strong>
                </div>

                {paymentHistoryLoading ? (
                  <div className="loading-state" style={{ padding: "24px 20px" }}>
                    <RefreshCw size={18} className="spinner" />
                    <p>Loading payment history...</p>
                  </div>
                ) : invoicePayments.length === 0 ? (
                  <div className="empty-state" style={{ padding: "24px 20px" }}>
                    <div className="empty-icon">
                      <CreditCard size={18} />
                    </div>
                    <h3>No payment records</h3>
                    <p>No real payment history has been recorded for this invoice yet.</p>
                  </div>
                ) : (
                  <div className="items-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Payment No.</th>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>Reference</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicePayments.map((payment) => (
                          <tr key={payment.id || payment.paymentNumber}>
                            <td>{payment.paymentNumber || "—"}</td>
                            <td>{formatDate(payment.paymentDate)}</td>
                            <td>{payment.paymentMethod || "—"}</td>
                            <td className="amount">
                              {formatMoney(payment.amount, payment.currency || selectedInvoice.currency)}
                            </td>
                            <td>{payment.referenceNumber || "—"}</td>
                            <td>
                              <span className={statusClass(payment.status)}>
                                {payment.status || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedInvoice.notes && (
                <div style={{ marginTop: 18 }}>
                  <div className="detail-box">
                    <span>Notes</span>
                    <strong>{selectedInvoice.notes}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => printInvoice(selectedInvoice)}
              >
                <Printer size={15} />
                Print
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedInvoice);
                }}
              >
                <Pencil size={15} />
                Edit
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && deleteTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
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
                    background: "#fef2f2",
                  }}
                >
                  <Trash2 size={18} />
                </div>

                <div>
                  <h2>Delete Invoice</h2>
                  <p>This action cannot be undone.</p>
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() => setShowDelete(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning">
                Are you sure you want to delete invoice{" "}
                <strong>
                  {deleteTarget.invoiceNumber || "this invoice"}
                </strong>
                ?
                <br />
                The backend will permanently process this deletion
                according to its configured business rules.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDelete(false)}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={deleteInvoice}
                disabled={processingId === deleteTarget.id}
              >
                {processingId === deleteTarget.id ? (
                  <RefreshCw size={15} className="spinner" />
                ) : (
                  <Trash2 size={15} />
                )}
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}