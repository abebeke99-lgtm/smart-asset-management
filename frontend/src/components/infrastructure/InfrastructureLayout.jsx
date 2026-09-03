// ==============================================
// Infrastructure Layout - Simple outlet wrapper
// ==============================================
import { Outlet } from 'react-router-dom';

const InfrastructureLayout = () => {
  return (
    <div style={{ width: '100%' }}>
      {/* No duplicate sidebar/header - main App.jsx handles this */}
      <Outlet />
    </div>
  );
};

export default InfrastructureLayout;
