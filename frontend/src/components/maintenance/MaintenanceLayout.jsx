import React from 'react';
import { Outlet } from 'react-router-dom';
import './MaintenanceLayout.css';

const MaintenanceLayout = () => {
  return (
    <div className="maintenance-layout-container">
      <main className="maintenance-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MaintenanceLayout;
