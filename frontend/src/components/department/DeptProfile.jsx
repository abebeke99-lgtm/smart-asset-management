import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Building2, CheckCircle2, ClipboardList, Edit3, FileText, Mail, MapPin, Package, Phone, RefreshCw, Save, UserRound, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
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

const getEditableDepartmentDescription = (value) => {
  const description = String(value ?? '').trim();
  return /^auto-created department scope\b/i.test(description) ? '' : description;
};

const normalizeRoleValue = (role) => {
  if (!role) return '';
  const value = String(role).trim().toLowerCase();
  const aliases = {
    'department head': 'department_head',
    'department-head': 'department_head',
    'department_head': 'department_head',
    'dept_head': 'department_head',
    'department': 'department_head',
  };
  return aliases[value] || value;
};

const DeptProfile = () => {
  const { user, hasPermission = () => false } = useAuth();
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const inFlightProfileRequest = useRef(null);
  const loadedProfileUserId = useRef(null);
  const t = useCallback((key) => translateMessage(language, `departmentProfile.${key}`), [language]);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [officeLocations, setOfficeLocations] = useState([]);
  const [officeLocationsState, setOfficeLocationsState] = useState({ loading: true, error: '' });
  const [recentActivities, setRecentActivities] = useState([]);
  const [activityState, setActivityState] = useState({ loading: true, error: '' });
  const inFlightActivityRequest = useRef(null);

  const normalizedRole = normalizeRoleValue(user?.role);
  const userId = String(user?.id ?? '');
  const loadOfficeLocations = useCallback(async () => {
    setOfficeLocationsState({ loading: true, error: '' });
    try {
      const locations = [];
      let page = 1;
      let pages = 1;
      do {
        const response = await apiClient.get('/department-head/locations', {
          params: { page, limit: 100 },
        });
        const payload = response.data || {};
        const rows = Array.isArray(payload.data) ? payload.data : [];
        locations.push(...rows.filter((location) => (
          location.recordType === 'department_location'
        )));
        pages = Math.max(1, Number(payload.pagination?.pages ?? payload.pagination?.totalPages) || 1);
        page += 1;
      } while (page <= pages);

      const uniqueLocations = [...new Map(
        locations.filter((location) => typeof location.name === 'string' && location.name.trim())
          .map((location) => [location.name, location]),
      ).values()];
      setOfficeLocations(uniqueLocations);
      setOfficeLocationsState({ loading: false, error: '' });
    } catch (requestError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Department profile office locations request failed', {
          status: requestError.response?.status || 0,
          url: '/api/department-head/locations',
        });
      }
      setOfficeLocations([]);
      setOfficeLocationsState({
        loading: false,
        error: translateMessage(languageRef.current, 'departmentProfile.officeLocationsError'),
      });
    }
  }, []);

  const loadRecentActivities = useCallback((force = false) => {
    if (normalizedRole !== 'department_head') {
      setRecentActivities([]);
      setActivityState({ loading: false, error: '' });
      return Promise.resolve(null);
    }
    if (!force && inFlightActivityRequest.current?.userId === userId) {
      return inFlightActivityRequest.current.promise;
    }

    setActivityState({ loading: true, error: '' });
    const request = apiClient.get('/department-head/dashboard/recent-activities')
      .then((response) => {
        const activities = response.data?.data;
        if (!Array.isArray(activities)) throw new Error('Recent department activity was not returned by the server.');
        setRecentActivities(activities.slice(0, 5));
        setActivityState({ loading: false, error: '' });
        return activities;
      })
      .catch((requestError) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Department profile activity request failed', {
            status: requestError.response?.status || 0,
            url: '/api/department-head/dashboard/recent-activities',
          });
        }
        setRecentActivities([]);
        setActivityState({ loading: false, error: translateMessage(languageRef.current, 'departmentProfile.activityError') });
        return null;
      })
      .finally(() => {
        if (inFlightActivityRequest.current?.promise === request) {
          inFlightActivityRequest.current = null;
        }
      });

    inFlightActivityRequest.current = { userId, promise: request };
    return request;
  }, [normalizedRole, userId]);

  const loadProfile = useCallback((force = false) => {
    const translate = (key) => translateMessage(languageRef.current, `departmentProfile.${key}`);

    if (normalizedRole !== 'department_head') {
      loadedProfileUserId.current = null;
      setDepartment(null);
      setError(translate('unauthorized'));
      setLoading(false);
      return Promise.resolve(null);
    }

    if (!force && loadedProfileUserId.current === userId) {
      return Promise.resolve(null);
    }
    if (inFlightProfileRequest.current?.userId === userId) {
      return inFlightProfileRequest.current.promise;
    }

    setLoading(true);
    setError('');

    const request = apiClient.get('/department-head/profile')
      .then((response) => {
        const profile = response.data?.data;
        if (!profile || typeof profile !== 'object') {
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
        loadedProfileUserId.current = userId;
        loadOfficeLocations();
        loadRecentActivities();
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
        loadedProfileUserId.current = null;
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

    inFlightProfileRequest.current = { userId, promise: request };
    return request;
  }, [loadOfficeLocations, loadRecentActivities, normalizedRole, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const canEdit = normalizedRole === 'department_head' && hasPermission('department.profile.update');
  const missing = t('notProvided');
  const departmentName = getDisplayValue(department?.name, missing);
  const collegeName = getDisplayValue(department?.college?.collegeName || department?.college?.name, missing);
  const headName = getDisplayValue(department?.head?.fullName || department?.head?.username, missing);
  const officeName = getDisplayValue(department?.office || department?.locationRecord?.name || department?.location?.name, missing);
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
          <button type="button" className="department-profile-button department-profile-button--primary" onClick={() => {
            setServerFieldErrors({});
            setSaveError('');
            setIsEditing(true);
          }}>
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
                  headName={headName}
                  officeLocations={officeLocations}
                  officeLocationsState={officeLocationsState}
                  onRetryOfficeLocations={loadOfficeLocations}
                  saving={saving}
                  serverFieldErrors={serverFieldErrors}
                  t={t}
                  onCancel={() => {
                    setServerFieldErrors({});
                    setSaveError('');
                    setIsEditing(false);
                  }}
                  onSave={async (values) => {
                    setSaving(true);
                    setSaveMessage('');
                    setSaveError('');
                    setServerFieldErrors({});
                    try {
                      const response = await apiClient.put('/department-head/profile', values);
                      const profile = response.data?.data;
                      if (!profile || typeof profile !== 'object') throw new Error('The updated profile was not returned by the server.');
                      setDepartment({
                        ...profile,
                        userCount: Number(profile.summary?.totalStaff ?? profile.userCount ?? 0),
                        assetCount: Number(profile.summary?.totalAssets ?? profile.assetCount ?? 0),
                      });
                      setIsEditing(false);
                      setSaveMessage(t('updated'));
                      toast.success(t('updated'));
                    } catch (saveError) {
                      const fieldErrors = saveError.response?.data?.errors;
                      if (fieldErrors && typeof fieldErrors === 'object') setServerFieldErrors(fieldErrors);
                      if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
                        setSaveError(getProfileErrorMessage(saveError, t, 'saveError'));
                      }
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
          <section className="department-profile-card department-profile-activity" aria-labelledby="department-profile-activity-title">
            <div className="department-profile-section-heading">
              <Activity size={18} aria-hidden="true" />
              <h2 id="department-profile-activity-title">{t('recentActivity')}</h2>
            </div>
            {activityState.loading && <p className="department-profile-activity-state" role="status">{t('activityLoading')}</p>}
            {!activityState.loading && activityState.error && (
              <div className="department-profile-activity-state" role="alert">
                <span>{activityState.error}</span>
                <button type="button" className="department-profile-button" onClick={() => loadRecentActivities(true)}>
                  <RefreshCw size={15} aria-hidden="true" /> {t('retry')}
                </button>
              </div>
            )}
            {!activityState.loading && !activityState.error && recentActivities.length === 0 && (
              <p className="department-profile-activity-state">{t('noRecentActivity')}</p>
            )}
            {!activityState.loading && !activityState.error && recentActivities.length > 0 && (
              <ol className="department-profile-activity-list">
                {recentActivities.map((activity) => {
                  const date = activity.date ? new Date(activity.date) : null;
                  const dateText = date && !Number.isNaN(date.getTime())
                    ? date.toLocaleString(language === 'am' ? 'am-ET' : 'en-US')
                    : missing;
                  return (
                    <li key={activity.id}>
                      <div className="department-profile-activity-copy">
                        <strong>{activity.action || missing}</strong>
                        <span>{activity.entity || missing}</span>
                        <small>{activity.user || missing} · {activity.status || missing}</small>
                      </div>
                      <time dateTime={date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined}>{dateText}</time>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
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

const ProfileForm = ({
  department,
  headName,
  officeLocations,
  officeLocationsState,
  onRetryOfficeLocations,
  saving,
  serverFieldErrors,
  t,
  onCancel,
  onSave,
}) => {
  const initialValues = {
    contact: department.contact || department.phone || '',
    email: department.email || '',
    office: department.locationRecord?.name || department.office || '',
    description: getEditableDepartmentDescription(department.description),
  };
  const [values, setValues] = useState(initialValues);
  const [validationErrors, setValidationErrors] = useState({});
  const hasChanges = Object.keys(initialValues).some((field) => values[field] !== initialValues[field]);

  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setValidationErrors((current) => ({ ...current, [name]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    const contact = values.contact.trim();
    const email = values.email.trim();
    const office = values.office.trim();
    const description = values.description;
    const nextErrors = {};

    if (contact && (!/^[+()\d\s.-]{7,50}$/.test(contact) || contact.replace(/\D/g, '').length < 7)) {
      nextErrors.contact = t('phoneInvalid');
    }
    if (email.length > 255 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      nextErrors.email = t('emailInvalid');
    }
    if (office.length > 255) nextErrors.office = t('officeTooLong');
    if (description.trim().length > 500) {
      nextErrors.description = t('descriptionTooLong');
    }
    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    const updates = Object.fromEntries(Object.entries({ contact, email, office, description: description.trim() })
      .filter(([field, value]) => value !== initialValues[field]));
    if (Object.keys(updates).length) onSave(updates);
  };

  const fieldError = (name) => validationErrors[name]
    || serverFieldErrors?.[name]
    || (name === 'office' ? officeLocationsState.error : '');
  const fieldProps = (name) => ({
    'aria-invalid': Boolean(fieldError(name)),
    'aria-describedby': fieldError(name) ? `department-profile-${name}-error` : undefined,
  });
  return <form className="department-profile-form" onSubmit={submit}>
    <ProfileFieldError message={serverFieldErrors?._form} />
    <dl className="department-profile-details department-profile-details--editing">
      <DetailItem icon={Building2} label={t('departmentId')} value={getDisplayValue(department.id, t('notProvided'))} />
      <DetailItem icon={Building2} label={t('departmentName')} value={getDisplayValue(department.name, t('notProvided'))} />
      <DetailItem icon={FileText} label={t('departmentCode')} value={getDisplayValue(department.code, t('notProvided'))} />
      <DetailItem icon={Building2} label={t('college')} value={getDisplayValue(department.college?.collegeName || department.college?.name, t('notProvided'))} />
      <DetailItem icon={UserRound} label={t('departmentHead')} value={headName} />
      <EditableDetailItem icon={Phone} id="department-profile-contact" name="contact" label={t('contact')} value={values.contact} error={fieldError('contact')} onChange={update} inputProps={{ type: 'tel', maxLength: 50, ...fieldProps('contact') }} />
      <EditableDetailItem icon={Mail} id="department-profile-email" name="email" label={t('email')} value={values.email} error={fieldError('email')} onChange={update} inputProps={{ type: 'email', maxLength: 255, ...fieldProps('email') }} />
      <EditableDetailItem
        icon={MapPin}
        id="department-profile-office"
        name="office"
        label={t('office')}
        value={values.office}
        error={fieldError('office')}
        onChange={update}
        errorAction={officeLocationsState.error && (
          <button type="button" className="department-profile-button" onClick={onRetryOfficeLocations}>
            <RefreshCw size={14} aria-hidden="true" /> {t('retry')}
          </button>
        )}
        inputProps={{
          as: 'select',
          disabled: saving || officeLocationsState.loading || Boolean(officeLocationsState.error),
          ...fieldProps('office'),
        }}
      >
        <option value="">{officeLocationsState.loading
          ? t('loadingOfficeLocations')
          : officeLocations.length ? t('selectOffice') : t('noOfficeLocations')}</option>
        {officeLocations.map((location) => (
          <option key={location.id} value={location.name}>{location.name}</option>
        ))}
      </EditableDetailItem>
      <DetailItem icon={CheckCircle2} label={t('status')} value={String(department.status || '').toLowerCase() === 'active' ? t('active') : String(department.status || '').toLowerCase() === 'inactive' ? t('inactive') : getDisplayValue(department.status, t('notProvided'))} />
      <EditableDetailItem icon={FileText} id="department-profile-description" name="description" label={t('description')} value={values.description} error={fieldError('description')} onChange={update} inputProps={{ as: 'textarea', maxLength: 500, rows: 4, ...fieldProps('description') }} />
    </dl>
    <div className="department-profile-form-actions"><button type="button" className="department-profile-button" onClick={onCancel} disabled={saving}><X size={16} aria-hidden="true" /> {t('cancel')}</button><button type="submit" className="department-profile-button department-profile-button--primary" disabled={saving || !hasChanges}><Save size={16} aria-hidden="true" />{saving ? t('saving') : t('save')}</button></div>
  </form>;
};

const EditableDetailItem = ({ icon: Icon, id, name, label, value, error, errorAction, onChange, inputProps, children }) => {
  const { as, ...attributes } = inputProps;
  const Input = as === 'textarea' ? 'textarea' : as === 'select' ? 'select' : 'input';
  return <div className="department-profile-detail department-profile-detail--editable">
    <Icon size={17} aria-hidden="true" />
    <div>
      <dt><label htmlFor={id}>{label}</label></dt>
      <dd><Input id={id} name={name} value={value} onChange={onChange} {...attributes}>{children}</Input></dd>
      <ProfileFieldError id={`${id}-error`} message={error} />
      {errorAction}
    </div>
  </div>;
};

const ProfileFieldError = ({ id, message }) => message
  ? <p id={id} className="department-profile-form-error" role="alert">{message}</p>
  : null;

export default DeptProfile;
