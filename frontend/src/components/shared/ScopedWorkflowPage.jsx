import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../utils/api';

const CONFIG = {
  transfers: { title: 'Asset Transfers', path: 'transfers', createLabel: 'Create Transfer', fields: ['asset_id', 'destination_department_id', 'destination_location', 'reason'] },
  returns: { title: 'Asset Returns', path: 'returns', createLabel: 'Request Return', fields: ['asset_id', 'reason', 'condition', 'notes'] },
  maintenance: { title: 'Maintenance Requests', path: 'maintenance', createLabel: 'Request Maintenance', fields: ['asset_id', 'problem', 'description', 'priority'] },
};

const ScopedWorkflowPage = ({ scope = 'department', type = 'transfers' }) => {
  const config = CONFIG[type];
  const base = `/api/${scope}/${config.path}`;
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ asset_id: '', destination_department_id: '', destination_location: '', reason: '', condition: 'Good', notes: '', problem: '', description: '', priority: 'normal' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [workflowResponse, assetsResponse] = await Promise.all([apiClient.get(base, { params: { status: status || undefined } }), apiClient.get(`/api/${scope}/assets`, { params: { limit: 100 } })]);
      setRows(workflowResponse.data?.data || workflowResponse.data?.transfers || workflowResponse.data?.returns || []);
      setAssets(assetsResponse.data?.data || []);
    } catch (loadError) { setRows([]); setAssets([]); setError(loadError.response?.data?.message || 'Unable to load workflow records.'); }
    finally { setLoading(false); }
  }, [base, scope, status]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await apiClient.post(base, form); setForm({ asset_id: '', destination_department_id: '', destination_location: '', reason: '', condition: 'Good', notes: '', problem: '', description: '', priority: 'normal' }); await load(); }
    catch (submitError) { setError(submitError.response?.data?.message || 'Unable to submit request.'); }
    finally { setSaving(false); }
  };

  const canCreate = scope === 'department';
  return <section className="college-workspace-page"><header><div><div className="college-breadcrumb">{scope === 'college' ? 'College' : 'Department'} / Operations</div><h1>{config.title}</h1><p>Real records within your authorized {scope} scope.</p></div></header><div className="college-toolbar"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Requested</option><option>Approved</option><option>Ready</option><option>In Transit</option><option>Received</option><option>Inspected</option><option>pending</option><option>completed</option></select><button type="button" onClick={load}>Refresh</button></div>{canCreate && <form className="college-form" onSubmit={submit}><select required value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })}><option value="">Select asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>)}</select>{type === 'transfers' && <><input required placeholder="Destination department ID" value={form.destination_department_id} onChange={(event) => setForm({ ...form, destination_department_id: event.target.value })} /><input placeholder="Destination location" value={form.destination_location} onChange={(event) => setForm({ ...form, destination_location: event.target.value })} /></>}{type === 'maintenance' && <><input required placeholder="Problem" value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} /><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></>}{type === 'returns' && <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}><option>Excellent</option><option>Good</option><option>Fair</option><option>Damaged</option><option>Non-functional</option><option>Missing Parts</option></select>}<textarea required={type !== 'returns'} placeholder={type === 'maintenance' ? 'Description' : 'Reason'} value={type === 'maintenance' ? form.description : form.reason} onChange={(event) => setForm({ ...form, [type === 'maintenance' ? 'description' : 'reason']: event.target.value })} /><button type="submit" disabled={saving}>{saving ? 'Saving...' : config.createLabel}</button></form>}{error && <div role="alert" className="college-error">{error}</div>}{loading ? <div className="college-state">Loading records...</div> : rows.length === 0 ? <div className="college-state">No records found.</div> : <div className="college-table-wrap"><table><thead><tr><th>Reference</th><th>Asset</th><th>Status</th><th>Reason / Description</th><th>Date</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.transfer_number || row.return_number || row.requestNumber || `#${row.id}`}</td><td>{row.asset_name || row.asset?.name || row.assetId || row.asset_id || '-'}</td><td>{row.status || '-'}</td><td>{row.transfer_reason || row.reason || row.description || row.notes || '-'}</td><td>{row.createdAt || row.created_at || '-'}</td></tr>)}</tbody></table></div>}</section>;
};

export default ScopedWorkflowPage;
