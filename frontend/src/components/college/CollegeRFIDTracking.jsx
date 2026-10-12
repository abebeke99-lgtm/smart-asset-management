/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';

const translations = {
  am: {
    'Tracked Assets': 'የሚከታተሉ ንብረቶች',
    Tagged: 'መለያ ያላቸው',
    Untagged: 'መለያ የሌላቸው',
    Locations: 'ቦታዎች',
    'Recent Scans': 'የቅርብ ጊዜ ቅኝቶች',
    Search: 'ፈልግ',
    Status: 'ሁኔታ',
    Department: 'ዲፓርትመንት',
    Location: 'ቦታ',
    'All statuses': 'ሁሉም ሁኔታዎች',
    'All departments': 'ሁሉም ዲፓርትመንቶች',
    'All locations': 'ሁሉም ቦታዎች',
    'Clear filters': 'ማጣሪያዎችን አጽዳ',
    'College RFID / QR asset register': 'የኮሌጅ RFID / QR ንብረት መዝገብ',
    'No matching assets found.': 'የሚዛመዱ ንብረቶች አልተገኙም።',
    'Recent RFID / QR scan activity': 'የቅርብ ጊዜ RFID / QR ቅኝት እንቅስቃሴ',
    'No recent scan activity available.': 'የቅርብ ጊዜ የቅኝት እንቅስቃሴ የለም።',
    'Loading RFID tracking data…': 'የRFID ክትትል መረጃ በመጫን ላይ…',
    'Unable to load RFID tracking data for this college.': 'የኮሌጁን RFID ክትትል መረጃ መጫን አልተቻለም።',
    Retry: 'እንደገና ሞክር',
    Refresh: 'አድስ',
    Asset: 'ንብረት',
    'QR Code': 'QR ኮድ',
    'Scan method': 'የቅኝት ዘዴ',
    'Actions': 'እርምጃዎች',
    'Condition': 'ሁኔታ',
    'Time': 'ሰዓት',
    'Tag': 'መለያ',
    'Action': 'እርምጃ',
    'Scanned by': 'የቃኘው',
    'Unnamed asset': 'ስም ያልተሰጠው ንብረት',
    items: 'ንብረቶች',
    of: 'ከ',
    'Tracking totals cover the full college: tagged means a nonblank QR or RFID identifier, locations use registered asset locations, and recent scans cover 30 days.': 'ጠቅላላዎቹ የኮሌጁን ንብረቶች ያካትታሉ፤ መለያ ያለው ማለት ባዶ ያልሆነ QR ወይም RFID መለያ ማለት ነው፣ ቦታዎች ከተመዘገበው የንብረት ቦታ ይወሰዳሉ፣ የቅርብ ቅኝት 30 ቀናትን ያካትታል።',
    'RFID Tag': 'RFID መለያ',
    'Not linked': 'አልተገናኘም',
    'Not recorded': 'አልተመዘገበም',
    Unknown: 'ያልታወቀ',
    'Previous': 'ቀዳሚ',
    'Next': 'ቀጣይ',
    'Page': 'ገጽ',
    'Asset, tag or location': 'ንብረት፣ መለያ ወይም ቦታ',
    'Scan or look up an identifier': 'መለያ ይቃኙ ወይም ይፈልጉ',
    'Manual lookup': 'በእጅ ፍለጋ',
    'QR camera scan': 'በካሜራ QR ቅኝት',
    'RFID reader input': 'የRFID አንባቢ ግቤት',
    'RFID input uses a connected reader keyboard; hardware connectivity is not verified by this page.': 'የRFID ግቤት የተገናኘ አንባቢ ቁልፍ ሰሌዳ ይጠቀማል፤ የሃርድዌር ግንኙነት በዚህ ገጽ አይረጋገጥም።',
    'Tracking identifier': 'የክትትል መለያ',
    Lookup: 'ፈልግ',
    'Record scan': 'ቅኝት መዝግብ',
    'Start QR camera': 'የQR ካሜራ ክፈት',
    'Stop camera': 'ካሜራ አቁም',
    'Save RFID tag': 'RFID መለያ አስቀምጥ',
    'Generate QR': 'QR አመንጭ',
    'QR camera scans require HTTPS or localhost.': 'የQR ካሜራ ቅኝት HTTPS ወይም localhost ይፈልጋል።',
    'Could not access the camera. Check browser permission and try again.': 'ካሜራውን መድረስ አልተቻለም። የአሳሹን ፈቃድ ይመልከቱና ይሞክሩ።',
    'Asset found.': 'ንብረቱ ተገኝቷል።',
    'Scan recorded.': 'ቅኝቱ ተመዝግቧል።',
    'Tracking tag updated.': 'የክትትል መለያው ተዘምኗል።',
    'QR code generated.': 'QR ኮድ ተፈጥሯል።',
  },
};

const text = (value, language) => translations[language]?.[value] || value;

const initialState = {
  loading: true,
  error: '',
  assets: [],
  logs: [],
  summary: { totalAssets: 0, taggedAssets: 0, untaggedAssets: 0, uniqueLocations: 0, recentScans: 0 },
  filters: { departments: [], statuses: [], locations: [] },
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
};

const CollegeRFIDTracking = () => {
  const { user, hasPermission } = useAuth();
  const { language } = useLanguage();
  const t = (value) => text(value, language);
  const [state, setState] = useState(initialState);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [location, setLocation] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [scanMethod, setScanMethod] = useState('manual');
  const [lookupResult, setLookupResult] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [tagValues, setTagValues] = useState({});
  const scannerRef = useRef(null);
  const cameraScanHandledRef = useRef(false);
  const canManageTags = user?.role === 'college_manager' && hasPermission?.('college.assets.update');

  const loadData = async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/college/rfid', {
        params: {
          page,
          limit: 25,
          search: search || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          location: location || undefined,
        },
      });
      const payload = response.data || {};
      setState({
        loading: false,
        error: '',
        assets: payload.data || [],
        logs: payload.logs || [],
        summary: payload.summary || initialState.summary,
        filters: payload.filters || initialState.filters,
        pagination: payload.pagination || initialState.pagination,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error.response?.data?.message || 'Unable to load RFID tracking data for this college.',
      }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 250);
    return () => clearTimeout(timer);
  }, [page, search, status, departmentId, location]);

  const lookupIdentifier = async (value = identifier) => {
    const code = String(value || '').trim();
    if (!code || actionBusy) return null;
    setActionBusy(true);
    setActionError('');
    setFeedback('');
    try {
      const response = await apiClient.get(`/api/college/rfid/lookup/${encodeURIComponent(code)}`);
      const asset = response.data?.data;
      if (!asset?.id) throw new Error('The tracking lookup returned an invalid asset.');
      setLookupResult(asset);
      setFeedback(t('Asset found.'));
      return asset;
    } catch (error) {
      setLookupResult(null);
      setActionError(error.response?.data?.message || 'Unable to look up this tracking identifier.');
      return null;
    } finally {
      setActionBusy(false);
    }
  };

  const recordScan = async (value = identifier, method = scanMethod) => {
    const code = String(value || '').trim();
    if (!code || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setFeedback('');
    try {
      const response = await apiClient.post('/api/college/rfid/scan', { method, value: code });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to record this scan.');
      setLookupResult(response.data.data?.asset || lookupResult);
      setFeedback(t('Scan recorded.'));
      setIdentifier(code);
      await loadData();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Unable to record this scan.');
    } finally {
      setActionBusy(false);
    }
  };

  const startCamera = async () => {
    if (scannerRef.current || scanning) return;
    if (!window.isSecureContext && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
      setActionError(t('QR camera scans require HTTPS or localhost.'));
      return;
    }
    setActionError('');
    cameraScanHandledRef.current = false;
    const scanner = new Html5Qrcode('college-rfid-qr-reader');
    scannerRef.current = scanner;
    setScanning(true);
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decoded) => {
          const code = String(decoded || '').trim();
          if (!code || cameraScanHandledRef.current || actionBusy) return;
          cameraScanHandledRef.current = true;
          void stopCamera().then(() => recordScan(code, 'qr'));
        },
        () => {},
      );
    } catch {
      scannerRef.current = null;
      setScanning(false);
      try {
        scanner.clear();
      } catch (clearError) {
        console.error('College tracking QR scanner cleanup failed:', clearError);
      }
      setActionError(t('Could not access the camera. Check browser permission and try again.'));
    }
  };

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch (error) {
      console.error('College tracking QR scanner stop failed:', error);
    }
    try {
      scanner.clear();
    } catch (error) {
      console.error('College tracking QR scanner clear failed:', error);
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (scanner) {
      Promise.resolve(scanner.stop())
        .then(() => scanner.clear())
        .catch((error) => console.error('College tracking QR scanner cleanup failed:', error));
      scannerRef.current = null;
    }
  }, []);

  const saveRfidTag = async (asset) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setFeedback('');
    try {
      const rfidTag = tagValues[asset.id] ?? asset.rfidTag ?? '';
      await apiClient.post(`/api/college/rfid/assets/${asset.id}/tags`, { rfidTag: rfidTag.trim() || null });
      setFeedback(t('Tracking tag updated.'));
      setTagValues((previous) => {
        const next = { ...previous };
        delete next[asset.id];
        return next;
      });
      await loadData();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Unable to update the RFID tag.');
    } finally {
      setActionBusy(false);
    }
  };

  const generateQr = async (asset) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setFeedback('');
    try {
      await apiClient.post(`/api/college/rfid/assets/${asset.id}/qr/regenerate`, {});
      setFeedback(t('QR code generated.'));
      await loadData();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Unable to generate a QR code.');
    } finally {
      setActionBusy(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.logs;
    return state.logs.filter((entry) => {
      const haystack = [
        entry.tag,
        entry.action,
        entry.location,
        entry.asset?.name,
        entry.asset?.assetCode,
        entry.asset?.serialNumber,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [state.logs, search]);

  const hasFilters = Boolean(search || status || departmentId || location);

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        {[
          { key: 'totalAssets', label: t('Tracked Assets'), value: state.summary.totalAssets },
          { key: 'taggedAssets', label: t('Tagged'), value: state.summary.taggedAssets },
          { key: 'untaggedAssets', label: t('Untagged'), value: state.summary.untaggedAssets },
          { key: 'uniqueLocations', label: t('Locations'), value: state.summary.uniqueLocations },
          { key: 'recentScans', label: t('Recent Scans'), value: state.summary.recentScans },
        ].map((item) => (
          <div key={item.key} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', background: '#F5F7FA', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{item.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: '-8px 0 0', color: '#64748b', fontSize: '12px' }}>
        {t('Tracking totals cover the full college: tagged means a nonblank QR or RFID identifier, locations use registered asset locations, and recent scans cover 30 days.')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          {t('Search')}
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder={t('Asset, tag or location')}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          {t('Status')}
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">{t('All statuses')}</option>
            {state.filters.statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          {t('Department')}
          <select
            value={departmentId}
            onChange={(event) => {
              setPage(1);
              setDepartmentId(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">{t('All departments')}</option>
            {state.filters.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          {t('Location')}
          <select
            value={location}
            onChange={(event) => {
              setPage(1);
              setLocation(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">{t('All locations')}</option>
            {state.filters.locations.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch('');
              setStatus('');
              setDepartmentId('');
              setLocation('');
            }}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            {t('Clear filters')}
          </button>
        )}
      </div>

      <section style={{ border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px' }}>{t('Scan or look up an identifier')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) minmax(200px, 1fr) auto auto', gap: '10px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
            {t('Scan method')}
            <select value={scanMethod} onChange={(event) => { setScanMethod(event.target.value); setLookupResult(null); }} style={inputStyle}>
              <option value="manual">{t('Manual lookup')}</option>
              <option value="qr">{t('QR camera scan')}</option>
              <option value="rfid">{t('RFID reader input')}</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
            {t('Tracking identifier')}
            <input
              value={identifier}
              onChange={(event) => { setIdentifier(event.target.value); setLookupResult(null); setFeedback(''); setActionError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void lookupIdentifier(); } }}
              autoComplete="off"
              style={inputStyle}
            />
          </label>
          <button type="button" onClick={() => void lookupIdentifier()} disabled={actionBusy || scanning || !identifier.trim()} style={buttonStyle}>
            {t('Lookup')}
          </button>
          <button type="button" onClick={() => lookupResult && void recordScan()} disabled={actionBusy || scanning || !lookupResult} style={buttonStyle}>
            {t('Record scan')}
          </button>
        </div>
        {scanMethod === 'rfid' && <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '12px' }}>{t('RFID input uses a connected reader keyboard; hardware connectivity is not verified by this page.')}</p>}
        {scanMethod === 'qr' && (
          <div style={{ display: 'grid', justifyItems: 'start', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => scanning ? void stopCamera() : void startCamera()} disabled={actionBusy} style={buttonStyle}>
              {t(scanning ? 'Stop camera' : 'Start QR camera')}
            </button>
            <div id="college-rfid-qr-reader" style={{ width: 'min(100%, 360px)' }} />
          </div>
        )}
        {lookupResult && (
          <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: '#f0fdf4', color: '#166534' }}>
            <strong>{lookupResult.name} ({lookupResult.assetCode || lookupResult.id})</strong>
            <div>{t('QR Code')}: {lookupResult.qrCode || t('Not recorded')} · {t('RFID Tag')}: {lookupResult.rfidTag || t('Not linked')}</div>
            <div>{t('Location')}: {lookupResult.location || t('Unknown')}</div>
          </div>
        )}
        <p role="status" style={{ margin: '8px 0 0', color: '#166534' }}>{feedback && t(feedback)}</p>
        {actionError && <p role="alert" style={{ margin: '8px 0 0', color: '#991b1b' }}>{actionError}</p>}
      </section>

      {state.loading ? (
        <div style={{ padding: '24px', border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff' }}>{t('Loading RFID tracking data…')}</div>
      ) : state.error ? (
        <div role="alert" style={{ padding: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fff1f2', color: '#991b1b' }}>
          <p>{state.error}</p>
          <button type="button" onClick={() => void loadData()} style={buttonStyle}>{t('Retry')}</button>
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
              <strong>{t('College RFID / QR asset register')}</strong>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                {state.pagination.total} {t('items')}
                <button type="button" onClick={() => void loadData()} disabled={state.loading} style={buttonStyle}>{t('Refresh')}</button>
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F5F7FA' }}>
                  <tr>
                    <th style={thStyle}>{t('Asset')}</th>
                    <th style={thStyle}>{t('QR Code')}</th>
                    <th style={thStyle}>{t('RFID Tag')}</th>
                    <th style={thStyle}>{t('Department')}</th>
                    <th style={thStyle}>{t('Location')}</th>
                    <th style={thStyle}>{t('Status')}</th>
                    <th style={thStyle}>{t('Condition')}</th>
                    {canManageTags && <th style={thStyle}>{t('Actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {state.assets.length ? (
                    state.assets.map((asset) => (
                      <tr key={asset.id} style={{ borderTop: '1px solid #eef2f7' }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{asset.name || t('Unnamed asset')}</div>
                          <small style={{ color: '#64748b' }}>{asset.assetCode || '—'}</small>
                        </td>
                        <td style={tdStyle}>{asset.qrCode || t('Not recorded')}</td>
                        <td style={tdStyle}>
                          {canManageTags ? (
                            <input
                              aria-label={`${t('RFID Tag')} ${asset.assetCode || asset.id}`}
                              value={tagValues[asset.id] ?? asset.rfidTag ?? ''}
                              onChange={(event) => setTagValues((previous) => ({ ...previous, [asset.id]: event.target.value }))}
                              style={{ ...inputStyle, minWidth: '130px' }}
                            />
                          ) : asset.rfidTag || t('Not linked')}
                        </td>
                        <td style={tdStyle}>{asset.department || t('Unassigned')}</td>
                        <td style={tdStyle}>{asset.location || t('Unknown')}</td>
                        <td style={tdStyle}>{asset.status || '—'}</td>
                        <td style={tdStyle}>{asset.condition || '—'}</td>
                        {canManageTags && (
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <button type="button" onClick={() => void saveRfidTag(asset)} disabled={actionBusy} style={buttonStyle}>{t('Save RFID tag')}</button>
                            <button type="button" onClick={() => void generateQr(asset)} disabled={actionBusy} style={{ ...buttonStyle, marginLeft: '6px' }}>{t('Generate QR')}</button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canManageTags ? 8 : 7} style={{ padding: '22px', textAlign: 'center', color: '#64748b' }}>
                        {t('No matching assets found.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
              <strong>{t('Recent RFID / QR scan activity')}</strong>
              <span style={{ color: '#64748b' }}>{filteredLogs.length} logs</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F5F7FA' }}>
                  <tr>
                    <th style={thStyle}>{t('Time')}</th>
                    <th style={thStyle}>{t('Asset')}</th>
                    <th style={thStyle}>{t('Tag')}</th>
                    <th style={thStyle}>{t('Location')}</th>
                    <th style={thStyle}>{t('Action')}</th>
                    <th style={thStyle}>{t('Scanned by')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} style={{ borderTop: '1px solid #eef2f7' }}>
                        <td style={tdStyle}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={tdStyle}>{log.asset?.name || 'Unknown asset'}</td>
                        <td style={tdStyle}>{log.tag || '—'}</td>
                        <td style={tdStyle}>{log.location || '—'}</td>
                        <td style={tdStyle}>{log.action || 'scan'}</td>
                        <td style={tdStyle}>{log.scannedBy?.name || t('Unknown')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '22px', textAlign: 'center', color: '#64748b' }}>
                        {t('No recent scan activity available.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.6 : 1 }}
            >
              {t('Previous')}
            </button>
            <span style={{ color: '#475569' }}>{t('Page')} {page} {t('of')} {Math.max(1, state.pagination.totalPages || 1)}</span>
            <button
              type="button"
              disabled={page >= (state.pagination.totalPages || 1)}
              onClick={() => setPage((value) => Math.min(state.pagination.totalPages || 1, value + 1))}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: page >= (state.pagination.totalPages || 1) ? 'not-allowed' : 'pointer', opacity: page >= (state.pagination.totalPages || 1) ? 0.6 : 1 }}
            >
              {t('Next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: '12px',
  color: '#475569',
  fontWeight: 700,
};

const inputStyle = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
};

const buttonStyle = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top',
};

export default CollegeRFIDTracking;
