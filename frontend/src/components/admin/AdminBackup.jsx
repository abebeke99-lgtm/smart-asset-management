import React, { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../utils/api";

const API_URL = `${apiBase()}/api/admin/backups`;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getHeaders = (json = false) => {
  const token = getToken();

  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
};

const normalizeBackups = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload?.backups)) {
    return payload.backups;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.data?.backups)) {
    return payload.data.backups;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
};

const getBackupId = (backup) =>
  backup?.backupId ??
  backup?.backup_id ??
  backup?.id;

const getBackupFilename = (backup) =>
  backup?.filename ||
  backup?.fileName ||
  backup?.name;

const getBackupName = (backup) =>
  backup?.name ||
  backup?.fileName ||
  backup?.filename ||
  backup?.backupName ||
  "System Backup";

const getBackupStatus = (backup) =>
  backup?.status ||
  "Completed";

const getBackupType = (backup) =>
  backup?.type ||
  backup?.backupType ||
  "Full";

const getBackupSize = (backup) =>
  backup?.size ||
  backup?.fileSize ||
  backup?.file_size ||
  "—";

const getBackupDate = (backup) =>
  backup?.createdAt ||
  backup?.created_at ||
  backup?.date ||
  backup?.backupDate ||
  null;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const statusStyle = (status) => {
  const value = String(status).toLowerCase();

  if (
    value === "completed" ||
    value === "success" ||
    value === "successful"
  ) {
    return {
      background: "#ECFDF5",
      color: "#047857",
    };
  }

  if (
    value === "failed" ||
    value === "error"
  ) {
    return {
      background: "#FEF2F2",
      color: "#B91C1C",
    };
  }

  if (
    value === "running" ||
    value === "processing"
  ) {
    return {
      background: "#EAF2FA",
      color: "#245783",
    };
  }

  return {
    background: "#F1F5F9",
    color: "#475569",
  };
};

export default function Backup() {
  const [backups, setBackups] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [restoring, setRestoring] =
    useState(null);

  const [deleting, setDeleting] =
    useState(null);

  const [downloading, setDownloading] =
    useState(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [selectedBackup, setSelectedBackup] =
    useState(null);

  const [showDetails, setShowDetails] =
    useState(false);

  const [backupType, setBackupType] =
    useState("Full");

  const [includeFiles, setIncludeFiles] =
    useState(true);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        API_URL,
        {
          method: "GET",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load backups: ${response.status} ${response.statusText}`
        );
      }

      const payload =
        await response.json();

      setBackups(
        normalizeBackups(payload)
      );
    } catch (err) {
      console.error(
        "Backup load error:",
        err
      );

      setError(
        err.message ||
          "Unable to load backup history."
      );
    } finally {
      setLoading(false);
    }
  };

  const completedBackups = useMemo(
    () =>
      backups.filter((backup) => {
        const status =
          String(
            getBackupStatus(backup)
          ).toLowerCase();

        return (
          status === "completed" ||
          status === "success" ||
          status === "successful"
        );
      }).length,
    [backups]
  );

  const failedBackups = useMemo(
    () =>
      backups.filter((backup) => {
        const status =
          String(
            getBackupStatus(backup)
          ).toLowerCase();

        return (
          status === "failed" ||
          status === "error"
        );
      }).length,
    [backups]
  );

  const latestBackup = useMemo(() => {
    if (!backups.length) return null;

    return [...backups].sort(
      (a, b) => {
        const dateA =
          new Date(
            getBackupDate(a) || 0
          ).getTime();

        const dateB =
          new Date(
            getBackupDate(b) || 0
          ).getTime();

        return dateB - dateA;
      }
    )[0];
  }, [backups]);

  const createBackup = async () => {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        API_URL,
        {
          method: "POST",
          credentials: "include",
          headers: getHeaders(true),
          body: JSON.stringify({
            type: backupType,
            backupType,
            includeFiles,
          }),
        }
      );

      const text =
        await response.text();

      let data = null;

      try {
        data = text
          ? JSON.parse(text)
          : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Backup creation failed (${response.status})`
        );
      }

      setSuccess(
        "System backup created successfully."
      );

      await loadBackups();
    } catch (err) {
      console.error(
        "Create backup error:",
        err
      );

      setError(
        err.message ||
          "Unable to create system backup."
      );
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (
    backup
  ) => {
    const filename =
      getBackupFilename(backup);

    if (!filename) {
      setError(
        "Backup filename is missing."
      );
      return;
    }

    setDownloading(getBackupId(backup) || filename);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/download/${encodeURIComponent(filename)}`,
        {
          method: "GET",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        const text =
          await response.text();

        throw new Error(
          text ||
            `Unable to download backup (${response.status})`
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement("a");

      anchor.href = url;

      anchor.download =
        getBackupName(backup);

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        url
      );

      setSuccess(
        "Backup download started."
      );
    } catch (err) {
      console.error(
        "Download backup error:",
        err
      );

      setError(
        err.message ||
          "Unable to download backup."
      );
    } finally {
      setDownloading(null);
    }
  };

  const restoreBackup = async (
    backup
  ) => {
    const filename =
      getBackupFilename(backup);

    if (!filename) {
      setError(
        "Backup filename is missing."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Restore the system from "${getBackupName(
          backup
        )}"?\n\nThis operation may replace current system data.`
      );

    if (!confirmed) return;

    setRestoring(getBackupId(backup) || filename);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/restore/${encodeURIComponent(filename)}`,
        {
          method: "POST",
          credentials: "include",
          headers: getHeaders(true),
          body: JSON.stringify({
            backupId: getBackupId(backup),
          }),
        }
      );

      const text =
        await response.text();

      let data = null;

      try {
        data = text
          ? JSON.parse(text)
          : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Unable to restore backup (${response.status})`
        );
      }

      setSuccess(
        "Backup restoration request completed successfully."
      );

      await loadBackups();
    } catch (err) {
      console.error(
        "Restore backup error:",
        err
      );

      setError(
        err.message ||
          "Unable to restore backup."
      );
    } finally {
      setRestoring(null);
    }
  };

  const deleteBackup = async (
    backup
  ) => {
    const filename =
      getBackupFilename(backup);

    if (!filename) {
      setError(
        "Backup filename is missing."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${getBackupName(
          backup
        )}" permanently?`
      );

    if (!confirmed) return;

    const id = getBackupId(backup) || filename;
    setDeleting(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      const text =
        await response.text();

      let data = null;

      try {
        data = text
          ? JSON.parse(text)
          : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            text ||
            `Unable to delete backup (${response.status})`
        );
      }

      setBackups(
        (current) =>
          current.filter(
            (item) =>
              getBackupId(item) !== id
          )
      );

      setSuccess(
        "Backup deleted successfully."
      );
    } catch (err) {
      console.error(
        "Delete backup error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete backup."
      );
    } finally {
      setDeleting(null);
    }
  };

  const openDetails = (
    backup
  ) => {
    setSelectedBackup(
      backup
    );

    setShowDetails(true);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            Administration / System / Backup
          </div>

          <h1 style={styles.title}>
            System Backup
          </h1>

          <p style={styles.subtitle}>
            Create, download, restore, and monitor
            system backup records.
          </p>
        </div>

        <button
          type="button"
          onClick={createBackup}
          disabled={creating}
          style={{
            ...styles.primaryButton,
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating
            ? "Creating Backup..."
            : "Create Backup"}
        </button>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <strong>Error:</strong>{" "}
          {error}
        </div>
      )}

      {success && (
        <div style={styles.successAlert}>
          {success}
        </div>
      )}

      <div style={styles.statsGrid}>
        <StatCard
          title="Total Backups"
          value={backups.length}
          icon="💾"
        />

        <StatCard
          title="Completed"
          value={completedBackups}
          icon="✓"
        />

        <StatCard
          title="Failed"
          value={failedBackups}
          icon="!"
        />

        <StatCard
          title="Latest Backup"
          value={
            latestBackup
              ? formatDate(
                  getBackupDate(
                    latestBackup
                  )
                )
              : "—"
          }
          icon="🕒"
          smallValue
        />
      </div>

      <div style={styles.mainGrid}>
        <section style={styles.createCard}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Create New Backup
              </h2>

              <p style={styles.cardDescription}>
                Select the backup options before
                starting the backup operation.
              </p>
            </div>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.field}>
              <label style={styles.label}>
                Backup Type
              </label>

              <select
                value={backupType}
                onChange={(event) =>
                  setBackupType(
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="Full">
                  Full Backup
                </option>

                <option value="Database">
                  Database Only
                </option>

                <option value="Files">
                  Files Only
                </option>
              </select>
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={includeFiles}
                onChange={(event) =>
                  setIncludeFiles(
                    event.target.checked
                  )
                }
              />

              <span>
                Include uploaded files and
                documents
              </span>
            </label>

            <div style={styles.infoBox}>
              <strong>
                Backup information
              </strong>

              <p>
                Backups should be created regularly
                and stored securely. Restoring a
                backup can affect current system data.
              </p>
            </div>

            <button
              type="button"
              onClick={createBackup}
              disabled={creating}
              style={{
                ...styles.fullButton,
                opacity: creating
                  ? 0.7
                  : 1,
              }}
            >
              {creating
                ? "Creating..."
                : "Start Backup"}
            </button>
          </div>
        </section>

        <section style={styles.securityCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              Backup Guidelines
            </h2>
          </div>

          <div style={styles.guidelines}>
            <Guideline
              number="1"
              title="Create regular backups"
              text="Maintain recent copies of important system data."
            />

            <Guideline
              number="2"
              title="Protect backup files"
              text="Store backup files in a controlled and secure location."
            />

            <Guideline
              number="3"
              title="Verify backup status"
              text="Review completed and failed backup operations."
            />

            <Guideline
              number="4"
              title="Test restoration"
              text="Periodically verify that backup restoration procedures work correctly."
            />
          </div>
        </section>
      </div>

      <section style={styles.tableCard}>
        <div style={styles.cardHeaderRow}>
          <div>
            <h2 style={styles.cardTitle}>
              Backup History
            </h2>

            <p style={styles.cardDescription}>
              Previous backup operations and their
              current status.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBackups}
            style={styles.refreshButton}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>
              Loading backup history...
            </span>
          </div>
        ) : backups.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              💾
            </div>

            <h3 style={styles.emptyTitle}>
              No backups found
            </h3>

            <p style={styles.emptyText}>
              Create the first system backup to
              start maintaining backup history.
            </p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    Backup
                  </th>

                  <th style={styles.th}>
                    Type
                  </th>

                  <th style={styles.th}>
                    Size
                  </th>

                  <th style={styles.th}>
                    Date
                  </th>

                  <th style={styles.th}>
                    Status
                  </th>

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
                {backups.map(
                  (backup, index) => {
                    const id =
                      getBackupId(
                        backup
                      ) ||
                      `backup-${index}`;

                    const status =
                      getBackupStatus(
                        backup
                      );

                    return (
                      <tr
                        key={id}
                        style={
                          styles.tr
                        }
                      >
                        <td
                          style={
                            styles.td
                          }
                        >
                          <div
                            style={
                              styles.backupName
                            }
                          >
                            {getBackupName(
                              backup
                            )}
                          </div>

                          <div
                            style={
                              styles.backupId
                            }
                          >
                            ID:{" "}
                            {getBackupId(
                              backup
                            ) || "—"}
                          </div>
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <span
                            style={
                              styles.typeBadge
                            }
                          >
                            {getBackupType(
                              backup
                            )}
                          </span>
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {getBackupSize(
                            backup
                          )}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {formatDate(
                            getBackupDate(
                              backup
                            )
                          )}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...statusStyle(
                                status
                              ),
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        <td
                          style={{
                            ...styles.td,
                            textAlign:
                              "right",
                          }}
                        >
                          <div
                            style={
                              styles.actions
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openDetails(
                                  backup
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
                                downloadBackup(
                                  backup
                                )
                              }
                              disabled={
                                downloading ===
                                id
                              }
                              style={
                                styles.actionButton
                              }
                            >
                              {downloading ===
                              id
                                ? "..."
                                : "Download"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                restoreBackup(
                                  backup
                                )
                              }
                              disabled={
                                restoring ===
                                id
                              }
                              style={
                                styles.restoreButton
                              }
                            >
                              {restoring ===
                              id
                                ? "..."
                                : "Restore"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteBackup(
                                  backup
                                )
                              }
                              disabled={
                                deleting ===
                                id
                              }
                              style={
                                styles.deleteButton
                              }
                            >
                              {deleting ===
                              id
                                ? "..."
                                : "Delete"}
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
      </section>

      {showDetails &&
        selectedBackup && (
          <div
            style={styles.overlay}
            onClick={() =>
              setShowDetails(false)
            }
          >
            <div
              style={styles.modal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div style={styles.modalHeader}>
                <div>
                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    Backup Details
                  </h2>

                  <p
                    style={
                      styles.modalSubtitle
                    }
                  >
                    {getBackupName(
                      selectedBackup
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetails(
                      false
                    )
                  }
                  style={
                    styles.closeButton
                  }
                >
                  ×
                </button>
              </div>

              <div
                style={
                  styles.detailsGrid
                }
              >
                <Detail
                  label="Backup ID"
                  value={
                    getBackupId(
                      selectedBackup
                    ) || "—"
                  }
                />

                <Detail
                  label="Backup Name"
                  value={getBackupName(
                    selectedBackup
                  )}
                />

                <Detail
                  label="Type"
                  value={getBackupType(
                    selectedBackup
                  )}
                />

                <Detail
                  label="Size"
                  value={getBackupSize(
                    selectedBackup
                  )}
                />

                <Detail
                  label="Status"
                  value={getBackupStatus(
                    selectedBackup
                  )}
                />

                <Detail
                  label="Created"
                  value={formatDate(
                    getBackupDate(
                      selectedBackup
                    )
                  )}
                />

                <Detail
                  label="File"
                  value={
                    selectedBackup?.filePath ||
                    selectedBackup?.file_path ||
                    selectedBackup?.path ||
                    "—"
                  }
                />

                <Detail
                  label="Created By"
                  value={
                    selectedBackup?.createdByName ||
                    selectedBackup?.created_by_name ||
                    selectedBackup?.createdBy ||
                    "—"
                  }
                />
              </div>

              <div
                style={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowDetails(
                      false
                    )
                  }
                  style={
                    styles.secondaryButton
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    downloadBackup(
                      selectedBackup
                    );
                  }}
                  style={
                    styles.primaryButton
                  }
                >
                  Download Backup
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  smallValue = false,
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>
        {icon}
      </div>

      <div>
        <div style={styles.statTitle}>
          {title}
        </div>

        <div
          style={{
            ...styles.statValue,
            ...(smallValue
              ? styles.statValueSmall
              : {}),
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Guideline({
  number,
  title,
  text,
}) {
  return (
    <div style={styles.guideline}>
      <div style={styles.guidelineNumber}>
        {number}
      </div>

      <div>
        <div style={styles.guidelineTitle}>
          {title}
        </div>

        <div style={styles.guidelineText}>
          {text}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div style={styles.detail}>
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
    background: "#F3F6F9",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, Arial, sans-serif",
    color: "#111827",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "24px",
  },

  breadcrumb: {
    fontSize: "13px",
    color: "#64748B",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },

  subtitle: {
    margin: "7px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#64748B",
  },

  primaryButton: {
    border: "none",
    borderRadius: "8px",
    background: "#3074B3",
    color: "#FFFFFF",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorAlert: {
    marginBottom: "18px",
    padding: "13px 16px",
    borderRadius: "8px",
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#B91C1C",
    fontSize: "14px",
  },

  successAlert: {
    marginBottom: "18px",
    padding: "13px 16px",
    borderRadius: "8px",
    border: "1px solid #BBF7D0",
    background: "#F0FDF4",
    color: "#166534",
    fontSize: "14px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "18px",
    boxShadow:
      "0 1px 3px rgba(15,23,42,0.04)",
  },

  statIcon: {
    width: "42px",
    height: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9px",
    background: "#EAF2FA",
    fontSize: "20px",
  },

  statTitle: {
    fontSize: "12px",
    color: "#64748B",
    marginBottom: "5px",
  },

  statValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#111827",
  },

  statValueSmall: {
    fontSize: "15px",
    lineHeight: 1.4,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
    gap: "20px",
    marginBottom: "20px",
  },

  createCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    overflow: "hidden",
  },

  securityCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    overflow: "hidden",
  },

  cardHeader: {
    padding: "20px 22px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  cardTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "#111827",
  },

  cardDescription: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#64748B",
    lineHeight: 1.5,
  },

  cardBody: {
    padding: "22px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    marginBottom: "18px",
  },

  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
    background: "#FFFFFF",
    color: "#111827",
    fontSize: "14px",
    outline: "none",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontSize: "14px",
    color: "#334155",
    marginBottom: "18px",
    cursor: "pointer",
  },

  infoBox: {
    padding: "14px",
    borderRadius: "8px",
    background: "#F5F7FA",
    border: "1px solid #E2E8F0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.5,
    marginBottom: "18px",
  },

  fullButton: {
    width: "100%",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    background: "#3074B3",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  guidelines: {
    padding: "8px 22px 18px",
  },

  guideline: {
    display: "flex",
    gap: "12px",
    padding: "15px 0",
    borderBottom:
      "1px solid #E2E8F0",
  },

  guidelineNumber: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#EAF2FA",
    color: "#3074B3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 700,
  },

  guidelineTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1E293B",
  },

  guidelineText: {
    marginTop: "4px",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  tableCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    overflow: "hidden",
  },

  cardHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "20px 22px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  refreshButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "8px 13px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: "900px",
    borderCollapse: "collapse",
  },

  th: {
    padding: "12px 16px",
    background: "#F5F7FA",
    borderBottom:
      "1px solid #E2E8F0",
    color: "#64748B",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom:
      "1px solid #F1F5F9",
  },

  td: {
    padding: "14px 16px",
    color: "#334155",
    fontSize: "13px",
    verticalAlign: "middle",
  },

  backupName: {
    fontWeight: 600,
    color: "#1E293B",
  },

  backupId: {
    marginTop: "4px",
    fontSize: "11px",
    color: "#94A3B8",
  },

  typeBadge: {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#F1F5F9",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 600,
  },

  statusBadge: {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
  },

  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "6px",
    flexWrap: "wrap",
  },

  actionButton: {
    border: "1px solid #CBD5E1",
    borderRadius: "6px",
    background: "#FFFFFF",
    color: "#334155",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },

  restoreButton: {
    border: "1px solid #BFDBFE",
    borderRadius: "6px",
    background: "#EAF2FA",
    color: "#245783",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },

  deleteButton: {
    border: "1px solid #FECACA",
    borderRadius: "6px",
    background: "#FEF2F2",
    color: "#B91C1C",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },

  loading: {
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "#64748B",
    fontSize: "14px",
  },

  spinner: {
    width: "30px",
    height: "30px",
    border: "3px solid #E2E8F0",
    borderTop:
      "3px solid #3074B3",
    borderRadius: "50%",
    animation:
      "spin 0.8s linear infinite",
  },

  empty: {
    padding: "60px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "38px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin: 0,
    fontSize: "17px",
    color: "#1E293B",
  },

  emptyText: {
    margin: "7px auto 0",
    maxWidth: "420px",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background:
      "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box",
  },

  modal: {
    width: "100%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#FFFFFF",
    borderRadius: "12px",
    boxShadow:
      "0 20px 50px rgba(15,23,42,0.2)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    padding: "20px 22px",
    borderBottom:
      "1px solid #E2E8F0",
  },

  modalTitle: {
    margin: 0,
    fontSize: "19px",
    fontWeight: 700,
  },

  modalSubtitle: {
    margin: "5px 0 0",
    color: "#64748B",
    fontSize: "13px",
  },

  closeButton: {
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "6px",
    background: "#F1F5F9",
    color: "#475569",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    padding: "22px",
  },

  detail: {
    minWidth: 0,
  },

  detailLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "5px",
  },

  detailValue: {
    fontSize: "14px",
    color: "#334155",
    wordBreak: "break-word",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "16px 22px",
    borderTop:
      "1px solid #E2E8F0",
  },
};