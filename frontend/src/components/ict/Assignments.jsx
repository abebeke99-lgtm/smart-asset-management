import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Eye,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const Assignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [formData, setFormData] = useState({
    assetTag: "",
    assetName: "",
    serialNumber: "",
    assignedTo: "",
    employeeId: "",
    department: "",
    position: "",
    location: "",
    assignmentType: "Permanent",
    assignedDate: "",
    expectedReturnDate: "",
    status: "Active",
    purpose: "",
    notes: "",
  });

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("token") ||
      ""
    );
  };

  const getHeaders = () => {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      return response.json();
    }

    return null;
  };

  const normalizeAssignments = (result) => {
    const data = result?.data ?? result;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.assignments)) return data.assignments;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.records)) return data.records;

    return [];
  };

  const loadAssignments = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const endpoints = [
        `${API_BASE_URL}/assignments`,
        `${API_BASE_URL}/asset-assignments`,
      ];

      let result = null;

      for (const endpoint of endpoints) {
        try {
          result = await request(endpoint);
          break;
        } catch {
          // Try next endpoint.
        }
      }

      if (result) {
        setAssignments(normalizeAssignments(result));
      }
    } catch (err) {
      console.error(err);
      setError(
        "Unable to load assignment records. Please check your server connection."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAssignments();

    const interval = setInterval(() => {
      loadAssignments(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const statuses = useMemo(() => {
    const values = assignments
      .map((item) => item.status)
      .filter(Boolean);

    return [...new Set(values)];
  }, [assignments]);

  const assignmentTypes = useMemo(() => {
    const values = assignments
      .map((item) => item.assignmentType || item.type)
      .filter(Boolean);

    return [...new Set(values)];
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return assignments.filter((item) => {
      const matchesSearch =
        !search ||
        String(
          item.assetTag ||
            item.asset?.assetTag ||
            ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          item.assetName ||
            item.asset?.name ||
            item.asset?.itemName ||
            ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          item.serialNumber ||
            item.asset?.serialNumber ||
            ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          item.assignedTo ||
            item.assignee ||
            item.userName ||
            item.user?.name ||
            ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          item.employeeId ||
            item.user?.employeeId ||
            ""
        )
          .toLowerCase()
          .includes(search) ||
        String(item.department || "")
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        String(item.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      const type =
        item.assignmentType || item.type || "";

      const matchesType =
        typeFilter === "all" ||
        String(type).toLowerCase() ===
          typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [
    assignments,
    searchTerm,
    statusFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAssignments.length / itemsPerPage)
  );

  const paginatedAssignments = filteredAssignments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeCount = assignments.filter(
    (item) =>
      String(item.status || "").toLowerCase() ===
      "active"
  ).length;

  const returnedCount = assignments.filter((item) =>
    String(item.status || "")
      .toLowerCase()
      .includes("returned")
  ).length;

  const pendingCount = assignments.filter((item) =>
    String(item.status || "")
      .toLowerCase()
      .includes("pending")
  ).length;

  const temporaryCount = assignments.filter((item) =>
    String(
      item.assignmentType || item.type || ""
    )
      .toLowerCase()
      .includes("temporary")
  ).length;

  const resetForm = () => {
    setFormData({
      assetTag: "",
      assetName: "",
      serialNumber: "",
      assignedTo: "",
      employeeId: "",
      department: "",
      position: "",
      location: "",
      assignmentType: "Permanent",
      assignedDate: "",
      expectedReturnDate: "",
      status: "Active",
      purpose: "",
      notes: "",
    });
  };

  const openAddModal = () => {
    resetForm();
    setSelectedAssignment(null);
    setModalMode("add");
    setShowModal(true);
  };

  const normalizeAssignmentForm = (item) => ({
    assetTag:
      item.assetTag ||
      item.asset?.assetTag ||
      "",
    assetName:
      item.assetName ||
      item.asset?.name ||
      item.asset?.itemName ||
      "",
    serialNumber:
      item.serialNumber ||
      item.asset?.serialNumber ||
      "",
    assignedTo:
      item.assignedTo ||
      item.assignee ||
      item.userName ||
      item.user?.name ||
      "",
    employeeId:
      item.employeeId ||
      item.user?.employeeId ||
      "",
    department: item.department || "",
    position:
      item.position ||
      item.user?.position ||
      "",
    location: item.location || "",
    assignmentType:
      item.assignmentType ||
      item.type ||
      "Permanent",
    assignedDate:
      item.assignedDate
        ? String(item.assignedDate).slice(0, 10)
        : "",
    expectedReturnDate:
      item.expectedReturnDate
        ? String(item.expectedReturnDate).slice(0, 10)
        : "",
    status: item.status || "Active",
    purpose: item.purpose || "",
    notes: item.notes || "",
  });

  const openEditModal = (item) => {
    setSelectedAssignment(item);
    setModalMode("edit");
    setFormData(normalizeAssignmentForm(item));
    setShowModal(true);
  };

  const openViewModal = (item) => {
    setSelectedAssignment(item);
    setModalMode("view");
    setShowModal(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");

      if (
        formData.expectedReturnDate &&
        formData.assignedDate &&
        formData.expectedReturnDate <
          formData.assignedDate
      ) {
        setError(
          "Expected return date cannot be earlier than the assignment date."
        );
        return;
      }

      const payload = {
        ...formData,
      };

      if (modalMode === "add") {
        const endpoints = [
          `${API_BASE_URL}/assignments`,
          `${API_BASE_URL}/asset-assignments`,
        ];

        let success = false;

        for (const endpoint of endpoints) {
          try {
            await request(endpoint, {
              method: "POST",
              body: JSON.stringify(payload),
            });

            success = true;
            break;
          } catch {
            // Try next endpoint.
          }
        }

        if (!success) {
          throw new Error(
            "Unable to create assignment record."
          );
        }
      }

      if (modalMode === "edit") {
        const id =
          selectedAssignment?.id ||
          selectedAssignment?._id ||
          selectedAssignment?.assignmentId;

        if (!id) {
          throw new Error(
            "Assignment ID was not found."
          );
        }

        await request(
          `${API_BASE_URL}/assignments/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      }

      setShowModal(false);
      resetForm();
      await loadAssignments(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to save assignment record."
      );
    }
  };

  const handleDelete = async (item) => {
    const asset =
      item.assetName ||
      item.asset?.name ||
      item.asset?.itemName ||
      "this asset";

    const person =
      item.assignedTo ||
      item.assignee ||
      item.userName ||
      item.user?.name ||
      "this user";

    const confirmed = window.confirm(
      `Delete the assignment of "${asset}" to "${person}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const id =
        item.id ||
        item._id ||
        item.assignmentId;

      if (!id) {
        throw new Error(
          "Assignment ID was not found."
        );
      }

      await request(
        `${API_BASE_URL}/assignments/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadAssignments(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to delete assignment."
      );
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCurrentPage(1);
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return String(date);
    }

    return parsed.toLocaleDateString();
  };

  const exportCSV = () => {
    const headers = [
      "Asset Tag",
      "Asset Name",
      "Serial Number",
      "Assigned To",
      "Employee ID",
      "Department",
      "Position",
      "Location",
      "Assignment Type",
      "Assigned Date",
      "Expected Return Date",
      "Status",
      "Purpose",
      "Notes",
    ];

    const rows = filteredAssignments.map(
      (item) => [
        item.assetTag ||
          item.asset?.assetTag ||
          "",
        item.assetName ||
          item.asset?.name ||
          item.asset?.itemName ||
          "",
        item.serialNumber ||
          item.asset?.serialNumber ||
          "",
        item.assignedTo ||
          item.assignee ||
          item.userName ||
          item.user?.name ||
          "",
        item.employeeId ||
          item.user?.employeeId ||
          "",
        item.department || "",
        item.position ||
          item.user?.position ||
          "",
        item.location || "",
        item.assignmentType ||
          item.type ||
          "",
        item.assignedDate
          ? String(
              item.assignedDate
            ).slice(0, 10)
          : "",
        item.expectedReturnDate
          ? String(
              item.expectedReturnDate
            ).slice(0, 10)
          : "",
        item.status || "",
        item.purpose || "",
        item.notes || "",
      ]
    );

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `assignments-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const getStatusClass = (status) => {
    const value = String(
      status || ""
    ).toLowerCase();

    if (
      value === "active" ||
      value.includes("approved")
    ) {
      return "border-green-200 bg-green-50 text-green-700";
    }

    if (
      value.includes("pending") ||
      value.includes("requested")
    ) {
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    if (
      value.includes("returned") ||
      value.includes("completed")
    ) {
      return "border-slate-200 bg-slate-50 text-slate-700";
    }

    if (
      value.includes("cancel") ||
      value.includes("lost") ||
      value.includes("overdue")
    ) {
      return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-blue-200 bg-blue-50 text-blue-700";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <ClipboardList className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Assignments
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Manage ICT asset assignments to staff,
                  departments, and authorized users.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  loadAssignments(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Assignment
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="flex-1">
              <p className="font-semibold">
                Operation failed
              </p>

              <p className="mt-1 text-sm">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-md p-1 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ClipboardList className="h-5 w-5" />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Total Assignments
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "—"
                : assignments.length.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Active Assignments
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "—"
                : activeCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
              <Calendar className="h-5 w-5" />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Pending Assignments
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "—"
                : pendingCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <ArrowRightLeft className="h-5 w-5" />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Temporary Assignments
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "—"
                : temporaryCount.toLocaleString()}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(
                    event.target.value
                  );
                  setCurrentPage(1);
                }}
                placeholder="Search asset, serial number, assignee, employee ID..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Filter className="h-4 w-4" />
              Filters
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All Statuses
              </option>

              {statuses.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All Assignment Types
              </option>

              {assignmentTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>

            {(searchTerm ||
              statusFilter !== "all" ||
              typeFilter !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Table */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Assignment Records
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredAssignments.length} matching
                record
                {filteredAssignments.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assigned To
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Department
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Type
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assigned Date
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map(
                    (_, index) => (
                      <tr key={index}>
                        {Array.from({
                          length: 8,
                        }).map((__, cell) => (
                          <td
                            key={cell}
                            className="px-5 py-4"
                          >
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    )
                  )
                ) : paginatedAssignments.length >
                  0 ? (
                  paginatedAssignments.map(
                    (item, index) => {
                      const id =
                        item.id ||
                        item._id ||
                        item.assignmentId ||
                        index;

                      const assetName =
                        item.assetName ||
                        item.asset?.name ||
                        item.asset?.itemName ||
                        "Unnamed Asset";

                      const assetTag =
                        item.assetTag ||
                        item.asset?.assetTag ||
                        "No asset tag";

                      const serialNumber =
                        item.serialNumber ||
                        item.asset?.serialNumber ||
                        "";

                      const assignedTo =
                        item.assignedTo ||
                        item.assignee ||
                        item.userName ||
                        item.user?.name ||
                        "Unassigned";

                      const employeeId =
                        item.employeeId ||
                        item.user?.employeeId ||
                        "";

                      const assignmentType =
                        item.assignmentType ||
                        item.type ||
                        "Permanent";

                      return (
                        <tr
                          key={id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <ClipboardList className="h-4 w-4" />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {assetName}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {assetTag}
                                  {serialNumber
                                    ? ` • ${serialNumber}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <User className="h-4 w-4" />
                              </div>

                              <div>
                                <p className="text-sm font-medium text-slate-700">
                                  {assignedTo}
                                </p>

                                {employeeId && (
                                  <p className="text-xs text-slate-400">
                                    ID: {employeeId}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm text-slate-700">
                              {item.department ||
                                "—"}
                            </p>

                            {item.position && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {item.position}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {item.location ||
                                "—"}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                              {assignmentType}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {formatDate(
                                item.assignedDate
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                item.status
                              )}`}
                            >
                              {item.status ||
                                "Unknown"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="View"
                                onClick={() =>
                                  openViewModal(
                                    item
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Eye className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                title="Edit"
                                onClick={() =>
                                  openEditModal(
                                    item
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                              >
                                <Edit className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                title="Delete"
                                onClick={() =>
                                  handleDelete(
                                    item
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-5 py-16"
                    >
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <ClipboardList className="h-7 w-7" />
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-slate-700">
                          No assignments found
                        </h3>

                        <p className="mt-1 max-w-sm text-xs text-slate-400">
                          No assignment records match
                          your current filters.
                        </p>

                        <button
                          type="button"
                          onClick={openAddModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          New Assignment
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {filteredAssignments.length > 0
                ? `Showing ${
                    (currentPage - 1) *
                      itemsPerPage +
                    1
                  }–${Math.min(
                    currentPage * itemsPerPage,
                    filteredAssignments.length
                  )} of ${
                    filteredAssignments.length
                  }`
                : "Showing 0 records"}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1)
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              )
                .slice(
                  Math.max(
                    0,
                    currentPage - 3
                  ),
                  Math.min(
                    totalPages,
                    currentPage + 2
                  )
                )
                .map((page) => (
                  <button
                    type="button"
                    key={page}
                    onClick={() =>
                      setCurrentPage(page)
                    }
                    className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium ${
                      currentPage === page
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

              <button
                type="button"
                disabled={
                  currentPage === totalPages
                }
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            className="absolute inset-0"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {modalMode === "add" &&
                    "New Asset Assignment"}
                  {modalMode === "edit" &&
                    "Edit Assignment"}
                  {modalMode === "view" &&
                    "Assignment Details"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {modalMode === "view"
                    ? "Review the assignment information."
                    : "Record the asset assignment information below."}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === "view" ? (
              <div className="max-h-[78vh] overflow-y-auto p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {[
                    [
                      "Asset Tag",
                      selectedAssignment?.assetTag ||
                        selectedAssignment?.asset
                          ?.assetTag,
                    ],
                    [
                      "Asset Name",
                      selectedAssignment?.assetName ||
                        selectedAssignment?.asset
                          ?.name ||
                        selectedAssignment?.asset
                          ?.itemName,
                    ],
                    [
                      "Serial Number",
                      selectedAssignment?.serialNumber ||
                        selectedAssignment?.asset
                          ?.serialNumber,
                    ],
                    [
                      "Assigned To",
                      selectedAssignment?.assignedTo ||
                        selectedAssignment?.assignee ||
                        selectedAssignment?.userName ||
                        selectedAssignment?.user
                          ?.name,
                    ],
                    [
                      "Employee ID",
                      selectedAssignment?.employeeId ||
                        selectedAssignment?.user
                          ?.employeeId,
                    ],
                    [
                      "Department",
                      selectedAssignment?.department,
                    ],
                    [
                      "Position",
                      selectedAssignment?.position ||
                        selectedAssignment?.user
                          ?.position,
                    ],
                    [
                      "Location",
                      selectedAssignment?.location,
                    ],
                    [
                      "Assignment Type",
                      selectedAssignment?.assignmentType ||
                        selectedAssignment?.type,
                    ],
                    [
                      "Assigned Date",
                      formatDate(
                        selectedAssignment?.assignedDate
                      ),
                    ],
                    [
                      "Expected Return",
                      formatDate(
                        selectedAssignment?.expectedReturnDate
                      ),
                    ],
                    [
                      "Status",
                      selectedAssignment?.status,
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-slate-50 p-4"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {label}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {value || "—"}
                        </p>
                      </div>
                    )
                  )}

                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Purpose
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedAssignment?.purpose ||
                        "No purpose provided."}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Notes
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedAssignment?.notes ||
                        "No notes provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setShowModal(false)
                    }
                    className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="max-h-[78vh] overflow-y-auto"
              >
                <div className="grid gap-5 p-6 md:grid-cols-2">
                  {/* Asset Tag */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Asset Tag *
                    </label>

                    <input
                      type="text"
                      name="assetTag"
                      value={
                        formData.assetTag
                      }
                      onChange={handleChange}
                      required
                      placeholder="ICT-00001"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Asset Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Asset Name *
                    </label>

                    <input
                      type="text"
                      name="assetName"
                      value={
                        formData.assetName
                      }
                      onChange={handleChange}
                      required
                      placeholder="e.g. Dell Latitude 5420"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Serial */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Serial Number
                    </label>

                    <input
                      type="text"
                      name="serialNumber"
                      value={
                        formData.serialNumber
                      }
                      onChange={handleChange}
                      placeholder="Asset serial number"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Assigned To *
                    </label>

                    <input
                      type="text"
                      name="assignedTo"
                      value={
                        formData.assignedTo
                      }
                      onChange={handleChange}
                      required
                      placeholder="Staff / user full name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Employee ID */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Employee ID
                    </label>

                    <input
                      type="text"
                      name="employeeId"
                      value={
                        formData.employeeId
                      }
                      onChange={handleChange}
                      placeholder="Employee ID"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Department
                    </label>

                    <input
                      type="text"
                      name="department"
                      value={
                        formData.department
                      }
                      onChange={handleChange}
                      placeholder="Department / College"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Position
                    </label>

                    <input
                      type="text"
                      name="position"
                      value={
                        formData.position
                      }
                      onChange={handleChange}
                      placeholder="Job position"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Location
                    </label>

                    <input
                      type="text"
                      name="location"
                      value={
                        formData.location
                      }
                      onChange={handleChange}
                      placeholder="Office / building / room"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Assignment Type */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Assignment Type
                    </label>

                    <select
                      name="assignmentType"
                      value={
                        formData.assignmentType
                      }
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Permanent">
                        Permanent
                      </option>
                      <option value="Temporary">
                        Temporary
                      </option>
                      <option value="Departmental">
                        Departmental
                      </option>
                      <option value="Project">
                        Project
                      </option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Status
                    </label>

                    <select
                      name="status"
                      value={
                        formData.status
                      }
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Active">
                        Active
                      </option>
                      <option value="Pending">
                        Pending
                      </option>
                      <option value="Returned">
                        Returned
                      </option>
                      <option value="Overdue">
                        Overdue
                      </option>
                      <option value="Cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>

                  {/* Assigned Date */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Assigned Date *
                    </label>

                    <input
                      type="date"
                      name="assignedDate"
                      value={
                        formData.assignedDate
                      }
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Return Date */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Expected Return Date
                    </label>

                    <input
                      type="date"
                      name="expectedReturnDate"
                      value={
                        formData.expectedReturnDate
                      }
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Purpose */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Purpose
                    </label>

                    <textarea
                      name="purpose"
                      value={
                        formData.purpose
                      }
                      onChange={handleChange}
                      rows="3"
                      placeholder="Purpose of the asset assignment..."
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Notes
                    </label>

                    <textarea
                      name="notes"
                      value={
                        formData.notes
                      }
                      onChange={handleChange}
                      rows="3"
                      placeholder="Additional assignment notes..."
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setShowModal(false)
                    }
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    {modalMode === "add"
                      ? "Create Assignment"
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignments;