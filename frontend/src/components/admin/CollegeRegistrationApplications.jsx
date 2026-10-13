import React, { useCallback, useEffect, useState } from 'react';
import { apiClient, getApiErrorMessage } from '../../utils/api';
import './CollegeRegistrationApplications.css';

const CollegeRegistrationApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [reasons, setReasons] = useState({});

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/admin/college-registrations', { params: { status: 'pending', limit: 100 } });
      setApplications(response.data?.applications || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load college registration applications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const review = async (application, decision) => {
    const reason = String(reasons[application.id] || '').trim();
    if (decision === 'reject' && !reason) {
      setError(`Enter a rejection reason for ${application.collegeName}.`);
      return;
    }
    setSavingId(application.id);
    setError('');
    try {
      if (decision === 'approve') {
        await apiClient.post(`/api/admin/college-registrations/${application.id}/approve`);
      } else {
        await apiClient.post(`/api/admin/college-registrations/${application.id}/reject`, { reason });
      }
      await loadApplications();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to ${decision} this application.`));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="college-registration-review" aria-labelledby="college-registration-review-title">
      <div className="college-registration-review-heading">
        <div>
          <h2 id="college-registration-review-title">College registration applications</h2>
          <p>Review public applications before activating a college or representative account.</p>
        </div>
        <button type="button" onClick={loadApplications} disabled={loading}>Refresh applications</button>
      </div>
      {error && <p className="college-registration-review-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading applications…</p> : applications.length === 0 ? (
        <p className="college-registration-review-empty">There are no pending college applications.</p>
      ) : (
        <div className="college-registration-review-list">
          {applications.map((application) => (
            <article className="college-registration-review-card" key={application.id}>
              <div className="college-registration-review-card-heading">
                <div>
                  <h3>{application.collegeName}</h3>
                  <span>{application.collegeCode} · Submitted {new Date(application.submittedAt).toLocaleString()}</span>
                </div>
                <span className="college-registration-review-pending">Pending</span>
              </div>
              <dl>
                <div><dt>Campus / office</dt><dd>{application.campusName || 'Not specified'} · {application.officeLocation}</dd></div>
                <div><dt>College contact</dt><dd>{application.collegeEmail} · {application.collegePhone}</dd></div>
                <div><dt>Representative</dt><dd>{application.representativeFullName} ({application.representativeUsername})</dd></div>
                <div><dt>Representative contact</dt><dd>{application.representativeEmail} · {application.representativePhone}</dd></div>
                {application.collegeDescription && <div><dt>Description</dt><dd>{application.collegeDescription}</dd></div>}
              </dl>
              <label className="college-registration-review-reason" htmlFor={`college-reject-reason-${application.id}`}>
                Rejection reason (required to reject)
                <textarea
                  id={`college-reject-reason-${application.id}`}
                  value={reasons[application.id] || ''}
                  maxLength={1000}
                  onChange={(event) => setReasons((current) => ({ ...current, [application.id]: event.target.value }))}
                />
              </label>
              <div className="college-registration-review-actions">
                <button type="button" className="approve" onClick={() => review(application, 'approve')} disabled={savingId !== null}>
                  {savingId === application.id ? 'Processing…' : 'Approve'}
                </button>
                <button type="button" className="reject" onClick={() => review(application, 'reject')} disabled={savingId !== null}>
                  {savingId === application.id ? 'Processing…' : 'Reject'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default CollegeRegistrationApplications;
