import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Folder, LayoutDashboard, Package, Settings, Shield, Users, Files } from 'lucide-react';

const iconMap = {
  dashboard: LayoutDashboard,
  assets: Package,
  categories: Folder,
  documents: FileText,
  files: Files,
  users: Users,
  roles: Shield,
  reports: BarChart3,
  settings: Settings,
};

const DashboardSidebar = ({ items = [], isOpen = false, onClose, user, roleLabel }) => {
  const location = useLocation();

  const currentPath = location.pathname;

  const renderItem = (item) => {
    const Icon = iconMap[item.iconKey] || LayoutDashboard;
    const isActive = currentPath === item.to || currentPath.startsWith(`${item.to}/`);

    return (
      <Link
        key={item.to}
        to={item.to}
        className={`admin-nav-link${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={onClose}
      >
        <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className={`admin-sidebar${isOpen ? ' is-open' : ''}`} style={{
      background: '#9FAAB5',
      width: '260px',
      borderRight: '1px solid rgba(23, 33, 43, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }}>
      <div className="admin-sidebar-profile">
        <div className="sidebar-avatar" aria-hidden="true">{(user?.fullName || user?.username || 'A').charAt(0).toUpperCase()}</div>
        <div className="sidebar-user-name">{user?.fullName || user?.username || 'Admin'}</div>
        <div className="sidebar-role">{roleLabel || 'Dashboard'}</div>
        <div className="sidebar-status"><span /> Online</div>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Dashboard navigation">
        {items.map((group) => (
          <div key={group.title}>
            <div className="sidebar-section-label">{group.title}</div>
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
