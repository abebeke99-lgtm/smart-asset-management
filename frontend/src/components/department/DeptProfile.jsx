import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CheckCircle2, ClipboardList, Edit3, FileText, Mail, MapPin, Package, Phone, RefreshCw, Save, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import { translateMessage } from '../../i18n/messages';

const getProfileErrorMessage = (error, t, fallbackKey = 'loadError') => {
  const status = error.response?.status;
  if (status === 401) return t('authenticationRequired');
  if (status === 403) return t('unauthorized');
  if (status === 404) return t('notFound');
  if (status === 422) return t('validationError');
  if (status >= 500) return t(fallbackKey);
  if (!error.response && ['ERR_NETWORK', 'ECONNABORTED'].includes(error.code)) return t('networkError');
  if (!error.response && error.message === 'Network Error') return t('networkError');
  return error.response?.data?.message || t(fallbackKey);
};

const getDisplayValue = (value, missingLabel) => {
  const normalized = String(value ?? '').trim();
  return normalized || missingLabel;
};

const getDepartmentDescription = (value, missingLabel) => {
  const description = String(value ?? '').trim();
  if (!description || /^auto-created department scope\b/i.test(description)) return missingLabel;
  return description;
};

const DeptProfile = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const inFlightProfileRequest = useRef(null);
  const loadedProfileDepartmentId = useRef(null);
  const t = useCallback((key) => translateMessage(language, `departmentProfile.${key}`), [language]);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const hasDepartmentProfileUpdatePermission = Array.isArray(user?.permissions)
    && user.permissions.some((permission) => String(permission).trim().toLowerCase() === 'department.profile.update');

  const loadProfile = useCallback((force = false) => {
    const translate = (key) => translateMessage(languageRef.current, `departmentProfile.${key}`);
    const departmentId = Number(user?.departmentId ?? user?.department_id);

    if (user?.role !== 'department_head') {
      loadedProfileDepartmentId.current = null;
      setDepartment(null);
      setError(translate('unauthorized'));
      setLoading(false);
      return Promise.resolve(null);
    }

    if (!force && loadedProfileDepartmentId.current === departmentId) {
      return Promise.resolve(null);
    }
    if (inFlightProfileRequest.current?.departmentId === departmentId) {
      return inFlightProfileRequest.current.promise;
    }

    setLoading(true);
    setError('');

    if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
      loadedProfileDepartmentId.current = null;
      setDepartment(null);
      setError(translate('unauthorized'));
      setLoading(false);
      return Promise.resolve(null);
    }

    const request = apiClient.get('/department-head/profile')
      .then((response) => {
        const profile = response.data?.data;
        if (profile === null || profile === undefined) {
          setDepartment(null);
          setSaveMessage('');
          loadedProfileDepartmentId.current = departmentId;
          return null;
        }
        if (Number(profile.id) !== departmentId) {
          setDepartment(null);
          setError(translate('notFound'));
          return null;
        }
        const withSummary = {
          ...profile,
          userCount: Number(profile.summary?.totalStaff ?? profile.userCount ?? 0),
          assetCount: Number(profile.summary?.totalAssets ?? profile.assetCount ?? 0),
        };
        setDepartment(withSummary);
        setSaveMessage('');
        loadedProfileDepartmentId.current = departmentId;
        return withSummary;
      })
      .catch((requestError) => {
        if (process.env.NODE_ENV === 'development') {
          const responseMessage = requestError.response?.data?.message;
          console.error('Department profile request failed', {
            status: requestError.response?.status || 0,
            url: '/api/department-head/profile',
            message: typeof responseMessage === 'string' ? responseMessage.slice(0, 300) : undefined,
          });
        }
        loadedProfileDepartmentId.current = null;
        setDepartment(null);
        setError(getProfileErrorMessage(requestError, translate));
        return null;
      })
      .finally(() => {
        if (inFlightProfileRequest.current?.promise === request) {
          inFlightProfileRequest.current = null;
          setLoading(false);
        }
      });

    inFlightProfileRequest.current = { departmentId, promise: request };
    return request;
  }, [user?.departmentId, user?.department_id, user?.role]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const canEdit = user?.role === 'department_head' && hasDepartmentProfileUpdatePermission;
  const missing = t('notProvided');
  const departmentName = getDisplayValue(department?.name, missing);
  const collegeName = getDisplayValue(department?.college?.collegeName || department?.college?.name, missing);
  const headName = getDisplayValue(department?.head?.fullName || department?.head?.username, missing);
  const officeName = getDisplayValue(department?.locationRecord?.name || department?.office || department?.location?.name, missing);
  const status = String(department?.status || '').trim().toLowerCase();
  const statusLabel = status === 'active' || status === 'inactive' ? t(status) : getDisplayValue(status, missing);

  return (
    <section className="department-profile-page">
      <header className="department-profile-header">
        <div className="department-profile-title">
          <span className="department-profile-icon" aria-hidden="true"><Building2 size={24} strokeWidth={1.8} /></span>
          <div>
            <div className="department-profile-breadcrumb">{t('breadcrumb')}</div>
            <h1>{t('title')}</h1>
            <p>{t('subtitle')}</p>
          </div>
        </div>
        {canEdit && department && !isEditing && (
          <button type="button" className="department-profile-button department-profile-button--primary" onClick={() => setIsEditing(true)}>
            <Edit3 size={16} aria-hidden="true" /> {t('edit')}
          </button>
        )}
      </header>
      {loading && <ProfileLoadingState message={translateMessage(language, 'departmentLoading.profile')} />}
      {!loading && error && <ProfileErrorState message={error} retryLabel={t('retry')} onRetry={() => loadProfile(true)} />}
      {!loading && !error && !department && <div className="department-profile-state" role="status">{t('unavailable')}</div>}
      {!loading && !error && department && (
        <>
          {saveMessage && <div className="department-profile-notice department-profile-notice--success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{saveMessage}</div>}
          {saveError && <div className="department-profile-state department-profile-state--error" role="alert">{saveError}</div>}
          <div className="department-profile-layout">
            <article className="department-profile-card department-profile-card--identity">
              <div className="department-profile-card-heading">
                <div><span className="department-profile-eyebrow">{t('information')}</span><h2>{departmentName}</h2></div>
                <span className={`department-profile-status department-profile-status--${status === 'inactive' ? 'inactive' : 'active'}`} aria-label={`${t('status')}: ${statusLabel}`}><CheckCircle2 size={14} aria-hidden="true" />{statusLabel}</span>
              </div>
              {isEditing ? (
                <ProfileForm
                  department={department}
                  saving={saving}
                  t={t}
                  onCancel={() => setIsEditing(false)}
                  onSave={async (values) => {
                    setSaving(true);
                    setSaveMessage('');
                    setSaveError('');
                    try {
                      await apiClient.put('/department-head/profile', values);
                      const updatedProfile = await loadProfile(true);
                      if (updatedProfile) {
                        setIsEditing(false);
                        setSaveMessage(t('updated'));
                      }
                    } catch (saveError) {
                      setSaveError(getProfileErrorMessage(saveError, t, 'saveError'));
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              ) : (
                <DetailGrid
                  department={department}
                  departmentName={departmentName}
                  collegeName={collegeName}
                  headName={headName}
                  officeName={officeName}
                  statusLabel={statusLabel}
                  missing={missing}
                  t={t}
                />
              )}
            </article>
            <aside className="department-profile-card">
              <div className="department-profile-section-heading"><ClipboardList size={18} aria-hidden="true" /><h2>{t('summary')}</h2></div>
              <div className="department-profile-summary-grid">
                <SummaryItem icon={Users} label={t('totalStaff')} value={Number(department.userCount || 0)} />
                <SummaryItem icon={Package} label={t('totalAssets')} value={Number(department.assetCount || 0)} />
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

const DetailGrid = ({ department, departmentName, collegeName, headName, officeName, statusLabel, missing, t }) => (
  <dl className="department-profile-details">
    <DetailItem icon={Building2} label={t('departmentId')} value={getDisplayValue(department.id, missing)} />
    <DetailItem icon={Building2} label={t('departmentName')} value={departmentName} />
    <DetailItem icon={FileText} label={t('departmentCode')} value={getDisplayValue(department.code, missing)} />
    <DetailItem icon={Building2} label={t('college')} value={collegeName} />
    <DetailItem icon={UserRound} label={t('departmentHead')} value={headName} />
    <DetailItem icon={Phone} label={t('contact')} value={getDisplayValue(department.phone, missing)} />
    <DetailItem icon={Mail} label={t('email')} value={getDisplayValue(department.email, missing)} />
    <DetailItem icon={MapPin} label={t('office')} value={officeName} />
    <DetailItem icon={CheckCircle2} label={t('status')} value={statusLabel} />
    <DetailItem icon={FileText} label={t('description')} value={getDepartmentDescription(department.description, missing)} />
  </dl>
);

const DetailItem = ({ icon: Icon, label, value }) => <div className="department-profile-detail"><Icon size={17} aria-hidden="true" /><div><dt>{label}</dt><dd>{value}</dd></div></div>;
const SummaryItem = ({ icon: Icon, label, value }) => <div className="department-profile-summary-item"><Icon size={18} aria-hidden="true" /><strong>{Number(value || 0)}</strong><span>{label}</span></div>;
const ProfileLoadingState = ({ message }) => (
  <div className="department-profile-loading" role="status" aria-live="polite">
    <span className="department-profile-spinner"><RefreshCw size={20} aria-hidden="true" /></span>{message}
    <div className="department-profile-skeleton" aria-hidden="true"><span /><span /><span /></div>
  </div>
);
const ProfileErrorState = ({ message, retryLabel, onRetry }) => <div className="department-profile-state department-profile-state--error" role="alert"><p>{message}</p><button type="button" className="department-profile-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> {retryLabel}</button></div>;

const ProfileForm = ({ department, saving, t, onCancel, onSave }) => {
  const [values, setValues] = useState({
    phone: department.phone || '',
    email: department.email || '',
    office: department.locationRecord?.name || department.office || '',
    description: department.description || '',
  });
  const [validationError, setValidationError] = useState('');

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    const phone = values.phone.trim();
    const email = values.email.trim();
    const office = values.office.trim();
    const description = values.description.trim();

    if (email.length > 255 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setValidationError(t('emailInvalid'));
      return;
    }
    if (phone && (!/^[+()\d\s.-]{7,50}$/.test(phone) || phone.replace(/\D/g, '').length < 7)) {
      setValidationError(t('phoneInvalid'));
      return;
    }
    if (description.length > 2000) {
      setValidationError(t('descriptionTooLong'));
      return;
    }

    setValidationError('');
    onSave({ phone, email, office, description });
  };

  return <form className="department-profile-form" onSubmit={submit}>
    {validationError && <p className="department-profile-form-error" role="alert">{validationError}</p>}
    <label>{t('contact')}<input name="phone" type="tel" maxLength="50" value={values.phone} onChange={update} /></label>
    <label>{t('email')}<input name="email" type="email" maxLength="255" value={values.email} onChange={update} /></label>
    <label>{t('office')}<input name="office" maxLength="255" value={values.office} onChange={update} /></label>
    <label>{t('description')}<textarea name="description" value={values.description} onChange={update} maxLength="2000" rows="4" /></label>
    <div className="department-profile-form-actions"><button type="button" className="department-profile-button" onClick={onCancel} disabled={saving}><X size={16} aria-hidden="true" /> {t('cancel')}</button><button type="submit" className="department-profile-button department-profile-button--primary" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? t('saving') : t('save')}</button></div>
  </form>;
};

export default DeptProfile;
