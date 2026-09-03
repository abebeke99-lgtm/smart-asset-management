import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return value.name || value.code || value.username || '-';
  return String(value);
};

const ICTAssetHistory = () => {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const [assetResponse, assignmentsResponse, maintenanceResponse, rfidResponse] = await Promise.all([
          axios.get(`/api/assets/${id}`),
          axios.get(`/api/assets/${id}/assignments`),
          axios.get(`/api/assets/${id}/maintenance`),
          axios.get(`/api/rfid/history/${id}`)
        ]);
        if (!active) return;
        const assetData = assetResponse.data?.asset || {};
        const assignments = assignmentsResponse.data?.history || [];
        const maintenance = maintenanceResponse.data?.history || [];
        const scans = rfidResponse.data?.logs || [];
        const history = [
          { action: 'Created', date: assetData.createdAt || assetData.created_at, description: 'Asset registered' },
          ...assignments.map(item => ({ action: item.status === 'returned' ? 'Returned' : 'Assigned', date: item.createdAt || item.created_at, description: item.remarks || item.notes, location: item.location })),
          ...maintenance.map(item => ({ action: `Maintenance: ${item.status || 'Updated'}`, date: item.updatedAt || item.updated_at || item.createdAt, description: item.problem || item.remarks })),
          ...scans.map(item => ({ action: 'RFID Scanned', date: item.timestamp || item.createdAt, description: item.event || item.type, location: item.location || item.reader_location }))
        ].filter(item => item.date).sort((a, b) => new Date(b.date) - new Date(a.date));
        setAsset(assetData);
        setRecords(history);
      } catch (loadError) {
        if (active) setError(loadError.response?.data?.message || 'Unable to load asset history.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [id]);

  return (
    <section style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>📜 Asset History</h1>
      {loading && <p>Loading history...</p>}
      {!loading && error && <p role="alert">{error}</p>}
      {!loading && !error && <>
        <p><strong>{formatValue(asset?.name)}</strong> · {formatValue(asset?.assetCode || asset?.asset_id || id)}</p>
        {records.length === 0 ? <p>No history records found.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th>Date/Time</th><th>Action</th><th>Performed By</th><th>Previous Value</th><th>New Value</th><th>Location</th><th>Description</th></tr></thead>
              <tbody>{records.map((record, index) => <tr key={`${record.date}-${index}`}>
                <td>{new Date(record.date).toLocaleString()}</td><td>{record.action}</td><td>-</td><td>-</td><td>-</td><td>{formatValue(record.location)}</td><td>{formatValue(record.description)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </>}
    </section>
  );
};

export default ICTAssetHistory;