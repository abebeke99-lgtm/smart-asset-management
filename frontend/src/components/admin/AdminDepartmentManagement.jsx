import React, { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../utils/api";

const API_URL = `${apiBase()}/api/departments`;
const COLLEGES_API_URL = `${apiBase()}/api/colleges`;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getHeaders = (includeJson = false) => {
  const token = getToken();

  const headers = {
    Accept: "application/json",
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const normalizeDepartments = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.departments)) {
    return data.departments;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.data?.departments)) {
    return data.data.departments;
  }

  return [];
};

const getDepartmentId = (department) =>
  department?.departmentId ??
  department?.department_id ??
  department?.id;

const getCollegeName = (department) =>
  department?.collegeName ||
  department?.college?.name ||
  department?.college?.collegeName ||
  "—";

const getStatus = (department) => {
  if (
    department?.status === false ||
    department?.isActive === false ||
    department?.active === false
  ) {
    return "Inactive";
  }

  return "Active";
};

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [colleges, setColleges] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingDepartment, setEditingDepartment] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const emptyForm = {
    name: "",
    code: "",
    description: "",
    collegeId: "",
    location: "",
    headName: "",
    email: "",
    phone: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load departments (${response.status})`
        );
      }

      const data = await response.json();
      setDepartments(normalizeDepartments(data));
    } catch (err) {
      console.error("Departments load error:", err);
      setError(err.message || "Unable to load departments.");
    } finally {
      setLoading(false);
    }
  };

  const loadColleges = async () => {
    try {
      const response = await fetch(COLLEGES_API_URL, {
        method: "GET",
        credentials: "include",
        headers: getHeaders(),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setColleges(data);
      } else if (Array.isArray(data?.colleges)) {
        setColleges(data.colleges);
      } else if (Array.isArray(data?.data)) {
        setColleges(data.data);
      } else if (Array.isArray(data?.data?.colleges)) {
        setColleges(data.data.colleges);
      }
    } catch (err) {
      console.warn("College list could not be loaded:", err);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadColleges();
  }, []);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return departments.filter((department) => {
      const matchesSearch =
        !query ||
        String(department?.name || "")
          .toLowerCase()
          .includes(query) ||
        String(department?.departmentName || "")
          .toLowerCase()
          .includes(query) ||
        String(department?.code || "")
          .toLowerCase()
          .includes(query) ||
        String(department?.departmentCode || "")
          .toLowerCase()
          .includes(query) ||
        getCollegeName(department)
          .toLowerCase()
          .includes(query);

      const status = getStatus(department);

      const matchesStatus =
        statusFilter === "All" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [departments, search, statusFilter]);

  const stats = useMemo(() => {
    const total = departments.length;

    const active = departments.filter(
      (department) => getStatus(department) === "Active"
    ).length;

    const inactive = departments.filter(
      (department) => getStatus(department) === "Inactive"
    ).length;

    const collegesCount = new Set(
      departments
        .map((department) => department?.collegeId || department?.college_id)
        .filter(Boolean)
    ).size;

    return {
      total,
      active,
      inactive,
      collegesCount,
    };
  }, [departments]);

  const openCreateModal = () => {
    setEditingDepartment(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (department) => {
    setEditingDepartment(department);

    setForm({
      name:
        department?.name ||
        department?.departmentName ||
        "",
      code:
        department?.code ||
        department?.departmentCode ||
        "",
      description: department?.description || "",
      collegeId:
        department?.collegeId ||
        department?.college_id ||
        department?.college?.id ||
        "",
      location: department?.location || "",
      headName:
        department?.headName ||
        department?.head_name ||
        department?.head?.name ||
        "",
      email: department?.email || "",
      phone: department?.phone || "",
      status: getStatus(department),
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openDetailsModal = (department) => {
    setSelectedDepartment(department);
    setShowDetails(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingDepartment(null);
    setForm(emptyForm);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const isEditing = Boolean(editingDepartment);
      const departmentId = getDepartmentId(editingDepartment);

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        collegeId: form.collegeId || null,
        location: form.location.trim(),
        headName: form.headName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        status: form.status,
      };

      const url = isEditing
        ? `${API_URL}/${departmentId}`
        : API_URL;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      let responseData = null;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        throw new Error(
          responseData?.message ||
            responseData?.error ||
            responseText ||
            `Request failed (${response.status})`
        );
      }

      setSuccess(
        isEditing
          ? "Department updated successfully."
          : "Department created successfully."
      );

      setShowModal(false);
      setEditingDepartment(null);
      setForm(emptyForm);

      await loadDepartments();
    } catch (err) {
      console.error("Department save error:", err);
      setError(err.message || "Unable to save department.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (department) => {
    const departmentId = getDepartmentId(department);

    if (!departmentId) {
      setError("Department ID is missing.");
      return;
    }

    const currentStatus = getStatus(department);
    const newStatus =
      currentStatus === "Active" ? "Inactive" : "Active";

    const confirmed = window.confirm(
      `${newStatus === "Active" ? "Activate" : "Deactivate"} "${
        department?.name || department?.departmentName
      }"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/${departmentId}`, {
        method: "PUT",
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify({
          ...department,
          status: newStatus,
          isActive: newStatus === "Active",
        }),
      });

      const responseText = await response.text();

      let responseData = null;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        throw new Error(
          responseData?.message ||
            responseData?.error ||
            responseText ||
            `Unable to update status (${response.status})`
        );
      }

      setSuccess(
        `Department ${
          newStatus === "Active" ? "activated" : "deactivated"
        } successfully.`
      );

      await loadDepartments();
    } catch (err) {
      console.error("Department status error:", err);
      setError(err.message || "Unable to update department status.");
    }
  };

  const deleteDepartment = async (department) => {
    const departmentId = getDepartmentId(department);

    if (!departmentId) {
      setError("Department ID is missing.");
      return;
    }

    const departmentName =
      department?.name ||
      department?.departmentName ||
      "this department";

    const confirmed = window.confirm(
      `Delete "${departmentName}"?\n\nThis action may fail if assets, users, or other records are still associated with the department.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/${departmentId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      const responseText = await response.text();

      let responseData = null;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        throw new Error(
          responseData?.message ||
            responseData?.error ||
            responseText ||
            `Unable to delete department (${response.status})`
        );
      }

      setSuccess("Department deleted successfully.");

      await loadDepartments();
    } catch (err) {
      console.error("Department delete error:", err);
      setError(err.message || "Unable to delete department.");
    }
  };

  const getCollegeOptionValue = (college) =>
    college?.collegeId ??
    college?.college_id ??
    college?.id;

  const getCollegeOptionName = (college) =>
    college?.name ||
    college?.collegeName ||
    college?.title ||
    "Unnamed College";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / Organization / Departments
          </div>

          <h1 style={styles.title}>Departments</h1>

          <p style={styles.subtitle}>
            Manage university departments, their college relationships,
            responsible heads, and operational status.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          style={styles.primaryButton}
        >
          <span style={styles.buttonIcon}>＋</span>
          Add Department
        </button>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <span>⚠</span>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={styles.alertClose}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div style={styles.successAlert}>
          <span>✓</span>
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            style={styles.alertClose}
          >
            ×
          </button>
        </div>
      )}

      <div style={styles.statsGrid}>
        <StatCard
          label="Total Departments"
          value={stats.total}
          icon="▦"
          accent="#2563EB"
        />

        <StatCard
          label="Active"
          value={stats.active}
          icon="✓"
          accent="#16A34A"
        />

        <StatCard
          label="Inactive"
          value={stats.inactive}
          icon="◷"
          accent="#DC2626"
        />

        <StatCard
          label="Colleges Represented"
          value={stats.collegesCount}
          icon="⌂"
          accent="#F4C542"
        />
      </div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department, code, or college..."
              style={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={styles.select}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={loadDepartments}
            style={styles.refreshButton}
            title="Refresh"
          >
            ↻ Refresh
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>College</th>
                <th style={styles.th}>Head</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={styles.emptyCell}>
                    <div style={styles.loading}>
                      <div style={styles.spinner} />
                      Loading departments...
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan="7" style={styles.emptyCell}>
                    <div style={styles.emptyState}>
                      <div style={styles.emptyIcon}>▦</div>
                      <strong>No departments found</strong>
                      <span>
                        Try changing your search or status filter.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((department, index) => {
                  const id = getDepartmentId(department) ?? index;

                  const name =
                    department?.name ||
                    department?.departmentName ||
                    "Unnamed Department";

                  const code =
                    department?.code ||
                    department?.departmentCode ||
                    "—";

                  const head =
                    department?.headName ||
                    department?.head_name ||
                    department?.head?.name ||
                    "—";

                  const email = department?.email || "";

                  const phone = department?.phone || "";

                  const status = getStatus(department);

                  return (
                    <tr key={String(id)} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.departmentCell}>
                          <div style={styles.departmentIcon}>
                            {name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div style={styles.departmentName}>
                              {name}
                            </div>

                            {department?.description && (
                              <div style={styles.departmentDescription}>
                                {department.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.codeBadge}>{code}</span>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.secondaryText}>
                          {getCollegeName(department)}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.secondaryText}>
                          {head}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.contactCell}>
                          {email && <span>{email}</span>}
                          {phone && <span>{phone}</span>}
                          {!email && !phone && <span>—</span>}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <StatusBadge status={status} />
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            type="button"
                            onClick={() =>
                              openDetailsModal(department)
                            }
                            style={styles.actionButton}
                            title="View"
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(department)
                            }
                            style={styles.actionButton}
                            title="Edit"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleStatus(department)
                            }
                            style={{
                              ...styles.actionButton,
                              color:
                                status === "Active"
                                  ? "#B91C1C"
                                  : "#15803D",
                            }}
                            title={
                              status === "Active"
                                ? "Deactivate"
                                : "Activate"
                            }
                          >
                            {status === "Active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteDepartment(department)
                            }
                            style={{
                              ...styles.actionButton,
                              color: "#DC2626",
                            }}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.tableFooter}>
          <span>
            Showing{" "}
            <strong>{filteredDepartments.length}</strong>{" "}
            of <strong>{departments.length}</strong> departments
          </span>
        </div>
      </div>

      {showModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingDepartment
                    ? "Edit Department"
                    : "Add Department"}
                </h2>

                <p style={styles.modalSubtitle}>
                  {editingDepartment
                    ? "Update department information."
                    : "Register a new university department."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={styles.formBody}>
                <div style={styles.formGrid}>
                  <FormField label="Department Name" required>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Computer Science"
                      style={styles.input}
                      required
                    />
                  </FormField>

                  <FormField label="Department Code">
                    <input
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. CS"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="College">
                    <select
                      name="collegeId"
                      value={form.collegeId}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="">Select college</option>

                      {colleges.map((college, index) => {
                        const value = getCollegeOptionValue(college);

                        return (
                          <option
                            key={String(value ?? index)}
                            value={value ?? ""}
                          >
                            {getCollegeOptionName(college)}
                          </option>
                        );
                      })}
                    </select>
                  </FormField>

                  <FormField label="Location">
                    <input
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Department location"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Department Head">
                    <input
                      name="headName"
                      value={form.headName}
                      onChange={handleChange}
                      placeholder="Full name"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Email">
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="department@university.edu"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Phone">
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+251 ..."
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Status">
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </FormField>

                  <div style={styles.fullWidth}>
                    <FormField label="Description">
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Brief description of the department..."
                        rows="4"
                        style={{
                          ...styles.input,
                          resize: "vertical",
                        }}
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingDepartment
                    ? "Update Department"
                    : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedDepartment && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDetails(false);
            }
          }}
        >
          <div style={styles.detailsModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Department Details
                </h2>

                <p style={styles.modalSubtitle}>
                  Complete department information
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.detailsBody}>
              <div style={styles.detailsHero}>
                <div style={styles.largeDepartmentIcon}>
                  {(
                    selectedDepartment?.name ||
                    selectedDepartment?.departmentName ||
                    "D"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h3 style={styles.detailsName}>
                    {selectedDepartment?.name ||
                      selectedDepartment?.departmentName ||
                      "Unnamed Department"}
                  </h3>

                  <div style={styles.detailsCode}>
                    {selectedDepartment?.code ||
                      selectedDepartment?.departmentCode ||
                      "No code"}
                  </div>
                </div>

                <StatusBadge status={getStatus(selectedDepartment)} />
              </div>

              <div style={styles.detailsGrid}>
                <DetailItem
                  label="College"
                  value={getCollegeName(selectedDepartment)}
                />

                <DetailItem
                  label="Location"
                  value={
                    selectedDepartment?.location || "—"
                  }
                />

                <DetailItem
                  label="Department Head"
                  value={
                    selectedDepartment?.headName ||
                    selectedDepartment?.head_name ||
                    selectedDepartment?.head?.name ||
                    "—"
                  }
                />

                <DetailItem
                  label="Email"
                  value={selectedDepartment?.email || "—"}
                />

                <DetailItem
                  label="Phone"
                  value={selectedDepartment?.phone || "—"}
                />

                <DetailItem
                  label="Department ID"
                  value={String(
                    getDepartmentId(selectedDepartment) || "—"
                  )}
                />
              </div>

              <div style={styles.descriptionBox}>
                <div style={styles.detailLabel}>Description</div>

                <div style={styles.descriptionText}>
                  {selectedDepartment?.description ||
                    "No description provided."}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={styles.cancelButton}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEditModal(selectedDepartment);
                }}
                style={styles.primaryButton}
              >
                Edit Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={styles.statCard}>
      <div
        style={{
          ...styles.statIcon,
          background: `${accent}18`,
          color: accent,
        }}
      >
        {icon}
      </div>

      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const active = status === "Active";

  return (
    <span
      style={{
        ...styles.statusBadge,
        background: active ? "#DCFCE7" : "#FEE2E2",
        color: active ? "#15803D" : "#B91C1C",
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: active ? "#16A34A" : "#DC2626",
        }}
      />
      {status}
    </span>
  );
}

function FormField({ label, required, children }) {
  return (
    <label style={styles.formField}>
      <span style={styles.formLabel}>
        {label}
        {required && <span style={styles.required}> *</span>}
      </span>

      {children}
    </label>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "28px",
    background: "#F3F6F9",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "24px",
  },

  breadcrumb: {
    color: "#64748B",
    fontSize: "13px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.2,
    fontWeight: 750,
    color: "#111827",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "14px",
    maxWidth: "720px",
    lineHeight: 1.6,
  },

  primaryButton: {
    border: "none",
    borderRadius: "9px",
    background: "#2563EB",
    color: "#FFFFFF",
    padding: "11px 16px",
    minHeight: "42px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 5px rgba(37, 99, 235, 0.18)",
  },

  buttonIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },

  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    background: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: "9px",
    fontSize: "14px",
  },

  successAlert: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    background: "#F0FDF4",
    color: "#166534",
    border: "1px solid #BBF7D0",
    borderRadius: "9px",
    fontSize: "14px",
  },

  alertClose: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  statCard: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
    fontWeight: 700,
    flexShrink: 0,
  },

  statLabel: {
    color: "#64748B",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "4px",
  },

  statValue: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: 750,
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  toolbar: {
    padding: "16px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  searchWrapper: {
    position: "relative",
    flex: "1 1 320px",
    minWidth: "240px",
  },

  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94A3B8",
    fontSize: "21px",
    pointerEvents: "none",
  },

  searchInput: {
    width: "100%",
    height: "40px",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "0 12px 0 38px",
    outline: "none",
    fontSize: "14px",
    color: "#111827",
    background: "#FFFFFF",
  },

  select: {
    height: "40px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "0 34px 0 11px",
    background: "#FFFFFF",
    color: "#334155",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
  },

  refreshButton: {
    height: "40px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "0 13px",
    background: "#FFFFFF",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1050px",
  },

  th: {
    padding: "13px 16px",
    textAlign: "left",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 750,
    color: "#64748B",
    background: "#F8FAFC",
    borderBottom: "1px solid #E5E7EB",
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #F1F5F9",
  },

  td: {
    padding: "14px 16px",
    verticalAlign: "middle",
    fontSize: "13px",
    color: "#334155",
  },

  departmentCell: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: "220px",
  },

  departmentIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#E0F2FE",
    color: "#0369A1",
    fontSize: "15px",
    fontWeight: 800,
    flexShrink: 0,
  },

  departmentName: {
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: "3px",
  },

  departmentDescription: {
    maxWidth: "230px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#94A3B8",
    fontSize: "12px",
  },

  codeBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "6px",
    padding: "5px 8px",
    background: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: "12px",
    fontWeight: 750,
  },

  secondaryText: {
    color: "#475569",
    fontSize: "13px",
  },

  contactCell: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    color: "#64748B",
    fontSize: "12px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },

  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },

  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
    flexWrap: "wrap",
  },

  actionButton: {
    border: "none",
    background: "transparent",
    color: "#2563EB",
    padding: "5px 6px",
    borderRadius: "5px",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
  },

  tableFooter: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "13px 16px",
    borderTop: "1px solid #E5E7EB",
    color: "#64748B",
    fontSize: "12px",
  },

  emptyCell: {
    height: "280px",
    textAlign: "center",
  },

  loading: {
    height: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    color: "#64748B",
    fontSize: "14px",
  },

  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #DBEAFE",
    borderTopColor: "#2563EB",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  emptyState: {
    height: "280px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    color: "#64748B",
    fontSize: "13px",
  },

  emptyIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#F1F5F9",
    color: "#94A3B8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    marginBottom: "4px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
    overflowY: "auto",
  },

  modal: {
    width: "min(780px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  detailsModal: {
    width: "min(700px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    padding: "20px 22px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 750,
    color: "#111827",
  },

  modalSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "13px",
  },

  modalClose: {
    border: "none",
    background: "#F1F5F9",
    color: "#475569",
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "21px",
    lineHeight: 1,
  },

  formBody: {
    padding: "22px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "17px",
  },

  fullWidth: {
    gridColumn: "1 / -1",
  },

  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  formLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155",
  },

  required: {
    color: "#DC2626",
  },

  input: {
    width: "100%",
    minHeight: "41px",
    boxSizing: "border-box",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "9px 11px",
    outline: "none",
    fontSize: "13px",
    color: "#111827",
    background: "#FFFFFF",
  },

  modalFooter: {
    padding: "15px 22px",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
  },

  cancelButton: {
    minHeight: "42px",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    color: "#475569",
    borderRadius: "8px",
    padding: "0 15px",
    fontSize: "14px",
    fontWeight: 650,
    cursor: "pointer",
  },

  detailsBody: {
    padding: "22px",
  },

  detailsHero: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    marginBottom: "18px",
  },

  largeDepartmentIcon: {
    width: "54px",
    height: "54px",
    borderRadius: "12px",
    background: "#E0F2FE",
    color: "#0369A1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
    fontWeight: 800,
    flexShrink: 0,
  },

  detailsName: {
    margin: 0,
    color: "#111827",
    fontSize: "18px",
    fontWeight: 750,
  },

  detailsCode: {
    marginTop: "4px",
    color: "#64748B",
    fontSize: "12px",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  detailItem: {
    padding: "13px",
    border: "1px solid #E5E7EB",
    borderRadius: "9px",
    background: "#FFFFFF",
  },

  detailLabel: {
    color: "#64748B",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "5px",
  },

  detailValue: {
    color: "#1E293B",
    fontSize: "13px",
    fontWeight: 600,
    wordBreak: "break-word",
  },

  descriptionBox: {
    marginTop: "14px",
    padding: "14px",
    border: "1px solid #E5E7EB",
    borderRadius: "9px",
  },

  descriptionText: {
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};