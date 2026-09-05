import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { apiClient } from "../../utils/api";
import { useLanguage } from "../../contexts/UiContext";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  AlertCircle,
  Building2,
  Users,
  Package,
  MapPin,
  UserCheck,
  RefreshCw,
  Eye,
  Save,
} from "lucide-react";

const AdminDepartmentManagement = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === "dark";

  const t = language === "en" ? englishTranslations : amharicTranslations;

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    head: "",
    location: "",
    building: "",
    floor: "",
    room: "",
    phone: "",
    email: "",
    status: "active",
  });

  /* =========================================================
     HELPERS
  ========================================================= */

  const normalizeArray = (response, keys = []) => {
    const responseData = response?.data;

    if (Array.isArray(responseData)) {
      return responseData;
    }

    for (const key of keys) {
      if (Array.isArray(responseData?.[key])) {
        return responseData[key];
      }

      if (Array.isArray(responseData?.data?.[key])) {
        return responseData.data[key];
      }
    }

    if (Array.isArray(responseData?.data)) {
      return responseData.data;
    }

    return [];
  };

  const getDepartmentId = (department) => {
    return department?.id || department?._id || department?.department_id;
  };

  const getDepartmentName = (department) => {
    return (
      department?.name ||
      department?.department_name ||
      department?.title ||
      "-"
    );
  };

  const getDepartmentCode = (department) => {
    return department?.code || department?.department_code || "-";
  };

  const getDepartmentStatus = (department) => {
    if (
      department?.status === "inactive" ||
      department?.active === false ||
      department?.is_active === false
    ) {
      return "inactive";
    }

    return "active";
  };

  const getUserName = (user) => {
    return (
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      user?.username ||
      "-"
    );
  };

  const getAssetDepartment = (asset) => {
    return (
      asset?.department ||
      asset?.department_name ||
      asset?.departmentName ||
      asset?.department_id ||
      ""
    );
  };

  /* =========================================================
     FETCH DEPARTMENTS
  ========================================================= */

  const fetchDepartments = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiClient.get("/api/departments");

      const data = normalizeArray(response, [
        "departments",
        "items",
        "results",
      ]);

      setDepartments(data);
    } catch (error) {
      console.error("Failed to load departments:", error);

      const message =
        error?.response?.data?.message || t.loadFailed;

      toast.error(message);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  /* =========================================================
     FETCH USERS
  ========================================================= */

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/users");

      const data = normalizeArray(response, [
        "users",
        "items",
        "results",
      ]);

      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
    }
  }, []);

  /* =========================================================
     FETCH ASSETS
  ========================================================= */

  const fetchAssets = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/assets");

      const data = normalizeArray(response, [
        "assets",
        "items",
        "results",
      ]);

      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets:", error);
      setAssets([]);
    }
  }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
    fetchAssets();
  }, [fetchDepartments, fetchUsers, fetchAssets]);

  /* =========================================================
     DEPARTMENT USERS
  ========================================================= */

  const getDepartmentUsers = useCallback(
    (department) => {
      const departmentId = String(getDepartmentId(department) || "");
      const departmentName = getDepartmentName(department).toLowerCase();

      return users.filter((user) => {
        const userDepartmentId = String(
          user?.department_id ||
            user?.departmentId ||
            user?.department?.id ||
            ""
        );

        const userDepartmentName = String(
          user?.department ||
            user?.department_name ||
            user?.departmentName ||
            user?.department?.name ||
            ""
        ).toLowerCase();

        return (
          (departmentId && userDepartmentId === departmentId) ||
          (departmentName && userDepartmentName === departmentName)
        );
      });
    },
    [users]
  );

  /* =========================================================
     DEPARTMENT ASSETS
  ========================================================= */

  const getDepartmentAssets = useCallback(
    (department) => {
      const departmentId = String(getDepartmentId(department) || "");
      const departmentName = getDepartmentName(department).toLowerCase();

      return assets.filter((asset) => {
        const assetDepartmentId = String(
          asset?.department_id ||
            asset?.departmentId ||
            asset?.department?.id ||
            ""
        );

        const assetDepartmentName =
          String(getAssetDepartment(asset)).toLowerCase();

        return (
          (departmentId && assetDepartmentId === departmentId) ||
          (departmentName &&
            assetDepartmentName === departmentName)
        );
      });
    },
    [assets]
  );

  /* =========================================================
     DEPARTMENT HEAD
  ========================================================= */

  const getDepartmentHead = useCallback(
    (department) => {
      const departmentId = String(getDepartmentId(department) || "");
      const departmentName = getDepartmentName(department).toLowerCase();

      const explicitHeadId = String(
        department?.head_id ||
          department?.headId ||
          department?.department_head_id ||
          ""
      );

      const explicitHeadName = String(
        department?.head ||
          department?.head_name ||
          department?.department_head ||
          ""
      ).toLowerCase();

      const head = users.find((user) => {
        const userId = String(user?.id || user?._id || "");
        const userName = getUserName(user).toLowerCase();

        const userDepartmentId = String(
          user?.department_id ||
            user?.departmentId ||
            user?.department?.id ||
            ""
        );

        const userDepartmentName = String(
          user?.department ||
            user?.department_name ||
            user?.departmentName ||
            user?.department?.name ||
            ""
        ).toLowerCase();

        const isDepartmentHead =
          user?.role === "department_head" ||
          user?.role === "department head";

        const sameDepartment =
          (departmentId && userDepartmentId === departmentId) ||
          (departmentName &&
            userDepartmentName === departmentName);

        return (
          (explicitHeadId && userId === explicitHeadId) ||
          (explicitHeadName && userName === explicitHeadName) ||
          (isDepartmentHead && sameDepartment)
        );
      });

      return head || null;
    },
    [users]
  );

  /* =========================================================
     FILTERED DEPARTMENTS
  ========================================================= */

  const filteredDepartments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return departments.filter((department) => {
      const name = getDepartmentName(department).toLowerCase();
      const code = getDepartmentCode(department).toLowerCase();
      const description = String(
        department?.description || ""
      ).toLowerCase();
      const location = String(
        department?.location || department?.building || ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        code.includes(query) ||
        description.includes(query) ||
        location.includes(query);

      const matchesStatus =
        !statusFilter ||
        getDepartmentStatus(department) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [departments, searchQuery, statusFilter]);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const statistics = useMemo(() => {
    const total = departments.length;

    const active = departments.filter(
      (department) =>
        getDepartmentStatus(department) === "active"
    ).length;

    const inactive = departments.filter(
      (department) =>
        getDepartmentStatus(department) === "inactive"
    ).length;

    const totalDepartmentUsers = departments.reduce(
      (sum, department) =>
        sum + getDepartmentUsers(department).length,
      0
    );

    const totalDepartmentAssets = departments.reduce(
      (sum, department) =>
        sum + getDepartmentAssets(department).length,
      0
    );

    const heads = departments.filter(
      (department) => getDepartmentHead(department)
    ).length;

    const locations = departments.filter(
      (department) =>
        department?.location ||
        department?.building ||
        department?.room
    ).length;

    return {
      total,
      active,
      inactive,
      totalDepartmentUsers,
      totalDepartmentAssets,
      heads,
      locations,
    };
  }, [
    departments,
    getDepartmentAssets,
    getDepartmentHead,
    getDepartmentUsers,
  ]);

  /* =========================================================
     FORM HANDLING
  ========================================================= */

  const updateForm = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (formErrors[field]) {
      setFormErrors((previous) => ({
        ...previous,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = t.nameRequired;
    }

    if (!formData.code.trim()) {
      errors.code = t.codeRequired;
    }

    if (!formData.description.trim()) {
      errors.description = t.descriptionRequired;
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      head: "",
      location: "",
      building: "",
      floor: "",
      room: "",
      phone: "",
      email: "",
      status: "active",
    });

    setFormErrors({});
  };

  /* =========================================================
     CREATE DEPARTMENT
  ========================================================= */

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      await apiClient.post("/api/departments", {
        name: formData.name.trim(),
        code: formData.code.trim(),
        description: formData.description.trim(),
        head: formData.head || "",
        location: formData.location.trim(),
        building: formData.building.trim(),
        floor: formData.floor.trim(),
        room: formData.room.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        status: formData.status,
        active: formData.status === "active",
      });

      toast.success(t.createSuccess);

      setShowCreate(false);
      resetForm();

      await fetchDepartments();
    } catch (error) {
      console.error("Create department error:", error);

      toast.error(
        error?.response?.data?.message || t.createFailed
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     EDIT DEPARTMENT
  ========================================================= */

  const openEditModal = (department) => {
    setSelectedDepartment(department);

    setFormData({
      name: getDepartmentName(department) === "-" 
        ? "" 
        : getDepartmentName(department),

      code:
        getDepartmentCode(department) === "-"
          ? ""
          : getDepartmentCode(department),

      description: department?.description || "",

      head:
        department?.head_id ||
        department?.headId ||
        department?.head ||
        department?.department_head_id ||
        "",

      location: department?.location || "",

      building: department?.building || "",

      floor: department?.floor || "",

      room: department?.room || "",

      phone:
        department?.phone ||
        department?.phone_number ||
        "",

      email: department?.email || "",

      status: getDepartmentStatus(department),
    });

    setFormErrors({});
    setShowEdit(true);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm() || !selectedDepartment) {
      return;
    }

    const departmentId = getDepartmentId(selectedDepartment);

    if (!departmentId) {
      toast.error(t.invalidDepartment);
      return;
    }

    setSaving(true);

    try {
      await apiClient.put(`/api/departments/${departmentId}`, {
        name: formData.name.trim(),
        code: formData.code.trim(),
        description: formData.description.trim(),
        head: formData.head || "",
        location: formData.location.trim(),
        building: formData.building.trim(),
        floor: formData.floor.trim(),
        room: formData.room.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        status: formData.status,
        active: formData.status === "active",
      });

      toast.success(t.updateSuccess);

      setShowEdit(false);
      setSelectedDepartment(null);
      resetForm();

      await fetchDepartments();
    } catch (error) {
      console.error("Update department error:", error);

      toast.error(
        error?.response?.data?.message || t.updateFailed
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE DEPARTMENT
  ========================================================= */

  const handleDelete = async (department) => {
    const departmentName = getDepartmentName(department);
    const departmentId = getDepartmentId(department);

    if (!departmentId) {
      toast.error(t.invalidDepartment);
      return;
    }

    const departmentUsers = getDepartmentUsers(department);
    const departmentAssets = getDepartmentAssets(department);

    let warning = `${t.deleteConfirm} "${departmentName}"?`;

    if (
      departmentUsers.length > 0 ||
      departmentAssets.length > 0
    ) {
      warning += `\n\n${departmentUsers.length} ${t.users} / ${departmentAssets.length} ${t.assets}`;
    }

    if (!window.confirm(warning)) {
      return;
    }

    try {
      await apiClient.delete(
        `/api/departments/${departmentId}`
      );

      toast.success(t.deleteSuccess);

      await fetchDepartments();
    } catch (error) {
      console.error("Delete department error:", error);

      toast.error(
        error?.response?.data?.message || t.deleteFailed
      );
    }
  };

  /* =========================================================
     DETAILS MODAL
  ========================================================= */

  const openDetails = (department) => {
    setSelectedDepartment(department);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedDepartment(null);
  };

  const closeCreate = () => {
    setShowCreate(false);
    resetForm();
  };

  const closeEdit = () => {
    setShowEdit(false);
    setSelectedDepartment(null);
    resetForm();
  };

  /* =========================================================
     REFRESH
  ========================================================= */

  const refreshAll = async () => {
    await Promise.all([
      fetchDepartments(),
      fetchUsers(),
      fetchAssets(),
    ]);

    toast.success(t.refreshed);
  };

  /* =========================================================
     DEPARTMENT FORM
  ========================================================= */

  const renderDepartmentForm = (isEdit = false) => {
    return (
      <form
        onSubmit={
          isEdit ? handleEditSubmit : handleCreateSubmit
        }
      >
        <div className="dam-form-grid">
          <div className="dam-form-group">
            <label>
              {t.departmentName} <span>*</span>
            </label>

            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                updateForm("name", event.target.value)
              }
              placeholder={t.departmentNamePlaceholder}
              className={formErrors.name ? "error" : ""}
            />

            {formErrors.name && (
              <small className="dam-error">
                {formErrors.name}
              </small>
            )}
          </div>

          <div className="dam-form-group">
            <label>
              {t.departmentCode} <span>*</span>
            </label>

            <input
              type="text"
              value={formData.code}
              onChange={(event) =>
                updateForm(
                  "code",
                  event.target.value.toUpperCase()
                )
              }
              placeholder="e.g. CSE"
              className={formErrors.code ? "error" : ""}
            />

            {formErrors.code && (
              <small className="dam-error">
                {formErrors.code}
              </small>
            )}
          </div>

          <div className="dam-form-group dam-full">
            <label>
              {t.description} <span>*</span>
            </label>

            <textarea
              value={formData.description}
              onChange={(event) =>
                updateForm(
                  "description",
                  event.target.value
                )
              }
              placeholder={t.descriptionPlaceholder}
              rows={3}
              className={
                formErrors.description ? "error" : ""
              }
            />

            {formErrors.description && (
              <small className="dam-error">
                {formErrors.description}
              </small>
            )}
          </div>

          <div className="dam-form-group">
            <label>{t.departmentHead}</label>

            <select
              value={formData.head}
              onChange={(event) =>
                updateForm("head", event.target.value)
              }
            >
              <option value="">
                {t.selectHead}
              </option>

              {users
                .filter(
                  (user) =>
                    user?.role === "department_head" ||
                    user?.role === "department head"
                )
                .map((user) => (
                  <option
                    key={user.id || user._id}
                    value={user.id || user._id}
                  >
                    {getUserName(user)}
                  </option>
                ))}
            </select>
          </div>

          <div className="dam-form-group">
            <label>{t.status}</label>

            <select
              value={formData.status}
              onChange={(event) =>
                updateForm("status", event.target.value)
              }
            >
              <option value="active">
                {t.active}
              </option>

              <option value="inactive">
                {t.inactive}
              </option>
            </select>
          </div>

          <div className="dam-form-group">
            <label>
              <MapPin size={15} />
              {t.location}
            </label>

            <input
              type="text"
              value={formData.location}
              onChange={(event) =>
                updateForm(
                  "location",
                  event.target.value
                )
              }
              placeholder="e.g. Main Campus"
            />
          </div>

          <div className="dam-form-group">
            <label>{t.building}</label>

            <input
              type="text"
              value={formData.building}
              onChange={(event) =>
                updateForm(
                  "building",
                  event.target.value
                )
              }
              placeholder="e.g. Engineering Building"
            />
          </div>

          <div className="dam-form-group">
            <label>{t.floor}</label>

            <input
              type="text"
              value={formData.floor}
              onChange={(event) =>
                updateForm("floor", event.target.value)
              }
              placeholder="e.g. 2nd Floor"
            />
          </div>

          <div className="dam-form-group">
            <label>{t.room}</label>

            <input
              type="text"
              value={formData.room}
              onChange={(event) =>
                updateForm("room", event.target.value)
              }
              placeholder="e.g. 204"
            />
          </div>

          <div className="dam-form-group">
            <label>{t.phone}</label>

            <input
              type="tel"
              value={formData.phone}
              onChange={(event) =>
                updateForm("phone", event.target.value)
              }
              placeholder="+251..."
            />
          </div>

          <div className="dam-form-group">
            <label>{t.email}</label>

            <input
              type="email"
              value={formData.email}
              onChange={(event) =>
                updateForm("email", event.target.value)
              }
              placeholder="department@university.edu"
            />
          </div>
        </div>

        <div className="dam-modal-actions">
          <button
            type="button"
            className="dam-btn dam-btn-secondary"
            onClick={isEdit ? closeEdit : closeCreate}
          >
            <X size={17} />
            {t.cancel}
          </button>

          <button
            type="submit"
            className="dam-btn dam-btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={17}
                  className="dam-spin"
                />
                {t.saving}
              </>
            ) : (
              <>
                {isEdit ? (
                  <Save size={17} />
                ) : (
                  <Plus size={17} />
                )}

                {isEdit ? t.saveChanges : t.createDepartment}
              </>
            )}
          </button>
        </div>
      </form>
    );
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div
        className={`dam-container ${
          isDark ? "dam-dark" : "dam-light"
        }`}
      >
        <div className="dam-loading">
          <div className="dam-spinner" />
          <p>{t.loading}</p>
        </div>

        <DepartmentStyles isDark={isDark} />
      </div>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div
      className={`dam-container ${
        isDark ? "dam-dark" : "dam-light"
      }`}
    >
      {/* HEADER */}
      <div className="dam-header">
        <div>
          <div className="dam-title-row">
            <div className="dam-title-icon">
              <Building2 size={25} />
            </div>

            <div>
              <h1>{t.departmentManagement}</h1>

              <p>{t.departmentSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="dam-header-actions">
          <button
            className="dam-btn dam-btn-secondary"
            onClick={refreshAll}
          >
            <RefreshCw size={17} />
            {t.refresh}
          </button>

          <button
            className="dam-btn dam-btn-primary"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
          >
            <Plus size={18} />
            {t.createDepartment}
          </button>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="dam-stats-grid">
        <div className="dam-stat-card">
          <div className="dam-stat-icon blue">
            <Building2 size={23} />
          </div>

          <div>
            <span>{t.totalDepartments}</span>
            <strong>{statistics.total}</strong>
          </div>
        </div>

        <div className="dam-stat-card">
          <div className="dam-stat-icon green">
            <UserCheck size={23} />
          </div>

          <div>
            <span>{t.departmentHeads}</span>
            <strong>{statistics.heads}</strong>
          </div>
        </div>

        <div className="dam-stat-card">
          <div className="dam-stat-icon purple">
            <Users size={23} />
          </div>

          <div>
            <span>{t.departmentUsers}</span>
            <strong>
              {statistics.totalDepartmentUsers}
            </strong>
          </div>
        </div>

        <div className="dam-stat-card">
          <div className="dam-stat-icon orange">
            <Package size={23} />
          </div>

          <div>
            <span>{t.departmentAssets}</span>
            <strong>
              {statistics.totalDepartmentAssets}
            </strong>
          </div>
        </div>

        <div className="dam-stat-card">
          <div className="dam-stat-icon teal">
            <MapPin size={23} />
          </div>

          <div>
            <span>{t.locations}</span>
            <strong>{statistics.locations}</strong>
          </div>
        </div>

        <div className="dam-stat-card">
          <div className="dam-stat-icon red">
            <AlertCircle size={23} />
          </div>

          <div>
            <span>{t.inactive}</span>
            <strong>{statistics.inactive}</strong>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="dam-toolbar">
        <div className="dam-search">
          <Search size={19} />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder={t.searchDepartments}
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="dam-search-clear"
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <select
          className="dam-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="">
            {t.allStatus}
          </option>

          <option value="active">
            {t.active}
          </option>

          <option value="inactive">
            {t.inactive}
          </option>
        </select>
      </div>

      {/* CONTENT */}
      {filteredDepartments.length === 0 ? (
        <div className="dam-empty">
          <Building2 size={58} />

          <h3>{t.noDepartments}</h3>

          <p>
            {searchQuery
              ? t.adjustSearch
              : t.createFirstDepartment}
          </p>

          {!searchQuery && (
            <button
              className="dam-btn dam-btn-primary"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Plus size={18} />
              {t.createDepartment}
            </button>
          )}
        </div>
      ) : (
        <div className="dam-table-wrapper">
          <table className="dam-table">
            <thead>
              <tr>
                <th>{t.department}</th>
                <th>{t.code}</th>
                <th>{t.departmentHead}</th>
                <th>{t.users}</th>
                <th>{t.assets}</th>
                <th>{t.location}</th>
                <th>{t.status}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>

            <tbody>
              {filteredDepartments.map((department) => {
                const head =
                  getDepartmentHead(department);

                const departmentUsers =
                  getDepartmentUsers(department);

                const departmentAssets =
                  getDepartmentAssets(department);

                const status =
                  getDepartmentStatus(department);

                return (
                  <tr
                    key={getDepartmentId(department)}
                  >
                    <td>
                      <div className="dam-department-cell">
                        <div className="dam-department-avatar">
                          <Building2 size={19} />
                        </div>

                        <div>
                          <strong>
                            {getDepartmentName(
                              department
                            )}
                          </strong>

                          <small>
                            {department?.description ||
                              t.noDescription}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="dam-code">
                        {getDepartmentCode(
                          department
                        )}
                      </span>
                    </td>

                    <td>
                      {head ? (
                        <div className="dam-head-cell">
                          <div className="dam-user-avatar">
                            {getUserName(head)
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {getUserName(head)}
                            </strong>

                            <small>
                              {head?.email || "-"}
                            </small>
                          </div>
                        </div>
                      ) : (
                        <span className="dam-muted">
                          {t.notAssigned}
                        </span>
                      )}
                    </td>

                    <td>
                      <span className="dam-count">
                        <Users size={15} />
                        {departmentUsers.length}
                      </span>
                    </td>

                    <td>
                      <span className="dam-count">
                        <Package size={15} />
                        {departmentAssets.length}
                      </span>
                    </td>

                    <td>
                      <div className="dam-location">
                        <MapPin size={15} />

                        <span>
                          {department?.location ||
                            department?.building ||
                            department?.room ||
                            "-"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`dam-status ${status}`}
                      >
                        {status === "active"
                          ? t.active
                          : t.inactive}
                      </span>
                    </td>

                    <td>
                      <div className="dam-actions">
                        <button
                          type="button"
                          className="dam-action view"
                          title={t.viewDetails}
                          onClick={() =>
                            openDetails(department)
                          }
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          className="dam-action edit"
                          title={t.edit}
                          onClick={() =>
                            openEditModal(department)
                          }
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          type="button"
                          className="dam-action delete"
                          title={t.delete}
                          onClick={() =>
                            handleDelete(department)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="dam-modal-overlay">
          <div className="dam-modal">
            <div className="dam-modal-header">
              <div>
                <h2>{t.createDepartment}</h2>
                <p>{t.createDepartmentSubtitle}</p>
              </div>

              <button
                type="button"
                className="dam-close"
                onClick={closeCreate}
              >
                <X size={21} />
              </button>
            </div>

            <div className="dam-modal-body">
              {renderDepartmentForm(false)}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && selectedDepartment && (
        <div className="dam-modal-overlay">
          <div className="dam-modal">
            <div className="dam-modal-header">
              <div>
                <h2>{t.editDepartment}</h2>

                <p>
                  {getDepartmentName(
                    selectedDepartment
                  )}
                </p>
              </div>

              <button
                type="button"
                className="dam-close"
                onClick={closeEdit}
              >
                <X size={21} />
              </button>
            </div>

            <div className="dam-modal-body">
              {renderDepartmentForm(true)}
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetails && selectedDepartment && (
        <div className="dam-modal-overlay">
          <div className="dam-modal dam-details-modal">
            <div className="dam-modal-header">
              <div>
                <h2>
                  {getDepartmentName(
                    selectedDepartment
                  )}
                </h2>

                <p>
                  {getDepartmentCode(
                    selectedDepartment
                  )}
                </p>
              </div>

              <button
                type="button"
                className="dam-close"
                onClick={closeDetails}
              >
                <X size={21} />
              </button>
            </div>

            <div className="dam-details-body">
              <div className="dam-detail-cards">
                <div className="dam-detail-card">
                  <Users size={22} />

                  <div>
                    <span>{t.departmentUsers}</span>

                    <strong>
                      {
                        getDepartmentUsers(
                          selectedDepartment
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <div className="dam-detail-card">
                  <Package size={22} />

                  <div>
                    <span>{t.departmentAssets}</span>

                    <strong>
                      {
                        getDepartmentAssets(
                          selectedDepartment
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <div className="dam-detail-card">
                  <UserCheck size={22} />

                  <div>
                    <span>{t.departmentHead}</span>

                    <strong>
                      {getDepartmentHead(
                        selectedDepartment
                      )
                        ? getUserName(
                            getDepartmentHead(
                              selectedDepartment
                            )
                          )
                        : t.notAssigned}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="dam-detail-section">
                <h3>
                  <Building2 size={18} />
                  {t.departmentInformation}
                </h3>

                <div className="dam-info-grid">
                  <div>
                    <span>{t.departmentName}</span>
                    <strong>
                      {getDepartmentName(
                        selectedDepartment
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>{t.departmentCode}</span>
                    <strong>
                      {getDepartmentCode(
                        selectedDepartment
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>{t.status}</span>

                    <strong>
                      <span
                        className={`dam-status ${getDepartmentStatus(
                          selectedDepartment
                        )}`}
                      >
                        {getDepartmentStatus(
                          selectedDepartment
                        ) === "active"
                          ? t.active
                          : t.inactive}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>{t.location}</span>

                    <strong>
                      {selectedDepartment.location ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>{t.building}</span>

                    <strong>
                      {selectedDepartment.building ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>{t.floor}</span>

                    <strong>
                      {selectedDepartment.floor ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>{t.room}</span>

                    <strong>
                      {selectedDepartment.room ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>{t.phone}</span>

                    <strong>
                      {selectedDepartment.phone ||
                        selectedDepartment.phone_number ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>{t.email}</span>

                    <strong>
                      {selectedDepartment.email ||
                        "-"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="dam-detail-section">
                <h3>
                  <Users size={18} />
                  {t.departmentUsers}
                </h3>

                {getDepartmentUsers(
                  selectedDepartment
                ).length === 0 ? (
                  <div className="dam-no-data">
                    {t.noDepartmentUsers}
                  </div>
                ) : (
                  <div className="dam-user-list">
                    {getDepartmentUsers(
                      selectedDepartment
                    ).map((user) => (
                      <div
                        className="dam-user-list-item"
                        key={user.id || user._id}
                      >
                        <div className="dam-user-avatar">
                          {getUserName(user)
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {getUserName(user)}
                          </strong>

                          <small>
                            {user?.email || "-"}
                          </small>
                        </div>

                        <span className="dam-role">
                          {user?.role || "user"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dam-detail-section">
                <h3>
                  <Package size={18} />
                  {t.departmentAssets}
                </h3>

                {getDepartmentAssets(
                  selectedDepartment
                ).length === 0 ? (
                  <div className="dam-no-data">
                    {t.noDepartmentAssets}
                  </div>
                ) : (
                  <div className="dam-assets-list">
                    {getDepartmentAssets(
                      selectedDepartment
                    ).slice(0, 20).map((asset) => (
                      <div
                        className="dam-asset-item"
                        key={
                          asset.id ||
                          asset._id ||
                          asset.asset_id
                        }
                      >
                        <Package size={18} />

                        <div>
                          <strong>
                            {asset.name ||
                              asset.asset_name ||
                              asset.asset_tag ||
                              "-"}
                          </strong>

                          <small>
                            {asset.asset_code ||
                              asset.serial_number ||
                              asset.assetTag ||
                              "-"}
                          </small>
                        </div>

                        <span>
                          {asset.status || "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="dam-modal-actions">
              <button
                className="dam-btn dam-btn-secondary"
                onClick={closeDetails}
              >
                <X size={17} />
                {t.close}
              </button>

              <button
                className="dam-btn dam-btn-primary"
                onClick={() => {
                  closeDetails();
                  openEditModal(selectedDepartment);
                }}
              >
                <Edit2 size={17} />
                {t.editDepartment}
              </button>
            </div>
          </div>
        </div>
      )}

      <DepartmentStyles isDark={isDark} />
    </div>
  );
};

/* =========================================================
   STYLES
========================================================= */

const DepartmentStyles = ({ isDark }) => (
  <style>{`
    .dam-container {
      min-height: 100vh;
      width: 100%;
      padding: 24px;
      box-sizing: border-box;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: background .2s ease, color .2s ease;
    }

    .dam-light {
      background: #f8fafc;
      color: #1a202c;
    }

    .dam-dark {
      background: #111827;
      color: #f3f4f6;
    }

    .dam-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }

    .dam-title-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .dam-title-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #3182ce;
      color: white;
      box-shadow: 0 5px 15px rgba(49, 130, 206, .22);
    }

    .dam-header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 750;
      letter-spacing: -.4px;
    }

    .dam-header p {
      margin: 5px 0 0;
      font-size: 14px;
      opacity: .7;
    }

    .dam-header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .dam-btn {
      border: none;
      border-radius: 9px;
      padding: 10px 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
      transition: all .2s ease;
      white-space: nowrap;
    }

    .dam-btn:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .dam-btn-primary {
      background: #3182ce;
      color: white;
    }

    .dam-btn-primary:hover:not(:disabled) {
      background: #2563a8;
      transform: translateY(-1px);
    }

    .dam-btn-secondary {
      background: ${isDark ? "#374151" : "#e5e7eb"};
      color: ${isDark ? "#f3f4f6" : "#1f2937"};
    }

    .dam-btn-secondary:hover {
      background: ${isDark ? "#4b5563" : "#d1d5db"};
    }

    .dam-stats-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 22px;
    }

    .dam-stat-card {
      min-width: 0;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      background: ${isDark ? "#1f2937" : "#ffffff"};
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.04);
    }

    .dam-stat-icon {
      width: 43px;
      height: 43px;
      flex: 0 0 43px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
    }

    .dam-stat-icon.blue {
      background: #dbeafe;
      color: #2563eb;
    }

    .dam-stat-icon.green {
      background: #dcfce7;
      color: #16a34a;
    }

    .dam-stat-icon.purple {
      background: #ede9fe;
      color: #7c3aed;
    }

    .dam-stat-icon.orange {
      background: #ffedd5;
      color: #ea580c;
    }

    .dam-stat-icon.teal {
      background: #ccfbf1;
      color: #0f766e;
    }

    .dam-stat-icon.red {
      background: #fee2e2;
      color: #dc2626;
    }

    .dam-stat-card span {
      display: block;
      font-size: 11px;
      opacity: .65;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dam-stat-card strong {
      display: block;
      font-size: 23px;
      line-height: 1;
    }

    .dam-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 18px;
    }

    .dam-search {
      flex: 1;
      min-width: 220px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 10px 13px;
      border-radius: 9px;
      border: 1px solid ${isDark ? "#374151" : "#d1d5db"};
      background: ${isDark ? "#1f2937" : "#ffffff"};
    }

    .dam-search svg {
      opacity: .6;
      flex: 0 0 auto;
    }

    .dam-search input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
      font-size: 14px;
    }

    .dam-search-clear {
      border: none;
      background: transparent;
      color: inherit;
      opacity: .6;
      cursor: pointer;
      padding: 2px;
    }

    .dam-filter {
      min-width: 150px;
      padding: 10px 13px;
      border-radius: 9px;
      border: 1px solid ${isDark ? "#374151" : "#d1d5db"};
      background: ${isDark ? "#1f2937" : "#ffffff"};
      color: inherit;
      outline: none;
      cursor: pointer;
    }

    .dam-table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      background: ${isDark ? "#1f2937" : "#ffffff"};
      box-shadow: 0 2px 10px rgba(0,0,0,.04);
    }

    .dam-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }

    .dam-table thead {
      background: ${isDark ? "#111827" : "#f8fafc"};
    }

    .dam-table th {
      padding: 13px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: .3px;
      color: ${isDark ? "#cbd5e1" : "#64748b"};
      border-bottom: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      white-space: nowrap;
    }

    .dam-table td {
      padding: 14px;
      border-bottom: 1px solid ${isDark ? "#374151" : "#edf0f3"};
      vertical-align: middle;
      font-size: 13px;
    }

    .dam-table tbody tr {
      transition: background .15s ease;
    }

    .dam-table tbody tr:hover {
      background: ${isDark ? "#263244" : "#f8fafc"};
    }

    .dam-department-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 210px;
    }

    .dam-department-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: ${isDark ? "#1e40af" : "#dbeafe"};
      color: ${isDark ? "#bfdbfe" : "#2563eb"};
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 38px;
    }

    .dam-department-cell strong,
    .dam-head-cell strong,
    .dam-user-list-item strong,
    .dam-asset-item strong {
      display: block;
      font-weight: 700;
    }

    .dam-department-cell small,
    .dam-head-cell small,
    .dam-user-list-item small,
    .dam-asset-item small {
      display: block;
      margin-top: 3px;
      font-size: 11px;
      opacity: .6;
      max-width: 210px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dam-code {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 6px;
      background: ${isDark ? "#374151" : "#f1f5f9"};
      font-weight: 700;
      font-size: 11px;
      letter-spacing: .4px;
    }

    .dam-head-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 160px;
    }

    .dam-user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #3182ce;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 750;
      flex: 0 0 34px;
    }

    .dam-muted {
      opacity: .55;
      font-size: 12px;
    }

    .dam-count {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
    }

    .dam-location {
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 170px;
    }

    .dam-location svg {
      color: #3182ce;
      flex: 0 0 auto;
    }

    .dam-location span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dam-status {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 750;
    }

    .dam-status.active {
      background: #dcfce7;
      color: #166534;
    }

    .dam-status.inactive {
      background: #fee2e2;
      color: #991b1b;
    }

    .dam-actions {
      display: flex;
      gap: 6px;
    }

    .dam-action {
      width: 31px;
      height: 31px;
      border: none;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all .15s ease;
    }

    .dam-action.view {
      background: ${isDark ? "#164e63" : "#cffafe"};
      color: ${isDark ? "#67e8f9" : "#0e7490"};
    }

    .dam-action.edit {
      background: ${isDark ? "#1e3a8a" : "#dbeafe"};
      color: ${isDark ? "#93c5fd" : "#2563eb"};
    }

    .dam-action.delete {
      background: ${isDark ? "#7f1d1d" : "#fee2e2"};
      color: ${isDark ? "#fca5a5" : "#dc2626"};
    }

    .dam-action:hover {
      transform: translateY(-1px);
      filter: brightness(.95);
    }

    .dam-empty {
      min-height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 10px;
      border: 1px dashed ${isDark ? "#4b5563" : "#cbd5e1"};
      border-radius: 12px;
      background: ${isDark ? "#1f2937" : "#ffffff"};
    }

    .dam-empty > svg {
      opacity: .35;
    }

    .dam-empty h3 {
      margin: 4px 0 0;
      font-size: 19px;
    }

    .dam-empty p {
      margin: 0 0 10px;
      opacity: .65;
      font-size: 14px;
    }

    .dam-loading {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 15px;
    }

    .dam-spinner {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 4px solid ${isDark ? "#374151" : "#e5e7eb"};
      border-top-color: #3182ce;
      animation: dam-spin .8s linear infinite;
    }

    .dam-loading p {
      opacity: .65;
    }

    .dam-spin {
      animation: dam-spin .8s linear infinite;
    }

    @keyframes dam-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .dam-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, .65);
      backdrop-filter: blur(3px);
    }

    .dam-modal {
      width: min(760px, 100%);
      max-height: 92vh;
      overflow-y: auto;
      border-radius: 14px;
      background: ${isDark ? "#1f2937" : "#ffffff"};
      color: ${isDark ? "#f3f4f6" : "#1f2937"};
      box-shadow: 0 25px 70px rgba(0,0,0,.25);
    }

    .dam-details-modal {
      width: min(900px, 100%);
    }

    .dam-modal-header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding: 20px 22px;
      background: ${isDark ? "#1f2937" : "#ffffff"};
      border-bottom: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
    }

    .dam-modal-header h2 {
      margin: 0;
      font-size: 21px;
    }

    .dam-modal-header p {
      margin: 4px 0 0;
      opacity: .6;
      font-size: 13px;
    }

    .dam-close {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: ${isDark ? "#374151" : "#f1f5f9"};
      color: inherit;
    }

    .dam-close:hover {
      background: #fee2e2;
      color: #dc2626;
    }

    .dam-modal-body {
      padding: 22px;
    }

    .dam-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .dam-form-group {
      min-width: 0;
    }

    .dam-form-group.dam-full {
      grid-column: 1 / -1;
    }

    .dam-form-group label {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 7px;
      font-size: 13px;
      font-weight: 700;
    }

    .dam-form-group label span {
      color: #dc2626;
    }

    .dam-form-group input,
    .dam-form-group select,
    .dam-form-group textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 11px;
      border-radius: 8px;
      border: 1px solid ${isDark ? "#4b5563" : "#cbd5e1"};
      background: ${isDark ? "#111827" : "#ffffff"};
      color: inherit;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    .dam-form-group textarea {
      resize: vertical;
    }

    .dam-form-group input:focus,
    .dam-form-group select:focus,
    .dam-form-group textarea:focus {
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(49,130,206,.12);
    }

    .dam-form-group input.error,
    .dam-form-group select.error,
    .dam-form-group textarea.error {
      border-color: #ef4444;
    }

    .dam-error {
      display: block;
      margin-top: 5px;
      color: #ef4444;
      font-size: 11px;
    }

    .dam-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 18px 22px;
      border-top: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
    }

    .dam-details-body {
      padding: 22px;
    }

    .dam-detail-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }

    .dam-detail-card {
      padding: 15px;
      border-radius: 10px;
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      background: ${isDark ? "#111827" : "#f8fafc"};
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .dam-detail-card > svg {
      color: #3182ce;
    }

    .dam-detail-card span {
      display: block;
      font-size: 11px;
      opacity: .6;
    }

    .dam-detail-card strong {
      display: block;
      margin-top: 3px;
      font-size: 14px;
    }

    .dam-detail-section {
      margin-top: 22px;
    }

    .dam-detail-section h3 {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0 0 12px;
      font-size: 15px;
    }

    .dam-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      overflow: hidden;
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      border-radius: 10px;
      background: ${isDark ? "#374151" : "#e5e7eb"};
    }

    .dam-info-grid > div {
      padding: 13px;
      background: ${isDark ? "#1f2937" : "#ffffff"};
    }

    .dam-info-grid span {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      opacity: .6;
    }

    .dam-info-grid strong {
      font-size: 13px;
    }

    .dam-user-list,
    .dam-assets-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .dam-user-list-item,
    .dam-asset-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: 9px;
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      background: ${isDark ? "#111827" : "#ffffff"};
    }

    .dam-user-list-item > div:nth-child(2),
    .dam-asset-item > div {
      flex: 1;
      min-width: 0;
    }

    .dam-role {
      padding: 4px 8px;
      border-radius: 999px;
      background: ${isDark ? "#374151" : "#f1f5f9"};
      font-size: 10px;
      font-weight: 700;
    }

    .dam-asset-item > svg {
      color: #3182ce;
      flex: 0 0 auto;
    }

    .dam-asset-item > span {
      font-size: 11px;
      opacity: .7;
    }

    .dam-no-data {
      padding: 25px;
      text-align: center;
      border: 1px dashed ${isDark ? "#4b5563" : "#cbd5e1"};
      border-radius: 9px;
      opacity: .6;
      font-size: 13px;
    }

    @media (max-width: 1250px) {
      .dam-stats-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 850px) {
      .dam-container {
        padding: 16px;
      }

      .dam-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .dam-header-actions {
        width: 100%;
      }

      .dam-header-actions .dam-btn {
        flex: 1;
      }

      .dam-form-grid {
        grid-template-columns: 1fr;
      }

      .dam-form-group.dam-full {
        grid-column: auto;
      }

      .dam-detail-cards {
        grid-template-columns: 1fr;
      }

      .dam-info-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 600px) {
      .dam-stats-grid {
        grid-template-columns: 1fr 1fr;
      }

      .dam-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .dam-filter {
        width: 100%;
      }

      .dam-header h1 {
        font-size: 21px;
      }

      .dam-title-icon {
        width: 44px;
        height: 44px;
      }

      .dam-modal-overlay {
        padding: 8px;
      }

      .dam-modal {
        max-height: 96vh;
      }

      .dam-info-grid {
        grid-template-columns: 1fr;
      }

      .dam-modal-actions {
        flex-direction: column-reverse;
      }

      .dam-modal-actions .dam-btn {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      .dam-stats-grid {
        grid-template-columns: 1fr;
      }

      .dam-header-actions {
        flex-direction: column;
      }

      .dam-header-actions .dam-btn {
        width: 100%;
      }
    }
  `}</style>
);

/* =========================================================
   TRANSLATIONS
========================================================= */

const englishTranslations = {
  loading: "Loading departments...",
  departmentManagement: "Department Management",
  departmentSubtitle:
    "Manage university departments, heads, users, assets and locations.",

  refresh: "Refresh",

  createDepartment: "Create Department",
  createDepartmentSubtitle:
    "Add a new university department.",

  editDepartment: "Edit Department",

  totalDepartments: "Total Departments",
  departmentHeads: "Department Heads",
  departmentUsers: "Department Users",
  departmentAssets: "Department Assets",
  locations: "Locations",

  department: "Department",
  code: "Code",
  departmentCode: "Department Code",
  departmentName: "Department Name",

  description: "Description",
  departmentHead: "Department Head",

  location: "Location",
  building: "Building",
  floor: "Floor",
  room: "Room",

  phone: "Phone",
  email: "Email",

  status: "Status",
  active: "Active",
  inactive: "Inactive",

  users: "Users",
  assets: "Assets",
  actions: "Actions",

  searchDepartments: "Search departments...",
  allStatus: "All Status",

  noDepartments: "No Departments Found",
  adjustSearch: "Try adjusting your search or filters.",
  createFirstDepartment:
    "Create your first department to get started.",

  noDescription: "No description",

  notAssigned: "Not assigned",

  viewDetails: "View Details",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",

  saving: "Saving...",
  saveChanges: "Save Changes",

  selectHead: "-- Select Department Head --",

  departmentNamePlaceholder:
    "e.g. Computer Science and Engineering",

  descriptionPlaceholder:
    "Enter department description...",

  nameRequired: "Department name is required.",
  codeRequired: "Department code is required.",
  descriptionRequired:
    "Department description is required.",

  invalidDepartment: "Invalid department.",

  createSuccess:
    "Department created successfully.",

  createFailed:
    "Failed to create department.",

  updateSuccess:
    "Department updated successfully.",

  updateFailed:
    "Failed to update department.",

  deleteSuccess:
    "Department deleted successfully.",

  deleteFailed:
    "Failed to delete department.",

  deleteConfirm:
    "Are you sure you want to delete department",

  refreshed: "Department data refreshed.",

  noDepartmentUsers:
    "No users assigned to this department.",

  noDepartmentAssets:
    "No assets assigned to this department.",

  departmentInformation:
    "Department Information",

  loadFailed:
    "Failed to load departments.",
};

const amharicTranslations = {
  loading: "ዲፓርትመንቶች በመጫን ላይ...",
  departmentManagement: "የዲፓርትመንት አስተዳደር",
  departmentSubtitle:
    "የዩኒቨርሲቲ ዲፓርትመንቶችን፣ ኃላፊዎችን፣ ተጠቃሚዎችን፣ assets እና አካባቢዎችን ያስተዳድሩ።",

  refresh: "አድስ",

  createDepartment: "ዲፓርትመንት ፍጠር",
  createDepartmentSubtitle:
    "አዲስ የዩኒቨርሲቲ ዲፓርትመንት ይጨምሩ።",

  editDepartment: "ዲፓርትመንት አርትዕ",

  totalDepartments: "ጠቅላላ ዲፓርትመንቶች",
  departmentHeads: "የዲፓርትመንት ኃላፊዎች",
  departmentUsers: "የዲፓርትመንት ተጠቃሚዎች",
  departmentAssets: "የዲፓርትመንት Assets",
  locations: "አካባቢዎች",

  department: "ዲፓርትመንት",
  code: "ኮድ",
  departmentCode: "የዲፓርትመንት ኮድ",
  departmentName: "የዲፓርትመንት ስም",

  description: "መግለጫ",
  departmentHead: "የዲፓርትመንት ኃላፊ",

  location: "አካባቢ",
  building: "ህንፃ",
  floor: "ፎቅ",
  room: "ክፍል",

  phone: "ስልክ",
  email: "ኢሜይል",

  status: "ሁኔታ",
  active: "ንቁ",
  inactive: "የተዘጋ",

  users: "ተጠቃሚዎች",
  assets: "Assets",
  actions: "ተግባራት",

  searchDepartments:
    "ዲፓርትመንቶችን ይፈልጉ...",

  allStatus: "ሁሉም ሁኔታ",

  noDepartments:
    "ምንም ዲፓርትመንት አልተገኘም",

  adjustSearch:
    "የፍለጋ ቃሉን ወይም filter ያስተካክሉ።",

  createFirstDepartment:
    "መጀመሪያ ዲፓርትመንት ይፍጠሩ።",

  noDescription: "መግለጫ የለም",

  notAssigned: "አልተመደበም",

  viewDetails: "ዝርዝር ይመልከቱ",
  edit: "አርትዕ",
  delete: "ሰርዝ",
  close: "ዝጋ",
  cancel: "ሰርዝ",

  saving: "በማስቀመጥ ላይ...",
  saveChanges: "ለውጦችን አስቀምጥ",

  selectHead:
    "-- የዲፓርትመንት ኃላፊ ይምረጡ --",

  departmentNamePlaceholder:
    "ለምሳሌ Computer Science and Engineering",

  descriptionPlaceholder:
    "የዲፓርትመንቱን መግለጫ ያስገቡ...",

  nameRequired:
    "የዲፓርትመንት ስም ያስፈልጋል።",

  codeRequired:
    "የዲፓርትመንት ኮድ ያስፈልጋል።",

  descriptionRequired:
    "የዲፓርትመንት መግለጫ ያስፈልጋል።",

  invalidDepartment:
    "የዲፓርትመንት መረጃ ትክክል አይደለም።",

  createSuccess:
    "ዲፓርትመንቱ በተሳካ ሁኔታ ተፈጥሯል።",

  createFailed:
    "ዲፓርትመንት መፍጠር አልተቻለም።",

  updateSuccess:
    "ዲፓርትመንቱ በተሳካ ሁኔታ ተሻሽሏል።",

  updateFailed:
    "ዲፓርትመንት ማሻሻል አልተቻለም።",

  deleteSuccess:
    "ዲፓርትመንቱ በተሳካ ሁኔታ ተሰርዟል።",

  deleteFailed:
    "ዲፓርትመንት መሰረዝ አልተቻለም።",

  deleteConfirm:
    "ይህን ዲፓርትመንት መሰረዝ ይፈልጋሉ",

  refreshed:
    "የዲፓርትመንት መረጃ ታድሷል።",

  noDepartmentUsers:
    "በዚህ ዲፓርትመንት ውስጥ ምንም ተጠቃሚ አልተመደበም።",

  noDepartmentAssets:
    "ለዚህ ዲፓርትመንት ምንም Asset አልተመደበም።",

  departmentInformation:
    "የዲፓርትመንት መረጃ",

  loadFailed:
    "ዲፓርትመንቶችን መጫን አልተቻለም።",
};

export default AdminDepartmentManagement;