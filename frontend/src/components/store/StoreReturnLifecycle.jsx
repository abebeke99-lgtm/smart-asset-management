import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../utils/api';

const actions = {
  Approved: ['ready', 'Mark Ready for Return'],
  'Ready for Return': ['dispatch', 'Dispatch Return'],
  'In Transit': ['receive', 'Receive Return'],
  Received: ['inspect', 'Complete Inspection'],
  Inspected: ['complete', 'Complete Return'],
};

const StoreReturnLifecycle = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/store/returns', { params: { page: 1, pageSize: 100 } });
      const payload = response.data || {};
      const records = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.returns) ? payload.returns : [];
      setReturns(records.filter((item) => actions[item.status]));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load return workflow.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const process = async (item) => {
    const [endpoint] = actions[item.status];
    setSavingId(item.id);
    setError('');
    setSuccess('');
    try {
      const body = item.status === 'Received'
        ? { condition: item.condition || 'Good', inspection_notes: item.inspectionNotes || '' }
        : {};
      await apiClient.post(`/api/store/returns/${item.id}/${endpoint}`, body);
      setSuccess(`${item.returnNumber || `Return #${item.id}`} updated.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this return.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="returns-page" aria-labelledby="store-return-workflow-heading">
      <header className="returns-header">
        <div>
          <p>Store Operations</p>
          <h2 id="store-return-workflow-heading">Return Workflow</h2>
          <span>Progress approved college return requests through receipt, inspection, and completion.</span>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh workflow</button>
      </header>
      {error && <div className="returns-state returns-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div>}
      {success && <p role="status">{success}</p>}
      {loading ? <div className="returns-state" role="status">Loading return workflow...</div>
        : error ? null
          : returns.length === 0 ? <div className="returns-empty">No approved returns are awaiting store processing.</div>
          : <div className="returns-card returns-table-wrap">
            <table>
              <thead><tr><th>Reference</th><th>Asset</th><th>Quantity</th><th>Status</th><th>Next action</th></tr></thead>
              <tbody>{returns.map((item) => {
                const [, label] = actions[item.status];
                return <tr key={item.id}>
                  <td>{item.returnNumber || item.return_number || `Return #${item.id}`}</td>
                  <td>{item.asset_name || item.Asset?.name || item.assetId || item.asset_id || '—'}</td>
                  <td>{item.quantity || 1}</td>
                  <td>{item.status}</td>
                  <td><button type="button" disabled={savingId === item.id} onClick={() => process(item)}>{savingId === item.id ? 'Processing...' : label}</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
    </section>
  );
};

export default StoreReturnLifecycle;
