import React from 'react';

const MaintWorkOrders = () => {
  return (
    <section>
      <h1>Work Orders</h1>
      <div role="status" style={{ padding: '16px', border: '1px solid #d9e2f2', borderRadius: '8px' }}>
        <strong>Not available</strong>
        <p>There is no Maintenance-owned persisted Work Order source. Maintenance Requests are not Work Orders.</p>
      </div>
    </section>
  );
};

export default MaintWorkOrders;