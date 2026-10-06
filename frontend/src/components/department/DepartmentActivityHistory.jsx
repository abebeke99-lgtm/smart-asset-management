import React, { useEffect, useState } from 'react';
import { apiClient } from '../../utils/api';

const initialFilters = { date: '', user: '', action: '', entity: '', status: '' };

const DepartmentActivityHistory = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [records, setRecords] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let mounted = true;
    setState({ loading: true, error: '' });
    apiClient.get('/department-head/history', { params: filters })
      .then((response) => {
        if (!mounted) return;
        const rows = response.data?.data;
        setRecords(Array.isArray(rows) ? rows : []);
        setState({ loading: false, error: '' });
      })
      .catch(() => {
        if (mounted) setState({ loading: false, error: 'Unable to load department activity history.' });
      });
    return () => { mounted = false; };
  }, [filters]);

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Department Activity History</h1>
      <p>Review authorized activity recorded for your department.</p>
      <section aria-label="History filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '20px 0' }}>
        <label>Date <input aria-label="Date" type="date" name="date" value={filters.date} onChange={updateFilter} /></label>
        <label>User <input aria-label="User" name="user" value={filters.user} onChange={updateFilter} /></label>
        <label>Action <input aria-label="Action" name="action" value={filters.action} onChange={updateFilter} /></label>
        <label>Entity <input aria-label="Entity" name="entity" value={filters.entity} onChange={updateFilter} /></label>
        <label>Status <input aria-label="Status" name="status" value={filters.status} onChange={updateFilter} /></label>
      </section>
      {state.loading ? <p role="status">Loading department history...</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {!state.loading && !state.error && records.length === 0 ? <p>No department activity found.</p> : null}
      {!state.loading && !state.error && records.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Entity ID</th>
                <th scope="col">Status</th>
                <th scope="col">Date/Time</th>
                <th scope="col">Department</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.user || '-'}</td>
                  <td>{record.action || '-'}</td>
                  <td>{record.entity || '-'}</td>
                  <td>{record.entityId || '-'}</td>
                  <td>{record.status || '-'}</td>
                  <td>{record.dateTime ? new Date(record.dateTime).toLocaleString() : '-'}</td>
                  <td>{record.department || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
};

export default DepartmentActivityHistory;
