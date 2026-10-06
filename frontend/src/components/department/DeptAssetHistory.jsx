import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';

const value = (item) => {
  if (item === null || item === undefined || item === '') return '-';
  if (typeof item === 'object') return item.name || item.code || item.fullName || item.username || JSON.stringify(item);
  return String(item);
};

const DeptAssetHistory = () => {
  const { id } = useParams();
  const location = useLocation();
  const assetsPath = location.pathname.startsWith('/college') ? '/college/assets' : '/department/assets';
  const [asset, setAsset] = useState(null);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setAsset(null);
      setEvents([]);
      setState({ loading: false, error: '' });
      return () => { mounted = false; };
    }
    setState({ loading: true, error: '' });
    Promise.all([
      axios.get(`/api/assets/${id}`),
      axios.get(`/api/assets/${id}/history`)
    ]).then(([assetResponse, historyResponse]) => {
      if (!mounted) return;
      const assetData = assetResponse.data?.asset || assetResponse.data?.data || {};
      const records = Array.isArray(historyResponse.data?.history) ? historyResponse.data.history : [];
      setAsset(assetData);
      setEvents(records);
      setState({ loading: false, error: '' });
    }).catch(error => mounted && setState({ loading: false, error: error.response?.status === 403 ? 'This asset is outside your department.' : 'Unable to load asset history.' }));
    return () => { mounted = false; };
  }, [id]);

  if (!id) return <section style={{ padding: 24 }}><h1>📜 Asset History</h1><p>Select an asset from the asset list to view its history.</p><Link to={assetsPath}>Browse assets</Link></section>;
  if (state.loading) return <section style={{ padding: 24 }}><h1>📜 Asset History</h1><p>Loading history...</p></section>;
  if (state.error) return <section style={{ padding: 24 }}><h1>📜 Asset History</h1><p role="alert">{state.error}</p></section>;
  return <section style={{ padding: 24, overflowX: 'auto' }}>
    <h1>📜 Asset History</h1>
    <p><strong>{value(asset?.name)}</strong> · {value(asset?.assetCode || asset?.asset_id || id)}</p>
    {events.length === 0 ? <p>No history records found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th>Date/Time</th><th>Action</th><th>Performed By</th><th>Previous Value</th><th>New Value</th><th>Location</th><th>Description</th></tr></thead>
      <tbody>{events.map((event, index) => <tr key={`${event.date}-${event.type || index}`}><td>{event.date ? new Date(event.date).toLocaleString() : '-'}</td><td>{value(event.action)}</td><td>{value(event.performedBy)}</td><td>{value(event.previousValue)}</td><td>{value(event.newValue)}</td><td>{value(event.location)}</td><td>{value(event.description)}</td></tr>)}</tbody>
    </table>}
  </section>;
};

export default DeptAssetHistory;