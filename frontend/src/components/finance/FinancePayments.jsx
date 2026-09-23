import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, RefreshCw, CheckCircle, XCircle, Clock, CreditCard, Landmark, FileText, CircleDollarSign, ArrowLeftRight, Filter, Eye, Wallet } from "lucide-react";
import api from "../../services/api";

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER_APPROVED_METHOD: "Other Approved Method",
};

const STATUS_LABELS = {
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

const emptyForm = {
  paymentNumber: "",
  invoiceId: "",
  amount: "",
  paymentMethod: "BANK_TRANSFER",
  referenceNumber: "",
  bankName: "",
  bankAccount: "",
  notes: "",
};

const getValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

const formatMoney = (value, currency = "ETB") => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("paid") || value.includes("completed") || value.includes("approved")) return "status success";
  if (value.includes("cancel") || value.includes("reject") || value.includes("failed")) return "status danger";
  if (value.includes("pending") || value.includes("processing")) return "status warning";
  return "status info";
};

const normalizePayment = (item) => ({
  ...item,
  id: getValue(item.id, item.payment_id, item.paymentId),
  paymentNumber: getValue(item.paymentNumber, item.payment_number, item.paymentNo, item.payment_no, ""),
  invoiceId: getValue(item.invoiceId, item.invoice_id, item.invoice?.id, item.invoiceId || item.invoice_id || ""),
  invoiceNumber: getValue(item.invoiceNumber, item.invoice_number, item.invoice?.invoiceNumber, item.InvoiceRecord?.invoiceNumber, ""),
  supplierName: getValue(item.supplierName, item.supplier_name, item.supplier?.name, item.InvoiceRecord?.supplierName, ""),
  paymentDate: getValue(item.paymentDate, item.payment_date, item.date, item.createdAt, ""),
  amount: Number(getValue(item.amount, item.paymentAmount, item.payment_amount, 0)),
  currency: getValue(item.currency, "ETB"),
  paymentMethod: getValue(item.paymentMethod, item.payment_method, "BANK_TRANSFER"),
  referenceNumber: getValue(item.referenceNumber, item.reference_number, item.reference, ""),
  bankName: getValue(item.bankName, item.bank_name, ""),
  bankAccount: getValue(item.bankAccount, item.bank_account, ""),
  status: getValue(item.status, "PENDING_APPROVAL"),
  notes: getValue(item.notes, ""),
  requestedByName: getValue(item.requestedByName, item.Requester?.fullName, item.Requester?.username, ""),
  approvedByName: getValue(item.approvedByName, item.Approver?.fullName, item.Approver?.username, ""),
  processedByName: getValue(item.processedByName, item.Processor?.fullName, item.Processor?.username, ""),
});

export default function FinancePayments() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadInvoices = async () => {
    try {
      const response = await api.get("/finance/invoices", { params: { page: 1, pageSize: 50 } });
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      setInvoices(rows);
    } catch {
      setInvoices([]);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, pageSize };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      const response = await api.get("/finance/payments", { params });
      const payloadRows = Array.isArray(response?.data?.data) ? response.data.data : [];
      const rows = payloadRows.map(normalizePayment);
      setPayments(rows);
      const total = Number(response?.data?.pagination?.total ?? payloadRows.length ?? 0);
      setPagination({
        total: Number.isFinite(total) ? total : rows.length,
        page: Number(response?.data?.pagination?.page ?? page),
        pageSize: Number(response?.data?.pagination?.pageSize ?? pageSize),
        totalPages: Number(response?.data?.pagination?.totalPages ?? Math.max(1, Math.ceil((Number.isFinite(total) ? total : rows.length) / Math.max(pageSize, 1)))),
      });
    } catch (err) {
      setPayments([]);
      setError(err?.response?.data?.message || err?.message || "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);
  useEffect(() => { loadPayments(); }, [page, pageSize, status]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else loadPayments();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((item) => ["PENDING_APPROVAL", "APPROVED", "PROCESSING"].includes(String(item.status))).length;
    const completed = payments.filter((item) => ["COMPLETED"].includes(String(item.status))).length;
    const rejected = payments.filter((item) => ["REJECTED", "CANCELLED", "FAILED"].includes(String(item.status))).length;
    const totalAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, pending, completed, rejected, totalAmount };
  }, [payments]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const amount = Number(form.amount || 0);
      if (!form.invoiceId) throw new Error("Please select an invoice.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero.");
      const payload = {
        paymentNumber: form.paymentNumber || `PAY-${Date.now()}`,
        invoiceId: Number(form.invoiceId),
        amount,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || `REF-${Date.now()}`,
        bankName: form.bankName || "",
        bankAccount: form.bankAccount || "",
        notes: form.notes || "",
      };
      await api.post("/finance/payment-requests", payload);
      setSuccess("Payment request created successfully.");
      setShowForm(false);
      setForm(emptyForm);
      await loadPayments();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to submit payment request.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async (payment, action) => {
    try {
      setError("");
      setSuccess("");
      await api.post(`/finance/payments/${payment.id}/${action}`);
      setSuccess(`Payment ${action}d successfully.`);
      await loadPayments();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to update payment.");
    }
  };

  const topActions = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button className="btn btn-secondary" type="button" onClick={() => loadPayments()}>
        <RefreshCw size={15} /> Refresh
      </button>
      <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
        <Plus size={15} /> New Payment Request
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0ea5e9, #2563eb)", color: "#fff", boxShadow: "0 10px 25px rgba(37,99,235,0.18)" }}>
              <Wallet size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Payments</h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>Track supplier payments, approvals, transactions, and payment receipts.</p>
            </div>
          </div>
          {topActions}
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><XCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={16} /> {success}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Total Payments</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#eff6ff", color: "#2563eb" }}><CreditCard size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.total}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Pending</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#fef3c7", color: "#b45309" }}><Clock size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.pending}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Completed</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#dcfce7", color: "#166534" }}><CheckCircle size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.completed}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Rejected / Cancelled</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#fee2e2", color: "#b91c1c" }}><XCircle size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.rejected}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Total Amount</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#dbeafe", color: "#1d4ed8" }}><CircleDollarSign size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{formatMoney(stats.totalAmount)}</div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.4fr) 180px 160px auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Search</label>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payments..." style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px 0 36px", outline: "none" }} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Status</label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 10px", outline: "none" }}>
                <option value="">All</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Rows</label>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 10px", outline: "none" }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <button type="button" onClick={() => { setSearch(""); setStatus(""); setPage(1); }} style={{ minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", background: "#fff", fontWeight: 700, cursor: "pointer" }}><Filter size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Clear</button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 15, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong>Payment Requests</strong>
            <span style={{ color: "#64748b", fontSize: 12 }}>Showing {payments.length} of {pagination.total}</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}><RefreshCw size={18} className="spinner" style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> Loading payments...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", background: "#eff6ff", color: "#2563eb" }}><CreditCard size={22} /></div>
              <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>No payments found</h3>
              <p style={{ margin: 0 }}>No payment requests or processed payments are available.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Payment Number</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Invoice</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Supplier</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Date</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Amount</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Method</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Reference</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 15px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                      <td style={{ padding: "14px 15px", fontWeight: 700, color: "#2563eb" }}>{payment.paymentNumber || "—"}</td>
                      <td style={{ padding: "14px 15px" }}>{payment.invoiceNumber || payment.invoiceId || "—"}</td>
                      <td style={{ padding: "14px 15px" }}>{payment.supplierName || "—"}</td>
                      <td style={{ padding: "14px 15px" }}>{formatDate(payment.paymentDate)}</td>
                      <td style={{ padding: "14px 15px", fontWeight: 800 }}>{formatMoney(payment.amount, payment.currency)}</td>
                      <td style={{ padding: "14px 15px" }}>{PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || "—"}</td>
                      <td style={{ padding: "14px 15px" }}>{payment.referenceNumber || "—"}</td>
                      <td style={{ padding: "14px 15px" }}><span className={statusClass(payment.status)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: statusClass(payment.status) === "status success" ? "#dcfce7" : statusClass(payment.status) === "status danger" ? "#fee2e2" : statusClass(payment.status) === "status warning" ? "#fef3c7" : "#dbeafe", color: statusClass(payment.status) === "status success" ? "#166534" : statusClass(payment.status) === "status danger" ? "#991b1b" : statusClass(payment.status) === "status warning" ? "#92400e" : "#1e40af" }}>{STATUS_LABELS[payment.status] || payment.status}</span></td>
                      <td style={{ padding: "14px 15px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" title="View" style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Eye size={15} /></button>
                          {payment.status === "PENDING_APPROVAL" && (<button type="button" title="Approve" onClick={() => handleStatusAction(payment, "approve")} style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><CheckCircle size={15} /></button>)}
                          {payment.status === "APPROVED" && (<button type="button" title="Process" onClick={() => handleStatusAction(payment, "process")} style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ArrowLeftRight size={15} /></button>)}
                          {payment.status === "PENDING_APPROVAL" && (<button type="button" title="Reject" onClick={() => handleStatusAction(payment, "reject")} style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><XCircle size={15} /></button>)}
                          {!["COMPLETED", "CANCELLED", "FAILED", "REJECTED"].includes(String(payment.status)) && (<button type="button" title="Cancel" onClick={() => handleStatusAction(payment, "cancel")} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><XCircle size={15} /></button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ color: "#64748b", fontSize: 12 }}>Page {pagination.page} of {pagination.totalPages}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} style={{ width: 34, height: 34, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}>←</button>
              <span style={{ minWidth: 40, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#2563eb", color: "#fff", borderRadius: 8, fontWeight: 800 }}>{pagination.page}</span>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} style={{ width: 34, height: 34, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", opacity: page >= pagination.totalPages ? 0.5 : 1, cursor: page >= pagination.totalPages ? "not-allowed" : "pointer" }}>→</button>
            </div>
          </div>
        </div>

        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onClick={() => setShowForm(false)}>
            <div style={{ width: "min(880px, 100%)", background: "#fff", borderRadius: 20, boxShadow: "0 25px 70px rgba(15,23,42,.25)" }} onClick={(event) => event.stopPropagation()}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={18} /></div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Create Payment Request</h2>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Create a payment request tied to a verified invoice.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowForm(false)} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>×</button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Payment Number</label>
                    <input name="paymentNumber" value={form.paymentNumber} onChange={handleChange} placeholder="PAY-2026-0001" style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Invoice</label>
                    <select name="invoiceId" value={form.invoiceId} onChange={handleChange} style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 10px", outline: "none" }}>
                      <option value="">Select invoice</option>
                      {invoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber || `INV-${invoice.id}`} - {invoice.supplierName || "Supplier"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Amount</label>
                    <input name="amount" value={form.amount} onChange={handleChange} placeholder="5000" style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Payment Method</label>
                    <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange} style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 10px", outline: "none" }}>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Reference Number</label>
                    <input name="referenceNumber" value={form.referenceNumber} onChange={handleChange} placeholder="TRX-001" style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Bank Name</label>
                    <input name="bankName" value={form.bankName} onChange={handleChange} placeholder="Commercial Bank of Ethiopia" style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px", outline: "none" }} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Bank / Account</label>
                    <input name="bankAccount" value={form.bankAccount} onChange={handleChange} placeholder="Account number or branch reference" style={{ width: "100%", minHeight: 42, borderRadius: 9, border: "1px solid #dbe3ed", padding: "0 12px", outline: "none" }} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Notes</label>
                    <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes" style={{ width: "100%", minHeight: 90, borderRadius: 9, border: "1px solid #dbe3ed", padding: "10px 12px", resize: "vertical", outline: "none" }} />
                  </div>
                </div>

                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ minHeight: 42, padding: "0 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={saving} style={{ minHeight: 42, padding: "0 16px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Submitting...</> : "Create Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
