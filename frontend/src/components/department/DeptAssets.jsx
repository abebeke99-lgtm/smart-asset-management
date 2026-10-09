import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, useTranslation } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getAllAssets } from '../../services/assetApi';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  History,
  MapPin,
  Package2,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';

const assetTypeOf = (asset) => asset.assetType || asset.asset_type || asset.specifications?.assetType || asset.specifications?.asset_type || '';

const formatCalendarDate = (value) => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      if (
        date.getFullYear() === Number(year)
        && date.getMonth() === Number(month) - 1
        && date.getDate() === Number(day)
      ) {
        return date.toLocaleDateString();
      }
    }
  }
  return new Date(value).toLocaleDateString();
};

const DeptAssets = () => {
  const { user } = useAuth();
  const { theme } = useLanguage();
  const { language, t: translate } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterLaboratory, setFilterLaboratory] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterAssetType, setFilterAssetType] = useState('');
  const [filterMaintenance, setFilterMaintenance] = useState('');
  const [sortBy, setSortBy] = useState('asset_tag');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const [qrIdentifier, setQrIdentifier] = useState('');
  const [qrError, setQrError] = useState('');
  const [loadError, setLoadError] = useState('');

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionData, setActionData] = useState({});
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const [assetHistory, setAssetHistory] = useState([]);
  const [assetDocuments, setAssetDocuments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);

  const isDark = theme === 'dark';
  const t = useMemo(() => Object.fromEntries(
    Object.entries(language === 'am' ? amharicTranslations : englishTranslations)
      .map(([key, fallback]) => [key, translate(`department.assets.${key}`, fallback)]),
  ), [language, translate]);
  const translationsRef = useRef(t);
  translationsRef.current = t;
  const isAssignmentView = location.pathname.includes('/assignments');
  const historyBasePath = location.pathname.startsWith('/college') ? '/college/history' : '/department-head/history';
  const verificationPath = location.pathname.startsWith('/college') ? '/college/verification' : '/department-head/verification';
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canExport = permissions.includes('reports.export') || permissions.includes('assets.export') || permissions.includes('college.assets.export');
  const canRequestTransfer = permissions.includes('assets.transfer');
  const canViewHistory = permissions.includes('department_head.history.view');

  const normalizeAssignmentRows = useCallback((rows = []) => rows.map((assignment) => ({
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
  })), []);

  const fetchDepartmentAssets = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const assetRows = await getAllAssets(axios);
      setAssets(assetRows.map((asset) => ({
        ...asset,
        asset_tag: asset.asset_tag || asset.assetTag || asset.assetCode || asset.asset_code || '',
        category_name: asset.category_name || asset.category || '',
        serial_number: asset.serial_number || asset.serialNumber || '',
        department_name: asset.department_name || asset.department || '',
        assignment_date: asset.assignment_date || asset.assigned_date || asset.assignedDate || '',
        laboratory_name: asset.laboratory_name || asset.laboratoryName || '',
        maintenance_status: asset.maintenance_status || asset.maintenanceStatus || 'None',
      })));
    } catch (error) {
      console.error('Department assets fetch error:', error);
      setLoadError(translationsRef.current.fetchError || 'Failed to load assets');
      toast.error(translationsRef.current.fetchError || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignmentAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        location: filterLocation || undefined,
        assigned_to: filterEmployee || undefined,
        maintenance_status: filterMaintenance || undefined,
      };
      const response = await axios.get('/api/assignments', { params: { ...params, page: 1 } });
      const rows = response.data?.assignments || response.data?.data || [];
      setAssets(normalizeAssignmentRows(rows));
    } catch (error) {
      console.error('Department assignments fetch error:', error);
      toast.error(translationsRef.current.fetchError || 'Failed to load assignments');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterCondition, filterEmployee, filterLocation, filterMaintenance, filterStatus, normalizeAssignmentRows, search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam) setFilterStatus(statusParam);
  }, [location.search]);

  useEffect(() => {
    if (!isAssignmentView) fetchDepartmentAssets();
  }, [fetchDepartmentAssets, isAssignmentView, user?.departmentId]);

  useEffect(() => {
    if (isAssignmentView) fetchAssignmentAssets();
  }, [fetchAssignmentAssets, isAssignmentView]);

  const getStatusColor = (status) => {
    const colors = {
      Active: '#48bb78',
      Damaged: '#fc8181',
      'Under Maintenance': '#ed8936',
      Replaced: '#805ad5',
      Expired: '#fc8181',
      Disposed: '#a0aec0',
    };
    return colors[status] || '#a0aec0';
  };

  const displayStatus = (status) => {
    const normalized = String(status || '').toLowerCase().replace(/[_ ]+/g, '-');
    if (['active', 'available', 'in-use', 'assigned'].includes(normalized)) return 'Active';
    if (normalized === 'under-maintenance' || normalized === 'maintenance') return 'Under Maintenance';
    if (normalized === 'damaged') return 'Damaged';
    if (normalized === 'replaced') return 'Replaced';
    if (normalized === 'expired') return 'Expired';
    if (normalized === 'disposed' || normalized === 'retired') return 'Disposed';
    return status || 'Unknown';
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
    const normalizedStatus = (value) => String(value || '').toLowerCase().replace(/[_ ]+/g, '-');
    const inUse = assets.filter((asset) => ['in-use', 'assigned'].includes(normalizedStatus(asset.status))).length;
    const available = assets.filter((asset) => ['available', 'ready', 'idle'].includes(normalizedStatus(asset.status))).length;
    const maintenance = assets.filter((asset) => ['under-maintenance', 'maintenance'].includes(normalizedStatus(asset.status))
      || ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts'].includes(normalizedStatus(asset.maintenance_status))).length;
    const damaged = assets.filter((asset) => String(asset.condition || '').toLowerCase() === 'damaged').length;
    const totalValue = assets.reduce((sum, asset) => {
      const value = [asset.current_value, asset.currentValue, asset.purchase_cost, asset.purchasePrice]
        .map(Number)
        .find((candidate) => Number.isFinite(candidate) && candidate > 0);
      return sum + (value || 0);
    }, 0);

    return { total, inUse, available, maintenance, damaged, totalValue };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const normalizeStatus = (status) => String(status || '').toLowerCase().replace(/[_ ]+/g, '-');
    const matchesStatus = (asset) => {
      if (!filterStatus) return true;
      const status = normalizeStatus(asset.status);
      switch (normalizeStatus(filterStatus)) {
        case 'active': return ['active', 'available', 'in-use', 'assigned'].includes(status);
        case 'damaged': return status === 'damaged' || String(asset.condition || '').toLowerCase() === 'damaged';
        case 'under-maintenance': return status === 'under-maintenance' || status === 'maintenance';
        default: return status === normalizeStatus(filterStatus);
      }
    };
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const fields = [
        asset.name, asset.asset_tag, asset.assetCode, asset.serial_number, asset.qrCode,
        asset.digitalId, asset.department_name, asset.location, asset.assigned_to_name,
        asset.laboratory_name,
      ];
      const matchesLaboratory = filterLaboratory === '__unassigned__'
        ? !asset.laboratory_name
        : !filterLaboratory || String(asset.laboratory_name || '') === filterLaboratory;
      return matchesStatus(asset)
        && (!filterCategory || String(asset.category_name || '').toLowerCase() === filterCategory.toLowerCase())
        && (!filterCondition || String(asset.condition || '').toLowerCase() === filterCondition.toLowerCase())
        && (!filterLocation || String(asset.location || '') === filterLocation)
        && matchesLaboratory
        && (!filterEmployee || String(asset.assigned_to_name || 'Unassigned') === filterEmployee)
        && (!filterAssetType || String(assetTypeOf(asset) || 'Not recorded') === filterAssetType)
        && (!filterMaintenance || String(asset.maintenance_status || 'None') === filterMaintenance)
        && (!query || fields.some((field) => String(field || '').toLowerCase().includes(query)));
    }).sort((first, second) => {
      const valueFor = (asset) => {
        if (sortBy === 'asset_type') return assetTypeOf(asset) || '';
        if (sortBy === 'category') return asset.category_name || '';
        if (sortBy === 'status') return asset.status || '';
        if (sortBy === 'location') return asset.location || '';
        return asset.asset_tag || asset.assetCode || '';
      };
      return String(valueFor(first)).localeCompare(String(valueFor(second)), undefined, { numeric: true, sensitivity: 'base' })
        * (sortDirection === 'desc' ? -1 : 1);
    });
  }, [assets, filterStatus, filterCategory, filterCondition, filterLocation, filterLaboratory, filterEmployee, filterAssetType, filterMaintenance, search, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterCategory, filterCondition, filterLocation, filterLaboratory, filterEmployee, filterAssetType, filterMaintenance, sortBy, sortDirection]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageAssets = filteredAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const valueDisplay = (asset) => {
    const value = [asset.current_value, asset.currentValue, asset.purchase_cost, asset.purchasePrice]
      .map(Number)
      .find((candidate) => Number.isFinite(candidate) && candidate > 0);
    return value ? `$${value.toLocaleString()}` : 'Not recorded';
  };

  const assetQuickFilters = [
    { value: '', label: t.allStatus, icon: Package2 },
    { value: 'Active', label: 'Active', icon: CheckCircle2 },
    { value: 'Damaged', label: t.damaged, icon: AlertTriangle },
    { value: 'Under Maintenance', label: t.underMaintenance, icon: Wrench },
    { value: 'Replaced', label: 'Replaced', icon: ArrowUpDown },
    { value: 'Expired', label: 'Expired', icon: AlertTriangle },
    { value: 'Disposed', label: t.disposed, icon: X },
  ];
  const assignmentQuickFilters = [
    { value: '', label: t.allStatus, icon: Package2 },
    { value: 'Available', label: t.available, icon: CheckCircle2 },
    { value: 'In-Use', label: t.inUse, icon: UserRound },
    { value: 'Under-Maintenance', label: t.underMaintenance, icon: Wrench },
    { value: 'In-Repair', label: t.inRepair, icon: AlertTriangle },
  ];
  const quickFilters = isAssignmentView ? assignmentQuickFilters : assetQuickFilters;

  const handleAssetClick = async (asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
    setDetailLoading(true);
    setAssetHistory([]);
    setAssetDocuments([]);
    try {
      const [detailResponse, historyResponse, documentResponse] = await Promise.all([
        axios.get(`/api/assets/${asset.id}`),
        axios.get(`/api/assets/${asset.id}/history`),
        axios.get(`/api/assets/${asset.id}/documents`),
      ]);
      const detail = detailResponse.data?.asset || detailResponse.data?.data;
      if (!detail) throw new Error(t.invalidAssetDetails);
      const history = Array.isArray(historyResponse.data?.history) ? historyResponse.data.history : [];
      const documents = documentResponse.data?.documents || documentResponse.data?.data;
      if (!Array.isArray(documents)) throw new Error(t.invalidAssetDocuments);
      setSelectedAsset({
        ...asset,
        ...detail,
        asset_tag: detail.asset_tag || detail.assetCode || detail.asset_code || asset.asset_tag,
        category_name: detail.category_name || detail.category || asset.category_name,
        serial_number: detail.serial_number || detail.serialNumber || asset.serial_number,
        department_name: detail.department_name || detail.department || asset.department_name,
        assignment_date: detail.assignment_date || detail.assigned_date || asset.assignment_date,
        laboratory_name: detail.laboratory_name
          || detail.laboratoryName
          || asset.laboratory_name
          || asset.laboratoryName
          || (String(detail.RoomRecord?.roomType || '').toLowerCase().includes('lab') ? detail.RoomRecord.roomName : ''),
      });
      setAssetHistory(history);
      setAssignmentHistory(history.filter((item) => ['assigned', 'returned', 'reassigned'].includes(String(item.type || '').toLowerCase())));
      setMaintenanceHistory(history.filter((item) => String(item.type || '').toLowerCase() === 'maintained'));
      setAssetDocuments(documents);
    } catch (error) {
      toast.error(error.response?.data?.message || t.unableToLoadDetails);
    } finally {
      setDetailLoading(false);
    }
  };

  const identifyAssetByQr = async (event) => {
    event.preventDefault();
    const identifier = qrIdentifier.trim();
    if (!identifier) return;
    setQrError('');
    try {
      const response = await axios.get(`/api/assets/scan/${encodeURIComponent(identifier)}`);
      const asset = response.data?.data || response.data?.asset;
      if (!asset?.id) throw new Error(t.invalidQrResult);
      await handleAssetClick({
        ...asset,
        asset_tag: asset.asset_tag || asset.assetCode || asset.asset_code || '',
        category_name: asset.category_name || asset.category || '',
        serial_number: asset.serial_number || asset.serialNumber || '',
        department_name: asset.department_name || asset.department || '',
      });
      setQrIdentifier('');
    } catch (error) {
      setQrError(error.response?.status === 404
        ? t.identifyQrNotFound
        : error.response?.data?.message || t.unableToIdentifyQr);
    }
  };

  const downloadAssetDocument = async (document) => {
    setDownloadingDocumentId(document.id);
    try {
      const response = await axios.get(`/api/assets/${selectedAsset.id}/documents/${document.id}/file`, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName || document.original_name || `${document.documentType || 'asset-document'}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error.response?.data?.message || t.unableToDownloadDocument);
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleAction = (type, asset) => {
    if (type === 'request_asset') {
      setShowDetailModal(false);
      navigate('/department-head/requests');
      return;
    }
    if (type === 'request_transfer') {
      setShowDetailModal(false);
      navigate('/department-head/transfers');
      return;
    }
    setSelectedAsset(asset);
    setActionType(type);
    setActionData({});
    setShowActionModal(true);
  };

  const submitAction = async () => {
    try {
      if (actionType === 'request_maintenance') {
        if (!actionData.description?.trim()) {
          toast.error(t.pleaseDescribeMaintenance);
          return;
        }
        await axios.post('/api/department-head/maintenance-requests', {
          asset_id: selectedAsset.id,
          problem: actionData.type || 'Maintenance request',
          description: actionData.description.trim(),
          priority: actionData.priority || 'medium',
        });
      } else {
        throw new Error(t.actionUnavailable);
      }
      toast.success(t.actionSuccess || 'Action completed successfully');
      setShowActionModal(false);
      if (isAssignmentView) await fetchAssignmentAssets();
      else await fetchDepartmentAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || t.actionError || 'Failed to perform action');
    }
  };

  const exportToExcel = () => {
    if (!canExport) {
      toast.error(t.unauthorizedExport);
      return;
    }
    const data = filteredAssets.map((a) => ({
      'Asset ID': a.asset_tag || a.assetTag || a.assetCode || a.asset_code || '',
      'Digital ID': a.digitalId || a.digital_id || '',
      'Asset Tag': a.asset_tag || '',
      Name: a.name || '',
      Category: a.category_name || '',
      'Serial Number': a.serial_number || '',
      Quantity: a.quantity ?? '',
      Status: displayStatus(a.status),
      Condition: a.condition || '',
      Location: a.location || '',
      Laboratory: a.laboratory_name || '',
      'Assigned To': a.assigned_to_name || '',
      'Assignment Date': a.assignment_date ? new Date(a.assignment_date).toLocaleDateString() : '',
      'Purchase Date': a.purchaseDate || a.purchase_date || '',
      Warranty: a.warrantyExpiry || a.warranty_expiry || '',
      'QR Code': a.qrCode || a.qr_code || '',
      RFID: a.rfidTag || a.rfid_tag || '',
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
    () => [...new Set([
      'Computing',
      'Laboratory Equipment',
      'Agriculture Equipment',
      'Furniture',
      'ICT Equipment',
      'Electrical',
      'Other',
      'Computers',
      'Presentation Equipment',
      'Printers',
      'Monitor',
      ...assets.map((a) => a.category_name),
    ].filter(Boolean))],
    [assets],
  );
  const uniqueAssetTypes = useMemo(
    () => [...new Set(assets.map(assetTypeOf).filter(Boolean))].sort(),
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
  const uniqueLaboratories = useMemo(
    () => [...new Set(assets.map((a) => a.laboratory_name).filter(Boolean))],
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
      background: '#3074B3',
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
    setFilterLaboratory('');
    setFilterEmployee('');
    setFilterAssetType('');
    setFilterMaintenance('');
    setSortBy('asset_tag');
    setSortDirection('asc');
  };

  const exportButton = canExport && (
    <button style={styles.exportButton} onClick={exportToExcel}>
      <Download size={16} /> {t.exportExcel}
    </button>
  );

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

  if (loadError) {
    return (
      <div style={styles.container}>
        <div role="alert" style={{ ...styles.emptyState, border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '16px', background: isDark ? '#2a1720' : '#fff7f7' }}>
          <div>{t.fetchError || 'Unable to load department assets.'}</div>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: '16px' }} onClick={fetchDepartmentAssets}>
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: t.totalAssets, value: summaryStats.total, icon: Package2, accent: '#60a5fa' },
    { label: t.inUse, value: summaryStats.inUse, icon: CheckCircle2, accent: '#34d399' },
    { label: t.available, value: summaryStats.available, icon: ShieldCheck, accent: '#38bdf8' },
    { label: t.underMaintenance, value: summaryStats.maintenance, icon: Wrench, accent: '#D97706' },
    { label: t.totalAssetValue, value: summaryStats.totalValue ? `$${summaryStats.totalValue.toLocaleString()}` : t.notRecorded, icon: Package2, accent: '#a78bfa' },
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
          background: linear-gradient(135deg, rgba(96,165,250,0.2), rgba(48, 116, 179,0.12));
          border-color: rgba(96,165,250,0.8);
          color: ${isDark ? '#dfeeff' : '#245783'};
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
              <Sparkles size={14} /> {isAssignmentView ? t.assignments : t.assets}
            </div>
            <h1 style={styles.title}>{isAssignmentView ? t.assetAssignments : t.assets}</h1>
            <p style={styles.subtitle}>
              {isAssignmentView ? t.assignmentRecordsFor : t.departmentAssets} <strong>{user?.department || t.departmentName}</strong>
              <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#a7bad4' : '#5a6f8d' }}>
                {assets.length} {isAssignmentView ? t.records : t.totalAssets}
              </span>
            </p>
          </div>
          <div style={styles.headerActions}>
            {!isAssignmentView && (
              <>
                <button type="button" style={styles.buttonSecondary} onClick={fetchDepartmentAssets} disabled={loading}>
                  <RefreshCw size={15} /> {t.refresh}
                </button>
                <button type="submit" form="department-asset-identifier" style={styles.buttonSecondary}>
                  <QrCode size={15} /> {t.identifyAsset}
                </button>
                <button type="button" style={styles.buttonPrimary} onClick={() => navigate('/department-head/requests')}>
                  Request Asset
                </button>
              </>
            )}
            {exportButton}
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

        {!isAssignmentView && (
        <form id="department-asset-identifier" onSubmit={identifyAssetByQr} style={{ ...styles.controls, marginBottom: 0 }}>
            <QrCode size={18} aria-hidden="true" />
            <input
              type="search"
            aria-label={t.qrIdentifier}
              style={styles.input}
            placeholder={t.identifyByQrPlaceholder}
              value={qrIdentifier}
              onChange={(event) => setQrIdentifier(event.target.value)}
            />
            {qrError && <span role="alert" style={{ color: '#dc2626', flexBasis: '100%' }}>{qrError}</span>}
          </form>
        )}

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

          <select aria-label={t.categoryFilter} style={styles.select} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">{t.allCategories}</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {!isAssignmentView && (
            <select aria-label={t.assetTypeFilter} style={styles.select} value={filterAssetType} onChange={(e) => setFilterAssetType(e.target.value)}>
              <option value="">{t.allAssetTypes}</option>
              {uniqueAssetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          )}

          <select aria-label={t.conditionFilter} style={styles.select} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
            <option value="">{t.allConditions}</option>
            <option value="Good">{t.good}</option>
            <option value="Fair">{t.fair}</option>
            <option value="Poor">{t.poor}</option>
            <option value="Damaged">{t.damaged}</option>
          </select>

          <select aria-label={t.locationFilter} style={styles.select} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">{t.allLocations}</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {!isAssignmentView && (
            <select aria-label={t.laboratoryFilter} style={styles.select} value={filterLaboratory} onChange={(e) => setFilterLaboratory(e.target.value)}>
              <option value="">{t.allLaboratories}</option>
              <option value="__unassigned__">{t.unassignedNoLaboratory}</option>
              {uniqueLaboratories.map((laboratory) => (
                <option key={laboratory} value={laboratory}>{laboratory}</option>
              ))}
            </select>
          )}

          <select aria-label={t.assignmentFilter} style={styles.select} value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
            <option value="">{t.allEmployees}</option>
            <option value="Unassigned">{t.unassigned}</option>
            {uniqueEmployees.map((emp) => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#a7bad4' : '#5a6f8d', fontWeight: 600 }}>
            {t.sortBy}
            <select aria-label={t.sortAssetsBy} style={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="asset_tag">{t.assetTag}</option>
              <option value="category">{t.category}</option>
              <option value="status">{t.status}</option>
              <option value="location">{t.location}</option>
              {uniqueAssetTypes.length > 0 && <option value="asset_type">{t.assetType}</option>}
            </select>
          </label>
          <button type="button" style={styles.clearButton} aria-label={sortDirection === 'asc' ? t.sortDescending : t.sortAscending} onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}>
            {sortDirection === 'asc' ? t.ascending : t.descending}
          </button>

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
                {!isAssignmentView && <th style={styles.th}>{t.assetType}</th>}
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
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={isAssignmentView ? 10 : 11} style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                    {assets.length === 0 ? (
                      <div>
                        <strong>{t.noDepartmentAssets}</strong>
                        <p>{t.emptyDepartmentAssets}</p>
                        <button type="button" style={styles.buttonPrimary} onClick={() => navigate('/department-head/requests')}>{t.requestAsset}</button>
                      </div>
                    ) : t.noMatchingAssets}
                  </td>
                </tr>
              ) : (
                pageAssets.map((asset) => (
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
                    {!isAssignmentView && <td style={styles.td}>{assetTypeOf(asset) || t.notRecorded}</td>}
                    <td style={styles.td}>
                      <span style={styles.statusBadge(displayStatus(asset.status))}>{displayStatus(asset.status)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.conditionBadge(asset.condition)}>{asset.condition || t.unknown}</span>
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
                    <td style={styles.td}>{valueDisplay(asset)}</td>
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
          {filteredAssets.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
              <span aria-live="polite">{t.page} {currentPage} {t.of} {pageCount} · {filteredAssets.length} {t.assetsCount}</span>
              <button type="button" style={styles.buttonSecondary} disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t.previous}</button>
              <button type="button" style={styles.buttonSecondary} disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{t.next}</button>
            </div>
          )}
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
              <button type="button" aria-label={t.closeAssetDetails} style={styles.modalClose} onClick={() => setShowDetailModal(false)}><X size={18} /></button>
            </div>

            {detailLoading && <p role="status">{t.loadingAssetDetails}</p>}
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assetId}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.asset_tag || selectedAsset.assetTag || selectedAsset.assetCode || selectedAsset.asset_code || t.notRecorded}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}><span style={styles.statusBadge(displayStatus(selectedAsset.status))}>{displayStatus(selectedAsset.status)}</span></div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.condition}</div>
                <div style={styles.detailValue}><span style={styles.conditionBadge(selectedAsset.condition)}>{selectedAsset.condition || t.unknown}</span></div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.location}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.location || '-'}
                  {selectedAsset.BuildingRecord?.buildingName && <div>{t.building}: {selectedAsset.BuildingRecord.buildingName}</div>}
                  {selectedAsset.BuildingRecord?.floor && <div>{t.floor}: {selectedAsset.BuildingRecord.floor}</div>}
                  {selectedAsset.RoomRecord?.roomName && <div>{t.room}: {selectedAsset.RoomRecord.roomName}</div>}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.laboratory}</div>
                <div style={styles.detailValue}>{selectedAsset.laboratory_name || selectedAsset.laboratoryName || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.serialNumber}</div>
                <div style={styles.detailValue}>{selectedAsset.serial_number || t.notRecorded}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.quantity}</div>
                <div style={styles.detailValue}>{selectedAsset.quantity ?? t.notRecorded} {selectedAsset.unit || ''}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.digitalId}</div>
                <div style={styles.detailValue}>{selectedAsset.digitalId || selectedAsset.digital_id || t.notRecorded}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.qrCode}</div>
                <div style={styles.detailValue}>{selectedAsset.qrCode || selectedAsset.qr_code || t.notRecorded}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.rfid}</div>
                <div style={styles.detailValue}>{selectedAsset.rfidTag || selectedAsset.rfid_tag || t.notRecorded}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assignedTo}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.assigned_to_name || t.notAssigned}
                  {selectedAsset.assignment_date && (
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#9bb5d5' : '#5a6f8d', marginTop: '4px' }}>
                      {t.since} {new Date(selectedAsset.assignment_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.value}</div>
                <div style={styles.detailValue}>{valueDisplay(selectedAsset)}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.purchaseDate}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.purchaseDate || selectedAsset.purchase_date
                    ? formatCalendarDate(selectedAsset.purchaseDate || selectedAsset.purchase_date)
                    : t.notRecorded}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.fundingSource}</div>
                <div style={styles.detailValue}>{selectedAsset.fundingSource || selectedAsset.funding_source || t.notRecorded}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.lastMaintenance}</div>
                <div style={styles.detailValue}>{selectedAsset.last_maintenance_date ? new Date(selectedAsset.last_maintenance_date).toLocaleDateString() : t.never}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.maintenanceStatus}</div>
                <div style={styles.detailValue}>
                  <span style={{ ...styles.statusBadge(selectedAsset.maintenance_status || 'None'), background: `${getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None')}22`, color: getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None') }}>
                    {selectedAsset.maintenance_status || 'None'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.warranty}</div>
                <div style={styles.detailValue}>{selectedAsset.warranty_expiry || selectedAsset.warrantyExpiry ? formatCalendarDate(selectedAsset.warranty_expiry || selectedAsset.warrantyExpiry) : t.notRecorded}</div>
              </div>
            </div>

            <div style={styles.actionButtons}>
              {canRequestTransfer && <button style={styles.actionButton('#48bb78')} onClick={() => handleAction('request_transfer', selectedAsset)}><Building2 size={15} /> {t.requestTransfer}</button>}
              <button style={styles.actionButton('#ed8936')} onClick={() => handleAction('request_maintenance', selectedAsset)}><Wrench size={15} /> {t.requestMaintenance}</button>
              <button style={styles.actionButton('#805ad5')} onClick={() => handleAction('request_asset', selectedAsset)}><MapPin size={15} /> {t.requestAsset}</button>
              {canViewHistory && <button style={styles.actionButton('#2b6cb0')} onClick={() => navigate(`${historyBasePath}/${selectedAsset.id}`)}><History size={15} /> {t.fullHistory}</button>}
              <button style={styles.actionButton('#0f766e')} onClick={() => navigate(verificationPath)}><ClipboardCheck size={15} /> {t.physicalVerification}</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: isDark ? '#eaf3ff' : '#12263f', marginBottom: '8px' }}>{t.warrantyDocuments}</h4>
              {assetDocuments.length === 0 ? (
                <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', padding: '8px 0' }}>{t.noWarrantyDocuments}</div>
              ) : assetDocuments.map((document) => (
                <div key={document.id} style={{ ...styles.historyItem, justifyContent: 'flex-start' }}>
                  <FileText size={16} />
                  <span>{document.originalName || document.original_name || document.documentType || t.assetDocument}</span>
                  <span style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{document.documentType || document.document_type || t.document}</span>
                  <button
                    type="button"
                    style={styles.buttonSecondary}
                    disabled={downloadingDocumentId === document.id}
                    onClick={() => downloadAssetDocument(document)}
                  >
                    {downloadingDocumentId === document.id ? t.downloading : t.download}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: isDark ? '#eaf3ff' : '#12263f', marginBottom: '8px' }}>{t.assignmentHistory}</h4>
              <div style={styles.historyList}>
                {assignmentHistory.length === 0 ? (
                  <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', padding: '8px 0' }}>{t.noHistory}</div>
                ) : assignmentHistory.map((item, index) => (
                  <div key={index} style={styles.historyItem}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.employee || item.user || item.description || 'Unknown'}</span>
                      <span style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', marginLeft: '8px' }}>{item.action || t.updated}</span>
                    </div>
                    <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</div>
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
                      <span style={{ fontWeight: 700 }}>{item.action || item.title || t.maintenance}</span>
                      <span style={{ ...styles.statusBadge(item.status || item.newValue), background: `${getMaintenanceStatusColor(item.status || item.newValue)}22`, color: getMaintenanceStatusColor(item.status || item.newValue), marginLeft: '8px' }}>{item.status || item.newValue || ''}</span>
                    </div>
                    <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ color: isDark ? '#eaf3ff' : '#12263f', marginBottom: '8px' }}>{t.assetHistory}</h4>
              {assetHistory.length === 0 ? (
                <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', padding: '8px 0' }}>{t.noHistoryRecords}</div>
              ) : (
                <div style={styles.historyList}>
                  {assetHistory.map((item, index) => (
                    <div key={`${item.date || item.type}-${index}`} style={styles.historyItem}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{item.action || item.type || t.updated}</span>
                        <span style={{ color: isDark ? '#9bb5d5' : '#5a6f8d', marginLeft: '8px' }}>{item.description || ''}</span>
                      </div>
                      <div style={{ color: isDark ? '#9bb5d5' : '#5a6f8d' }}>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showActionModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowActionModal(false)}>
          <div style={styles.actionModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {actionType === 'request_maintenance' && '🔧 ' + t.requestMaintenance}
              </h2>
              <button style={styles.modalClose} onClick={() => setShowActionModal(false)}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '18px', color: isDark ? '#9bb5d5' : '#5a6f8d' }}>
              {t.asset}: <strong>{selectedAsset.asset_tag} - {selectedAsset.name}</strong>
            </div>

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
                  <label style={styles.formLabel}>{t.priority}</label>
                  <select style={styles.formInput} value={actionData.priority || 'medium'} onChange={(e) => setActionData({ ...actionData, priority: e.target.value })}>
                    <option value="low">{t.low}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="high">{t.high}</option>
                    <option value="critical">Critical</option>
                  </select>
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
  ,
  allAssetTypes: 'All Asset Types',
  allLaboratories: 'All Laboratories',
  unassignedNoLaboratory: 'Unassigned / No Laboratory',
  unassigned: 'Unassigned',
  sortBy: 'Sort by',
  assetType: 'Asset Type',
  ascending: 'Ascending',
  descending: 'Descending',
  sortDescending: 'Sort descending',
  sortAscending: 'Sort ascending',
  noDepartmentAssets: 'No Department Assets',
  emptyDepartmentAssets: 'There are currently no assets associated with your department.',
  noMatchingAssets: 'No assets match the selected filters.',
  totalAssetValue: 'Total Asset Value',
  records: 'records',
  identifyAsset: 'Identify Asset',
  identifyByQrPlaceholder: 'Identify by QR code or asset tag',
  qrIdentifier: 'QR identifier',
  categoryFilter: 'Category filter',
  assetTypeFilter: 'Asset type filter',
  conditionFilter: 'Condition filter',
  locationFilter: 'Location filter',
  laboratoryFilter: 'Laboratory filter',
  assignmentFilter: 'Assignment filter',
  sortAssetsBy: 'Sort assets by',
  page: 'Page',
  of: 'of',
  assetsCount: 'assets',
  previous: 'Previous',
  next: 'Next',
  retry: 'Retry',
  closeAssetDetails: 'Close asset details',
  loadingAssetDetails: 'Loading authorized asset details...',
  assetId: 'Asset ID',
  building: 'Building',
  floor: 'Floor',
  room: 'Room',
  laboratory: 'Laboratory',
  quantity: 'Quantity',
  digitalId: 'Digital ID',
  qrCode: 'QR Code',
  rfid: 'RFID',
  notRecorded: 'Not recorded',
  notAssigned: 'Not assigned',
  unknown: 'Unknown',
  since: 'Since',
  purchaseDate: 'Purchase Date',
  fundingSource: 'Funding source',
  never: 'Never',
  warranty: 'Warranty',
  fullHistory: 'Full history',
  physicalVerification: 'Physical verification',
  warrantyDocuments: 'Warranty and manual documents',
  noWarrantyDocuments: 'No warranty or manual documents available.',
  assetDocument: 'Asset document',
  document: 'document',
  downloading: 'Downloading...',
  download: 'Download',
  assetHistory: 'Asset history',
  noHistoryRecords: 'No history records found.',
  updated: 'Updated',
  maintenance: 'Maintenance',
  priority: 'Priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  pleaseDescribeMaintenance: 'Please describe the maintenance problem.',
  unauthorizedExport: 'You do not have permission to export department assets.',
  unableToLoadDetails: 'Unable to load authorized asset details.',
  unableToDownloadDocument: 'Unable to download this asset document.',
  identifyQrNotFound: 'No asset with that QR identifier is available in your department.',
  unableToIdentifyQr: 'Unable to identify this QR code.',
  actionUnavailable: 'This asset action is not available in the Department Head workflow.',
  invalidAssetDetails: 'The asset detail API returned an invalid response.',
  invalidAssetDocuments: 'The asset documents API returned an invalid response.',
  invalidQrResult: 'The QR lookup did not return a valid asset.',
  assignments: 'Assignments',
  assetAssignments: 'Asset Assignments',
  assignmentRecordsFor: 'Department assignment records for',
  departmentName: 'Department',
  refresh: 'Refresh'
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
  ,
  allAssetTypes: 'ሁሉም የንብረት ዓይነቶች',
  allLaboratories: 'ሁሉም ላቦራቶሪዎች',
  unassignedNoLaboratory: 'ያልተመደበ / ላቦራቶሪ የሌለው',
  unassigned: 'ያልተመደበ',
  sortBy: 'ደርድር በ',
  assetType: 'የንብረት ዓይነት',
  ascending: 'እየጨመረ ቅደም ተከተል',
  descending: 'እየቀነሰ ቅደም ተከተል',
  sortDescending: 'በመቀነስ ደርድር',
  sortAscending: 'በመጨመር ደርድር',
  noDepartmentAssets: 'የክፍል ንብረቶች የሉም',
  emptyDepartmentAssets: 'በአሁኑ ጊዜ ከክፍልዎ ጋር የተያያዙ ንብረቶች የሉም።',
  noMatchingAssets: 'ከተመረጡት ማጣሪያዎች ጋር የሚዛመዱ ንብረቶች የሉም።',
  totalAssetValue: 'ጠቅላላ የንብረት ዋጋ',
  records: 'መዝገቦች',
  identifyAsset: 'ንብረት መለየት',
  identifyByQrPlaceholder: 'በQR ኮድ ወይም በንብረት መለያ ይለዩ',
  qrIdentifier: 'የQR መለያ',
  categoryFilter: 'የምድብ ማጣሪያ',
  assetTypeFilter: 'የንብረት ዓይነት ማጣሪያ',
  conditionFilter: 'የሁኔታ ማጣሪያ',
  locationFilter: 'የቦታ ማጣሪያ',
  laboratoryFilter: 'የላቦራቶሪ ማጣሪያ',
  assignmentFilter: 'የምደባ ማጣሪያ',
  sortAssetsBy: 'ንብረቶችን ደርድር በ',
  page: 'ገጽ',
  of: 'ከ',
  assetsCount: 'ንብረቶች',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  retry: 'እንደገና ሞክር',
  closeAssetDetails: 'የንብረት ዝርዝሮችን ዝጋ',
  loadingAssetDetails: 'የተፈቀዱ የንብረት ዝርዝሮችን በመጫን ላይ...',
  assetId: 'የንብረት መለያ',
  building: 'ሕንፃ',
  floor: 'ወለል',
  room: 'ክፍል',
  laboratory: 'ላቦራቶሪ',
  quantity: 'ብዛት',
  digitalId: 'ዲጂታል መለያ',
  qrCode: 'QR ኮድ',
  rfid: 'RFID',
  notRecorded: 'አልተመዘገበም',
  notAssigned: 'አልተመደበም',
  unknown: 'ያልታወቀ',
  since: 'ከ',
  purchaseDate: 'የግዢ ቀን',
  fundingSource: 'የገንዘብ ምንጭ',
  never: 'በፍጹም',
  warranty: 'ዋስትና',
  fullHistory: 'ሙሉ ታሪክ',
  physicalVerification: 'አካላዊ ማረጋገጫ',
  warrantyDocuments: 'የዋስትና እና የመመሪያ ሰነዶች',
  noWarrantyDocuments: 'የዋስትና ወይም የመመሪያ ሰነዶች የሉም።',
  assetDocument: 'የንብረት ሰነድ',
  document: 'ሰነድ',
  downloading: 'በማውረድ ላይ...',
  download: 'አውርድ',
  assetHistory: 'የንብረት ታሪክ',
  noHistoryRecords: 'የታሪክ መዝገቦች አልተገኙም።',
  updated: 'ተዘምኗል',
  priority: 'ቅድሚያ',
  low: 'ዝቅተኛ',
  medium: 'መካከለኛ',
  high: 'ከፍተኛ',
  pleaseDescribeMaintenance: 'እባክዎ የጥገናውን ችግር ይግለጹ።',
  unauthorizedExport: 'የክፍል ንብረቶችን ወደ ውጭ ለመላክ ፈቃድ የለዎትም።',
  unableToLoadDetails: 'የተፈቀዱ የንብረት ዝርዝሮችን መጫን አልተቻለም።',
  unableToDownloadDocument: 'ይህን የንብረት ሰነድ ማውረድ አልተቻለም።',
  identifyQrNotFound: 'በዚያ QR መለያ የሚገኝ ንብረት በክፍልዎ ውስጥ የለም።',
  unableToIdentifyQr: 'ይህን QR ኮድ መለየት አልተቻለም።',
  actionUnavailable: 'ይህ የንብረት እርምጃ በክፍል ኃላፊ የሥራ ሂደት ውስጥ አይገኝም።',
  invalidAssetDetails: 'የንብረት ዝርዝር API ትክክል ያልሆነ ምላሽ ሰጥቷል።',
  invalidAssetDocuments: 'የንብረት ሰነዶች API ትክክል ያልሆነ ምላሽ ሰጥቷል።',
  invalidQrResult: 'የQR ፍለጋው ትክክለኛ ንብረት አላገኘም።',
  assignments: 'ምደባዎች',
  assetAssignments: 'የንብረት ምደባዎች',
  assignmentRecordsFor: 'የክፍል ምደባ መዝገቦች ለ',
  departmentName: 'ክፍል',
  refresh: 'አድስ'
};

export default DeptAssets;