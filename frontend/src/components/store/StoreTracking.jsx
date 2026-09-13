import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ClipboardList, RefreshCw, ScanLine, Search, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';

const statusOptions = ['available', 'assigned', 'in-use', 'in_store', 'in-store', 'maintenance', 'damaged', 'missing', 'retired'];
const conditionOptions = ['Good', 'Fair', 'Damaged', 'Poor', 'Needs Repair'];
const defaultObservation = { presence: 'found', location: '', status: 'available', condition: 'Good', quantity: '1', identifier: '' };

const typeMatches = (candidate, query) => {
  const value = String(candidate || '').toLowerCase();
  return value.includes(String(query || '').trim().toLowerCase());
};

const evaluateResult = (asset, observation, inventoryRow) => {
  const officialLocation = String(asset?.location || '').trim();
  const observedLocation = String(observation.location || officialLocation).trim();
  const officialStatus = String(asset?.status || '').trim() || 'available';
  const observedStatus = String(observation.status || officialStatus).trim() || 'available';
  const officialCondition = String(asset?.condition || '').trim() || 'Good';
  const observedCondition = String(observation.condition || officialCondition).trim() || 'Good';
  const qty = Number(inventoryRow?.availableQuantity ?? inventoryRow?.quantity ?? 0);
  const observedQuantity = Number(observation.quantity ?? qty);

  if (observation.presence === 'not_found') return 'missing';
  const mismatches = [];
  if (officialLocation && observedLocation && officialLocation !== observedLocation) mismatches.push('wrong_location');
  if (officialStatus && observedStatus && officialStatus !== observedStatus) mismatches.push('needs_review');
  if (officialCondition && observedCondition && officialCondition !== observedCondition) mismatches.push('damaged');
  if (Number.isFinite(qty) && Number.isFinite(observedQuantity) && qty !== observedQuantity) mismatches.push('needs_review');

  if (mismatches.length === 0) return 'verified';
  if (mismatches.includes('wrong_location')) return 'wrong_location';
  if (mismatches.includes('damaged')) return 'damaged';
  return 'needs_review';
};

const StoreTracking = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [activeTab, setActiveTab] = useState('lookup');
  const [assets, setAssets] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, verified: 0, pending: 0, discrepancies: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [assetQuery, setAssetQuery] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [observation, setObservation] = useState(defaultObservation);
  const [verificationNotes, setVerificationNotes] = useState('');

  const t = isAmharic ? {
    title: 'የንብረት ማረጋገጫ',
    subtitle: 'ለሙሉ የዩኒቨርሲቲ ንብረቶች ልዩነቶችን የሚያሳይ ማረጋገጫ ሥራ።',
    lookup: 'ፍለጋ',
    placeholder: 'RFID, QR, asset code ወይም serial ያስገቡ',
    findAsset: 'ንብረት ፈልግ',
    pageButton: '+ አዲስ ማረጋገጫ',
    overview: 'አጠቃላይ እይታ',
    verified: 'ተረጋግጧል',
    pending: 'በመጠባበቅ ላይ',
    discrepancies: 'ልዩነቶች',
    total: 'አጠቃልለው ንብረቶች',
    verifyAsset: 'ንብረት ማረጋገጫ',
    officialRecord: 'የሕጋዊ መዝገብ',
    observedRecord: 'የተመለከተው መዝገብ',
    confirm: 'ማረጋገጫ አረጋግጥ',
    loading: 'በመጫን ላይ...',
    retry: 'እንደገና ሞክር',
    notFound: 'ምንም አይነት ንብረት አልተገኘም።',
    assetFound: 'ንብረት በተሳካ ሁኔታ ተገኝቷል።',
    noSession: 'እስካሁን ክፍት ማረጋገጫ አልነበረም።',
    verificationHistory: 'የተረጋገጠ ታሪክ',
    method: 'ዘዴ',
    result: 'ውጤት',
    verifiedBy: 'የተረጋገጠው',
    notes: 'ማስታወሻ',
    missing: 'የጎደለ',
    warning: 'ልዩነት',
    view: 'ይመልከቱ',
  } : {
    title: 'Asset Verification',
    subtitle: 'Verify physical university assets against their official records and identify discrepancies.',
    lookup: 'Lookup',
    placeholder: 'Enter RFID, QR, asset code or serial number',
    findAsset: 'Find Asset',
    pageButton: '+ New Verification',
    overview: 'Overview',
    verified: 'Verified',
    pending: 'Pending',
    discrepancies: 'Discrepancies',
    total: 'Total Assets',
    verifyAsset: 'Verify Asset',
    officialRecord: 'Official Record',
    observedRecord: 'Observed Record',
    confirm: 'Confirm Verification',
    loading: 'Loading...',
    retry: 'Retry',
    notFound: 'No matching asset was found.',
    assetFound: 'Asset identified successfully.',
    noSession: 'No verification sessions are available yet.',
    verificationHistory: 'Verification History',
    method: 'Method',
    result: 'Result',
    verifiedBy: 'Verified By',
    notes: 'Notes',
    missing: 'Missing',
    warning: 'Mismatch',
    view: 'View',
  };

  const fetchStoreData = useCallback(async () => {
    try {
      setLoading(true);
      const [assetsResponse, inventoryResponse, sessionsResponse] = await Promise.all([
        apiClient.get('/api/assets', { params: { limit: 1000 } }),
        apiClient.get('/api/store/inventory', { params: { page: 1, pageSize: 200 } }),
        apiClient.get('/api/store/verification'),
      ]);

      const assetRows = assetsResponse.data?.data || assetsResponse.data?.assets || [];
      const inventory = inventoryResponse.data?.data?.items || inventoryResponse.data?.data || [];
      const sessionRows = sessionsResponse.data?.data || [];
      const verificationItems = sessionRows.flatMap((session) => (session.VerificationItems || []).map((item) => ({ ...item, sessionId: session.id, sessionName: session.name })));
      const verifiedCount = verificationItems.filter((item) => item.state === 'verified').length;
      const pendingCount = verificationItems.filter((item) => item.state === 'needs_review' || item.state === 'unverified' || item.state === 'wrong_location').length;
      const discrepancyCount = verificationItems.filter((item) => ['wrong_location', 'damaged', 'missing', 'needs_review', 'unidentified'].includes(item.state)).length;

      setAssets(assetRows);
      setInventoryRows(inventory);
      setSessions(sessionRows);
      setSummary({
        totalAssets: assetRows.length,
        verified: verifiedCount,
        pending: pendingCount,
        discrepancies: discrepancyCount,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to load verification data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  const activeSession = useMemo(
    () => sessions.find((session) => ['draft', 'in_progress', 'submitted'].includes(session.status)) || sessions[0] || null,
    [sessions]
  );

  const uniqueLocations = useMemo(
    () => [...new Set(assets.map((asset) => asset.location).filter(Boolean))],
    [assets]
  );

  const findAssetByIdentifier = useCallback(async (query) => {
    const normalized = String(query || '').trim();
    if (!normalized) {
      setLookupMessage(t.notFound);
      return null;
    }

    try {
      const response = await apiClient.get('/api/assets', { params: { search: normalized, limit: 50 } });
      const rows = response.data?.data || response.data?.assets || [];
      const match = rows.find((asset) => {
        const candidates = [
          asset.assetCode,
          asset.rfidTag,
          asset.serialNumber,
          asset.name,
          asset.location,
        ].filter(Boolean);
        return candidates.some((value) => typeMatches(value, normalized));
      });

      if (!match) {
        setLookupMessage(t.notFound);
        setSelectedAsset(null);
        return null;
      }

      const inventoryMatch = Array.isArray(inventoryRows)
        ? inventoryRows.find((row) => Number(row.assetId) === Number(match.id) || String(row.assetId) === String(match.id))
        : null;

      setSelectedAsset(match);
      setObservation((current) => ({
        ...current,
        location: match.location || '',
        status: match.status || 'available',
        condition: match.condition || 'Good',
        quantity: inventoryMatch ? String(inventoryMatch.availableQuantity ?? inventoryMatch.quantity ?? 1) : '1',
        identifier: normalized,
      }));
      setLookupMessage(t.assetFound);
      return match;
    } catch (error) {
      setLookupMessage(error?.response?.data?.message || t.notFound);
      setSelectedAsset(null);
      return null;
    }
  }, [inventoryRows, t.assetFound, t.notFound]);

  const handleCreateSession = useCallback(async () => {
    const nextName = `Store Verification ${new Date().toISOString().slice(0, 10)}`;
    const response = await apiClient.post('/api/store/verification', { name: nextName });
    const session = response.data?.data || response.data?.session || null;
    if (session) {
      setSelectedSessionId(session.id);
      setSessions((current) => [session, ...current]);
      return session.id;
    }
    return selectedSessionId;
  }, [selectedSessionId]);

  const handleVerify = useCallback(async () => {
    if (!selectedAsset) {
      toast.error(t.notFound);
      return;
    }

    const sessionId = selectedSessionId || activeSession?.id || await handleCreateSession();
    if (!sessionId) {
      toast.error('Unable to create a verification session');
      return;
    }

    const inventoryMatch = Array.isArray(inventoryRows)
      ? inventoryRows.find((row) => Number(row.assetId) === Number(selectedAsset.id) || String(row.assetId) === String(selectedAsset.id))
      : null;
    const state = evaluateResult(selectedAsset, observation, inventoryMatch);

    setSaving(true);
    try {
      await apiClient.post(`/api/store/verification/${sessionId}/items`, {
        asset_id: selectedAsset.id,
        state,
        notes: verificationNotes || `${state === 'verified' ? 'Asset physically verified' : 'Asset verification recorded with discrepancy'} | ${observation.identifier || selectedAsset.assetCode || selectedAsset.rfidTag || 'manual scan'}`,
      });
      toast.success(state === 'verified' ? 'Asset verified successfully.' : 'Verification completed with discrepancies.');
      setVerificationNotes('');
      setSelectedAsset(null);
      setObservation(defaultObservation);
      setAssetQuery('');
      await fetchStoreData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Verification could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [activeSession, fetchStoreData, handleCreateSession, inventoryRows, observation, selectedAsset, selectedSessionId, t.notFound, verificationNotes]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 16, padding: 30, textAlign: 'center' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> {t.loading}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: isDark ? '#020817' : '#f8fafc', minHeight: '100vh', color: isDark ? '#e2e8f0' : '#0f172a' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>{t.title}</h1>
            <p style={{ margin: '8px 0 0', color: isDark ? '#94a3b8' : '#64748b' }}>{t.subtitle}</p>
          </div>
          <button type="button" onClick={handleCreateSession} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}>
            {t.pageButton}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span>{t.total}</span><ClipboardCheck size={18} /></div>
            <strong style={{ fontSize: 28 }}>{summary.totalAssets}</strong>
          </div>
          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span>{t.verified}</span><CheckCircle2 size={18} /></div>
            <strong style={{ fontSize: 28 }}>{summary.verified}</strong>
          </div>
          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span>{t.pending}</span><ClipboardList size={18} /></div>
            <strong style={{ fontSize: 28 }}>{summary.pending}</strong>
          </div>
          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span>{t.discrepancies}</span><AlertTriangle size={18} /></div>
            <strong style={{ fontSize: 28 }}>{summary.discrepancies}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Search size={18} /> <h3 style={{ margin: 0 }}>{t.verifyAsset}</h3></div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <input
                value={assetQuery}
                onChange={(event) => setAssetQuery(event.target.value)}
                placeholder={t.placeholder}
                style={{ flex: 1, minWidth: 220, borderRadius: 10, border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, background: isDark ? '#020817' : '#fff', color: isDark ? '#e2e8f0' : '#0f172a', padding: '10px 12px' }}
              />
              <button type="button" onClick={() => findAssetByIdentifier(assetQuery)} style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
                {t.findAsset}
              </button>
            </div>

            {lookupMessage && <div style={{ marginBottom: 12, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>{lookupMessage}</div>}

            {selectedAsset && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, textTransform: 'uppercase' }}>Asset</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{selectedAsset.name}</div>
                  </div>
                  <div style={{ background: '#ecfeff', color: '#0f766e', borderRadius: 999, padding: '6px 10px', fontWeight: 700 }}>Live Record</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>Asset Code</div>
                    <div>{selectedAsset.assetCode || '-'}</div>
                  </div>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>Serial</div>
                    <div>{selectedAsset.serialNumber || '-'}</div>
                  </div>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>RFID</div>
                    <div>{selectedAsset.rfidTag || '-'}</div>
                  </div>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>Status</div>
                    <div>{selectedAsset.status || 'available'}</div>
                  </div>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>Location</div>
                    <div>{selectedAsset.location || '-'}</div>
                  </div>
                  <div style={{ background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>Condition</div>
                    <div>{selectedAsset.condition || 'Good'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Physical Presence</span>
                    <select value={observation.presence} onChange={(event) => setObservation((current) => ({ ...current, presence: event.target.value }))} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }}>
                      <option value="found">Found</option>
                      <option value="not_found">Not Found</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Observed Location</span>
                    <select value={observation.location} onChange={(event) => setObservation((current) => ({ ...current, location: event.target.value }))} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }}>
                      <option value="">Use official</option>
                      {uniqueLocations.map((location) => <option key={location} value={location}>{location}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Observed Status</span>
                    <select value={observation.status} onChange={(event) => setObservation((current) => ({ ...current, status: event.target.value }))} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }}>
                      {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Observed Condition</span>
                    <select value={observation.condition} onChange={(event) => setObservation((current) => ({ ...current, condition: event.target.value }))} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }}>
                      {conditionOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Observed Quantity</span>
                    <input type="number" min="0" value={observation.quantity} onChange={(event) => setObservation((current) => ({ ...current, quantity: event.target.value }))} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Identifier Confirmed</span>
                    <input value={observation.identifier} onChange={(event) => setObservation((current) => ({ ...current, identifier: event.target.value }))} placeholder={selectedAsset.assetCode || selectedAsset.rfidTag || 'identifier'} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px' }} />
                  </label>
                </div>

                <div style={{ marginTop: 18 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Verification Notes</span>
                    <textarea value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} rows={4} style={{ background: isDark ? '#020817' : '#fff', border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`, borderRadius: 10, padding: '10px 12px', resize: 'vertical' }} />
                  </label>
                </div>

                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={handleVerify} disabled={saving} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontWeight: 700, cursor: 'pointer' }}>
                    {saving ? 'Saving...' : t.confirm}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={18} /> <h3 style={{ margin: 0 }}>{t.verificationHistory}</h3></div>
            {sessions.length === 0 ? (
              <div style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{t.noSession}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {sessions.slice(0, 8).map((session) => (
                  <div key={session.id} style={{ border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <strong>{session.name}</strong>
                      <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{session.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{new Date(session.createdAt).toLocaleString()}</div>
                    {(session.VerificationItems || []).slice(0, 3).map((item) => (
                      <div key={`${session.id}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                        <span>{item.Asset?.assetCode || 'Asset'}</span>
                        <span style={{ color: item.state === 'verified' ? '#16a34a' : '#f59e0b' }}>{item.state}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreTracking;
