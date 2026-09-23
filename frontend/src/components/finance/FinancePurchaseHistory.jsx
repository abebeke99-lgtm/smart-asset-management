import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  Filter,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import api from "../../services/api";

const getRows = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.purchases)) return data.data.purchases;
  if (Array.isArray(data?.purchases)) return data.purchases;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
};

const getPayload = (response) => response?.data?.data || {};

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

const normalizePurchase = (item) => ({
  id: item?.id ?? item?.purchaseId ?? item?.purchase_id,

  purchaseNumber:
    item?.purchaseNumber ??
    item?.purchase_number ??
    item?.poNumber ??
    item?.po_number ??
    item?.orderNumber ??
    item?.order_number ??
    "",

  requestNumber:
    item?.requestNumber ??
    item?.request_number ??
    item?.purchaseRequestNumber ??
    item?.purchase_request_number ??
    "",

  supplier:
    item?.supplier ??
    item?.supplierName ??
    item?.supplier_name ??
    item?.vendor ??
    item?.vendorName ??
    item?.vendor_name ??
    "",

  department:
    item?.department ??
    item?.departmentName ??
    item?.department_name ??
    "",

  description:
    item?.description ??
    item?.itemDescription ??
    item?.item_description ??
    item?.title ??
    "",

  category: item?.category ?? "",

  quantity:
    Number(
      item?.quantity ??
        item?.qty ??
        item?.itemQuantity ??
        item?.item_quantity
    ) || 0,

  unitPrice:
    Number(
      item?.unitPrice ??
        item?.unit_price ??
        item?.price ??
        item?.unitCost ??
        item?.unit_cost
    ) || 0,

  subtotal:
    Number(
      item?.subtotal ??
        item?.sub_total ??
        item?.amountBeforeTax ??
        item?.amount_before_tax
    ) || 0,

  tax:
    Number(
      item?.tax ??
        item?.taxAmount ??
        item?.tax_amount
    ) || 0,

  discount:
    Number(
      item?.discount ??
        item?.discountAmount ??
        item?.discount_amount
    ) || 0,

  totalAmount:
    Number(
      item?.totalAmount ??
        item?.total_amount ??
        item?.grandTotal ??
        item?.grand_total ??
        item?.total
    ) || 0,

  status: item?.status ?? "",

  purchaseDate:
    item?.purchaseDate ??
    item?.purchase_date ??
    item?.orderDate ??
    item?.order_date ??
    item?.createdAt ??
    item?.created_at ??
    "",

  deliveryDate:
    item?.deliveryDate ??
    item?.delivery_date ??
    item?.expectedDelivery ??
    item?.expected_delivery ??
    "",

  items: Array.isArray(item?.items) ? item.items : [],
  createdBy: item?.createdByName ?? item?.createdBy ?? "",

  requestedBy:
    item?.requestedBy ??
    item?.requested_by ??
    "",

  approvedBy:
    item?.approvedBy ??
    item?.approved_by ??
    "",

  notes: item?.notes ?? item?.remarks ?? "",
});

const formatMoney = (value) => {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
};

const statusClass = (value) => {
  const status = String(value || "").toLowerCase();

  if (
    status.includes("completed") ||
    status.includes("paid") ||
    status.includes("approved") ||
    status.includes("delivered")
  ) {
    return "status success";
  }

  if (
    status.includes("pending") ||
    status.includes("processing") ||
    status.includes("partial")
  ) {
    return "status warning";
  }

  if (
    status.includes("cancel") ||
    status.includes("reject") ||
    status.includes("failed")
  ) {
    return "status danger";
  }

  return "status";
};

export default function FinancePurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState({ statuses: [], suppliers: [], departments: [] });
  const [supplier, setSupplier] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    page: 1,
  });

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/finance/purchase-history", {
        params: {
          page,
          limit: pageSize,
          search: search || undefined,
          status: status || undefined,
          supplier: supplier || undefined,
          departmentId: departmentId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });

      const rows = getRows(response).map(normalizePurchase);
      const payload = getPayload(response);

      setPurchases(rows);

      setSummary(
        payload.summary ||
          payload.statistics ||
          payload.stats ||
          response?.data?.summary ||
          response?.data?.statistics ||
          response?.data?.stats ||
          null
      );
      setFilters(payload.filters || response?.data?.filters || { statuses: [], suppliers: [], departments: [] });

      setPagination(
        getPagination(response, rows.length, page, pageSize)
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load purchase history."
      );
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    status,
    supplier,
    departmentId,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const localStats = useMemo(() => {
    return {
      totalPurchases: pagination.total,
      totalAmount: Number(summary?.totalValue) || 0,
    };
  }, [summary, pagination.total]);

  const stats = {
    totalPurchases: Number(summary?.total) || localStats.totalPurchases,
    totalAmount: Number(summary?.totalValue) || localStats.totalAmount,
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setSupplier("");
    setDepartmentId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetails(true);
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.pages) return;
    setPage(nextPage);
  };

  return (
    <div className="history-page">
      <style>{`
        * { box-sizing: border-box; }

        .history-page {
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
        }

        .title-wrap p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
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
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
        }

        .btn-secondary {
          background: white;
          color: #0f172a;
          border: 1px solid #e2e8f0;
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
          gap: 14px;
          align-items: center;
          box-shadow: 0 4px 15px rgba(15,23,42,.04);
        }

        .summary-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #e0f2fe;
          color: #0284c7;
          flex-shrink: 0;
        }

        .summary-card h3 {
          margin: 0 0 5px;
          font-size: 12px;
          color: #64748b;
        }

        .summary-card strong {
          font-size: 22px;
        }

        .filters {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(240px, 1fr) 160px 160px 150px 150px auto;
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

        input, select {
          width: 100%;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          padding: 11px 12px;
          background: white;
          color: #0f172a;
          outline: none;
          font: inherit;
        }

        .search-box input {
          padding-left: 38px;
        }

        input:focus, select:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14,165,233,.12);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(15,23,42,.04);
        }

        .table-top {
          padding: 17px 20px;
          border-bottom: 1px solid #eef2f7;
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          min-width: 1150px;
        }

        th {
          padding: 13px 16px;
          text-align: left;
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

        .purchase-number {
          font-weight: 800;
        }

        .sub {
          margin-top: 3px;
          font-size: 11px;
          color: #64748b;
        }

        .supplier {
          font-weight: 700;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
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

        .icon-btn {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: #0284c7;
          border-color: #7dd3fc;
        }

        .empty, .loading {
          text-align: center;
          padding: 55px 20px;
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
          display: grid;
          place-items: center;
          background: white;
          border: 1px solid #dbe3ec;
          border-radius: 8px;
          cursor: pointer;
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

        .modal-header {
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #eef2f7;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border: 0;
          background: #f1f5f9;
          border-radius: 8px;
          cursor: pointer;
        }

        .details-grid {
          padding: 20px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 13px;
        }

        .detail-item {
          background: #f8fafc;
          padding: 13px;
          border-radius: 10px;
        }

        .detail-item.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          font-weight: 650;
          word-break: break-word;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #eef2f7;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 1200px) {
          .filters {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 700px) {
          .history-page {
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

          .details-grid {
            grid-template-columns: 1fr;
          }

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
            <h1>Purchase History</h1>
            <p>
              Review historical procurement transactions, suppliers,
              purchase values, invoices, and payment status.
            </p>
          </div>

          <div className="header-actions">
            <Link className="btn btn-secondary" to="/finance">
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <Link
              className="btn btn-secondary"
              to="/finance/purchase-orders"
            >
              Purchase Orders
            </Link>

            <button
              className="btn btn-secondary"
              onClick={loadHistory}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spinner" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <FileText size={22} />
            </div>
            <div>
              <h3>Total Purchases</h3>
              <strong>{stats.totalPurchases}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CircleDollarSign size={22} />
            </div>
            <div>
              <h3>Total Purchase Value</h3>
              <strong>{formatMoney(stats.totalAmount)}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3>Completed Purchases</h3>
              <strong>{summary?.Completed || 0}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CalendarDays size={22} />
            </div>
            <div>
              <h3>Pending Approval</h3>
              <strong>{summary?.["Pending Approval"] || 0}</strong>
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
              placeholder="Search PO, supplier, invoice, department..."
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
            {filters.statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Suppliers</option>
            {filters.suppliers.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {filters.departments.map((value) => (
              <option key={value.id} value={value.id}>{value.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title="Date from"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            title="Date to"
          />

          <button className="btn btn-secondary" onClick={clearFilters}>
            <Filter size={15} />
            Clear
          </button>
        </div>

        <div className="table-card">
          <div className="table-top">
            <h2>Procurement History</h2>
            <span className="muted">
              {pagination.total} record
              {pagination.total === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading">
              <RefreshCw size={27} className="spinner" />
              <p>Loading purchase history...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="empty">
              <Package size={40} />
              <p>No purchase history found.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Purchase</th>
                      <th>Supplier</th>
                      <th>Department</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Total Amount</th>
                      <th>Purchase Date</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>
                          <div className="purchase-number">
                            {purchase.purchaseNumber || "—"}
                          </div>

                          {purchase.requestNumber && (
                            <div className="sub">
                              Request: {purchase.requestNumber}
                            </div>
                          )}

                          {purchase.invoiceNumber && (
                            <div className="sub">
                              PO: {purchase.poNumber}
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="supplier">
                            {purchase.supplier || "—"}
                          </div>
                        </td>

                        <td>{purchase.department || "—"}</td>

                        <td>
                          {purchase.description || "—"}
                          {purchase.category && (
                            <div className="sub">
                              {purchase.category}
                            </div>
                          )}
                        </td>

                        <td>{purchase.quantity || 0}</td>

                        <td className="amount">
                          {formatMoney(purchase.totalAmount)}
                        </td>

                        <td>{formatDate(purchase.purchaseDate)}</td>

                        <td>
                          <span className={statusClass(purchase.status)}>
                            {purchase.status || "—"}
                          </span>
                        </td>

                        <td>
                          <button
                            className="icon-btn"
                            title="View purchase"
                            onClick={() => openDetails(purchase)}
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="muted">
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

      {showDetails && selectedPurchase && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Purchase Details</h2>

              <button
                className="close-btn"
                onClick={() => setShowDetails(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="details-grid">
              {[
                ["Purchase Number", selectedPurchase.purchaseNumber],
                ["Purchase Order", selectedPurchase.poNumber],
                ["Request Number", selectedPurchase.requestNumber],
                ["Supplier", selectedPurchase.supplier],
                ["Department", selectedPurchase.department],
                ["Description", selectedPurchase.description],
                ["Category", selectedPurchase.category],
                ["Quantity", selectedPurchase.quantity],
                ["Unit Price", formatMoney(selectedPurchase.unitPrice)],
                ["Subtotal", formatMoney(selectedPurchase.subtotal)],
                ["Tax", formatMoney(selectedPurchase.taxAmount)],
                ["Discount", formatMoney(selectedPurchase.discountAmount)],
                ["Total Amount", formatMoney(selectedPurchase.totalAmount)],
                ["Status", selectedPurchase.status],
                ["Purchase Date", formatDate(selectedPurchase.purchaseDate)],
                ["Delivery Date", formatDate(selectedPurchase.deliveryDate)],
                ["Created By", selectedPurchase.createdBy],
                ["Approved By", selectedPurchase.approvedByName],
                ["Notes", selectedPurchase.notes],
              ].map(([label, value]) => (
                <div
                  className={`detail-item ${
                    label === "Description" || label === "Notes"
                      ? "full"
                      : ""
                  }`}
                  key={label}
                >
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">
                    {value || "—"}
                  </div>
                </div>
              ))}

              <div className="detail-item full">
                <div className="detail-label">Items</div>
                <div className="detail-value">
                  {(selectedPurchase.items || [])
                    .map((item) => `${item.itemName} | Qty ${item.quantity} | ${formatMoney(item.unitPrice)} each | ${formatMoney(item.lineTotal)}`)
                    .join("\n") || "—"}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}