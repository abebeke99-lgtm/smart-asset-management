import React from 'react';
import { Outlet } from 'react-router-dom';
import './MaintenanceLayout.css';

const MaintenanceLayout = () => {
  return (
    <div className="maintenance-layout-container">
      <div className="maintenance-main-content">
        <Outlet />
      </div>
    </div>
  );
};

export default MaintenanceLayout;
