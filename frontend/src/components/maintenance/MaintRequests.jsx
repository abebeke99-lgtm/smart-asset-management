import React, { useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const STATUSES = [
  "Submitted",
  "Scheduled",
  "In-Progress",
  "Completed",
  "Cancelled",
  "Escalated",
];

const EMPTY_FORM = {
  assetId: "",
  description: "",
  priority: "Medium",
  category: "",
  scheduledAt: "",
  assignedTechnicianId: "",
  remarks: "",
};

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken")
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401) {
    throw new Error("Your session has expired. Please log in again.");
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to perform this maintenance action."
    );
  }

  if (!response.ok) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return body;
}

function normalizeList(response, possibleKeys = []) {
  if (Array.isArray(response)) return response;

  for (const key of possibleKeys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }

    if (Array.isArray(response?.data?.[key])) {
      return response.data[key];
    }
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function getRequestId(request) {
  return (
    request?.id ||
    request?.requestId ||
    request?.request_id ||
    null
  );
}

function getStatus(request) {
  return (
    request?.status ||
    request?.maintenanceStatus ||
    request?.maintenance_status ||
    "Submitted"
  );
}

function getPriority(request) {
  return request?.priority || "Medium";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getPriorityClass(priority) {
  return `request-priority request-priority-${String(
    priority || "medium"
  )
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

function getStatusClass(status) {
  return `request-status request-status-${String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [formError, setFormError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function loadRequests({ silent = false } = {}) {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (priorityFilter) {
        params.set("priority", priorityFilter);
      }

      if (categoryFilter) {
        params.set("category", categoryFilter);
      }

      const query = params.toString();

      const response = await apiRequest(
        `/api/maintenance/requests${query ? `?${query}` : ""}`
      );

      const data = normalizeList(response, [
        "requests",
        "maintenanceRequests",
      ]);

      setRequests(data);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError(
        err?.message || "Unable to load maintenance requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadTechnicians() {
    try {
      setLoadingTechnicians(true);

      const response = await apiRequest(
        "/api/maintenance/technicians"
      );

      setTechnicians(
        normalizeList(response, ["technicians"])
      );
    } catch (err) {
      console.error("Technician loading error:", err);
    } finally {
      setLoadingTechnicians(false);
    }
  }

  async function loadAssets() {
    try {
      setLoadingAssets(true);

      const response = await apiRequest(
        "/api/assets"
      );

      setAssets(
        normalizeList(response, ["assets"])
      );
    } catch (err) {
      console.error("Asset loading error:", err);
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    loadRequests();

    loadTechnicians();
    loadAssets();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRequests({ silent: true });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function openCreate() {
    resetForm();
    setShowCreateModal(true);
  }

  function openView(request) {
    setSelectedRequest(request);
    setShowViewModal(true);
  }

  function openEdit(request) {
    setSelectedRequest(request);

    setForm({
      assetId:
        request?.assetId ||
        request?.asset_id ||
        "",
      description:
        request?.description || "",
      priority:
        request?.priority || "Medium",
      category:
        request?.category || "",
      scheduledAt:
        request?.scheduledAt ||
        request?.scheduled_at ||
        "",
      assignedTechnicianId:
        request?.assignedTechnicianId ||
        request?.assigned_technician_id ||
        "",
      remarks:
        request?.remarks || "",
    });

    setFormError("");
    setShowEditModal(true);
  }

  function openAssign(request) {
    setSelectedRequest(request);

    setForm({
      ...EMPTY_FORM,
      assignedTechnicianId:
        request?.assignedTechnicianId ||
        request?.assigned_technician_id ||
        "",
    });

    setFormError("");
    setShowAssignModal(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!form.assetId) {
      setFormError("Asset is required.");
      return;
    }

    if (!form.description.trim()) {
      setFormError("Problem description is required.");
      return;
    }

    if (!form.category.trim()) {
      setFormError("Maintenance category is required.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      setActionMessage("");

      await apiRequest("/api/maintenance/requests", {
        method: "POST",
        body: JSON.stringify({
          assetId: form.assetId,
          description: form.description.trim(),
          priority: form.priority,
          category: form.category.trim(),
          scheduledAt: form.scheduledAt || null,
          assignedTechnicianId:
            form.assignedTechnicianId || null,
          remarks: form.remarks.trim() || null,
        }),
      });

      setShowCreateModal(false);
      resetForm();

      setActionMessage(
        "Maintenance request created successfully."
      );

      await loadRequests({ silent: true });
    } catch (err) {
      console.error(err);

      setFormError(
        err?.message ||
          "Unable to create maintenance request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();

    const id = getRequestId(selectedRequest);

    if (!id) {
      setFormError("Maintenance request ID is missing.");
      return;
    }

    if (!form.description.trim()) {
      setFormError("Problem description is required.");
      return;
    }

    if (!form.category.trim()) {
      setFormError("Maintenance category is required.");
      return;
    }

    try {
      setUpdating(true);
      setFormError("");
      setActionMessage("");

      await apiRequest(
        `/api/maintenance/requests/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            assetId: form.assetId,
            description: form.description.trim(),
            priority: form.priority,
            category: form.category.trim(),
            scheduledAt: form.scheduledAt || null,
            assignedTechnicianId:
              form.assignedTechnicianId || null,
            remarks: form.remarks.trim() || null,
          }),
        }
      );

      setShowEditModal(false);

      setActionMessage(
        "Maintenance request updated successfully."
      );

      await loadRequests({ silent: true });
    } catch (err) {
      console.error(err);

      setFormError(
        err?.message ||
          "Unable to update maintenance request."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssign(event) {
    event.preventDefault();

    const id = getRequestId(selectedRequest);

    if (!id) {
      setFormError("Maintenance request ID is missing.");
      return;
    }

    if (!form.assignedTechnicianId) {
      setFormError("Please select a technician.");
      return;
    }

    try {
      setAssigning(true);
      setFormError("");
      setActionMessage("");

      await apiRequest(
        `/api/maintenance/requests/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            assignedTechnicianId:
              form.assignedTechnicianId,
          }),
        }
      );

      setShowAssignModal(false);

      setActionMessage(
        "Technician assigned successfully."
      );

      await loadRequests({ silent: true });
    } catch (err) {
      console.error(err);

      setFormError(
        err?.message ||
          "Unable to assign technician."
      );
    } finally {
      setAssigning(false);
    }
  }

  async function updateStatus(request, status) {
    const id = getRequestId(request);

    if (!id) {
      setActionMessage(
        "Maintenance request ID is missing."
      );
      return;
    }

    try {
      setActionMessage("");

      await apiRequest(
        `/api/maintenance/requests/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      setActionMessage(
        `Request status changed to ${status}.`
      );

      await loadRequests({ silent: true });
    } catch (err) {
      console.error(err);

      setActionMessage(
        err?.message ||
          "Unable to update request status."
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setCategoryFilter("");
    setPage(1);
  }

  const categories = useMemo(() => {
    const values = requests
      .map(
        (request) =>
          request?.category ||
          request?.maintenanceCategory
      )
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    /**
     * The backend is already queried using the filters.
     * This local filtering additionally protects the UI
     * when an older backend does not implement every
     * filter parameter.
     */
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const requestId = String(
        request?.requestNumber ||
          request?.request_number ||
          request?.id ||
          ""
      ).toLowerCase();

      const assetName = String(
        request?.assetName ||
          request?.asset_name ||
          ""
      ).toLowerCase();

      const assetId = String(
        request?.assetId ||
          request?.asset_id ||
          ""
      ).toLowerCase();

      const description = String(
        request?.description || ""
      ).toLowerCase();

      const requester = String(
        request?.requesterName ||
          request?.requester_name ||
          request?.requester ||
          ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        requestId.includes(query) ||
        assetName.includes(query) ||
        assetId.includes(query) ||
        description.includes(query) ||
        requester.includes(query);

      const matchesStatus =
        !statusFilter ||
        getStatus(request) === statusFilter;

      const matchesPriority =
        !priorityFilter ||
        getPriority(request) === priorityFilter;

      const requestCategory =
        request?.category ||
        request?.maintenanceCategory ||
        "";

      const matchesCategory =
        !categoryFilter ||
        requestCategory === categoryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRequests.length / pageSize
    )
  );

  const paginatedRequests = filteredRequests.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="maintenance-requests-page">
      <div className="requests-header">
        <div>
          <div className="requests-breadcrumb">
            Maintenance / Requests
          </div>

          <h1>Maintenance Requests</h1>

          <p>
            Review, search, assign, and manage university
            maintenance service requests.
          </p>
        </div>

        <div className="requests-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadRequests({ silent: true })}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={openCreate}
          >
            + New Request
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="request-success" role="status">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="request-error" role="alert">
          <div>
            <strong>Unable to load maintenance requests</strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() => loadRequests()}
          >
            Try Again
          </button>
        </div>
      )}

      <section className="request-filters">
        <div className="filter-search">
          <label htmlFor="request-search">
            Search
          </label>

          <input
            id="request-search"
            type="search"
            placeholder="Search request ID, asset, requester..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor="status-filter">
            Status
          </label>

          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="">All statuses</option>

            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority-filter">
            Priority
          </label>

          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value)
            }
          >
            <option value="">All priorities</option>

            {PRIORITIES.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category-filter">
            Category
          </label>

          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value)
            }
          >
            <option value="">All categories</option>

            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="clear-filter-button"
          onClick={clearFilters}
        >
          Clear
        </button>
      </section>

      <section className="request-summary">
        <div>
          <strong>{filteredRequests.length}</strong>
          <span>Requests</span>
        </div>

        <div>
          <strong>
            {
              filteredRequests.filter(
                (request) =>
                  getPriority(request) === "Critical"
              ).length
            }
          </strong>
          <span>Critical</span>
        </div>

        <div>
          <strong>
            {
              filteredRequests.filter(
                (request) =>
                  getStatus(request) === "Submitted"
              ).length
            }
          </strong>
          <span>Submitted</span>
        </div>

        <div>
          <strong>
            {
              filteredRequests.filter(
                (request) =>
                  getStatus(request) === "In-Progress"
              ).length
            }
          </strong>
          <span>In Progress</span>
        </div>
      </section>

      <section className="request-table-card">
        {loading ? (
          <div className="request-loading">
            <div className="spinner" />
            <p>Loading maintenance requests...</p>
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="request-empty">
            <div className="empty-icon">📋</div>

            <h3>No maintenance requests found</h3>

            <p>
              There are currently no maintenance requests
              matching your filters.
            </p>

            {(search ||
              statusFilter ||
              priorityFilter ||
              categoryFilter) && (
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Request Date</th>
                    <th>Requester</th>
                    <th>Department</th>
                    <th>Asset</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Technician</th>
                    <th>Scheduled</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRequests.map((request) => {
                    const id = getRequestId(request);

                    const requestNumber =
                      request?.requestNumber ||
                      request?.request_number ||
                      `REQ-${id || "—"}`;

                    const requester =
                      request?.requesterName ||
                      request?.requester_name ||
                      request?.requester ||
                      "—";

                    const department =
                      request?.departmentName ||
                      request?.department_name ||
                      request?.department ||
                      "—";

                    const assetName =
                      request?.assetName ||
                      request?.asset_name ||
                      "—";

                    const assetId =
                      request?.assetId ||
                      request?.asset_id ||
                      "—";

                    const category =
                      request?.category ||
                      request?.maintenanceCategory ||
                      "—";

                    const technician =
                      request?.assignedTechnicianName ||
                      request?.assigned_technician_name ||
                      request?.technicianName ||
                      "Unassigned";

                    return (
                      <tr key={id || requestNumber}>
                        <td>
                          <button
                            type="button"
                            className="request-id-button"
                            onClick={() =>
                              openView(request)
                            }
                          >
                            {requestNumber}
                          </button>
                        </td>

                        <td>
                          {formatDate(
                            request?.requestDate ||
                              request?.request_date ||
                              request?.createdAt ||
                              request?.created_at
                          )}
                        </td>

                        <td>{requester}</td>

                        <td>{department}</td>

                        <td>
                          <div className="asset-cell">
                            <strong>{assetName}</strong>

                            <small>
                              ID: {assetId}
                            </small>
                          </div>
                        </td>

                        <td>{category}</td>

                        <td>
                          <span
                            className={getPriorityClass(
                              getPriority(request)
                            )}
                          >
                            {getPriority(request)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              getStatus(request)
                            )}
                          >
                            {getStatus(request)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              technician === "Unassigned"
                                ? "unassigned"
                                : ""
                            }
                          >
                            {technician}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            request?.scheduledAt ||
                              request?.scheduled_at
                          )}
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              onClick={() =>
                                openView(request)
                              }
                              title="View"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEdit(request)
                              }
                              title="Edit"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openAssign(request)
                              }
                              title="Assign technician"
                            >
                              Assign
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>
                Showing{" "}
                {filteredRequests.length === 0
                  ? 0
                  : (page - 1) * pageSize + 1}{" "}
                to{" "}
                {Math.min(
                  page * pageSize,
                  filteredRequests.length
                )}{" "}
                of {filteredRequests.length}
              </span>

              <div className="pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* CREATE MODAL */}

      {showCreateModal && (
        <Modal
          title="Create Maintenance Request"
          onClose={() => {
            if (!submitting) {
              setShowCreateModal(false);
            }
          }}
        >
          <form onSubmit={handleCreate}>
            <RequestForm
              form={form}
              updateForm={updateForm}
              assets={assets}
              technicians={technicians}
              loadingAssets={loadingAssets}
              loadingTechnicians={loadingTechnicians}
            />

            {formError && (
              <div className="modal-error">
                {formError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowCreateModal(false)
                }
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={submitting}
              >
                {submitting
                  ? "Creating..."
                  : "Create Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW MODAL */}

      {showViewModal && selectedRequest && (
        <Modal
          title="Maintenance Request Details"
          onClose={() => setShowViewModal(false)}
        >
          <RequestDetails
            request={selectedRequest}
          />

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowViewModal(false)}
            >
              Close
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setShowViewModal(false);
                openEdit(selectedRequest);
              }}
            >
              Edit
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setShowViewModal(false);
                openAssign(selectedRequest);
              }}
            >
              Assign Technician
            </button>
          </div>
        </Modal>
      )}

      {/* EDIT MODAL */}

      {showEditModal && selectedRequest && (
        <Modal
          title="Update Maintenance Request"
          onClose={() => {
            if (!updating) {
              setShowEditModal(false);
            }
          }}
        >
          <form onSubmit={handleUpdate}>
            <RequestForm
              form={form}
              updateForm={updateForm}
              assets={assets}
              technicians={technicians}
              loadingAssets={loadingAssets}
              loadingTechnicians={loadingTechnicians}
            />

            <div className="form-field">
              <label htmlFor="edit-status">
                Status
              </label>

              <select
                id="edit-status"
                value={getStatus(selectedRequest)}
                onChange={(event) =>
                  setSelectedRequest((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {STATUSES.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="modal-error">
                {formError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowEditModal(false)
                }
                disabled={updating}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={updating}
              >
                {updating
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ASSIGN MODAL */}

      {showAssignModal && selectedRequest && (
        <Modal
          title="Assign Technician"
          onClose={() => {
            if (!assigning) {
              setShowAssignModal(false);
            }
          }}
        >
          <form onSubmit={handleAssign}>
            <div className="form-field">
              <label htmlFor="assigned-technician">
                Technician
              </label>

              <select
                id="assigned-technician"
                value={form.assignedTechnicianId}
                onChange={(event) =>
                  updateForm(
                    "assignedTechnicianId",
                    event.target.value
                  )
                }
                disabled={loadingTechnicians}
              >
                <option value="">
                  Select technician
                </option>

                {technicians.map((technician) => {
                  const technicianId =
                    technician?.id ||
                    technician?.technicianId;

                  const name =
                    technician?.fullName ||
                    technician?.full_name ||
                    technician?.name ||
                    "Unnamed Technician";

                  return (
                    <option
                      key={technicianId}
                      value={technicianId}
                    >
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            {formError && (
              <div className="modal-error">
                {formError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowAssignModal(false)
                }
                disabled={assigning}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={assigning}
              >
                {assigning
                  ? "Assigning..."
                  : "Assign Technician"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{styles}</style>
    </div>
  );
}

function RequestForm({
  form,
  updateForm,
  assets,
  technicians,
  loadingAssets,
  loadingTechnicians,
}) {
  return (
    <div className="request-form-grid">
      <div className="form-field">
        <label htmlFor="request-asset">
          Asset *
        </label>

        <select
          id="request-asset"
          value={form.assetId}
          onChange={(event) =>
            updateForm(
              "assetId",
              event.target.value
            )
          }
          disabled={loadingAssets}
        >
          <option value="">
            {loadingAssets
              ? "Loading assets..."
              : "Select asset"}
          </option>

          {assets.map((asset) => {
            const id =
              asset?.id ||
              asset?.assetId;

            const name =
              asset?.assetName ||
              asset?.asset_name ||
              asset?.name ||
              `Asset ${id}`;

            return (
              <option key={id} value={id}>
                {name} — {id}
              </option>
            );
          })}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="request-category">
          Category *
        </label>

        <input
          id="request-category"
          type="text"
          value={form.category}
          onChange={(event) =>
            updateForm(
              "category",
              event.target.value
            )
          }
          placeholder="e.g. Electrical, ICT Equipment"
        />
      </div>

      <div className="form-field">
        <label htmlFor="request-priority">
          Priority *
        </label>

        <select
          id="request-priority"
          value={form.priority}
          onChange={(event) =>
            updateForm(
              "priority",
              event.target.value
            )
          }
        >
          {PRIORITIES.map((priority) => (
            <option
              key={priority}
              value={priority}
            >
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="request-scheduled">
          Scheduled Date
        </label>

        <input
          id="request-scheduled"
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(event) =>
            updateForm(
              "scheduledAt",
              event.target.value
            )
          }
        />
      </div>

      <div className="form-field full-width">
        <label htmlFor="request-description">
          Problem Description *
        </label>

        <textarea
          id="request-description"
          rows={4}
          value={form.description}
          onChange={(event) =>
            updateForm(
              "description",
              event.target.value
            )
          }
          placeholder="Describe the maintenance problem..."
        />
      </div>

      <div className="form-field">
        <label htmlFor="request-technician">
          Assigned Technician
        </label>

        <select
          id="request-technician"
          value={form.assignedTechnicianId}
          onChange={(event) =>
            updateForm(
              "assignedTechnicianId",
              event.target.value
            )
          }
          disabled={loadingTechnicians}
        >
          <option value="">
            {loadingTechnicians
              ? "Loading technicians..."
              : "Unassigned"}
          </option>

          {technicians.map((technician) => {
            const id =
              technician?.id ||
              technician?.technicianId;

            const name =
              technician?.fullName ||
              technician?.full_name ||
              technician?.name ||
              `Technician ${id}`;

            return (
              <option key={id} value={id}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="request-remarks">
          Remarks
        </label>

        <input
          id="request-remarks"
          type="text"
          value={form.remarks}
          onChange={(event) =>
            updateForm(
              "remarks",
              event.target.value
            )
          }
          placeholder="Optional remarks"
        />
      </div>
    </div>
  );
}

function RequestDetails({ request }) {
  const requestId =
    request?.requestNumber ||
    request?.request_number ||
    request?.id ||
    "—";

  const assetName =
    request?.assetName ||
    request?.asset_name ||
    "—";

  const assetId =
    request?.assetId ||
    request?.asset_id ||
    "—";

  const requester =
    request?.requesterName ||
    request?.requester_name ||
    request?.requester ||
    "—";

  const department =
    request?.departmentName ||
    request?.department_name ||
    request?.department ||
    "—";

  const college =
    request?.collegeName ||
    request?.college_name ||
    request?.college ||
    "—";

  const location =
    request?.locationName ||
    request?.location_name ||
    request?.location ||
    "—";

  const technician =
    request?.assignedTechnicianName ||
    request?.assigned_technician_name ||
    request?.technicianName ||
    "Unassigned";

  return (
    <div className="request-details">
      <div className="details-grid">
        <Detail
          label="Request ID"
          value={requestId}
        />

        <Detail
          label="Request Date"
          value={formatDateTime(
            request?.requestDate ||
              request?.request_date ||
              request?.createdAt ||
              request?.created_at
          )}
        />

        <Detail
          label="Requester"
          value={requester}
        />

        <Detail
          label="Department"
          value={department}
        />

        <Detail
          label="College"
          value={college}
        />

        <Detail
          label="Laboratory"
          value={
            request?.laboratory ||
            request?.laboratoryName ||
            "—"
          }
        />

        <Detail
          label="Asset"
          value={`${assetName} (${assetId})`}
        />

        <Detail
          label="Location"
          value={location}
        />

        <Detail
          label="Category"
          value={
            request?.category ||
            request?.maintenanceCategory ||
            "—"
          }
        />

        <Detail
          label="Priority"
          value={getPriority(request)}
        />

        <Detail
          label="Status"
          value={getStatus(request)}
        />

        <Detail
          label="Technician"
          value={technician}
        />

        <Detail
          label="Scheduled Date"
          value={formatDateTime(
            request?.scheduledAt ||
              request?.scheduled_at
          )}
        />

        <Detail
          label="Completion Date"
          value={formatDateTime(
            request?.completionDate ||
              request?.completedAt ||
              request?.completed_at
          )}
        />
      </div>

      <div className="details-description">
        <h3>Problem Description</h3>

        <p>
          {request?.description ||
            "No description provided."}
        </p>
      </div>

      <div className="details-description">
        <h3>Remarks</h3>

        <p>
          {request?.remarks || "No remarks."}
        </p>
      </div>

      {(request?.evidencePhotos ||
        request?.evidence_photos ||
        request?.photos) && (
        <div className="details-description">
          <h3>Evidence Photos</h3>

          <div className="photo-list">
            {(
              request?.evidencePhotos ||
              request?.evidence_photos ||
              request?.photos ||
              []
            ).map((photo, index) => {
              const url =
                typeof photo === "string"
                  ? photo
                  : photo?.url;

              if (!url) return null;

              return (
                <a
                  key={`${url}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Photo {index + 1}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

const styles = `
  .maintenance-requests-page {
    min-height: 100%;
    padding: 24px;
    background: #f3f6f9;
    color: #111827;
  }

  .maintenance-requests-page *,
  .maintenance-requests-page *::before,
  .maintenance-requests-page *::after {
    box-sizing: border-box;
  }

  .requests-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 24px;
  }

  .requests-breadcrumb {
    color: #64748b;
    font-size: 13px;
    margin-bottom: 8px;
  }

  .requests-header h1 {
    margin: 0;
    font-size: 28px;
  }

  .requests-header p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 14px;
  }

  .requests-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .primary-button,
  .secondary-button {
    min-height: 40px;
    padding: 9px 15px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary-button {
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
  }

  .primary-button:hover {
    background: #1d4ed8;
  }

  .secondary-button {
    border: 1px solid #dbe3ea;
    background: white;
    color: #111827;
  }

  .secondary-button:hover {
    background: #f8fafc;
  }

  .primary-button:disabled,
  .secondary-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .request-success,
  .request-error {
    padding: 13px 16px;
    border-radius: 9px;
    margin-bottom: 18px;
    font-size: 14px;
  }

  .request-success {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #047857;
  }

  .request-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: center;
  }

  .request-error p {
    margin: 4px 0 0;
  }

  .request-error button {
    border: 0;
    background: white;
    padding: 8px 12px;
    border-radius: 7px;
    cursor: pointer;
    font-weight: 600;
  }

  .request-filters {
    display: grid;
    grid-template-columns: minmax(240px, 2fr) repeat(3, minmax(150px, 1fr)) auto;
    gap: 12px;
    align-items: end;
    padding: 16px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    margin-bottom: 16px;
  }

  .request-filters label,
  .form-field label {
    display: block;
    margin-bottom: 6px;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
  }

  .request-filters input,
  .request-filters select,
  .form-field input,
  .form-field select,
  .form-field textarea {
    width: 100%;
    border: 1px solid #cbd5e1;
    background: white;
    color: #111827;
    border-radius: 7px;
    min-height: 40px;
    padding: 9px 11px;
    outline: none;
    font: inherit;
  }

  .form-field textarea {
    min-height: 100px;
    resize: vertical;
  }

  .request-filters input:focus,
  .request-filters select:focus,
  .form-field input:focus,
  .form-field select:focus,
  .form-field textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .clear-filter-button {
    min-height: 40px;
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 7px;
    padding: 0 13px;
    cursor: pointer;
    font-weight: 600;
  }

  .request-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .request-summary > div {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    padding: 15px;
  }

  .request-summary strong {
    display: block;
    font-size: 22px;
    color: #111827;
  }

  .request-summary span {
    color: #64748b;
    font-size: 12px;
  }

  .request-table-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .requests-table {
    width: 100%;
    min-width: 1250px;
    border-collapse: collapse;
  }

  .requests-table th {
    text-align: left;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 13px 12px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .requests-table td {
    padding: 13px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
  }

  .requests-table tbody tr:hover {
    background: #f8fafc;
  }

  .request-id-button {
    border: 0;
    background: transparent;
    color: #2563eb;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .asset-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .asset-cell strong {
    color: #111827;
  }

  .asset-cell small {
    color: #94a3b8;
    font-size: 11px;
  }

  .request-priority,
  .request-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 25px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .request-priority-low {
    background: #f1f5f9;
    color: #475569;
  }

  .request-priority-medium {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .request-priority-high {
    background: #fff7ed;
    color: #c2410c;
  }

  .request-priority-critical {
    background: #fef2f2;
    color: #dc2626;
  }

  .request-status-submitted {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .request-status-scheduled {
    background: #f5f3ff;
    color: #6d28d9;
  }

  .request-status-in-progress {
    background: #fff7ed;
    color: #c2410c;
  }

  .request-status-completed {
    background: #ecfdf5;
    color: #047857;
  }

  .request-status-cancelled {
    background: #f1f5f9;
    color: #64748b;
  }

  .request-status-escalated {
    background: #fef2f2;
    color: #b91c1c;
  }

  .unassigned {
    color: #dc2626;
    font-weight: 600;
  }

  .row-actions {
    display: flex;
    gap: 5px;
  }

  .row-actions button {
    border: 1px solid #dbe3ea;
    background: white;
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }

  .row-actions button:hover {
    background: #eff6ff;
    border-color: #93c5fd;
  }

  .table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    color: #64748b;
    font-size: 12px;
    gap: 15px;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pagination button {
    border: 1px solid #dbe3ea;
    background: white;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .pagination button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .request-loading,
  .request-empty {
    min-height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 40px;
    text-align: center;
  }

  .request-loading p,
  .request-empty p {
    color: #64748b;
    margin-top: 10px;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid #dbeafe;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-icon {
    font-size: 40px;
  }

  .request-empty h3 {
    margin: 14px 0 0;
  }

  .request-empty p {
    max-width: 420px;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal {
    width: min(760px, 100%);
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 19px;
  }

  .modal-close {
    width: 34px;
    height: 34px;
    border: 0;
    background: #f1f5f9;
    border-radius: 7px;
    font-size: 22px;
    cursor: pointer;
  }

  .modal-body {
    padding: 20px;
  }

  .request-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .modal-error {
    margin-top: 15px;
    padding: 11px 13px;
    border-radius: 7px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
  }

  .request-details {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    background: #e2e8f0;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .detail-item {
    background: white;
    padding: 12px;
  }

  .detail-item span {
    display: block;
    color: #64748b;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .detail-item strong {
    color: #111827;
    font-size: 13px;
  }

  .details-description {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px;
  }

  .details-description h3 {
    margin: 0 0 8px;
    font-size: 13px;
  }

  .details-description p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    font-size: 13px;
    white-space: pre-wrap;
  }

  .photo-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .photo-list a {
    color: #2563eb;
    text-decoration: none;
    border: 1px solid #dbeafe;
    background: #eff6ff;
    border-radius: 6px;
    padding: 6px 9px;
    font-size: 12px;
  }

  @media (max-width: 1100px) {
    .request-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter-search {
      grid-column: 1 / -1;
    }

    .request-summary {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 700px) {
    .maintenance-requests-page {
      padding: 14px;
    }

    .requests-header {
      flex-direction: column;
    }

    .requests-header-actions {
      width: 100%;
    }

    .requests-header-actions button {
      flex: 1;
    }

    .request-filters {
      grid-template-columns: 1fr;
    }

    .filter-search {
      grid-column: auto;
    }

    .request-summary {
      grid-template-columns: 1fr 1fr;
    }

    .request-form-grid {
      grid-template-columns: 1fr;
    }

    .full-width {
      grid-column: auto;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }

    .table-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .request-error {
      flex-direction: column;
      align-items: flex-start;
    }

    .modal-backdrop {
      padding: 8px;
    }

    .modal {
      max-height: calc(100vh - 16px);
    }
  }
`;
