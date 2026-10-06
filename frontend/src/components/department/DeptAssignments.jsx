import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, History, Plus, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, getApiErrorMessage } from '../../utils/api';
import './DeptAssignments.css';

const EMPTY_FORM = {
  assetId: '',
  recipientId: '',
  location: '',
  assignedDate: new Date().toISOString().slice(0, 10),
  expectedReturnDate: '',
};

const fetchAllPages = async (path, params = {}) => {
  const records = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await apiClient.get(path, { params: { ...params, page, limit: 100 } });
    const payload = response.data || {};
    records.push(...(Array.isArray(payload.data) ? payload.data : []));
    pages = Math.max(1, Number(payload.pagination?.pages) || 1);
    page += 1;
  } while (page <= pages);
  return records;
};

const assignmentDate = (record) => record.assigned_date || record.assignedDate || record.createdAt;
const expectedDate = (record) => record.expected_return_date || record.expectedReturnDate;
const displayDate = (value) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not specified' : date.toLocaleDateString();
};

const DeptAssignments = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('assets.assign');
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [assets, setAssets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const [assignmentRows, historyResponse, assetRows, staffRows, locationRows] = await Promise.all([
        fetchAllPages('/department-head/assignments'),
        apiClient.get('/department-head/assignments/history'),
        fetchAllPages('/department-head/assets', { status: 'available' }),
        fetchAllPages('/department-head/staff', { status: 'active' }),
        fetchAllPages('/department-head/locations'),
      ]);
      setAssignments(assignmentRows);
      setHistory(Array.isArray(historyResponse.data?.history) ? historyResponse.data.history : []);
      setAssets(assetRows.filter((asset) => String(asset.status || '').toLowerCase() === 'available'));
      setStaff(staffRows.filter((person) => person.active !== false && String(person.status || 'active').toLowerCase() === 'active'));
      setLocations(locationRows.filter((location) => String(location.status || 'active').toLowerCase() === 'active'));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load department assignments.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => String(assignment.status || '').toLowerCase() === 'active'),
    [assignments],
  );
  const rows = activeTab === 'history' ? history : activeAssignments;

  const updateForm = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFormError('');
    setSuccess('');
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccess('');
    const assignedOn = new Date(`${form.assignedDate}T00:00:00`);
    const expectedOn = form.expectedReturnDate ? new Date(`${form.expectedReturnDate}T00:00:00`) : null;
    if (Number.isNaN(assignedOn.getTime())) {
      setFormError('Enter a valid assignment date.');
      return;
    }
    if (assignedOn > new Date()) {
      setFormError('Assignment date cannot be in the future.');
      return;
    }
    if (expectedOn && (Number.isNaN(expectedOn.getTime()) || expectedOn < assignedOn)) {
      setFormError('Expected return must be on or after the assignment date.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/department-head/assignments', {
        asset_id: Number(form.assetId),
        assigned_to_type: 'user',
        assigned_to_id: Number(form.recipientId),
        location: form.location.trim(),
        assigned_date: form.assignedDate,
        expected_return_date: form.expectedReturnDate || null,
      });
      setShowForm(false);
      setForm({ ...EMPTY_FORM, assignedDate: new Date().toISOString().slice(0, 10) });
      setSuccess('Asset assignment created and added to assignment history.');
      await loadData();
    } catch (saveError) {
      setFormError(getApiErrorMessage(saveError, 'Unable to create this assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const openForm = () => {
    setForm({ ...EMPTY_FORM, assignedDate: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setSuccess('');
    setShowForm(true);
  };

  return (
    <main className="dept-assignments">
      <header className="dept-assignments__heading">
        <div>
          <span className="dept-assignments__eyebrow"><ClipboardList size={16} /> Department workspace</span>
          <h1>Asset Assignments</h1>
          <p>Assign department assets to authorized staff and review assignment history.</p>
        </div>
        <div className="dept-assignments__actions">
          <button type="button" className="dept-assignments__button dept-assignments__button--secondary" onClick={() => loadData()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'dept-assignments__spin' : ''} /> Refresh
          </button>
          {canCreate && (
            <button type="button" className="dept-assignments__button" onClick={openForm}>
              <Plus size={17} /> New assignment
            </button>
          )}
        </div>
      </header>

      {error && <div className="dept-assignments__alert" role="alert">{error}</div>}
      {success && <div className="dept-assignments__success" role="status">{success}</div>}

      {showForm && canCreate && (
        <section className="dept-assignments__form-card" aria-labelledby="assignment-form-title">
          <div className="dept-assignments__form-heading">
            <div>
              <span className="dept-assignments__eyebrow">Controlled action</span>
              <h2 id="assignment-form-title">Create assignment</h2>
            </div>
            <button type="button" className="dept-assignments__icon-button" aria-label="Close assignment form" onClick={() => setShowForm(false)} disabled={saving}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={createAssignment} className="dept-assignments__form">
            <label>
              Asset
              <select name="assetId" value={form.assetId} onChange={updateForm} required>
                <option value="">Select an available department asset</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.assetCode || asset.asset_code} - {asset.name}</option>
                ))}
              </select>
              {assets.length === 0 && <small>No available assets are currently assignable.</small>}
            </label>
            <label>
              Recipient
              <select name="recipientId" value={form.recipientId} onChange={updateForm} required>
                <option value="">Select active department staff</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.fullName || person.username}</option>
                ))}
              </select>
              {staff.length === 0 && <small>No active staff members are available.</small>}
            </label>
            <label>
              Location
              <input name="location" value={form.location} onChange={updateForm} list="department-assignment-locations" maxLength={255} required />
              <datalist id="department-assignment-locations">
                {locations.map((location) => <option key={`${location.recordType || location.type}-${location.id}`} value={location.name} />)}
              </datalist>
            </label>
            <label>
              Assignment date
              <input type="date" name="assignedDate" value={form.assignedDate} onChange={updateForm} max={new Date().toISOString().slice(0, 10)} required />
            </label>
            <label>
              Expected return
              <input type="date" name="expectedReturnDate" value={form.expectedReturnDate} onChange={updateForm} min={form.assignedDate} />
            </label>
            {formError && <div className="dept-assignments__alert dept-assignments__form-error" role="alert">{formError}</div>}
            <div className="dept-assignments__form-actions">
              <button type="button" className="dept-assignments__button dept-assignments__button--secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="dept-assignments__button" disabled={saving || assets.length === 0 || staff.length === 0}>
                {saving ? 'Saving...' : 'Create assignment'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="dept-assignments__card" aria-label="Department assignments">
        <div className="dept-assignments__tabs" role="tablist" aria-label="Assignment views">
          <button type="button" role="tab" aria-selected={activeTab === 'current'} className={activeTab === 'current' ? 'is-active' : ''} onClick={() => setActiveTab('current')}>
            Active assignments <span>{activeAssignments.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}>
            <History size={15} /> Assignment history <span>{history.length}</span>
          </button>
        </div>
        {loading ? (
          <div className="dept-assignments__empty" role="status">Loading assignments...</div>
        ) : rows.length === 0 ? (
          <div className="dept-assignments__empty">
            {activeTab === 'history' ? 'No assignment history is available yet.' : 'There are no active assignments for this department.'}
          </div>
        ) : (
          <div className="dept-assignments__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Recipient</th>
                  <th>Location</th>
                  <th>Assigned</th>
                  <th>Expected return</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><strong>{assignment.asset_name || assignment.assetName || `Asset #${assignment.asset_id || assignment.assetId}`}</strong><small>{assignment.asset_tag || assignment.assetCode || ''}</small></td>
                    <td>{assignment.assigned_to_name || assignment.assignedToName || 'Not recorded'}</td>
                    <td>{assignment.location || 'Not recorded'}</td>
                    <td>{displayDate(assignmentDate(assignment))}</td>
                    <td>{displayDate(expectedDate(assignment))}</td>
                    <td><span className={`dept-assignments__status dept-assignments__status--${String(assignment.status || 'active').toLowerCase()}`}>{assignment.status || 'Active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default DeptAssignments;
