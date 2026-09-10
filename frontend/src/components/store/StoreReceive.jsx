import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, LoaderCircle, PackagePlus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import axios from 'axios';
import './StoreReceive.css';

const english = { title: 'Add Stock', subtitle: 'Receive additional quantity into Store inventory', back: 'Back to Inventory', asset: 'Asset / Item', search: 'Search inventory...', quantity: 'Quantity to add', location: 'Location', condition: 'Condition', reference: 'Reference', notes: 'Notes', submit: 'Add Stock', adding: 'Adding Stock...', required: 'Select an inventory item and enter a valid quantity.', success: 'Stock added successfully.', error: 'Stock could not be added.', loading: 'Loading inventory...', current: 'Current quantity', resulting: 'New quantity', good: 'Good', fair: 'Fair', damaged: 'Damaged' };
const amharic = { ...english, title: 'እቃ ጨምር', subtitle: 'ተጨማሪ መጠን ወደ መጋዘን እቃ መዝገብ ተቀበል', back: 'ወደ እቃዎች ተመለስ', quantity: 'የሚጨመር መጠን', submit: 'እቃ ጨምር', adding: 'እየጨመረ ነው...', success: 'እቃ በተሳካ ሁኔታ ተጨምሯል።', error: 'እቃ መጨመር አልተቻለም።', loading: 'እቃዎች በመጫን ላይ...' };
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StoreReceive() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = language === 'en' ? english : amharic;
  const [inventory, setInventory] = useState([]);
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState('');
  const [form, setForm] = useState({ quantity: '1', location: '', condition: 'Good', reference: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadInventory = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/store/inventory', { params: { page: 1, pageSize: 100 } });
      setInventory(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) { setMessage({ type: 'error', text: error.response?.data?.message || t.error }); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadInventory(); }, []);
  const selected = inventory.find((item) => String(item.asset_id || item.id) === String(assetId));
  const filtered = inventory.filter((item) => [item.name, item.asset_tag, item.asset_id, item.category, item.serial_number].join(' ').toLowerCase().includes(query.toLowerCase()));
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!assetId || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) { setMessage({ type: 'error', text: t.required }); return; }
    setSaving(true); setMessage({ type: '', text: '' });
    try {
      await axios.post(`/api/inventory/${assetId}/movement`, { type: 'receive', quantity, to_location: form.location, condition: form.condition, reference: form.reference, notes: form.notes });
      setMessage({ type: 'success', text: t.success });
      setForm({ quantity: '1', location: '', condition: 'Good', reference: '', notes: '' });
      await loadInventory();
    } catch (error) { setMessage({ type: 'error', text: error.response?.data?.message || t.error }); }
    finally { setSaving(false); }
  };
  const MessageIcon = message.type === 'success' ? CheckCircle2 : X;

  return <main className="store-receive-page"><header className="receive-header"><button className="back-button" type="button" onClick={() => navigate('/store/inventory')}><ArrowLeft size={17} /> {t.back}</button><p className="receive-eyebrow">Store Inventory</p><h1>{t.title}</h1><p>{t.subtitle}</p></header><div className="receive-layout"><section className="receive-card"><div className="receive-card-heading"><div><PackagePlus size={22} /><h2>{t.title}</h2></div><ClipboardList size={20} /></div>{message.text && <div className={`receive-message ${message.type}`}><MessageIcon size={18} /> {message.text}</div>}<form onSubmit={submit}><label>{t.asset}<div className="asset-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></div><select required value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">{loading ? t.loading : t.asset}</option>{filtered.map((item) => <option key={item.id} value={item.asset_id || item.id}>{item.asset_tag || item.asset_id || item.id} - {item.name || 'Inventory item'}</option>)}</select></label><div className="receive-form-grid"><label>{t.quantity}<input required min="1" max="1000000" step="1" type="number" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label><label>{t.location}<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder={selected?.location || 'Store'} /></label><label>{t.condition}<select value={form.condition} onChange={(event) => update('condition', event.target.value)}><option>{t.good}</option><option>{t.fair}</option><option>{t.damaged}</option></select></label><label>{t.reference}<input value={form.reference} onChange={(event) => update('reference', event.target.value)} /></label></div><label>{t.notes}<textarea rows="4" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label><button className="submit-stock" type="submit" disabled={saving || loading}>{saving ? <><LoaderCircle className="spin" size={18} /> {t.adding}</> : <><PackagePlus size={18} /> {t.submit}</>}</button></form></section><aside className="receive-summary"><h2>{t.asset}</h2>{selected ? <><strong>{selected.name || selected.asset_tag}</strong><p>{selected.category || '-'}</p><div><span>{t.current}</span><strong>{number(selected.quantity)}</strong></div><div><span>{t.resulting}</span><strong className="resulting-quantity">{number(selected.quantity) + number(form.quantity)}</strong></div></> : <p>Select an inventory item to review the stock change before submitting.</p>}</aside></div></main>;
}
