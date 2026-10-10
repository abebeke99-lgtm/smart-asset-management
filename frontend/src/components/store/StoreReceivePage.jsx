/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, FilePlus2, LoaderCircle, PackagePlus, RefreshCw, Search, X } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import './StoreReceivePage.css';

const en = { title: 'Receive Assets', subtitle: 'Receive and register incoming university assets into store inventory.', refresh: 'Refresh', receive: 'Receive Delivery', search: 'Search receipts or assets...', reference: 'Receiving Reference / GRN', supplier: 'Supplier', purchaseOrder: 'Purchase Order / Reference', invoice: 'Invoice Number', deliveryNote: 'Delivery Note Number', date: 'Received Date', asset: 'Product', assetCode: 'Item Code', category: 'Category', unit: 'Unit of Measurement', quantity: 'Quantity', unitPrice: 'Unit Cost', totalCost: 'Total Cost', batchNumber: 'Batch Number', expiryDate: 'Expiry Date', location: 'Storage Location', condition: 'Condition', notes: 'Notes', submit: 'Save Receipt', saving: 'Saving...', today: 'Received Today', month: 'This Month', inspection: 'Pending Inspection', receipts: 'Receipts', status: 'Status', receivedBy: 'Received By', actions: 'Actions', view: 'View', loading: 'Loading receiving records...', error: 'Unable to load receiving records.', forbidden: 'You do not have permission to receive assets.', retry: 'Retry', empty: 'No receiving records found', emptyText: 'Received assets will appear here after a receiving transaction is created.', select: 'Select product', inventoryLoading: 'Loading inventory...', required: 'Enter a receiving reference, select a product, enter a positive whole-number quantity, and provide a receiving location.', success: 'Stock receipt saved successfully.', failed: 'Stock could not be added.', invalidExpiry: 'Enter a valid expiry date on or after the received date and provide its batch number.', close: 'Cancel', good: 'Good', fair: 'Fair', damaged: 'Damaged', previous: 'Previous', next: 'Next' };
const am = { ...en, title: 'የእቃ መቀበያ', subtitle: 'የተላኩ እቃዎችን በደረሰኝ መሠረት ወደ መጋዘን ይመዝግቡ።', refresh: 'አድስ', receive: 'የተላከ እቃ ተቀበል', search: 'ደረሰኝ ወይም እቃ ፈልግ...', reference: 'የመቀበያ ማጣቀሻ / GRN', supplier: 'አቅራቢ', quantity: 'ብዛት', unitPrice: 'የአንድ እቃ ዋጋ', totalCost: 'ጠቅላላ ዋጋ', batchNumber: 'የባች ቁጥር', expiryDate: 'የማብቂያ ቀን', asset: 'እቃ', location: 'የመቀበያ ቦታ', notes: 'ማስታወሻ', submit: 'ደረሰኝ አስቀምጥ', saving: 'በመጫን ላይ...', today: 'ዛሬ የተቀበለ', month: 'በዚህ ወር', receipts: 'ደረሰኞች', status: 'ሁኔታ', receivedBy: 'የተቀበለው', actions: 'ተግባር', view: 'ይመልከቱ', loading: 'በመጫን ላይ...', error: 'ስህተት፦ የመቀበያ መዝገቦችን መጫን አልተቻለም።', retry: 'እንደገና ሞክር', empty: 'የመቀበያ መዝገብ የለም', select: 'እቃ ይምረጡ', required: 'የመቀበያ ማጣቀሻ ያስገቡ፣ እቃ ይምረጡ፣ ከዜሮ በላይ የሆነ ሙሉ ቁጥር ያስገቡ እና የመቀበያ ቦታ ያስገቡ።', success: 'የመቀበያ ደረሰኙ ተቀምጧል።', failed: 'ስህተት፦ ክምችት መጨመር አልተቻለም።', close: 'ሰርዝ' };
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const createSubmissionId = () => `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const initialForm = () => ({ reference: '', supplier: '', purchaseOrder: '', invoice: '', deliveryNote: '', date: today(), assetId: '', quantity: '1', unitPrice: '', batchNumber: '', expiryDate: '', location: '', condition: 'Good', notes: '' });
const labels = { en: { receipt: 'Receipt', noInventory: 'No inventory items are available' }, am: { receipt: 'ደረሰኝ', noInventory: 'ምንም የዕቃ መዝገብ የለም' } };

export default function StoreReceivePage() {
  const { language } = useLanguage();
  const submitLock = useRef(false);
  const submissionId = useRef('');
  const [records, setRecords] = useState([]); const [inventory, setInventory] = useState([]); const [suppliers, setSuppliers] = useState([]); const [inventoryLoading, setInventoryLoading] = useState(false); const [supplierLoading, setSupplierLoading] = useState(false); const [summary, setSummary] = useState({ receivedToday: 0, receivedThisMonth: 0, pendingInspection: null }); const [page, setPage] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 }); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [formError, setFormError] = useState(''); const [success, setSuccess] = useState(''); const [form, setForm] = useState(initialForm); const [showForm, setShowForm] = useState(false); const [detail, setDetail] = useState(null);
  const t = { ...(language === 'en' ? en : am), ...labels[language === 'en' ? 'en' : 'am'], inventoryLoading: inventoryLoading ? (language === 'en' ? 'Loading...' : 'በመጫን ላይ') : labels[language === 'en' ? 'en' : 'am'].noInventory, invalidPrice: language === 'en' ? 'Enter a valid non-negative unit price.' : 'ትክክለኛ ዜሮ ወይም ከዜሮ በላይ የሆነ ዋጋ ያስገቡ።', invalidExpiry: language === 'en' ? 'Enter a valid expiry date on or after the received date and provide its batch number.' : 'የማብቂያ ቀን ከተቀበለበት ቀን በኋላ ይሁን እና የባች ቁጥር ያስገቡ።' };
  const load = async (currentPage = 1, refresh = false) => { refresh ? setRefreshing(true) : setLoading(true); setError(''); try { const response = await apiClient.get('/api/store/receive', { params: { page: currentPage, pageSize: 25, search } }); const data = response.data?.data || {}; setRecords(data.items || []); setSummary({ ...(data.summary || {}), receivedToday: data.summary?.receivedToday ?? '—', receivedThisMonth: data.summary?.receivedThisMonth ?? '—', pendingInspection: data.summary?.pendingInspection ?? '—' }); setPage({ page: currentPage, pageSize: 25, ...(data.pagination || {}) }); } catch (requestError) { setError(requestError.response?.status === 403 ? 'forbidden' : 'error'); } finally { setLoading(false); setRefreshing(false); } };
  const loadInventory = async () => { setInventoryLoading(true); try { const response = await apiClient.get('/api/store/inventory', { params: { page: 1, pageSize: 100 } }); setInventory(Array.isArray(response.data?.data) ? response.data.data : []); } finally { setInventoryLoading(false); } };
  const loadSuppliers = async () => { setSupplierLoading(true); try { const response = await apiClient.get('/api/store/receive/suppliers'); setSuppliers(Array.isArray(response.data?.data) ? response.data.data : []); } finally { setSupplierLoading(false); } };
  useEffect(() => { load(1); }, [search]);
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const openForm = async () => { submissionId.current = createSubmissionId(); setForm(initialForm); setFormError(''); setSuccess(''); setShowForm(true); try { await Promise.all([loadInventory(), loadSuppliers()]); } catch { setFormError(t.failed); } };
  const submit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    const quantity = Number(form.quantity);
    const unitPrice = form.unitPrice === '' ? null : Number(form.unitPrice);
    if (!form.reference.trim() || !form.assetId || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000 || !form.location.trim()) { setFormError(t.required); return; }
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) { setFormError(t.invalidPrice); return; }
    if (form.expiryDate && (!form.batchNumber.trim() || form.expiryDate < form.date || Number.isNaN(new Date(`${form.expiryDate}T00:00:00`).getTime()))) { setFormError(t.invalidExpiry); return; }
    submitLock.current = true;
    setSaving(true); setFormError(''); setSuccess('');
    try {
      await apiClient.post('/api/store/receive', {
        asset_id: Number(form.assetId),
        quantity,
        unit_price: unitPrice,
        supplier_id: form.supplier || null,
        reason: 'Stock received',
        to_location: form.location,
        condition: ({ [t.good]: 'Good', [t.fair]: 'Fair', [t.damaged]: 'Damaged' })[form.condition] || form.condition,
        reference: form.reference,
        purchase_order: form.purchaseOrder,
        invoice: form.invoice,
        delivery_note: form.deliveryNote,
        received_date: form.date,
        batch_number: form.batchNumber.trim(),
        expiry_date: form.expiryDate || null,
        submission_id: submissionId.current,
        notes: form.notes,
      });
      submissionId.current = '';
      setShowForm(false); setForm(initialForm); setSuccess(t.success); await load(page.page, true);
    } catch (requestError) { setFormError(requestError.response?.data?.message || t.failed); }
    finally { submitLock.current = false; setSaving(false); }
  };
  const selectedItem = inventory.find((item) => String(item.asset_id || item.id) === String(form.assetId));
  const quantity = Number(form.quantity);
  const unitPrice = Number(form.unitPrice);
  const calculatedTotal = form.unitPrice !== '' && Number.isFinite(unitPrice) && unitPrice >= 0
    && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 1000000
    ? (unitPrice * quantity).toFixed(2)
    : '';
  if (loading) return <div className="receive-page-state"><RefreshCw size={20} /> {t.loading}</div>;
  if (error) return <div className="receive-page-state receive-error"><X size={22} /><p>{t[error]}</p><button type="button" onClick={() => load(page.page)}><RefreshCw size={16} /> {t.retry}</button></div>;
  return (
    <main className="receive-page">
      <header className="receive-page-header">
        <div><p>Store Inventory</p><h1>{t.title}</h1><span>{t.subtitle}</span></div>
        <div>
          <button type="button" onClick={() => load(page.page, true)} disabled={refreshing}><RefreshCw size={17} /> {t.refresh}</button>
          <button className="receive-primary" type="button" onClick={openForm}><PackagePlus size={17} /> {t.receive}</button>
        </div>
      </header>
      {success && <p className="receive-form-success" role="status"><CheckCircle2 size={16} /> {success}</p>}
      <section className="receive-kpis">{[[ClipboardList, summary.receivedToday, t.today], [PackagePlus, summary.receivedThisMonth, t.month], [Eye, summary.pendingInspection, t.inspection], [FilePlus2, page.total, t.receipts]].map(([Icon, value, label]) => <div key={label}><Icon size={18} /><strong>{value}</strong><small>{label}</small></div>)}</section>
      <section className="receive-card receive-toolbar"><Search size={17} /><input aria-label={t.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} /></section>
      <section className="receive-card">
        <div className="receive-heading"><h2>{t.receipts}</h2><span>{page.total}</span></div>
        {records.length ? <div className="receive-table-wrap"><table><thead><tr><th>{t.receipt}</th><th>{t.date}</th><th>{t.asset}</th><th>{t.supplier}</th><th>{t.quantity}</th><th>{t.location}</th><th>{t.status}</th><th>{t.receivedBy}</th><th>{t.actions}</th></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td>{item.receiptNumber}</td><td>{new Date(item.date).toLocaleDateString()}</td><td><strong>{item.asset}</strong><small>{item.assetCode || '-'}</small></td><td>{item.supplier || '-'}</td><td>{item.quantity}</td><td>{item.location || '-'}</td><td><span className="received-badge"><CheckCircle2 size={14} /> {item.status}</span></td><td>{item.receivedBy}</td><td><button className="view-receipt" type="button" onClick={() => setDetail(item)}><Eye size={15} /> {t.view}</button></td></tr>)}</tbody></table></div> : <div className="receive-empty"><FilePlus2 size={32} /><h3>{t.empty}</h3><p>{t.emptyText}</p><button className="receive-primary" type="button" onClick={openForm}><PackagePlus size={16} /> {t.receive}</button></div>}
        <footer className="receive-pagination"><button type="button" disabled={page.page <= 1} onClick={() => load(page.page - 1)}><ChevronLeft size={16} /> {t.previous}</button><span>{page.page} / {page.totalPages || 1}</span><button type="button" disabled={page.page >= page.totalPages} onClick={() => load(page.page + 1)}>{t.next} <ChevronRight size={16} /></button></footer>
      </section>
      {showForm && <div className="receive-overlay">
        <section className="receive-modal" role="dialog" aria-modal="true" aria-labelledby="receive-form-title">
          <div className="receive-modal-heading"><h2 id="receive-form-title">{t.receive}</h2><button type="button" aria-label={t.close} onClick={() => setShowForm(false)}><X size={19} /></button></div>
          {formError && <p className="receive-form-error" role="alert"><X size={16} /> {formError}</p>}
          <form onSubmit={submit}>
            <label>{t.asset}
              <select required value={form.assetId} onChange={(event) => update('assetId', event.target.value)} disabled={inventoryLoading || inventory.length === 0}>
                <option value="">{inventoryLoading ? t.inventoryLoading : inventory.length ? t.select : t.noInventory}</option>
                {inventory.map((item) => <option key={item.asset_id || item.id} value={item.asset_id || item.id}>{item.asset_tag || item.asset_id || item.id} - {item.name}</option>)}
              </select>
            </label>
            {selectedItem && (
              <div className="receive-selected-item" aria-live="polite">
                <span><strong>{t.assetCode}:</strong> {selectedItem.asset_tag || selectedItem.assetCode || '-'}</span>
                <span><strong>{t.category}:</strong> {selectedItem.category || '-'}</span>
                <span><strong>{t.unit}:</strong> {selectedItem.unit || 'unit'}</span>
              </div>
            )}
            <div className="receive-form-grid">
              <label>{t.quantity}<input required min="1" max="1000000" step="1" type="number" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
              <label>{t.unitPrice}<input min="0" step="0.01" type="number" value={form.unitPrice} onChange={(event) => update('unitPrice', event.target.value)} /></label>
              <label>{t.totalCost}<input aria-label={t.totalCost} readOnly value={calculatedTotal} /></label>
              <label>{t.supplier}
                <select value={form.supplier} onChange={(event) => update('supplier', event.target.value)} disabled={supplierLoading}>
                  <option value="">{supplierLoading ? t.inventoryLoading : t.select}</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}
                </select>
              </label>
            </div>
            <div className="receive-form-grid">
              <label>{t.reference}<input value={form.reference} onChange={(event) => update('reference', event.target.value)} required /></label>
              <label>{t.location}<input value={form.location} onChange={(event) => update('location', event.target.value)} required /></label>
              <label>{t.date}<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></label>
              <label>{t.condition}<select value={form.condition} onChange={(event) => update('condition', event.target.value)}><option>{t.good}</option><option>{t.fair}</option><option>{t.damaged}</option></select></label>
            </div>
            <div className="receive-form-grid">
              <label>{t.batchNumber}<input maxLength="100" value={form.batchNumber} onChange={(event) => update('batchNumber', event.target.value)} required={Boolean(form.expiryDate)} /></label>
              <label>{t.expiryDate}<input type="date" min={form.date || undefined} value={form.expiryDate} onChange={(event) => update('expiryDate', event.target.value)} /></label>
            </div>
            <div className="receive-form-grid">
              <label>{t.purchaseOrder}<input value={form.purchaseOrder} onChange={(event) => update('purchaseOrder', event.target.value)} /></label>
              <label>{t.invoice}<input value={form.invoice} onChange={(event) => update('invoice', event.target.value)} /></label>
              <label>{t.deliveryNote}<input value={form.deliveryNote} onChange={(event) => update('deliveryNote', event.target.value)} /></label>
            </div>
            <label>{t.notes}<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
            <div className="receive-modal-actions">
              <button type="button" onClick={() => setShowForm(false)}>{t.close}</button>
              <button className="receive-primary" type="submit" disabled={saving || inventoryLoading || supplierLoading}>
                {saving ? <><LoaderCircle className="spin" size={16} /> {t.saving}</> : <><CheckCircle2 size={16} /> {t.submit}</>}
              </button>
            </div>
          </form>
        </section>
      </div>}
      {detail && <div className="receive-overlay"><section className="receive-modal receive-detail" role="dialog" aria-modal="true"><div className="receive-modal-heading"><h2>{detail.receiptNumber}</h2><button type="button" aria-label={t.close} onClick={() => setDetail(null)}><X size={19} /></button></div><dl>{[[t.date, new Date(detail.date).toLocaleString()], [t.asset, detail.asset], [t.assetCode, detail.assetCode || '-'], [t.category, detail.category || '-'], [t.unit, detail.unit || 'unit'], [t.supplier, detail.supplier || '-'], [t.purchaseOrder, detail.purchaseOrder || '-'], [t.invoice, detail.invoice || '-'], [t.deliveryNote, detail.deliveryNote || '-'], [t.quantity, detail.quantity], [t.unitPrice, detail.unitPrice ?? '-'], [t.totalCost, detail.totalCost ?? '-'], [t.batchNumber, detail.batchNumber || '-'], [t.expiryDate, detail.expiryDate || '-'], [t.location, detail.location], [t.receivedBy, detail.receivedBy], [t.notes, detail.notes || '-']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>}
    </main>
  );
}
