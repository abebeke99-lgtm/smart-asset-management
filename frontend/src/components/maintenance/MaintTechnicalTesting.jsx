/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import {
  createMaintenanceRetest,
  createMaintenanceTest,
  getMaintenanceTestOptions,
  getMaintenanceTests,
  completeMaintenanceTest,
  returnMaintenanceTestToService,
  sendMaintenanceTestToQC,
  startMaintenanceTest,
} from '../../services/maintenanceApi';

const checklistTemplate = [
  { requirement: 'Functional operation verified', completed: false, required: true },
  { requirement: 'Safety checks completed', completed: false, required: true },
];

const MaintTechnicalTesting = () => {
  const [tests, setTests] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, inTesting: 0, passed: 0, failed: 0, awaitingQualityControl: 0 });
  const [maintenanceOptions, setMaintenanceOptions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resultTest, setResultTest] = useState(null);
  const [createForm, setCreateForm] = useState({ maintenanceId: '', workOrderId: '', testType: 'Functional', procedure: '', expectedResult: '' });
  const [resultForm, setResultForm] = useState({ overallResult: 'Passed', actualResult: '', failureReason: '', failedCheck: '', recommendedAction: '', notes: '', checklist: checklistTemplate });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [testPage, optionsResponse, workOrderResponse] = await Promise.all([
        getMaintenanceTests({ limit: 100 }),
        getMaintenanceTestOptions(),
        apiClient.get('/maintenance/work-orders', { params: { limit: 100 } }),
      ]);
      const workOrderBody = workOrderResponse.data || {};
      setTests(testPage.items || []);
      setSummary(testPage.summary || {});
      setMaintenanceOptions(optionsResponse.maintenance || []);
      setWorkOrders(workOrderBody.data || []);
    } catch (loadError) {
      setError(loadError?.response?.data?.message || 'Unable to load technical tests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedMaintenance = maintenanceOptions.find((item) => String(item.id) === createForm.maintenanceId);
  const eligibleWorkOrders = workOrders.filter((item) => Number(item.maintenanceId) === Number(createForm.maintenanceId) && item.statusRaw === 'completed');

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!createForm.maintenanceId || !createForm.workOrderId) {
      setError('Select a maintenance request and its completed work order.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createMaintenanceTest({
        maintenanceId: Number(createForm.maintenanceId),
        workOrderId: Number(createForm.workOrderId),
        testType: createForm.testType.trim(),
        procedure: createForm.procedure.trim(),
        expectedResult: createForm.expectedResult.trim(),
        checklist: checklistTemplate,
        measurements: [],
      });
      setCreateOpen(false);
      setCreateForm({ maintenanceId: '', workOrderId: '', testType: 'Functional', procedure: '', expectedResult: '' });
      setMessage('Technical test created.');
      await loadData();
    } catch (createError) {
      setError(createError?.response?.data?.message || 'Unable to create the technical test.');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action, successMessage) => {
    setSaving(true);
    setError('');
    try {
      await action();
      setMessage(successMessage);
      await loadData();
    } catch (actionError) {
      setError(actionError?.response?.data?.message || 'The test action could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  const openResultForm = (item) => {
    const checklist = Array.isArray(item.checklist) && item.checklist.length
      ? item.checklist.map((check) => ({ ...check }))
      : checklistTemplate.map((check) => ({ ...check }));
    setResultTest(item);
    setResultForm({ overallResult: 'Passed', actualResult: '', failureReason: '', failedCheck: '', recommendedAction: '', notes: '', checklist });
    setError('');
  };

  const handleComplete = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await completeMaintenanceTest(resultTest.id, {
        ...resultForm,
        actualResult: resultForm.actualResult.trim(),
        failureReason: resultForm.failureReason.trim(),
        failedCheck: resultForm.failedCheck.trim(),
        recommendedAction: resultForm.recommendedAction.trim(),
        notes: resultForm.notes.trim(),
      });
      setResultTest(null);
      setMessage(`Test ${resultTest.id} recorded as ${resultForm.overallResult}.`);
      await loadData();
    } catch (completeError) {
      setError(completeError?.response?.data?.message || 'Unable to record the technical test result.');
    } finally {
      setSaving(false);
    }
  };

  const updateChecklist = (index, completed) => {
    setResultForm((current) => ({
      ...current,
      checklist: current.checklist.map((item, itemIndex) => itemIndex === index ? { ...item, completed } : item),
    }));
  };

  if (loading) return <div role="status" style={{ padding: '40px', textAlign: 'center' }}>Loading technical tests…</div>;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Maintenance Quality</div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Technical Testing</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>Record functional results before quality review.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={loadData} disabled={saving}>Refresh</button>
          <button type="button" onClick={() => { setCreateOpen(true); setError(''); }}>New Test</button>
        </div>
      </header>

      {error && <div role="alert" style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>{error}</div>}
      {message && <div role="status" style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '6px' }}>{message}</div>}

      <section aria-label="Technical testing summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {[
          ['Total Tests', summary.total], ['Pending', summary.pending], ['In Progress', summary.inTesting], ['Passed', summary.passed], ['Failed', summary.failed], ['Awaiting QC', summary.awaitingQualityControl],
        ].map(([label, value]) => <div key={label} style={{ border: '1px solid #d9e2f2', borderRadius: '6px', padding: '14px' }}><div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{value || 0}</div><div style={{ color: '#64748b' }}>{label}</div></div>)}
      </section>

      <div style={{ overflowX: 'auto', border: '1px solid #d9e2f2', borderRadius: '6px' }}>
        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead><tr>{['Test', 'Asset', 'Maintenance', 'Work Order', 'Type', 'Result', 'Status', 'Quality', 'Actions'].map((label) => <th key={label} style={{ padding: '11px', textAlign: 'left', background: '#f8fafc' }}>{label}</th>)}</tr></thead>
          <tbody>
            {tests.map((item) => {
              const maintenance = item.Maintenance || {};
              const asset = item.Asset || {};
              const workOrder = item.MaintenanceWorkOrder || {};
              const qualityStatus = String(item.qualityStatus || 'not-reviewed').toLowerCase();
              return (
                <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '11px' }}>TEST-{String(item.id).padStart(4, '0')}</td>
                  <td style={{ padding: '11px' }}>{asset.name || '—'}<div style={{ color: '#64748b', fontSize: '0.8rem' }}>{asset.assetCode || ''}</div></td>
                  <td style={{ padding: '11px' }}>{maintenance.title || `Request ${item.maintenanceId}`}</td>
                  <td style={{ padding: '11px' }}>{workOrder.workOrderNumber || (item.workOrderId ? `WO-${item.workOrderId}` : '—')}</td>
                  <td style={{ padding: '11px' }}>{item.testType || 'Functional'}</td>
                  <td style={{ padding: '11px' }}>{item.overallResult || 'Pending'}</td>
                  <td style={{ padding: '11px' }}>{item.status || 'pending'}</td>
                  <td style={{ padding: '11px' }}>{qualityStatus}</td>
                  <td style={{ padding: '11px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item.status === 'pending' && <button type="button" disabled={saving} onClick={() => handleAction(() => startMaintenanceTest(item.id), `Test ${item.id} started.`)}>Start Test</button>}
                    {item.status === 'in-progress' && <button type="button" disabled={saving} onClick={() => openResultForm(item)}>Record Result</button>}
                    {item.status === 'passed' && qualityStatus === 'not-reviewed' && <button type="button" disabled={saving} onClick={() => handleAction(() => sendMaintenanceTestToQC(item.id), `Test ${item.id} sent to QC.`)}>Send to QC</button>}
                    {item.status === 'passed' && qualityStatus === 'approved' && <button type="button" disabled={saving} onClick={() => handleAction(() => returnMaintenanceTestToService(item.id), `Test ${item.id} returned the asset to service.`)}>Return to Service</button>}
                    {['failed', 'retest-required'].includes(item.status) && <span style={{ color: '#b91c1c' }}>Corrective work required before retest.</span>}
                  </td>
                </tr>
              );
            })}
            {tests.length === 0 && <tr><td colSpan="9" style={{ padding: '28px', textAlign: 'center' }}>No technical tests recorded.</td></tr>}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCreateOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(15,23,42,.58)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-test-title" style={{ width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#0f172a', borderRadius: '8px', padding: '22px' }}>
            <h2 id="create-test-title">New Technical Test</h2>
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '5px' }}>Maintenance Record
                <select aria-label="Maintenance Record" required value={createForm.maintenanceId} onChange={(event) => setCreateForm({ ...createForm, maintenanceId: event.target.value, workOrderId: '' })}>
                  <option value="">Select maintenance request</option>
                  {maintenanceOptions.map((item) => <option key={item.id} value={item.id}>REQ-{String(item.id).padStart(3, '0')} · {item.title} · {item.Asset?.name || item.assetId}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '5px' }}>Completed Work Order
                <select aria-label="Completed Work Order" required value={createForm.workOrderId} onChange={(event) => setCreateForm({ ...createForm, workOrderId: event.target.value })}>
                  <option value="">Select completed work order</option>
                  {eligibleWorkOrders.map((item) => <option key={item.id} value={item.id}>{item.workOrderNumber} · {item.assetName}</option>)}
                </select>
              </label>
              {selectedMaintenance && <div><strong>Asset:</strong> {selectedMaintenance.Asset?.name || selectedMaintenance.assetId}</div>}
              <label style={{ display: 'grid', gap: '5px' }}>Test Type<input aria-label="Test Type" required maxLength={100} value={createForm.testType} onChange={(event) => setCreateForm({ ...createForm, testType: event.target.value })} /></label>
              <label style={{ display: 'grid', gap: '5px' }}>Procedure<textarea aria-label="Test Procedure" value={createForm.procedure} onChange={(event) => setCreateForm({ ...createForm, procedure: event.target.value })} rows={3} /></label>
              <label style={{ display: 'grid', gap: '5px' }}>Expected Result<textarea aria-label="Expected Result" value={createForm.expectedResult} onChange={(event) => setCreateForm({ ...createForm, expectedResult: event.target.value })} rows={2} /></label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button type="button" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Test'}</button></div>
            </form>
          </section>
        </div>
      )}

      {resultTest && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setResultTest(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(15,23,42,.58)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="test-result-title" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#0f172a', borderRadius: '8px', padding: '22px' }}>
            <h2 id="test-result-title">Record Test Result · TEST-{String(resultTest.id).padStart(4, '0')}</h2>
            <form onSubmit={handleComplete} style={{ display: 'grid', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '5px' }}>Result<select aria-label="Test Result" value={resultForm.overallResult} onChange={(event) => setResultForm({ ...resultForm, overallResult: event.target.value })}><option value="Passed">Passed</option><option value="Failed">Failed</option><option value="Retest Required">Retest Required</option></select></label>
              <label style={{ display: 'grid', gap: '5px' }}>Observed Result<textarea aria-label="Observed Result" required value={resultForm.actualResult} onChange={(event) => setResultForm({ ...resultForm, actualResult: event.target.value })} rows={3} /></label>
              <fieldset style={{ display: 'grid', gap: '8px' }}><legend>Required Checks</legend>{resultForm.checklist.map((check, index) => <label key={check.requirement}><input type="checkbox" checked={Boolean(check.completed)} onChange={(event) => updateChecklist(index, event.target.checked)} /> {check.requirement}</label>)}</fieldset>
              {resultForm.overallResult !== 'Passed' && <>
                <label style={{ display: 'grid', gap: '5px' }}>Failure Reason<textarea aria-label="Failure Reason" required value={resultForm.failureReason} onChange={(event) => setResultForm({ ...resultForm, failureReason: event.target.value })} rows={2} /></label>
                <label style={{ display: 'grid', gap: '5px' }}>Failed Check<input aria-label="Failed Check" required value={resultForm.failedCheck} onChange={(event) => setResultForm({ ...resultForm, failedCheck: event.target.value })} /></label>
                <label style={{ display: 'grid', gap: '5px' }}>Recommended Action<textarea aria-label="Recommended Action" required value={resultForm.recommendedAction} onChange={(event) => setResultForm({ ...resultForm, recommendedAction: event.target.value })} rows={2} /></label>
              </>}
              <label style={{ display: 'grid', gap: '5px' }}>Notes<textarea aria-label="Test Notes" value={resultForm.notes} onChange={(event) => setResultForm({ ...resultForm, notes: event.target.value })} rows={2} /></label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button type="button" onClick={() => setResultTest(null)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Complete Test'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default MaintTechnicalTesting;