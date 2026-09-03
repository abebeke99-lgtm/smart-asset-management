import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const value = (item) => {
  if (item === null || item === undefined || item === '') return '-';
  if (typeof item === 'object') return item.name || item.code || item.fullName || item.username || '-';
  return String(item);
};

const DeptAssetHistory = () => {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let mounted = true;
    Promise.all([
      axios.get(`/api/assets/${id}`),
      axios.get(`/api/assets/${id}/assignments`),
      axios.get(`/api/assets/${id}/maintenance`),
      axios.get(`/api/rfid/history/${id}`)
    ]).then(([assetResponse, assignmentsResponse, maintenanceResponse, rfidResponse]) => {
      if (!mounted) return;
      const assetData = assetResponse.data?.asset || {};
      const records = [
        { action: 'Created', date: assetData.createdAt || assetData.created_at, description: 'Asset registered' },
        ...(assignmentsResponse.data?.history || []).map(item => ({ action: item.status === 'returned' ? 'Returned' : 'Assigned', date: item.createdAt || item.created_at, description: item.notes || item.remarks })),
        ...(maintenanceResponse.data?.history || []).map(item => ({ action: `Maintenance: ${item.status || 'Updated'}`, date: item.updatedAt || item.updated_at || item.createdAt, description: item.problem || item.description })),
        ...(rfidResponse.data?.logs || []).map(item => ({ action: 'RFID Scanned', date: item.timestamp || item.createdAt, description: item.event || item.type, location: item.location || item.reader_location }))
      ].filter(item => item.date).sort((a, b) => new Date(b.date) - new Date(a.date));
      setAsset(assetData);
      setEvents(records);
      setState({ loading: false, error: '' });
    }).catch(error => mounted && setState({ loading: false, error: error.response?.status === 403 ? 'This asset is outside your department.' : 'Unable to load asset history.' }));
    return () => { mounted = false; };
  }, [id]);

  if (state.loading) return <section style={{ padding: 24 }}><h1>📜 Asset History</h1><p>Loading history...</p></section>;
  if (state.error) return <section style={{ padding: 24 }}><h1>📜 Asset History</h1><p role="alert">{state.error}</p></section>;
  return <section style={{ padding: 24, overflowX: 'auto' }}>
    <h1>📜 Asset History</h1>
    <p><strong>{value(asset?.name)}</strong> · {value(asset?.assetCode || asset?.asset_id || id)}</p>
    {events.length === 0 ? <p>No history records found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th>Date/Time</th><th>Action</th><th>Performed By</th><th>Previous Value</th><th>New Value</th><th>Location</th><th>Description</th></tr></thead>
      <tbody>{events.map((event, index) => <tr key={`${event.date}-${index}`}><td>{new Date(event.date).toLocaleString()}</td><td>{event.action}</td><td>-</td><td>-</td><td>-</td><td>{value(event.location)}</td><td>{value(event.description)}</td></tr>)}</tbody>
    </table>}
  </section>;
};

export default DeptAssetHistory;