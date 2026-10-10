import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, History, Plus, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/UiContext';
import { apiClient, getApiErrorMessage } from '../../utils/api';
import './DeptAssignments.css';

const localDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyForm = () => ({
  assetId: '',
  recipientId: '',
  location: '',
  assignedDate: localDateInputValue(),
  expectedReturnDate: '',
});

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
const displayDate = (value, notSpecified) => {
  if (!value) return notSpecified;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? notSpecified : date.toLocaleDateString();
};

const DeptAssignments = () => {
  const { hasPermission } = useAuth();
  const { language, t: translate } = useTranslation();
  const t = (key, english, amharic) => translate(
    `department.assignments.${key}`,
    language === 'am' ? amharic : english,
  );
  const translateRef = useRef(t);
  translateRef.current = t;
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
  const [form, setForm] = useState(createEmptyForm);
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
      setError(getApiErrorMessage(loadError, translateRef.current('loadError', 'Unable to load department assignments.', 'የክፍሉን የንብረት ምደባዎች መጫን አልተቻለም።')));
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
      setFormError(t('validDateError', 'Enter a valid assignment date.', 'ትክክለኛ የምደባ ቀን ያስገቡ።'));
      return;
    }
    if (assignedOn > new Date()) {
      setFormError(t('futureDateError', 'Assignment date cannot be in the future.', 'ምደባው የወደፊት ቀን ሊሆን አይችልም።'));
      return;
    }
    if (expectedOn && (Number.isNaN(expectedOn.getTime()) || expectedOn < assignedOn)) {
      setFormError(t('returnDateError', 'Expected return must be on or after the assignment date.', 'የሚጠበቀው የመመለሻ ቀን ከምደባው ቀን ጋር እኩል ወይም ከዚያ በኋላ መሆን አለበት።'));
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
      setForm(createEmptyForm());
      setSuccess(t('createSuccess', 'Asset assignment created and added to assignment history.', 'የንብረት ምደባው ተፈጥሯል እና ወደ ምደባ ታሪክ ታክሏል።'));
      await loadData();
    } catch (saveError) {
      setFormError(getApiErrorMessage(saveError, t('createError', 'Unable to create this assignment.', 'ይህን ምደባ መፍጠር አልተቻለም።')));
    } finally {
      setSaving(false);
    }
  };

  const openForm = () => {
    setForm(createEmptyForm());
    setFormError('');
    setSuccess('');
    setShowForm(true);
  };

  return (
    <main className="dept-assignments">
      <header className="dept-assignments__heading">
        <div>
          <span className="dept-assignments__eyebrow"><ClipboardList size={16} /> {t('workspace', 'Department workspace', 'የክፍል የሥራ ቦታ')}</span>
          <h1>{t('title', 'Asset Assignments', 'የንብረት ምደባዎች')}</h1>
          <p>{t('subtitle', 'Assign department assets to authorized staff and review assignment history.', 'የክፍሉን ንብረቶች ለተፈቀደላቸው ሠራተኞች ይመድቡ እና የምደባ ታሪክን ይመልከቱ።')}</p>
        </div>
        <div className="dept-assignments__actions">
          <button type="button" className="dept-assignments__button dept-assignments__button--secondary" onClick={() => loadData()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'dept-assignments__spin' : ''} /> {refreshing ? t('refreshing', 'Refreshing...', 'በማደስ ላይ...') : t('refresh', 'Refresh', 'አድስ')}
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
              <span className="dept-assignments__eyebrow">{t('controlledAction', 'Controlled action', 'ቁጥጥር ያለው እርምጃ')}</span>
              <h2 id="assignment-form-title">{t('createTitle', 'Create assignment', 'ምደባ ፍጠር')}</h2>
            </div>
            <button type="button" className="dept-assignments__icon-button" aria-label={t('closeForm', 'Close assignment form', 'የምደባ ቅጹን ዝጋ')} onClick={() => setShowForm(false)} disabled={saving}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={createAssignment} className="dept-assignments__form">
            <label>
              {t('asset', 'Asset', 'ንብረት')}
              <select name="assetId" value={form.assetId} onChange={updateForm} required>
                <option value="">{t('selectAsset', 'Select an available department asset', 'ያለውን የክፍል ንብረት ይምረጡ')}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.assetCode || asset.asset_code} - {asset.name}</option>
                ))}
              </select>
              {assets.length === 0 && <small>{t('noAvailableAssets', 'No available assets are currently assignable.', 'በአሁኑ ጊዜ ሊመደቡ የሚችሉ ንብረቶች የሉም።')}</small>}
            </label>
            <label>
              {t('recipient', 'Recipient', 'ተቀባይ')}
              <select name="recipientId" value={form.recipientId} onChange={updateForm} required>
                <option value="">{t('selectStaff', 'Select active department staff', 'ንቁ የክፍሉን ሠራተኛ ይምረጡ')}</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.fullName || person.username}</option>
                ))}
              </select>
              {staff.length === 0 && <small>{t('noActiveStaff', 'No active staff members are available.', 'ንቁ ሠራተኞች የሉም።')}</small>}
            </label>
            <label>
              {t('location', 'Location', 'ቦታ')}
              <input name="location" value={form.location} onChange={updateForm} list="department-assignment-locations" maxLength={255} required />
              <datalist id="department-assignment-locations">
                {locations.map((location) => <option key={`${location.recordType || location.type}-${location.id}`} value={location.name} />)}
              </datalist>
            </label>
            <label>
              {t('assignmentDate', 'Assignment date', 'የምደባ ቀን')}
              <input type="date" name="assignedDate" value={form.assignedDate} onChange={updateForm} max={localDateInputValue()} required />
            </label>
            <label>
              {t('expectedReturn', 'Expected return', 'የሚጠበቀው መመለሻ')}
              <input type="date" name="expectedReturnDate" value={form.expectedReturnDate} onChange={updateForm} min={form.assignedDate} />
            </label>
            {formError && <div className="dept-assignments__alert dept-assignments__form-error" role="alert">{formError}</div>}
            <div className="dept-assignments__form-actions">
              <button type="button" className="dept-assignments__button dept-assignments__button--secondary" onClick={() => setShowForm(false)} disabled={saving}>{t('cancel', 'Cancel', 'ሰርዝ')}</button>
              <button type="submit" className="dept-assignments__button" disabled={saving || assets.length === 0 || staff.length === 0}>
                {saving ? t('saving', 'Saving...', 'በማስቀመጥ ላይ...') : t('createTitle', 'Create assignment', 'ምደባ ፍጠር')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="dept-assignments__card" aria-label={t('sectionLabel', 'Department assignments', 'የክፍል ምደባዎች')}>
        <div className="dept-assignments__tabs" role="tablist" aria-label={t('viewsLabel', 'Assignment views', 'የምደባ እይታዎች')}>
          <button type="button" role="tab" aria-selected={activeTab === 'current'} className={activeTab === 'current' ? 'is-active' : ''} onClick={() => setActiveTab('current')}>
            {t('activeTab', 'Active assignments', 'ንቁ ምደባዎች')} <span>{activeAssignments.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}>
            <History size={15} /> {t('historyTab', 'Assignment history', 'የምደባ ታሪክ')} <span>{history.length}</span>
          </button>
        </div>
        {loading ? (
          <div className="dept-assignments__empty" role="status">{t('loading', 'Loading assignments...', 'ምደባዎችን በመጫን ላይ...')}</div>
        ) : rows.length === 0 ? (
          <div className="dept-assignments__empty">
            {activeTab === 'history'
              ? t('noHistory', 'No assignment history is available yet.', 'እስካሁን የምደባ ታሪክ የለም።')
              : t('noActiveAssignments', 'There are no active assignments for this department.', 'ለዚህ ክፍል ንቁ ምደባዎች የሉም።')}
          </div>
        ) : (
          <div className="dept-assignments__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('asset', 'Asset', 'ንብረት')}</th>
                  <th>{t('recipient', 'Recipient', 'ተቀባይ')}</th>
                  <th>{t('location', 'Location', 'ቦታ')}</th>
                  <th>{t('assigned', 'Assigned', 'የተመደበበት ቀን')}</th>
                  <th>{t('expectedReturn', 'Expected return', 'የሚጠበቀው መመለሻ')}</th>
                  <th>{t('status', 'Status', 'ሁኔታ')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><strong>{assignment.asset_name || assignment.assetName || `${t('asset', 'Asset', 'ንብረት')} #${assignment.asset_id || assignment.assetId}`}</strong><small>{assignment.asset_tag || assignment.assetCode || ''}</small></td>
                    <td>{assignment.assigned_to_name || assignment.assignedToName || t('notRecorded', 'Not recorded', 'አልተመዘገበም')}</td>
                    <td>{assignment.location || t('notRecorded', 'Not recorded', 'አልተመዘገበም')}</td>
                    <td>{displayDate(assignmentDate(assignment), t('notSpecified', 'Not specified', 'አልተገለጸም'))}</td>
                    <td>{displayDate(expectedDate(assignment), t('notSpecified', 'Not specified', 'አልተገለጸም'))}</td>
                    <td><span className={`dept-assignments__status dept-assignments__status--${String(assignment.status || 'active').toLowerCase()}`}>{assignment.status || t('activeStatus', 'Active', 'ንቁ')}</span></td>
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
