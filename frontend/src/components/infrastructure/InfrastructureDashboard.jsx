// ==============================================
// Infrastructure Dashboard Component
// ==============================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BarChart3, Building2, Zap, Droplets, Radio, Wrench, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';

const InfrastructureDashboard = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const labels = language === 'am'
    ? { directorate: 'የመሠረተ ልማት ዳይሬክቶሬት', dashboard: 'ዳሽቦርድ', subtitle: 'የዩኒቨርሲቲውን የመሠረተ ልማት ንብረቶች እና ሥርዓቶች ያስተዳድሩ' }
    : { directorate: 'Infrastructure Directorate', dashboard: 'Dashboard', subtitle: 'Manage and monitor all university infrastructure assets and systems' };
  const [stats, setStats] = useState({
    totalAssets: 0,
    buildings: 0,
    electricalSystems: 0,
    generators: 0,
    transformers: 0,
    waterSystems: 0,
    assetsMaintenance: 0,
    openWorkOrders: 0,
    criticalAlerts: 0,
    operationalAssets: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/api/infrastructure');
        const assets = Array.isArray(response.data?.data) ? response.data.data : [];
        const countMatching = (term) => assets.filter((asset) => JSON.stringify(asset).toLowerCase().includes(term)).length;
        const operationalAssets = assets.filter((asset) => String(asset.status || '').toLowerCase() === 'operational').length;
        setStats({
          totalAssets: assets.length,
          buildings: countMatching('building'),
          electricalSystems: countMatching('electrical'),
          generators: countMatching('generator'),
          transformers: countMatching('transformer'),
          waterSystems: countMatching('water'),
          assetsMaintenance: assets.filter((asset) => String(asset.status || '').toLowerCase().includes('maintenance')).length,
          openWorkOrders: 0,
          criticalAlerts: assets.filter((asset) => String(asset.condition || '').toLowerCase() === 'critical').length,
          operationalAssets
        });
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load infrastructure dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const KPICard = ({ icon: Icon, title, value, subtitle, color, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        border: `1px solid ${color}22`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        ':hover': onClick ? { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}
      }}
    >
      <div style={{ background: `${color}10`, padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a365d', marginBottom: '4px' }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{subtitle}</div>}
      </div>
    </div>
  );

  const navigationCards = [
    {
      title: 'Asset Management',
      description: 'Register, track, and manage infrastructure assets',
      icon: Building2,
      color: '#2b6cb0',
      onClick: () => navigate('/infrastructure/assets')
    },
    {
      title: 'Buildings & Facilities',
      description: 'Manage buildings, blocks, floors, and rooms',
      icon: Building2,
      color: '#059669',
      onClick: () => navigate('/infrastructure/buildings')
    },
    {
      title: 'Electrical Systems',
      description: 'Monitor and maintain electrical infrastructure',
      icon: Zap,
      color: '#fbbf24',
      onClick: () => navigate('/infrastructure/electrical')
    },
    {
      title: 'Power Equipment',
      description: 'Generators, transformers, UPS, solar systems',
      icon: Zap,
      color: '#dc2626',
      onClick: () => navigate('/infrastructure/generators')
    },
    {
      title: 'Water Systems',
      description: 'Manage water pumps, tanks, and pipelines',
      icon: Droplets,
      color: '#0891b2',
      onClick: () => navigate('/infrastructure/water')
    },
    {
      title: 'Facility Maintenance',
      description: 'Request and track maintenance work orders',
      icon: Wrench,
      color: '#7c3aed',
      onClick: () => navigate('/infrastructure/maintenance')
    },
    {
      title: 'Work Orders',
      description: 'Create and manage work order assignments',
      icon: Wrench,
      color: '#8b5cf6',
      onClick: () => navigate('/infrastructure/work-orders')
    },
    {
      title: 'Inspection & Tracking',
      description: 'Conduct inspections and track equipment',
      icon: Radio,
      color: '#0ea5e9',
      onClick: () => navigate('/infrastructure/inspection')
    },
    {
      title: 'Reports & Analytics',
      description: 'View infrastructure performance reports',
      icon: BarChart3,
      color: '#06b6d4',
      onClick: () => navigate('/infrastructure/reports')
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {labels.directorate}
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1a365d', margin: '0 0 8px' }}>
          {labels.dashboard}
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          {labels.subtitle}
        </p>
      </div>

      {error && <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}
      {loading && <div style={{ color: '#6b7280', marginBottom: '20px' }}>Loading dashboard data...</div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <KPICard icon={Building2} title="Total Infrastructure Assets" value={stats.totalAssets} color="#2b6cb0" onClick={() => navigate('/infrastructure/assets')} />
        <KPICard icon={Building2} title="Buildings" value={stats.buildings} subtitle="facilities managed" color="#059669" onClick={() => navigate('/infrastructure/buildings')} />
        <KPICard icon={Zap} title="Electrical Systems" value={stats.electricalSystems} subtitle="equipment & circuits" color="#fbbf24" onClick={() => navigate('/infrastructure/electrical')} />
        <KPICard icon={Wrench} title="Under Maintenance" value={stats.assetsMaintenance} subtitle="active maintenance" color="#dc2626" onClick={() => navigate('/infrastructure/maintenance')} />
        <KPICard icon={AlertCircle} title="Open Work Orders" value={stats.openWorkOrders} subtitle="pending assignment" color="#f59e0b" onClick={() => navigate('/infrastructure/work-orders')} />
        <KPICard icon={AlertTriangle} title="Critical Alerts" value={stats.criticalAlerts} subtitle="requires attention" color="#dc2626" />
      </div>

      {/* Infrastructure Categories Grid */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a365d', marginBottom: '16px' }}>
          Infrastructure Categories
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {navigationCards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              style={{
                background: '#ffffff',
                border: `2px solid ${card.color}20`,
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                ':hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: `${card.color}10`, padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <card.icon size={24} color={card.color} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a365d', margin: 0 }}>
                  {card.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0' }}>
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Operational Assets</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#059669' }}>{stats.operationalAssets}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Generators</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#2b6cb0' }}>{stats.generators}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Transformers</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#8b5cf6' }}>{stats.transformers}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Water Systems</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#0891b2' }}>{stats.waterSystems}</div>
        </div>
      </div>
    </div>
  );
};

export default InfrastructureDashboard;
