import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import { translateMessage } from '../../i18n/messages';

const ASSETS_API = '/api/assets';
const PAGE_SIZE = 50;
const HISTORY_TABS = ['assignments', 'transfers', 'maintenance'];
const textFor = (language, key) => translateMessage(language, `tracking.${key}`);
const localizedApiError = (error, key, language) => language === 'am'
  ? textFor(language, key)
  : getApiErrorMessage(error, textFor(language, key));

const normalizeAsset = (asset = {}) => {
  const location = asset.location && typeof asset.location === 'object' ? asset.location : {};
  return {
    ...asset,
    id: asset.id ?? asset.assetId ?? asset.asset_id,
    assetCode: String(asset.assetCode ?? asset.asset_code ?? asset.assetId ?? asset.asset_id ?? asset.id ?? ''),
    name: String(asset.name ?? asset.assetName ?? ''),
    category: String(asset.category?.name ?? asset.categoryName ?? asset.category ?? ''),
    serialNumber: String(asset.serialNumber ?? asset.serial_number ?? ''),
    status: String(asset.status ?? ''),
    department: String(asset.department?.name ?? asset.departmentName ?? asset.department ?? ''),
    assignedTo: String(asset.assignedTo ?? asset.assignedToName ?? asset.assigned_to_name ?? ''),
    qrCode: String(asset.qrCode ?? asset.qr_code ?? asset.digitalId ?? asset.digital_id ?? ''),
    rfidTag: String(asset.rfidTag ?? asset.rfid_tag ?? ''),
    locationParts: [
      location.campus ?? asset.CampusRecord?.campusName ?? asset.campusName ?? asset.campus_name,
      location.building ?? asset.BuildingRecord?.buildingName ?? asset.buildingName ?? asset.building_name,
      location.floor ?? asset.RoomRecord?.floor ?? asset.floorName ?? asset.floor_name,
      location.room ?? asset.RoomRecord?.roomName ?? asset.roomName ?? asset.room_name ?? (typeof asset.location === 'string' ? asset.location : ''),
    ].filter((part) => part !== null && part !== undefined && String(part).trim()),
  };
};

const assetRows = (payload) => Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.assets) ? payload.assets : [];
const historyRows = (payload) => Array.isArray(payload?.data) ? payload.data : payload?.history || [];
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

export default function AdminRFIDTracking() {
  const { language } = useLanguage();
  const tr = useCallback((key) => textFor(language, key), [language]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [trackingFilter, setTrackingFilter] = useState('all');
  const [assetIdInput, setAssetIdInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeTab, setActiveTab] = useState(HISTORY_TABS[0]);
  const [historyState, setHistoryState] = useState({ status: 'idle', rows: [] });
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const scannerStartRef = useRef(Promise.resolve());
  const scanHandledRef = useRef(false);
  const listControllerRef = useRef(null);
  const lookupControllerRef = useRef(null);
  const historyControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const loadAssets = useCallback(async (signal) => {
    setLoading(true);
    setListError('');
    try {
      const firstResponse = await apiClient.get(ASSETS_API, { params: { limit: PAGE_SIZE, page: 1 }, signal });
      const payload = firstResponse.data;
      const rows = assetRows(payload);
      const pageCount = Number(payload?.pagination?.pages) || Math.ceil(Number(payload?.total || rows.length) / PAGE_SIZE);
      for (let page = 2; page <= pageCount; page += 1) {
        const response = await apiClient.get(ASSETS_API, { params: { limit: PAGE_SIZE, page }, signal });
        rows.push(...assetRows(response.data));
      }
      if (!signal?.aborted) setAssets(rows.map(normalizeAsset));
    } catch (error) {
      if (!signal?.aborted) setListError(localizedApiError(error, 'assetsLoadError', language));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [language]);

  const refreshAssets = () => {
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;
    void loadAssets(controller.signal);
  };

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    listControllerRef.current = controller;
    void loadAssets(controller.signal);
    return () => {
      mountedRef.current = false;
      controller.abort();
      lookupControllerRef.current?.abort();
      historyControllerRef.current?.abort();
      const scanner = scannerRef.current;
      if (scanner) {
        Promise.resolve(scannerStartRef.current).catch(() => {})
          .then(() => scanner.stop()).catch(() => {})
          .then(() => { try { scanner.clear(); } catch {} }).catch(() => {});
      }
    };
  }, [loadAssets]);

  const statistics = useMemo(() => ({
    total: assets.length,
    rfidAssigned: assets.filter((asset) => Boolean(asset.rfidTag)).length,
    qrAssigned: assets.filter((asset) => Boolean(asset.qrCode)).length,
    fullyTracked: assets.filter((asset) => Boolean(asset.rfidTag && asset.qrCode)).length,
    notFullyTracked: assets.filter((asset) => !asset.rfidTag || !asset.qrCode).length,
  }), [assets]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = !query || [asset.assetCode, asset.id, asset.name, asset.serialNumber, asset.rfidTag, asset.qrCode, asset.department]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
      const matchesFilter = trackingFilter === 'all'
        || (trackingFilter === 'rfid' && Boolean(asset.rfidTag))
        || (trackingFilter === 'qr' && Boolean(asset.qrCode))
        || (trackingFilter === 'fully' && Boolean(asset.rfidTag && asset.qrCode))
        || (trackingFilter === 'incomplete' && (!asset.rfidTag || !asset.qrCode));
      return matchesSearch && matchesFilter;
    });
  }, [assets, search, trackingFilter]);

  const lookupAsset = useCallback(async (url) => {
    lookupControllerRef.current?.abort();
    const controller = new AbortController();
    lookupControllerRef.current = controller;
    setLookupLoading(true);
    setLookupError('');
    try {
      const response = await apiClient.get(url, { signal: controller.signal });
      const record = response.data?.data?.asset ?? response.data?.asset;
      if (!record) throw new Error(textFor(language, 'assetNotFound'));
      setSelectedAsset(normalizeAsset(record));
      setActiveTab(HISTORY_TABS[0]);
      setLookupError('');
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error.response?.status === 404 ? textFor(language, 'assetNotFound') : localizedApiError(error, 'lookupError', language);
      setLookupError(message);
      toast.error(message);
    } finally {
      if (!controller.signal.aborted) setLookupLoading(false);
    }
  }, [language]);

  const submitAssetId = (event) => {
    event.preventDefault();
    const value = assetIdInput.trim();
    if (value) void lookupAsset(`${ASSETS_API}/lookup/${encodeURIComponent(value)}`);
  };

  const submitCode = (event) => {
    event.preventDefault();
    const value = codeInput.trim();
    if (value) void lookupAsset(`/api/rfid/lookup/${encodeURIComponent(value)}`);
  };

  const selectAsset = (asset) => {
    lookupControllerRef.current?.abort();
    setLookupLoading(false);
    setLookupError('');
    setSelectedAsset(asset);
    setActiveTab(HISTORY_TABS[0]);
  };

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try { await scanner.stop(); } catch {}
    try { scanner.clear(); } catch {}
    scannerRef.current = null;
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScanner = async () => {
    if (scannerRef.current) return;
    scanHandledRef.current = false;
    let scanner;
    try {
      scanner = new Html5Qrcode('admin-rfid-reader');
      scannerRef.current = scanner;
      const onDecode = (decodedText) => {
        if (scanHandledRef.current) return;
        scanHandledRef.current = true;
        void stopScanner().then(() => lookupAsset(`/api/rfid/lookup/${encodeURIComponent(decodedText)}`)).catch(() => {});
      };
      const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
      let startPromise = scanner.start({ facingMode: 'environment' }, scanConfig, onDecode, () => {});
      scannerStartRef.current = startPromise;
      try {
        await startPromise;
      } catch (cameraError) {
        const details = String(cameraError?.message || cameraError || '').toLowerCase();
        if (details.includes('permission') || details.includes('denied') || details.includes('notallowed')) throw cameraError;
        const cameras = await Html5Qrcode.getCameras();
        const preferredCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label || '')) || cameras[0];
        if (!preferredCamera?.id) throw cameraError;
        startPromise = scanner.start(preferredCamera.id, scanConfig, onDecode, () => {});
        scannerStartRef.current = startPromise;
        await startPromise;
      }
      if (mountedRef.current) setScanning(true);
    } catch (error) {
      if (scanner) {
        try { scanner.clear(); } catch {}
        if (scannerRef.current === scanner) scannerRef.current = null;
      }
      if (mountedRef.current) setScanning(false);
      const details = String(error?.message || error || '').toLowerCase();
      toast.error(details.includes('permission') || details.includes('denied') || details.includes('notallowed') ? tr('cameraPermissionDenied') : tr('cameraUnavailable'));
    }
  };

  const selectedAssetId = selectedAsset?.id;
  useEffect(() => {
    if (!selectedAssetId) {
      setHistoryState({ status: 'idle', rows: [] });
      return undefined;
    }
    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    setHistoryState({ status: 'loading', rows: [] });
    apiClient.get(`${ASSETS_API}/${encodeURIComponent(selectedAssetId)}/${activeTab}`, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setHistoryState({ status: 'loaded', rows: historyRows(response.data) }); })
      .catch((error) => { if (!controller.signal.aborted) setHistoryState({ status: 'error', rows: [], message: localizedApiError(error, 'historyLoadError', language) }); });
    return () => controller.abort();
  }, [selectedAssetId, activeTab, language, tr]);

  const closeDetails = () => {
    historyControllerRef.current?.abort();
    setSelectedAsset(null);
  };

  const stats = [['total', 'totalAssets'], ['rfidAssigned', 'rfidAssigned'], ['qrAssigned', 'qrAssigned'], ['fullyTracked', 'fullyTracked'], ['notFullyTracked', 'notFullyTracked']];
  const historyColumns = {
    assignments: [['userName', 'user'], ['department', 'department'], ['assignedAt', 'date'], ['status', 'status']],
    transfers: [[(row) => `${row.fromLocation || row.fromDepartment || '—'} → ${row.toLocation || row.toDepartment || '—'}`, 'fromTo'], ['transferredAt', 'date'], ['reason', 'reason']],
    maintenance: [['requestedAt', 'date'], [(row) => row.title || row.description, 'problem'], ['status', 'status'], ['technicianName', 'technician']],
  };

  return (
    <div className="rfid-page">
      <style>{`
        .rfid-page{min-height:100%;padding:24px;background:#f3f6f9;color:#111827;box-sizing:border-box}.rfid-container{max-width:1500px;margin:0 auto}.rfid-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.rfid-title{margin:0;font-size:28px;font-weight:700}.rfid-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:18px}.rfid-summary-card,.rfid-panel,.rfid-table-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 2px 8px rgba(15,23,42,.04)}.rfid-summary-card{padding:16px}.rfid-summary-label{margin-bottom:7px;color:#64748b;font-size:12px;font-weight:600}.rfid-summary-value{font-size:25px;font-weight:700}.rfid-toolbar{display:flex;align-items:center;gap:10px;padding:14px;margin-bottom:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px}.rfid-control{height:44px;box-sizing:border-box;padding:0 12px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#111827;font:inherit;font-size:14px}.rfid-search{flex:1;min-width:180px}.rfid-select{min-width:190px}.rfid-button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}.rfid-button:hover{background:#f8fafc}.rfid-button:disabled{opacity:.55;cursor:not-allowed}.rfid-button-primary{border-color:#1d4ed8;background:#1d4ed8;color:#fff}.rfid-button-primary:hover{background:#1e40af}.rfid-workflows{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}.rfid-panel{min-width:0;padding:16px}.rfid-panel h2{margin:0 0 12px;font-size:16px}.rfid-form{display:flex;gap:8px}.rfid-form .rfid-control{min-width:0;flex:1}.rfid-scanner{min-height:0;display:flex;justify-content:center;overflow:hidden;margin:0 0 10px}.rfid-scanner:not(:empty){min-height:62px}.rfid-scanner video{max-width:100%;border-radius:7px}.rfid-scanner-actions{display:flex;gap:8px;flex-wrap:wrap}.rfid-error{margin:0 0 14px;padding:12px 14px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:14px}.rfid-table-card{overflow:hidden}.rfid-table-scroll{overflow-x:auto}.rfid-table{width:100%;min-width:850px;border-collapse:collapse}.rfid-table th{padding:13px 15px;background:#f8fafc;color:#475569;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px;white-space:nowrap}.rfid-table td{padding:13px 15px;border-bottom:1px solid #eef2f7;font-size:13px;vertical-align:middle}.rfid-table tbody tr{cursor:pointer}.rfid-table tbody tr:hover,.rfid-table tbody tr:focus{background:#f8fafc;outline:2px solid #bfdbfe;outline-offset:-2px}.rfid-code{font-family:monospace;color:#334155;font-size:12px;overflow-wrap:anywhere}.rfid-empty{padding:42px 20px;text-align:center;color:#64748b}.rfid-footer{padding:12px 15px;color:#64748b;font-size:13px;border-top:1px solid #eef2f7}.rfid-modal-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.52)}.rfid-detail{width:min(850px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(15,23,42,.25)}.rfid-detail-header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:#fff;border-bottom:1px solid #e2e8f0}.rfid-detail-header h2{margin:0;font-size:20px}.rfid-icon-button{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;cursor:pointer}.rfid-detail-content{padding:18px 20px}.rfid-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rfid-detail-field{min-width:0;padding:12px;border:1px solid #e2e8f0;border-radius:8px}.rfid-detail-label{display:block;margin-bottom:5px;color:#64748b;font-size:12px;font-weight:600}.rfid-detail-value{overflow-wrap:anywhere;font-size:14px;font-weight:600}.rfid-location{margin:14px 0 18px;padding:12px;border-left:3px solid #0f766e;background:#f0fdfa;font-size:14px}.rfid-qr{display:flex;align-items:center;gap:12px;margin:14px 0}.rfid-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid #e2e8f0}.rfid-tab{min-height:44px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#475569;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}.rfid-tab[aria-selected=true]{border-bottom-color:#0f766e;color:#0f766e;font-weight:700}.rfid-history{margin-top:12px;overflow-x:auto}.rfid-history table{width:100%;min-width:560px;border-collapse:collapse}.rfid-history th,.rfid-history td{padding:10px 12px;border-bottom:1px solid #eef2f7;text-align:left;font-size:13px;vertical-align:top}.rfid-history th{color:#64748b;font-size:12px}@media(max-width:980px){.rfid-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.rfid-workflows{grid-template-columns:1fr 1fr}.rfid-workflows .rfid-panel:first-child{grid-column:1/-1}}@media(max-width:640px){.rfid-page{padding:14px}.rfid-title{font-size:23px}.rfid-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.rfid-summary-card{padding:13px}.rfid-summary-value{font-size:22px}.rfid-toolbar{align-items:stretch;flex-wrap:wrap;padding:10px}.rfid-search{flex-basis:100%}.rfid-select{flex:1;min-width:0}.rfid-toolbar .rfid-button{flex:1}.rfid-workflows{grid-template-columns:1fr}.rfid-workflows .rfid-panel:first-child{grid-column:auto}.rfid-form{flex-wrap:wrap}.rfid-form .rfid-control{flex-basis:100%}.rfid-form .rfid-button{flex:1}.rfid-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rfid-detail-content{padding:14px}.rfid-modal-backdrop{padding:8px}.rfid-detail{max-height:calc(100vh - 16px)}}
      `}</style>
      <div className="rfid-container">
        <header className="rfid-header"><h1 className="rfid-title">{tr('title')}</h1></header>
        <section className="rfid-summary" aria-label={tr('summary')}>
          {stats.map(([key, label]) => <div className="rfid-summary-card" key={key}><div className="rfid-summary-label">{tr(label)}</div><div className="rfid-summary-value">{statistics[key]}</div></div>)}
        </section>
        <div className="rfid-toolbar">
          <input className="rfid-control rfid-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('searchPlaceholder')} aria-label={tr('searchPlaceholder')} />
          <select className="rfid-control rfid-select" value={trackingFilter} onChange={(event) => setTrackingFilter(event.target.value)} aria-label={tr('filterLabel')}>{['all', 'rfid', 'qr', 'fully', 'incomplete'].map((filter) => <option key={filter} value={filter}>{tr(`filter.${filter}`)}</option>)}</select>
          <button className="rfid-button" type="button" onClick={refreshAssets} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{tr('refresh')}</button>
        </div>
        <section className="rfid-workflows" aria-label={tr('lookups')}>
          <div className="rfid-panel"><h2>{tr('scanner')}</h2><div id="admin-rfid-reader" className="rfid-scanner" /><div className="rfid-scanner-actions"><button className="rfid-button rfid-button-primary" type="button" onClick={startScanner} disabled={scanning}><Camera size={16} aria-hidden="true" />{tr('startScan')}</button><button className="rfid-button" type="button" onClick={() => { void stopScanner(); }} disabled={!scanning}>{tr('stopScan')}</button></div></div>
          <div className="rfid-panel"><h2>{tr('assetIdLookup')}</h2><form className="rfid-form" onSubmit={submitAssetId}><input className="rfid-control" value={assetIdInput} onChange={(event) => setAssetIdInput(event.target.value)} placeholder={tr('assetIdPlaceholder')} aria-label={tr('assetIdPlaceholder')} /><button className="rfid-button rfid-button-primary" type="submit" disabled={lookupLoading || !assetIdInput.trim()}><Search size={16} aria-hidden="true" />{tr('search')}</button></form></div>
          <div className="rfid-panel"><h2>{tr('codeLookup')}</h2><form className="rfid-form" onSubmit={submitCode}><input className="rfid-control" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder={tr('codePlaceholder')} aria-label={tr('codePlaceholder')} /><button className="rfid-button rfid-button-primary" type="submit" disabled={lookupLoading || !codeInput.trim()}><Search size={16} aria-hidden="true" />{tr('search')}</button></form></div>
        </section>
        {lookupError && <div className="rfid-error" role="alert">{lookupError}</div>}{listError && <div className="rfid-error" role="alert">{listError}</div>}
        <section className="rfid-table-card" aria-label={tr('assetList')}><div className="rfid-table-scroll"><table className="rfid-table"><thead><tr><th>{tr('assetId')}</th><th>{tr('name')}</th><th>{tr('department')}</th><th>{tr('status')}</th><th>QR</th><th>RFID</th></tr></thead><tbody>
          {filteredAssets.map((asset) => <tr key={asset.id} tabIndex={0} onClick={() => selectAsset(asset)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectAsset(asset); } }}><td className="rfid-code">{asset.assetCode || asset.id || '—'}</td><td>{asset.name || '—'}{asset.serialNumber && <div className="rfid-summary-label">{tr('serial')}: {asset.serialNumber}</div>}</td><td>{asset.department || '—'}</td><td>{asset.status || '—'}</td><td className="rfid-code">{asset.qrCode || '—'}</td><td className="rfid-code">{asset.rfidTag || '—'}</td></tr>)}
          {!loading && filteredAssets.length === 0 && <tr><td colSpan="6" className="rfid-empty">{assets.length ? tr('noMatchingAssets') : tr('emptyAssets')}</td></tr>}{loading && <tr><td colSpan="6" className="rfid-empty">{tr('loading')}</td></tr>}
        </tbody></table></div><footer className="rfid-footer">{tr('showing')} {filteredAssets.length} {tr('of')} {assets.length} {tr('assets')}</footer></section>
      </div>
      {selectedAsset && <div className="rfid-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}><section className="rfid-detail" role="dialog" aria-modal="true" aria-labelledby="rfid-detail-title">
        <header className="rfid-detail-header"><h2 id="rfid-detail-title">{selectedAsset.assetCode || selectedAsset.name || tr('assetDetails')}</h2><button className="rfid-icon-button" type="button" onClick={closeDetails} aria-label={tr('close')} title={tr('close')}><X size={18} /></button></header>
        <div className="rfid-detail-content"><div className="rfid-detail-grid">{[['name', selectedAsset.name], ['category', selectedAsset.category], ['serial', selectedAsset.serialNumber], ['status', selectedAsset.status], ['qrCode', selectedAsset.qrCode], ['rfidTag', selectedAsset.rfidTag], ['department', selectedAsset.department], ['assignedTo', selectedAsset.assignedTo]].map(([label, value]) => <div className="rfid-detail-field" key={label}><span className="rfid-detail-label">{tr(label)}</span><span className="rfid-detail-value">{value || '—'}</span></div>)}</div>
          <div className="rfid-location"><strong>{tr('currentLocation')}:</strong> {selectedAsset.locationParts.length ? selectedAsset.locationParts.join(' → ') : tr('locationUnavailable')}</div>{selectedAsset.qrCode && <div className="rfid-qr"><QRCodeSVG value={selectedAsset.qrCode} size={112} level="M" /><span className="rfid-code">{selectedAsset.qrCode}</span></div>}
          <div className="rfid-tabs" role="tablist" aria-label={tr('history')}>{HISTORY_TABS.map((tab) => <button className="rfid-tab" id={`rfid-tab-${tab}`} key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls="rfid-history-panel" onClick={() => setActiveTab(tab)}>{tr(`historyTabs.${tab}`)}</button>)}</div>
          <div id="rfid-history-panel" className="rfid-history" role="tabpanel" aria-labelledby={`rfid-tab-${activeTab}`}>
            {historyState.status === 'loading' && <div className="rfid-empty">{tr('loading')}</div>}{historyState.status === 'error' && <div className="rfid-error" role="alert">{historyState.message}</div>}{historyState.status === 'loaded' && historyState.rows.length === 0 && <div className="rfid-empty">{tr('noHistory')}</div>}
            {historyState.status === 'loaded' && historyState.rows.length > 0 && <table><thead><tr>{historyColumns[activeTab].map(([, label]) => <th key={label}>{tr(label)}</th>)}</tr></thead><tbody>{historyState.rows.map((row, index) => <tr key={`${activeTab}-${index}`}>{historyColumns[activeTab].map(([field]) => { const value = typeof field === 'function' ? field(row) : row[field]; return <td key={typeof field === 'string' ? field : 'from-to'}>{['assignedAt', 'transferredAt', 'requestedAt'].includes(field) ? formatDate(value) : value || '—'}</td>; })}</tr>)}</tbody></table>}
          </div>
        </div>
      </section></div>}
    </div>
  );
}