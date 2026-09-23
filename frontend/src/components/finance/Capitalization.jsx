import React, { useEffect, useState } from 'react';
import { CheckCircle, Eye, Loader2, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const money = (value) => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value) => value ? new Date(value).toLocaleDateString() : 'Not available';

export default function Capitalization() {
  const [records, setRecords] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ invoiceId: '', name: '', category: '', serialNumber: '', manufacturer: '', model: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/finance/capitalization', { params: { search: query || undefined } });
      const data = response.data || {};
      setRecords(Array.isArray(data.data) ? data.data : []);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setSummary(data.summary || null);
    } catch (requestError) {
      setRecords([]); setCandidates([]); setSummary(null);
      setError(requestError.response?.data?.message || 'Unable to load capitalization data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCandidate = (candidate) => {
    const item = candidate.invoice?.items?.[0];
    setSelected(candidate);
    setForm({ invoiceId: candidate.invoice?.id || '', name: item?.description || '', category: '', serialNumber: '', manufacturer: '', model: '', notes: '' });
  };

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiClient.post('/finance/capitalization', form);
      setSelected(null); setForm({ invoiceId: '', name: '', category: '', serialNumber: '', manufacturer: '', model: '', notes: '' });
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to capitalize this transaction.'); }
    finally { setSaving(false); }
  };

  return <main style={{ padding: 24, background: '#f6f8fb', minHeight: '100vh', color: '#172033' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}><div><p style={{ color: '#64748b', margin: 0 }}>Finance / Capitalization</p><h1 style={{ margin: '6px 0' }}>Capitalization</h1><p style={{ color: '#64748b', margin: 0 }}>Convert qualifying procurement transactions into recognized university assets.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button></header>
    {error && <div role="alert" style={{ background: '#fff1f2', color: '#be123c', padding: 12, marginBottom: 16 }}>{error}</div>}
    {summary && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>{[['Eligible purchases', summary.eligible], ['Pending verification', summary.pendingVerification], ['Capitalized assets', summary.capitalizedAssets], ['Total capitalized value', money(summary.totalCapitalizedValue)]].map(([label, value]) => <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16 }}><small>{label}</small><strong style={{ display: 'block', marginTop: 8, fontSize: 20 }}>{value}</strong></div>)}</section>}
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, marginBottom: 20 }}><label htmlFor="capitalization-search"><Search size={16} /> Search invoices or suppliers</label><input id="capitalization-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Invoice number or supplier" style={{ marginLeft: 12, minWidth: 280 }} /></section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, marginBottom: 20, overflowX: 'auto' }}><h2>Eligible transactions</h2>{loading ? <p><Loader2 /> Loading capitalization data...</p> : candidates.length === 0 ? <p>No eligible transactions found. There are currently no procurement transactions ready for capitalization.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Invoice', 'Supplier', 'Purchase order', 'Invoice amount', 'Status', 'Reason / action'].map((heading) => <th key={heading} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>)}</tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.invoice?.id}>{[candidate.invoice?.invoiceNumber || 'Not available', candidate.invoice?.supplierName || 'Not available', candidate.purchaseOrder?.poNumber || 'Not available', money(candidate.invoice?.totalAmount)].map((value, index) => <td key={index} style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{value}</td>)}<td style={{ padding: 10 }}>{candidate.eligible ? <span style={{ color: '#166534' }}><CheckCircle size={15} /> Eligible</span> : 'Blocked'}</td><td style={{ padding: 10 }}>{candidate.eligible ? <button type="button" onClick={() => openCandidate(candidate)}><Eye size={15} /> Review</button> : candidate.reasons?.join(' ') || 'Not available'}</td></tr>)}</tbody></table>}</section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, overflowX: 'auto' }}><h2>Capitalization history</h2>{records.length === 0 ? <p>No capitalization records found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Asset', 'Invoice', 'Purchase order', 'Acquisition date', 'Capitalized amount', 'Status'].map((heading) => <th key={heading} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.id}><td style={{ padding: 10 }}>{record.asset?.assetCode || record.asset?.name || 'Not available'}</td><td style={{ padding: 10 }}>{record.invoice?.invoiceNumber || 'Not available'}</td><td style={{ padding: 10 }}>{record.purchaseOrder?.poNumber || 'Not available'}</td><td style={{ padding: 10 }}>{date(record.acquisitionDate)}</td><td style={{ padding: 10 }}>{money(record.capitalizedAmount)}</td><td style={{ padding: 10 }}>{record.status || 'Not available'}</td></tr>)}</tbody></table>}</section>
    {selected && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', padding: 24, overflow: 'auto' }}><form onSubmit={submit} style={{ background: '#fff', maxWidth: 640, margin: 'auto', padding: 24 }}><button type="button" onClick={() => setSelected(null)} style={{ float: 'right' }} aria-label="Close"><X /></button><h2>Review capitalization</h2><p>Invoice {selected.invoice?.invoiceNumber || 'Not available'} for {money(selected.invoice?.totalAmount)}. The amount is read-only and comes from the verified invoice.</p>{[['name', 'Asset name'], ['category', 'Asset category'], ['serialNumber', 'Serial number'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['notes', 'Notes']].map(([key, label]) => <label key={key} style={{ display: 'block', margin: '12px 0' }}>{label}<input required={key === 'name' || key === 'category'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} style={{ display: 'block', width: '100%' }} /></label>)}<button type="submit" disabled={saving}>{saving ? 'Posting...' : 'Confirm capitalization'}</button></form></div>}
  </main>;
}
