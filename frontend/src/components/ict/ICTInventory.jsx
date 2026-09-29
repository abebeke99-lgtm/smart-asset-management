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
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

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
          // Try next endpoint.
        }
      }

      if (result) {
        setInventory(normalizeItems(result));
      }
    } catch (err) {
      console.error(err);

      setError(
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

  const categories = useMemo(() => {
    const values = inventory
      .map((item) => item.category)
      .filter(Boolean);

    return [...new Set(values)];
  }, [inventory]);

  const statuses = useMemo(() => {
    const values = inventory
      .map((item) => item.status)
      .filter(Boolean);

    return [...new Set(values)];
  }, [inventory]);

  const conditions = useMemo(() => {
    const values = inventory
      .map((item) => item.condition)
      .filter(Boolean);

    return [...new Set(values)];
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
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
      await loadInventory(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Unable to save inventory item."
      );
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        item.itemName || item.name || "this item"
      }"?`
    );

    if (!confirmed) return;

    try {
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

      setError(
        err.message || "Unable to delete inventory item."
      );
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setConditionFilter("all");
    setCurrentPage(1);
  };

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

    const csv = [
      headers,
      ...rows,
    ]
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

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (
      value.includes("available") ||
      value.includes("active") ||
      value.includes("in stock")
    ) {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (
      value.includes("assigned") ||
      value.includes("issued")
    ) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    if (
      value.includes("maintenance") ||
      value.includes("repair")
    ) {
      return "bg-orange-50 text-orange-700 border-orange-200";
    }

    if (
      value.includes("damaged") ||
      value.includes("lost") ||
      value.includes("retired")
    ) {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getConditionClass = (condition) => {
    const value = String(condition || "").toLowerCase();

    if (
      value.includes("excellent") ||
      value.includes("good")
    ) {
      return "text-green-700";
    }

    if (value.includes("fair")) {
      return "text-yellow-700";
    }

    if (
      value.includes("poor") ||
      value.includes("damaged")
    ) {
      return "text-red-700";
    }

    return "text-slate-600";
  };

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Archive className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Inventory
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage ICT inventory items, stock levels, locations,
                    conditions, and availability.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadInventory(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Inventory
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

        {/* Summary Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Package className="h-5 w-5" />
              </div>

              <span className="text-xs font-medium text-slate-400">
                Items
              </span>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Total Inventory
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading ? "—" : totalQuantity.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <span className="text-xs font-medium text-green-600">
                Available
              </span>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Available Items
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading ? "—" : availableCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <RefreshCw className="h-5 w-5" />
              </div>

              <span className="text-xs font-medium text-orange-600">
                Service
              </span>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Maintenance
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading ? "—" : maintenanceCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>

              <span className="text-xs font-medium text-red-600">
                Attention
              </span>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Damaged Items
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading ? "—" : damagedCount.toLocaleString()}
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
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search asset tag, item name, serial number, location..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Filter className="h-4 w-4" />
              Filters
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Categories</option>

              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Statuses</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={conditionFilter}
              onChange={(event) => {
                setConditionFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                Inventory Items
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Showing {filteredInventory.length} matching item
                {filteredInventory.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Category
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Serial Number
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Quantity
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Condition
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
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 8 }).map((__, cell) => (
                        <td key={cell} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedInventory.length > 0 ? (
                  paginatedInventory.map((item, index) => {
                    const itemId =
                      item.id ||
                      item._id ||
                      item.inventoryId ||
                      `${index}`;

                    return (
                      <tr
                        key={itemId}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Package className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {item.itemName ||
                                  item.name ||
                                  "Unnamed Item"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {item.assetTag || "No asset tag"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm text-slate-700">
                              {item.category || "—"}
                            </p>

                            {item.subCategory && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {item.subCategory}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-slate-600">
                            {item.serialNumber || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-slate-800">
                            {item.quantity ?? 0}
                          </span>

                          <span className="ml-1 text-xs text-slate-400">
                            {item.unit || "Piece"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">
                            {item.location || "—"}
                          </p>

                          {item.department && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {item.department}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`text-sm font-medium ${getConditionClass(
                              item.condition
                            )}`}
                          >
                            {item.condition || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "Unknown"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="View"
                              onClick={() =>
                                openViewModal(item)
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                openEditModal(item)
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              title="Delete"
                              onClick={() =>
                                handleDelete(item)
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Archive className="h-7 w-7" />
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-slate-700">
                          No inventory items found
                        </h3>

                        <p className="mt-1 max-w-sm text-xs text-slate-400">
                          Try changing your filters or add a new inventory
                          item to the system.
                        </p>

                        <button
                          type="button"
                          onClick={openAddModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
            <p className="text-xs text-slate-500">
              {filteredInventory.length > 0
                ? `Showing ${
                    (currentPage - 1) * itemsPerPage + 1
                  }–${Math.min(
                    currentPage * itemsPerPage,
                    filteredInventory.length
                  )} of ${filteredInventory.length}`
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              )
                .slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                )
                .map((page) => (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition ${
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
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Add / Edit / View Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setShowModal(false)}
          />

          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {modalMode === "add" && "Add Inventory Item"}
                  {modalMode === "edit" && "Edit Inventory Item"}
                  {modalMode === "view" && "Inventory Details"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {modalMode === "view"
                    ? "Review inventory item information."
                    : "Enter the inventory information below."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === "view" ? (
              <div className="max-h-[75vh] overflow-y-auto p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {[
                    ["Asset Tag", selectedItem?.assetTag],
                    [
                      "Item Name",
                      selectedItem?.itemName ||
                        selectedItem?.name,
                    ],
                    ["Category", selectedItem?.category],
                    ["Sub Category", selectedItem?.subCategory],
                    [
                      "Serial Number",
                      selectedItem?.serialNumber,
                    ],
                    ["Quantity", selectedItem?.quantity],
                    ["Unit", selectedItem?.unit],
                    ["Location", selectedItem?.location],
                    ["Department", selectedItem?.department],
                    ["Condition", selectedItem?.condition],
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
                    ["Supplier", selectedItem?.supplier],
                  ].map(([label, value]) => (
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
                  ))}

                  <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Description
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedItem?.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="max-h-[75vh] overflow-y-auto"
              >
                <div className="grid gap-5 p-6 md:grid-cols-2">
                  {/* Asset Tag */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Asset Tag
                    </label>

                    <input
                      type="text"
                      name="assetTag"
                      value={formData.assetTag}
                      onChange={handleChange}
                      placeholder="e.g. ICT-INV-0001"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Item Name *
                    </label>

                    <input
                      type="text"
                      name="itemName"
                      value={formData.itemName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Desktop Computer"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Category *
                    </label>

                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select category</option>
                      <option value="Computer">
                        Computer
                      </option>
                      <option value="Laptop">Laptop</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Printer">Printer</option>
                      <option value="Network Equipment">
                        Network Equipment
                      </option>
                      <option value="Server">Server</option>
                      <option value="Mobile Device">
                        Mobile Device
                      </option>
                      <option value="Peripheral">
                        Peripheral
                      </option>
                      <option value="Software">
                        Software
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Sub Category */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Sub Category
                    </label>

                    <input
                      type="text"
                      name="subCategory"
                      value={formData.subCategory}
                      onChange={handleChange}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Serial Number
                    </label>

                    <input
                      type="text"
                      name="serialNumber"
                      value={formData.serialNumber}
                      onChange={handleChange}
                      placeholder="Enter serial number"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Quantity *
                    </label>

                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      min="0"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Unit
                    </label>

                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Piece">Piece</option>
                      <option value="Set">Set</option>
                      <option value="Box">Box</option>
                      <option value="Pack">Pack</option>
                      <option value="Unit">Unit</option>
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Location
                    </label>

                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g. ICT Store"
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
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="e.g. ICT Directorate"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Condition */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Condition
                    </label>

                    <select
                      name="condition"
                      value={formData.condition}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="New">New</option>
                      <option value="Excellent">
                        Excellent
                      </option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Status
                    </label>

                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      <option value="Retired">Retired</option>
                    </select>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Purchase Date
                    </label>

                    <input
                      type="date"
                      name="purchaseDate"
                      value={formData.purchaseDate}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Purchase Price */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Supplier */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Supplier
                    </label>

                    <input
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      placeholder="Supplier name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Description
                    </label>

                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Additional inventory information..."
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    {modalMode === "add"
                      ? "Add Inventory"
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