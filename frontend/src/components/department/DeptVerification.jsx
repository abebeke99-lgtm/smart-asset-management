import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, LoaderCircle, Plus, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';

const states = ['verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'];
const label = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const DeptVerification = () => {
  const { language } = useLanguage();
  const isAmharic = language === 'am';
  const copy = (english, amharic) => isAmharic ? amharic : english;
  const [sessions, setSessions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', assetId: '', state: 'verified', notes: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionResponse, assetResponse] = await Promise.all([
        apiClient.get('/department/verification'),
        apiClient.get('/department/assets', { params: { page: 1, limit: 100 } }),
      ]);
      setSessions(Array.isArray(sessionResponse.data?.data) ? sessionResponse.data.data : []);
      setAssets(Array.isArray(assetResponse.data?.data) ? assetResponse.data.data : []);
    } catch (requestError) {
      setSessions([]);
      setAssets([]);
      setError(requestError.response?.data?.message || copy('Unable to load verification data.', 'የማረጋገጫ መረጃ መጫን አልተቻለም።'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSession = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.post('/department/verification', { name: form.name.trim() });
      const session = response.data?.data;
      setForm((current) => ({ ...current, name: '' }));
      await load();
      if (session?.id) openSession(session.id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to create verification session.', 'የማረጋገጫ ክፍለ ጊዜ መፍጠር አልተቻለም።'));
    } finally {
      setBusy(false);
    }
  };

  const openSession = async (id) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.get(`/department/verification/${id}`);
      setSelected(response.data?.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to load session details.', 'የክፍለ ጊዜ ዝርዝር መጫን አልተቻለም።'));
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    if (!selected || !form.assetId || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/department/verification/${selected.id}/items`, { asset_id: Number(form.assetId), state: form.state, notes: form.notes.trim() });
      setForm((current) => ({ ...current, assetId: '', notes: '' }));
      await openSession(selected.id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to record verification item.', 'የማረጋገጫ እቃ መመዝገብ አልተቻለም።'));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (action) => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/department/verification/${selected.id}/${action}`);
      await load();
      await openSession(selected.id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to update verification session.', 'የማረጋገጫ ክፍለ ጊዜ ማዘመን አልተቻለም።'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="department-verification-page" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><p><ShieldCheck size={15} aria-hidden="true" /> {copy('Department operations', 'የክፍል ስራዎች')}</p><h1>{copy('Asset Verification', 'የንብረት ማረጋገጫ')}</h1><p>{copy('Verify assets using real records in your authorized department.', 'በተፈቀደው የክፍል መረጃ ንብረቶችን ያረጋግጡ።')}</p></div>
      <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> {copy('Refresh', 'አድስ')}</button>
    </header>
    {error && <div role="alert" style={{ padding: 12, marginBottom: 16, border: '1px solid #fecaca', color: '#991b1b' }}>{error}<button type="button" onClick={load}>{copy('Retry', 'እንደገና ሞክር')}</button></div>}
    <form onSubmit={createSession} style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={copy('New verification session name', 'የአዲስ ማረጋገጫ ክፍለ ጊዜ ስም')} required /><button type="submit" disabled={busy}><Plus size={16} /> {copy('Start session', 'ክፍለ ጊዜ ጀምር')}</button></form>
    {loading ? <div aria-busy="true"><LoaderCircle /> {copy('Loading verification data...', 'የማረጋገጫ መረጃ በመጫን ላይ...')}</div> : sessions.length === 0 ? <div><ClipboardCheck size={28} /><p>{copy('No verification sessions found.', 'ምንም የማረጋገጫ ክፍለ ጊዜ አልተገኘም።')}</p></div> : <div style={{ display: 'grid', gap: 12 }}>{sessions.map((session) => <article key={session.id} style={{ border: '1px solid #dbe3ec', padding: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong>#{session.id} {session.name}</strong><div>{label(session.status)} · {new Date(session.createdAt).toLocaleString()}</div></div><button type="button" onClick={() => openSession(session.id)}><Eye size={16} /> {copy('View', 'ይመልከቱ')}</button></div></article>)}</div>}
    {selected && <div role="dialog" aria-modal="true" style={{ marginTop: 24, padding: 20, border: '2px solid #2563eb' }}><header style={{ display: 'flex', justifyContent: 'space-between' }}><h2>#{selected.id} {selected.name}</h2><button type="button" onClick={() => setSelected(null)} aria-label={copy('Close', 'ዝጋ')}><X /></button></header><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{['in_progress', 'submitted'].includes(selected.status) && <button type="button" onClick={() => changeStatus('submit')} disabled={busy}><Send size={15} /> {copy('Submit', 'አስገባ')}</button>}{selected.status === 'submitted' && <button type="button" onClick={() => changeStatus('finalize')} disabled={busy}><CheckCircle2 size={15} /> {copy('Finalize', 'አጠናቅ')}</button>}</div><form onSubmit={addItem} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} required><option value="">{copy('Select department asset', 'የክፍል ንብረት ይምረጡ')}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode} · {asset.name}</option>)}</select><select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}>{states.map((state) => <option key={state} value={state}>{label(state)}</option>)}</select><input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={copy('Notes', 'ማስታወሻ')} /><button type="submit" disabled={busy}><ClipboardCheck size={15} /> {copy('Record item', 'እቃ መዝግብ')}</button></form><ul>{(selected.VerificationItems || []).map((item) => <li key={item.id}>{item.Asset?.assetCode || item.assetId}: {label(item.state)} {item.notes ? `· ${item.notes}` : ''}</li>)}</ul></div>}
  </section>;
};

export default DeptVerification;
