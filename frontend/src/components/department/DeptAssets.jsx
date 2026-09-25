import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  History,
  MapPin,
  Package2,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';

const DeptAssets = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMaintenance, setFilterMaintenance] = useState('');

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionData, setActionData] = useState({});
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;
  const isAssignmentView = location.pathname.includes('/assignments');
  const historyBasePath = location.pathname.startsWith('/college') ? '/college/history' : '/department/history';

  const normalizeAssignmentRows = (rows = []) => rows.map((assignment) => ({
    ...assignment,
    id: assignment.id,
    asset_tag: assignment.asset_tag || assignment.assetTag || assignment.asset_code || assignment.assetCode || `AST-${assignment.id || ''}`,
    name: assignment.asset_name || assignment.assetName || assignment.asset?.name || assignment.Asset?.name || 'Unnamed asset',
    category_name: assignment.asset_category || assignment.assetCategory || assignment.asset?.category || assignment.Asset?.category || '',
    status: assignment.status || 'active',
    condition: assignment.condition || assignment.condition_at_assignment || assignment.asset?.condition || assignment.Asset?.condition || 'Good',
    location: assignment.location || assignment.asset_location || assignment.asset?.location || assignment.Asset?.location || 'Not specified',
    assigned_to_name: assignment.assigned_to_name || assignment.assignedToName || assignment.user?.fullName || assignment.User?.fullName || 'Unassigned',
    assignment_date: assignment.assigned_date || assignment.assignedDate || assignment.createdAt,
    department_name: assignment.department_name || assignment.departmentName || assignment.department || assignment.Asset?.department || '',
    current_value: assignment.current_value || assignment.currentValue || assignment.asset?.current_value || assignment.Asset?.current_value || 0,
    maintenance_status: assignment.maintenance_status || assignment.asset?.maintenance_status || 'None',
    serial_number: assignment.serial_number || assignment.asset?.serial_number || assignment.Asset?.serial_number || '',
    last_maintenance_date: assignment.last_maintenance_date || assignment.asset?.last_maintenance_date || assignment.Asset?.last_maintenance_date || '',
  }));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [location.search]);

  useEffect(() => {
    fetchAssets();
  }, [search, filterStatus, filterCategory, filterCondition, filterLocation, filterEmployee, filterMaintenance]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {
        department: user?.department || user?.department_name || undefined,
        limit: 500,
        search: search || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        location: filterLocation || undefined,
        assigned_to: filterEmployee || undefined,
        maintenance_status: filterMaintenance || undefined,
      };

      if (isAssignmentView) {
        const response = await axios.get('/api/assignments', { params: { ...params, page: 1 } });
        const rows = response.data?.assignments || response.data?.data || [];
        setAssets(normalizeAssignmentRows(rows));
        setLoading(false);
        return;
      }

      const response = await axios.get('/api/assets', { params });
      setAssets(response.data.assets || response.data.data || []);
    } catch (error) {
      console.error('Department assets fetch error:', error);
      toast.error(t.fetchError || 'Failed to load assets');
      setAssets([]);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      'In-Use': '#48bb78',
      Available: '#4299e1',
      'Under-Maintenance': '#ed8936',
      'In-Repair': '#fc8181',
      Disposed: '#a0aec0',
      Lost: '#fc8181',
      Reserved: '#805ad5',
    };
    return colors[status] || '#a0aec0';
  };

  const getConditionColor = (condition) => {
    const colors = {
      Good: '#48bb78',
      Fair: '#f6ad55',
      Poor: '#ed8936',
      Damaged: '#fc8181',
    };
    return colors[condition] || '#a0aec0';
  };

  const getMaintenanceStatusColor = (status) => {
    const colors = {
      None: '#a0aec0',
      Pending: '#ed8936',
      'In-Progress': '#4299e1',
      Completed: '#48bb78',
    };
    return colors[status] || '#a0aec0';
  };

  const summaryStats = useMemo(() => {
    const total = assets.length;
    const inUse = assets.filter((asset) => String(asset.status || '').toLowerCase() === 'in-use').length;
    const available = assets.filter((asset) => String(asset.status || '').toLowerCase() === 'available').length;
    const maintenance = assets.filter((asset) => String(asset.status || '').toLowerCase() === 'under-maintenance' || String(asset.maintenance_status || '').toLowerCase() === 'pending' || String(asset.maintenance_status || '').toLowerCase() === 'in-progress').length;
    const damaged = assets.filter((asset) => String(asset.condition || '').toLowerCase() === 'damaged').length;

    return { total, inUse, available, maintenance, damaged };
  }, [assets]);

  const quickFilters = [
    { value: '', label: t.allStatus, icon: Package2 },
    { value: 'Available', label: t.available, icon: CheckCircle2 },
    { value: 'In-Use', label: t.inUse, icon: UserRound },
    { value: 'Under-Maintenance', label: t.underMaintenance, icon: Wrench },
    { value: 'In-Repair', label: t.inRepair, icon: AlertTriangle },
  ];

  const handleAssetClick = async (asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);

    try {
      const response = await axios.get(`/api/assignments/history/${asset.id}`);
      setAssignmentHistory(response.data.history || []);
    } catch (error) {
      setAssignmentHistory([]);
    }

    try {
      const response = await axios.get('/api/maintenance', { params: { asset_id: asset.id } });
      setMaintenanceHistory(response.data.history || response.data.requests || response.data.data || []);
    } catch (error) {
      setMaintenanceHistory([]);
    }
  };

  const handleAction = (type, asset) => {
    setSelectedAsset(asset);
    setActionType(type);
    setActionData({});
    setShowActionModal(true);
  };

  const submitAction = async () => {
    try {
      if (actionType === 'request_maintenance') {
        if (!actionData.description?.trim()) {
          toast.error('Please describe the maintenance problem.');
          return;
        }
        await axios.post('/api/maintenance', {
          asset_id: selectedAsset.id,
          title: actionData.type || 'Maintenance request',
          description: actionData.description.trim(),
          priority: actionData.priority || 'medium',
        });
      } else if (actionType === 'report_damaged') {
        await axios.post('/api/approvals', {
          asset_id: selectedAsset.id,
          type: 'Asset Damage Report',
          item: selectedAsset.name,
          quantity: 1,
          priority: actionData.severity === 'Critical' ? 'critical' : 'high',
          reason: `${actionData.severity || 'Damaged asset'}: ${actionData.description || 'Damage reported by department'}`,
        });
      } else {
        await axios.post('/api/approvals', {
          asset_id: selectedAsset.id,
          type: actionType === 'request_transfer' ? 'Asset Transfer' : 'Asset Request',
          item: selectedAsset.name,
          quantity: 1,
          reason: actionData.reason || actionData.target || 'Department asset request',
        });
      }
      toast.success(t.actionSuccess || 'Action completed successfully');
      setShowActionModal(false);
      fetchAssets();
    } catch (error) {
      toast.error(t.actionError || 'Failed to perform action');
    }
  };

  const exportToExcel = () => {
    const data = assets.map((a) => ({
      'Asset Tag': a.asset_tag || '',
      Name: a.name || '',
      Category: a.category_name || '',
      'Serial Number': a.serial_number || '',
      Status: a.status || '',
      Condition: a.condition || '',
      Location: a.location || '',
      'Assigned To': a.assigned_to_name || '',
      'Assignment Date': a.assignment_date ? new Date(a.assignment_date).toLocaleDateString() : '',
      'Maintenance Status': a.maintenance_status || 'None',
      'Last Maintenance': a.last_maintenance_date ? new Date(a.last_maintenance_date).toLocaleDateString() : '',
      Value: a.current_value || 0,
      'Is Damaged': a.is_damaged ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAssignmentView ? 'Department Assignments' : 'Department Assets');
    XLSX.writeFile(wb, isAssignmentView ? 'department_assignments.xlsx' : 'department_assets.xlsx');
    toast.success(t.exportSuccess || 'Exported successfully');
  };

  const uniqueCategories = useMemo(
    () => [...new Set(assets.map((a) => a.category_name).filter(Boolean))],
    [assets],
  );
  const uniqueLocations = useMemo(
    () => [...new Set(assets.map((a) => a.location).filter(Boolean))],
    [assets],
  );
  const uniqueEmployees = useMemo(
    () => [...new Set(assets.map((a) => a.assigned_to_name).filter(Boolean))],
    [assets],
  );

  const styles = {
    container: {
      padding: '24px',
      maxWidth: '1600px',
      margin: '0 auto',
      background: isDark ? '#0d1a2e' : '#f3f7fb',
      minHeight: '100vh',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px',
    },
    title: {
      color: isDark ? '#eaf3ff' : '#12263f',
      fontSize: '2rem',
      fontWeight: 700,
      margin: '0 0 6px',
      letterSpacing: '-0.02em',
    },
    subtitle: {
      color: isDark ? '#b7c7dc' : '#4a5d76',
      fontSize: '0.96rem',
      margin: 0,
    },
    headerActions: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginTop: '8px',
    },
    exportButton: {
      background: 'linear-gradient(135deg, #34d399, #10b981)',
      color: 'white',
      padding: '10px 18px',
      borderRadius: '12px',
      border: 'none',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '0.9rem',
      boxShadow: '0 10px 22px rgba(16, 185, 129, 0.22)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    },
    controls: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '18px',
      background: isDark ? '#14263d' : '#ffffff',
      borderRadius: '18px',
      border: `1px solid ${isDark ? '#2c4464' : '#dfeaf6'}`,
      marginBottom: '20px',
      alignItems: 'center',
      boxShadow: isDark ? '0 12px 28px rgba(3, 7, 18, 0.32)' : '0 12px 28px rgba(15, 23, 42, 0.06)',
    },
    input: {
      padding: '10px 14px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#324b69' : '#d7e4f2'}`,
      background: isDark ? '#0f1d2f' : '#f8fbff',
      color: isDark ? '#eaf3ff' : '#12263f',
      fontSize: '0.92rem',
      minWidth: '220px',
      flex: '1 1 220px',
      outline: 'none',
    },
    select: {
      padding: '10px 12px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#324b69' : '#d7e4f2'}`,
      background: isDark ? '#0f1d2f' : '#f8fbff',
      color: isDark ? '#eaf3ff' : '#12263f',
      fontSize: '0.9rem',
      cursor: 'pointer',
      minWidth: '150px',
      flex: '1 1 150px',
      outline: 'none',
    },
    clearButton: {
      padding: '10px 16px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#324b69' : '#d7e4f2'}`,
      background: isDark ? '#0f1d2f' : '#f4f7fb',
      color: isDark ? '#c0d3ea' : '#48617f',
      cursor: 'pointer',
      fontSize: '0.87rem',
      fontWeight: 600,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: isDark ? '#14263d' : '#ffffff',
      borderRadius: '18px',
      overflow: 'hidden',
      boxShadow: isDark ? '0 12px 28px rgba(3, 7, 18, 0.28)' : '0 12px 28px rgba(15, 23, 42, 0.06)',
    },
    th: {
      padding: '12px 14px',
      textAlign: 'left',
      color: isDark ? '#dfeeff' : '#1f3a5f',
      fontWeight: 700,
      borderBottom: `2px solid ${isDark ? '#2c4464' : '#e5eef8'}`,
      background: isDark ? '#0f1d2f' : '#f8fbff',
      fontSize: '0.74rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '12px 14px',
      borderBottom: `1px solid ${isDark ? '#2c4464' : '#edf3fb'}`,
      color: isDark ? '#edf4ff' : '#1b2d43',
      fontSize: '0.88rem',
      verticalAlign: 'middle',
    },
    clickableRow: {
      cursor: 'pointer',
      transition: 'background 0.2s ease',
    },
    statusBadge: (status) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '0.73rem',
      fontWeight: 700,
      background: `${getStatusColor(status)}22`,
      color: getStatusColor(status),
      border: `1px solid ${getStatusColor(status)}33`,
      letterSpacing: '0.02em',
    }),
    conditionBadge: (condition) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '0.73rem',
      fontWeight: 700,
      background: `${getConditionColor(condition)}22`,
      color: getConditionColor(condition),
      border: `1px solid ${getConditionColor(condition)}33`,
      letterSpacing: '0.02em',
    }),
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#b7c7dc' : '#4a5d76',
    },
    assetTag: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      background: isDark ? '#243d5d' : '#eaf3ff',
      borderRadius: '8px',
      fontSize: '0.78rem',
      fontWeight: 700,
      color: isDark ? '#dfeeff' : '#1f3a5f',
      border: `1px solid ${isDark ? '#355d8f' : '#d5e6f8'}`,
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.68)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(4px)',
    },
    modalContent: {
      background: isDark ? '#14263d' : '#ffffff',
      borderRadius: '20px',
      padding: '28px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
      border: `1px solid ${isDark ? '#2c4464' : '#e5eef8'}`,
      boxShadow: isDark ? '0 18px 42px rgba(8, 15, 28, 0.45)' : '0 18px 42px rgba(19, 34, 59, 0.14)',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      gap: '12px',
    },
    modalTitle: {
      color: isDark ? '#eaf3ff' : '#12263f',
      fontSize: '1.4rem',
      fontWeight: 700,
      margin: 0,
    },
    modalClose: {
      background: 'transparent',
      border: 'none',
      fontSize: '1.5rem',
      color: isDark ? '#b7c7dc' : '#48617f',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '8px',
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      marginBottom: '20px',
    },
    detailItem: {
      padding: '12px',
      background: isDark ? '#0f1d2f' : '#f8fbff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#2c4464' : '#e7eef8'}`,
    },
    detailLabel: {
      color: isDark ? '#8ca5c8' : '#5a6f8d',
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontWeight: 700,
    },
    detailValue: {
      color: isDark ? '#edf4ff' : '#1b2d43',
      fontSize: '1rem',
      fontWeight: 600,
      marginTop: '4px',
    },
    actionButtons: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: '16px',
    },
    actionButton: (color) => ({
      padding: '8px 14px',
      borderRadius: '10px',
      border: 'none',
      background: color || 'linear-gradient(135deg, #4299e1, #3182ce)',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.84rem',
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    }),
    historyList: {
      maxHeight: '200px',
      overflow: 'auto',
    },
    historyItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: `1px solid ${isDark ? '#2c4464' : '#edf3fb'}`,
      fontSize: '0.85rem',
      gap: '12px',
    },
    actionModalContent: {
      background: isDark ? '#14263d' : '#ffffff',
      borderRadius: '20px',
      padding: '28px',
      maxWidth: '520px',
      width: '100%',
      border: `1px solid ${isDark ? '#2c4464' : '#e5eef8'}`,
      boxShadow: isDark ? '0 18px 42px rgba(8, 15, 28, 0.45)' : '0 18px 42px rgba(19, 34, 59, 0.14)',
    },
    formGroup: {
      marginBottom: '16px',
    },
    formLabel: {
      color: isDark ? '#8ca5c8' : '#5a6f8d',
      fontSize: '0.8rem',
      fontWeight: 700,
      display: 'block',
      marginBottom: '6px',
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#324b69' : '#d7e4f2'}`,
      background: isDark ? '#0f1d2f' : '#ffffff',
      color: isDark ? '#edf4ff' : '#1b2d43',
      fontSize: '0.9rem',
      outline: 'none',
      boxSizing: 'border-box',
    },
    formTextarea: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#324b69' : '#d7e4f2'}`,
      background: isDark ? '#0f1d2f' : '#ffffff',
      color: isDark ? '#edf4ff' : '#1b2d43',
      fontSize: '0.9rem',
      outline: 'none',
      minHeight: '88px',
      resize: 'vertical',
      boxSizing: 'border-box',
    },
    modalActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '20px',
      justifyContent: 'flex-end',
    },
    buttonPrimary: {
      padding: '10px 20px',
      background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '0.9rem',
    },
    buttonSecondary: {
      padding: '10px 18px',
      background: isDark ? '#263d5d' : '#edf3fc',
      color: isDark ? '#edf4ff' : '#1b2d43',
      border: 'none',
      borderRadius: '10px',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '0.9rem',
    },
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterCondition('');
    setFilterLocation('');
    setFilterEmployee('');
    setFilterMaintenance('');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: t.totalAssets, value: summaryStats.total, icon: Package2, accent: '#60a5fa' },
    { label: t.inUse, value: summaryStats.inUse, icon: CheckCircle2, accent: '#34d399' },
    { label: t.available, value: summaryStats.available, icon: ShieldCheck, accent: '#38bdf8' },
    { label: t.underMaintenance, value: summaryStats.maintenance, icon: Wrench, accent: '#f59e0b' },
  ];

  return (
    <div style={styles.container}>
      <style>{`
        .dept-assets-shell {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .dept-assets-shell * {
          box-sizing: border-box;
        }
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .metric-card {
          background: ${isDark ? '#14263d' : '#ffffff'};
          border: 1px solid ${isDark ? '#2c4464' : '#e5eef8'};
          border-radius: 18px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: ${isDark ? '0 12px 28px rgba(3, 7, 18, 0.28)' : '0 12px 28px rgba(15, 23, 42, 0.06)'};
        }
        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .metric-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .metric-label {
          color: ${isDark ? '#9bb5d5' : '#5a6f8d'};
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .metric-value {
          color: ${isDark ? '#edf4ff' : '#12263f'};
          font-size: 1.7rem;
          font-weight: 800;
          line-height: 1;
        }
        .pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          border: 1px solid ${isDark ? '#2c4464' : '#d9e9f9'};
          background: ${isDark ? '#0f1d2f' : '#f8fbff'};
          color: ${isDark ? '#dfeeff' : '#1f3a5f'};
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .status-pill.active {
          background: linear-gradient(135deg, rgba(96,165,250,0.2), rgba(37,99,235,0.12));
          border-color: rgba(96,165,250,0.8);
          color: ${isDark ? '#dfeeff' : '#1d4ed8'};
        }
        .section-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: ${isDark ? '#102038' : '#edf5ff'};
          border: 1px solid ${isDark ? '#2d4a6d' : '#dfeeff'};
          color: ${isDark ? '#dfeeff' : '#1f3a5f'};
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          width: fit-content;
        }
        @media (max-width: 768px) {
          .metric-card {
            padding: 16px;
          }
          .metric-value {
            font-size: 1.4rem;
          }
        }
      `}</style>

      <div className="dept-assets-shell">
        <div style={styles.header}>
          <div>
            <div className="section-tag">
              <Sparkles size={14} /> {isAssignmentView ? 'Assignments' : t.assets}
            </div>
            <h1 style={styles.title}>{isAssignmentView ? 'Asset Assignments' : t.assets}</h1>
            <p style={styles.subtitle}>
              {isAssignmentView ? 'Department assignment records for' : t.departmentAssets} <strong>{user?.department || 'Department'}</strong>
              <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#a7bad4' : '#5a6f8d' }}>
                {assets.length} {isAssignmentView ? 'records' : t.totalAssets}
              </span>
            </p>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.exportButton} onClick={exportToExcel}>
              <Download size={16} /> {t.exportExcel}
            </button>
          </div>
        </div>

        <div className="overview-grid">
          {metricCards.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="metric-card">
              <div className="metric-icon" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
                <Icon size={18} />
              </div>
              <div className="metric-copy">
                <span className="metric-label">{label}</span>
                <span className="metric-value">{value}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.controls}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: '1 1 260px' }}>
            <div style={{ color: isDark ? '#a7bad4' : '#5a6f8d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={18} />
            </div>
            <input
              type="text"
              style={styles.input}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select style={styles.select} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">{t.allCategories}</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select style={styles.select} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
            <option value="">{t.allConditions}</option>
            <option value="Good">{t.good}</option>
            <option value="Fair">{t.fair}</option>
            <option value="Poor">{t.poor}</option>
            <option value="Damaged">{t.damaged}</option>
          </select>

          <select style={styles.select} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">{t.allLocations}</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select style={styles.select} value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
            <option value="">{t.allEmployees}</option>
            {uniqueEmployees.map((emp) => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>

          <button style={styles.clearButton} onClick={clearFilters}>
            <X size={14} /> {t.clearFilters}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: isDark ? '#a7bad4' : '#5a6f8d', fontWeight: 700, fontSize: '0.82rem' }}>
            <ArrowUpDown size={14} /> {t.allStatus}
          </div>
          <div className="pill-row">
            {quickFilters.map(({ value, label, icon: Icon }) => {
              const isActive = filterStatus === value;
              return (
                <button
                  key={label}
                  type="button"
                  className={`status-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setFilterStatus(value)}
                  style={{
                    opacity: value === '' && !filterStatus ? 1 : undefined,
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.assetTag}</th>
                <th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.category}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.condition}</th>
                <th style={styles.th}>{t.location}</th>
                <th style={styles.th}>{t.assignedTo}</th>
                <th style={styles.th}>{t.maintenance}</th>
                <th style={styles.th}>{t.value}</th>
                <th style={styles.th}>{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                    {t.noAssets}
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    style={styles.clickableRow}
                    onClick={() => handleAssetClick(asset)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={styles.td}><span style={styles.assetTag}>{asset.asset_tag}</span></td>
                    <td style={styles.td}>{asset.name}</td>
                    <td style={styles.td}>{asset.category_name || '-'}</td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(asset.status)}>{asset.status}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.conditionBadge(asset.condition)}>{asset.condition || 'Unknown'}</span>
                    </td>
                    <td style={styles.td}>{asset.location || '-'}</td>
                    <td style={styles.td}>
                      {asset.assigned_to_name ? (
                        <div>
                          <div>{asset.assigned_to_name}</div>
                          {asset.assignment_date && (
                            <div style={{ fontSize: '0.7rem', color: isDark ? '#9bb5d5' : '#5a6f8d' }}>
                              {new Date(asset.assignment_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={styles.td}>
                      {asset.maintenance_status && asset.maintenance_status !== 'None' ? (
                        <span
                          style={{
                            ...styles.statusBadge(asset.maintenance_status),
                            background: `${getMaintenanceStatusColor(asset.maintenance_status)}22`,
                            color: getMaintenanceStatusColor(asset.maintenance_status),
                          }}
                        >
                          {asset.maintenance_status}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={styles.td}>${(asset.current_value || 0).toLocaleString()}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssetClick(asset);
                        }}
                        style={{
                          background: isDark ? '#213b57' : '#edf5ff',
                          border: `1px solid ${isDark ? '#375a8d' : '#dfeeff'}`,
                          color: isDark ? '#dfeeff' : '#1f3a5f',
                          borderRadius: '10px',
                          padding: '7px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                        }}
                      >
                        <Eye size={14} /> {t.view}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedAsset.asset_tag} - {selectedAsset.name}</h2>
                <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedAsset.category_name} • {selectedAsset.department_name}
                </div>
              </div>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}><X size={18} /></button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}><span style={styles.statusBadge(selectedAsset.status)}>{selectedAsset.status}</span></div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.condition}</div>
                <div style={styles.detailValue}><span style={styles.conditionBadge(selectedAsset.condition)}>{selectedAsset.condition || 'Unknown'}</span></div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.location}</div>
                <div style={styles.detailValue}>{selectedAsset.location || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.serialNumber}</div>
                <div style={styles.detailValue}>{selectedAsset.serial_number || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assignedTo}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.assigned_to_name || 'Not assigned'}
                  {selectedAsset.assignment_date && (
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#9bb5d5' : '#5a6f8d', marginTop: '4px' }}>
                      Since {new Date(selectedAsset.assignment_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.value}</div>
                <div style={styles.detailValue}>${(selectedAsset.current_value || 0).toLocaleString()}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.lastMaintenance}</div>
                <div style={styles.detailValue}>{selectedAsset.last_maintenance_date ? new Date(selectedAsset.last_maintenance_date).toLocaleDateString() : 'Never'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.maintenanceStatus}</div>
                <div style={styles.detailValue}>
                  <span style={{ ...styles.statusBadge(selectedAsset.maintenance_status || 'None'), background: `${getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None')}22`, color: getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None') }}>
                    {selectedAsset.maintenance_status || 'None'}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.actionButtons}>
              <button style={styles.actionButton('#48bb78')} onClick={() => handleAction('request_transfer', selectedAsset)}><Building2 size={15} /> {t.requestTransfer}</button>
              <button style={styles.actionButton('#ed8936')} onClick={() => handleAction('request_maintenance', selectedAsset)}><Wrench size={15} /> {t.requestMaintenance}</button>
              <button style={styles.actionButton('#fc8181')} onClick={() => handleAction('report_damaged', selectedAsset)}><AlertTriangle size={15} /> {t.reportDamaged}</button>
              <button style={styles.actionButton('#805ad5')} onClick={() => handleAction('request_asset', selectedAsset)}><MapPin size={15} /> {t.requestAsset}</button>
              <button style={styles.actionButton('#2b6cb0')} onClick={() => navigate(`${historyBasePath}/${selectedAsset.id}`)}><History size={15} /> Full history</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: isDark ? '#eaf3ff' : '#12263f', marginBottom: '8px' }}>{t.assignmentHistory}</h4>
              <div style={styles.historyList}>
                {assignmentHistory.length === 0 ? (
                  <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', padding: '8px 0' }}>{t.noHistory}</div>
                ) : assignmentHistory.map((item, index) => (
                  <div key={index} style={styles.historyItem}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.employee || item.user || 'Unknown'}</span>
                      <span style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', marginLeft: '8px' }}>{item.action || 'Updated'}</span>
                    </div>
                    <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{new Date(item.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ color: isDark ? '#eaf3ff' : '#12263f', marginBottom: '8px' }}>{t.maintenanceHistory}</h4>
              <div style={styles.historyList}>
                {maintenanceHistory.length === 0 ? (
                  <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', padding: '8px 0' }}>{t.noMaintenanceHistory}</div>
                ) : maintenanceHistory.map((item, index) => (
                  <div key={index} style={styles.historyItem}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.type || 'Maintenance'}</span>
                      <span style={{ ...styles.statusBadge(item.status), background: `${getMaintenanceStatusColor(item.status)}22`, color: getMaintenanceStatusColor(item.status), marginLeft: '8px' }}>{item.status}</span>
                    </div>
                    <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{new Date(item.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showActionModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowActionModal(false)}>
          <div style={styles.actionModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {actionType === 'request_transfer' && '📤 ' + t.requestTransfer}
                {actionType === 'request_maintenance' && '🔧 ' + t.requestMaintenance}
                {actionType === 'report_damaged' && '⚠️ ' + t.reportDamaged}
                {actionType === 'request_asset' && '📋 ' + t.requestAsset}
              </h2>
              <button style={styles.modalClose} onClick={() => setShowActionModal(false)}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '18px', color: isDark ? '#9bb5d5' : '#5a6f8d' }}>
              {t.asset}: <strong>{selectedAsset.asset_tag} - {selectedAsset.name}</strong>
            </div>

            {actionType === 'request_transfer' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t.transferTo}</label>
                <input type="text" style={styles.formInput} placeholder={t.enterEmployeeName} value={actionData.target || ''} onChange={(e) => setActionData({ ...actionData, target: e.target.value })} />
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.reason}</label>
                  <textarea style={styles.formTextarea} placeholder={t.transferReasonPlaceholder} value={actionData.reason || ''} onChange={(e) => setActionData({ ...actionData, reason: e.target.value })} />
                </div>
              </div>
            )}

            {actionType === 'request_maintenance' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.maintenanceType}</label>
                  <select style={styles.formInput} value={actionData.type || ''} onChange={(e) => setActionData({ ...actionData, type: e.target.value })}>
                    <option value="">{t.selectType}</option>
                    <option value="Routine">{t.routine}</option>
                    <option value="Repair">{t.repair}</option>
                    <option value="Emergency">{t.emergency}</option>
                    <option value="Preventive">{t.preventive}</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.description}</label>
                  <textarea style={styles.formTextarea} placeholder={t.maintenanceDescriptionPlaceholder} value={actionData.description || ''} onChange={(e) => setActionData({ ...actionData, description: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Priority</label>
                  <select style={styles.formInput} value={actionData.priority || 'medium'} onChange={(e) => setActionData({ ...actionData, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            )}

            {actionType === 'report_damaged' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.damageSeverity}</label>
                  <select style={styles.formInput} value={actionData.severity || ''} onChange={(e) => setActionData({ ...actionData, severity: e.target.value })}>
                    <option value="">{t.selectSeverity}</option>
                    <option value="Minor">{t.minor}</option>
                    <option value="Moderate">{t.moderate}</option>
                    <option value="Major">{t.major}</option>
                    <option value="Critical">{t.critical}</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.damageDescription}</label>
                  <textarea style={styles.formTextarea} placeholder={t.damageDescriptionPlaceholder} value={actionData.description || ''} onChange={(e) => setActionData({ ...actionData, description: e.target.value })} />
                </div>
              </div>
            )}

            {actionType === 'request_asset' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.requestReason}</label>
                  <textarea style={styles.formTextarea} placeholder={t.requestReasonPlaceholder} value={actionData.reason || ''} onChange={(e) => setActionData({ ...actionData, reason: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.requiredBy}</label>
                  <input type="date" style={styles.formInput} value={actionData.requiredBy || ''} onChange={(e) => setActionData({ ...actionData, requiredBy: e.target.value })} />
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button style={styles.buttonSecondary} onClick={() => setShowActionModal(false)}>{t.cancel}</button>
              <button style={styles.buttonPrimary} onClick={submitAction}>{t.submit}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  assets: 'Department Assets',
  departmentAssets: 'Assets for',
  searchPlaceholder: 'Search by name or tag...',
  allStatus: 'All Status',
  inUse: 'In-Use',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  inRepair: 'In Repair',
  disposed: 'Disposed',
  allCategories: 'All Categories',
  allConditions: 'All Conditions',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  allLocations: 'All Locations',
  allEmployees: 'All Employees',
  clearFilters: 'Clear Filters',
  search: 'Search',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  status: 'Status',
  condition: 'Condition',
  location: 'Location',
  assignedTo: 'Assigned To',
  value: 'Value',
  maintenance: 'Maintenance',
  loading: 'Loading...',
  noAssets: 'No assets found in this department',
  exportExcel: 'Export to Excel',
  fetchError: 'Failed to load assets',
  exportSuccess: 'Exported successfully',
  totalAssets: 'Total Assets',
  serialNumber: 'Serial Number',
  lastMaintenance: 'Last Maintenance',
  maintenanceStatus: 'Maintenance Status',
  assignmentHistory: 'Assignment History',
  maintenanceHistory: 'Maintenance History',
  noHistory: 'No assignment history',
  noMaintenanceHistory: 'No maintenance history',
  view: 'View',
  action: 'Action',
  asset: 'Asset',

  // Actions
  requestTransfer: 'Request Transfer',
  requestMaintenance: 'Request Maintenance',
  reportDamaged: 'Report Damaged',
  requestAsset: 'Request Asset',
  transferTo: 'Transfer To',
  reason: 'Reason',
  transferReasonPlaceholder: 'Enter reason for transfer...',
  maintenanceType: 'Maintenance Type',
  selectType: 'Select Type',
  routine: 'Routine',
  repair: 'Repair',
  emergency: 'Emergency',
  preventive: 'Preventive',
  description: 'Description',
  maintenanceDescriptionPlaceholder: 'Describe the maintenance required...',
  damageSeverity: 'Damage Severity',
  selectSeverity: 'Select Severity',
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  critical: 'Critical',
  damageDescription: 'Damage Description',
  damageDescriptionPlaceholder: 'Describe the damage...',
  requestReason: 'Request Reason',
  requestReasonPlaceholder: 'Why do you need this asset?',
  requiredBy: 'Required By',
  cancel: 'Cancel',
  submit: 'Submit',
  actionSuccess: 'Action completed successfully',
  actionError: 'Failed to perform action',
  enterEmployeeName: 'Enter employee name...'
};

const amharicTranslations = {
  assets: 'የክፍል ንብረቶች',
  departmentAssets: 'ንብረቶች ለ',
  searchPlaceholder: 'በስም ወይም በመለያ ይፈልጉ...',
  allStatus: 'ሁሉም ሁኔታዎች',
  inUse: 'በመጠቀም ላይ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  inRepair: 'በመጠገን ላይ',
  disposed: 'የተወገዱ',
  allCategories: 'ሁሉም ምድቦች',
  allConditions: 'ሁሉም ሁኔታዎች',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተጎዳ',
  allLocations: 'ሁሉም አካባቢዎች',
  allEmployees: 'ሁሉም ሰራተኞች',
  clearFilters: 'ማጣሪያ አጽዳ',
  search: 'ፈልግ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  status: 'ሁኔታ',
  condition: 'ሁኔታ',
  location: 'አካባቢ',
  assignedTo: 'ተመድቧል',
  value: 'ዋጋ',
  maintenance: 'ጥገና',
  loading: 'በመጫን ላይ...',
  noAssets: 'በዚህ ክፍል ውስጥ ምንም ንብረቶች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  fetchError: 'ንብረቶች መጫን አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  serialNumber: 'ተከታታይ ቁጥር',
  lastMaintenance: 'የመጨረሻ ጥገና',
  maintenanceStatus: 'የጥገና ሁኔታ',
  assignmentHistory: 'የምደባ ታሪክ',
  maintenanceHistory: 'የጥገና ታሪክ',
  noHistory: 'ምንም የምደባ ታሪክ የለም',
  noMaintenanceHistory: 'ምንም የጥገና ታሪክ የለም',
  view: 'እይታ',
  action: 'እርምጃ',
  asset: 'ንብረት',

  // Actions
  requestTransfer: 'ዝውውር ጠይቅ',
  requestMaintenance: 'ጥገና ጠይቅ',
  reportDamaged: 'ብልሽት ዘግብ',
  requestAsset: 'ንብረት ጠይቅ',
  transferTo: 'ወደ ያስተላልፉ',
  reason: 'ምክንያት',
  transferReasonPlaceholder: 'ለዝውውር ምክንያት ያስገቡ...',
  maintenanceType: 'የጥገና አይነት',
  selectType: 'አይነት ይምረጡ',
  routine: 'መደበኛ',
  repair: 'ጥገና',
  emergency: 'አስቸኳይ',
  preventive: 'መከላከያ',
  description: 'መግለጫ',
  maintenanceDescriptionPlaceholder: 'የሚፈለገውን ጥገና ይግለጹ...',
  damageSeverity: 'የብልሽት ክብደት',
  selectSeverity: 'ክብደት ይምረጡ',
  minor: 'ቀላል',
  moderate: 'መካከለኛ',
  major: 'ከባድ',
  critical: 'አስቸኳይ',
  damageDescription: 'የብልሽት መግለጫ',
  damageDescriptionPlaceholder: 'ብልሽቱን ይግለጹ...',
  requestReason: 'የጥያቄ ምክንያት',
  requestReasonPlaceholder: 'ለምን ይህን ንብረት ይፈልጋሉ?',
  requiredBy: 'በሚያስፈልግበት ቀን',
  cancel: 'ይቅር',
  submit: 'አስገባ',
  actionSuccess: 'ተግባር በተሳካ ሁኔታ ተጠናቋል',
  actionError: 'ተግባሩን ማከናወን አልተቻለም',
  enterEmployeeName: 'የሰራተኛ ስም ያስገቡ...'
};

export default DeptAssets;