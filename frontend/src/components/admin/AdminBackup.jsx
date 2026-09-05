import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

/**
 * AdminBackup
 *
 * BACKUP MANAGEMENT
 * ├── Create Backup
 * ├── Backup History
 * ├── Restore
 * ├── Backup Status
 * └── Backup Information
 *     ├── Backup Date
 *     ├── Backup Type
 *     ├── File Size
 *     ├── Created By
 *     ├── Status
 *     └── Restore Status
 */
const AdminBackup = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [verifying, setVerifying] = useState(null);

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);

  const t = language === 'en'
    ? englishTranslations
    : amharicTranslations;

  /* =========================================================
     THEME
  ========================================================= */

  const colors = {
    background: isDark ? '#0f172a' : '#f5f7fb',
    card: isDark ? '#1e293b' : '#ffffff',
    cardSecondary: isDark ? '#172033' : '#f8fafc',
    text: isDark ? '#e2e8f0' : '#1e293b',
    subText: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',

    primary: '#2563eb',
    primaryHover: '#1d4ed8',

    success: '#16a34a',
    successBg: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7',

    danger: '#dc2626',
    dangerBg: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2',

    warning: '#d97706',
    warningBg: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',

    info: '#0284c7',
    infoBg: isDark ? 'rgba(2,132,199,0.15)' : '#e0f2fe',

    purple: '#7c3aed',
    purpleBg: isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe',

    shadow: isDark
      ? '0 4px 16px rgba(0,0,0,0.25)'
      : '0 4px 16px rgba(15,23,42,0.06)'
  };

  /* =========================================================
     FETCH BACKUPS
  ========================================================= */

  const fetchBackups = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const params = {
        search: searchQuery.trim() || undefined,
        type: 'JSON'
      };

      if (filter === 'completed') {
        params.status = 'Completed';
      }

      if (filter === 'failed') {
        params.status = 'Failed';
      }

      const response = await apiClient.get('/api/backups', {
        params
      });

      const responseData = response.data || {};

      const rawBackups =
        responseData.backups ||
        responseData.data ||
        responseData.logs ||
        (Array.isArray(responseData) ? responseData : []);

      const normalized = Array.isArray(rawBackups)
        ? rawBackups.map((backup) => ({
            ...backup,

            id:
              backup.id ||
              backup._id ||
              backup.filename,

            filename:
              backup.filename ||
              backup.fileName ||
              backup.name ||
              'Unknown Backup',

            created_at:
              backup.created_at ||
              backup.createdAt ||
              backup.date ||
              backup.createdAt,

            created_by:
              backup.created_by ||
              backup.createdBy ||
              backup.user?.username ||
              backup.user?.name ||
              '',

            type:
              backup.type ||
              backup.backupType ||
              'JSON',

            size:
              Number(
                backup.size ||
                backup.fileSize ||
                backup.file_size ||
                0
              ),

            status:
              backup.status ||
              'Invalid',

            restoreStatus:
              backup.restoreStatus ||
              backup.restore_status ||
              'Not Restored',

            notes:
              backup.notes ||
              backup.description ||
              ''
          }))
        : [];

      normalized.sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      );

      setBackups(normalized);
    } catch (error) {
      console.error('Error loading backups:', error);

      setLoadError(
        error?.response?.data?.message ||
        t.loadFailed
      );

      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [filter, searchQuery]);

  /* =========================================================
     CREATE BACKUP
  ========================================================= */

  const createBackup = async () => {
    if (creating) return;

    setCreating(true);

    try {
      const response = await apiClient.post('/api/backups');

      if (response.data?.success === false) {
        throw new Error(
          response.data?.message || t.createFailed
        );
      }

      toast.success(
        response.data?.message || t.backupCreated
      );

      await fetchBackups();
    } catch (error) {
      console.error('Create backup error:', error);

      toast.error(
        error?.response?.data?.message ||
        t.createFailed
      );
    } finally {
      setCreating(false);
    }
  };

  /* =========================================================
     DOWNLOAD BACKUP
  ========================================================= */

  const downloadBackup = async (filename) => {
    if (!filename) {
      toast.error(t.downloadFailed);
      return;
    }

    try {
      const response = await apiClient.get(
        `/api/backups/download/${encodeURIComponent(filename)}`,
        {
          responseType: 'blob'
        }
      );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data]);

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success(t.downloadStarted);
    } catch (error) {
      console.error('Download backup error:', error);

      toast.error(
        error?.response?.data?.message ||
        t.downloadFailed
      );
    }
  };

  /* =========================================================
     VERIFY BACKUP
  ========================================================= */

  const verifyBackup = async (filename) => {
    if (!filename || verifying) return;

    setVerifying(filename);

    try {
      const response = await apiClient.get(
        `/api/backups/verify/${encodeURIComponent(filename)}`
      );

      if (
        response.data?.valid === true ||
        response.data?.success === true
      ) {
        toast.success(
          response.data?.message ||
          t.verifySuccess
        );
      } else {
        toast.warning(
          response.data?.message ||
          t.verifyFailed
        );
      }

      await fetchBackups();
    } catch (error) {
      console.error('Verify backup error:', error);

      toast.error(
        error?.response?.data?.message ||
        t.verifyError
      );
    } finally {
      setVerifying(null);
    }
  };

  /* =========================================================
     RESTORE BACKUP
  ========================================================= */

  const openRestoreModal = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const closeRestoreModal = () => {
    if (restoring) return;

    setShowRestoreModal(false);
    setSelectedBackup(null);
  };

  const restoreBackup = async () => {
    if (!selectedBackup?.filename || restoring) {
      return;
    }

    const filename = selectedBackup.filename;

    setRestoring(filename);

    try {
      const response = await apiClient.post(
        `/api/backups/restore/${encodeURIComponent(filename)}`
      );

      if (response.data?.success === false) {
        throw new Error(
          response.data?.message || t.restoreFailed
        );
      }

      toast.success(
        response.data?.message ||
        t.restoreSuccess
      );

      closeRestoreModal();

      await fetchBackups();
    } catch (error) {
      console.error('Restore backup error:', error);

      toast.error(
        error?.response?.data?.message ||
        t.restoreFailed
      );
    } finally {
      setRestoring(null);
    }
  };

  /* =========================================================
     DELETE BACKUP
  ========================================================= */

  const deleteBackup = async (filename) => {
    if (!filename || deleting) return;

    const confirmed = window.confirm(
      t.confirmDelete
    );

    if (!confirmed) return;

    setDeleting(filename);

    try {
      const response = await apiClient.delete(
        `/api/backups/${encodeURIComponent(filename)}`
      );

      if (response.data?.success === false) {
        throw new Error(
          response.data?.message || t.deleteFailed
        );
      }

      toast.success(
        response.data?.message ||
        t.deleteSuccess
      );

      await fetchBackups();
    } catch (error) {
      console.error('Delete backup error:', error);

      toast.error(
        error?.response?.data?.message ||
        t.deleteFailed
      );
    } finally {
      setDeleting(null);
    }
  };

  /* =========================================================
     FILE SIZE
  ========================================================= */

  const getFileSize = (bytes) => {
    const value = Number(bytes) || 0;

    if (value <= 0) {
      return '0 B';
    }

    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  /* =========================================================
     DATE
  ========================================================= */

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString();
  };

  /* =========================================================
     STATUS
  ========================================================= */

  const getStatusInfo = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (
      normalized === 'completed' ||
      normalized === 'success' ||
      normalized === 'successful' ||
      normalized === 'valid'
    ) {
      return {
        color: colors.success,
        background: colors.successBg,
        icon: '✓',
        label: status || 'Completed'
      };
    }

    if (
      normalized === 'failed' ||
      normalized === 'invalid' ||
      normalized === 'error'
    ) {
      return {
        color: colors.danger,
        background: colors.dangerBg,
        icon: '✕',
        label: status || 'Failed'
      };
    }

    if (
      normalized === 'in progress' ||
      normalized === 'processing'
    ) {
      return {
        color: colors.info,
        background: colors.infoBg,
        icon: '↻',
        label: status || 'In Progress'
      };
    }

    if (normalized === 'pending') {
      return {
        color: colors.warning,
        background: colors.warningBg,
        icon: '!',
        label: status || 'Pending'
      };
    }

    return {
      color: colors.subText,
      background: isDark ? '#334155' : '#f1f5f9',
      icon: '•',
      label: status || 'Unknown'
    };
  };

  const getRestoreInfo = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (
      normalized.includes('restored') &&
      !normalized.includes('not')
    ) {
      return {
        color: colors.success,
        background: colors.successBg,
        icon: '↺'
      };
    }

    if (
      normalized.includes('failed') ||
      normalized.includes('error')
    ) {
      return {
        color: colors.danger,
        background: colors.dangerBg,
        icon: '✕'
      };
    }

    return {
      color: colors.subText,
      background: isDark ? '#334155' : '#f1f5f9',
      icon: '—'
    };
  };

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredBackups = useMemo(() => {
    let result = [...backups];

    if (filter === 'completed') {
      result = result.filter(
        (backup) =>
          String(backup.status).toLowerCase() ===
          'completed'
      );
    }

    if (filter === 'failed') {
      result = result.filter((backup) => {
        const status =
          String(backup.status).toLowerCase();

        return (
          status === 'failed' ||
          status === 'invalid' ||
          status === 'error'
        );
      });
    }

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((backup) => {
        const filename =
          String(backup.filename || '').toLowerCase();

        const creator =
          String(backup.created_by || '').toLowerCase();

        const type =
          String(backup.type || '').toLowerCase();

        const status =
          String(backup.status || '').toLowerCase();

        return (
          filename.includes(query) ||
          creator.includes(query) ||
          type.includes(query) ||
          status.includes(query)
        );
      });
    }

    return result;
  }, [backups, filter, searchQuery]);

  /* =========================================================
     STATS
  ========================================================= */

  const stats = useMemo(() => {
    const total = backups.length;

    const completed = backups.filter(
      (backup) =>
        String(backup.status).toLowerCase() ===
        'completed'
    ).length;

    const failed = backups.filter((backup) => {
      const status =
        String(backup.status).toLowerCase();

      return (
        status === 'failed' ||
        status === 'invalid' ||
        status === 'error'
      );
    }).length;

    const pending = backups.filter((backup) => {
      const status =
        String(backup.status).toLowerCase();

      return (
        status === 'pending' ||
        status === 'in progress' ||
        status === 'processing'
      );
    }).length;

    const totalSize = backups.reduce(
      (sum, backup) =>
        sum + (Number(backup.size) || 0),
      0
    );

    const restored = backups.filter((backup) => {
      const status =
        String(backup.restoreStatus || '').toLowerCase();

      return (
        status.includes('restored') &&
        !status.includes('not')
      );
    }).length;

    return {
      total,
      completed,
      failed,
      pending,
      restored,
      totalSize
    };
  }, [backups]);

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setFilter('all');
    setSearchQuery('');
  };

  /* =========================================================
     BUTTON COMPONENT
  ========================================================= */

  const buttonStyle = (
    background,
    disabled = false
  ) => ({
    padding: '8px 13px',
    border: 'none',
    borderRadius: '7px',
    background: disabled
      ? '#94a3b8'
      : background,
    color: '#ffffff',
    cursor: disabled
      ? 'not-allowed'
      : 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    opacity: disabled ? 0.65 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    minHeight: '34px'
  });

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        color: colors.text,
        padding: '24px'
      }}
    >
      <div
        style={{
          maxWidth: '1250px',
          margin: '0 auto'
        }}
      >
        {/* ===================================================
            HEADER
        =================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.8rem',
                fontWeight: 750,
                color: colors.text
              }}
            >
              💾 {t.backupManager}
            </h1>

            <p
              style={{
                margin: '6px 0 0',
                color: colors.subText,
                fontSize: '0.9rem'
              }}
            >
              {t.backupSubtitle}
            </p>
          </div>

          <button
            onClick={createBackup}
            disabled={creating}
            style={{
              ...buttonStyle(colors.success, creating),
              padding: '11px 20px',
              fontSize: '0.9rem'
            }}
          >
            {creating
              ? `⏳ ${t.creating}`
              : `➕ ${t.createBackup}`}
          </button>
        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {loadError && (
          <div
            style={{
              background: colors.dangerBg,
              color: colors.danger,
              border: `1px solid ${colors.danger}`,
              borderRadius: '9px',
              padding: '12px 15px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span>⚠️ {loadError}</span>

            <button
              onClick={fetchBackups}
              style={buttonStyle(colors.danger)}
            >
              🔄 {t.retry}
            </button>
          </div>
        )}

        {/* ===================================================
            STATISTICS
        =================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}
        >
          <StatCard
            icon="💾"
            label={t.total}
            value={stats.total}
            colors={colors}
          />

          <StatCard
            icon="✅"
            label={t.completed}
            value={stats.completed}
            colors={colors}
            valueColor={colors.success}
          />

          <StatCard
            icon="❌"
            label={t.failed}
            value={stats.failed}
            colors={colors}
            valueColor={colors.danger}
          />

          <StatCard
            icon="⏳"
            label={t.pending}
            value={stats.pending}
            colors={colors}
            valueColor={colors.warning}
          />

          <StatCard
            icon="↺"
            label={t.restored}
            value={stats.restored}
            colors={colors}
            valueColor={colors.primary}
          />

          <StatCard
            icon="📦"
            label={t.totalSize}
            value={getFileSize(stats.totalSize)}
            colors={colors}
          />
        </div>

        {/* ===================================================
            FILTERS
        =================================================== */}

        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
            boxShadow: colors.shadow
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: colors.text,
              marginBottom: '12px'
            }}
          >
            🔍 {t.filters}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              placeholder={t.searchPlaceholder}
              style={{
                flex: 1,
                minWidth: '220px',
                padding: '10px 13px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                background: colors.cardSecondary,
                color: colors.text,
                outline: 'none'
              }}
            />

            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value)
              }
              style={{
                padding: '10px 13px',
                minWidth: '160px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                background: colors.cardSecondary,
                color: colors.text,
                cursor: 'pointer'
              }}
            >
              <option value="all">
                {t.allBackups}
              </option>

              <option value="completed">
                {t.completedOnly}
              </option>

              <option value="failed">
                {t.failedOnly}
              </option>
            </select>

            {(filter !== 'all' ||
              searchQuery) && (
              <button
                onClick={clearFilters}
                style={buttonStyle('#64748b')}
              >
                ✕ {t.clearFilters}
              </button>
            )}

            <button
              onClick={fetchBackups}
              disabled={loading}
              style={buttonStyle(
                colors.primary,
                loading
              )}
            >
              🔄 {t.refresh}
            </button>
          </div>
        </div>

        {/* ===================================================
            BACKUP HISTORY HEADER
        =================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            gap: '10px'
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.15rem',
                color: colors.text
              }}
            >
              📜 {t.backupHistory}
            </h2>

            <p
              style={{
                margin: '4px 0 0',
                color: colors.subText,
                fontSize: '0.8rem'
              }}
            >
              {filteredBackups.length} {t.backupsFound}
            </p>
          </div>
        </div>

        {/* ===================================================
            LOADING
        =================================================== */}

        {loading ? (
          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '60px 20px',
              textAlign: 'center',
              boxShadow: colors.shadow
            }}
          >
            <div
              style={{
                fontSize: '2.2rem',
                marginBottom: '10px'
              }}
            >
              ⏳
            </div>

            <div
              style={{
                color: colors.subText
              }}
            >
              {t.loading}
            </div>
          </div>
        ) : backups.length === 0 ? (
          /* =================================================
             NO BACKUPS
          ================================================== */

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '65px 20px',
              textAlign: 'center',
              boxShadow: colors.shadow
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                marginBottom: '15px'
              }}
            >
              📂
            </div>

            <h3
              style={{
                margin: '0 0 8px',
                color: colors.text
              }}
            >
              {t.noBackups}
            </h3>

            <p
              style={{
                color: colors.subText,
                maxWidth: '550px',
                margin: '0 auto'
              }}
            >
              {t.noBackupsDesc}
            </p>

            <button
              onClick={createBackup}
              disabled={creating}
              style={{
                ...buttonStyle(
                  colors.success,
                  creating
                ),
                marginTop: '20px',
                padding: '11px 20px'
              }}
            >
              ➕ {t.createFirstBackup}
            </button>
          </div>
        ) : filteredBackups.length === 0 ? (
          /* =================================================
             NO FILTER RESULTS
          ================================================== */

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '60px 20px',
              textAlign: 'center',
              boxShadow: colors.shadow
            }}
          >
            <div
              style={{
                fontSize: '3.5rem',
                marginBottom: '12px'
              }}
            >
              🔍
            </div>

            <h3
              style={{
                color: colors.text,
                margin: '0 0 8px'
              }}
            >
              {t.noResults}
            </h3>

            <p
              style={{
                color: colors.subText
              }}
            >
              {t.noResultsDesc}
            </p>

            <button
              onClick={clearFilters}
              style={{
                ...buttonStyle('#64748b'),
                marginTop: '10px'
              }}
            >
              {t.clearFilters}
            </button>
          </div>
        ) : (
          /* =================================================
             BACKUP LIST
          ================================================== */

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {filteredBackups.map((backup, index) => {
              const statusInfo =
                getStatusInfo(backup.status);

              const restoreInfo =
                getRestoreInfo(
                  backup.restoreStatus
                );

              const isDeleting =
                deleting === backup.filename;

              const isVerifying =
                verifying === backup.filename;

              const isRestoring =
                restoring === backup.filename;

              return (
                <div
                  key={
                    backup.id ||
                    backup.filename ||
                    index
                  }
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '18px',
                    boxShadow: colors.shadow
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems: 'center',
                      gap: '18px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* BACKUP INFO */}

                    <div
                      style={{
                        display: 'flex',
                        alignItems:
                          'flex-start',
                        gap: '14px',
                        flex: 1,
                        minWidth: '280px'
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          minWidth: '48px',
                          borderRadius: '10px',
                          background:
                            statusInfo.background,
                          display: 'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          fontSize: '1.5rem'
                        }}
                      >
                        {backup.status ===
                        'Completed'
                          ? '💾'
                          : '⚠️'}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          flex: 1
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems:
                              'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginBottom:
                              '6px'
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                colors.text,
                              fontSize:
                                '0.95rem',
                              wordBreak:
                                'break-all'
                            }}
                          >
                            {backup.filename}
                          </span>

                          <StatusBadge
                            info={statusInfo}
                          />

                          <span
                            style={{
                              padding:
                                '3px 9px',
                              borderRadius:
                                '20px',
                              background:
                                colors.infoBg,
                              color:
                                colors.info,
                              fontSize:
                                '0.7rem',
                              fontWeight: 700
                            }}
                          >
                            {backup.type}
                          </span>
                        </div>

                        {/* BACKUP INFORMATION */}

                        <div
                          style={{
                            display: 'flex',
                            gap: '14px',
                            flexWrap: 'wrap',
                            color:
                              colors.subText,
                            fontSize:
                              '0.78rem'
                          }}
                        >
                          <span>
                            📅{' '}
                            {formatDate(
                              backup.created_at
                            )}
                          </span>

                          <span>
                            📦{' '}
                            {getFileSize(
                              backup.size
                            )}
                          </span>

                          <span>
                            👤{' '}
                            {backup.created_by ||
                              'System'}
                          </span>

                          <span>
                            ↺{' '}
                            {t.restoreStatus}:{' '}
                            <strong
                              style={{
                                color:
                                  restoreInfo.color
                              }}
                            >
                              {backup.restoreStatus ||
                                t.notRestored}
                            </strong>
                          </span>
                        </div>

                        {backup.notes && (
                          <div
                            style={{
                              marginTop:
                                '7px',
                              fontSize:
                                '0.78rem',
                              color:
                                colors.subText,
                              fontStyle:
                                'italic'
                            }}
                          >
                            📝 {backup.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}

                    <div
                      style={{
                        display: 'flex',
                        gap: '7px',
                        flexWrap: 'wrap',
                        justifyContent:
                          'flex-end'
                      }}
                    >
                      <button
                        onClick={() =>
                          verifyBackup(
                            backup.filename
                          )
                        }
                        disabled={
                          isVerifying ||
                          isDeleting ||
                          isRestoring
                        }
                        style={buttonStyle(
                          colors.success,
                          isVerifying ||
                            isDeleting ||
                            isRestoring
                        )}
                        title={t.verify}
                      >
                        {isVerifying
                          ? '⏳'
                          : '✓'}{' '}
                        {isVerifying
                          ? t.verifying
                          : t.verify}
                      </button>

                      <button
                        onClick={() =>
                          downloadBackup(
                            backup.filename
                          )
                        }
                        disabled={
                          isDeleting ||
                          isRestoring
                        }
                        style={buttonStyle(
                          colors.info,
                          isDeleting ||
                            isRestoring
                        )}
                        title={t.download}
                      >
                        📥 {t.download}
                      </button>

                      <button
                        onClick={() =>
                          openRestoreModal(
                            backup
                          )
                        }
                        disabled={
                          backup.status !==
                            'Completed' ||
                          isDeleting ||
                          isRestoring
                        }
                        style={buttonStyle(
                          colors.purple,
                          backup.status !==
                            'Completed' ||
                            isDeleting ||
                            isRestoring
                        )}
                        title={t.restore}
                      >
                        {isRestoring
                          ? '⏳'
                          : '↺'}{' '}
                        {t.restore}
                      </button>

                      <button
                        onClick={() =>
                          deleteBackup(
                            backup.filename
                          )
                        }
                        disabled={
                          isDeleting ||
                          isRestoring
                        }
                        style={buttonStyle(
                          colors.danger,
                          isDeleting ||
                            isRestoring
                        )}
                        title={t.delete}
                      >
                        {isDeleting
                          ? '⏳'
                          : '🗑️'}{' '}
                        {isDeleting
                          ? t.deleting
                          : t.delete}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===================================================
            INFORMATION
        =================================================== */}

        <div
          style={{
            marginTop: '22px',
            padding: '16px',
            background: colors.warningBg,
            border: `1px solid ${colors.warning}`,
            borderRadius: '10px',
            color: colors.warning,
            fontSize: '0.82rem'
          }}
        >
          <strong>
            ⚠️ {t.important}
          </strong>

          <div
            style={{
              marginTop: '6px'
            }}
          >
            {t.backupWarning}
          </div>
        </div>
      </div>

      {/* =====================================================
          RESTORE CONFIRMATION MODAL
      ====================================================== */}

      {showRestoreModal &&
        selectedBackup && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background:
                'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              padding: '20px',
              zIndex: 9999
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                background:
                  colors.card,
                borderRadius:
                  '16px',
                padding: '26px',
                boxShadow:
                  '0 25px 70px rgba(0,0,0,0.4)'
              }}
            >
              <div
                style={{
                  fontSize: '2.5rem',
                  textAlign:
                    'center',
                  marginBottom:
                    '10px'
                }}
              >
                ⚠️
              </div>

              <h2
                style={{
                  margin:
                    '0 0 10px',
                  textAlign:
                    'center',
                  color:
                    colors.text,
                  fontSize:
                    '1.25rem'
                }}
              >
                {t.restoreBackup}
              </h2>

              <p
                style={{
                  color:
                    colors.subText,
                  lineHeight: 1.6,
                  textAlign:
                    'center',
                  marginBottom:
                    '16px'
                }}
              >
                {t.confirmRestore}
              </p>

              <div
                style={{
                  padding: '12px',
                  background:
                    colors.cardSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius:
                    '8px',
                  marginBottom:
                    '20px',
                  textAlign:
                    'center',
                  color:
                    colors.text,
                  fontWeight: 700,
                  wordBreak:
                    'break-all'
                }}
              >
                💾{' '}
                {
                  selectedBackup.filename
                }
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'center',
                  gap: '10px'
                }}
              >
                <button
                  onClick={
                    closeRestoreModal
                  }
                  disabled={
                    Boolean(restoring)
                  }
                  style={{
                    ...buttonStyle(
                      '#64748b',
                      Boolean(restoring)
                    ),
                    padding:
                      '10px 22px'
                  }}
                >
                  {t.cancel}
                </button>

                <button
                  onClick={
                    restoreBackup
                  }
                  disabled={
                    Boolean(restoring)
                  }
                  style={{
                    ...buttonStyle(
                      colors.purple,
                      Boolean(restoring)
                    ),
                    padding:
                      '10px 22px'
                  }}
                >
                  {restoring
                    ? `⏳ ${t.restoring}`
                    : `↺ ${t.restore}`}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

/* ===========================================================
   STAT CARD
=========================================================== */

const StatCard = ({
  icon,
  label,
  value,
  colors,
  valueColor
}) => (
  <div
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '16px',
      boxShadow: colors.shadow
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '9px',
          background: colors.cardSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem'
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            fontSize: '0.72rem',
            color: colors.subText,
            marginBottom: '2px'
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: '1.35rem',
            fontWeight: 750,
            color:
              valueColor || colors.text
          }}
        >
          {value}
        </div>
      </div>
    </div>
  </div>
);

/* ===========================================================
   STATUS BADGE
=========================================================== */

const StatusBadge = ({ info }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 9px',
      borderRadius: '20px',
      background: info.background,
      color: info.color,
      fontSize: '0.7rem',
      fontWeight: 700
    }}
  >
    {info.icon} {info.label}
  </span>
);

/* ===========================================================
   ENGLISH
=========================================================== */

const englishTranslations = {
  backupManager: 'Backup Manager',

  backupSubtitle:
    'Create, manage, verify, download, restore and monitor system backups.',

  createBackup: 'Create Backup',
  createFirstBackup:
    'Create Your First Backup',

  creating: 'Creating...',
  loading: 'Loading...',
  verifying: 'Verifying...',
  deleting: 'Deleting...',
  restoring: 'Restoring...',

  total: 'Total',
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  restored: 'Restored',
  totalSize: 'Total Size',

  backupHistory: 'Backup History',
  backupsFound: 'backups found',

  filters: 'Filters',

  allBackups: 'All Backups',
  completedOnly: 'Completed Only',
  failedOnly: 'Failed Only',

  searchPlaceholder:
    'Search by filename, creator, type or status...',

  clearFilters: 'Clear Filters',
  refresh: 'Refresh',
  retry: 'Retry',

  noBackups: 'No Backups Found',

  noBackupsDesc:
    'Create your first system backup to protect your university asset management data.',

  noResults: 'No Results Found',

  noResultsDesc:
    'No backups match your current search or filter.',

  download: 'Download',
  restore: 'Restore',
  delete: 'Delete',
  verify: 'Verify',

  createdBy: 'Created By',
  restoreStatus: 'Restore Status',
  notRestored: 'Not Restored',

  restoreBackup: 'Restore Backup',

  confirmRestore:
    'Are you sure you want to restore this backup? The current system data may be overwritten. This operation should only be performed after confirming that the backup is valid.',

  confirmDelete:
    'Are you sure you want to delete this backup? This action cannot be undone.',

  cancel: 'Cancel',

  backupCreated:
    'Backup created successfully.',

  restoreSuccess:
    'Backup restored successfully.',

  deleteSuccess:
    'Backup deleted successfully.',

  verifySuccess:
    'Backup verified successfully.',

  verifyFailed:
    'Backup verification failed. The file may be corrupted.',

  verifyError:
    'Failed to verify backup.',

  downloadStarted:
    'Download started.',

  loadFailed:
    'Failed to load backups.',

  createFailed:
    'Failed to create backup.',

  downloadFailed:
    'Failed to download backup.',

  restoreFailed:
    'Failed to restore backup.',

  deleteFailed:
    'Failed to delete backup.',

  important: 'Important:',

  backupWarning:
    'Backups contain important system data. Verify a backup before restoring it. Keep regular backups and do not delete the only available copy.'
};

/* ===========================================================
   AMHARIC
=========================================================== */

const amharicTranslations = {
  backupManager: 'የምትኬ አስተዳደር',

  backupSubtitle:
    'የስርዓት ምትኬ ይፍጠሩ፣ ያስተዳድሩ፣ ያረጋግጡ፣ ያውርዱ እና ይመልሱ።',

  createBackup: 'ምትኬ ፍጠር',

  createFirstBackup:
    'የመጀመሪያ ምትኬዎን ይፍጠሩ',

  creating: 'በመፍጠር ላይ...',
  loading: 'በመጫን ላይ...',
  verifying: 'በማረጋገጥ ላይ...',
  deleting: 'በመሰረዝ ላይ...',
  restoring: 'በመመለስ ላይ...',

  total: 'ጠቅላላ',
  completed: 'የተጠናቀቀ',
  failed: 'ያልተሳካ',
  pending: 'በመጠባበቅ ላይ',
  restored: 'የተመለሰ',
  totalSize: 'ጠቅላላ መጠን',

  backupHistory: 'የምትኬ ታሪክ',
  backupsFound: 'ምትኬዎች ተገኝተዋል',

  filters: 'ማጣሪያዎች',

  allBackups: 'ሁሉም ምትኬዎች',
  completedOnly: 'የተጠናቀቁ ብቻ',
  failedOnly: 'ያልተሳኩ ብቻ',

  searchPlaceholder:
    'በፋይል ስም፣ ፈጣሪ፣ አይነት ወይም ሁኔታ ፈልግ...',

  clearFilters: 'ማጣሪያ አጽዳ',
  refresh: 'አድስ',
  retry: 'እንደገና ሞክር',

  noBackups: 'ምንም ምትኬ አልተገኘም',

  noBackupsDesc:
    'የዩኒቨርሲቲውን የAsset Management መረጃ ለመጠበቅ የመጀመሪያ ምትኬዎን ይፍጠሩ።',

  noResults: 'ምንም ውጤት አልተገኘም',

  noResultsDesc:
    'ከአሁኑ ፍለጋ ወይም ማጣሪያ ጋር የሚዛመድ ምትኬ የለም።',

  download: 'አውርድ',
  restore: 'መልስ',
  delete: 'ሰርዝ',
  verify: 'አረጋግጥ',

  createdBy: 'የፈጠረው',
  restoreStatus: 'የመመለስ ሁኔታ',
  notRestored: 'አልተመለሰም',

  restoreBackup: 'ምትኬን መልስ',

  confirmRestore:
    'ይህንን ምትኬ መመለስ እርግጠኛ ነዎት? አሁን ያለው የስርዓት መረጃ ሊተካ ይችላል። ምትኬው ትክክለኛ መሆኑን ካረጋገጡ በኋላ ብቻ ይህንን እርምጃ ይፈጽሙ።',

  confirmDelete:
    'ይህንን ምትኬ መሰረዝ እርግጠኛ ነዎት? ይህ እርምጃ መመለስ አይችልም።',

  cancel: 'ሰርዝ',

  backupCreated:
    'ምትኬ በተሳካ ሁኔታ ተፈጥሯል።',

  restoreSuccess:
    'ምትኬው በተሳካ ሁኔታ ተመልሷል።',

  deleteSuccess:
    'ምትኬው በተሳካ ሁኔታ ተሰርዟል።',

  verifySuccess:
    'ምትኬው በተሳካ ሁኔታ ተረጋግጧል።',

  verifyFailed:
    'የምትኬ ማረጋገጫ አልተሳካም። ፋይሉ የተበላሸ ሊሆን ይችላል።',

  verifyError:
    'ምትኬውን ማረጋገጥ አልተቻለም።',

  downloadStarted:
    'ማውረድ ተጀምሯል።',

  loadFailed:
    'ምትኬዎችን መጫን አልተቻለም።',

  createFailed:
    'ምትኬ መፍጠር አልተቻለም።',

  downloadFailed:
    'ምትኬውን ማውረድ አልተቻለም።',

  restoreFailed:
    'ምትኬውን መመለስ አልተቻለም።',

  deleteFailed:
    'ምትኬውን መሰረዝ አልተቻለም።',

  important: 'አስፈላጊ:',

  backupWarning:
    'ምትኬዎች አስፈላጊ የስርዓት መረጃዎችን ይይዛሉ። ምትኬን ከመመለስ በፊት ያረጋግጡ። መደበኛ ምትኬ ይፍጠሩ እና ብቸኛውን የምትኬ ቅጂ አይሰርዙ።'
};

export default AdminBackup;
