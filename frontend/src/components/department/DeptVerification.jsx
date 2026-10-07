import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import './DeptVerification.css';

const conditionOptions = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Unknown'];
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const DeptVerification = () => {
  const { language } = useLanguage();
  const isAmharic = language === 'am';
  const copy = useCallback((english, amharic) => isAmharic ? amharic : english, [isAmharic]);
  const [assets, setAssets] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({
    assetId: '',
    qrCode: '',
    actualLocation: '',
    actualCondition: '',
    verificationDate: localDate(),
    exceptions: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedAsset = useMemo(
    () => assets.find((asset) => String(asset.id) === form.assetId),
    [assets, form.assetId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assetResponse, historyResponse] = await Promise.all([
        apiClient.get('/department/assets', { params: { page: 1, limit: 100 } }),
        apiClient.get('/department/verification/history', { params: { page: 1, limit: 100 } }),
      ]);
      setAssets(Array.isArray(assetResponse.data?.data) ? assetResponse.data.data : []);
      setHistory(Array.isArray(historyResponse.data?.data) ? historyResponse.data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to load verification data.', 'የማረጋገጫ መረጃ መጫን አልተቻለም።'));
    } finally {
      setLoading(false);
    }
  }, [copy]);

  useEffect(() => { load(); }, [load]);

  const updateAsset = (event) => {
    const assetId = event.target.value;
    const asset = assets.find((candidate) => String(candidate.id) === assetId);
    setForm((current) => ({
      ...current,
      assetId,
      qrCode: '',
      actualLocation: current.actualLocation || asset?.location || '',
      actualCondition: current.actualCondition || asset?.condition || '',
    }));
  };

  const recordVerification = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        actual_location: form.actualLocation.trim(),
        actual_condition: form.actualCondition,
        verification_date: form.verificationDate,
        exceptions: form.exceptions.trim(),
      };
      if (form.qrCode.trim()) payload.qr_code = form.qrCode.trim();
      else payload.asset_id = Number(form.assetId);
      await apiClient.post('/department/verification/records', payload);
      setSuccess(copy('Verification recorded. A history entry was saved.', 'ማረጋገጫው ተመዝግቧል።'));
      setForm((current) => ({
        ...current,
        assetId: '',
        qrCode: '',
        actualLocation: '',
        actualCondition: '',
        verificationDate: localDate(),
        exceptions: '',
      }));
      const response = await apiClient.get('/department/verification/history', { params: { page: 1, limit: 100 } });
      setHistory(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || copy('Unable to record physical verification.', 'የአካል ማረጋገጫውን መመዝገብ አልተቻለም።'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="department-verification-page">
    <header className="department-verification-header">
      <div>
        <p className="department-verification-kicker"><ShieldCheck size={15} aria-hidden="true" /> {copy('Department operations', 'የክፍል ስራዎች')}</p>
        <h1>{copy('Physical Asset Verification', 'የንብረት አካላዊ ማረጋገጫ')}</h1>
        <p className="department-verification-subtitle">{copy('Verify the asset in person. Each check is permanently recorded for your department.', 'ንብረቱን በአካል ያረጋግጡ። እያንዳንዱ ማረጋገጫ ለክፍልዎ ይመዘገባል።')}</p>
      </div>
      <button className="department-verification-button department-verification-button--secondary" type="button" onClick={load} disabled={loading}>
        <RefreshCw size={16} /> {copy('Refresh', 'አድስ')}
      </button>
    </header>

    {error && <div className="department-verification-alert department-verification-alert--error" role="alert">{error}</div>}
    {success && <div className="department-verification-alert department-verification-alert--success" role="status">{success}</div>}

    <form className="department-verification-form" onSubmit={recordVerification}>
      <div className="department-verification-form-heading">
        <div>
          <h2>{copy('Record a physical check', 'የአካላዊ ማረጋገጫ ይመዝግቡ')}</h2>
          <p>{copy('Identify the department asset and record what you observe.', 'የክፍሉን ንብረት ይለዩና ያዩትን ይመዝግቡ።')}</p>
        </div>
      </div>
      <label>
        {copy('Identify asset', 'ንብረቱን ይለዩ')}
        <select value={form.assetId} onChange={updateAsset} disabled={loading || Boolean(form.qrCode)} required={!form.qrCode}>
          <option value="">{copy('Select a department asset', 'የክፍል ንብረት ይምረጡ')}</option>
          {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode || `#${asset.id}`} · {asset.name}</option>)}
        </select>
      </label>
      <label>
        {copy('Scan or enter QR code', 'QR ኮድ ይቃኙ ወይም ያስገቡ')}
        <input
          value={form.qrCode}
          onChange={(event) => setForm((current) => ({ ...current, qrCode: event.target.value, assetId: '' }))}
          placeholder="QR-..."
          autoComplete="off"
          disabled={loading}
          required={!form.assetId}
        />
      </label>

      {selectedAsset && <div className="department-verification-asset-summary">
        <strong>{selectedAsset.assetCode || `#${selectedAsset.id}`} · {selectedAsset.name}</strong>
        <span>{copy('Expected location', 'የሚጠበቀው ቦታ')}: {selectedAsset.location || copy('Not specified', 'አልተገለጸም')}</span>
      </div>}

      <label>
        {copy('Actual location', 'ትክክለኛ ቦታ')}
        <input value={form.actualLocation} onChange={(event) => setForm((current) => ({ ...current, actualLocation: event.target.value }))} required maxLength={255} />
      </label>
      <label>
        {copy('Observed condition', 'የታየው ሁኔታ')}
        <select value={form.actualCondition} onChange={(event) => setForm((current) => ({ ...current, actualCondition: event.target.value }))} required>
          <option value="">{copy('Select condition', 'ሁኔታ ይምረጡ')}</option>
          {conditionOptions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
        </select>
      </label>
      <label>
        {copy('Verification date', 'የማረጋገጫ ቀን')}
        <input type="date" value={form.verificationDate} onChange={(event) => setForm((current) => ({ ...current, verificationDate: event.target.value }))} required />
      </label>
      <label className="department-verification-form-wide">
        {copy('Exceptions or notes', 'ልዩነቶች ወይም ማስታወሻ')}
        <textarea value={form.exceptions} onChange={(event) => setForm((current) => ({ ...current, exceptions: event.target.value }))} maxLength={2000} rows={3} />
      </label>
      <div className="department-verification-form-actions">
        <small>{copy('Verified by is taken from your signed-in account.', 'ያረጋገጠው ሰው ከገቡበት መለያ ይወሰዳል።')}</small>
        <button className="department-verification-button department-verification-button--primary" type="submit" disabled={busy || loading || (!form.assetId && !form.qrCode.trim())}>
          {busy ? <LoaderCircle size={16} /> : <ClipboardCheck size={16} />} {copy('Record verification', 'ማረጋገጫ መዝግብ')}
        </button>
      </div>
    </form>

    <section className="department-verification-history" aria-labelledby="verification-history-heading">
      <div className="department-verification-history-heading">
        <h2 id="verification-history-heading">{copy('Verification history', 'የማረጋገጫ ታሪክ')}</h2>
        {!loading && history.length > 0 && <span>{history.length} {copy('records', 'መዝገቦች')}</span>}
      </div>
      {loading ? <div className="department-verification-state" aria-busy="true"><LoaderCircle className="department-verification-spinner" /> {copy('Loading history...', 'ታሪክ በመጫን ላይ...')}</div> : history.length === 0 ? (
        <div className="department-verification-state department-verification-empty">
          <ClipboardCheck size={24} aria-hidden="true" />
          <p>{copy('No physical verifications have been recorded for this department.', 'ለዚህ ክፍል የአካል ማረጋገጫ አልተመዘገበም።')}</p>
        </div>
      ) : <div className="department-verification-table-wrap">
        <table className="department-verification-table">
          <thead><tr>{[
            copy('Asset', 'ንብረት'),
            copy('Expected location', 'የሚጠበቀው ቦታ'),
            copy('Actual location', 'ትክክለኛ ቦታ'),
            copy('Condition', 'ሁኔታ'),
            copy('Date', 'ቀን'),
            copy('Verified by', 'ያረጋገጠው'),
            copy('Exceptions', 'ልዩነቶች'),
          ].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
          <tbody>{history.map((entry) => <tr key={entry.id}>
            <td>{entry.assetCode || `#${entry.assetId}`} · {entry.assetName || entry.Asset?.name || ''}{entry.scannedQrCode && <small>QR: {entry.scannedQrCode}</small>}</td>
            <td>{entry.expectedLocation || '—'}</td>
            <td>{entry.actualLocation}</td>
            <td>{entry.actualCondition}{entry.actualCondition?.toLowerCase() !== entry.expectedCondition?.toLowerCase() && <small>{copy('Expected', 'የሚጠበቀው')}: {entry.expectedCondition}</small>}</td>
            <td>{entry.verificationDate}</td>
            <td>{entry.Verifier?.fullName || entry.Verifier?.username || entry.verifiedBy}</td>
            <td className="department-verification-exceptions">{entry.exceptions || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </section>;
};

export default DeptVerification;
