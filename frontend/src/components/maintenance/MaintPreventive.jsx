import React from 'react';

const MaintPreventive = () => {
  return (
    <section>
      <h1>Preventive Maintenance Schedules</h1>
      <div role="status" style={{ padding: '16px', border: '1px solid #d9e2f2', borderRadius: '8px' }}>
        <strong>Not available</strong>
        <p>There is no Maintenance-owned persisted schedule source. Maintenance Requests are not Schedules.</p>
      </div>
    </section>
  );
};

export default MaintPreventive;