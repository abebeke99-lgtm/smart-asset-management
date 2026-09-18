import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Save,
  Trash2,
  Wallet,
  X,
  XCircle,
  Clock,
  Receipt,
  Building2,
  FileText,
  Printer,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  transactionNumber: "",
  transactionDate: "",
  transactionType: "Payment",
  referenceType: "",
  referenceId: "",
  referenceNumber: "",
  accountCode: "",
  accountName: "",
  description: "",
  supplierId: "",
  supplierName: "",
  departmentId: "",
  departmentName: "",
  amount: "",
  currency: "ETB",
  debit: "",
  credit: "",
  paymentMethod: "",
  bankName: "",
  bankReference: "",
  status: "Posted",
  notes: "",
};

const firstValue = (...values) =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
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
  fallbackTotal,
  page,
  pageSize
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
      Math.max(
        1,
        Math.ceil(
          total / Math.max(limit, 1)
        )
      )
    )
  );

  return {
    total: Number.isFinite(total)
      ? total
      : fallbackTotal,
    page: Number.isFinite(currentPage)
      ? currentPage
      : page,
    pageSize: Number.isFinite(limit)
      ? limit
      : pageSize,
    totalPages:
      Number.isFinite(totalPages) &&
      totalPages > 0
        ? totalPages
        : 1,
  };
};

const normalizeTransaction = (item) => ({
  ...item,

  id: firstValue(
    item.id,
    item.transaction_id,
    item.transactionId
  ),

  transactionNumber: firstValue(
    item.transactionNumber,
    item.transaction_number,
    item.transactionNo,
    item.transaction_no,
    item.number,
    ""
  ),

  transactionDate: firstValue(
    item.transactionDate,
    item.transaction_date,
    item.date,
    item.createdAt,
    item.created_at,
    ""
  ),

  transactionType: firstValue(
    item.transactionType,
    item.transaction_type,
    item.type,
    ""
  ),

  referenceType: firstValue(
    item.referenceType,
    item.reference_type,
    ""
  ),

  referenceId: firstValue(
    item.referenceId,
    item.reference_id,
    ""
  ),

  referenceNumber: firstValue(
    item.referenceNumber,
    item.reference_number,
    item.reference,
    ""
  ),

  accountCode: firstValue(
    item.accountCode,
    item.account_code,
    ""
  ),

  accountName: firstValue(
    item.accountName,
    item.account_name,
    item.account?.name,
    ""
  ),

  description: firstValue(
    item.description,
    item.memo,
    item.narration,
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

  amount: Number(
    firstValue(
      item.amount,
      item.totalAmount,
      item.total_amount,
      0
    )
  ),

  currency: firstValue(
    item.currency,
    "ETB"
  ),

  debit: Number(
    firstValue(
      item.debit,
      item.debitAmount,
      item.debit_amount,
      0
    )
  ),

  credit: Number(
    firstValue(
      item.credit,
      item.creditAmount,
      item.credit_amount,
      0
    )
  ),

  paymentMethod: firstValue(
    item.paymentMethod,
    item.payment_method,
    item.method,
    ""
  ),

  bankName: firstValue(
    item.bankName,
    item.bank_name,
    ""
  ),

  bankReference: firstValue(
    item.bankReference,
    item.bank_reference,
    ""
  ),

  status: firstValue(
    item.status,
    "Posted"
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

const formatMoney = (
  value,
  currency = "ETB"
) => {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }
    ).format(amount);
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

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const statusClass = (status) => {
  const value = String(
    status || ""
  ).toLowerCase();

  if (
    value.includes("posted") ||
    value.includes("completed") ||
    value.includes("approved") ||
    value.includes("success")
  ) {
    return "status success";
  }

  if (
    value.includes("cancel") ||
    value.includes("void") ||
    value.includes("failed") ||
    value.includes("rejected")
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

export default function FinanceTransactions() {
  const [transactions, setTransactions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [processingId, setProcessingId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [transactionType, setTransactionType] =
    useState("");

  const [referenceType, setReferenceType] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const [
    pagination,
    setPagination,
  ] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });

  const [showForm, setShowForm] =
    useState(false);

  const [showDetails, setShowDetails] =
    useState(false);

  const [showDelete, setShowDelete] =
    useState(false);

  const [
    editingTransaction,
    setEditingTransaction,
  ] = useState(null);

  const [
    selectedTransaction,
    setSelectedTransaction,
  ] = useState(null);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [form, setForm] =
    useState(emptyForm);

  const loadTransactions =
    async () => {
      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          pageSize,
        };

        if (search.trim()) {
          params.search =
            search.trim();
        }

        if (status) {
          params.status = status;
        }

        if (transactionType) {
          params.transactionType =
            transactionType;
        }

        if (referenceType) {
          params.referenceType =
            referenceType;
        }

        const response =
          await api.get(
            "/finance/transactions",
            { params }
          );

        const rows =
          extractRows(response).map(
            normalizeTransaction
          );

        setTransactions(rows);

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
          "Failed to load transactions:",
          err
        );

        setTransactions([]);

        setError(
          err?.response?.data
            ?.message ||
            err?.message ||
            "Unable to load financial transactions from the backend."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadTransactions();
  }, [
    page,
    pageSize,
    status,
    transactionType,
    referenceType,
  ]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (page !== 1) {
          setPage(1);
        } else {
          loadTransactions();
        }
      },
      400
    );

    return () =>
      clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => {
    const posted =
      transactions.filter(
        (item) =>
          String(
            item.status || ""
          ).toLowerCase() ===
          "posted"
      ).length;

    const pending =
      transactions.filter((item) =>
        ["pending", "processing"].includes(
          String(
            item.status || ""
          ).toLowerCase()
        )
      ).length;

    const debitTotal =
      transactions.reduce(
        (sum, item) =>
          sum +
          Number(
            item.debit || 0
          ),
        0
      );

    const creditTotal =
      transactions.reduce(
        (sum, item) =>
          sum +
          Number(
            item.credit || 0
          ),
        0
      );

    const amountTotal =
      transactions.reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount || 0
          ),
        0
      );

    return {
      posted,
      pending,
      debitTotal,
      creditTotal,
      amountTotal,
    };
  }, [transactions]);

  const openCreate = () => {
    setEditingTransaction(null);

    setForm({
      ...emptyForm,
      transactionDate:
        new Date()
          .toISOString()
          .slice(0, 10),
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (
    transaction
  ) => {
    setEditingTransaction(
      transaction
    );

    setForm({
      transactionNumber:
        transaction.transactionNumber ||
        "",

      transactionDate:
        transaction.transactionDate
          ? String(
              transaction.transactionDate
            ).slice(0, 10)
          : "",

      transactionType:
        transaction.transactionType ||
        "Payment",

      referenceType:
        transaction.referenceType ||
        "",

      referenceId:
        transaction.referenceId ||
        "",

      referenceNumber:
        transaction.referenceNumber ||
        "",

      accountCode:
        transaction.accountCode ||
        "",

      accountName:
        transaction.accountName ||
        "",

      description:
        transaction.description ||
        "",

      supplierId:
        transaction.supplierId ||
        "",

      supplierName:
        transaction.supplierName ||
        "",

      departmentId:
        transaction.departmentId ||
        "",

      departmentName:
        transaction.departmentName ||
        "",

      amount:
        transaction.amount ?? "",

      currency:
        transaction.currency ||
        "ETB",

      debit:
        transaction.debit ?? "",

      credit:
        transaction.credit ?? "",

      paymentMethod:
        transaction.paymentMethod ||
        "",

      bankName:
        transaction.bankName ||
        "",

      bankReference:
        transaction.bankReference ||
        "",

      status:
        transaction.status ||
        "Posted",

      notes:
        transaction.notes ||
        "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openDetails = (
    transaction
  ) => {
    setSelectedTransaction(
      transaction
    );
    setShowDetails(true);
  };

  const openDelete = (
    transaction
  ) => {
    setDeleteTarget(
      transaction
    );
    setShowDelete(true);
  };

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const amount = Number(
        form.amount || 0
      );

      const debit = Number(
        form.debit || 0
      );

      const credit = Number(
        form.credit || 0
      );

      if (
        !form.transactionNumber.trim()
      ) {
        throw new Error(
          "Transaction number is required."
        );
      }

      if (
        !form.transactionDate
      ) {
        throw new Error(
          "Transaction date is required."
        );
      }

      if (
        amount <= 0 &&
        debit <= 0 &&
        credit <= 0
      ) {
        throw new Error(
          "Enter a valid transaction amount, debit, or credit."
        );
      }

      const payload = {
        transactionNumber:
          form.transactionNumber.trim(),

        transactionDate:
          form.transactionDate,

        transactionType:
          form.transactionType,

        referenceType:
          form.referenceType,

        referenceId:
          form.referenceId ||
          null,

        referenceNumber:
          form.referenceNumber.trim(),

        accountCode:
          form.accountCode.trim(),

        accountName:
          form.accountName.trim(),

        description:
          form.description.trim(),

        supplierId:
          form.supplierId ||
          null,

        supplierName:
          form.supplierName.trim(),

        departmentId:
          form.departmentId ||
          null,

        departmentName:
          form.departmentName.trim(),

        amount,

        currency:
          form.currency,

        debit,

        credit,

        paymentMethod:
          form.paymentMethod,

        bankName:
          form.bankName.trim(),

        bankReference:
          form.bankReference.trim(),

        status:
          form.status,

        notes:
          form.notes.trim(),
      };

      if (
        editingTransaction?.id
      ) {
        await api.put(
          `/finance/transactions/${editingTransaction.id}`,
          payload
        );

        setSuccess(
          "Transaction updated successfully."
        );
      } else {
        await api.post(
          "/finance/transactions",
          payload
        );

        setSuccess(
          "Transaction created successfully."
        );
      }

      setShowForm(false);
      setEditingTransaction(
        null
      );
      setForm(emptyForm);

      await loadTransactions();
    } catch (err) {
      console.error(
        "Transaction save failed:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to save transaction."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction =
    async () => {
      if (!deleteTarget?.id)
        return;

      setProcessingId(
        deleteTarget.id
      );

      setError("");
      setSuccess("");

      try {
        await api.delete(
          `/finance/transactions/${deleteTarget.id}`
        );

        setShowDelete(false);
        setDeleteTarget(null);

        setSuccess(
          "Transaction deleted successfully."
        );

        if (
          transactions.length ===
            1 &&
          page > 1
        ) {
          setPage(
            (current) =>
              current - 1
          );
        } else {
          await loadTransactions();
        }
      } catch (err) {
        console.error(
          "Transaction deletion failed:",
          err
        );

        setError(
          err?.response?.data
            ?.message ||
            err?.message ||
            "Unable to delete transaction."
        );
      } finally {
        setProcessingId(null);
      }
    };

  const updateStatus = async (
    transaction,
    nextStatus
  ) => {
    if (!transaction?.id)
      return;

    setProcessingId(
      transaction.id
    );

    setError("");
    setSuccess("");

    try {
      await api.put(
        `/finance/transactions/${transaction.id}`,
        {
          status: nextStatus,
        }
      );

      setSuccess(
        `Transaction marked as ${nextStatus}.`
      );

      await loadTransactions();

      if (
        selectedTransaction?.id ===
        transaction.id
      ) {
        setSelectedTransaction({
          ...selectedTransaction,
          status: nextStatus,
        });
      }
    } catch (err) {
      console.error(
        "Transaction status update failed:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to update transaction status."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setTransactionType("");
    setReferenceType("");
    setPage(1);
  };

  const printTransaction = (
    transaction
  ) => {
    const popup =
      window.open(
        "",
        "_blank",
        "width=850,height=700"
      );

    if (!popup) {
      setError(
        "Please allow pop-ups to print the transaction."
      );
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>
          Transaction ${
            transaction.transactionNumber ||
            ""
          }
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #111827;
          }

          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }

          h1 {
            margin: 0 0 5px;
          }

          .muted {
            color: #64748b;
          }

          .section {
            border: 1px solid #d1d5db;
            padding: 18px;
            margin-top: 18px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
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
              University Asset Management System
            </div>
          </div>

          <div>
            <strong>FINANCIAL TRANSACTION</strong>
            <br/>
            ${
              transaction.transactionNumber ||
              "—"
            }
          </div>
        </div>

        <div class="section">
          <div class="row">
            <strong>Transaction Number</strong>
            <span>
              ${
                transaction.transactionNumber ||
                "—"
              }
            </span>
          </div>

          <div class="row">
            <strong>Date</strong>
            <span>
              ${formatDate(
                transaction.transactionDate
              )}
            </span>
          </div>

          <div class="row">
            <strong>Type</strong>
            <span>
              ${
                transaction.transactionType ||
                "—"
              }
            </span>
          </div>

          <div class="row">
            <strong>Reference</strong>
            <span>
              ${
                transaction.referenceNumber ||
                "—"
              }
            </span>
          </div>

          <div class="row">
            <strong>Supplier</strong>
            <span>
              ${
                transaction.supplierName ||
                "—"
              }
            </span>
          </div>

          <div class="row">
            <strong>Department</strong>
            <span>
              ${
                transaction.departmentName ||
                "—"
              }
            </span>
          </div>

          <div class="row">
            <strong>Account</strong>
            <span>
              ${
                transaction.accountCode ||
                "—"
              }
              ${
                transaction.accountName
                  ? ` - ${transaction.accountName}`
                  : ""
              }
            </span>
          </div>

          <div class="row">
            <strong>Status</strong>
            <span>
              ${
                transaction.status ||
                "—"
              }
            </span>
          </div>
        </div>

        <div class="section">
          <div class="amount">
            Amount:
            ${formatMoney(
              transaction.amount,
              transaction.currency
            )}
          </div>

          <br/>

          Debit:
          ${formatMoney(
            transaction.debit,
            transaction.currency
          )}

          <br/><br/>

          Credit:
          ${formatMoney(
            transaction.credit,
            transaction.currency
          )}
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
          margin-bottom: 22px;
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
          font-size: 20px;
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
            minmax(250px, 1.7fr)
            repeat(3, minmax(150px, 1fr))
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
          min-width: 1250px;
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

        .transaction-number {
          color: #2563eb;
          font-weight: 800;
        }

        .type {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 700;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .debit {
          color: #dc2626;
          font-weight: 800;
          white-space: nowrap;
        }

        .credit {
          color: #16a34a;
          font-weight: 800;
          white-space: nowrap;
        }

        .muted {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
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
          width: min(920px, 100%);
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
              <DollarSign size={25} />
            </div>

            <div>
              <h1>Transactions</h1>

              <p>
                Record and monitor
                financial transactions,
                debits, credits and
                accounting references.
              </p>
            </div>
          </div>

          <div className="top-actions">
            <button
              className="btn btn-secondary"
              onClick={
                loadTransactions
              }
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "spinner"
                    : ""
                }
              />
              Refresh
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
            to="/finance/payments"
          >
            <CreditCard size={14} />
            Payments
          </Link>

          <Link
            className="quick-link"
            to="/finance/budget-management"
          >
            <Building2 size={14} />
            Budget Management
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
                Transactions
              </span>

              <div className="stat-icon">
                <FileText size={17} />
              </div>
            </div>

            <div className="stat-value">
              {pagination.total ||
                transactions.length}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Posted
              </span>

              <div className="stat-icon">
                <CheckCircle
                  size={17}
                />
              </div>
            </div>

            <div className="stat-value">
              {stats.posted}
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
                Debits
              </span>

              <div className="stat-icon">
                <ArrowDownLeft
                  size={17}
                />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(
                stats.debitTotal
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Credits
              </span>

              <div className="stat-icon">
                <ArrowUpRight
                  size={17}
                />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(
                stats.creditTotal
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
                placeholder="Search transaction, reference, supplier, account..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />
            </div>

            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(
                  e.target.value
                );
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

              <option value="Posted">
                Posted
              </option>

              <option value="Processing">
                Processing
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
              value={
                transactionType
              }
              onChange={(e) => {
                setTransactionType(
                  e.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Types
              </option>

              <option value="Payment">
                Payment
              </option>

              <option value="Receipt">
                Receipt
              </option>

              <option value="Purchase">
                Purchase
              </option>

              <option value="Sale">
                Sale
              </option>

              <option value="Adjustment">
                Adjustment
              </option>

              <option value="Transfer">
                Transfer
              </option>

              <option value="Journal">
                Journal
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <select
              className="select"
              value={
                referenceType
              }
              onChange={(e) => {
                setReferenceType(
                  e.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All References
              </option>

              <option value="Invoice">
                Invoice
              </option>

              <option value="Payment">
                Payment
              </option>

              <option value="Purchase Order">
                Purchase Order
              </option>

              <option value="Purchase Request">
                Purchase Request
              </option>

              <option value="Budget">
                Budget
              </option>

              <option value="Asset">
                Asset
              </option>

              <option value="Other">
                Other
              </option>
            </select>

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
                Financial Transactions
              </strong>

              <span>
                {" "}
                — page{" "}
                {pagination.page} of{" "}
                {
                  pagination.totalPages
                }
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
                Loading transactions
                from the backend...
              </p>
            </div>
          ) : transactions.length ===
            0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                <DollarSign
                  size={24}
                />
              </div>

              <h3>
                No transactions found
              </h3>

              <p>
                No financial
                transactions match
                the current filters.
              </p>


            </div>
          ) : (
            <>
              <div className="table-scroll">

                <table>

                  <thead>
                    <tr>
                      <th>
                        Transaction
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Type
                      </th>

                      <th>
                        Reference
                      </th>

                      <th>
                        Account
                      </th>

                      <th>
                        Supplier / Department
                      </th>

                      <th>
                        Debit
                      </th>

                      <th>
                        Credit
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

                    {transactions.map(
                      (transaction) => (
                        <tr
                          key={
                            transaction.id ||
                            transaction.transactionNumber
                          }
                        >

                          <td>
                            <div className="transaction-number">
                              {
                                transaction.transactionNumber ||
                                "—"
                              }
                            </div>

                            {transaction.description && (
                              <div className="muted">
                                {
                                  transaction.description
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            {formatDate(
                              transaction.transactionDate
                            )}
                          </td>

                          <td>
                            <span className="type">
                              {String(
                                transaction.transactionType ||
                                  ""
                              ).toLowerCase() ===
                              "payment" ? (
                                <CreditCard
                                  size={14}
                                />
                              ) : (
                                <Wallet
                                  size={14}
                                />
                              )}

                              {
                                transaction.transactionType ||
                                "—"
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {
                                transaction.referenceNumber ||
                                "—"
                              }
                            </strong>

                            {transaction.referenceType && (
                              <div className="muted">
                                {
                                  transaction.referenceType
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <strong>
                              {
                                transaction.accountCode ||
                                "—"
                              }
                            </strong>

                            {transaction.accountName && (
                              <div className="muted">
                                {
                                  transaction.accountName
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <strong>
                              {
                                transaction.supplierName ||
                                "—"
                              }
                            </strong>

                            {transaction.departmentName && (
                              <div className="muted">
                                {
                                  transaction.departmentName
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="debit">
                              {formatMoney(
                                transaction.debit,
                                transaction.currency
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="credit">
                              {formatMoney(
                                transaction.credit,
                                transaction.currency
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="amount">
                              {formatMoney(
                                transaction.amount,
                                transaction.currency
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                transaction.status
                              )}
                            >
                              {
                                transaction.status
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
                                    transaction
                                  )
                                }
                              >
                                <Eye
                                  size={15}
                                />
                              </button>

                              <button
                                className="icon-btn"
                                title="Print"
                                onClick={() =>
                                  printTransaction(
                                    transaction
                                  )
                                }
                              >
                                <Printer
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
                  {
                    transactions.length
                  }{" "}
                  of{" "}
                  {
                    pagination.total
                  }{" "}
                  transactions
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

      {/* CREATE / EDIT */}
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
                  <DollarSign
                    size={18}
                  />
                </div>

                <div>
                  <h2>
                    {editingTransaction
                      ? "Edit Transaction"
                      : "Create Transaction"}
                  </h2>

                  <p>
                    Record a real
                    financial transaction
                    in the system.
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
              onSubmit={
                handleSubmit
              }
            >

              <div className="modal-body">

                <div className="form-grid">

                  <div className="field">
                    <label>
                      Transaction Number{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      name="transactionNumber"
                      value={
                        form.transactionNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="TXN-2026-0001"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Transaction Date{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="transactionDate"
                      value={
                        form.transactionDate
                      }
                      onChange={
                        handleChange
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Transaction Type
                    </label>

                    <select
                      className="select"
                      name="transactionType"
                      value={
                        form.transactionType
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="Payment">
                        Payment
                      </option>

                      <option value="Receipt">
                        Receipt
                      </option>

                      <option value="Purchase">
                        Purchase
                      </option>

                      <option value="Sale">
                        Sale
                      </option>

                      <option value="Adjustment">
                        Adjustment
                      </option>

                      <option value="Transfer">
                        Transfer
                      </option>

                      <option value="Journal">
                        Journal
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Status
                    </label>

                    <select
                      className="select"
                      name="status"
                      value={
                        form.status
                      }
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

                      <option value="Posted">
                        Posted
                      </option>

                      <option value="Processing">
                        Processing
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
                      Reference Type
                    </label>

                    <select
                      className="select"
                      name="referenceType"
                      value={
                        form.referenceType
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        Select reference
                      </option>

                      <option value="Invoice">
                        Invoice
                      </option>

                      <option value="Payment">
                        Payment
                      </option>

                      <option value="Purchase Order">
                        Purchase Order
                      </option>

                      <option value="Purchase Request">
                        Purchase Request
                      </option>

                      <option value="Budget">
                        Budget
                      </option>

                      <option value="Asset">
                        Asset
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
                      placeholder="INV-2026-0001"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Account Code
                    </label>

                    <input
                      className="input"
                      name="accountCode"
                      value={
                        form.accountCode
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Account code"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Account Name
                    </label>

                    <input
                      className="input"
                      name="accountName"
                      value={
                        form.accountName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Account name"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Supplier
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
                      placeholder="Supplier name"
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
                      Amount
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="amount"
                      value={
                        form.amount
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
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
                      Debit
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="debit"
                      value={
                        form.debit
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Credit
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="credit"
                      value={
                        form.credit
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
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
                      <option value="">
                        Select method
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
                      Bank Reference
                    </label>

                    <input
                      className="input"
                      name="bankReference"
                      value={
                        form.bankReference
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Bank transaction reference"
                    />
                  </div>

                  <div className="field full">
                    <label>
                      Description
                    </label>

                    <textarea
                      className="textarea"
                      name="description"
                      value={
                        form.description
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Transaction description..."
                    />
                  </div>

                  <div className="field full">
                    <label>
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      name="notes"
                      value={
                        form.notes
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Additional accounting notes..."
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
                    : editingTransaction
                    ? "Update Transaction"
                    : "Create Transaction"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* DETAILS */}
      {showDetails &&
        selectedTransaction && (
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
                      Transaction Details
                    </h2>

                    <p>
                      {
                        selectedTransaction.transactionNumber
                      }
                    </p>
                  </div>

                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setShowDetails(
                      false
                    )
                  }
                >
                  <X size={17} />
                </button>

              </div>

              <div className="modal-body">

                <div className="details-grid">

                  <div className="detail-box">
                    <span className="label">
                      Transaction Number
                    </span>

                    <strong>
                      {
                        selectedTransaction.transactionNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Date
                    </span>

                    <strong>
                      {formatDate(
                        selectedTransaction.transactionDate
                      )}
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Type
                    </span>

                    <strong>
                      {
                        selectedTransaction.transactionType ||
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
                          selectedTransaction.status
                        )}
                      >
                        {
                          selectedTransaction.status ||
                          "—"
                        }
                      </span>
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Reference Type
                    </span>

                    <strong>
                      {
                        selectedTransaction.referenceType ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Reference Number
                    </span>

                    <strong>
                      {
                        selectedTransaction.referenceNumber ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Account Code
                    </span>

                    <strong>
                      {
                        selectedTransaction.accountCode ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Account Name
                    </span>

                    <strong>
                      {
                        selectedTransaction.accountName ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Supplier
                    </span>

                    <strong>
                      {
                        selectedTransaction.supplierName ||
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
                        selectedTransaction.departmentName ||
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
                        selectedTransaction.paymentMethod ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Bank Reference
                    </span>

                    <strong>
                      {
                        selectedTransaction.bankReference ||
                        "—"
                      }
                    </strong>
                  </div>

                </div>

                <div className="amount-box">
                  <span>
                    Transaction Amount
                  </span>

                  <strong>
                    {formatMoney(
                      selectedTransaction.amount,
                      selectedTransaction.currency
                    )}
                  </strong>
                </div>

                <div
                  className="details-grid"
                  style={{
                    marginTop: 15,
                  }}
                >

                  <div className="detail-box">
                    <span className="label">
                      Debit
                    </span>

                    <strong>
                      {formatMoney(
                        selectedTransaction.debit,
                        selectedTransaction.currency
                      )}
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Credit
                    </span>

                    <strong>
                      {formatMoney(
                        selectedTransaction.credit,
                        selectedTransaction.currency
                      )}
                    </strong>
                  </div>

                  <div className="detail-box">
                    <span className="label">
                      Currency
                    </span>

                    <strong>
                      {
                        selectedTransaction.currency
                      }
                    </strong>
                  </div>

                </div>

                {selectedTransaction.description && (
                  <div
                    className="detail-box"
                    style={{
                      marginTop: 15,
                    }}
                  >
                    <span className="label">
                      Description
                    </span>

                    <strong>
                      {
                        selectedTransaction.description
                      }
                    </strong>
                  </div>
                )}

                {selectedTransaction.notes && (
                  <div
                    className="detail-box"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    <span className="label">
                      Notes
                    </span>

                    <strong>
                      {
                        selectedTransaction.notes
                      }
                    </strong>
                  </div>
                )}

              </div>

              <div className="modal-footer">

                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    printTransaction(
                      selectedTransaction
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
                      selectedTransaction
                    );
                  }}
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setShowDetails(
                      false
                    )
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

      {/* DELETE */}
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
                      Delete Transaction
                    </h2>

                    <p>
                      Confirm financial
                      record deletion.
                    </p>
                  </div>

                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setShowDelete(
                      false
                    )
                  }
                >
                  <X size={17} />
                </button>

              </div>

              <div className="modal-body">

                <div className="delete-warning">
                  Are you sure you want
                  to delete transaction{" "}
                  <strong>
                    {
                      deleteTarget.transactionNumber ||
                      "this transaction"
                    }
                  </strong>
                  ?
                  <br />
                  The backend will apply
                  its configured financial
                  data rules.
                </div>

              </div>

              <div className="modal-footer">

                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowDelete(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className="btn btn-danger"
                  onClick={
                    deleteTransaction
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

                  Delete Transaction
                </button>

              </div>

            </div>

          </div>
        )}
    </div>
  );
}