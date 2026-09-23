import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
  Ban,
  Building2,
  Package,
} from "lucide-react";
import api from "../../services/api";

const emptyItem = {
  itemName: "",
  description: "",
  quantity: 1,
  unit: "pcs",
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
};

const emptyForm = {
  poNumber: "",
  purchaseRequestId: "",
  budgetId: "",
  supplierId: "",
  supplierName: "",
  departmentId: "",
  departmentName: "",
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDeliveryDate: "",
  currency: "ETB",
  status: "Draft",
  priority: "Normal",
  paymentTerms: "",
  deliveryTerms: "",
  notes: "",
  items: [{ ...emptyItem }],
};

const extractRows = (response) => {
  const root = response?.data;

  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.data?.orders)) return root.data.orders;
  if (Array.isArray(root?.orders)) return root.orders;
  if (Array.isArray(root?.items)) return root.items;
  if (Array.isArray(root?.records)) return root.records;
  if (Array.isArray(root?.results)) return root.results;
  if (Array.isArray(root?.rows)) return root.rows;

  return [];
};

const extractPagination = (
  response,
  rowsLength,
  currentPage,
  pageSize
) => {
  const root =
    response?.data?.pagination ||
    response?.data?.meta ||
    response?.data?.data?.pagination ||
    response?.data;

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

  const current =
    Number(root?.page ?? root?.currentPage ?? currentPage) ||
    currentPage;

  return {
    total,
    pages: Math.max(1, pages),
    page: current,
  };
};

const normalizeItem = (item) => ({
  itemName:
    item?.itemName ??
    item?.item_name ??
    item?.name ??
    item?.description ??
    "",
  description:
    item?.description ??
    item?.itemDescription ??
    item?.item_description ??
    "",
  quantity:
    Number(item?.quantity ?? item?.qty ?? 0) || 0,
  unit: item?.unit ?? "pcs",
  unitPrice:
    Number(
      item?.unitPrice ??
        item?.unit_price ??
        item?.price ??
        0
    ) || 0,
  taxRate:
    Number(item?.taxRate ?? item?.tax_rate ?? 0) || 0,
  discount:
    Number(
      item?.discount ??
        item?.discountAmount ??
        item?.discount_amount ??
        0
    ) || 0,
  lineTotal:
    Number(
      item?.lineTotal ??
        item?.line_total ??
        item?.total ??
        0
    ) || 0,
});

const normalizeOrder = (item) => ({
  id: item?.id ?? item?.purchaseOrderId ?? item?.purchase_order_id,

  poNumber:
    item?.poNumber ??
    item?.po_number ??
    item?.orderNumber ??
    item?.order_number ??
    "",

  purchaseRequestId:
    item?.purchaseRequestId ??
    item?.purchase_request_id ??
    item?.requestId ??
    item?.request_id ??
    "",

  budgetId: item?.budgetId ?? item?.budget_id ?? "",

  requestNumber:
    item?.requestNumber ??
    item?.request_number ??
    item?.purchaseRequestNumber ??
    item?.purchase_request_number ??
    "",

  supplierId:
    item?.supplierId ??
    item?.supplier_id ??
    "",

  supplierName:
    item?.supplierName ??
    item?.supplier_name ??
    item?.supplier?.name ??
    item?.supplier ??
    item?.vendorName ??
    item?.vendor_name ??
    item?.vendor ??
    "",

  departmentId:
    item?.departmentId ??
    item?.department_id ??
    "",

  departmentName:
    item?.departmentName ??
    item?.department_name ??
    item?.department?.name ??
    item?.department ??
    "",

  orderDate:
    item?.orderDate ??
    item?.order_date ??
    item?.createdAt ??
    item?.created_at ??
    "",

  expectedDeliveryDate:
    item?.expectedDeliveryDate ??
    item?.expected_delivery_date ??
    item?.expectedDelivery ??
    item?.expected_delivery ??
    "",

  currency: item?.currency ?? "ETB",

  subtotal:
    Number(
      item?.subtotal ??
        item?.sub_total ??
        item?.subtotalAmount ??
        item?.subtotal_amount ??
        0
    ) || 0,

  taxAmount:
    Number(
      item?.taxAmount ??
        item?.tax_amount ??
        item?.tax ??
        0
    ) || 0,

  discountAmount:
    Number(
      item?.discountAmount ??
        item?.discount_amount ??
        item?.discount ??
        0
    ) || 0,

  totalAmount:
    Number(
      item?.totalAmount ??
        item?.total_amount ??
        item?.grandTotal ??
        item?.grand_total ??
        item?.total ??
        0
    ) || 0,

  status: item?.status ?? "Draft",

  priority: item?.priority ?? "Normal",

  paymentTerms:
    item?.paymentTerms ??
    item?.payment_terms ??
    "",

  deliveryTerms:
    item?.deliveryTerms ??
    item?.delivery_terms ??
    "",

  notes: item?.notes ?? item?.remarks ?? "",

  requestedBy:
    item?.requestedBy ??
    item?.requested_by ??
    "",

  approvedBy:
    item?.approvedBy ??
    item?.approved_by ??
    "",

  approvedAt:
    item?.approvedAt ??
    item?.approved_at ??
    "",

  items: Array.isArray(item?.items)
    ? item.items.map(normalizeItem)
    : [],
});

const formatMoney = (value, currency = "ETB") => {
  const amount = Number(value) || 0;

  try {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("approved") ||
    value.includes("completed") ||
    value.includes("delivered")
  ) {
    return "status success";
  }

  if (
    value.includes("pending") ||
    value.includes("draft")
  ) {
    return "status warning";
  }

  if (
    value.includes("cancel") ||
    value.includes("reject")
  ) {
    return "status danger";
  }

  return "status";
};

const calculateItem = (item) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const taxRate = Number(item.taxRate) || 0;

  const gross = quantity * unitPrice;
  const taxable = Math.max(0, gross - discount);
  const tax = taxable * (taxRate / 100);
  const total = taxable + tax;

  return {
    gross,
    tax,
    total,
  };
};

export default function FinancePurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [department, setDepartment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/finance/purchase-orders",
        {
          params: {
            page,
            limit: pageSize,
            search: search || undefined,
            status: status || undefined,
            supplier: supplier || undefined,
            department: department || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
        }
      );

      const rows = extractRows(response).map(normalizeOrder);

      setOrders(rows);

      setSummary(
        response?.data?.summary ||
          response?.data?.statistics ||
          response?.data?.stats ||
          null
      );
      setBudgets(response?.data?.data?.filters?.budgets || response?.data?.filters?.budgets || []);

      setPagination(
        extractPagination(
          response,
          rows.length,
          page,
          pageSize
        )
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load purchase orders."
      );

      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    status,
    supplier,
    department,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const localStats = useMemo(() => {
    const total = pagination.total || orders.length;

    const pending = orders.filter((item) =>
      ["draft", "pending"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const approved = orders.filter((item) =>
      String(item.status).toLowerCase().includes("approved")
    ).length;

    const cancelled = orders.filter((item) =>
      String(item.status).toLowerCase().includes("cancel")
    ).length;

    const completed = orders.filter((item) => {
      const value = String(item.status).toLowerCase();

      return (
        value.includes("completed") ||
        value.includes("delivered")
      );
    }).length;

    const totalValue = orders.reduce(
      (sum, item) =>
        sum + Number(item.totalAmount || 0),
      0
    );

    return {
      total,
      pending,
      approved,
      cancelled,
      completed,
      totalValue,
    };
  }, [orders, pagination.total]);

  const stats = {
    total:
      Number(summary?.total ?? summary?.totalOrders) ||
      localStats.total,

    pending:
      Number(
        summary?.pending ??
          summary?.pendingOrders ??
          summary?.draft
      ) || localStats.pending,

    approved:
      Number(
        summary?.approved ??
          summary?.approvedOrders
      ) || localStats.approved,

    cancelled:
      Number(
        summary?.cancelled ??
          summary?.cancelledOrders
      ) || localStats.cancelled,

    completed:
      Number(
        summary?.completed ??
          summary?.delivered ??
          summary?.completedOrders
      ) || localStats.completed,

    totalValue:
      Number(
        summary?.totalValue ??
          summary?.totalAmount ??
          summary?.total_amount
      ) || localStats.totalValue,
  };

  const formTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;

    form.items.forEach((item) => {
      const calculation = calculateItem(item);

      subtotal +=
        (Number(item.quantity) || 0) *
        (Number(item.unitPrice) || 0);

      tax += calculation.tax;
      discount += Number(item.discount) || 0;
    });

    return {
      subtotal,
      tax,
      discount,
      total: Math.max(
        0,
        subtotal - discount + tax
      ),
    };
  }, [form.items]);

  const suppliers = useMemo(() => {
    return [
      ...new Set(
        orders
          .map((item) => item.supplierName)
          .filter(Boolean)
      ),
    ];
  }, [orders]);

  const departments = useMemo(() => {
    return [
      ...new Set(
        orders
          .map((item) => item.departmentName)
          .filter(Boolean)
      ),
    ];
  }, [orders]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setSupplier("");
    setDepartment("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openCreate = () => {
    setEditingOrder(null);
    setForm({
      ...emptyForm,
      orderDate: new Date()
        .toISOString()
        .slice(0, 10),
      items: [{ ...emptyItem }],
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (order) => {
    if (
      ["approved", "cancelled", "completed", "delivered"].includes(
        String(order.status).toLowerCase()
      )
    ) {
      setError(
        "Approved, cancelled, delivered, or completed purchase orders should not be edited."
      );
      return;
    }

    setEditingOrder(order);

    setForm({
      poNumber: order.poNumber || "",
      purchaseRequestId:
        order.purchaseRequestId || "",
      budgetId: order.budgetId || "",
      supplierId: order.supplierId || "",
      supplierName: order.supplierName || "",
      departmentId: order.departmentId || "",
      departmentName: order.departmentName || "",
      orderDate: order.orderDate
        ? String(order.orderDate).slice(0, 10)
        : "",
      expectedDeliveryDate:
        order.expectedDeliveryDate
          ? String(
              order.expectedDeliveryDate
            ).slice(0, 10)
          : "",
      currency: order.currency || "ETB",
      status: order.status || "Draft",
      priority: order.priority || "Normal",
      paymentTerms: order.paymentTerms || "",
      deliveryTerms: order.deliveryTerms || "",
      notes: order.notes || "",
      items:
        order.items?.length > 0
          ? order.items.map((item) => ({
              itemName: item.itemName || "",
              description: item.description || "",
              quantity: item.quantity || 1,
              unit: item.unit || "pcs",
              unitPrice: item.unitPrice || 0,
              taxRate: item.taxRate || 0,
              discount: item.discount || 0,
            }))
          : [{ ...emptyItem }],
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleItemChange = (
    index,
    field,
    value
  ) => {
    setForm((previous) => {
      const items = [...previous.items];

      items[index] = {
        ...items[index],
        [field]: value,
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
      items: [
        ...previous.items,
        { ...emptyItem },
      ],
    }));
  };

  const removeItem = (index) => {
    setForm((previous) => {
      if (previous.items.length <= 1) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.filter(
          (_, itemIndex) => itemIndex !== index
        ),
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.supplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }

    if (!form.departmentName.trim()) {
      setError("Department is required.");
      return;
    }
    if (!form.budgetId) {
      setError("Budget is required before a purchase order can be approved.");
      return;
    }

    if (!form.items.length) {
      setError("At least one purchase item is required.");
      return;
    }

    const invalidItem = form.items.some(
      (item) =>
        !String(item.itemName || "").trim() ||
        Number(item.quantity) <= 0 ||
        Number(item.unitPrice) < 0
    );

    if (invalidItem) {
      setError(
        "Each item must have a name, positive quantity, and valid unit price."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const items = form.items.map((item) => {
        const calculation = calculateItem(item);

        return {
          itemName: String(item.itemName).trim(),
          description: String(
            item.description || ""
          ).trim(),
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "pcs",
          unitPrice: Number(item.unitPrice) || 0,
          taxRate: Number(item.taxRate) || 0,
          discount: Number(item.discount) || 0,
          lineTotal: calculation.total,
        };
      });

      const payload = {
        poNumber: form.poNumber.trim(),
        purchaseRequestId:
          form.purchaseRequestId.trim(),
        budgetId: form.budgetId ? Number(form.budgetId) : null,
        supplierId: form.supplierId.trim(),
        supplierName: form.supplierName.trim(),
        departmentId: form.departmentId.trim(),
        departmentName:
          form.departmentName.trim(),
        orderDate: form.orderDate || null,
        expectedDeliveryDate:
          form.expectedDeliveryDate || null,
        currency: form.currency,
        status: form.status,
        priority: form.priority,
        paymentTerms:
          form.paymentTerms.trim(),
        deliveryTerms:
          form.deliveryTerms.trim(),
        notes: form.notes.trim(),
        items,
        subtotal: formTotals.subtotal,
        taxAmount: formTotals.tax,
        discountAmount: formTotals.discount,
        totalAmount: formTotals.total,
      };

      if (editingOrder?.id) {
        await api.put(
          `/finance/purchase-orders/${editingOrder.id}`,
          payload
        );

        setSuccess(
          "Purchase order updated successfully."
        );
      } else {
        await api.post(
          "/finance/purchase-orders",
          payload
        );

        setSuccess(
          "Purchase order created successfully."
        );
      }

      setShowForm(false);
      setEditingOrder(null);
      setForm(emptyForm);

      await loadOrders();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save purchase order."
      );
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async () => {
    if (!selectedOrder?.id) return;

    try {
      setProcessing(true);
      setError("");

      await api.patch(
        `/finance/purchase-orders/${selectedOrder.id}/approve`
      );

      setSuccess(
        "Purchase order approved successfully."
      );

      setShowApprove(false);
      setSelectedOrder(null);

      await loadOrders();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to approve purchase order."
      );
    } finally {
      setProcessing(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder?.id) return;

    try {
      setProcessing(true);
      setError("");

      await api.patch(
        `/finance/purchase-orders/${selectedOrder.id}/cancel`
      );

      setSuccess(
        "Purchase order cancelled successfully."
      );

      setShowCancel(false);
      setSelectedOrder(null);

      await loadOrders();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel purchase order."
      );
    } finally {
      setProcessing(false);
    }
  };

  const deleteOrder = async () => {
    if (!selectedOrder?.id) return;

    try {
      setProcessing(true);
      setError("");

      await api.delete(
        `/finance/purchase-orders/${selectedOrder.id}`
      );

      setSuccess(
        "Purchase order deleted successfully."
      );

      setShowDelete(false);
      setSelectedOrder(null);

      if (orders.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await loadOrders();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete purchase order."
      );
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const canApprove = (order) => {
    const value = String(
      order?.status || ""
    ).toLowerCase();

    return (
      value === "draft" ||
      value === "pending" ||
      value === "pending approval"
    );
  };

  const canCancel = (order) => {
    const value = String(
      order?.status || ""
    ).toLowerCase();

    return ![
      "cancelled",
      "completed",
      "delivered",
    ].includes(value);
  };

  const canDelete = (order) => {
    const value = String(
      order?.status || ""
    ).toLowerCase();

    return [
      "draft",
      "pending",
      "pending approval",
    ].includes(value);
  };

  const canEdit = (order) =>
    ["draft", "pending", "pending approval"].includes(
      String(order?.status || "").toLowerCase()
    );

  const printOrder = (order) => {
    setSelectedOrder(order);

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const goToPage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.pages
    ) {
      return;
    }

    setPage(nextPage);
  };

  return (
    <div className="po-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .po-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 28px;
        }

        .page-shell {
          max-width: 1550px;
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
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -.5px;
        }

        .title-wrap p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
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
          font-size: 13px;
          font-weight: 750;
          text-decoration: none;
          transition: .2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          color: white;
          background: #0ea5e9;
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          color: #0f172a;
          background: white;
          border: 1px solid #e2e8f0;
        }

        .btn-success {
          color: white;
          background: #16a34a;
        }

        .btn-danger {
          color: white;
          background: #dc2626;
        }

        .btn-warning {
          color: white;
          background: #d97706;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          box-shadow: 0 4px 15px rgba(15, 23, 42, .04);
        }

        .summary-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          background: #e0f2fe;
          color: #0284c7;
        }

        .summary-card h3 {
          margin: 0 0 5px;
          font-size: 11px;
          color: #64748b;
          font-weight: 750;
        }

        .summary-card strong {
          display: block;
          font-size: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .filters {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(220px, 1fr)
            150px 160px 160px 145px 145px auto;
          gap: 10px;
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

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          padding: 10px 12px;
          background: white;
          color: #0f172a;
          font: inherit;
          outline: none;
        }

        .search-box input {
          padding-left: 38px;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, .12);
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

        .muted {
          color: #64748b;
          font-size: 12px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1250px;
        }

        th {
          text-align: left;
          padding: 13px 15px;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-top: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .po-number {
          font-weight: 800;
        }

        .sub {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .supplier-name,
        .department-name {
          font-weight: 700;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.success {
          background: #dcfce7;
          color: #15803d;
        }

        .status.warning {
          background: #fef3c7;
          color: #a16207;
        }

        .status.danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .actions {
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
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          border-color: #7dd3fc;
          color: #0284c7;
        }

        .icon-btn.approve:hover {
          border-color: #86efac;
          color: #15803d;
          background: #f0fdf4;
        }

        .icon-btn.cancel:hover,
        .icon-btn.delete:hover {
          border-color: #fecaca;
          color: #dc2626;
          background: #fef2f2;
        }

        .empty,
        .loading {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .alert {
          padding: 12px 15px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 650;
        }

        .alert.error {
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .alert.success {
          color: #15803d;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .pagination {
          padding: 15px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #eef2f7;
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
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .page-button.current {
          background: #0ea5e9;
          color: white;
          border-color: #0ea5e9;
        }

        .page-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .58);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(1050px, 100%);
          max-height: 94vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, .28);
        }

        .modal.small {
          width: min(470px, 100%);
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
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .form {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 13px;
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
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        textarea {
          min-height: 90px;
          resize: vertical;
        }

        .items-section {
          margin-top: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          overflow: hidden;
        }

        .items-header {
          padding: 13px 15px;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
        }

        .items-header h3 {
          margin: 0;
          font-size: 14px;
        }

        .items-table-wrap {
          overflow-x: auto;
        }

        .items-table {
          min-width: 900px;
        }

        .items-table th,
        .items-table td {
          padding: 9px;
        }

        .items-table input {
          min-width: 90px;
          padding: 8px;
          font-size: 12px;
        }

        .items-table .item-name-input {
          min-width: 180px;
        }

        .remove-item {
          width: 31px;
          height: 31px;
          border: 1px solid #fecaca;
          color: #dc2626;
          background: #fff;
          border-radius: 7px;
          cursor: pointer;
          display: grid;
          place-items: center;
        }

        .totals-box {
          margin: 16px 0 0 auto;
          width: min(390px, 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 15px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 7px 0;
          font-size: 13px;
        }

        .total-row.grand {
          border-top: 1px solid #e2e8f0;
          margin-top: 7px;
          padding-top: 12px;
          font-size: 16px;
          font-weight: 850;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #eef2f7;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .details-grid {
          padding: 20px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .detail-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
        }

        .detail-item.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          word-break: break-word;
        }

        .detail-items {
          padding: 0 20px 20px;
        }

        .detail-items h3 {
          font-size: 14px;
          margin: 0 0 10px;
        }

        .detail-items table {
          min-width: 700px;
        }

        .delete-content,
        .confirm-content {
          padding: 26px;
          text-align: center;
        }

        .confirm-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          background: #e0f2fe;
          color: #0284c7;
        }

        .confirm-icon.danger {
          background: #fee2e2;
          color: #dc2626;
        }

        .confirm-content h3,
        .delete-content h3 {
          margin: 0 0 8px;
        }

        .confirm-content p,
        .delete-content p {
          color: #64748b;
          font-size: 13px;
          margin: 0;
          line-height: 1.6;
        }

        @media (max-width: 1350px) {
          .summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .filters {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 900px) {
          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid,
          .details-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .po-page {
            padding: 15px;
          }

          .summary-grid,
          .filters,
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

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }
        }

        @media print {
          body * {
            visibility: hidden;
          }

          .print-area,
          .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 30px;
            background: white;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div className="title-wrap">
            <h1>Purchase Orders</h1>
            <p>
              Create, approve, track, and manage university
              procurement purchase orders.
            </p>
          </div>

          <div className="header-actions no-print">
            <Link
              className="btn btn-secondary"
              to="/finance"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <Link
              className="btn btn-secondary"
              to="/finance/purchase-requests"
            >
              <ClipboardList size={16} />
              Purchase Requests
            </Link>

            <Link
              className="btn btn-secondary"
              to="/finance/suppliers"
            >
              <Building2 size={16} />
              Suppliers
            </Link>

            <button
              className="btn btn-secondary"
              onClick={loadOrders}
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
              New Purchase Order
            </button>
          </div>
        </div>

        {error && (
          <div className="alert error no-print">
            {error}
          </div>
        )}

        {success && (
          <div className="alert success no-print">
            {success}
          </div>
        )}

        <div className="summary-grid no-print">
          <div className="summary-card">
            <div className="summary-icon">
              <FileText size={21} />
            </div>

            <div>
              <h3>Total Orders</h3>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <ClipboardList size={21} />
            </div>

            <div>
              <h3>Draft / Pending</h3>
              <strong>{stats.pending}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <h3>Approved</h3>
              <strong>{stats.approved}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <Ban size={21} />
            </div>

            <div>
              <h3>Cancelled</h3>
              <strong>{stats.cancelled}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <Package size={21} />
            </div>

            <div>
              <h3>Delivered / Completed</h3>
              <strong>{stats.completed}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CircleDollarSign size={21} />
            </div>

            <div>
              <h3>Total Value</h3>
              <strong>
                {formatMoney(stats.totalValue)}
              </strong>
            </div>
          </div>
        </div>

        <div className="filters no-print">
          <div className="search-box">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search PO, supplier, request..."
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All Statuses
            </option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Delivered">
              Delivered
            </option>
            <option value="Completed">
              Completed
            </option>
            <option value="Cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={supplier}
            onChange={(event) => {
              setSupplier(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All Suppliers
            </option>

            {suppliers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All Departments
            </option>

            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />

          <button
            className="btn btn-secondary"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="table-card no-print">
          <div className="table-top">
            <h2>Purchase Order Register</h2>

            <span className="muted">
              {pagination.total} record
              {pagination.total === 1
                ? ""
                : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading">
              <RefreshCw
                size={28}
                className="spinner"
              />
              <p>
                Loading purchase orders...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty">
              <FileText size={40} />
              <p>
                No purchase orders found.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Department</th>
                      <th>Purchase Request</th>
                      <th>Order Date</th>
                      <th>Expected Delivery</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <div className="po-number">
                            {order.poNumber ||
                              "—"}
                          </div>

                          {order.id && (
                            <div className="sub">
                              ID: {order.id}
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="supplier-name">
                            {order.supplierName ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          <div className="department-name">
                            {order.departmentName ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          {order.requestNumber ||
                            order.purchaseRequestId ||
                            "—"}
                        </td>

                        <td>
                          {formatDate(
                            order.orderDate
                          )}
                        </td>

                        <td>
                          {formatDate(
                            order.expectedDeliveryDate
                          )}
                        </td>

                        <td className="amount">
                          {formatMoney(
                            order.totalAmount,
                            order.currency
                          )}
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              order.status
                            )}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td>
                          {order.priority ||
                            "Normal"}
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="icon-btn"
                              title="View"
                              onClick={() =>
                                openDetails(order)
                              }
                            >
                              <Eye size={15} />
                            </button>

                            {canEdit(order) && (
                              <button
                                className="icon-btn"
                                title="Edit"
                                onClick={() => openEdit(order)}
                              >
                                <Edit3 size={15} />
                              </button>
                            )}

                            {canApprove(order) && (
                              <button
                                className="icon-btn approve"
                                title="Approve"
                                onClick={() => {
                                  setSelectedOrder(
                                    order
                                  );
                                  setShowApprove(
                                    true
                                  );
                                }}
                              >
                                <CheckCircle2
                                  size={15}
                                />
                              </button>
                            )}

                            {canCancel(order) && (
                              <button
                                className="icon-btn cancel"
                                title="Cancel"
                                onClick={() => {
                                  setSelectedOrder(
                                    order
                                  );
                                  setShowCancel(
                                    true
                                  );
                                }}
                              >
                                <XCircle
                                  size={15}
                                />
                              </button>
                            )}

                            {canDelete(order) && (
                              <button
                                className="icon-btn delete"
                                title="Delete"
                                onClick={() => {
                                  setSelectedOrder(
                                    order
                                  );
                                  setShowDelete(
                                    true
                                  );
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="muted">
                  Page {pagination.page} of{" "}
                  {pagination.pages}
                </div>

                <div className="page-buttons">
                  <button
                    className="page-button"
                    disabled={page <= 1}
                    onClick={() =>
                      goToPage(page - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from(
                    {
                      length: Math.min(
                        5,
                        pagination.pages
                      ),
                    },
                    (_, index) => {
                      const pageNumber =
                        index + 1;

                      return (
                        <button
                          key={pageNumber}
                          className={`page-button ${
                            pageNumber === page
                              ? "current"
                              : ""
                          }`}
                          onClick={() =>
                            goToPage(
                              pageNumber
                            )
                          }
                        >
                          {pageNumber}
                        </button>
                      );
                    }
                  )}

                  <button
                    className="page-button"
                    disabled={
                      page >= pagination.pages
                    }
                    onClick={() =>
                      goToPage(page + 1)
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

      {/* CREATE / EDIT */}
      {showForm && (
        <div className="modal-overlay no-print">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingOrder
                  ? "Edit Purchase Order"
                  : "New Purchase Order"}
              </h2>

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
              className="form"
              onSubmit={handleSubmit}
            >
              <div className="form-grid">
                <div className="field">
                  <label>
                    PO Number
                  </label>

                  <input
                    name="poNumber"
                    value={form.poNumber}
                    onChange={handleFormChange}
                    placeholder="Leave blank if backend generates it"
                  />
                </div>

                <div className="field">
                  <label>
                    Purchase Request ID
                  </label>

                  <input
                    name="purchaseRequestId"
                    value={
                      form.purchaseRequestId
                    }
                    onChange={handleFormChange}
                    placeholder="Approved request ID"
                  />
                </div>

                <div className="field">
                  <label>Budget *</label>
                  <select name="budgetId" value={form.budgetId} onChange={handleFormChange} required>
                    <option value="">Select an active budget</option>
                    {budgets.map((budget) => (
                      <option key={budget.id} value={budget.id}>
                        {budget.budgetCode} - {budget.budgetName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Supplier ID
                  </label>

                  <input
                    name="supplierId"
                    value={form.supplierId}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Supplier Name *
                  </label>

                  <input
                    name="supplierName"
                    value={form.supplierName}
                    onChange={handleFormChange}
                    placeholder="Supplier / company"
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Department ID
                  </label>

                  <input
                    name="departmentId"
                    value={form.departmentId}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Department Name *
                  </label>

                  <input
                    name="departmentName"
                    value={
                      form.departmentName
                    }
                    onChange={handleFormChange}
                    placeholder="Department / office"
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Order Date
                  </label>

                  <input
                    type="date"
                    name="orderDate"
                    value={form.orderDate}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Expected Delivery
                  </label>

                  <input
                    type="date"
                    name="expectedDeliveryDate"
                    value={
                      form.expectedDeliveryDate
                    }
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Currency
                  </label>

                  <select
                    name="currency"
                    value={form.currency}
                    onChange={handleFormChange}
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
                  </select>
                </div>

                <div className="field">
                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    <option value="Draft">
                      Draft
                    </option>
                    <option value="Pending">
                      Pending
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                  >
                    <option value="Low">
                      Low
                    </option>
                    <option value="Normal">
                      Normal
                    </option>
                    <option value="High">
                      High
                    </option>
                    <option value="Urgent">
                      Urgent
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Payment Terms
                  </label>

                  <input
                    name="paymentTerms"
                    value={form.paymentTerms}
                    onChange={handleFormChange}
                    placeholder="e.g. Net 30"
                  />
                </div>

                <div className="field full">
                  <label>
                    Delivery Terms
                  </label>

                  <input
                    name="deliveryTerms"
                    value={form.deliveryTerms}
                    onChange={handleFormChange}
                    placeholder="Delivery conditions"
                  />
                </div>

                <div className="field full">
                  <label>
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    placeholder="Additional procurement notes..."
                  />
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h3>
                    Purchase Order Items
                  </h3>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addItem}
                  >
                    <Plus size={15} />
                    Add Item
                  </button>
                </div>

                <div className="items-table-wrap">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>
                          Item *
                        </th>
                        <th>
                          Description
                        </th>
                        <th>
                          Qty *
                        </th>
                        <th>
                          Unit
                        </th>
                        <th>
                          Unit Price
                        </th>
                        <th>
                          Tax %
                        </th>
                        <th>
                          Discount
                        </th>
                        <th>
                          Line Total
                        </th>
                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {form.items.map(
                        (
                          item,
                          index
                        ) => {
                          const calc =
                            calculateItem(
                              item
                            );

                          return (
                            <tr
                              key={
                                index
                              }
                            >
                              <td>
                                <input
                                  className="item-name-input"
                                  value={
                                    item.itemName
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "itemName",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder="Item name"
                                  required
                                />
                              </td>

                              <td>
                                <input
                                  value={
                                    item.description
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "description",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder="Description"
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    item.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "quantity",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  value={
                                    item.unit
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "unit",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    item.unitPrice
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "unitPrice",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    item.taxRate
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "taxRate",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    item.discount
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemChange(
                                      index,
                                      "discount",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <strong>
                                  {formatMoney(
                                    calc.total,
                                    form.currency
                                  )}
                                </strong>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="remove-item"
                                  onClick={() =>
                                    removeItem(
                                      index
                                    )
                                  }
                                  disabled={
                                    form
                                      .items
                                      .length <=
                                    1
                                  }
                                  title="Remove item"
                                >
                                  <Trash2
                                    size={
                                      14
                                    }
                                  />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="totals-box">
                <div className="total-row">
                  <span>
                    Subtotal
                  </span>
                  <strong>
                    {formatMoney(
                      formTotals.subtotal,
                      form.currency
                    )}
                  </strong>
                </div>

                <div className="total-row">
                  <span>
                    Discount
                  </span>
                  <strong>
                    {formatMoney(
                      formTotals.discount,
                      form.currency
                    )}
                  </strong>
                </div>

                <div className="total-row">
                  <span>
                    Tax
                  </span>
                  <strong>
                    {formatMoney(
                      formTotals.tax,
                      form.currency
                    )}
                  </strong>
                </div>

                <div className="total-row grand">
                  <span>
                    Grand Total
                  </span>
                  <strong>
                    {formatMoney(
                      formTotals.total,
                      form.currency
                    )}
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowForm(false)
                  }
                  disabled={saving}
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
                      <RefreshCw
                        size={15}
                        className="spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={15}
                      />
                      {editingOrder
                        ? "Update Purchase Order"
                        : "Save Purchase Order"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS */}
      {showDetails && selectedOrder && (
        <div className="modal-overlay no-print">
          <div className="modal">
            <div className="modal-header">
              <h2>
                Purchase Order Details
              </h2>

              <button
                className="close-btn"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="details-grid">
              {[
                [
                  "PO Number",
                  selectedOrder.poNumber,
                ],
                [
                  "Purchase Request",
                  selectedOrder.requestNumber ||
                    selectedOrder.purchaseRequestId,
                ],
                [
                  "Supplier",
                  selectedOrder.supplierName,
                ],
                [
                  "Department",
                  selectedOrder.departmentName,
                ],
                [
                  "Order Date",
                  formatDate(
                    selectedOrder.orderDate
                  ),
                ],
                [
                  "Expected Delivery",
                  formatDate(
                    selectedOrder.expectedDeliveryDate
                  ),
                ],
                [
                  "Currency",
                  selectedOrder.currency,
                ],
                [
                  "Priority",
                  selectedOrder.priority,
                ],
                [
                  "Status",
                  selectedOrder.status,
                ],
                [
                  "Payment Terms",
                  selectedOrder.paymentTerms,
                ],
                [
                  "Delivery Terms",
                  selectedOrder.deliveryTerms,
                ],
                [
                  "Requested By",
                  selectedOrder.requestedBy,
                ],
                [
                  "Approved By",
                  selectedOrder.approvedBy,
                ],
                [
                  "Approved At",
                  formatDate(
                    selectedOrder.approvedAt
                  ),
                ],
                [
                  "Subtotal",
                  formatMoney(
                    selectedOrder.subtotal,
                    selectedOrder.currency
                  ),
                ],
                [
                  "Tax",
                  formatMoney(
                    selectedOrder.taxAmount,
                    selectedOrder.currency
                  ),
                ],
                [
                  "Discount",
                  formatMoney(
                    selectedOrder.discountAmount,
                    selectedOrder.currency
                  ),
                ],
                [
                  "Total Amount",
                  formatMoney(
                    selectedOrder.totalAmount,
                    selectedOrder.currency
                  ),
                ],
                [
                  "Notes",
                  selectedOrder.notes,
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={label}
                    className={`detail-item ${
                      label === "Notes"
                        ? "full"
                        : ""
                    }`}
                  >
                    <div className="detail-label">
                      {label}
                    </div>

                    <div className="detail-value">
                      {value || "—"}
                    </div>
                  </div>
                )
              )}
            </div>

            {selectedOrder.items?.length >
              0 && (
              <div className="detail-items">
                <h3>
                  Order Items
                </h3>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          Item
                        </th>
                        <th>
                          Description
                        </th>
                        <th>
                          Qty
                        </th>
                        <th>
                          Unit
                        </th>
                        <th>
                          Unit Price
                        </th>
                        <th>
                          Tax
                        </th>
                        <th>
                          Discount
                        </th>
                        <th>
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedOrder.items.map(
                        (item, index) => (
                          <tr
                            key={
                              index
                            }
                          >
                            <td>
                              {item.itemName ||
                                "—"}
                            </td>

                            <td>
                              {item.description ||
                                "—"}
                            </td>

                            <td>
                              {item.quantity}
                            </td>

                            <td>
                              {item.unit}
                            </td>

                            <td>
                              {formatMoney(
                                item.unitPrice,
                                selectedOrder.currency
                              )}
                            </td>

                            <td>
                              {item.taxRate}%
                            </td>

                            <td>
                              {formatMoney(
                                item.discount,
                                selectedOrder.currency
                              )}
                            </td>

                            <td>
                              {formatMoney(
                                item.lineTotal,
                                selectedOrder.currency
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  printOrder(
                    selectedOrder
                  )
                }
              >
                <Printer size={15} />
                Print
              </button>

              {canApprove(
                selectedOrder
              ) && (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    setShowApprove(
                      true
                    );
                  }}
                >
                  <CheckCircle2
                    size={15}
                  />
                  Approve
                </button>
              )}

              {canCancel(
                selectedOrder
              ) && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    setShowCancel(
                      true
                    );
                  }}
                >
                  <XCircle size={15} />
                  Cancel
                </button>
              )}

              {canDelete(
                selectedOrder
              ) && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    setShowDelete(
                      true
                    );
                  }}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              )}

              <button
                className="btn btn-secondary"
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

      {/* APPROVE */}
      {showApprove && selectedOrder && (
        <div className="modal-overlay no-print">
          <div className="modal small">
            <div className="confirm-content">
              <div className="confirm-icon">
                <CheckCircle2 size={26} />
              </div>

              <h3>
                Approve Purchase Order?
              </h3>

              <p>
                Approving{" "}
                <strong>
                  {selectedOrder.poNumber ||
                    "this purchase order"}
                </strong>{" "}
                will move it into the approved
                procurement workflow.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowApprove(false)
                }
                disabled={processing}
              >
                Cancel
              </button>

              <button
                className="btn btn-success"
                onClick={approveOrder}
                disabled={processing}
              >
                {processing
                  ? "Approving..."
                  : "Approve Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL */}
      {showCancel && selectedOrder && (
        <div className="modal-overlay no-print">
          <div className="modal small">
            <div className="confirm-content">
              <div className="confirm-icon danger">
                <XCircle size={26} />
              </div>

              <h3>
                Cancel Purchase Order?
              </h3>

              <p>
                Are you sure you want to cancel{" "}
                <strong>
                  {selectedOrder.poNumber ||
                    "this purchase order"}
                </strong>
                ?
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowCancel(false)
                }
                disabled={processing}
              >
                Keep Order
              </button>

              <button
                className="btn btn-danger"
                onClick={cancelOrder}
                disabled={processing}
              >
                {processing
                  ? "Cancelling..."
                  : "Cancel Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE */}
      {showDelete && selectedOrder && (
        <div className="modal-overlay no-print">
          <div className="modal small">
            <div className="delete-content">
              <div className="confirm-icon danger">
                <Trash2 size={25} />
              </div>

              <h3>
                Delete Purchase Order?
              </h3>

              <p>
                This will permanently delete{" "}
                <strong>
                  {selectedOrder.poNumber ||
                    "this purchase order"}
                </strong>
                . Only draft or pending orders
                can be deleted from this interface.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowDelete(false)
                }
                disabled={processing}
              >
                Keep Order
              </button>

              <button
                className="btn btn-danger"
                onClick={deleteOrder}
                disabled={processing}
              >
                {processing
                  ? "Deleting..."
                  : "Delete Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT AREA */}
      {selectedOrder && (
        <div
          className="print-area"
          style={{ display: "none" }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 30,
            }}
          >
            <h1>
              MEKDELA AMBA UNIVERSITY
            </h1>

            <h2>
              PURCHASE ORDER
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 15,
              marginBottom: 25,
            }}
          >
            <div>
              <strong>
                PO Number:
              </strong>{" "}
              {selectedOrder.poNumber ||
                "—"}
            </div>

            <div>
              <strong>
                Order Date:
              </strong>{" "}
              {formatDate(
                selectedOrder.orderDate
              )}
            </div>

            <div>
              <strong>
                Supplier:
              </strong>{" "}
              {selectedOrder.supplierName ||
                "—"}
            </div>

            <div>
              <strong>
                Department:
              </strong>{" "}
              {selectedOrder.departmentName ||
                "—"}
            </div>

            <div>
              <strong>
                Expected Delivery:
              </strong>{" "}
              {formatDate(
                selectedOrder.expectedDeliveryDate
              )}
            </div>

            <div>
              <strong>
                Status:
              </strong>{" "}
              {selectedOrder.status ||
                "—"}
            </div>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              marginBottom: 25,
            }}
          >
            <thead>
              <tr>
                {[
                  "Item",
                  "Description",
                  "Qty",
                  "Unit",
                  "Unit Price",
                  "Total",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 8,
                      textAlign:
                        "left",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(selectedOrder.items ||
                []).map(
                (item, index) => (
                  <tr
                    key={index}
                  >
                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {item.itemName}
                    </td>

                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {item.description ||
                        "—"}
                    </td>

                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {item.quantity}
                    </td>

                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {item.unit}
                    </td>

                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {formatMoney(
                        item.unitPrice,
                        selectedOrder.currency
                      )}
                    </td>

                    <td
                      style={{
                        border:
                          "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      {formatMoney(
                        item.lineTotal,
                        selectedOrder.currency
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          <div
            style={{
              marginLeft:
                "auto",
              width: 300,
            }}
          >
            <p>
              <strong>
                Subtotal:
              </strong>{" "}
              {formatMoney(
                selectedOrder.subtotal,
                selectedOrder.currency
              )}
            </p>

            <p>
              <strong>
                Tax:
              </strong>{" "}
              {formatMoney(
                selectedOrder.taxAmount,
                selectedOrder.currency
              )}
            </p>

            <p>
              <strong>
                Discount:
              </strong>{" "}
              {formatMoney(
                selectedOrder.discountAmount,
                selectedOrder.currency
              )}
            </p>

            <h3>
              Total:{" "}
              {formatMoney(
                selectedOrder.totalAmount,
                selectedOrder.currency
              )}
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}