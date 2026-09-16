import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Layers3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  code: "",
  type: "Building",
  location: "",
  address: "",
  floors: "",
  rooms: "",
  capacity: "",
  status: "active",
  description: "",
};

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getValue = (obj, keys, fallback = "") => {
  if (!obj || typeof obj !== "object") return fallback;

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
};

const getId = (row) =>
  getValue(row, ["id", "building_id", "buildingId"], "");

const getName = (row) =>
  getValue(
    row,
    ["name", "building_name", "buildingName", "facility_name"],
    "Unnamed Facility"
  );

const getCode = (row) =>
  getValue(
    row,
    ["code", "building_code", "buildingCode", "facility_code"],
    "—"
  );

const getType = (row) =>
  getValue(
    row,
    ["type", "building_type", "buildingType", "facility_type"],
    "Building"
  );

const getLocation = (row) =>
  getValue(
    row,
    ["location", "location_name", "locationName", "site"],
    "—"
  );

const getAddress = (row) =>
  getValue(row, ["address", "physical_address"], "—");

const getFloors = (row) =>
  getValue(
    row,
    ["floors", "floor_count", "floorCount", "number_of_floors"],
    0
  );

const getRooms = (row) =>
  getValue(
    row,
    ["rooms", "room_count", "roomCount", "number_of_rooms"],
    0
  );

const getCapacity = (row) =>
  getValue(
    row,
    ["capacity", "occupancy", "maximum_capacity"],
    0
  );

const getStatus = (row) =>
  normalize(
    getValue(row, ["status", "building_status", "facility_status"], "active")
  );

const getDescription = (row) =>
  getValue(row, ["description", "notes", "remarks"], "");

const getCreatedAt = (row) =>
  getValue(row, ["created_at", "createdAt"], "");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const extractRows = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.buildings)) return data.buildings;
  if (Array.isArray(data?.facilities)) return data.facilities;

  return [];
};

const extractPagination = (response, currentPage) => {
  const data = response?.data || {};
  const meta = data.pagination || data.meta || data.pageInfo || {};

  const total =
    Number(
      meta.total ??
        data.total ??
        data.totalCount ??
        0
    ) || 0;

  const totalPages =
    Number(
      meta.totalPages ??
        data.totalPages ??
        Math.ceil(total / PAGE_SIZE)
    ) || 1;

  return {
    total,
    totalPages: Math.max(1, totalPages),
    page:
      Number(meta.page ?? data.page ?? currentPage) ||
      currentPage,
  };
};

const statusLabel = (status) => {
  const labels = {
    active: "Active",
    inactive: "Inactive",
    maintenance: "Maintenance",
    closed: "Closed",
    demolished: "Demolished",
  };

  return labels[status] || status || "Active";
};

const statusClass = (status) => {
  switch (status) {
    case "active":
      return "status active";
    case "maintenance":
      return "status maintenance";
    case "inactive":
      return "status inactive";
    case "closed":
      return "status closed";
    case "demolished":
      return "status demolished";
    default:
      return "status inactive";
  }
};

export default function InfrastructureBuildings() {
  const [buildings, setBuildings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    page: 1,
  });

  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadBuildings = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/infrastructure/buildings",
          {
            params: {
              page,
              limit: PAGE_SIZE,
              search: search.trim(),
              status: status === "all" ? "" : status,
              type: type === "all" ? "" : type,
              location: location === "all" ? "" : location,
            },
          }
        );

        const rows = extractRows(response);
        const pageInfo = extractPagination(response, page);

        setBuildings(rows);
        setPagination(pageInfo);
      } catch (err) {
        console.error(
          "Infrastructure buildings load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load buildings and facilities."
        );

        setBuildings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, status, type, location]
  );

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  useEffect(() => {
    setPage(1);
  }, [search, status, type, location]);

  const locations = useMemo(() => {
    return [
      ...new Set(
        buildings
          .map((item) => getLocation(item))
          .filter(
            (item) =>
              item &&
              item !== "—" &&
              item !== "undefined"
          )
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [buildings]);

  const types = useMemo(() => {
    return [
      ...new Set(
        buildings
          .map((item) => getType(item))
          .filter(
            (item) =>
              item &&
              item !== "—" &&
              item !== "undefined"
          )
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [buildings]);

  const summary = useMemo(() => {
    return {
      total: buildings.length,
      active: buildings.filter(
        (item) => getStatus(item) === "active"
      ).length,
      maintenance: buildings.filter(
        (item) => getStatus(item) === "maintenance"
      ).length,
      inactive: buildings.filter(
        (item) =>
          getStatus(item) === "inactive" ||
          getStatus(item) === "closed"
      ).length,
      floors: buildings.reduce(
        (sum, item) =>
          sum + (Number(getFloors(item)) || 0),
        0
      ),
      rooms: buildings.reduce(
        (sum, item) =>
          sum + (Number(getRooms(item)) || 0),
        0
      ),
    };
  }, [buildings]);

  const openCreate = () => {
    setEditingBuilding(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const openEdit = (building) => {
    setEditingBuilding(building);

    setForm({
      name: getName(building) === "Unnamed Facility"
        ? ""
        : getName(building),
      code: getCode(building) === "—"
        ? ""
        : getCode(building),
      type: getType(building),
      location:
        getLocation(building) === "—"
          ? ""
          : getLocation(building),
      address:
        getAddress(building) === "—"
          ? ""
          : getAddress(building),
      floors: getFloors(building) || "",
      rooms: getRooms(building) || "",
      capacity: getCapacity(building) || "",
      status: getStatus(building) || "active",
      description: getDescription(building),
    });

    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingBuilding(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return "Facility/building name is required.";
    }

    if (!form.type.trim()) {
      return "Facility type is required.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    if (
      form.floors !== "" &&
      (Number.isNaN(Number(form.floors)) ||
        Number(form.floors) < 0)
    ) {
      return "Floors must be a valid non-negative number.";
    }

    if (
      form.rooms !== "" &&
      (Number.isNaN(Number(form.rooms)) ||
        Number(form.rooms) < 0)
    ) {
      return "Rooms must be a valid non-negative number.";
    }

    if (
      form.capacity !== "" &&
      (Number.isNaN(Number(form.capacity)) ||
        Number(form.capacity) < 0)
    ) {
      return "Capacity must be a valid non-negative number.";
    }

    return "";
  };

  const saveBuilding = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        floors:
          form.floors === ""
            ? null
            : Number(form.floors),
        rooms:
          form.rooms === ""
            ? null
            : Number(form.rooms),
        capacity:
          form.capacity === ""
            ? null
            : Number(form.capacity),
        status: form.status,
        description: form.description.trim(),
      };

      let response;

      if (editingBuilding) {
        const id = getId(editingBuilding);

        if (!id) {
          throw new Error(
            "The selected building does not have a valid ID."
          );
        }

        response = await api.put(
          `/infrastructure/buildings/${id}`,
          payload
        );
      } else {
        response = await api.post(
          "/infrastructure/buildings",
          payload
        );
      }

      setFormSuccess(
        response?.data?.message ||
          (editingBuilding
            ? "Building updated successfully."
            : "Building created successfully.")
      );

      await loadBuildings({ silent: true });

      setTimeout(() => {
        closeForm();
      }, 700);
    } catch (err) {
      console.error(
        "Infrastructure building save error:",
        err
      );

      setFormError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to save building."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteBuilding = async (building) => {
    const id = getId(building);

    if (!id) {
      setError(
        "The selected building does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${getName(building)}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/buildings/${id}`
      );

      setSelectedBuilding(null);

      await loadBuildings({ silent: true });
    } catch (err) {
      console.error(
        "Infrastructure building delete error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to delete the building."
      );
    } finally {
      setDeleting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;

    if (total <= 5) {
      return Array.from(
        { length: total },
        (_, index) => index + 1
      );
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (page >= total - 2) {
      return [
        total - 4,
        total - 3,
        total - 2,
        total - 1,
        total,
      ];
    }

    return [
      page - 2,
      page - 1,
      page,
      page + 1,
      page + 2,
    ];
  }, [page, pagination.totalPages]);

  return (
    <div className="buildings-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .buildings-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .buildings-container {
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

        .header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .header-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: #0ea5e9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.2);
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
          color: #0f172a;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .btn:hover {
          border-color: #bae6fd;
          background: #f0f9ff;
          color: #0369a1;
        }

        .btn.primary {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .btn.primary:hover {
          background: #0284c7;
          border-color: #0284c7;
          color: white;
        }

        .btn.danger {
          color: #dc2626;
        }

        .btn.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 17px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 13px;
        }

        .summary-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
          color: #64748b;
        }

        .summary-icon {
          width: 35px;
          height: 35px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-icon.blue {
          background: #e0f2fe;
          color: #0284c7;
        }

        .summary-icon.green {
          background: #dcfce7;
          color: #15803d;
        }

        .summary-icon.orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .summary-icon.red {
          background: #fee2e2;
          color: #dc2626;
        }

        .summary-icon.purple {
          background: #f3e8ff;
          color: #7e22ce;
        }

        .summary-number {
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
          color: #0f172a;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.03);
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 13px 0 40px;
          outline: none;
          font-size: 13px;
          color: #0f172a;
        }

        .search-box input:focus,
        .select-control:focus,
        .form-control:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .select-control {
          min-width: 150px;
          height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          padding: 0 12px;
          outline: none;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
        }

        .filter-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .table-header {
          padding: 17px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          border-bottom: 1px solid #e2e8f0;
        }

        .table-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .table-count {
          color: #64748b;
          font-size: 12px;
          margin-top: 4px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .facility-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .facility-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .facility-name {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .facility-code {
          color: #64748b;
          font-size: 11px;
        }

        .location-cell {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .location-cell svg {
          color: #0ea5e9;
          flex-shrink: 0;
        }

        .metric-cell {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .metric-cell svg {
          color: #64748b;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status.active {
          background: #dcfce7;
          color: #166534;
        }

        .status.maintenance {
          background: #ffedd5;
          color: #9a3412;
        }

        .status.inactive {
          background: #f1f5f9;
          color: #475569;
        }

        .status.closed {
          background: #fee2e2;
          color: #991b1b;
        }

        .status.demolished {
          background: #e2e8f0;
          color: #334155;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        .icon-btn.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 14px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state h3 {
          margin: 0 0 6px;
          color: #334155;
          font-size: 16px;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .loading-state svg {
          animation: spin 0.9s linear infinite;
        }

        .error-box {
          margin-bottom: 16px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 11px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 17px;
          border-top: 1px solid #e2e8f0;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .page-btn {
          min-width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .page-btn:hover:not(:disabled) {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        .page-btn.active {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-overlay {
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
          overflow-y: auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 9px;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-card {
          padding: 13px;
          border-radius: 11px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .detail-label {
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .description-box {
          margin-top: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 14px;
        }

        .description-text {
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          flex-wrap: wrap;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-group {
          margin-bottom: 2px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .required {
          color: #dc2626;
        }

        .form-control {
          width: 100%;
          min-height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          outline: none;
          color: #0f172a;
          background: white;
          font-size: 13px;
          font-family: inherit;
        }

        textarea.form-control {
          min-height: 100px;
          resize: vertical;
        }

        .form-help {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
        }

        .form-alert {
          margin-bottom: 15px;
          border-radius: 10px;
          padding: 11px 12px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 12px;
          font-weight: 600;
        }

        .form-alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .form-alert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .spinner {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .buildings-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detail-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .search-box {
            min-width: 100%;
          }

          .select-control {
            width: 100%;
          }

          .toolbar .btn {
            width: 100%;
          }

          .page-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="buildings-container">
        {/* HEADER */}
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Building2 size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Buildings & Facilities
              </h1>

              <p className="page-subtitle">
                Manage university buildings, facilities,
                floors, rooms, capacity, and operational status.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadBuildings({ silent: true })
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "spinner" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              Add Facility
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Facilities
              </span>
              <span className="summary-icon blue">
                <Building2 size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.total}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Active
              </span>
              <span className="summary-icon green">
                <CheckCircle2 size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.active}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Maintenance
              </span>
              <span className="summary-icon orange">
                <RefreshCw size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.maintenance}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Inactive / Closed
              </span>
              <span className="summary-icon red">
                <XCircle size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.inactive}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Floors
              </span>
              <span className="summary-icon purple">
                <Layers3 size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.floors}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Rooms
              </span>
              <span className="summary-icon blue">
                <Users size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.rooms}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* FILTERS */}
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search building, code, location..."
            />
          </div>

          <span className="filter-label">
            <Filter size={15} />
            Filters
          </span>

          <select
            className="select-control"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="all">
              All statuses
            </option>
            <option value="active">
              Active
            </option>
            <option value="maintenance">
              Maintenance
            </option>
            <option value="inactive">
              Inactive
            </option>
            <option value="closed">
              Closed
            </option>
            <option value="demolished">
              Demolished
            </option>
          </select>

          <select
            className="select-control"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="all">
              All facility types
            </option>

            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="select-control"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
          >
            <option value="all">
              All locations
            </option>

            {locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setType("all");
              setLocation("all");
            }}
          >
            Clear
          </button>
        </div>

        {/* TABLE */}
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Buildings & Facilities
              </h2>

              <div className="table-count">
                {pagination.total ||
                  buildings.length}{" "}
                records
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadBuildings({ silent: true })
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={15}
                className={
                  refreshing ? "spinner" : ""
                }
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw size={28} />
              <p>
                Loading buildings and facilities...
              </p>
            </div>
          ) : buildings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Building2 size={29} />
              </div>

              <h3>
                No buildings or facilities found
              </h3>

              <p>
                No records match the current search
                and filter settings.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Facility</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Floors</th>
                      <th>Rooms</th>
                      <th>Capacity</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {buildings.map((building) => {
                      const id = getId(building);

                      return (
                        <tr
                          key={
                            id ||
                            `${getCode(
                              building
                            )}-${getName(building)}`
                          }
                        >
                          <td>
                            <div className="facility-cell">
                              <div className="facility-icon">
                                <Building2 size={18} />
                              </div>

                              <div>
                                <div className="facility-name">
                                  {getName(building)}
                                </div>

                                <div className="facility-code">
                                  Code:{" "}
                                  {getCode(building)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {getType(building)}
                          </td>

                          <td>
                            <div className="location-cell">
                              <MapPin size={15} />
                              <span>
                                {getLocation(
                                  building
                                )}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="metric-cell">
                              <Layers3 size={15} />
                              {getFloors(building)}
                            </div>
                          </td>

                          <td>
                            <div className="metric-cell">
                              <Users size={15} />
                              {getRooms(building)}
                            </div>
                          </td>

                          <td>
                            {getCapacity(building)}
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                getStatus(building)
                              )}
                            >
                              {statusLabel(
                                getStatus(building)
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              getCreatedAt(building)
                            )}
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View details"
                                onClick={() =>
                                  setSelectedBuilding(
                                    building
                                  )
                                }
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit facility"
                                onClick={() =>
                                  openEdit(building)
                                }
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn danger"
                                title="Delete facility"
                                onClick={() =>
                                  deleteBuilding(
                                    building
                                  )
                                }
                                disabled={deleting}
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

              <div className="pagination">
                <div className="pagination-info">
                  Page {page} of{" "}
                  {pagination.totalPages}
                  {pagination.total
                    ? ` • ${pagination.total} total records`
                    : ""}
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(page - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`page-btn ${
                          pageNumber === page
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setPage(pageNumber)
                        }
                      >
                        {pageNumber}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >=
                      pagination.totalPages
                    }
                    onClick={() =>
                      setPage(page + 1)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DETAILS MODAL */}
      {selectedBuilding && !showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedBuilding(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Facility Details
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setSelectedBuilding(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-label">
                    Facility Name
                  </div>

                  <div className="detail-value">
                    {getName(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Facility Code
                  </div>

                  <div className="detail-value">
                    {getCode(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Type
                  </div>

                  <div className="detail-value">
                    {getType(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={statusClass(
                        getStatus(
                          selectedBuilding
                        )
                      )}
                    >
                      {statusLabel(
                        getStatus(
                          selectedBuilding
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Location
                  </div>

                  <div className="detail-value">
                    {getLocation(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Address
                  </div>

                  <div className="detail-value">
                    {getAddress(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Floors
                  </div>

                  <div className="detail-value">
                    {getFloors(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Rooms
                  </div>

                  <div className="detail-value">
                    {getRooms(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Capacity
                  </div>

                  <div className="detail-value">
                    {getCapacity(
                      selectedBuilding
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Created
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      getCreatedAt(
                        selectedBuilding
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="description-box">
                <div className="detail-label">
                  Description
                </div>

                <div className="description-text">
                  {getDescription(
                    selectedBuilding
                  ) ||
                    "No description has been recorded."}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  openEdit(
                    selectedBuilding
                  )
                }
              >
                <Edit3 size={16} />
                Edit
              </button>

              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSelectedBuilding(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeForm();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingBuilding
                  ? "Edit Building / Facility"
                  : "Add Building / Facility"}
              </h2>

              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveBuilding}>
              <div className="modal-body">
                {formError && (
                  <div className="form-alert error">
                    <AlertCircle size={17} />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="form-alert success">
                    <CheckCircle2 size={17} />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Facility Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Administration Building"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Facility Code
                    </label>

                    <input
                      className="form-control"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. ADM-BLD-001"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Facility Type{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="form-control"
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Building">
                        Building
                      </option>
                      <option value="Office">
                        Office
                      </option>
                      <option value="Laboratory">
                        Laboratory
                      </option>
                      <option value="Classroom">
                        Classroom
                      </option>
                      <option value="Workshop">
                        Workshop
                      </option>
                      <option value="Warehouse">
                        Warehouse
                      </option>
                      <option value="Residence">
                        Residence
                      </option>
                      <option value="Utility">
                        Utility Facility
                      </option>
                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>

                    <select
                      className="form-control"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="active">
                        Active
                      </option>
                      <option value="maintenance">
                        Maintenance
                      </option>
                      <option value="inactive">
                        Inactive
                      </option>
                      <option value="closed">
                        Closed
                      </option>
                      <option value="demolished">
                        Demolished
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Location{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Campus / site / area"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Address
                    </label>

                    <input
                      className="form-control"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="Physical address"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Number of Floors
                    </label>

                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      name="floors"
                      value={form.floors}
                      onChange={handleChange}
                      placeholder="0"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Number of Rooms
                    </label>

                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      name="rooms"
                      value={form.rooms}
                      onChange={handleChange}
                      placeholder="0"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Capacity
                    </label>

                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      name="capacity"
                      value={form.capacity}
                      onChange={handleChange}
                      placeholder="Maximum occupancy"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-control"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Building/facility description, purpose, or important information..."
                      disabled={saving}
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
                  className="btn primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {editingBuilding
                        ? "Update Facility"
                        : "Save Facility"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}