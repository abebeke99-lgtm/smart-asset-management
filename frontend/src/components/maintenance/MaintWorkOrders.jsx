import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintWorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([
    { id: 'WO-001', woNumber: 'WO-001', asset: 'Printer A', technician: 'John Doe', status: 'In Progress', priority: 'High', dueDate: '2026-09-05', partsUsed: ['Toner'], laborHours: 2, partsCost: 150, laborCost: 80, totalCost: 230 },
    { id: 'WO-002', woNumber: 'WO-002', asset: 'Server Room AC', technician: 'Jane Smith', status: 'Pending', priority: 'Critical', dueDate: '2026-09-03', partsUsed: ['Compressor', 'Filter'], laborHours: 4, partsCost: 600, laborCost: 160, totalCost: 760 }
  ]);
  const [showForm, setShowForm] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>📋 Work Orders</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Create Work Order</button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Create New Work Order</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input type="text" placeholder="Asset" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="text" placeholder="Technician" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="date" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <select style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option>Select Priority</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
          <textarea placeholder="Diagnosis & Repair" rows="4" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Create</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>WO #</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Priority</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Due Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo) => (
              <tr key={wo.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{wo.woNumber}</td>
                <td style={{ padding: '12px' }}>{wo.asset}</td>
                <td style={{ padding: '12px' }}>{wo.technician}</td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: wo.priority === 'Critical' ? '#fee2e2' : '#fef3c7', color: wo.priority === 'Critical' ? '#991b1b' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>{wo.priority}</span></td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: wo.status === 'In Progress' ? '#dcfce7' : '#dbeafe', color: wo.status === 'In Progress' ? '#166534' : '#075985', fontSize: '0.85rem', fontWeight: '600' }}>{wo.status}</span></td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${wo.totalCost}</td>
                <td style={{ padding: '12px' }}>{wo.dueDate}</td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                  <button style={{ padding: '6px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Total Work Orders: {workOrders.length} | Total Cost: ${workOrders.reduce((sum, wo) => sum + wo.totalCost, 0)}
      </div>
    </div>
  );
};

export default MaintWorkOrders;
