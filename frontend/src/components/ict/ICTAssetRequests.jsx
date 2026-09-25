import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  Eye,
  FilePlus2,
  Filter,
  LoaderCircle,
  MapPin,
  MonitorSmartphone,
  MessageSquare,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tags,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../services/apiClient";
import "./ICTAssetRequests.css";

const PAGE_SIZE = 10;
const statuses = ["pending", "approved", "rejected", "cancelled"];
const priorities = ["low", "medium", "high", "critical"];
const requestTypes = [
  "new_asset",
  "asset_issue",
  "replacement",
  "transfer",
  "return",
  "maintenance",
  "other",
];

const label = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) =>
  value === null || value === undefined || value === ""
    ? "Not recorded"
    : value;
const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
const getErrorMessage = (error, fallback) =>
  ({
    401: "Authentication is required to view asset requests.",
    403: "You do not have permission to access asset requests.",
    404: "The requested resource was not found.",
    409: "This request conflicts with the current workflow state.",
  })[error.response?.status] ||
  error.response?.data?.message ||
  fallback;

const normalizeRequest = (request) => ({
  ...request,
  requestNumber:
    request.requestNumber ||
    request.request_id ||
    `REQ-${String(request.id).padStart(6, "0")}`,
  requesterName:
    request.requester?.name ||
    request.requested_by ||
    request.Requester?.fullName ||
    request.Requester?.username,
  departmentName:
    request.department?.name || request.department || request.Department?.name,
  itemName: request.item || request.asset?.name || request.Asset?.name,
  createdDate: request.createdAt || request.created_at,
});

const emptyForm = {
  type: "new_asset",
  item: "",
  asset_id: "",
  quantity: "1",
  priority: "medium",
  reason: "",
};

export default function ICTAssetRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const loadRequests = async () => {
    setError("");
    try {
      const response = await apiClient.get("/api/approvals", {
        params: { status: filters.status || undefined },
      });
      const payload = response.data || {};
      const rows = Array.isArray(payload.requests)
        ? payload.requests
        : Array.isArray(payload.approvals)
          ? payload.approvals
          : [];
      setRequests(rows.map(normalizeRequest));
      const normalizedRows = rows.map(normalizeRequest);
      setSummary({
        total: Number.isFinite(Number(payload.total))
          ? Number(payload.total)
          : rows.length,
        pending: normalizedRows.filter((request) => request.status === "pending").length,
        approved: normalizedRows.filter((request) => request.status === "approved").length,
        rejected: normalizedRows.filter((request) => request.status === "rejected").length,
        cancelled: normalizedRows.filter((request) => request.status === "cancelled").length,
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load asset requests."));
      setRequests([]);
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "ict_officer") return undefined;
    setLoading(true);
    const timer = setTimeout(loadRequests, filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [user?.role, filters.status, filters.search]);

  useEffect(() => {
    if (user?.role !== "ict_officer") return undefined;
    apiClient
      .get("/api/ict/assets", { params: { limit: 100 } })
      .then(({ data }) =>
        setAssets(Array.isArray(data?.assets) ? data.assets : []),
      )
      .catch(() => setAssets([]));
    return undefined;
  }, [user?.role]);

  const filteredRequests = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return requests.filter((request) => {
      if (
        filters.priority &&
        String(request.priority).toLowerCase() !== filters.priority
      )
        return false;
      if (!search) return true;
      return [
        request.requestNumber,
        request.itemName,
        request.type,
        request.requesterName,
        request.departmentName,
        request.reason,
        request.asset?.assetCode,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search),
      );
    });
  }, [requests, filters.priority, filters.search]);

  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pageRows = filteredRequests.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const updateFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };
  const refresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ search: "", status: "", priority: "" });
  };

  const decideRequest = async (request, status) => {
    const comment = status === "rejected"
      ? window.prompt("Provide a reason for rejecting this request:")
      : "";
    if (status === "rejected" && !comment?.trim()) return;
    if (status === "approved" && !window.confirm(`Approve ${request.requestNumber}?`)) return;

    setDeciding(true);
    try {
      await apiClient.patch(`/api/approvals/${request.id}`, {
        status,
        comment: comment?.trim() || "",
      });
      toast.success(`Request ${status} successfully.`);
      setSelected(null);
      setMenuId(null);
      await loadRequests();
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Unable to update the request."));
    } finally {
      setDeciding(false);
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (
      !form.type ||
      !form.reason.trim() ||
      !form.item.trim() ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      toast.error("Type, item, reason, and a positive quantity are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/api/approvals", {
        ...form,
        asset_id: form.asset_id || undefined,
        quantity,
        reason: form.reason.trim(),
      });
      toast.success("Request submitted successfully.");
      setForm(emptyForm);
      setShowCreate(false);
      await loadRequests();
    } catch (requestError) {
      toast.error(
        getErrorMessage(requestError, "Unable to submit the asset request."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !["ict_officer", "admin"].includes(user.role)) return null;

  return (
    <main className="ict-requests-page">
      <div className="ict-requests-container">
        <header className="ict-requests-header">
          <div className="ict-requests-heading">
            <span className="ict-requests-heading-icon">
              <ClipboardList size={22} />
            </span>
            <div>
              <p className="ict-requests-eyebrow">ICT / ASSET REQUESTS</p>
              <h1>Asset Requests</h1>
              <p>
                Request ICT equipment and assets, review approvals, track
                fulfillment, and maintain complete request history.
              </p>
            </div>
          </div>
          <div className="ict-requests-actions">
            <button
              className="ict-requests-secondary"
              type="button"
              onClick={refresh}
              disabled={loading || refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />{" "}
              Refresh
            </button>
            <button
              className="ict-requests-primary"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              <FilePlus2 size={17} /> New Request
            </button>
          </div>
        </header>

        <section className="ict-requests-summary" aria-label="Request summary">
          <SummaryCard
            icon={ClipboardList}
            label="Total Requests"
            value={summary?.total}
            tone="blue"
          />
          <SummaryCard icon={Clock3} label="Pending" value={summary?.pending} tone="amber" />
          <SummaryCard icon={CircleCheck} label="Approved" value={summary?.approved} tone="green" />
          <SummaryCard icon={CircleX} label="Rejected" value={summary?.rejected} tone="red" />
          <SummaryCard icon={Ban} label="Cancelled" value={summary?.cancelled} tone="slate" />
        </section>

        <section className="ict-requests-toolbar" aria-label="Request filters">
          <div className="ict-requests-filter-title">
            <SlidersHorizontal size={17} /> Search and filters
          </div>
          <label className="ict-requests-search">
            <Search size={17} />
            <span className="sr-only">Search asset requests</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search request, requester, department, item..."
            />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Priority</span>
            <select
              value={filters.priority}
              onChange={(event) => updateFilter("priority", event.target.value)}
            >
              <option value="">All priorities</option>
              {priorities.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          {(filters.search || filters.status || filters.priority) && (
            <button className="ict-requests-secondary" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
          <Filter size={17} className="ict-requests-filter-icon" />
        </section>

        {error && (
          <div className="ict-requests-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" onClick={refresh}>
              Retry
            </button>
          </div>
        )}
        <section className="ict-requests-panel">
          <div className="ict-requests-panel-head">
            <div>
              <h2>Request register</h2>
              <span>
                {loading
                  ? "Loading asset requests..."
                  : `${filteredRequests.length} request${filteredRequests.length === 1 ? "" : "s"} in the current view`}
              </span>
            </div>
            {loading && <LoaderCircle size={18} className="spin" />}
          </div>
          {loading ? (
            <RequestSkeleton />
          ) : pageRows.length ? (
            <div className="ict-requests-table-wrap">
              <table>
                <caption className="sr-only">ICT asset requests</caption>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Requester</th>
                    <th>Department</th>
                    <th>Requested Item</th>
                    <th>Priority</th>
                    <th>Request Date</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <button
                          className="ict-requests-identity"
                          type="button"
                          onClick={() => setSelected(request)}
                        >
                          <strong>{request.requestNumber}</strong>
                          <span>{display(request.reason)}</span>
                        </button>
                      </td>
                      <td>
                        <span className="ict-requests-person">
                          <UserRound size={15} />
                          {display(request.requesterName)}
                        </span>
                      </td>
                      <td>
                        <span className="ict-requests-person">
                          <Building2 size={15} />
                          {display(request.departmentName)}
                        </span>
                      </td>
                      <td>
                        <span className="ict-requests-person">
                          <MonitorSmartphone size={15} />
                          {display(request.itemName)}
                        </span>
                        <small>
                          {request.asset?.assetCode || "Asset not linked"}
                        </small>
                      </td>
                      <td>
                        <Priority value={request.priority} />
                      </td>
                      <td>{formatDate(request.createdDate)}</td>
                      <td>
                        <Status value={request.status} />
                      </td>
                      <td className="ict-requests-menu-cell">
                        <button
                          className="ict-requests-icon-button"
                          type="button"
                          onClick={() =>
                            setMenuId(menuId === request.id ? null : request.id)
                          }
                          aria-label={`More actions for ${request.requestNumber}`}
                          title="More actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuId === request.id && (
                          <div className="ict-requests-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(request);
                                setMenuId(null);
                              }}
                            >
                              <Eye size={15} /> View details
                            </button>
                            {user && ["admin", "college", "finance", "store_manager"].includes(user.role) && request.status === "pending" && (
                              <>
                                <button type="button" disabled={deciding} onClick={() => decideRequest(request, "approved")}>
                                  <CircleCheck size={15} /> Approve
                                </button>
                                <button type="button" disabled={deciding} onClick={() => decideRequest(request, "rejected")}>
                                  <CircleX size={15} /> Reject
                                </button>
                              </>
                            )}
                            <span title="Backend workflow does not expose fulfillment for ICT officers">
                              <PackageCheck size={15} /> Fulfillment not
                              available
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              hasFilters={Boolean(
                filters.search || filters.status || filters.priority,
              )}
              onCreate={() => setShowCreate(true)}
            />
          )}
          {!loading && filteredRequests.length > 0 && (
            <nav className="ict-requests-pagination" aria-label="Request pages">
              <span>
                Page {page} of {pageCount}
              </span>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      {selected && (
        <Details request={selected} onClose={() => setSelected(null)} />
      )}
      {showCreate && (
        <div
          className="ict-requests-modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setShowCreate(false)
          }
        >
          <section
            className="ict-requests-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-request-title"
          >
            <div className="ict-requests-modal-head">
              <div>
                <p className="ict-requests-eyebrow">REQUEST WORKFLOW</p>
                <h2 id="new-request-title">New Asset Request</h2>
              </div>
              <button
                className="ict-requests-icon-button"
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <form onSubmit={submitRequest}>
              <div className="ict-requests-form-grid">
                <label>
                  Request type
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm({ ...form, type: event.target.value })
                    }
                  >
                    {requestTypes.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                  >
                    {priorities.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Requested item
                  <input
                    required
                    value={form.item}
                    onChange={(event) =>
                      setForm({ ...form, item: event.target.value })
                    }
                    placeholder="Equipment or asset name"
                  />
                </label>
                <label>
                  Quantity
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm({ ...form, quantity: event.target.value })
                    }
                  />
                </label>
                <label className="ict-requests-form-wide">
                  Existing ICT asset
                  <select
                    value={form.asset_id}
                    onChange={(event) =>
                      setForm({ ...form, asset_id: event.target.value })
                    }
                  >
                    <option value="">No existing asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetCode || asset.assetTag} - {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ict-requests-form-wide">
                  Purpose and reason
                  <textarea
                    required
                    rows="5"
                    value={form.reason}
                    onChange={(event) =>
                      setForm({ ...form, reason: event.target.value })
                    }
                    placeholder="Explain why this request is needed"
                  />
                </label>
              </div>
              <div className="ict-requests-form-footer">
                <span>
                  <TriangleAlert size={15} /> Required date, attachments, and
                  fulfillment are not available in the current request API.
                </span>
                <button
                  className="ict-requests-primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ icon: Icon, label: title, value, tone }) {
  return (
    <article className={`ict-requests-summary-card ${tone}`}>
      <span className="ict-requests-summary-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>
          {value === undefined ? (
            <span className="skeleton-value" />
          ) : (
            value.toLocaleString()
          )}
        </strong>
        <span>{title}</span>
      </div>
    </article>
  );
}
function Priority({ value }) {
  const normalized = String(value || "").toLowerCase();
  return (
    <span className={`ict-requests-badge priority-${normalized}`}>
      <TriangleAlert size={13} />
      {label(value)}
    </span>
  );
}
function Status({ value }) {
  const normalized = String(value || "").toLowerCase();
  const Icon =
    normalized === "approved"
      ? CircleCheck
      : normalized === "rejected"
        ? CircleX
        : normalized === "pending"
          ? Clock3
          : CheckCircle2;
  return (
    <span className={`ict-requests-badge status-${normalized}`}>
      <Icon size={13} />
      {label(value)}
    </span>
  );
}
function RequestSkeleton() {
  return (
    <div className="ict-requests-skeleton" aria-label="Loading asset requests">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
function EmptyState({ hasFilters, onCreate }) {
  return (
    <div className="ict-requests-empty">
      <ClipboardList size={32} />
      <strong>
        {hasFilters
          ? "No requests match the current filters."
          : "No asset requests found."}
      </strong>
      <span>
        {hasFilters
          ? "Clear a filter or try a different search."
          : "Create a request to begin the ICT asset request workflow."}
      </span>
      {!hasFilters && (
        <button
          className="ict-requests-primary"
          type="button"
          onClick={onCreate}
        >
          <FilePlus2 size={16} /> New Request
        </button>
      )}
    </div>
  );
}
function Details({ request, onClose }) {
  return (
    <div
      className="ict-requests-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="ict-requests-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-details-title"
      >
        <div className="ict-requests-modal-head">
          <div>
            <p className="ict-requests-eyebrow">REQUEST DETAILS</p>
            <h2 id="request-details-title">{request.requestNumber}</h2>
          </div>
          <button
            className="ict-requests-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        <div className="ict-requests-detail-grid">
          <Detail
            icon={ClipboardList}
            title="Status"
            value={<Status value={request.status} />}
          />
          <Detail
            icon={TriangleAlert}
            title="Priority"
            value={<Priority value={request.priority} />}
          />
          <Detail
            icon={CalendarDays}
            title="Request date"
            value={formatDate(request.createdDate)}
          />
          <Detail icon={Tags} title="Type" value={label(request.type)} />
          <Detail
            icon={UserRound}
            title="Requester"
            value={display(request.requesterName)}
          />
          <Detail
            icon={Building2}
            title="Department"
            value={display(request.departmentName)}
          />
          <Detail
            icon={MonitorSmartphone}
            title="Requested item"
            value={display(request.itemName)}
          />
          <Detail
            icon={MapPin}
            title="Asset"
            value={request.asset?.assetCode || "Not linked"}
          />
          <Detail icon={UserRound} title="Reviewed by" value={display(request.approved_by || request.Reviewer?.fullName)} />
          <Detail icon={MessageSquare} title="Approval comment" value={display(request.approval_comment || request.comment)} />
        </div>
        <div className="ict-requests-description">
          <strong>Purpose and reason</strong>
          <p>{display(request.reason)}</p>
        </div>
        <div className="ict-requests-not-available">
          <AlertCircle size={16} /> Approval history, fulfillment, assignment,
          inventory issue, attachments, and notification links are not exposed
          by the current backend request architecture.
        </div>
      </section>
    </div>
  );
}
function Detail({ icon: Icon, title, value }) {
  return (
    <div>
      <span>
        <Icon size={15} />
        {title}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
