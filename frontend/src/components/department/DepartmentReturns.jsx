import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, resolveAssetUrl } from '../../utils/api';
import './DepartmentReturns.css';

const CONDITIONS = ['Good', 'Fair', 'Damaged', 'Heavily damaged', 'Missing parts', 'Non-functional'];
const REASONS = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];

const today = () => {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const INITIAL_FORM = { assetId: '', returnDate: today(), condition: 'Good', reason: 'End of Assignment', notes: '', evidence: null };

const getAssignments = (payload) => {
  const rows = payload?.assignments || payload?.data || [];
  return Array.isArray(rows) ? rows : [];
};

const returnDateLabel = (record) => record.returnDate || record.return_date || record.receivedAt || record.requestedAt || record.createdAt || null;
const formatReturnDate = (value) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export default function DepartmentReturns() {
  const [records, setRecords] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [returnsResponse, assignmentsResponse] = await Promise.all([
        apiClient.get('/api/department-head/returns', { params: { page: 1, pageSize: 100 } }),
        apiClient.get('/api/assignments', { params: { status: 'active', limit: 100 } }),
      ]);
      setRecords(Array.isArray(returnsResponse.data?.data) ? returnsResponse.data.data : []);
      setAssignments(getAssignments(assignmentsResponse.data).filter((assignment) => String(assignment.status).toLowerCase() === 'active' && Number(assignment.assigned_to)));
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load department asset returns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => String(assignment.asset_id || assignment.assetId) === String(form.assetId)) || null,
    [assignments, form.assetId],
  );

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      let evidenceUrl = '';
      if (form.evidence) {
        const upload = new FormData();
        upload.append('file', form.evidence);
        evidenceUrl = (await apiClient.post('/api/uploads', upload, { headers: { 'Content-Type': 'multipart/form-data' } })).data?.file?.url || '';
        if (!evidenceUrl) throw new Error('Evidence upload did not return a file URL.');
      }
      await apiClient.post('/api/department-head/returns', {
        asset_id: Number(form.assetId),
        return_date: form.returnDate,
        condition: form.condition,
        reason: form.reason,
        notes: form.notes,
        evidence_url: evidenceUrl,
      });
      setForm({ ...INITIAL_FORM, returnDate: today() });
      setShowForm(false);
      await load();
    } catch (submitError) {
      setFormError(submitError.response?.data?.message || submitError.message || 'Unable to record this return.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="department-returns-page" aria-live="polite">Loading department return history...</main>;

  return (
    <main className="department-returns-page">
      <header className="department-returns-header">
        <div>
          <p>Department Operations</p>
          <h1>Asset Returns</h1>
          <span>Record returns for assets assigned to your department.</span>
        </div>
        <div className="department-returns-actions">
          <button type="button" onClick={load}>Refresh</button>
          <button type="button" className="department-returns-primary" onClick={() => { setForm({ ...INITIAL_FORM, returnDate: today() }); setFormError(''); setShowForm(true); }}>Record Return</button>
        </div>
      </header>

      {error && <p className="department-returns-error" role="alert">{error}</p>}

      <section className="department-returns-card">
        <h2>Return History</h2>
        {records.length === 0 ? <p>No return records found.</p> : (
          <div className="department-returns-table-wrap">
            <table>
              <thead>
                <tr><th>Asset</th><th>Person returning</th><th>Date</th><th>Condition</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.asset_name || record.Asset?.name || record.asset_id || '—'}</td>
                    <td>{record.returning_person_name || record.returningPerson?.fullName || record.sourceUserId || '—'}</td>
                    <td>{formatReturnDate(returnDateLabel(record))}</td>
                    <td>{record.condition || '—'}</td>
                    <td>{record.status || '—'}</td>
                    <td><button type="button" onClick={() => setDetail(record)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="department-returns-overlay">
          <section className="department-returns-modal" role="dialog" aria-modal="true" aria-labelledby="department-return-title">
            <h2 id="department-return-title">Record Return</h2>
            {formError && <p className="department-returns-error" role="alert">{formError}</p>}
            <form onSubmit={submit}>
              <label>
                Asset
                <select required value={form.assetId} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))}>
                  <option value="">Select an assigned asset</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.asset_id || assignment.assetId}>
                      {assignment.asset_name || assignment.asset_tag || assignment.asset_id} ({assignment.asset_tag || assignment.asset_id})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Person returning
                <input readOnly value={selectedAssignment?.assigned_to_name || ''} placeholder="Select an asset to show its assigned person" />
              </label>
              <div className="department-returns-grid">
                <label>
                  Return date
                  <input required type="date" value={form.returnDate} onChange={(event) => setForm((current) => ({ ...current, returnDate: event.target.value }))} />
                </label>
                <label>
                  Condition
                  <select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))}>
                    {CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Return reason
                <select value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}>
                  {REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </label>
              <label>
                Notes
                <textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <label>
                Evidence (optional)
                <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => setForm((current) => ({ ...current, evidence: event.target.files?.[0] || null }))} />
              </label>
              <div className="department-returns-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="department-returns-primary" type="submit" disabled={saving || !selectedAssignment}>{saving ? 'Saving...' : 'Save Return'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detail && (
        <div className="department-returns-overlay">
          <section className="department-returns-modal" role="dialog" aria-modal="true" aria-labelledby="department-return-detail-title">
            <h2 id="department-return-detail-title">Return Details</h2>
            <dl>
              <div><dt>Asset</dt><dd>{detail.asset_name || detail.Asset?.name || detail.asset_id || '—'}</dd></div>
              <div><dt>Person returning</dt><dd>{detail.returning_person_name || detail.returningPerson?.fullName || detail.sourceUserId || '—'}</dd></div>
              <div><dt>Date</dt><dd>{formatReturnDate(returnDateLabel(detail))}</dd></div>
              <div><dt>Condition</dt><dd>{detail.condition || '—'}</dd></div>
              <div><dt>Reason</dt><dd>{detail.reason || '—'}</dd></div>
              <div><dt>Status</dt><dd>{detail.status || '—'}</dd></div>
              <div><dt>Notes</dt><dd>{detail.notes || '—'}</dd></div>
              {detail.evidence_url || detail.evidenceUrl ? <div><dt>Evidence</dt><dd><a href={resolveAssetUrl(detail.evidence_url || detail.evidenceUrl)} target="_blank" rel="noreferrer">Open evidence</a></dd></div> : null}
            </dl>
            <button type="button" onClick={() => setDetail(null)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}
