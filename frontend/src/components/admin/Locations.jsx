import React, { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../utils/api";

const API_URL = `${apiBase()}/api/locations`;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getHeaders = (includeJson = false) => {
  const headers = {
    Accept: "application/json",
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const normalizeLocations = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.locations)) {
    return data.locations;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.data?.locations)) {
    return data.data.locations;
  }

  return [];
};

const getLocationId = (location) =>
  location?.locationId ??
  location?.location_id ??
  location?.id;

const getLocationName = (location) =>
  location?.name ||
  location?.locationName ||
  location?.location_name ||
  "Unnamed Location";

const getLocationCode = (location) =>
  location?.code ||
  location?.locationCode ||
  location?.location_code ||
  "—";

const getLocationType = (location) =>
  location?.type ||
  location?.locationType ||
  location?.location_type ||
  "General";

const getStatus = (location) => {
  if (
    location?.status === false ||
    location?.isActive === false ||
    location?.active === false
  ) {
    return "Inactive";
  }

  return "Active";
};

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const emptyForm = {
    name: "",
    code: "",
    type: "Building",
    campus: "",
    building: "",
    floor: "",
    room: "",
    description: "",
    address: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load locations (${response.status})`
        );
      }

      const data = await response.json();

      setLocations(normalizeLocations(data));
    } catch (err) {
      console.error("Locations load error:", err);
      setError(err.message || "Unable to load locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const locationTypes = useMemo(() => {
    const types = locations
      .map((location) => getLocationType(location))
      .filter(Boolean);

    return ["All", ...Array.from(new Set(types))];
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      const name = getLocationName(location).toLowerCase();
      const code = getLocationCode(location).toLowerCase();
      const type = getLocationType(location).toLowerCase();

      const campus = String(
        location?.campus ||
          location?.campusName ||
          ""
      ).toLowerCase();

      const building = String(
        location?.building ||
          location?.buildingName ||
          ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        code.includes(query) ||
        type.includes(query) ||
        campus.includes(query) ||
        building.includes(query);

      const matchesType =
        typeFilter === "All" ||
        getLocationType(location) === typeFilter;

      const matchesStatus =
        statusFilter === "All" ||
        getStatus(location) === statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    locations,
    search,
    typeFilter,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    const active = locations.filter(
      (location) => getStatus(location) === "Active"
    ).length;

    const inactive = locations.filter(
      (location) => getStatus(location) === "Inactive"
    ).length;

    const buildings = locations.filter((location) => {
      const type = getLocationType(location).toLowerCase();
      return (
        type.includes("building") ||
        type.includes("laboratory") ||
        type.includes("warehouse")
      );
    }).length;

    return {
      total: locations.length,
      active,
      inactive,
      buildings,
    };
  }, [locations]);

  const openCreateModal = () => {
    setEditingLocation(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (location) => {
    setEditingLocation(location);

    setForm({
      name: getLocationName(location) === "Unnamed Location"
        ? ""
        : getLocationName(location),
      code:
        getLocationCode(location) === "—"
          ? ""
          : getLocationCode(location),
      type: getLocationType(location),
      campus:
        location?.campus ||
        location?.campusName ||
        "",
      building:
        location?.building ||
        location?.buildingName ||
        "",
      floor:
        location?.floor ??
        location?.floorNumber ??
        "",
      room:
        location?.room ||
        location?.roomNumber ||
        "",
      description: location?.description || "",
      address:
        location?.address ||
        location?.fullAddress ||
        "",
      status: getStatus(location),
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openDetailsModal = (location) => {
    setSelectedLocation(location);
    setShowDetails(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingLocation(null);
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
      setError("Location name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editing = Boolean(editingLocation);
      const locationId =
        getLocationId(editingLocation);

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type,
        campus: form.campus.trim(),
        building: form.building.trim(),
        floor: form.floor,
        room: form.room.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        status: form.status,
        isActive: form.status === "Active",
      };

      const url = editing
        ? `${API_URL}/${locationId}`
        : API_URL;

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
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
        editing
          ? "Location updated successfully."
          : "Location created successfully."
      );

      setShowModal(false);
      setEditingLocation(null);
      setForm(emptyForm);

      await loadLocations();
    } catch (err) {
      console.error("Location save error:", err);
      setError(
        err.message || "Unable to save location."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (location) => {
    const locationId = getLocationId(location);

    if (!locationId) {
      setError("Location ID is missing.");
      return;
    }

    const currentStatus = getStatus(location);

    const newStatus =
      currentStatus === "Active"
        ? "Inactive"
        : "Active";

    const confirmed = window.confirm(
      `${newStatus === "Active" ? "Activate" : "Deactivate"} "${getLocationName(
        location
      )}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/${locationId}`,
        {
          method: "PUT",
          headers: getHeaders(true),
          body: JSON.stringify({
            ...location,
            status: newStatus,
            isActive: newStatus === "Active",
          }),
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
            `Unable to update status (${response.status})`
        );
      }

      setSuccess(
        `Location ${
          newStatus === "Active"
            ? "activated"
            : "deactivated"
        } successfully.`
      );

      await loadLocations();
    } catch (err) {
      console.error("Location status error:", err);
      setError(
        err.message ||
          "Unable to update location status."
      );
    }
  };

  const deleteLocation = async (location) => {
    const locationId = getLocationId(location);

    if (!locationId) {
      setError("Location ID is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${getLocationName(location)}"?\n\nThis may fail if assets or other records are still associated with this location.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/${locationId}`,
        {
          method: "DELETE",
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
            `Unable to delete location (${response.status})`
        );
      }

      setSuccess("Location deleted successfully.");

      await loadLocations();
    } catch (err) {
      console.error("Location delete error:", err);
      setError(
        err.message || "Unable to delete location."
      );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / Organization / Locations
          </div>

          <h1 style={styles.title}>Locations</h1>

          <p style={styles.subtitle}>
            Manage campuses, buildings, laboratories,
            rooms, warehouses, and other university
            asset locations.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          style={styles.primaryButton}
        >
          <span style={styles.plus}>＋</span>
          Add Location
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
          label="Total Locations"
          value={stats.total}
          icon="⌂"
          accent="#3074B3"
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
          label="Facilities"
          value={stats.buildings}
          icon="▦"
          accent="#D97706"
        />
      </div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search location, code, campus, or building..."
              style={styles.searchInput}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            style={styles.select}
          >
            {locationTypes.map((type) => (
              <option key={type} value={type}>
                {type === "All"
                  ? "All Types"
                  : type}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            style={styles.select}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={loadLocations}
            style={styles.refreshButton}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Location</th>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Campus</th>
                <th style={styles.th}>Building</th>
                <th style={styles.th}>Room</th>
                <th style={styles.th}>Status</th>
                <th
                  style={{
                    ...styles.th,
                    textAlign: "right",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    style={styles.emptyCell}
                  >
                    <div style={styles.loading}>
                      <div style={styles.spinner} />
                      Loading locations...
                    </div>
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    style={styles.emptyCell}
                  >
                    <div style={styles.emptyState}>
                      <div style={styles.emptyIcon}>
                        ⌂
                      </div>

                      <strong>
                        No locations found
                      </strong>

                      <span>
                        Try changing your search or
                        filters.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLocations.map(
                  (location, index) => {
                    const id =
                      getLocationId(location) ??
                      index;

                    const name =
                      getLocationName(location);

                    const code =
                      getLocationCode(location);

                    const type =
                      getLocationType(location);

                    const campus =
                      location?.campus ||
                      location?.campusName ||
                      "—";

                    const building =
                      location?.building ||
                      location?.buildingName ||
                      "—";

                    const room =
                      location?.room ||
                      location?.roomNumber ||
                      "—";

                    const status =
                      getStatus(location);

                    return (
                      <tr
                        key={String(id)}
                        style={styles.tr}
                      >
                        <td style={styles.td}>
                          <div
                            style={
                              styles.locationCell
                            }
                          >
                            <div
                              style={
                                styles.locationIcon
                              }
                            >
                              {name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <div
                                style={
                                  styles.locationName
                                }
                              >
                                {name}
                              </div>

                              {location?.description && (
                                <div
                                  style={
                                    styles.description
                                  }
                                >
                                  {
                                    location.description
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              styles.codeBadge
                            }
                          >
                            {code}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              styles.typeBadge
                            }
                          >
                            {type}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              styles.secondaryText
                            }
                          >
                            {campus}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              styles.secondaryText
                            }
                          >
                            {building}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              styles.secondaryText
                            }
                          >
                            {room}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <StatusBadge
                            status={status}
                          />
                        </td>

                        <td style={styles.td}>
                          <div
                            style={styles.actions}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openDetailsModal(
                                  location
                                )
                              }
                              style={
                                styles.actionButton
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  location
                                )
                              }
                              style={
                                styles.actionButton
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleStatus(
                                  location
                                )
                              }
                              style={{
                                ...styles.actionButton,
                                color:
                                  status ===
                                  "Active"
                                    ? "#B91C1C"
                                    : "#15803D",
                              }}
                            >
                              {status === "Active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteLocation(
                                  location
                                )
                              }
                              style={{
                                ...styles.actionButton,
                                color: "#DC2626",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.tableFooter}>
          Showing{" "}
          <strong>
            {filteredLocations.length}
          </strong>{" "}
          of{" "}
          <strong>{locations.length}</strong>{" "}
          locations
        </div>
      </div>

      {showModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingLocation
                    ? "Edit Location"
                    : "Add Location"}
                </h2>

                <p style={styles.modalSubtitle}>
                  {editingLocation
                    ? "Update location information."
                    : "Register a new university location."}
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
                  <FormField
                    label="Location Name"
                    required
                  >
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Science Laboratory"
                      style={styles.input}
                      required
                    />
                  </FormField>

                  <FormField label="Location Code">
                    <input
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. SCI-LAB-01"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Location Type">
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="Campus">
                        Campus
                      </option>
                      <option value="Building">
                        Building
                      </option>
                      <option value="Laboratory">
                        Laboratory
                      </option>
                      <option value="Office">
                        Office
                      </option>
                      <option value="Classroom">
                        Classroom
                      </option>
                      <option value="Warehouse">
                        Warehouse
                      </option>
                      <option value="Store">
                        Store
                      </option>
                      <option value="Workshop">
                        Workshop
                      </option>
                      <option value="Library">
                        Library
                      </option>
                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </FormField>

                  <FormField label="Campus">
                    <input
                      name="campus"
                      value={form.campus}
                      onChange={handleChange}
                      placeholder="Campus name"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Building">
                    <input
                      name="building"
                      value={form.building}
                      onChange={handleChange}
                      placeholder="Building name"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Floor">
                    <input
                      name="floor"
                      value={form.floor}
                      onChange={handleChange}
                      placeholder="e.g. 2"
                      style={styles.input}
                    />
                  </FormField>

                  <FormField label="Room">
                    <input
                      name="room"
                      value={form.room}
                      onChange={handleChange}
                      placeholder="e.g. 204"
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
                      <option value="Active">
                        Active
                      </option>
                      <option value="Inactive">
                        Inactive
                      </option>
                    </select>
                  </FormField>

                  <div
                    style={styles.fullWidth}
                  >
                    <FormField label="Address">
                      <input
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        placeholder="Full location address"
                        style={styles.input}
                      />
                    </FormField>
                  </div>

                  <div
                    style={styles.fullWidth}
                  >
                    <FormField label="Description">
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Brief description..."
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
                    : editingLocation
                    ? "Update Location"
                    : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedLocation && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowDetails(false);
            }
          }}
        >
          <div style={styles.detailsModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Location Details
                </h2>

                <p style={styles.modalSubtitle}>
                  Complete location information
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDetails(false)
                }
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.detailsBody}>
              <div style={styles.detailsHero}>
                <div
                  style={
                    styles.largeLocationIcon
                  }
                >
                  {getLocationName(
                    selectedLocation
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <h3
                    style={styles.detailsName}
                  >
                    {getLocationName(
                      selectedLocation
                    )}
                  </h3>

                  <div
                    style={styles.detailsCode}
                  >
                    {getLocationCode(
                      selectedLocation
                    )}
                  </div>
                </div>

                <StatusBadge
                  status={getStatus(
                    selectedLocation
                  )}
                />
              </div>

              <div style={styles.detailsGrid}>
                <DetailItem
                  label="Type"
                  value={getLocationType(
                    selectedLocation
                  )}
                />

                <DetailItem
                  label="Campus"
                  value={
                    selectedLocation?.campus ||
                    selectedLocation?.campusName ||
                    "—"
                  }
                />

                <DetailItem
                  label="Building"
                  value={
                    selectedLocation?.building ||
                    selectedLocation?.buildingName ||
                    "—"
                  }
                />

                <DetailItem
                  label="Floor"
                  value={
                    selectedLocation?.floor ??
                    selectedLocation?.floorNumber ??
                    "—"
                  }
                />

                <DetailItem
                  label="Room"
                  value={
                    selectedLocation?.room ||
                    selectedLocation?.roomNumber ||
                    "—"
                  }
                />

                <DetailItem
                  label="Location ID"
                  value={String(
                    getLocationId(
                      selectedLocation
                    ) || "—"
                  )}
                />
              </div>

              <div style={styles.descriptionBox}>
                <div style={styles.detailLabel}>
                  Address
                </div>

                <div
                  style={styles.descriptionText}
                >
                  {selectedLocation?.address ||
                    selectedLocation?.fullAddress ||
                    "No address provided."}
                </div>
              </div>

              <div style={styles.descriptionBox}>
                <div style={styles.detailLabel}>
                  Description
                </div>

                <div
                  style={styles.descriptionText}
                >
                  {selectedLocation?.description ||
                    "No description provided."}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() =>
                  setShowDetails(false)
                }
                style={styles.cancelButton}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEditModal(
                    selectedLocation
                  );
                }}
                style={styles.primaryButton}
              >
                Edit Location
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 900px) {
            .admin-location-page {
              padding: 18px;
            }
          }
        `}
      </style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}) {
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
        <div style={styles.statLabel}>
          {label}
        </div>

        <div style={styles.statValue}>
          {value}
        </div>
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
        background: active
          ? "#DCFCE7"
          : "#FEE2E2",
        color: active
          ? "#15803D"
          : "#B91C1C",
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: active
            ? "#16A34A"
            : "#DC2626",
        }}
      />

      {status}
    </span>
  );
}

function FormField({
  label,
  required,
  children,
}) {
  return (
    <label style={styles.formField}>
      <span style={styles.formLabel}>
        {label}
        {required && (
          <span style={styles.required}>
            {" "}
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>
        {label}
      </div>

      <div style={styles.detailValue}>
        {value}
      </div>
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
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "720px",
  },

  primaryButton: {
    border: "none",
    borderRadius: "9px",
    background: "#3074B3",
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
    boxShadow:
      "0 2px 5px rgba(48, 116, 179, 0.18)",
  },

  plus: {
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
    border: "1px solid #E2E8F0",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow:
      "0 2px 7px rgba(15, 23, 42, 0.04)",
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
    border: "1px solid #E2E8F0",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow:
      "0 2px 7px rgba(15, 23, 42, 0.04)",
  },

  toolbar: {
    padding: "16px",
    borderBottom: "1px solid #E2E8F0",
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
    minWidth: "1100px",
  },

  th: {
    padding: "13px 16px",
    textAlign: "left",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 750,
    color: "#64748B",
    background: "#F5F7FA",
    borderBottom: "1px solid #E2E8F0",
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

  locationCell: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: "220px",
  },

  locationIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#EAF2FA",
    color: "#0369A1",
    fontSize: "15px",
    fontWeight: 800,
    flexShrink: 0,
  },

  locationName: {
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: "3px",
  },

  description: {
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
    background: "#EAF2FA",
    color: "#245783",
    fontSize: "12px",
    fontWeight: 750,
  },

  typeBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    background: "#F1F5F9",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 700,
  },

  secondaryText: {
    color: "#475569",
    fontSize: "13px",
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
    gap: "3px",
    flexWrap: "wrap",
  },

  actionButton: {
    border: "none",
    background: "transparent",
    color: "#3074B3",
    padding: "5px 6px",
    borderRadius: "5px",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
  },

  tableFooter: {
    padding: "13px 16px",
    borderTop: "1px solid #E2E8F0",
    textAlign: "right",
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
    border: "2px solid #EAF2FA",
    borderTopColor: "#3074B3",
    borderRadius: "50%",
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
    width: "min(800px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow:
      "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  detailsModal: {
    width: "min(700px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "14px",
    boxShadow:
      "0 24px 70px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    padding: "20px 22px",
    borderBottom: "1px solid #E2E8F0",
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
    borderTop: "1px solid #E2E8F0",
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
    background: "#F5F7FA",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    marginBottom: "18px",
  },

  largeLocationIcon: {
    width: "54px",
    height: "54px",
    borderRadius: "12px",
    background: "#EAF2FA",
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
    border: "1px solid #E2E8F0",
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
    border: "1px solid #E2E8F0",
    borderRadius: "9px",
  },

  descriptionText: {
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};