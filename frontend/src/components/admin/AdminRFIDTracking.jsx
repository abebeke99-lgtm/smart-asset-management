import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, Copy, Download, Printer, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import { translateMessage } from '../../i18n/messages';
import './AdminRFIDTracking.css';

const API_ROOT = '/api/admin/rfid';
const SUMMARY_FIELDS = ['totalAssets', 'rfidAssigned', 'qrAssigned', 'fullyTracked', 'notFullyTracked'];
const EMPTY_SUMMARY = { totalAssets: 0, rfidAssigned: 0, qrAssigned: 0, fullyTracked: 0, notFullyTracked: 0 };
const DETAIL_TABS = ['information', 'location', 'assignment', 'transfers', 'maintenance'];
const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};
const display = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const apiMessage = (error, fallback) => getApiErrorMessage(error, fallback) || fallback;
const assetFromResponse = (response) => {
  const payload = response?.data ?? {};
  const directAsset = payload.asset ?? payload.data?.asset ?? payload.data ?? null;
  if (!directAsset) return null;
  if (Array.isArray(directAsset)) return directAsset[0] ?? null;
  if (typeof directAsset === 'object' && 'id' in directAsset) return directAsset;
  return null;
};

export default function AdminRFIDTracking() {
  const { language } = useLanguage();
  const tr = useCallback((key) => translateMessage(language, `tracking.${key}`), [language]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryRetryKey, setSummaryRetryKey] = useState(0);
  const [assetIdInput, setAssetIdInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [scanLogError, setScanLogError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [trackingState, setTrackingState] = useState('idle');
  const [trackingError, setTrackingError] = useState('');
  const [activeTab, setActiveTab] = useState('information');
  const [scanning, setScanning] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const scannerRef = useRef(null);
  const scannerStartRef = useRef(Promise.resolve());
  const scanHandledRef = useRef(false);
  const listControllerRef = useRef(null);
  const summaryControllerRef = useRef(null);
  const lookupControllerRef = useRef(null);
  const trackingControllerRef = useRef(null);
  const mountedRef = useRef(false);
  const detailCloseRef = useRef(null);
  const detailOpen = Boolean(selectedAsset);

  const loadSummary = useCallback((signal) => {
    setSummaryLoading(true);
    setSummaryError('');
    apiClient.get(`${API_ROOT}/summary`, { signal })
      .then((response) => {
        if (signal.aborted) return;
        const data = response.data?.data;
        if (response.data?.success !== true || !data
          || SUMMARY_FIELDS.some((field) => !Number.isSafeInteger(data[field]) || data[field] < 0)) {
          throw new Error(tr('summaryLoadError'));
        }
        setSummary(Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, data[field]])));
      })
      .catch((error) => {
        if (signal.aborted) return;
        console.error('Admin RFID tracking summary request failed:', {
          status: error.response?.status || 0,
          responseBody: error.response?.data || null,
          message: error.message,
        });
        const serverMessage = error.response?.status >= 500 ? error.response?.data?.message : null;
        setSummaryError(serverMessage || apiMessage(error, tr('summaryLoadError')));
      })
      .finally(() => {
        if (!signal.aborted) setSummaryLoading(false);
      });
  }, [tr]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listControllerRef.current?.abort();
      summaryControllerRef.current?.abort();
      lookupControllerRef.current?.abort();
      trackingControllerRef.current?.abort();
      const scanner = scannerRef.current;
      if (scanner) {
        Promise.resolve(scannerStartRef.current)
          .catch(() => {})
          .then(() => scanner.stop())
          .catch(() => {})
          .then(() => { try { scanner.clear(); } catch {} })
          .catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    summaryControllerRef.current?.abort();
    summaryControllerRef.current = controller;
    loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary, refreshKey, summaryRetryKey]);

  useEffect(() => {
    const controller = new AbortController();
    listControllerRef.current?.abort();
    listControllerRef.current = controller;
    setLoading(true);
    setListError('');
    apiClient.get(`${API_ROOT}/assets`, {
      params: { search: debouncedSearch, status, page, limit: pagination.limit },
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        const data = response.data?.data || {};
        setAssets(Array.isArray(data.items) ? data.items : []);
        setPagination((current) => ({ ...current, ...(data.pagination || {}), page }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListError(apiMessage(error, tr('assetsLoadError')));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, status, page, pagination.limit, refreshKey, tr]);

  const openAsset = useCallback(async (assetOrId) => {
    const id = typeof assetOrId === 'object' ? assetOrId.id : assetOrId;
    const fallback = typeof assetOrId === 'object' ? assetOrId : null;
    trackingControllerRef.current?.abort();
    const controller = new AbortController();
    trackingControllerRef.current = controller;
    setSelectedAsset((current) => fallback || current);
    setTracking(null);
    setTrackingState('loading');
    setTrackingError('');
    setActiveTab('information');
    setQrInput('');
    setRfidInput('');
    try {
      const response = await apiClient.get(`${API_ROOT}/assets/${encodeURIComponent(id)}/tracking`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const data = response.data?.data;
      if (!data?.asset) throw new Error(tr('assetNotFound'));
      setTracking(data);
      setSelectedAsset(data.asset);
      setTrackingState('loaded');
    } catch (error) {
      if (controller.signal.aborted) return;
      setTrackingError(apiMessage(error, tr('trackingLoadError')));
      setTrackingState('error');
    }
  }, [tr]);

  const recordScan = useCallback(async (asset, value, method, signal) => {
    try {
      await apiClient.post(`${API_ROOT}/scan-log`, {
        asset_id: asset.id,
        method,
        value,
      }, { signal });
      if (mountedRef.current && !signal?.aborted) setScanLogError('');
    } catch (error) {
      if (signal?.aborted) return;
      const message = apiMessage(error, tr('scanLogError'));
      if (mountedRef.current) setScanLogError(message);
      toast.error(message);
    }
  }, [tr]);

  const lookup = useCallback(async (url, value, method) => {
    lookupControllerRef.current?.abort();
    const controller = new AbortController();
    lookupControllerRef.current = controller;
    setLookupLoading(true);
    setLookupError('');
    setScanLogError('');
    try {
      const response = await apiClient.get(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const asset = assetFromResponse(response);
      if (!asset) throw new Error(tr('assetNotFound'));
      const normalizedValue = value.trim().toUpperCase();
      const scanMethod = method === 'manual' && asset.qrCode?.trim().toUpperCase() === normalizedValue
        ? 'qr'
        : method === 'manual' && asset.rfidTag?.trim().toUpperCase() === normalizedValue
          ? 'rfid'
          : method;
      await recordScan(asset, value, scanMethod, controller.signal);
      if (controller.signal.aborted) return;
      await openAsset(asset);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Admin RFID tracking lookup failed:', {
        status: error.response?.status || 0,
        responseBody: error.response?.data || null,
        message: error.message,
      });
      const message = error.response?.status === 404
        ? tr('assetNotFound')
        : apiMessage(error, tr('lookupError'));
      setLookupError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setLookupLoading(false);
    }
  }, [openAsset, recordScan, tr]);

  const submitAssetId = (event) => {
    event.preventDefault();
    const value = assetIdInput.trim();
    if (value && !lookupLoading) void lookup(`${API_ROOT}/lookup/asset-id/${encodeURIComponent(value)}`, value, 'manual');
  };

  const submitCode = (event) => {
    event.preventDefault();
    const value = codeInput.trim();
    if (value && !lookupLoading) void lookup(`${API_ROOT}/lookup/code/${encodeURIComponent(value)}`, value, 'manual');
  };

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch (error) {
      if (mountedRef.current) setScannerMessage(apiMessage(error, tr('cameraStopError')));
    }
    try { scanner.clear(); } catch {}
    scannerRef.current = null;
    if (mountedRef.current) setScanning(false);
  }, [tr]);

  const startScanner = async () => {
    if (scannerRef.current || scanning) return;
    setScannerMessage('');
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!window.isSecureContext && !isLocalHost) {
      setScannerMessage(tr('httpsRequired'));
      return;
    }
    scanHandledRef.current = false;
    let scanner;
    try {
      scanner = new Html5Qrcode('admin-rfid-reader');
      scannerRef.current = scanner;
      const onDecode = (decodedText) => {
        if (scanHandledRef.current) return;
        scanHandledRef.current = true;
        const value = String(decodedText || '').trim();
        void stopScanner().then(() => {
          if (!value) {
            setLookupError(tr('invalidCode'));
            return;
          }
          void lookup(`${API_ROOT}/lookup/code/${encodeURIComponent(value)}`, value, 'qr');
        });
      };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      let starting = scanner.start({ facingMode: 'environment' }, config, onDecode, () => {});
      scannerStartRef.current = starting;
      try {
        await starting;
      } catch (cameraError) {
        const name = String(cameraError?.name || '').toLowerCase();
        const details = String(cameraError?.message || cameraError || '').toLowerCase();
        if (name.includes('notallowed') || name.includes('security') || details.includes('permission') || details.includes('denied')) {
          throw cameraError;
        }
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          const missingCamera = new Error('No camera found.');
          missingCamera.name = 'NotFoundError';
          throw missingCamera;
        }
        const camera = cameras.find((item) => /back|rear|environment/i.test(item.label || '')) || cameras[0];
        starting = scanner.start(camera.id, config, onDecode, () => {});
        scannerStartRef.current = starting;
        await starting;
      }
      if (mountedRef.current) setScanning(true);
    } catch (error) {
      if (scanner) {
        try { scanner.clear(); } catch {}
        if (scannerRef.current === scanner) scannerRef.current = null;
      }
      if (!mountedRef.current) return;
      setScanning(false);
      const name = String(error?.name || '').toLowerCase();
      const details = String(error?.message || error || '').toLowerCase();
      const message = name.includes('notallowed') || details.includes('permission') || details.includes('denied')
        ? tr('cameraPermissionDenied')
        : name.includes('notfound') || details.includes('no camera') || details.includes('camera device')
          ? tr('noCamera')
          : tr('cameraUnavailable');
      setScannerMessage(message);
    }
  };

  useEffect(() => {
    if (!detailOpen) return undefined;
    const previousFocus = document.activeElement;
    detailCloseRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [detailOpen]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && selectedAsset) {
        trackingControllerRef.current?.abort();
        setSelectedAsset(null);
        setTracking(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedAsset]);

  const closeDetails = () => {
    trackingControllerRef.current?.abort();
    setSelectedAsset(null);
    setTracking(null);
    setTrackingState('idle');
  };

  const reload = () => setRefreshKey((current) => current + 1);

  const updateTags = async (event) => {
    event.preventDefault();
    if (!selectedAsset || savingTags) return;
    const body = {};
    if (qrInput.trim()) body.qrCode = qrInput.trim();
    if (rfidInput.trim()) body.rfidTag = rfidInput.trim();
    if (!Object.keys(body).length) return;
    setSavingTags(true);
    try {
      await apiClient.post(`${API_ROOT}/assets/${encodeURIComponent(selectedAsset.id)}/tags`, body);
      toast.success(tr('tagsSaved'));
      reload();
      await openAsset(selectedAsset.id);
    } catch (error) {
      toast.error(apiMessage(error, tr('tagsSaveError')));
    } finally {
      setSavingTags(false);
    }
  };

  const regenerateQr = async () => {
    if (!selectedAsset || savingTags) return;
    setSavingTags(true);
    try {
      await apiClient.post(`${API_ROOT}/assets/${encodeURIComponent(selectedAsset.id)}/qr/regenerate`);
      toast.success(tr('qrRegenerated'));
      reload();
      await openAsset(selectedAsset.id);
    } catch (error) {
      toast.error(apiMessage(error, tr('tagsSaveError')));
    } finally {
      setSavingTags(false);
    }
  };

  const copyAssetId = async () => {
    try {
      await navigator.clipboard.writeText(String(selectedAsset.assetCode || selectedAsset.id));
      toast.success(tr('copied'));
    } catch (error) {
      toast.error(apiMessage(error, tr('copyError')));
    }
  };

  const downloadQr = () => {
    const svg = document.querySelector('.rfid-qr svg');
    if (!svg || !selectedAsset?.qrCode) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedAsset.qrCode}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    const svg = document.querySelector('.rfid-qr svg');
    if (!svg) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(tr('printBlocked'));
      return;
    }
    printWindow.opener = null;
    printWindow.document.write('<!doctype html><html><head><title></title></head><body></body></html>');
    printWindow.document.close();
    printWindow.document.title = tr('qrCode');
    printWindow.document.body.appendChild(svg.cloneNode(true));
    const caption = printWindow.document.createElement('p');
    caption.textContent = display(selectedAsset.qrCode);
    printWindow.document.body.appendChild(caption);
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const statusClass = (value) => {
    const normalized = String(value || '').toLowerCase().replace(/[_\s]+/g, '-');
    if (['available', 'in-use', 'active', 'assigned', 'completed'].includes(normalized)) return 'success';
    if (['reserved', 'pending', 'in-progress', 'under-maintenance', 'under-repair'].includes(normalized)) return 'warning';
    if (['damaged', 'disposed', 'retired', 'rejected', 'inactive'].includes(normalized)) return 'danger';
    return 'neutral';
  };

  const fields = (entries) => entries.map(([label, value]) => (
    <div className="rfid-detail-field" key={label}>
      <span className="rfid-detail-label">{tr(label)}</span>
      <span className="rfid-detail-value">{display(value)}</span>
    </div>
  ));

  const renderHistoryTable = (rows, columns) => {
    if (trackingState === 'loading') return <p className="rfid-empty">{tr('loading')}</p>;
    if (trackingState === 'error') return <p className="rfid-error" role="alert">{trackingError}</p>;
    if (!rows?.length) return <p className="rfid-empty">{tr('noHistory')}</p>;
    return (
      <div className="rfid-history">
        <table>
          <thead><tr>{columns.map(([label]) => <th key={label}>{tr(label)}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={row.id || `${row.ticketId || row.assignedAt || row.date}-${index}`}>
              {columns.map(([, key, formatter]) => (
                <td key={key}>{formatter ? formatter(row[key]) : display(row[key])}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  const tabContent = () => {
    if (trackingState === 'loading') return <p className="rfid-empty">{tr('loading')}</p>;
    if (trackingState === 'error') return <p className="rfid-error" role="alert">{trackingError}</p>;
    if (!tracking) return null;
    if (activeTab === 'information') {
      const asset = tracking.asset || selectedAsset;
      return (
        <>
          <div className="rfid-detail-grid">{fields([
            ['assetId', asset.assetCode || asset.id],
            ['name', asset.name],
            ['category', asset.category],
            ['serial', asset.serialNumber],
            ['department', asset.department],
            ['status', asset.status],
            ['qrCode', asset.qrCode],
            ['rfidTag', asset.rfidTag],
            ['purchaseDate', formatDate(asset.purchaseDate)],
            ['condition', asset.condition],
          ])}</div>
          {asset.qrCode && (
            <div className="rfid-qr-section">
              <div className="rfid-qr" aria-label={tr('qrCode')}><QRCodeSVG value={asset.qrCode} size={128} level="M" /></div>
              <code className="rfid-code">{asset.qrCode}</code>
              <div className="rfid-actions">
                <button className="rfid-button" type="button" onClick={printQr}><Printer size={16} aria-hidden="true" />{tr('print')}</button>
                <button className="rfid-button" type="button" onClick={downloadQr}><Download size={16} aria-hidden="true" />{tr('download')}</button>
              </div>
            </div>
          )}
          <section className="rfid-tag-actions" aria-labelledby="rfid-tag-actions-title">
            <h3 id="rfid-tag-actions-title">{tr('trackingTags')}</h3>
            <form className="rfid-tag-form" onSubmit={updateTags}>
              <label>{tr('qrCode')}<input className="rfid-control" value={qrInput} onChange={(event) => setQrInput(event.target.value)} maxLength={100} /></label>
              <label>{tr('rfidTag')}<input className="rfid-control" value={rfidInput} onChange={(event) => setRfidInput(event.target.value)} maxLength={255} /></label>
              <button className="rfid-button rfid-button-primary" type="submit" disabled={savingTags || (!qrInput.trim() && !rfidInput.trim())}>{tr('assignTrackingTag')}</button>
              <button className="rfid-button" type="button" onClick={regenerateQr} disabled={savingTags}>{tr('generateRegenerateQr')}</button>
              <button className="rfid-button" type="button" onClick={copyAssetId}><Copy size={16} aria-hidden="true" />{tr('copyId')}</button>
            </form>
          </section>
        </>
      );
    }
    if (activeTab === 'location') {
      const location = tracking.currentLocation || {};
      return <div className="rfid-detail-grid">{fields([
        ['college', location.college],
        ['department', location.department],
        ['building', location.building],
        ['room', location.room],
        ['floor', location.floor],
        ['lastUpdated', formatDate(location.lastUpdated)],
        ['updatedBy', location.updatedBy],
      ])}</div>;
    }
    if (activeTab === 'assignment') {
      const current = tracking.currentAssignment || {};
      return (
        <>
          <h3 className="rfid-section-heading">{tr('currentAssignment')}</h3>
          <div className="rfid-detail-grid">{fields([
            ['assignedTo', current.assignedTo],
            ['department', current.department],
            ['assignedBy', current.assignedBy],
            ['status', current.status],
          ])}</div>
          <h3 className="rfid-section-heading">{tr('assignmentHistory')}</h3>
          {renderHistoryTable(tracking.assignmentHistory, [
            ['assignedTo', 'assignedTo'],
            ['from', 'from'],
            ['to', 'to'],
            ['assignedAt', 'assignedAt', formatDate],
            ['assignedBy', 'assignedBy'],
            ['status', 'status'],
          ])}
        </>
      );
    }
    if (activeTab === 'transfers') {
      return renderHistoryTable(tracking.transferHistory, [
        ['fromTo', 'fromTo', (_value, row) => row],
      ]);
    }
    return renderHistoryTable(tracking.maintenanceHistory, [
      ['date', 'date', formatDate],
      ['type', 'type'],
      ['ticketId', 'ticketId'],
      ['technician', 'technician'],
      ['cost', 'cost'],
      ['status', 'status'],
      ['outcome', 'outcome'],
    ]);
  };

  const handleDialogKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderTransferTable = () => {
    const rows = tracking?.transferHistory || [];
    if (trackingState === 'loading') return <p className="rfid-empty">{tr('loading')}</p>;
    if (trackingState === 'error') return <p className="rfid-error" role="alert">{trackingError}</p>;
    if (!rows.length) return <p className="rfid-empty">{tr('noHistory')}</p>;
    return <div className="rfid-history"><table><thead><tr>{['fromTo', 'date', 'approvedBy', 'reason', 'status'].map((key) => <th key={key}>{tr(key)}</th>)}</tr></thead><tbody>
      {rows.map((row) => <tr key={row.id}><td>{`${display(row.fromLocation || row.fromDepartment)} → ${display(row.toLocation || row.toDepartment)}`}</td><td>{formatDate(row.date)}</td><td>{display(row.approvedBy)}</td><td>{display(row.reason)}</td><td>{display(row.status)}</td></tr>)}
    </tbody></table></div>;
  };

  return (
    <main className="rfid-page">
      <div className="rfid-container">
        <header className="rfid-header"><h1 className="rfid-title">{tr('title')}</h1></header>
        <section className="rfid-summary" aria-label={tr('summary')}>
          {[
            ['totalAssets', 'totalAssets'],
            ['rfidAssigned', 'rfidAssigned'],
            ['qrAssigned', 'qrAssigned'],
            ['fullyTracked', 'fullyTracked'],
            ['notFullyTracked', 'notFullyTracked'],
          ].map(([key, label]) => <article className={`rfid-summary-card${summaryLoading ? ' is-loading' : ''}`} key={key} aria-busy={summaryLoading}>
            <h2 className="rfid-summary-label">{tr(label)}</h2><p className="rfid-summary-value">{summaryLoading
              ? <span className="rfid-summary-skeleton" aria-label={tr('loading')} />
              : summaryError ? '—' : summary[key]}</p>
          </article>)}
        </section>

        <div className="rfid-toolbar">
          <label className="rfid-search-label" htmlFor="rfid-asset-search">{tr('searchPlaceholder')}</label>
          <input id="rfid-asset-search" className="rfid-control rfid-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('searchPlaceholder')} />
          <label className="rfid-status-label" htmlFor="rfid-status">{tr('statusFilter')}</label>
          <select id="rfid-status" className="rfid-control rfid-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">{tr('allStatuses')}</option>
            {['in-use', 'available', 'reserved', 'under-maintenance', 'under-repair', 'disposed', 'retired'].map((item) => <option key={item} value={item}>{tr(`statuses.${item}`)}</option>)}
          </select>
          <button className="rfid-button" type="button" onClick={reload} disabled={loading || summaryLoading}><RefreshCw size={16} aria-hidden="true" />{tr('refresh')}</button>
        </div>

        <section className="rfid-workflows" aria-label={tr('lookups')}>
          <div className="rfid-panel">
            <h2>{tr('scanner')}</h2>
            <div id="admin-rfid-reader" className="rfid-scanner" aria-live="polite" />
            {scannerMessage && <p className="rfid-inline-message" role="alert">{scannerMessage}</p>}
            <div className="rfid-scanner-actions">
              <button className="rfid-button rfid-button-primary" type="button" onClick={startScanner} disabled={scanning || lookupLoading} aria-label={tr('startScan')}><Camera size={16} aria-hidden="true" />{tr('startScan')}</button>
              <button className="rfid-button" type="button" onClick={() => { void stopScanner(); }} disabled={!scanning} aria-label={tr('stopScan')}>{tr('stopScan')}</button>
            </div>
          </div>
          <div className="rfid-panel">
            <h2>{tr('assetIdLookup')}</h2>
            <form className="rfid-form" onSubmit={submitAssetId}>
              <label className="rfid-visually-hidden" htmlFor="rfid-asset-id">{tr('assetIdPlaceholder')}</label>
              <input id="rfid-asset-id" className="rfid-control" value={assetIdInput} onChange={(event) => setAssetIdInput(event.target.value)} placeholder={tr('assetIdPlaceholder')} />
              <button className="rfid-button rfid-button-primary" type="submit" disabled={lookupLoading || !assetIdInput.trim()}><Search size={16} aria-hidden="true" />{tr('search')}</button>
            </form>
          </div>
          <div className="rfid-panel">
            <h2>{tr('codeLookup')}</h2>
            <form className="rfid-form" onSubmit={submitCode}>
              <label className="rfid-visually-hidden" htmlFor="rfid-code">{tr('codePlaceholder')}</label>
              <input id="rfid-code" className="rfid-control" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder={tr('codePlaceholder')} autoComplete="off" />
              <button className="rfid-button rfid-button-primary" type="submit" disabled={lookupLoading || !codeInput.trim()}><Search size={16} aria-hidden="true" />{tr('search')}</button>
            </form>
          </div>
        </section>

        {lookupError && <p className="rfid-error" role="alert">{lookupError}</p>}
        {lookupLoading && <p className="rfid-inline-message" role="status">{tr('searching')}</p>}
        {scanLogError && <p className="rfid-error" role="alert">{scanLogError}</p>}
        {listError && <p className="rfid-error" role="alert">{listError}</p>}
        {summaryError && <div className="rfid-error rfid-summary-error" role="alert">
          <span>{summaryError}</span>
          <button className="rfid-button" type="button" onClick={() => setSummaryRetryKey((current) => current + 1)} disabled={summaryLoading}>{tr('retry')}</button>
        </div>}
        <section className="rfid-table-card" aria-label={tr('assetList')}>
          <div className="rfid-table-scroll"><table className="rfid-table">
            <thead><tr><th scope="col">{tr('assetId')}</th><th scope="col">{tr('name')}</th><th scope="col">{tr('department')}</th><th scope="col">{tr('status')}</th><th scope="col">QR</th><th scope="col">RFID</th></tr></thead>
            <tbody>
              {assets.map((asset) => <tr key={asset.id} tabIndex={0} onClick={() => { void openAsset(asset); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openAsset(asset); } }}>
                <td className="rfid-code">{display(asset.assetCode || asset.id)}</td>
                <td>{display(asset.name)}{asset.serialNumber && <span className="rfid-subtext">{tr('serial')}: {asset.serialNumber}</span>}</td>
                <td>{display(asset.department)}</td>
                <td><span className={`rfid-status rfid-status-${statusClass(asset.status)}`}>{display(asset.status)}</span></td>
                <td className="rfid-code">{display(asset.qrCode)}</td>
                <td className="rfid-code">{display(asset.rfidTag)}</td>
              </tr>)}
              {!loading && assets.length === 0 && <tr><td colSpan="6" className="rfid-empty">{tr('emptyAssets')}</td></tr>}
              {loading && <tr><td colSpan="6" className="rfid-empty" role="status">{tr('loading')}</td></tr>}
            </tbody>
          </table></div>
          <footer className="rfid-pagination">
            <span>{tr('showing')} {assets.length} {tr('of')} {pagination.total} {tr('assets')}</span>
            <div className="rfid-pagination-actions">
              <button className="rfid-button" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>{tr('previous')}</button>
              <span aria-live="polite">{page} / {Math.max(1, pagination.pages)}</span>
              <button className="rfid-button" type="button" onClick={() => setPage((current) => Math.min(pagination.pages || 1, current + 1))} disabled={loading || page >= pagination.pages}>{tr('next')}</button>
            </div>
          </footer>
        </section>
      </div>

      {selectedAsset && <div className="rfid-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}>
        <section className="rfid-detail" role="dialog" aria-modal="true" aria-labelledby="rfid-detail-title" onKeyDown={handleDialogKeyDown}>
          <header className="rfid-detail-header">
            <div><h2 id="rfid-detail-title">{display(selectedAsset.assetCode || selectedAsset.name || tr('assetDetails'))}</h2><span className={`rfid-status rfid-status-${statusClass(selectedAsset.status)}`}>{display(selectedAsset.status)}</span></div>
            <button ref={detailCloseRef} className="rfid-icon-button" type="button" onClick={closeDetails} aria-label={tr('close')} title={tr('close')}><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="rfid-detail-content">
            <div className="rfid-tabs" role="tablist" aria-label={tr('assetDetails')}>
              {DETAIL_TABS.map((tab) => <button className="rfid-tab" id={`rfid-tab-${tab}`} key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls="rfid-detail-panel" onClick={() => setActiveTab(tab)}>{tr(`detailTabs.${tab}`)}</button>)}
            </div>
            <div id="rfid-detail-panel" className="rfid-tab-panel" role="tabpanel" aria-labelledby={`rfid-tab-${activeTab}`}>
              {activeTab === 'transfers' ? renderTransferTable() : tabContent()}
            </div>
          </div>
        </section>
      </div>}
    </main>
  );
}
