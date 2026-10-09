import React, { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../utils/api";

const API_BASE = `${apiBase()}/api/asset-categories`;

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  status: "Active",
};

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function normalizeCategory(item, index = 0) {
  return {
    id:
      item?.id ??
      item?.categoryId ??
      item?.assetCategoryId ??
      item?._id ??
      `category-${index}`,
    name: item?.name ?? item?.categoryName ?? "",
    code: item?.code ?? item?.categoryCode ?? "",
    description: item?.description ?? "",
    status:
      item?.status ??
      (item?.isActive === false ? "Inactive" : "Active"),
    assetCount:
      item?.assetCount ??
      item?.assetsCount ??
      item?.totalAssets ??
      item?.asset_count ??
      0,
    createdAt: item?.createdAt ?? item?.created_at ?? null,
    updatedAt: item?.updatedAt ?? item?.updated_at ?? null,
    raw: item,
  };
}

function extractCategories(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.categories)) {
    return data.categories;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function getStatusClass(status) {
  return String(status).toLowerCase() === "active"
    ? "status-active"
    : "status-inactive";
}

export default function AssetCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryAssets, setCategoryAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetError, setAssetError] = useState("");

  const loadCategories = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(API_BASE);

      const normalized = extractCategories(response).map(
        normalizeCategory
      );

      setCategories(normalized);
    } catch (err) {
      setError(err.message || "Unable to load asset categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.name.toLowerCase().includes(query) ||
        category.code.toLowerCase().includes(query) ||
        category.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        String(category.status).toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCount = useMemo(
    () =>
      categories.filter(
        (category) =>
          String(category.status).toLowerCase() === "active"
      ).length,
    [categories]
  );

  const inactiveCount = useMemo(
    () =>
      categories.filter(
        (category) =>
          String(category.status).toLowerCase() !== "active"
      ).length,
    [categories]
  );

  const totalAssets = useMemo(
    () =>
      categories.reduce(
        (total, category) =>
          total + Number(category.assetCount || 0),
        0
      ),
    [categories]
  );

  const openCreateForm = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (category) => {
    setEditingCategory(category);

    setForm({
      name: category.name || "",
      code: category.code || "",
      description: category.description || "",
      status:
        String(category.status).toLowerCase() === "inactive"
          ? "Inactive"
          : "Active",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Category name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        status: form.status,
        isActive: form.status === "Active",
      };

      if (editingCategory) {
        await apiRequest(
          `${API_BASE}/${encodeURIComponent(editingCategory.id)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(API_BASE, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (category) => {
    const isActive =
      String(category.status).toLowerCase() === "active";

    const nextStatus = isActive ? "Inactive" : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Active" ? "Activate" : "Deactivate"} "${
        category.name
      }"?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${API_BASE}/${encodeURIComponent(category.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: category.name,
            code: category.code,
            description: category.description,
            status: nextStatus,
            isActive: nextStatus === "Active",
          }),
        }
      );

      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to update category status.");
    }
  };

  const deleteCategory = async (category) => {
    if (Number(category.assetCount || 0) > 0) {
      window.alert(
        "This category contains assets and cannot be deleted until those assets are reassigned."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${category.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(
        `${API_BASE}/${encodeURIComponent(category.id)}`,
        {
          method: "DELETE",
        }
      );

      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to delete category.");
    }
  };

  const viewAssets = async (category) => {
    setSelectedCategory(category);
    setCategoryAssets([]);
    setAssetError("");
    setLoadingAssets(true);

    try {
      const response = await apiRequest(
        `${API_BASE}/${encodeURIComponent(category.id)}/assets`
      );

      const assets =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.assets)
          ? response.assets
          : Array.isArray(response?.data)
          ? response.data
          : [];

      setCategoryAssets(assets);
    } catch (err) {
      setAssetError(
        err.message || "Unable to load assets in this category."
      );
    } finally {
      setLoadingAssets(false);
    }
  };

  const closeAssets = () => {
    setSelectedCategory(null);
    setCategoryAssets([]);
    setAssetError("");
  };

  return (
    <div className="asset-categories-page">
      <style>{`
        .asset-categories-page {
          min-height: 100%;
          background: #f3f6f9;
          padding: 24px;
          color: #111827;
          box-sizing: border-box;
        }

        .categories-container {
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

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .primary-button {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          padding: 11px 17px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #1d4ed8;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .summary-label {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .summary-value {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .search-input,
        .filter-select {
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 10px 12px;
          font-size: 14px;
          background: white;
          color: #111827;
          outline: none;
        }

        .search-input {
          flex: 1;
          min-width: 220px;
        }

        .search-input:focus,
        .filter-select:focus,
        .form-input:focus,
        .form-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .refresh-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 7px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .categories-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .categories-table th {
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          padding: 13px 16px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .categories-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #eef2f7;
          font-size: 14px;
          vertical-align: middle;
        }

        .categories-table tr:last-child td {
          border-bottom: 0;
        }

        .category-name {
          font-weight: 600;
          color: #111827;
        }

        .category-description {
          color: #64748b;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .code-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 6px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-active {
          background: #dcfce7;
          color: #166534;
        }

        .status-inactive {
          background: #f1f5f9;
          color: #475569;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .action-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 6px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .action-button:hover {
          background: #f8fafc;
        }

        .action-button.primary {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .action-button.danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 12px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .empty-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .loading-state {
          padding: 50px 20px;
          text-align: center;
          color: #64748b;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(620px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
        }

        .modal.large {
          width: min(900px, 100%);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: 0;
          background: #f1f5f9;
          border-radius: 7px;
          cursor: pointer;
          font-size: 18px;
          color: #475569;
        }

        .form {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .secondary-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          border-radius: 7px;
          padding: 10px 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .asset-list {
          padding: 20px;
        }

        .asset-table {
          width: 100%;
          border-collapse: collapse;
        }

        .asset-table th,
        .asset-table td {
          text-align: left;
          padding: 11px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
        }

        .asset-table th {
          background: #f8fafc;
          color: #475569;
        }

        @media (max-width: 850px) {
          .asset-categories-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            min-width: 0;
          }

          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="categories-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Asset Categories</h1>
            <p className="page-subtitle">
              Manage university asset categories and their classification.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Add Category
          </button>
        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Total Categories</div>
            <div className="summary-value">
              {categories.length}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Active Categories</div>
            <div className="summary-value">
              {activeCount}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Assets in Categories</div>
            <div className="summary-value">
              {totalAssets}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search category name, code or description..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadCategories}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading asset categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 30, marginBottom: 10 }}>
                📂
              </div>

              <strong>
                {search || statusFilter !== "All"
                  ? "No matching categories"
                  : "No asset categories found"}
              </strong>

              <div style={{ marginTop: 7 }}>
                {search || statusFilter !== "All"
                  ? "Try changing your search or filter."
                  : "Create the first asset category to get started."}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="categories-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Assets</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className="category-name">
                          {category.name || "Unnamed Category"}
                        </div>
                      </td>

                      <td>
                        {category.code ? (
                          <span className="code-badge">
                            {category.code}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <div className="category-description">
                          {category.description || "No description"}
                        </div>
                      </td>

                      <td>
                        <strong>
                          {Number(category.assetCount || 0)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            category.status
                          )}`}
                        >
                          {category.status}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          category.updatedAt || category.createdAt
                        )}
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="action-button primary"
                            onClick={() => viewAssets(category)}
                          >
                            Assets
                          </button>

                          <button
                            type="button"
                            className="action-button"
                            onClick={() => openEditForm(category)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="action-button"
                            onClick={() => toggleStatus(category)}
                          >
                            {String(category.status).toLowerCase() ===
                            "active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            className="action-button danger"
                            onClick={() => deleteCategory(category)}
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

        <div
          style={{
            marginTop: 12,
            color: "#64748b",
            fontSize: 13,
          }}
        >
          Showing {filteredCategories.length} of{" "}
          {categories.length} categories
          {inactiveCount > 0
            ? ` • ${inactiveCount} inactive`
            : ""}
        </div>
      </div>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCategory
                  ? "Edit Asset Category"
                  : "Add Asset Category"}
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Category Name *
                  </label>

                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Laboratory Equipment"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Category Code
                  </label>

                  <input
                    type="text"
                    name="code"
                    className="form-input"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="e.g. LAB-EQP"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Description
                </label>

                <textarea
                  name="description"
                  className="form-textarea"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the category..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Status
                </label>

                <select
                  name="status"
                  className="form-input"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                    ? "Save Changes"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCategory && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAssets();
            }
          }}
        >
          <div className="modal large">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {selectedCategory.name}
                </h2>

                <div
                  style={{
                    marginTop: 4,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  Assets assigned to this category
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeAssets}
              >
                ×
              </button>
            </div>

            <div className="asset-list">
              {loadingAssets ? (
                <div className="loading-state">
                  Loading category assets...
                </div>
              ) : assetError ? (
                <div className="error-box">
                  {assetError}
                </div>
              ) : categoryAssets.length === 0 ? (
                <div className="empty-state">
                  No assets are currently assigned to this category.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="asset-table">
                    <thead>
                      <tr>
                        <th>Asset ID</th>
                        <th>Name</th>
                        <th>Serial Number</th>
                        <th>Status</th>
                        <th>Location</th>
                      </tr>
                    </thead>

                    <tbody>
                      {categoryAssets.map((asset, index) => (
                        <tr
                          key={
                            asset?.assetId ??
                            asset?.id ??
                            `asset-${index}`
                          }
                        >
                          <td>
                            {asset?.assetId ??
                              asset?.id ??
                              "—"}
                          </td>

                          <td>
                            {asset?.name ??
                              asset?.assetName ??
                              "—"}
                          </td>

                          <td>
                            {asset?.serialNumber ??
                              asset?.serial_number ??
                              "—"}
                          </td>

                          <td>
                            {asset?.status ??
                              asset?.condition ??
                              "—"}
                          </td>

                          <td>
                            {asset?.locationName ??
                              asset?.location ??
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeAssets}
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