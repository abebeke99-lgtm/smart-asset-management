import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import './CollegeSelfRegistration.css';

const STATUS_ID_KEY = 'college-registration-status-id';
const STATUS_TOKEN_KEY = 'college-registration-status-token';

const initialForm = {
  collegeName: '',
  collegeCode: '',
  campusId: '',
  collegeDescription: '',
  collegeEmail: '',
  collegePhone: '',
  officeLocation: '',
  representativeFullName: '',
  representativeUsername: '',
  representativeEmail: '',
  representativePhone: '',
  password: '',
  confirmPassword: '',
};

const CollegeSelfRegistration = () => {
  const [form, setForm] = useState(initialForm);
  const [campuses, setCampuses] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusId, setStatusId] = useState(() => sessionStorage.getItem(STATUS_ID_KEY) || '');
  const statusToken = useRef(sessionStorage.getItem(STATUS_TOKEN_KEY) || '');
  const savingRef = useRef(false);

  const checkStatus = useCallback(async (id = statusId, token = statusToken.current) => {
    if (!id || !token) return;
    setStatusLoading(true);
    setStatusError('');
    try {
      const response = await apiClient.get(`/api/college-registration/status/${encodeURIComponent(id)}`, {
        headers: { 'X-Application-Status-Token': token },
      });
      setApplication(response.data.application);
    } catch (requestError) {
      setStatusError(requestError.response?.data?.message || 'Unable to check registration status.');
    } finally {
      setStatusLoading(false);
    }
  }, [statusId]);

  useEffect(() => {
    apiClient.get('/api/college-registration/campuses')
      .then((response) => setCampuses(response.data?.campuses || []))
      .catch(() => setError('Campus options could not be loaded. You may continue without selecting a campus.'));
  }, []);

  useEffect(() => {
    if (statusId && statusToken.current) checkStatus(statusId, statusToken.current);
  }, [checkStatus, statusId]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (form.collegeName.trim().length < 2) errors.collegeName = 'Enter the college name.';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,99}$/.test(form.collegeCode.trim())) errors.collegeCode = 'Use 2–100 letters, numbers, dots, underscores, or hyphens.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.collegeEmail.trim())) errors.collegeEmail = 'Enter a valid official college email.';
    if (!/^\+?[\d\s().-]{7,50}$/.test(form.collegePhone.trim())) errors.collegePhone = 'Enter a valid contact phone number.';
    if (!form.officeLocation.trim()) errors.officeLocation = 'Enter the office location.';
    if (!form.representativeFullName.trim()) errors.representativeFullName = 'Enter the representative’s full name.';
    if (form.representativeUsername.trim().length < 3) errors.representativeUsername = 'Username must be at least 3 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.representativeEmail.trim())) errors.representativeEmail = 'Enter a valid representative email.';
    if (!/^\+?[\d\s().-]{7,50}$/.test(form.representativePhone.trim())) errors.representativePhone = 'Enter a valid representative phone number.';
    if (form.password.length < 8 || form.password.length > 16 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = 'Password must be 8–16 characters and contain a letter and a number.';
    }
    if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (savingRef.current || !validate()) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { confirmPassword, ...payload } = form;
      const response = await apiClient.post('/api/college-registration', {
        ...payload,
        campusId: payload.campusId || null,
        collegeName: payload.collegeName.trim(),
        collegeCode: payload.collegeCode.trim().toUpperCase(),
        collegeEmail: payload.collegeEmail.trim(),
        officeLocation: payload.officeLocation.trim(),
        representativeFullName: payload.representativeFullName.trim(),
        representativeUsername: payload.representativeUsername.trim(),
        representativeEmail: payload.representativeEmail.trim(),
        confirmPassword,
      });
      const { id } = response.data.application;
      statusToken.current = response.data.statusToken;
      sessionStorage.setItem(STATUS_ID_KEY, String(id));
      sessionStorage.setItem(STATUS_TOKEN_KEY, statusToken.current);
      setStatusId(String(id));
      setApplication(response.data.application);
      setForm(initialForm);
    } catch (requestError) {
      const responseData = requestError.response?.data;
      setError(responseData?.message || 'Unable to submit the registration application.');
      if (responseData?.errors) setFieldErrors(responseData.errors);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const startAnotherApplication = () => {
    sessionStorage.removeItem(STATUS_ID_KEY);
    sessionStorage.removeItem(STATUS_TOKEN_KEY);
    statusToken.current = '';
    setStatusId('');
    setApplication(null);
    setStatusError('');
    setError('');
  };

  const field = (name, label, options = {}) => (
    <label className="college-registration-field" htmlFor={`college-registration-${name}`}>
      <span>{label}{options.required && <span aria-hidden="true"> *</span>}</span>
      {options.textarea ? (
        <textarea
          id={`college-registration-${name}`}
          name={name}
          value={form[name]}
          onChange={update}
          maxLength={options.maxLength}
          required={options.required}
          aria-invalid={Boolean(fieldErrors[name])}
          aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
        />
      ) : options.select ? (
        <select id={`college-registration-${name}`} name={name} value={form[name]} onChange={update} aria-invalid={Boolean(fieldErrors[name])}>
          <option value="">Select a campus (optional)</option>
          {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.campusName}</option>)}
        </select>
      ) : (
        <input
          id={`college-registration-${name}`}
          name={name}
          type={options.type || 'text'}
          value={form[name]}
          onChange={update}
          autoComplete={options.autoComplete}
          maxLength={options.maxLength}
          required={options.required}
          aria-invalid={Boolean(fieldErrors[name])}
          aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
        />
      )}
      {fieldErrors[name] && <span className="college-registration-field-error" id={`${name}-error`} role="alert">{fieldErrors[name]}</span>}
    </label>
  );

  return (
    <main className="college-registration-page">
      <section className="college-registration-card" aria-labelledby="college-registration-title">
        <header className="college-registration-header">
          <span className="college-registration-kicker">Mekdela Amba University</span>
          <h1 id="college-registration-title">College inventory self-registration</h1>
          <p>Submit your college and authorized representative details for administrator review. Inventory items are registered separately after approval.</p>
        </header>

        {application ? (
          <section className="college-registration-status" aria-live="polite">
            <h2>Application status</h2>
            <p className={`college-registration-status-badge status-${application.status}`}>{application.status}</p>
            <dl>
              <div><dt>Application reference</dt><dd>{application.id}</dd></div>
              <div><dt>College</dt><dd>{application.collegeName}</dd></div>
              <div><dt>Submitted</dt><dd>{application.submittedAt ? new Date(application.submittedAt).toLocaleString() : 'Just now'}</dd></div>
              {application.reviewedAt && <div><dt>Reviewed</dt><dd>{new Date(application.reviewedAt).toLocaleString()}</dd></div>}
            </dl>
            {application.rejectionReason && <p className="college-registration-rejection">Reason: {application.rejectionReason}</p>}
            {application.status === 'pending' && <p>Your application is awaiting administrator review. Keep this browser session to check its status later.</p>}
            {application.status === 'approved' && <p>Your college account is ready. You can now sign in with the representative username and password you submitted.</p>}
            {statusLoading && <p role="status">Refreshing status…</p>}
            {statusError && <p className="college-registration-error" role="alert">{statusError}</p>}
            <div className="college-registration-actions">
              <button type="button" className="college-registration-secondary" onClick={() => checkStatus()} disabled={statusLoading}>Refresh status</button>
              {application.status === 'rejected' && <button type="button" className="college-registration-secondary" onClick={startAnotherApplication}>Start a new application</button>}
              {application.status === 'approved' && <Link className="college-registration-primary" to="/login">Sign in</Link>}
            </div>
          </section>
        ) : statusId && statusToken.current ? (
          <div className="college-registration-status">
            <p role="status">{statusLoading ? 'Checking saved application status…' : 'Unable to retrieve the saved application status.'}</p>
            {statusError && <p className="college-registration-error" role="alert">{statusError}</p>}
            <button type="button" className="college-registration-secondary" onClick={() => checkStatus()} disabled={statusLoading}>Try again</button>
          </div>
        ) : (
          <>
            {error && <p className="college-registration-error" role="alert">{error}</p>}
            <form onSubmit={submit} noValidate>
              <fieldset>
                <legend>College information</legend>
                <div className="college-registration-grid">
                  {field('collegeName', 'College name', { required: true, maxLength: 255 })}
                  {field('collegeCode', 'College code', { required: true, maxLength: 100 })}
                  {field('campusId', 'Campus', { select: true })}
                  {field('collegeEmail', 'Official college email', { required: true, type: 'email', maxLength: 255 })}
                  {field('collegePhone', 'Contact phone number', { required: true, type: 'tel', maxLength: 50 })}
                  {field('officeLocation', 'Office location', { required: true, maxLength: 255 })}
                  {field('collegeDescription', 'College description (optional)', { textarea: true, maxLength: 5000 })}
                </div>
              </fieldset>

              <fieldset>
                <legend>Authorized representative</legend>
                <div className="college-registration-grid">
                  {field('representativeFullName', 'Full name', { required: true, autoComplete: 'name', maxLength: 255 })}
                  {field('representativeUsername', 'Username', { required: true, autoComplete: 'username', maxLength: 100 })}
                  {field('representativeEmail', 'Email address', { required: true, type: 'email', autoComplete: 'email', maxLength: 255 })}
                  {field('representativePhone', 'Phone number', { required: true, type: 'tel', autoComplete: 'tel', maxLength: 50 })}
                  {field('password', 'Password', { required: true, type: 'password', autoComplete: 'new-password', maxLength: 16 })}
                  {field('confirmPassword', 'Confirm password', { required: true, type: 'password', autoComplete: 'new-password', maxLength: 16 })}
                </div>
              </fieldset>

              <p className="college-registration-note">This application does not register assets, stock, categories, or storage rooms. Use the college inventory tools after your application has been approved.</p>
              <button className="college-registration-primary college-registration-submit" type="submit" disabled={saving}>
                {saving ? 'Submitting application…' : 'Submit for approval'}
              </button>
            </form>
          </>
        )}

        <footer className="college-registration-footer">
          <Link to="/home">Return to home</Link>
          <span aria-hidden="true">·</span>
          <Link to="/login">Sign in</Link>
          <span aria-hidden="true">·</span>
          <Link to="/register">Individual account registration</Link>
        </footer>
      </section>
    </main>
  );
};

export default CollegeSelfRegistration;
