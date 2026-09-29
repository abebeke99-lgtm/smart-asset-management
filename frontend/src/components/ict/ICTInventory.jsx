import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    assetTag: "",
    itemName: "",
    category: "",
    subCategory: "",
    serialNumber: "",
    quantity: 1,
    unit: "Piece",
    location: "",
    department: "",
    condition: "Good",
    status: "Available",
    purchaseDate: "",
    purchasePrice: "",
    supplier: "",
    description: "",
  });

  /* =========================================================
     API
  ========================================================= */

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
    const authHeader = token ? { Authorization: "Bearer " + token } : {};

    return {
      "Content-Type": "application/json",
      ...authHeader,
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
      let message = `Request failed with status ${response.status}`;

      try {
        const errorData = await response.json();

        if (errorData?.message) {
          message = errorData.message;
        }
      } catch {
        // Ignore invalid JSON error response.
      }

      throw new Error(message);
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      return response.json();
    }

    return null;
  };

  const normalizeItems = (result) => {
    const data = result?.data ?? result;

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (Array.isArray(data?.inventory)) {
      return data.inventory;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    return [];
  };

  const loadInventory = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const endpoints = [
        `${API_BASE_URL}/inventory`,
        `${API_BASE_URL}/inventory/items`,
      ];

      let result = null;

      for (const endpoint of endpoints) {
        try {
          result = await request(endpoint);
          break;
        } catch {
          // Try the next endpoint.
        }
      }

      if (result !== null) {
        setInventory(normalizeItems(result));
      } else {
        throw new Error("Unable to connect to the inventory API.");
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load inventory data. Please check your server connection."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInventory();

    const interval = setInterval(() => {
      loadInventory(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  /* =========================================================
     FILTER DATA
  ========================================================= */

  const categories = useMemo(() => {
    const values = inventory
      .map((item) => item.category)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [inventory]);

  const statuses = useMemo(() => {
    const values = inventory
      .map((item) => item.status)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [inventory]);

  const conditions = useMemo(() => {
    const values = inventory
      .map((item) => item.condition)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesSearch =
        !search ||
        String(item.assetTag || "")
          .toLowerCase()
          .includes(search) ||
        String(item.itemName || item.name || "")
          .toLowerCase()
          .includes(search) ||
        String(item.serialNumber || "")
          .toLowerCase()
          .includes(search) ||
        String(item.category || "")
          .toLowerCase()
          .includes(search) ||
        String(item.location || "")
          .toLowerCase()
          .includes(search) ||
        String(item.department || "")
          .toLowerCase()
          .includes(search);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").toLowerCase() ===
          categoryFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        String(item.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesCondition =
        conditionFilter === "all" ||
        String(item.condition || "").toLowerCase() ===
          conditionFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesCondition
      );
    });
  }, [
    inventory,
    searchTerm,
    categoryFilter,
    statusFilter,
    conditionFilter,
  ]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / itemsPerPage)
  );

  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* =========================================================
     FORM
  ========================================================= */

  const resetForm = () => {
    setFormData({
      assetTag: "",
      itemName: "",
      category: "",
      subCategory: "",
      serialNumber: "",
      quantity: 1,
      unit: "Piece",
      location: "",
      department: "",
      condition: "Good",
      status: "Available",
      purchaseDate: "",
      purchasePrice: "",
      supplier: "",
      description: "",
    });
  };

  const openAddModal = () => {
    resetForm();
    setSelectedItem(null);
    setModalMode("add");
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setModalMode("edit");

    setFormData({
      assetTag: item.assetTag || "",
      itemName: item.itemName || item.name || "",
      category: item.category || "",
      subCategory: item.subCategory || "",
      serialNumber: item.serialNumber || "",
      quantity: item.quantity ?? 1,
      unit: item.unit || "Piece",
      location: item.location || "",
      department: item.department || "",
      condition: item.condition || "Good",
      status: item.status || "Available",
      purchaseDate: item.purchaseDate
        ? String(item.purchaseDate).slice(0, 10)
        : "",
      purchasePrice: item.purchasePrice ?? "",
      supplier: item.supplier || "",
      description: item.description || "",
    });

    setShowModal(true);
  };

  const openViewModal = (item) => {
    setSelectedItem(item);
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

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setSelectedItem(null);
    resetForm();
  };

  /* =========================================================
     CREATE / UPDATE
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (modalMode === "view") return;

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        quantity: Number(formData.quantity) || 0,
        purchasePrice: Number(formData.purchasePrice) || 0,
      };

      if (modalMode === "add") {
        const endpoints = [
          `${API_BASE_URL}/inventory`,
          `${API_BASE_URL}/inventory/items`,
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
          throw new Error("Unable to create inventory item.");
        }
      }

      if (modalMode === "edit" && selectedItem) {
        const id =
          selectedItem.id ||
          selectedItem._id ||
          selectedItem.inventoryId;

        if (!id) {
          throw new Error("Inventory item ID was not found.");
        }

        await request(`${API_BASE_URL}/inventory/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      resetForm();
      setSelectedItem(null);

      await loadInventory(true);
    } catch (err) {
      console.error(err);

      setError(err.message || "Unable to save inventory item.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        item.itemName || item.name || "this item"
      }"?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const id =
        item.id ||
        item._id ||
        item.inventoryId;

      if (!id) {
        throw new Error("Inventory item ID was not found.");
      }

      await request(`${API_BASE_URL}/inventory/${id}`, {
        method: "DELETE",
      });

      await loadInventory(true);
    } catch (err) {
      console.error(err);

      setError(err.message || "Unable to delete inventory item.");
    } finally {
      setDeleting(false);
    }
  };

  /* =========================================================
     FILTER RESET
  ========================================================= */

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setConditionFilter("all");
    setCurrentPage(1);
  };

  /* =========================================================
     CSV EXPORT
  ========================================================= */

  const exportCSV = () => {
    const headers = [
      "Asset Tag",
      "Item Name",
      "Category",
      "Sub Category",
      "Serial Number",
      "Quantity",
      "Unit",
      "Location",
      "Department",
      "Condition",
      "Status",
      "Purchase Date",
      "Purchase Price",
      "Supplier",
    ];

    const rows = filteredInventory.map((item) => [
      item.assetTag || "",
      item.itemName || item.name || "",
      item.category || "",
      item.subCategory || "",
      item.serialNumber || "",
      item.quantity ?? "",
      item.unit || "",
      item.location || "",
      item.department || "",
      item.condition || "",
      item.status || "",
      item.purchaseDate
        ? String(item.purchaseDate).slice(0, 10)
        : "",
      item.purchasePrice ?? "",
      item.supplier || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `inventory-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     STYLE HELPERS
  ========================================================= */

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (
      value.includes("available") ||
      value.includes("active") ||
      value.includes("in stock")
    ) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (
      value.includes("assigned") ||
      value.includes("issued")
    ) {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }

    if (
      value.includes("maintenance") ||
      value.includes("repair")
    ) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    if (
      value.includes("damaged") ||
      value.includes("lost") ||
      value.includes("retired")
    ) {
      return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-700";
  };

  const getConditionClass = (condition) => {
    const value = String(condition || "").toLowerCase();

    if (
      value.includes("excellent") ||
      value.includes("good")
    ) {
      return "text-emerald-700";
    }

    if (value.includes("fair")) {
      return "text-amber-700";
    }

    if (
      value.includes("poor") ||
      value.includes("damaged")
    ) {
      return "text-red-700";
    }

    return "text-slate-600";
  };

  /* =========================================================
     SUMMARY
  ========================================================= */

  const totalQuantity = inventory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const availableCount = inventory.filter((item) =>
    String(item.status || "")
      .toLowerCase()
      .includes("available")
  ).length;

  const maintenanceCount = inventory.filter((item) =>
    String(item.status || "")
      .toLowerCase()
      .includes("maintenance")
  ).length;

  const damagedCount = inventory.filter((item) =>
    String(item.condition || "")
      .toLowerCase()
      .includes("damaged")
  ).length;

  /* =========================================================
     INPUT CLASS
  ========================================================= */

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Archive className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Inventory Management
                </h1>

                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  Manage ICT assets, stock levels, locations,
                  conditions and availability.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadInventory(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />

                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Add Inventory</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1800px]">
          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-800">
                  Operation failed
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-2 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                aria-label="Close error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* =================================================
              SUMMARY CARDS
          ================================================= */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                  <Package className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Items
                </span>
              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Total Inventory
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {loading
                  ? "—"
                  : totalQuantity.toLocaleString()}
              </p>
            </div>

            {/* Available */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                  Available
                </span>
              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Available Items
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {loading
                  ? "—"
                  : availableCount.toLocaleString()}
              </p>
            </div>

            {/* Maintenance */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-500 group-hover:text-white">
                  <RefreshCw className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-600">
                  Service
                </span>
              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Maintenance
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {loading
                  ? "—"
                  : maintenanceCount.toLocaleString()}
              </p>
            </div>

            {/* Damaged */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 transition group-hover:bg-red-600 group-hover:text-white">
                  <AlertCircle className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
                  Attention
                </span>
              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Damaged Items
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {loading
                  ? "—"
                  : damagedCount.toLocaleString()}
              </p>
            </div>
          </section>

          {/* =================================================
              FILTERS
          ================================================= */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              {/* Search */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search asset tag, item name, serial number, location..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="hidden items-center gap-2 px-1 text-sm font-bold text-slate-500 xl:flex">
                <Filter className="h-4 w-4" />
                Filters
              </div>

              {/* Category */}
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">All Categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">All Statuses</option>

                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {/* Condition */}
              <select
                value={conditionFilter}
                onChange={(event) => {
                  setConditionFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">All Conditions</option>

                {conditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>

              {(searchTerm ||
                categoryFilter !== "all" ||
                statusFilter !== "all" ||
                conditionFilter !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              INVENTORY TABLE
          ================================================= */}

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table Header */}
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Inventory Items
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredInventory.length} matching item
                  {filteredInventory.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                Page {currentPage} of {totalPages}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      "Asset",
                      "Category",
                      "Serial Number",
                      "Quantity",
                      "Location",
                      "Condition",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className={`px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 ${
                          heading === "Actions"
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 7 }).map(
                      (_, index) => (
                        <tr key={index}>
                          {Array.from({ length: 8 }).map(
                            (__, cell) => (
                              <td
                                key={cell}
                                className="px-5 py-5"
                              >
                                <div
                                  className={`h-4 animate-pulse rounded-lg bg-slate-100 ${
                                    cell === 0
                                      ? "w-48"
                                      : "w-24"
                                  }`}
                                />
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )
                  ) : paginatedInventory.length > 0 ? (
                    paginatedInventory.map(
                      (item, index) => {
                        const itemId =
                          item.id ||
                          item._id ||
                          item.inventoryId ||
                          `${index}`;

                        return (
                          <tr
                            key={itemId}
                            className="group transition-colors hover:bg-blue-50/40"
                          >
                            {/* Asset */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                                  <Package className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="max-w-[220px] truncate text-sm font-bold text-slate-800">
                                    {item.itemName ||
                                      item.name ||
                                      "Unnamed Item"}
                                  </p>

                                  <p className="mt-1 font-mono text-[11px] font-medium text-slate-400">
                                    {item.assetTag ||
                                      "NO ASSET TAG"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-700">
                                {item.category || "—"}
                              </p>

                              {item.subCategory && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {item.subCategory}
                                </p>
                              )}
                            </td>

                            {/* Serial */}
                            <td className="px-5 py-4">
                              <span className="rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                                {item.serialNumber ||
                                  "—"}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="px-5 py-4">
                              <span className="text-sm font-black text-slate-800">
                                {item.quantity ?? 0}
                              </span>

                              <span className="ml-1 text-xs font-medium text-slate-400">
                                {item.unit || "Piece"}
                              </span>
                            </td>

                            {/* Location */}
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-700">
                                {item.location || "—"}
                              </p>

                              {item.department && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {item.department}
                                </p>
                              )}
                            </td>

                            {/* Condition */}
                            <td className="px-5 py-4">
                              <span
                                className={`text-sm font-bold ${getConditionClass(
                                  item.condition
                                )}`}
                              >
                                {item.condition || "—"}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                                  item.status
                                )}`}
                              >
                                {item.status ||
                                  "Unknown"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  title="View"
                                  aria-label="View inventory item"
                                  onClick={() =>
                                    openViewModal(item)
                                  }
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-100 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  title="Edit"
                                  aria-label="Edit inventory item"
                                  onClick={() =>
                                    openEditModal(item)
                                  }
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-amber-100 hover:text-amber-600"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  title="Delete"
                                  aria-label="Delete inventory item"
                                  disabled={deleting}
                                  onClick={() =>
                                    handleDelete(item)
                                  }
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
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
                        className="px-5 py-20"
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <Archive className="h-8 w-8" />
                          </div>

                          <h3 className="mt-5 text-base font-bold text-slate-700">
                            No inventory items found
                          </h3>

                          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                            No inventory records match your
                            current filters. Try changing the
                            filters or add a new inventory
                            item.
                          </p>

                          <button
                            type="button"
                            onClick={openAddModal}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                          >
                            <Plus className="h-4 w-4" />
                            Add Inventory
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
              <p className="text-xs font-medium text-slate-500">
                {filteredInventory.length > 0
                  ? `Showing ${
                      (currentPage - 1) *
                        itemsPerPage +
                      1
                    }–${Math.min(
                      currentPage * itemsPerPage,
                      filteredInventory.length
                    )} of ${
                      filteredInventory.length
                    }`
                  : "Showing 0 items"}
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                )
                  .slice(
                    Math.max(0, currentPage - 3),
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
                      className={`h-9 min-w-9 rounded-xl px-2 text-sm font-bold transition ${
                        currentPage === page
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =====================================================
          MODAL
      ===================================================== */}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          {/* Overlay */}
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 cursor-default"
            onClick={closeModal}
          />

          <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  {modalMode === "view" ? (
                    <Eye className="h-5 w-5" />
                  ) : modalMode === "edit" ? (
                    <Edit className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900">
                    {modalMode === "add" &&
                      "Add Inventory Item"}

                    {modalMode === "edit" &&
                      "Edit Inventory Item"}

                    {modalMode === "view" &&
                      "Inventory Details"}
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {modalMode === "view"
                      ? "Review inventory item information."
                      : "Enter the inventory information below."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* =================================================
                VIEW MODE
            ================================================= */}

            {modalMode === "view" ? (
              <div className="overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Asset Tag", selectedItem?.assetTag],
                    [
                      "Item Name",
                      selectedItem?.itemName ||
                        selectedItem?.name,
                    ],
                    ["Category", selectedItem?.category],
                    [
                      "Sub Category",
                      selectedItem?.subCategory,
                    ],
                    [
                      "Serial Number",
                      selectedItem?.serialNumber,
                    ],
                    [
                      "Quantity",
                      selectedItem?.quantity,
                    ],
                    ["Unit", selectedItem?.unit],
                    [
                      "Location",
                      selectedItem?.location,
                    ],
                    [
                      "Department",
                      selectedItem?.department,
                    ],
                    [
                      "Condition",
                      selectedItem?.condition,
                    ],
                    ["Status", selectedItem?.status],
                    [
                      "Purchase Date",
                      selectedItem?.purchaseDate
                        ? String(
                            selectedItem.purchaseDate
                          ).slice(0, 10)
                        : "",
                    ],
                    [
                      "Purchase Price",
                      selectedItem?.purchasePrice
                        ? Number(
                            selectedItem.purchasePrice
                          ).toLocaleString()
                        : "",
                    ],
                    [
                      "Supplier",
                      selectedItem?.supplier,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-100 hover:bg-blue-50/30"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {label}
                      </p>

                      <p className="mt-2 break-words text-sm font-bold text-slate-800">
                        {value || "—"}
                      </p>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Description
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedItem?.description ||
                        "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* =================================================
                 ADD / EDIT MODE
              ================================================= */

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="overflow-y-auto p-5 sm:p-6">
                  <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <Archive className="h-4 w-4" />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-blue-900">
                          Inventory Information
                        </p>

                        <p className="mt-1 text-xs leading-5 text-blue-700">
                          Provide accurate asset, location,
                          condition and purchasing information
                          for university inventory records.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Asset Tag */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Asset Tag
                      </label>

                      <input
                        type="text"
                        name="assetTag"
                        value={formData.assetTag}
                        onChange={handleChange}
                        placeholder="e.g. ICT-INV-0001"
                        className={inputClass}
                      />
                    </div>

                    {/* Item Name */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Item Name
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      </label>

                      <input
                        type="text"
                        name="itemName"
                        value={formData.itemName}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Desktop Computer"
                        className={inputClass}
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Category
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      </label>

                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className={selectClass}
                      >
                        <option value="">
                          Select category
                        </option>
                        <option value="Computer">
                          Computer
                        </option>
                        <option value="Laptop">
                          Laptop
                        </option>
                        <option value="Monitor">
                          Monitor
                        </option>
                        <option value="Printer">
                          Printer
                        </option>
                        <option value="Network Equipment">
                          Network Equipment
                        </option>
                        <option value="Server">
                          Server
                        </option>
                        <option value="Mobile Device">
                          Mobile Device
                        </option>
                        <option value="Peripheral">
                          Peripheral
                        </option>
                        <option value="Software">
                          Software
                        </option>
                        <option value="Other">
                          Other
                        </option>
                      </select>
                    </div>

                    {/* Sub Category */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Sub Category
                      </label>

                      <input
                        type="text"
                        name="subCategory"
                        value={formData.subCategory}
                        onChange={handleChange}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </div>

                    {/* Serial */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Serial Number
                      </label>

                      <input
                        type="text"
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleChange}
                        placeholder="Enter serial number"
                        className={inputClass}
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Quantity
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      </label>

                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        min="0"
                        required
                        className={inputClass}
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Unit
                      </label>

                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="Piece">
                          Piece
                        </option>
                        <option value="Set">Set</option>
                        <option value="Box">Box</option>
                        <option value="Pack">Pack</option>
                        <option value="Unit">Unit</option>
                      </select>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Location
                      </label>

                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g. ICT Store"
                        className={inputClass}
                      />
                    </div>

                    {/* Department */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Department
                      </label>

                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        placeholder="e.g. ICT Directorate"
                        className={inputClass}
                      />
                    </div>

                    {/* Condition */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Condition
                      </label>

                      <select
                        name="condition"
                        value={formData.condition}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="New">
                          New
                        </option>
                        <option value="Excellent">
                          Excellent
                        </option>
                        <option value="Good">
                          Good
                        </option>
                        <option value="Fair">
                          Fair
                        </option>
                        <option value="Poor">
                          Poor
                        </option>
                        <option value="Damaged">
                          Damaged
                        </option>
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Status
                      </label>

                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="Available">
                          Available
                        </option>
                        <option value="Assigned">
                          Assigned
                        </option>
                        <option value="In Stock">
                          In Stock
                        </option>
                        <option value="Maintenance">
                          Maintenance
                        </option>
                        <option value="Damaged">
                          Damaged
                        </option>
                        <option value="Retired">
                          Retired
                        </option>
                      </select>
                    </div>

                    {/* Purchase Date */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Purchase Date
                      </label>

                      <input
                        type="date"
                        name="purchaseDate"
                        value={formData.purchaseDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    {/* Purchase Price */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Purchase Price
                      </label>

                      <input
                        type="number"
                        name="purchasePrice"
                        value={formData.purchasePrice}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={inputClass}
                      />
                    </div>

                    {/* Supplier */}
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Supplier
                      </label>

                      <input
                        type="text"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleChange}
                        placeholder="Supplier name"
                        className={inputClass}
                      />
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Description
                      </label>

                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows="4"
                        placeholder="Additional inventory information..."
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    )}

                    {modalMode === "add"
                      ? saving
                        ? "Adding..."
                        : "Add Inventory"
                      : saving
                      ? "Saving..."
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

export default Inventory;
