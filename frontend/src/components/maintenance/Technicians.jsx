/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EMPTY_FORM = {
  name: "",
  employeeId: "",
  email: "",
  phone: "",
  specialization: "",
  department: "",
  status: "active",
  availability: "available",
  experienceYears: "",
  skills: "",
  certification: "",
  notes: "",
};

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

const AVAILABILITY_LABELS = {
  available: "Available",
  busy: "Busy",
  unavailable: "Unavailable",
  leave: "On Leave",
};

const STATUS_CLASS = {
  active: "badge-green",
  inactive: "badge-gray",
  suspended: "badge-red",
  available: "badge-green",
  busy: "badge-orange",
  unavailable: "badge-red",
  leave: "badge-purple",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeTechnician(item) {
  return {
    id: item.id || item.technicianId || item.technician_id,

    name:
      item.name ||
      item.fullName ||
      item.full_name ||
      item.user?.name ||
      item.User?.name ||
      "",

    employeeId:
      item.employeeId ||
      item.employee_id ||
      item.staffId ||
      item.staff_id ||
      "",

    email:
      item.email ||
      item.user?.email ||
      item.User?.email ||
      "",

    phone:
      item.phone ||
      item.phoneNumber ||
      item.phone_number ||
      "",

    specialization:
      item.specialization ||
      item.specialty ||
      item.specialty_name ||
      "",

    department:
      item.department ||
      item.departmentName ||
      item.department_name ||
      "",

    status:
      String(item.status || "active")
        .toLowerCase()
        .replace(/\s+/g, "-"),

    availability:
      String(
        item.availability ||
          item.availabilityStatus ||
          item.availability_status ||
          "available"
      )
        .toLowerCase()
        .replace(/\s+/g, "-"),

    experienceYears:
      item.experienceYears ??
      item.experience_years ??
      "",

    skills:
      item.skills ||
      item.skillSet ||
      item.skill_set ||
      "",

    certification:
      item.certification ||
      item.certifications ||
      "",

    notes: item.notes || item.description || "",

    workOrdersCount:
      item.workOrdersCount ??
      item.work_orders_count ??
      item.workOrderCount ??
      item.work_order_count ??
      0,

    activeWorkOrders:
      item.activeWorkOrders ??
      item.active_work_orders ??
      0,

    completedWorkOrders:
      item.completedWorkOrders ??
      item.completed_work_orders ??
      0,

    requestsCount:
      item.requestsCount ??
      item.requests_count ??
      0,

    repairsCount:
      item.repairsCount ??
      item.repairs_count ??
      0,

    source: item,
  };
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] =
    useState("all");
  const [specializationFilter, setSpecializationFilter] =
    useState("all");

  const [selectedTechnician, setSelectedTechnician] =
    useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");

  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed: ${response.status}`
      );
    }

    return data;
  }

  async function loadTechnicians() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJson(
        `${API}/maintenance/technicians`
      );

      setTechnicians(
        safeArray(data).map(normalizeTechnician)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load technicians."
      );
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTechnicians();
  }, []);

  const specializations = useMemo(() => {
    return [
      ...new Set(
        technicians
          .map((technician) =>
            technician.specialization?.trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [technicians]);

  const filteredTechnicians = useMemo(() => {
    const query = normalizeText(search);

    return technicians.filter((technician) => {
      const searchable = [
        technician.name,
        technician.employeeId,
        technician.email,
        technician.phone,
        technician.specialization,
        technician.department,
        technician.skills,
        technician.certification,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(query);

      const statusMatch =
        statusFilter === "all" ||
        technician.status === statusFilter;

      const availabilityMatch =
        availabilityFilter === "all" ||
        technician.availability ===
          availabilityFilter;

      const specializationMatch =
        specializationFilter === "all" ||
        technician.specialization ===
          specializationFilter;

      return (
        searchMatch &&
        statusMatch &&
        availabilityMatch &&
        specializationMatch
      );
    });
  }, [
    technicians,
    search,
    statusFilter,
    availabilityFilter,
    specializationFilter,
  ]);

  const summary = useMemo(() => {
    const active = technicians.filter(
      (technician) =>
        technician.status === "active"
    ).length;

    const available = technicians.filter(
      (technician) =>
        technician.status === "active" &&
        technician.availability === "available"
    ).length;

    const busy = technicians.filter(
      (technician) =>
        technician.status === "active" &&
        technician.availability === "busy"
    ).length;

    const onLeave = technicians.filter(
      (technician) =>
        technician.availability === "leave"
    ).length;

    const totalWorkOrders = technicians.reduce(
      (sum, technician) =>
        sum +
        Number(technician.workOrdersCount || 0),
      0
    );

    return {
      total: technicians.length,
      active,
      available,
      busy,
      onLeave,
      totalWorkOrders,
    };
  }, [technicians]);

  function openCreateModal() {
    setModalMode("create");
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEditModal(technician) {
    setModalMode("edit");

    setForm({
      name: technician.name || "",
      employeeId: technician.employeeId || "",
      email: technician.email || "",
      phone: technician.phone || "",
      specialization:
        technician.specialization || "",
      department:
        technician.department || "",
      status: technician.status || "active",
      availability:
        technician.availability || "available",
      experienceYears:
        technician.experienceYears ?? "",
      skills: technician.skills || "",
      certification:
        technician.certification || "",
      notes: technician.notes || "",
    });

    setSelectedTechnician(technician);
    setError("");
    setShowModal(true);
  }

  function openViewModal(technician) {
    setSelectedTechnician(technician);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setSelectedTechnician(null);
  }

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Technician name is required.";
    }

    if (!form.employeeId.trim()) {
      return "Employee ID is required.";
    }

    if (!form.specialization.trim()) {
      return "Specialization is required.";
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Please enter a valid email address.";
    }

    if (
      form.experienceYears !== "" &&
      Number(form.experienceYears) < 0
    ) {
      return "Experience years cannot be negative.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      employeeId: form.employeeId.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      specialization:
        form.specialization.trim(),
      department: form.department.trim(),
      status: form.status,
      availability: form.availability,
      experienceYears:
        form.experienceYears === ""
          ? null
          : Number(form.experienceYears),
      skills: form.skills.trim(),
      certification:
        form.certification.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (modalMode === "create") {
        const data = await fetchJson(
          `${API}/maintenance/technicians`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          data?.data ||
          data?.technician ||
          data;

        if (created) {
          setTechnicians((prev) => [
            normalizeTechnician(created),
            ...prev,
          ]);
        } else {
          await loadTechnicians();
        }
      } else {
        const id = selectedTechnician?.id;

        if (!id) {
          throw new Error(
            "Technician ID is missing."
          );
        }

        const data = await fetchJson(
          `${API}/maintenance/technicians/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          data?.data ||
          data?.technician ||
          data;

        if (updated) {
          const normalized =
            normalizeTechnician(updated);

          setTechnicians((prev) =>
            prev.map((item) =>
              String(item.id) === String(id)
                ? normalized
                : item
            )
          );
        } else {
          await loadTechnicians();
        }
      }

      setShowModal(false);
      setSelectedTechnician(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save technician."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;

    setSaving(true);
    setError("");

    try {
      await fetchJson(
        `${API}/maintenance/technicians/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      setTechnicians((prev) =>
        prev.filter(
          (item) =>
            String(item.id) !==
            String(deleteTarget.id)
        )
      );

      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete technician."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAvailability(
    technician,
    availability
  ) {
    if (!technician?.id) return;

    try {
      await fetchJson(
        `${API}/maintenance/technicians/${technician.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            availability,
          }),
        }
      );

      setTechnicians((prev) =>
        prev.map((item) =>
          String(item.id) ===
          String(technician.id)
            ? {
                ...item,
                availability,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to update availability."
      );
    }
  }

  async function updateStatus(
    technician,
    status
  ) {
    if (!technician?.id) return;

    try {
      await fetchJson(
        `${API}/maintenance/technicians/${technician.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      setTechnicians((prev) =>
        prev.map((item) =>
          String(item.id) ===
          String(technician.id)
            ? {
                ...item,
                status,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to update technician status."
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAvailabilityFilter("all");
    setSpecializationFilter("all");
  }

  return (
    <div className="technicians-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .technicians-page {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
          padding: 24px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .technicians-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 760;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #263248;
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .btn:hover {
          background: #f2f4f7;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3074B3;
          border-color: #3074B3;
          color: white;
        }

        .btn-primary:hover {
          background: #245783;
        }

        .btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 17px;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .summary-label {
          color: #667085;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.45px;
        }

        .summary-value {
          margin-top: 7px;
          font-size: 26px;
          font-weight: 760;
        }

        .summary-note {
          margin-top: 4px;
          color: #98a2b3;
          font-size: 11px;
        }

        .alert {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 12px;
          margin-bottom: 15px;
        }

        .filters-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search {
          flex: 1 1 250px;
          min-width: 220px;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #d7dce5;
          background: white;
          color: #344054;
          border-radius: 8px;
          padding: 10px 11px;
          font-size: 13px;
          outline: none;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #3074B3;
          box-shadow:
            0 0 0 3px
            rgba(48, 116, 179, 0.1);
        }

        .filter-select {
          min-width: 150px;
        }

        .table-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .table-header {
          padding: 15px 17px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .table-title {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
        }

        .result-count {
          color: #667085;
          font-size: 12px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          text-align: left;
          padding: 11px 14px;
          background: #fafbfc;
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid #e8ebf0;
          white-space: nowrap;
        }

        td {
          padding: 12px 14px;
          border-bottom: 1px solid #edf0f4;
          vertical-align: middle;
          font-size: 12px;
          color: #475467;
        }

        tbody tr:hover {
          background: #fafcff;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .technician-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #EAF2FA;
          color: #245783;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .technician-name {
          font-weight: 750;
          color: #1d2939;
          font-size: 12px;
        }

        .technician-id {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 750;
          white-space: nowrap;
        }

        .badge-green {
          background: #dcfce7;
          color: #166534;
        }

        .badge-gray {
          background: #f2f4f7;
          color: #475467;
        }

        .badge-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge-orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .badge-purple {
          background: #ede9fe;
          color: #6d28d9;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .action-btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #475467;
          border-radius: 7px;
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 650;
          cursor: pointer;
        }

        .action-btn:hover {
          background: #f2f4f7;
        }

        .action-btn.danger:hover {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 13px;
        }

        .loading {
          padding: 50px;
          text-align: center;
          color: #667085;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(700px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow:
            0 20px 60px
            rgba(15, 23, 42, 0.25);
        }

        .modal-small {
          width: min(430px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 760;
        }

        .modal-subtitle {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: #f2f4f7;
          color: #475467;
          font-size: 18px;
          cursor: pointer;
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

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .label {
          color: #344054;
          font-size: 11px;
          font-weight: 700;
        }

        .required {
          color: #dc2626;
        }

        .textarea {
          resize: vertical;
          min-height: 90px;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .profile-avatar {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #EAF2FA;
          color: #245783;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
        }

        .profile-name {
          margin: 0;
          font-size: 19px;
          font-weight: 760;
        }

        .profile-meta {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-item {
          padding: 12px;
          background: #fafbfc;
          border: 1px solid #edf0f4;
          border-radius: 9px;
        }

        .detail-label {
          color: #98a2b3;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        .detail-value {
          margin-top: 5px;
          color: #344054;
          font-size: 12px;
          font-weight: 650;
          word-break: break-word;
        }

        .section-title {
          margin: 20px 0 10px;
          font-size: 12px;
          font-weight: 750;
          color: #344054;
        }

        .stats-row {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .mini-stat {
          background: #F5F7FA;
          border: 1px solid #edf0f4;
          border-radius: 9px;
          padding: 11px;
          text-align: center;
        }

        .mini-stat-value {
          font-size: 19px;
          font-weight: 760;
          color: #1d2939;
        }

        .mini-stat-label {
          margin-top: 3px;
          font-size: 9px;
          color: #98a2b3;
        }

        .skills-box {
          border: 1px solid #edf0f4;
          border-radius: 9px;
          padding: 12px;
          background: #fafbfc;
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .technicians-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .form-grid,
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .filters-card {
            align-items: stretch;
          }

          .search,
          .filter-select {
            width: 100%;
            min-width: 100%;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .stats-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="technicians-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Maintenance Technicians
            </h1>

            <p className="page-subtitle">
              Manage technician profiles, skills,
              availability, and maintenance workload.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadTechnicians}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              + Add Technician
            </button>
          </div>
        </div>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Total Technicians
            </div>

            <div className="summary-value">
              {summary.total}
            </div>

            <div className="summary-note">
              Registered maintenance technicians
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Active
            </div>

            <div className="summary-value">
              {summary.active}
            </div>

            <div className="summary-note">
              Active technician accounts
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Available
            </div>

            <div className="summary-value">
              {summary.available}
            </div>

            <div className="summary-note">
              Ready for assignment
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Busy
            </div>

            <div className="summary-value">
              {summary.busy}
            </div>

            <div className="summary-note">
              Currently assigned workload
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Work Orders
            </div>

            <div className="summary-value">
              {summary.totalWorkOrders}
            </div>

            <div className="summary-note">
              Total technician work orders
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search">
            <input
              className="input"
              type="text"
              placeholder="Search name, employee ID, skill, department..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="select filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>

            <option value="suspended">
              Suspended
            </option>
          </select>

          <select
            className="select filter-select"
            value={availabilityFilter}
            onChange={(event) =>
              setAvailabilityFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Availability
            </option>

            <option value="available">
              Available
            </option>

            <option value="busy">
              Busy
            </option>

            <option value="unavailable">
              Unavailable
            </option>

            <option value="leave">
              On Leave
            </option>
          </select>

          <select
            className="select filter-select"
            value={specializationFilter}
            onChange={(event) =>
              setSpecializationFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Specializations
            </option>

            {specializations.map(
              (specialization) => (
                <option
                  key={specialization}
                  value={specialization}
                >
                  {specialization}
                </option>
              )
            )}
          </select>

          <button
            className="btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h2 className="table-title">
              Technician Directory
            </h2>

            <div className="result-count">
              Showing{" "}
              {filteredTechnicians.length} of{" "}
              {technicians.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading technicians...
            </div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="empty-state">
              No technicians found matching the
              current filters.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Specialization</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Availability</th>
                    <th>Work Orders</th>
                    <th>Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTechnicians.map(
                    (technician) => {
                      const initials =
                        technician.name
                          ? technician.name
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) =>
                                part.charAt(0)
                              )
                              .join("")
                              .toUpperCase()
                          : "T";

                      return (
                        <tr
                          key={technician.id}
                        >
                          <td>
                            <div className="technician-cell">
                              <div className="avatar">
                                {initials}
                              </div>

                              <div>
                                <div className="technician-name">
                                  {technician.name ||
                                    "Unnamed Technician"}
                                </div>

                                <div className="technician-id">
                                  ID:{" "}
                                  {technician.employeeId ||
                                    technician.id ||
                                    "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {technician.specialization ||
                              "—"}
                          </td>

                          <td>
                            {technician.department ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`badge ${
                                STATUS_CLASS[
                                  technician.status
                                ] ||
                                "badge-gray"
                              }`}
                            >
                              {STATUS_LABELS[
                                technician.status
                              ] ||
                                technician.status}
                            </span>
                          </td>

                          <td>
                            <select
                              className="select"
                              style={{
                                width: "125px",
                                padding:
                                  "6px 8px",
                                fontSize: "10px",
                              }}
                              value={
                                technician.availability ||
                                "available"
                              }
                              onChange={(event) =>
                                updateAvailability(
                                  technician,
                                  event.target.value
                                )
                              }
                            >
                              <option value="available">
                                Available
                              </option>

                              <option value="busy">
                                Busy
                              </option>

                              <option value="unavailable">
                                Unavailable
                              </option>

                              <option value="leave">
                                On Leave
                              </option>
                            </select>
                          </td>

                          <td>
                            <strong>
                              {technician.workOrdersCount ||
                                0}
                            </strong>
                          </td>

                          <td>
                            <div>
                              {technician.email ||
                                "—"}
                            </div>

                            <div
                              style={{
                                marginTop: "3px",
                                color: "#98a2b3",
                                fontSize: "10px",
                              }}
                            >
                              {technician.phone ||
                                ""}
                            </div>
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                className="action-btn"
                                onClick={() =>
                                  openViewModal(
                                    technician
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                className="action-btn"
                                onClick={() =>
                                  openEditModal(
                                    technician
                                  )
                                }
                              >
                                Edit
                              </button>

                              {technician.status ===
                              "active" ? (
                                <button
                                  className="action-btn"
                                  onClick={() =>
                                    updateStatus(
                                      technician,
                                      "inactive"
                                    )
                                  }
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="action-btn"
                                  onClick={() =>
                                    updateStatus(
                                      technician,
                                      "active"
                                    )
                                  }
                                >
                                  Activate
                                </button>
                              )}

                              <button
                                className="action-btn danger"
                                onClick={() =>
                                  setDeleteTarget(
                                    technician
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {modalMode === "create"
                    ? "Add Technician"
                    : "Edit Technician"}
                </h2>

                <div className="modal-subtitle">
                  {modalMode === "create"
                    ? "Register a new maintenance technician."
                    : "Update technician information."}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">
                      Full Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Employee ID{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.employeeId}
                      onChange={(event) =>
                        updateField(
                          "employeeId",
                          event.target.value
                        )
                      }
                      placeholder="e.g. EMP-001"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Email
                    </label>

                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      placeholder="technician@university.edu"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Phone
                    </label>

                    <input
                      className="input"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value
                        )
                      }
                      placeholder="+251..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Specialization{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.specialization}
                      onChange={(event) =>
                        updateField(
                          "specialization",
                          event.target.value
                        )
                      }
                      placeholder="Electrical, Mechanical..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Department
                    </label>

                    <input
                      className="input"
                      value={form.department}
                      onChange={(event) =>
                        updateField(
                          "department",
                          event.target.value
                        )
                      }
                      placeholder="Maintenance Department"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Status
                    </label>

                    <select
                      className="select"
                      value={form.status}
                      onChange={(event) =>
                        updateField(
                          "status",
                          event.target.value
                        )
                      }
                    >
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>

                      <option value="suspended">
                        Suspended
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Availability
                    </label>

                    <select
                      className="select"
                      value={form.availability}
                      onChange={(event) =>
                        updateField(
                          "availability",
                          event.target.value
                        )
                      }
                    >
                      <option value="available">
                        Available
                      </option>

                      <option value="busy">
                        Busy
                      </option>

                      <option value="unavailable">
                        Unavailable
                      </option>

                      <option value="leave">
                        On Leave
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Experience (Years)
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.experienceYears
                      }
                      onChange={(event) =>
                        updateField(
                          "experienceYears",
                          event.target.value
                        )
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Certification
                    </label>

                    <input
                      className="input"
                      value={form.certification}
                      onChange={(event) =>
                        updateField(
                          "certification",
                          event.target.value
                        )
                      }
                      placeholder="Certification / License"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Skills
                    </label>

                    <textarea
                      className="textarea"
                      value={form.skills}
                      onChange={(event) =>
                        updateField(
                          "skills",
                          event.target.value
                        )
                      }
                      placeholder="List technician skills..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(event) =>
                        updateField(
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Additional information..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Technician"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTechnician && !showModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedTechnician(null)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Technician Details
                </h2>

                <div className="modal-subtitle">
                  Complete technician profile
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setSelectedTechnician(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedTechnician.name
                    ? selectedTechnician.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) =>
                          part.charAt(0)
                        )
                        .join("")
                        .toUpperCase()
                    : "T"}
                </div>

                <div>
                  <h2 className="profile-name">
                    {selectedTechnician.name ||
                      "Unnamed Technician"}
                  </h2>

                  <div className="profile-meta">
                    Employee ID:{" "}
                    {selectedTechnician.employeeId ||
                      selectedTechnician.id ||
                      "—"}
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${
                        STATUS_CLASS[
                          selectedTechnician.status
                        ] || "badge-gray"
                      }`}
                    >
                      {STATUS_LABELS[
                        selectedTechnician.status
                      ] ||
                        selectedTechnician.status}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Availability
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${
                        STATUS_CLASS[
                          selectedTechnician
                            .availability
                        ] || "badge-gray"
                      }`}
                    >
                      {AVAILABILITY_LABELS[
                        selectedTechnician
                          .availability
                      ] ||
                        selectedTechnician
                          .availability}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Specialization
                  </div>

                  <div className="detail-value">
                    {selectedTechnician.specialization ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Department
                  </div>

                  <div className="detail-value">
                    {selectedTechnician.department ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Email
                  </div>

                  <div className="detail-value">
                    {selectedTechnician.email ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Phone
                  </div>

                  <div className="detail-value">
                    {selectedTechnician.phone ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Experience
                  </div>

                  <div className="detail-value">
                    {selectedTechnician
                      .experienceYears !==
                    ""
                      ? `${selectedTechnician.experienceYears} years`
                      : "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Certification
                  </div>

                  <div className="detail-value">
                    {selectedTechnician.certification ||
                      "—"}
                  </div>
                </div>
              </div>

              <div className="section-title">
                Workload Summary
              </div>

              <div className="stats-row">
                <div className="mini-stat">
                  <div className="mini-stat-value">
                    {
                      selectedTechnician.workOrdersCount
                    }
                  </div>

                  <div className="mini-stat-label">
                    Work Orders
                  </div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-value">
                    {
                      selectedTechnician
                        .activeWorkOrders
                    }
                  </div>

                  <div className="mini-stat-label">
                    Active
                  </div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-value">
                    {
                      selectedTechnician
                        .completedWorkOrders
                    }
                  </div>

                  <div className="mini-stat-label">
                    Completed
                  </div>
                </div>
              </div>

              {selectedTechnician.skills && (
                <>
                  <div className="section-title">
                    Skills
                  </div>

                  <div className="skills-box">
                    {selectedTechnician.skills}
                  </div>
                </>
              )}

              {selectedTechnician.notes && (
                <>
                  <div className="section-title">
                    Notes
                  </div>

                  <div className="skills-box">
                    {selectedTechnician.notes}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setSelectedTechnician(null)
                }
              >
                Close
              </button>

              <button
                className="btn btn-primary"
                onClick={() =>
                  openEditModal(
                    selectedTechnician
                  )
                }
              >
                Edit Technician
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving && setDeleteTarget(null)
          }
        >
          <div
            className="modal modal-small"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Delete Technician
                </h2>

                <div className="modal-subtitle">
                  This action cannot be undone.
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  !saving &&
                  setDeleteTarget(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p
                style={{
                  margin: 0,
                  color: "#475467",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Are you sure you want to delete{" "}
                <strong>
                  {deleteTarget.name ||
                    "this technician"}
                </strong>
                ?
              </p>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  fontSize: "11px",
                }}
              >
                If this technician has existing
                maintenance history or assignments,
                the backend should enforce the
                appropriate data-retention rule.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving
                  ? "Deleting..."
                  : "Delete Technician"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
