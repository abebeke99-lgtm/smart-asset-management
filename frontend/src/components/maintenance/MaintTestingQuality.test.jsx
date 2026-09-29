import React, { useEffect, useMemo, useState } from "react";

const API = "/api";

const EMPTY_FORM = {
  workOrderId: "",
  repairId: "",
  assetId: "",
  technicianId: "",
  testType: "Functional Test",
  testDate: "",
  status: "pending",
  result: "",
  measurements: "",
  testProcedure: "",
  findings: "",
  defectsFound: "",
  correctiveAction: "",
  technicianNotes: "",
  testedBy: "",
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  passed: "Passed",
  failed: "Failed",
  retest_required: "Retest Required",
};

const STATUS_CLASS = {
  pending: "badge-gray",
  in_progress: "badge-blue",
  passed: "badge-green",
  failed: "badge-red",
  retest_required: "badge-orange",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.tests)) return data.tests;
  if (Array.isArray(data?.testing)) return data.testing;
  return [];
}

function normalizeTest(item) {
  return {
    id:
      item.id ??
      item.testId ??
      item.test_id,

    workOrderId:
      item.workOrderId ??
      item.work_order_id ??
      item.workOrder?.id ??
      "",

    workOrderNumber:
      item.workOrderNumber ??
      item.work_order_number ??
      item.workOrder?.workOrderNumber ??
      item.workOrder?.work_order_number ??
      "",

    repairId:
      item.repairId ??
      item.repair_id ??
      item.repair?.id ??
      "",

    assetId:
      item.assetId ??
      item.asset_id ??
      item.asset?.id ??
      "",

    assetCode:
      item.assetCode ??
      item.asset_code ??
      item.asset?.assetCode ??
      item.asset?.asset_code ??
      item.asset?.code ??
      "",

    assetName:
      item.assetName ??
      item.asset_name ??
      item.asset?.name ??
      "",

    technicianId:
      item.technicianId ??
      item.technician_id ??
      item.technician?.id ??
      "",

    technicianName:
      item.technicianName ??
      item.technician_name ??
      item.technician?.name ??
      item.technician?.fullName ??
      "",

    testType:
      item.testType ??
      item.test_type ??
      "Functional Test",

    testDate:
      item.testDate ??
      item.test_date ??
      item.createdAt ??
      "",

    status:
      String(item.status ?? "pending")
        .toLowerCase()
        .replace(/\s+/g, "_"),

    result:
      item.result ??
      item.testResult ??
      item.test_result ??
      "",

    measurements:
      item.measurements ??
      item.measurement ??
      "",

    testProcedure:
      item.testProcedure ??
      item.test_procedure ??
      "",

    findings:
      item.findings ??
      "",

    defectsFound:
      item.defectsFound ??
      item.defects_found ??
      "",

    correctiveAction:
      item.correctiveAction ??
      item.corrective_action ??
      "",

    technicianNotes:
      item.technicianNotes ??
      item.technician_notes ??
      item.notes ??
      "",

    testedBy:
      item.testedBy ??
      item.tested_by ??
      "",

    createdAt:
      item.createdAt ??
      item.created_at ??
      "",

    updatedAt:
      item.updatedAt ??
      item.updated_at ??
      "",

    source: item,
  };
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getStatusClass(status) {
  return STATUS_CLASS[status] || "badge-gray";
}

function getStatusLabel(status) {
  return (
    STATUS_LABELS[status] ||
    String(status || "Pending")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

export default function TestingQuality() {
  const [tests, setTests] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testTypeFilter, setTestTypeFilter] = useState("all");

  const [selectedTest, setSelectedTest] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
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

  async function loadTests() {
    const data = await fetchJson(
      `${API}/maintenance/testing`
    );

    setTests(
      safeArray(data).map(normalizeTest)
    );
  }

  async function loadSupportingData() {
    const results = await Promise.allSettled([
      fetchJson(`${API}/maintenance/work-orders`),
      fetchJson(`${API}/maintenance/repairs`),
      fetchJson(`${API}/assets`),
      fetchJson(`${API}/maintenance/technicians`),
    ]);

    if (results[0].status === "fulfilled") {
      setWorkOrders(
        safeArray(results[0].value)
      );
    }

    if (results[1].status === "fulfilled") {
      setRepairs(
        safeArray(results[1].value)
      );
    }

    if (results[2].status === "fulfilled") {
      setAssets(
        safeArray(results[2].value)
      );
    }

    if (results[3].status === "fulfilled") {
      setTechnicians(
        safeArray(results[3].value)
      );
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadTests(),
        loadSupportingData(),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load technical tests."
      );
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const testTypes = useMemo(() => {
    return [
      ...new Set(
        tests
          .map((test) =>
            String(test.testType || "").trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [tests]);

  const filteredTests = useMemo(() => {
    const query = normalizeText(search);

    return tests.filter((test) => {
      const searchable = [
        test.workOrderNumber,
        test.assetCode,
        test.assetName,
        test.technicianName,
        test.testType,
        test.result,
        test.findings,
        test.defectsFound,
        test.correctiveAction,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(query);

      const statusMatch =
        statusFilter === "all" ||
        test.status === statusFilter;

      const typeMatch =
        testTypeFilter === "all" ||
        test.testType === testTypeFilter;

      return (
        searchMatch &&
        statusMatch &&
        typeMatch
      );
    });
  }, [
    tests,
    search,
    statusFilter,
    testTypeFilter,
  ]);

  const summary = useMemo(() => {
    const total = tests.length;

    const pending = tests.filter(
      (test) =>
        test.status === "pending"
    ).length;

    const inProgress = tests.filter(
      (test) =>
        test.status === "in_progress"
    ).length;

    const passed = tests.filter(
      (test) =>
        test.status === "passed"
    ).length;

    const failed = tests.filter(
      (test) =>
        test.status === "failed"
    ).length;

    const retest = tests.filter(
      (test) =>
        test.status === "retest_required"
    ).length;

    const completed = tests.filter(
      (test) =>
        test.status === "passed" ||
        test.status === "failed"
    ).length;

    const passRate =
      completed > 0
        ? (passed / completed) * 100
        : 0;

    return {
      total,
      pending,
      inProgress,
      passed,
      failed,
      retest,
      passRate,
    };
  }, [tests]);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setFormMode("create");
    setSelectedTest(null);

    setForm({
      ...EMPTY_FORM,
      testDate: new Date()
        .toISOString()
        .slice(0, 16),
    });

    setError("");
    setShowForm(true);
  }

  function openEditModal(test) {
    setFormMode("edit");
    setSelectedTest(test);

    setForm({
      workOrderId: test.workOrderId || "",
      repairId: test.repairId || "",
      assetId: test.assetId || "",
      technicianId: test.technicianId || "",
      testType:
        test.testType ||
        "Functional Test",
      testDate: test.testDate
        ? String(test.testDate).slice(0, 16)
        : "",
      status: test.status || "pending",
      result: test.result || "",
      measurements:
        test.measurements || "",
      testProcedure:
        test.testProcedure || "",
      findings: test.findings || "",
      defectsFound:
        test.defectsFound || "",
      correctiveAction:
        test.correctiveAction || "",
      technicianNotes:
        test.technicianNotes || "",
      testedBy: test.testedBy || "",
    });

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setSelectedTest(null);
    setForm(EMPTY_FORM);
  }

  function validateForm() {
    if (!form.workOrderId) {
      return "Work order is required.";
    }

    if (!form.assetId) {
      return "Asset is required.";
    }

    if (!form.testType.trim()) {
      return "Test type is required.";
    }

    if (!form.testDate) {
      return "Test date is required.";
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
      workOrderId:
        form.workOrderId
          ? Number(form.workOrderId)
          : null,

      repairId:
        form.repairId
          ? Number(form.repairId)
          : null,

      assetId:
        form.assetId
          ? Number(form.assetId)
          : null,

      technicianId:
        form.technicianId
          ? Number(form.technicianId)
          : null,

      testType:
        form.testType.trim(),

      testDate:
        form.testDate || null,

      status:
        form.status,

      result:
        form.result.trim(),

      measurements:
        form.measurements.trim(),

      testProcedure:
        form.testProcedure.trim(),

      findings:
        form.findings.trim(),

      defectsFound:
        form.defectsFound.trim(),

      correctiveAction:
        form.correctiveAction.trim(),

      technicianNotes:
        form.technicianNotes.trim(),

      testedBy:
        form.testedBy.trim(),
    };

    try {
      if (formMode === "create") {
        const data = await fetchJson(
          `${API}/maintenance/testing`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          data?.data ||
          data?.test ||
          data;

        if (created?.id) {
          setTests((prev) => [
            normalizeTest(created),
            ...prev,
          ]);
        } else {
          await loadTests();
        }
      } else {
        if (!selectedTest?.id) {
          throw new Error(
            "Test ID is missing."
          );
        }

        const data = await fetchJson(
          `${API}/maintenance/testing/${selectedTest.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          data?.data ||
          data?.test ||
          data;

        if (updated?.id) {
          const normalized =
            normalizeTest(updated);

          setTests((prev) =>
            prev.map((test) =>
              String(test.id) ===
              String(selectedTest.id)
                ? normalized
                : test
            )
          );
        } else {
          await loadTests();
        }
      }

      closeForm();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save technical test."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(test, status) {
    if (!test?.id) return;

    setSaving(true);
    setError("");

    try {
      const data = await fetchJson(
        `${API}/maintenance/testing/${test.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      const updated =
        data?.data ||
        data?.test ||
        data;

      if (updated?.id) {
        const normalized =
          normalizeTest(updated);

        setTests((prev) =>
          prev.map((item) =>
            String(item.id) ===
            String(test.id)
              ? normalized
              : item
          )
        );

        setSelectedTest(
          normalized
        );
      } else {
        await loadTests();

        const refreshed =
          tests.find(
            (item) =>
              String(item.id) ===
              String(test.id)
          );

        if (refreshed) {
          setSelectedTest({
            ...refreshed,
            status,
          });
        }
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to update test status."
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
        `${API}/maintenance/testing/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      setTests((prev) =>
        prev.filter(
          (test) =>
            String(test.id) !==
            String(deleteTarget.id)
        )
      );

      if (
        selectedTest?.id ===
        deleteTarget.id
      ) {
        setSelectedTest(null);
      }

      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete technical test."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setTestTypeFilter("all");
  }

  function getWorkOrderLabel(workOrder) {
    return (
      workOrder.workOrderNumber ??
      workOrder.work_order_number ??
      workOrder.number ??
      `WO-${workOrder.id}`
    );
  }

  function getAssetLabel(asset) {
    const code =
      asset.assetCode ??
      asset.asset_code ??
      asset.code ??
      "";

    const name =
      asset.name ??
      asset.assetName ??
      "";

    if (code && name) {
      return `${code} — ${name}`;
    }

    return (
      code ||
      name ||
      `Asset #${asset.id}`
    );
  }

  function getTechnicianLabel(technician) {
    return (
      technician.name ??
      technician.fullName ??
      technician.full_name ??
      technician.username ??
      `Technician #${technician.id}`
    );
  }

  function getRepairLabel(repair) {
    return (
      repair.repairNumber ??
      repair.repair_number ??
      repair.id
        ? `Repair #${
            repair.repairNumber ??
            repair.repair_number ??
            repair.id
          }`
        : "Repair"
    );
  }

  return (
    <div className="testing-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .testing-page {
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

        .testing-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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
          background: #2563eb;
          border-color: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-success {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
        }

        .btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .btn-warning {
          background: #ea580c;
          border-color: #ea580c;
          color: white;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 16px;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .summary-label {
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .summary-value {
          margin-top: 7px;
          font-size: 24px;
          font-weight: 760;
        }

        .summary-note {
          margin-top: 4px;
          color: #98a2b3;
          font-size: 10px;
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
          flex: 1 1 280px;
          min-width: 230px;
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
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37, 99, 235, 0.1);
        }

        .filter-select {
          min-width: 155px;
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
          align-items: center;
          justify-content: space-between;
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
          min-width: 1200px;
          border-collapse: collapse;
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

        .test-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }

        .test-icon {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 10px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
        }

        .test-title {
          color: #1d2939;
          font-weight: 750;
          font-size: 12px;
        }

        .test-subtitle {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .asset-name {
          color: #344054;
          font-weight: 650;
        }

        .asset-code {
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

        .badge-gray {
          background: #f2f4f7;
          color: #475467;
        }

        .badge-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .badge-green {
          background: #dcfce7;
          color: #166534;
        }

        .badge-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge-orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .actions {
          display: flex;
          gap: 5px;
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

        .action-btn.success:hover {
          background: #f0fdf4;
          color: #15803d;
          border-color: #bbf7d0;
        }

        .action-btn.danger:hover {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .empty-state,
        .loading {
          padding: 50px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow:
            0 20px 60px
            rgba(15, 23, 42, 0.25);
        }

        .modal-small {
          width: min(450px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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
          min-height: 90px;
          resize: vertical;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }

        .detail-icon {
          width: 58px;
          height: 58px;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
        }

        .detail-name {
          margin: 0;
          font-size: 19px;
          font-weight: 760;
        }

        .detail-code {
          margin-top: 4px;
          color: #667085;
          font-size: 11px;
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

        .description-box {
          margin-top: 13px;
          padding: 12px;
          background: #fafbfc;
          border: 1px solid #edf0f4;
          border-radius: 9px;
        }

        .description-label {
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .description-text {
          margin-top: 6px;
          color: #475467;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .result-box {
          margin-top: 15px;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid #e3e7ee;
        }

        .result-box.pass {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .result-box.fail {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .result-box.pending {
          background: #f8fafc;
        }

        .result-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .result-text {
          margin-top: 5px;
          font-size: 12px;
          line-height: 1.55;
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .testing-page {
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

          .form-group.full {
            grid-column: auto;
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
        }
      `}</style>

      <div className="testing-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Technical Testing
            </h1>

            <p className="page-subtitle">
              Record post-repair technical tests,
              measurements, findings, and pass/fail
              results before quality approval.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadAll}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              + New Test
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
              Total Tests
            </div>

            <div className="summary-value">
              {summary.total}
            </div>

            <div className="summary-note">
              Technical tests recorded
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Pending
            </div>

            <div className="summary-value">
              {summary.pending}
            </div>

            <div className="summary-note">
              Waiting to be performed
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              In Progress
            </div>

            <div className="summary-value">
              {summary.inProgress}
            </div>

            <div className="summary-note">
              Tests currently being performed
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Passed
            </div>

            <div className="summary-value">
              {summary.passed}
            </div>

            <div className="summary-note">
              Successful technical tests
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Failed
            </div>

            <div className="summary-value">
              {summary.failed}
            </div>

            <div className="summary-note">
              Tests requiring attention
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Pass Rate
            </div>

            <div className="summary-value">
              {summary.passRate.toFixed(1)}%
            </div>

            <div className="summary-note">
              Based on completed tests
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search">
            <input
              className="input"
              type="text"
              placeholder="Search work order, asset, technician, result..."
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
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="in_progress">
              In Progress
            </option>

            <option value="passed">
              Passed
            </option>

            <option value="failed">
              Failed
            </option>

            <option value="retest_required">
              Retest Required
            </option>
          </select>

          <select
            className="select filter-select"
            value={testTypeFilter}
            onChange={(event) =>
              setTestTypeFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Test Types
            </option>

            {testTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
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
              Technical Test Records
            </h2>

            <div className="result-count">
              Showing{" "}
              {filteredTests.length}{" "}
              of {tests.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading technical tests...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="empty-state">
              No technical tests found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Work Order</th>
                    <th>Asset</th>
                    <th>Technician</th>
                    <th>Test Date</th>
                    <th>Result</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTests.map((test) => (
                    <tr key={test.id}>
                      <td>
                        <div className="test-cell">
                          <div className="test-icon">
                            ✓
                          </div>

                          <div>
                            <div className="test-title">
                              {test.testType}
                            </div>

                            <div className="test-subtitle">
                              Test #{test.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {test.workOrderNumber ||
                          (test.workOrderId
                            ? `WO-${test.workOrderId}`
                            : "—")}
                      </td>

                      <td>
                        <div className="asset-name">
                          {test.assetName ||
                            "Unknown Asset"}
                        </div>

                        <div className="asset-code">
                          {test.assetCode ||
                            (test.assetId
                              ? `Asset #${test.assetId}`
                              : "—")}
                        </div>
                      </td>

                      <td>
                        {test.technicianName ||
                          (test.technicianId
                            ? `Technician #${test.technicianId}`
                            : "—")}
                      </td>

                      <td>
                        {formatDate(
                          test.testDate
                        )}
                      </td>

                      <td>
                        {test.result || "—"}
                      </td>

                      <td>
                        <span
                          className={`badge ${getStatusClass(
                            test.status
                          )}`}
                        >
                          {getStatusLabel(
                            test.status
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            className="action-btn"
                            onClick={() =>
                              setSelectedTest(
                                test
                              )
                            }
                          >
                            View
                          </button>

                          <button
                            className="action-btn"
                            onClick={() =>
                              openEditModal(
                                test
                              )
                            }
                          >
                            Edit
                          </button>

                          {test.status !==
                            "passed" && (
                            <button
                              className="action-btn success"
                              onClick={() =>
                                updateStatus(
                                  test,
                                  "passed"
                                )
                              }
                              disabled={saving}
                            >
                              Pass
                            </button>
                          )}

                          {test.status !==
                            "failed" && (
                            <button
                              className="action-btn danger"
                              onClick={() =>
                                updateStatus(
                                  test,
                                  "failed"
                                )
                              }
                              disabled={saving}
                            >
                              Fail
                            </button>
                          )}

                          <button
                            className="action-btn danger"
                            onClick={() =>
                              setDeleteTarget(
                                test
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div
          className="modal-overlay"
          onClick={closeForm}
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
                  {formMode === "create"
                    ? "Create Technical Test"
                    : "Edit Technical Test"}
                </h2>

                <div className="modal-subtitle">
                  Record the technical validation
                  performed after maintenance or repair.
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">
                      Work Order{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      value={form.workOrderId}
                      onChange={(event) =>
                        updateField(
                          "workOrderId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select work order
                      </option>

                      {workOrders.map(
                        (workOrder) => (
                          <option
                            key={workOrder.id}
                            value={workOrder.id}
                          >
                            {getWorkOrderLabel(
                              workOrder
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Repair
                    </label>

                    <select
                      className="select"
                      value={form.repairId}
                      onChange={(event) =>
                        updateField(
                          "repairId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        No linked repair
                      </option>

                      {repairs.map(
                        (repair) => (
                          <option
                            key={repair.id}
                            value={repair.id}
                          >
                            {getRepairLabel(
                              repair
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Asset{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      value={form.assetId}
                      onChange={(event) =>
                        updateField(
                          "assetId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select asset
                      </option>

                      {assets.map(
                        (asset) => (
                          <option
                            key={asset.id}
                            value={asset.id}
                          >
                            {getAssetLabel(
                              asset
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Technician
                    </label>

                    <select
                      className="select"
                      value={form.technicianId}
                      onChange={(event) =>
                        updateField(
                          "technicianId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select technician
                      </option>

                      {technicians.map(
                        (technician) => (
                          <option
                            key={technician.id}
                            value={technician.id}
                          >
                            {getTechnicianLabel(
                              technician
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Test Type{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      value={form.testType}
                      onChange={(event) =>
                        updateField(
                          "testType",
                          event.target.value
                        )
                      }
                      placeholder="Functional Test"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Test Date{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      value={form.testDate}
                      onChange={(event) =>
                        updateField(
                          "testDate",
                          event.target.value
                        )
                      }
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
                      <option value="pending">
                        Pending
                      </option>

                      <option value="in_progress">
                        In Progress
                      </option>

                      <option value="passed">
                        Passed
                      </option>

                      <option value="failed">
                        Failed
                      </option>

                      <option value="retest_required">
                        Retest Required
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Result
                    </label>

                    <input
                      className="input"
                      value={form.result}
                      onChange={(event) =>
                        updateField(
                          "result",
                          event.target.value
                        )
                      }
                      placeholder="Normal / Pass / Fail / ..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Tested By
                    </label>

                    <input
                      className="input"
                      value={form.testedBy}
                      onChange={(event) =>
                        updateField(
                          "testedBy",
                          event.target.value
                        )
                      }
                      placeholder="Tester name or reference"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Test Procedure
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.testProcedure
                      }
                      onChange={(event) =>
                        updateField(
                          "testProcedure",
                          event.target.value
                        )
                      }
                      placeholder="Describe the test procedure and acceptance criteria..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Measurements
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.measurements
                      }
                      onChange={(event) =>
                        updateField(
                          "measurements",
                          event.target.value
                        )
                      }
                      placeholder="Voltage, temperature, pressure, vibration, readings..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Findings
                    </label>

                    <textarea
                      className="textarea"
                      value={form.findings}
                      onChange={(event) =>
                        updateField(
                          "findings",
                          event.target.value
                        )
                      }
                      placeholder="Describe observed test findings..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Defects Found
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.defectsFound
                      }
                      onChange={(event) =>
                        updateField(
                          "defectsFound",
                          event.target.value
                        )
                      }
                      placeholder="Record any remaining defects or abnormal conditions..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Corrective Action
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.correctiveAction
                      }
                      onChange={(event) =>
                        updateField(
                          "correctiveAction",
                          event.target.value
                        )
                      }
                      placeholder="Action required before the asset can be accepted..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Technician Notes
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.technicianNotes
                      }
                      onChange={(event) =>
                        updateField(
                          "technicianNotes",
                          event.target.value
                        )
                      }
                      placeholder="Additional technical notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeForm}
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
                    : formMode === "create"
                    ? "Create Test"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTest && !showForm && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedTest(null)
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
                  Technical Test Details
                </h2>

                <div className="modal-subtitle">
                  Test #{selectedTest.id}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setSelectedTest(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-header">
                <div className="detail-icon">
                  ✓
                </div>

                <div>
                  <h2 className="detail-name">
                    {selectedTest.testType}
                  </h2>

                  <div className="detail-code">
                    {selectedTest.workOrderNumber ||
                      (selectedTest.workOrderId
                        ? `WO-${selectedTest.workOrderId}`
                        : "No work order")}
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
                      className={`badge ${getStatusClass(
                        selectedTest.status
                      )}`}
                    >
                      {getStatusLabel(
                        selectedTest.status
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Result
                  </div>

                  <div className="detail-value">
                    {selectedTest.result ||
                      "Not recorded"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Asset
                  </div>

                  <div className="detail-value">
                    {selectedTest.assetName ||
                      selectedTest.assetCode ||
                      (selectedTest.assetId
                        ? `Asset #${selectedTest.assetId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Technician
                  </div>

                  <div className="detail-value">
                    {selectedTest.technicianName ||
                      (selectedTest.technicianId
                        ? `Technician #${selectedTest.technicianId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Test Date
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedTest.testDate
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Repair
                  </div>

                  <div className="detail-value">
                    {selectedTest.repairId
                      ? `Repair #${selectedTest.repairId}`
                      : "No linked repair"}
                  </div>
                </div>
              </div>

              <div
                className={`result-box ${
                  selectedTest.status ===
                  "passed"
                    ? "pass"
                    : selectedTest.status ===
                      "failed"
                    ? "fail"
                    : "pending"
                }`}
              >
                <div className="result-title">
                  Test Result
                </div>

                <div className="result-text">
                  {selectedTest.result ||
                    "No test result recorded yet."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Test Procedure
                </div>

                <div className="description-text">
                  {selectedTest.testProcedure ||
                    "No procedure recorded."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Measurements
                </div>

                <div className="description-text">
                  {selectedTest.measurements ||
                    "No measurements recorded."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Findings
                </div>

                <div className="description-text">
                  {selectedTest.findings ||
                    "No findings recorded."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Defects Found
                </div>

                <div className="description-text">
                  {selectedTest.defectsFound ||
                    "No defects recorded."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Corrective Action
                </div>

                <div className="description-text">
                  {selectedTest.correctiveAction ||
                    "No corrective action recorded."}
                </div>
              </div>

              <div className="description-box">
                <div className="description-label">
                  Technician Notes
                </div>

                <div className="description-text">
                  {selectedTest.technicianNotes ||
                    "No technician notes recorded."}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {selectedTest.status !==
                "passed" && (
                <button
                  className="btn btn-success"
                  onClick={() =>
                    updateStatus(
                      selectedTest,
                      "passed"
                    )
                  }
                  disabled={saving}
                >
                  ✓ Mark Passed
                </button>
              )}

              {selectedTest.status !==
                "failed" && (
                <button
                  className="btn btn-danger"
                  onClick={() =>
                    updateStatus(
                      selectedTest,
                      "failed"
                    )
                  }
                  disabled={saving}
                >
                  ✕ Mark Failed
                </button>
              )}

              <button
                className="btn"
                onClick={() =>
                  openEditModal(
                    selectedTest
                  )
                }
              >
                Edit
              </button>

              <button
                className="btn"
                onClick={() =>
                  setSelectedTest(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving &&
            setDeleteTarget(null)
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
                  Delete Technical Test
                </h2>

                <div className="modal-subtitle">
                  Confirm test record removal
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
                Are you sure you want to delete
                technical test{" "}
                <strong>
                  #{deleteTarget.id}
                </strong>
                ?
              </p>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  border:
                    "1px solid #fed7aa",
                  color: "#9a3412",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                Test records may be part of the
                maintenance audit trail. The backend
                should enforce any required retention
                or deletion rules.
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
                  : "Delete Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
