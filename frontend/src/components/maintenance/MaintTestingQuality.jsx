import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EMPTY_FORM = {
  testingId: "",
  workOrderId: "",
  repairId: "",
  assetId: "",
  reviewerId: "",
  reviewDate: "",
  status: "pending",
  decision: "",
  qualityScore: "",
  inspectionSummary: "",
  findings: "",
  defectsFound: "",
  correctiveAction: "",
  reviewerNotes: "",
  recommendations: "",
};

const STATUS_LABELS = {
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned",
};

const STATUS_CLASS = {
  pending: "badge-gray",
  in_review: "badge-blue",
  approved: "badge-green",
  rejected: "badge-red",
  returned: "badge-orange",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.reviews)) return data.reviews;
  if (Array.isArray(data?.qualityControls)) {
    return data.qualityControls;
  }
  if (Array.isArray(data?.quality_control)) {
    return data.quality_control;
  }
  return [];
}

function normalizeQC(item) {
  return {
    id:
      item.id ??
      item.reviewId ??
      item.review_id ??
      item.qualityControlId ??
      item.quality_control_id,

    testingId:
      item.testingId ??
      item.testing_id ??
      item.testId ??
      item.test_id ??
      item.testing?.id ??
      item.test?.id ??
      "",

    testType:
      item.testType ??
      item.test_type ??
      item.testing?.testType ??
      item.test?.testType ??
      "",

    testStatus:
      item.testStatus ??
      item.test_status ??
      item.testing?.status ??
      item.test?.status ??
      "",

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
      item.asset?.assetName ??
      "",

    reviewerId:
      item.reviewerId ??
      item.reviewer_id ??
      item.reviewer?.id ??
      "",

    reviewerName:
      item.reviewerName ??
      item.reviewer_name ??
      item.reviewer?.name ??
      item.reviewer?.fullName ??
      item.reviewer?.full_name ??
      "",

    reviewDate:
      item.reviewDate ??
      item.review_date ??
      item.createdAt ??
      item.created_at ??
      "",

    status: String(
      item.status ?? "pending"
    )
      .toLowerCase()
      .replace(/\s+/g, "_"),

    decision:
      item.decision ??
      item.qcDecision ??
      item.qc_decision ??
      "",

    qualityScore:
      item.qualityScore ??
      item.quality_score ??
      "",

    inspectionSummary:
      item.inspectionSummary ??
      item.inspection_summary ??
      item.summary ??
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

    reviewerNotes:
      item.reviewerNotes ??
      item.reviewer_notes ??
      item.notes ??
      "",

    recommendations:
      item.recommendations ??
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

export default function QualityControl() {
  const [reviews, setReviews] = useState([]);
  const [tests, setTests] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [reviewers, setReviewers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] =
    useState("all");

  const [selectedReview, setSelectedReview] =
    useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] =
    useState("create");

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] =
    useState(null);

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

  async function loadReviews() {
    const data = await fetchJson(
      `${API}/maintenance/quality-control`
    );

    setReviews(
      safeArray(data).map(normalizeQC)
    );
  }

  async function loadSupportingData() {
    const results = await Promise.allSettled([
      fetchJson(
        `${API}/maintenance/testing`
      ),
      fetchJson(
        `${API}/maintenance/work-orders`
      ),
      fetchJson(
        `${API}/maintenance/repairs`
      ),
      fetchJson(`${API}/assets`),
      fetchJson(
        `${API}/maintenance/technicians`
      ),
    ]);

    if (results[0].status === "fulfilled") {
      setTests(
        safeArray(results[0].value)
      );
    }

    if (results[1].status === "fulfilled") {
      setWorkOrders(
        safeArray(results[1].value)
      );
    }

    if (results[2].status === "fulfilled") {
      setRepairs(
        safeArray(results[2].value)
      );
    }

    if (results[3].status === "fulfilled") {
      setAssets(
        safeArray(results[3].value)
      );
    }

    if (results[4].status === "fulfilled") {
      setReviewers(
        safeArray(results[4].value)
      );
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadReviews(),
        loadSupportingData(),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load quality control records."
      );

      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredReviews = useMemo(() => {
    const query = normalizeText(search);

    return reviews.filter((review) => {
      const searchable = [
        review.assetCode,
        review.assetName,
        review.workOrderNumber,
        review.testType,
        review.reviewerName,
        review.decision,
        review.findings,
        review.defectsFound,
        review.correctiveAction,
        review.inspectionSummary,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(
          query
        );

      const statusMatch =
        statusFilter === "all" ||
        review.status === statusFilter;

      const decisionMatch =
        decisionFilter === "all" ||
        normalizeText(
          review.decision
        ) ===
          normalizeText(decisionFilter);

      return (
        searchMatch &&
        statusMatch &&
        decisionMatch
      );
    });
  }, [
    reviews,
    search,
    statusFilter,
    decisionFilter,
  ]);

  const summary = useMemo(() => {
    const total = reviews.length;

    const pending = reviews.filter(
      (review) =>
        review.status === "pending"
    ).length;

    const inReview = reviews.filter(
      (review) =>
        review.status === "in_review"
    ).length;

    const approved = reviews.filter(
      (review) =>
        review.status === "approved"
    ).length;

    const rejected = reviews.filter(
      (review) =>
        review.status === "rejected"
    ).length;

    const returned = reviews.filter(
      (review) =>
        review.status === "returned"
    ).length;

    const decided = reviews.filter(
      (review) =>
        review.status === "approved" ||
        review.status === "rejected"
    ).length;

    const approvalRate =
      decided > 0
        ? (approved / decided) * 100
        : 0;

    return {
      total,
      pending,
      inReview,
      approved,
      rejected,
      returned,
      approvalRate,
    };
  }, [reviews]);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setFormMode("create");
    setSelectedReview(null);

    setForm({
      ...EMPTY_FORM,
      reviewDate: new Date()
        .toISOString()
        .slice(0, 16),
    });

    setError("");
    setShowForm(true);
  }

  function openEditModal(review) {
    setFormMode("edit");
    setSelectedReview(review);

    setForm({
      testingId:
        review.testingId || "",
      workOrderId:
        review.workOrderId || "",
      repairId:
        review.repairId || "",
      assetId:
        review.assetId || "",
      reviewerId:
        review.reviewerId || "",
      reviewDate:
        review.reviewDate
          ? String(
              review.reviewDate
            ).slice(0, 16)
          : "",
      status:
        review.status || "pending",
      decision:
        review.decision || "",
      qualityScore:
        review.qualityScore ?? "",
      inspectionSummary:
        review.inspectionSummary || "",
      findings:
        review.findings || "",
      defectsFound:
        review.defectsFound || "",
      correctiveAction:
        review.correctiveAction || "",
      reviewerNotes:
        review.reviewerNotes || "",
      recommendations:
        review.recommendations || "",
    });

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setSelectedReview(null);
    setForm(EMPTY_FORM);
  }

  function validateForm() {
    if (!form.testingId) {
      return "Technical test is required.";
    }

    if (!form.assetId) {
      return "Asset is required.";
    }

    if (!form.reviewDate) {
      return "Review date is required.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const numericScore =
      form.qualityScore === ""
        ? null
        : Number(form.qualityScore);

    const payload = {
      testingId: form.testingId
        ? Number(form.testingId)
        : null,

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

      reviewerId:
        form.reviewerId
          ? Number(form.reviewerId)
          : null,

      reviewDate:
        form.reviewDate || null,

      status:
        form.status,

      decision:
        form.decision.trim(),

      qualityScore:
        Number.isFinite(numericScore)
          ? numericScore
          : null,

      inspectionSummary:
        form.inspectionSummary.trim(),

      findings:
        form.findings.trim(),

      defectsFound:
        form.defectsFound.trim(),

      correctiveAction:
        form.correctiveAction.trim(),

      reviewerNotes:
        form.reviewerNotes.trim(),

      recommendations:
        form.recommendations.trim(),
    };

    try {
      if (formMode === "create") {
        const data = await fetchJson(
          `${API}/maintenance/quality-control`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          data?.data ||
          data?.review ||
          data;

        if (created?.id) {
          setReviews((prev) => [
            normalizeQC(created),
            ...prev,
          ]);
        } else {
          await loadReviews();
        }
      } else {
        if (!selectedReview?.id) {
          throw new Error(
            "Quality control review ID is missing."
          );
        }

        const data = await fetchJson(
          `${API}/maintenance/quality-control/${selectedReview.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          data?.data ||
          data?.review ||
          data;

        if (updated?.id) {
          const normalized =
            normalizeQC(updated);

          setReviews((prev) =>
            prev.map((review) =>
              String(review.id) ===
              String(selectedReview.id)
                ? normalized
                : review
            )
          );
        } else {
          await loadReviews();
        }
      }

      closeForm();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save quality control review."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    review,
    status,
    decision = undefined
  ) {
    if (!review?.id) return;

    setSaving(true);
    setError("");

    const payload = {
      status,
    };

    if (decision !== undefined) {
      payload.decision = decision;
    }

    try {
      const data = await fetchJson(
        `${API}/maintenance/quality-control/${review.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      const updated =
        data?.data ||
        data?.review ||
        data;

      if (updated?.id) {
        const normalized =
          normalizeQC(updated);

        setReviews((prev) =>
          prev.map((item) =>
            String(item.id) ===
            String(review.id)
              ? normalized
              : item
          )
        );

        setSelectedReview(
          normalized
        );
      } else {
        await loadReviews();

        setSelectedReview({
          ...review,
          status,
          ...(decision !== undefined
            ? { decision }
            : {}),
        });
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to update quality control status."
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
        `${API}/maintenance/quality-control/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      setReviews((prev) =>
        prev.filter(
          (review) =>
            String(review.id) !==
            String(deleteTarget.id)
        )
      );

      if (
        selectedReview?.id ===
        deleteTarget.id
      ) {
        setSelectedReview(null);
      }

      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete quality control review."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDecisionFilter("all");
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

  function getReviewerLabel(reviewer) {
    return (
      reviewer.name ??
      reviewer.fullName ??
      reviewer.full_name ??
      reviewer.username ??
      `User #${reviewer.id}`
    );
  }

  function getTestingLabel(test) {
    const id =
      test.id ??
      test.testId ??
      test.test_id;

    const type =
      test.testType ??
      test.test_type ??
      "Technical Test";

    const status =
      test.status ??
      "pending";

    return `Test #${id} — ${type} — ${String(
      status
    ).replace(/_/g, " ")}`;
  }

  function getRepairLabel(repair) {
    const number =
      repair.repairNumber ??
      repair.repair_number;

    return number
      ? `Repair #${number}`
      : `Repair #${repair.id}`;
  }

  return (
    <div className="quality-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .quality-page {
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

        .quality-container {
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

        .btn-dark {
          background: #344054;
          border-color: #344054;
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
          flex: 1 1 300px;
          min-width: 240px;
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
          min-width: 1250px;
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

        .review-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 230px;
        }

        .review-icon {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 10px;
          background: #f0fdf4;
          color: #15803d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
        }

        .review-title {
          color: #1d2939;
          font-weight: 750;
          font-size: 12px;
        }

        .review-subtitle {
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

        .score {
          font-weight: 800;
          color: #344054;
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

        .action-btn.warning:hover {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
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
          width: min(460px, 100%);
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
          background: #f0fdf4;
          color: #15803d;
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

        .decision-box {
          margin-top: 15px;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid #e3e7ee;
        }

        .decision-box.approved {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .decision-box.rejected {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .decision-box.returned {
          background: #fff7ed;
          border-color: #fed7aa;
        }

        .decision-box.pending {
          background: #f8fafc;
        }

        .decision-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .decision-text {
          margin-top: 5px;
          font-size: 12px;
          line-height: 1.55;
        }

        .score-bar {
          margin-top: 8px;
          height: 8px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
        }

        .score-fill {
          height: 100%;
          background: #16a34a;
          border-radius: 999px;
          transition: width 0.2s ease;
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .quality-page {
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

      <div className="quality-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Quality Control
            </h1>

            <p className="page-subtitle">
              Review technical test results,
              document quality findings, and approve
              or return repaired assets.
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
              + New QC Review
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
              Total Reviews
            </div>

            <div className="summary-value">
              {summary.total}
            </div>

            <div className="summary-note">
              Quality control records
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
              Waiting for QC review
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              In Review
            </div>

            <div className="summary-value">
              {summary.inReview}
            </div>

            <div className="summary-note">
              Reviews currently open
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Approved
            </div>

            <div className="summary-value">
              {summary.approved}
            </div>

            <div className="summary-note">
              Quality approved
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Rejected
            </div>

            <div className="summary-value">
              {summary.rejected}
            </div>

            <div className="summary-note">
              Quality failures
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Approval Rate
            </div>

            <div className="summary-value">
              {summary.approvalRate.toFixed(
                1
              )}
              %
            </div>

            <div className="summary-note">
              Based on decided reviews
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search">
            <input
              className="input"
              type="text"
              placeholder="Search asset, work order, reviewer, findings..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
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

            <option value="in_review">
              In Review
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="returned">
              Returned
            </option>
          </select>

          <select
            className="select filter-select"
            value={decisionFilter}
            onChange={(event) =>
              setDecisionFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Decisions
            </option>

            <option value="approve">
              Approve
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="reject">
              Reject
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="return">
              Return
            </option>
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
              Quality Control Reviews
            </h2>

            <div className="result-count">
              Showing{" "}
              {filteredReviews.length}{" "}
              of {reviews.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading quality control reviews...
            </div>
          ) : filteredReviews.length ===
            0 ? (
            <div className="empty-state">
              No quality control reviews found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Review</th>
                    <th>Work Order</th>
                    <th>Asset</th>
                    <th>Reviewer</th>
                    <th>Review Date</th>
                    <th>Score</th>
                    <th>Decision</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReviews.map(
                    (review) => (
                      <tr key={review.id}>
                        <td>
                          <div className="review-cell">
                            <div className="review-icon">
                              QC
                            </div>

                            <div>
                              <div className="review-title">
                                {review.testType ||
                                  "Quality Review"}
                              </div>

                              <div className="review-subtitle">
                                Review #
                                {review.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {review.workOrderNumber ||
                            (review.workOrderId
                              ? `WO-${review.workOrderId}`
                              : "—")}
                        </td>

                        <td>
                          <div className="asset-name">
                            {review.assetName ||
                              "Unknown Asset"}
                          </div>

                          <div className="asset-code">
                            {review.assetCode ||
                              (review.assetId
                                ? `Asset #${review.assetId}`
                                : "—")}
                          </div>
                        </td>

                        <td>
                          {review.reviewerName ||
                            (review.reviewerId
                              ? `User #${review.reviewerId}`
                              : "—")}
                        </td>

                        <td>
                          {formatDate(
                            review.reviewDate
                          )}
                        </td>

                        <td>
                          <span className="score">
                            {review.qualityScore !==
                            ""
                              ? `${review.qualityScore}/100`
                              : "—"}
                          </span>
                        </td>

                        <td>
                          {review.decision ||
                            "—"}
                        </td>

                        <td>
                          <span
                            className={`badge ${getStatusClass(
                              review.status
                            )}`}
                          >
                            {getStatusLabel(
                              review.status
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="action-btn"
                              onClick={() =>
                                setSelectedReview(
                                  review
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              className="action-btn"
                              onClick={() =>
                                openEditModal(
                                  review
                                )
                              }
                            >
                              Edit
                            </button>

                            {review.status !==
                              "approved" && (
                              <button
                                className="action-btn success"
                                onClick={() =>
                                  updateStatus(
                                    review,
                                    "approved",
                                    "approved"
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                Approve
                              </button>
                            )}

                            {review.status !==
                              "rejected" && (
                              <button
                                className="action-btn danger"
                                onClick={() =>
                                  updateStatus(
                                    review,
                                    "rejected",
                                    "rejected"
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                Reject
                              </button>
                            )}

                            {review.status !==
                              "returned" && (
                              <button
                                className="action-btn warning"
                                onClick={() =>
                                  updateStatus(
                                    review,
                                    "returned",
                                    "return"
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                Return
                              </button>
                            )}

                            <button
                              className="action-btn danger"
                              onClick={() =>
                                setDeleteTarget(
                                  review
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
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
                    ? "Create QC Review"
                    : "Edit QC Review"}
                </h2>

                <div className="modal-subtitle">
                  Review the technical testing result
                  and document the quality decision.
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
                      Technical Test{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      value={form.testingId}
                      onChange={(event) => {
                        const value =
                          event.target.value;

                        updateField(
                          "testingId",
                          value
                        );

                        const selected =
                          tests.find(
                            (test) =>
                              String(
                                test.id ??
                                  test.testId
                              ) ===
                              String(value)
                          );

                        if (selected) {
                          if (
                            selected.workOrderId
                          ) {
                            updateField(
                              "workOrderId",
                              selected.workOrderId
                            );
                          }

                          if (
                            selected.assetId
                          ) {
                            updateField(
                              "assetId",
                              selected.assetId
                            );
                          }

                          if (
                            selected.repairId
                          ) {
                            updateField(
                              "repairId",
                              selected.repairId
                            );
                          }
                        }
                      }}
                    >
                      <option value="">
                        Select technical test
                      </option>

                      {tests.map((test) => (
                        <option
                          key={
                            test.id ??
                            test.testId
                          }
                          value={
                            test.id ??
                            test.testId
                          }
                        >
                          {getTestingLabel(
                            test
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Work Order
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
                      Reviewer
                    </label>

                    <select
                      className="select"
                      value={form.reviewerId}
                      onChange={(event) =>
                        updateField(
                          "reviewerId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select reviewer
                      </option>

                      {reviewers.map(
                        (reviewer) => (
                          <option
                            key={reviewer.id}
                            value={reviewer.id}
                          >
                            {getReviewerLabel(
                              reviewer
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Review Date{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      value={form.reviewDate}
                      onChange={(event) =>
                        updateField(
                          "reviewDate",
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

                      <option value="in_review">
                        In Review
                      </option>

                      <option value="approved">
                        Approved
                      </option>

                      <option value="rejected">
                        Rejected
                      </option>

                      <option value="returned">
                        Returned
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Decision
                    </label>

                    <select
                      className="select"
                      value={form.decision}
                      onChange={(event) =>
                        updateField(
                          "decision",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select decision
                      </option>

                      <option value="approved">
                        Approved
                      </option>

                      <option value="rejected">
                        Rejected
                      </option>

                      <option value="return">
                        Return for Correction
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Quality Score
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={
                        form.qualityScore
                      }
                      onChange={(event) =>
                        updateField(
                          "qualityScore",
                          event.target.value
                        )
                      }
                      placeholder="0 - 100"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Inspection Summary
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.inspectionSummary
                      }
                      onChange={(event) =>
                        updateField(
                          "inspectionSummary",
                          event.target.value
                        )
                      }
                      placeholder="Summarize the overall quality inspection..."
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
                      placeholder="Document quality findings..."
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
                      placeholder="Document remaining defects or non-conformities..."
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
                      placeholder="Required corrective action..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Recommendations
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.recommendations
                      }
                      onChange={(event) =>
                        updateField(
                          "recommendations",
                          event.target.value
                        )
                      }
                      placeholder="Recommendations before returning the asset to service..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="label">
                      Reviewer Notes
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.reviewerNotes
                      }
                      onChange={(event) =>
                        updateField(
                          "reviewerNotes",
                          event.target.value
                        )
                      }
                      placeholder="Additional quality control notes..."
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
                    ? "Create Review"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReview &&
        !showForm && (
          <div
            className="modal-overlay"
            onClick={() =>
              setSelectedReview(null)
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
                    Quality Control Details
                  </h2>

                  <div className="modal-subtitle">
                    Review #
                    {selectedReview.id}
                  </div>
                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setSelectedReview(
                      null
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="detail-header">
                  <div className="detail-icon">
                    QC
                  </div>

                  <div>
                    <h2 className="detail-name">
                      {selectedReview.testType ||
                        "Quality Control Review"}
                    </h2>

                    <div className="detail-code">
                      {selectedReview.workOrderNumber ||
                        (selectedReview.workOrderId
                          ? `WO-${selectedReview.workOrderId}`
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
                          selectedReview.status
                        )}`}
                      >
                        {getStatusLabel(
                          selectedReview.status
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Decision
                    </div>

                    <div className="detail-value">
                      {selectedReview.decision ||
                        "Not decided"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Asset
                    </div>

                    <div className="detail-value">
                      {selectedReview.assetName ||
                        selectedReview.assetCode ||
                        (selectedReview.assetId
                          ? `Asset #${selectedReview.assetId}`
                          : "—")}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Reviewer
                    </div>

                    <div className="detail-value">
                      {selectedReview.reviewerName ||
                        (selectedReview.reviewerId
                          ? `User #${selectedReview.reviewerId}`
                          : "—")}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Review Date
                    </div>

                    <div className="detail-value">
                      {formatDateTime(
                        selectedReview.reviewDate
                      )}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Technical Test
                    </div>

                    <div className="detail-value">
                      {selectedReview.testingId
                        ? `Test #${selectedReview.testingId}`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div
                  className={`decision-box ${
                    selectedReview.status ===
                    "approved"
                      ? "approved"
                      : selectedReview.status ===
                        "rejected"
                      ? "rejected"
                      : selectedReview.status ===
                        "returned"
                      ? "returned"
                      : "pending"
                  }`}
                >
                  <div className="decision-title">
                    Quality Decision
                  </div>

                  <div className="decision-text">
                    {selectedReview.decision ||
                      "No final quality decision has been recorded."}
                  </div>

                  {selectedReview.qualityScore !==
                    "" && (
                    <>
                      <div
                        style={{
                          marginTop:
                            "12px",
                          fontSize:
                            "11px",
                          fontWeight:
                            750,
                        }}
                      >
                        Quality Score:{" "}
                        {
                          selectedReview.qualityScore
                        }
                        /100
                      </div>

                      <div className="score-bar">
                        <div
                          className="score-fill"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                Number(
                                  selectedReview.qualityScore
                                ) || 0
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Inspection Summary
                  </div>

                  <div className="description-text">
                    {selectedReview.inspectionSummary ||
                      "No inspection summary recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Findings
                  </div>

                  <div className="description-text">
                    {selectedReview.findings ||
                      "No findings recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Defects Found
                  </div>

                  <div className="description-text">
                    {selectedReview.defectsFound ||
                      "No defects recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Corrective Action
                  </div>

                  <div className="description-text">
                    {selectedReview.correctiveAction ||
                      "No corrective action recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Recommendations
                  </div>

                  <div className="description-text">
                    {selectedReview.recommendations ||
                      "No recommendations recorded."}
                  </div>
                </div>

                <div className="description-box">
                  <div className="description-label">
                    Reviewer Notes
                  </div>

                  <div className="description-text">
                    {selectedReview.reviewerNotes ||
                      "No reviewer notes recorded."}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                {selectedReview.status !==
                  "approved" && (
                  <button
                    className="btn btn-success"
                    onClick={() =>
                      updateStatus(
                        selectedReview,
                        "approved",
                        "approved"
                      )
                    }
                    disabled={saving}
                  >
                    ✓ Approve
                  </button>
                )}

                {selectedReview.status !==
                  "rejected" && (
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      updateStatus(
                        selectedReview,
                        "rejected",
                        "rejected"
                      )
                    }
                    disabled={saving}
                  >
                    ✕ Reject
                  </button>
                )}

                {selectedReview.status !==
                  "returned" && (
                  <button
                    className="btn btn-warning"
                    onClick={() =>
                      updateStatus(
                        selectedReview,
                        "returned",
                        "return"
                      )
                    }
                    disabled={saving}
                  >
                    ↩ Return
                  </button>
                )}

                <button
                  className="btn"
                  onClick={() =>
                    openEditModal(
                      selectedReview
                    )
                  }
                >
                  Edit
                </button>

                <button
                  className="btn"
                  onClick={() =>
                    setSelectedReview(
                      null
                    )
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
                  Delete QC Review
                </h2>

                <div className="modal-subtitle">
                  Confirm quality control record removal
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
                quality control review{" "}
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
                Quality control records can be part
                of the maintenance audit trail. The
                backend should enforce any required
                retention and deletion rules.
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
                  : "Delete Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
