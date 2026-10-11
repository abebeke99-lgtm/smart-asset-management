import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';

const ACCOUNT_LIMIT = 8;

export default function StoreManagerAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(ACCOUNT_LIMIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);
  const remaining = Math.max(0, limit - count);

  const loadAccounts = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/users/store-manager-accounts');
      if (response.data?.success === false) {
        setError(response.data.message || 'Unable to load Store Manager accounts.');
        return;
      }
      const data = response.data?.data || {};
      const responseCount = Number(data.count);
      const responseLimit = Number(data.limit);
      const visibleCount = Number(data.visibleCount ?? data.users?.length);
      if (
        !Array.isArray(data.users)
        || !Number.isInteger(responseCount)
        || responseCount < 0
        || !Number.isInteger(visibleCount)
        || visibleCount !== data.users.length
        || responseCount < visibleCount
        || !Number.isInteger(responseLimit)
        || responseLimit < 1
      ) {
        setError('The Store Manager account response was incomplete. Please retry.');
        return;
      }
      setAccounts(data.users);
      setCount(responseCount);
      setLimit(responseLimit);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load Store Manager accounts.'));
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return (
    <main className="store-manager-accounts" aria-busy={loading} style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Store Manager User Registration</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary, #64748b)' }}>
            View registered Store Manager accounts and the account limit.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={loadAccounts} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </header>

      <section aria-label="Store Manager account registration status" style={{ margin: '24px 0', padding: '20px', borderRadius: '12px', background: 'var(--surface-secondary, #f8fafc)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={20} aria-hidden="true" />
          <strong>{loading ? 'Loading account count…' : `${count} of ${limit} accounts registered`}</strong>
        </div>
        {!loading && !error && (
          <p style={{ margin: '12px 0 0' }}>
            {remaining} account{remaining === 1 ? '' : 's'} remaining.
          </p>
        )}
        <p style={{ margin: '12px 0 0' }}>
          New Store Manager accounts are provisioned by an administrator through User Management. Store Managers cannot create accounts or assign roles.
        </p>
      </section>

      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={loadAccounts} disabled={loading}>
            Retry
          </button>
        </div>
      )}

      <h2>Registered Store Manager Accounts</h2>
      {loading ? (
        <p role="status">Loading Store Manager accounts…</p>
      ) : !error && accounts.length === 0 ? (
        <p>No Store Manager accounts are registered.</p>
      ) : !error ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Full Name</th>
                <th scope="col">Username</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">College</th>
                <th scope="col">Department</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.fullName || '—'}</td>
                  <td>{account.username}</td>
                  <td>{account.email || '—'}</td>
                  <td>{account.status}</td>
                  <td>{account.College?.collegeName || account.collegeName || '—'}</td>
                  <td>{account.DepartmentRecord?.name || account.department || '—'}</td>
                  <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
