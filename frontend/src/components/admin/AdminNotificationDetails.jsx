import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bell, CheckCircle2, Mail, MessageSquare, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../utils/api';

const AdminNotificationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await apiClient.get(`/api/admin/notifications/${id}`); setData(response?.data?.data || null); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Unable to load notification details'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  if (loading) return <section className="admin-workspace-page"><div className="admin-card admin-empty-state"><RefreshCw size={20} /> Loading notification...</div></section>;
  if (!data) return <section className="admin-workspace-page"><div className="admin-error-state"><span>{error || 'Notification not found.'}</span><button className="admin-secondary-button" onClick={load}>Retry</button></div></section>;

  return <section className="admin-workspace-page"><div className="admin-breadcrumb"><button className="icon-button" onClick={() => navigate('/admin/notifications')}><ArrowLeft size={16} /></button> System / Notifications / Details</div><div className="admin-page-header"><div><h1 className="admin-page-title">{data.title}</h1><p className="admin-page-subtitle">{data.type} · {data.priority} · {data.status}</p></div><button className="admin-secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button></div><div className="admin-analytics-grid"><div className="admin-card"><h2>Notification information</h2><p>{data.message}</p><p>Created: {data.created_at ? new Date(data.created_at).toLocaleString() : 'Not available'}</p><p>Scheduled: {data.scheduledAt ? new Date(data.scheduledAt).toLocaleString() : 'Not scheduled'}</p><p>Sent: {data.sentAt ? new Date(data.sentAt).toLocaleString() : 'Not sent'}</p></div><div className="admin-card"><h2>Recipient</h2><p>{data.Recipient?.fullName || data.Recipient?.username || data.recipientId || 'Broadcast'}</p><p>{data.Recipient?.email || 'No email available'}</p><p>Read: {data.is_read ? 'Yes' : 'No'}</p></div></div><div className="admin-table-card"><h2 style={{ padding: '18px 18px 0', color: '#1A237E' }}>Delivery results</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Channel</th><th>Provider</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Failure reason</th></tr></thead><tbody>{(data.NotificationDeliveries || data.deliveries || []).map((delivery) => <tr key={delivery.id}><td>{delivery.channel === 'email' ? <Mail size={15} /> : delivery.channel === 'sms' ? <MessageSquare size={15} /> : <Bell size={15} />}</td><td>{delivery.provider || 'Not available'}</td><td>{delivery.status === 'failed' ? <span><XCircle size={15} /> failed</span> : <span><CheckCircle2 size={15} /> {delivery.status}</span>}</td><td>{delivery.sentAt ? new Date(delivery.sentAt).toLocaleString() : 'Not available'}</td><td>{delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleString() : 'Not available'}</td><td>{delivery.errorMessage || '—'}</td></tr>)}</tbody></table></div></div></section>;
};

export default AdminNotificationDetails;
