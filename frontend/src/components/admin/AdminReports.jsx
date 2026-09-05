import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminReports = () => {
  const { language } = useLanguage();
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('assets');
  const [reportCategory, setReportCategory] = useState('all');
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({});
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState({
    department: '',
    category: '',
    location: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);

  const reportGroups = useMemo(
    () => ({
      assets: {
        label: t.assetReports,
        icon: '📦',
        types: [
          'all',
          'by_department',
          'by_category',
          'by_location',
          'active',
          'available',
          'assigned',
          'damaged',
          'missing',
          'disposed',
          'under_maintenance',
        ],
      },

      inventory: {
        label: t.inventoryReports,
        icon: '📊',
        types: [
          'all',
          'stock',
          'available',
          'assigned',
          'low_stock',
          'by_category',
          'by_department',
          'by_location',
        ],
      },

      assignments: {
        label: t.assignmentReports,
        icon: '📋',
        types: [
          'all',
          'active',
          'returned',
          'overdue',
          'by_department',
          'by_user',
          'by_asset',
        ],
      },

      transfers: {
        label: t.transferReports,
        icon: '🔄',
        types: [
          'all',
          'pending',
          'approved',
          'completed',
          'rejected',
          'by_department',
          'by_location',
        ],
      },

      maintenance: {
        label: t.maintenanceReports,
        icon: '🔧',
        types: [
          'all',
          'pending',
          'in_progress',
          'completed',
          'cancelled',
          'cost',
          'by_department',
          'by_asset',
          'technician_performance',
        ],
      },

      rfid: {
        label: t.rfidReports,
        icon: '📡',
        types: [
          'all',
          'asset_movement',
          'rfid_activity',
          'unauthorized_movement',
          'location_history',
          'device_activity',
        ],
      },

      procurement: {
        label: t.procurementReports,
        icon: '🛒',
        types: [
          'all',
          'requests',
          'pending',
          'approved',
          'ordered',
          'received',
          'cancelled',
          'by_department',
          'by_supplier',
        ],
      },

      financial: {
        label: t.financialReports,
        icon: '💰',
        types: [
          'all',
          'total_value',
          'purchase_cost',
          'depreciation',
          'by_category',
          'by_department',
        ],
      },

      departments: {
        label: t.departmentReports,
        icon: '🏢',
        types: [
          'all',
          'asset_count',
          'asset_value',
          'assignments',
          'maintenance',
          'transfers',
          'users',
        ],
      },

      users: {
        label: t.userReports,
        icon: '👥',
        types: [
          'all',
          'active_users',
          'by_role',
          'by_department',
          'asset_assignments',
          'activity',
        ],
      },

      analytics: {
        label: t.analytics,
        icon: '📈',
        types: [
          'overview',
          'asset_trend',
          'assignment_trend',
          'maintenance_trend',
          'transfer_trend',
          'procurement_trend',
          'financial_trend',
          'department_performance',
        ],
      },
    }),
    [t]
  );

  const getCategoryLabel = useCallback(
    (category) => {
      const labels = {
        all: t.allRecords,
        by_department: t.byDepartment,
        by_category: t.byCategory,
        by_location: t.byLocation,
        by_user: t.byUser,
        by_asset: t.byAsset,
        by_supplier: t.bySupplier,

        active: t.active,
        available: t.available,
        assigned: t.assigned,
        returned: t.returned,
        overdue: t.overdue,
        damaged: t.damaged,
        missing: t.missing,
        disposed: t.disposed,
        under_maintenance: t.underMaintenance,

        stock: t.stock,
        low_stock: t.lowStock,

        pending: t.pending,
        approved: t.approved,
        completed: t.completed,
        rejected: t.rejected,
        cancelled: t.cancelled,
        ordered: t.ordered,
        received: t.received,

        in_progress: t.inProgress,
        cost: t.cost,
        technician_performance: t.technicianPerformance,

        asset_movement: t.assetMovement,
        rfid_activity: t.rfidActivity,
        unauthorized_movement: t.unauthorizedMovement,
        location_history: t.locationHistory,
        device_activity: t.deviceActivity,

        requests: t.requests,

        total_value: t.totalValue,
        purchase_cost: t.purchaseCost,
        depreciation: t.depreciation,

        asset_count: t.assetCount,
        asset_value: t.assetValue,
        assignments: t.assignments,
        maintenance: t.maintenance,
        transfers: t.transfers,
        users: t.users,

        active_users: t.activeUsers,
        activity: t.activity,

        overview: t.overview,
        asset_trend: t.assetTrend,
        assignment_trend: t.assignmentTrend,
        maintenance_trend: t.maintenanceTrend,
        transfer_trend: t.transferTrend,
        procurement_trend: t.procurementTrend,
        financial_trend: t.financialTrend,
        department_performance: t.departmentPerformance,
      };

      return labels[category] || category;
    },
    [t]
  );

  const getReportLabel = useCallback(() => {
    return reportGroups[reportType]?.label || t.reports;
  }, [reportGroups, reportType, t]);

  const fetchFilters = useCallback(async () => {
    try {
      const requests = await Promise.allSettled([
        axios.get('/api/departments'),
        axios.get('/api/categories'),
        axios.get('/api/locations'),
      ]);

      const [deptRes, catRes, locRes] = requests;

      if (deptRes.status === 'fulfilled') {
        const data =
          deptRes.value?.data?.departments ||
          deptRes.value?.data?.data ||
          [];
        setDepartments(Array.isArray(data) ? data : []);
      }

      if (catRes.status === 'fulfilled') {
        const data =
          catRes.value?.data?.categories ||
          catRes.value?.data?.data ||
          [];
        setCategories(Array.isArray(data) ? data : []);
      }

      if (locRes.status === 'fulfilled') {
        const data =
          locRes.value?.data?.locations ||
          locRes.value?.data?.data ||
          [];
        setLocations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load report filters:', error);
    }
  }, []);

  const getEndpoint = useCallback(() => {
    const endpointMap = {
      assets: '/api/assets',
      inventory: '/api/assets',
      assignments: '/api/assignments',
      transfers: '/api/transfers',
      maintenance: '/api/maintenance',
      rfid: '/api/rfid',
      procurement: '/api/procurement',
      financial: '/api/finance/valuation',
      departments: '/api/departments',
      users: '/api/users',
      analytics: '/api/analytics',
    };

    return endpointMap[reportType] || '/api/assets';
  }, [reportType]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();

    params.append('limit', '1000');

    if (filters.department) {
      params.append('department_id', filters.department);
    }

    if (filters.category) {
      params.append('category', filters.category);
    }

    if (filters.location) {
      params.append('location', filters.location);
    }

    if (filters.status) {
      params.append('status', filters.status);
    }

    if (filters.dateFrom) {
      params.append('from', filters.dateFrom);
      params.append('date_from', filters.dateFrom);
    }

    if (filters.dateTo) {
      params.append('to', filters.dateTo);
      params.append('date_to', filters.dateTo);
    }

    switch (reportType) {
      case 'assets':
        if (reportCategory === 'damaged') {
          params.append('condition', 'Damaged');
        }

        if (reportCategory === 'missing') {
          params.set('status', 'Lost');
        }

        if (reportCategory === 'disposed') {
          params.set('status', 'Disposed');
        }

        if (reportCategory === 'active') {
          params.set('status', 'Active');
        }

        if (reportCategory === 'available') {
          params.set('status', 'Available');
        }

        if (reportCategory === 'assigned') {
          params.set('status', 'In-Use');
        }

        if (reportCategory === 'under_maintenance') {
          params.set('status', 'Under-Maintenance');
        }
        break;

      case 'inventory':
        params.append('report', reportCategory);
        break;

      case 'assignments':
        params.append('report', reportCategory);

        if (reportCategory === 'active') {
          params.set('status', 'Active');
        }

        if (reportCategory === 'returned') {
          params.set('status', 'Returned');
        }

        if (reportCategory === 'overdue') {
          params.set('overdue', 'true');
        }
        break;

      case 'transfers':
        params.append('report', reportCategory);

        if (reportCategory !== 'all') {
          params.set('status', reportCategory);
        }
        break;

      case 'maintenance':
        params.append('report', reportCategory);

        if (reportCategory === 'pending') {
          params.set('status', 'Pending');
        }

        if (reportCategory === 'in_progress') {
          params.set('status', 'In Progress');
        }

        if (reportCategory === 'completed') {
          params.set('status', 'Completed');
        }

        if (reportCategory === 'cancelled') {
          params.set('status', 'Cancelled');
        }
        break;

      case 'rfid':
        params.append('report', reportCategory);

        if (reportCategory === 'unauthorized_movement') {
          params.set('anomaly', 'true');
        }
        break;

      case 'procurement':
        params.append('report', reportCategory);

        if (reportCategory !== 'all') {
          params.set('status', reportCategory);
        }
        break;

      case 'financial':
        params.append('report', reportCategory);
        break;

      case 'departments':
        params.append('report', reportCategory);
        break;

      case 'users':
        params.append('report', reportCategory);
        break;

      case 'analytics':
        params.append('report', reportCategory);
        break;

      default:
        break;
    }

    return params;
  }, [filters, reportCategory, reportType]);

  const extractData = useCallback((responseData) => {
    if (!responseData) {
      return [];
    }

    if (Array.isArray(responseData)) {
      return responseData;
    }

    const possibleKeys = [
      'assets',
      'assignments',
      'transfers',
      'maintenance',
      'requests',
      'rfid',
      'logs',
      'audits',
      'users',
      'departments',
      'procurement',
      'reports',
      'analytics',
      'data',
      'results',
      'records',
    ];

    for (const key of possibleKeys) {
      if (Array.isArray(responseData[key])) {
        return responseData[key];
      }
    }

    return [];
  }, []);

  const calculateSummary = useCallback(
    (data) => {
      const rows = Array.isArray(data) ? data : [];

      if (reportType === 'assets' || reportType === 'inventory') {
        const byStatus = rows.reduce((acc, item) => {
          const status = item.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const totalValue = rows.reduce(
          (sum, item) =>
            sum +
            Number(
              item.current_value ??
                item.currentValue ??
                item.purchase_cost ??
                item.purchaseCost ??
                0
            ),
          0
        );

        const available = rows.filter(
          (item) =>
            String(item.status || '').toLowerCase() === 'available'
        ).length;

        const assigned = rows.filter((item) =>
          ['in-use', 'assigned'].includes(
            String(item.status || '').toLowerCase()
          )
        ).length;

        setSummary({
          total: rows.length,
          available,
          assigned,
          totalValue,
          byStatus,
        });

        return;
      }

      if (reportType === 'assignments') {
        const active = rows.filter((item) =>
          ['active', 'assigned', 'in-use'].includes(
            String(item.status || '').toLowerCase()
          )
        ).length;

        const returned = rows.filter(
          (item) =>
            String(item.status || '').toLowerCase() === 'returned'
        ).length;

        const overdue = rows.filter(
          (item) =>
            item.overdue === true ||
            item.is_overdue === true ||
            String(item.status || '').toLowerCase() === 'overdue'
        ).length;

        setSummary({
          total: rows.length,
          active,
          returned,
          overdue,
        });

        return;
      }

      if (reportType === 'transfers') {
        const byStatus = rows.reduce((acc, item) => {
          const status = item.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        setSummary({
          total: rows.length,
          byStatus,
        });

        return;
      }

      if (reportType === 'maintenance') {
        const byStatus = rows.reduce((acc, item) => {
          const status = item.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const totalCost = rows.reduce(
          (sum, item) =>
            sum +
            Number(
              item.actual_cost ??
                item.actualCost ??
                item.cost ??
                item.estimated_cost ??
                0
            ),
          0
        );

        setSummary({
          total: rows.length,
          totalCost,
          byStatus,
        });

        return;
      }

      if (reportType === 'rfid') {
        const anomalies = rows.filter(
          (item) =>
            item.isAnomaly === true ||
            item.is_anomaly === true ||
            item.anomaly === true
        ).length;

        const assetIds = rows
          .map((item) => item.asset_id || item.assetId)
          .filter(Boolean);

        setSummary({
          total: rows.length,
          anomalies,
          uniqueAssets: new Set(assetIds).size,
        });

        return;
      }

      if (reportType === 'procurement') {
        const totalCost = rows.reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_cost ??
                item.totalCost ??
                item.amount ??
                item.cost ??
                0
            ),
          0
        );

        const byStatus = rows.reduce((acc, item) => {
          const status = item.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        setSummary({
          total: rows.length,
          totalCost,
          byStatus,
        });

        return;
      }

      if (reportType === 'financial') {
        const totalPurchase = rows.reduce(
          (sum, item) =>
            sum +
            Number(
              item.purchase_cost ??
                item.purchaseCost ??
                0
            ),
          0
        );

        const totalValue = rows.reduce(
          (sum, item) =>
            sum +
            Number(
              item.current_value ??
                item.currentValue ??
                0
            ),
          0
        );

        const depreciation = totalPurchase - totalValue;

        setSummary({
          total: rows.length,
          totalPurchase,
          totalValue,
          depreciation,
        });

        return;
      }

      if (reportType === 'departments') {
        setSummary({
          total: rows.length,
          totalAssets: rows.reduce(
            (sum, item) =>
              sum + Number(item.asset_count ?? item.assetCount ?? 0),
            0
          ),
          totalUsers: rows.reduce(
            (sum, item) =>
              sum + Number(item.user_count ?? item.userCount ?? 0),
            0
          ),
        });

        return;
      }

      if (reportType === 'users') {
        const byRole = rows.reduce((acc, item) => {
          const role = item.role || 'Unknown';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});

        setSummary({
          total: rows.length,
          byRole,
        });

        return;
      }

      setSummary({
        total: rows.length,
      });
    },
    [reportType]
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);

    try {
      const endpoint = getEndpoint();
      const params = buildParams();

      const response = await axios.get(
        `${endpoint}?${params.toString()}`,
        {
          timeout: 15000,
        }
      );

      const data = extractData(response.data);

      setReportData(data);
      calculateSummary(data);
    } catch (error) {
      console.error('Report loading error:', error);

      setReportData([]);
      setSummary({});

      const status = error?.response?.status;

      if (status === 404) {
        toast.error(`${t.loadFailed}: API endpoint not found`);
      } else if (status === 403) {
        toast.error('You are not authorized to view this report');
      } else {
        toast.error(t.loadFailed);
      }
    } finally {
      setLoading(false);
    }
  }, [
    buildParams,
    calculateSummary,
    extractData,
    getEndpoint,
    t,
  ]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredData = useMemo(() => {
    if (!search.trim()) {
      return reportData;
    }

    const query = search.toLowerCase().trim();

    return reportData.filter((item) =>
      Object.values(item || {}).some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [reportData, search]);

  const getExportData = useCallback(() => {
    const data = filteredData;

    switch (reportType) {
      case 'assets':
      case 'inventory':
        return data.map((a) => ({
          'Asset Tag': a.asset_tag || a.assetTag || '',
          Name: a.name || a.asset_name || '',
          Category: a.category || a.category_name || '',
          Department: a.department_name || a.department || '',
          Status: a.status || '',
          Location: a.location || a.location_name || '',
          Condition: a.condition || '',
          'Purchase Cost': Number(
            a.purchase_cost ?? a.purchaseCost ?? 0
          ),
          'Current Value': Number(
            a.current_value ?? a.currentValue ?? 0
          ),
          'Assigned To':
            a.assigned_to_name ||
            a.assignedToName ||
            a.assigned_to ||
            '',
        }));

      case 'assignments':
        return data.map((a) => ({
          'Assignment #':
            a.assignment_number ||
            a.assignmentNumber ||
            a.id ||
            '',
          Asset:
            a.asset_name ||
            a.assetName ||
            a.asset_tag ||
            '',
          User:
            a.user_name ||
            a.userName ||
            a.assigned_to_name ||
            '',
          Department:
            a.department_name ||
            a.department ||
            '',
          Status: a.status || '',
          'Assigned Date':
            formatDate(a.assigned_at || a.assignedAt),
          'Return Date':
            formatDate(a.return_date || a.returnDate),
          Overdue:
            a.overdue || a.is_overdue ? 'Yes' : 'No',
        }));

      case 'transfers':
        return data.map((tr) => ({
          'Transfer #':
            tr.transfer_number ||
            tr.transferNumber ||
            tr.id ||
            '',
          Asset:
            tr.asset_name ||
            tr.assetName ||
            tr.asset_tag ||
            '',
          'From Department':
            tr.from_department_name ||
            tr.fromDepartment ||
            '',
          'To Department':
            tr.to_department_name ||
            tr.toDepartment ||
            '',
          'From Location':
            tr.from_location ||
            tr.fromLocation ||
            '',
          'To Location':
            tr.to_location ||
            tr.toLocation ||
            '',
          Status: tr.status || '',
          Date: formatDate(
            tr.transfer_date ||
              tr.transferDate ||
              tr.created_at
          ),
          'Requested By':
            tr.requested_by_name ||
            tr.requestedByName ||
            '',
        }));

      case 'maintenance':
        return data.map((m) => ({
          'Request #':
            m.request_number ||
            m.requestNumber ||
            m.id ||
            '',
          Title: m.title || '',
          Asset:
            m.asset_name ||
            m.assetName ||
            m.asset_tag ||
            '',
          Status: m.status || '',
          Priority: m.priority || '',
          Type: m.type || m.maintenance_type || '',
          'Reported By':
            m.reported_by_name ||
            m.reportedByName ||
            '',
          Technician:
            m.technician_name ||
            m.technicianName ||
            '',
          Created: formatDate(m.created_at || m.createdAt),
          'Completed Date': formatDate(
            m.completed_at || m.completedAt
          ),
          'Actual Cost': Number(
            m.actual_cost ??
              m.actualCost ??
              m.cost ??
              0
          ),
        }));

      case 'rfid':
        return data.map((r) => ({
          Asset:
            r.asset_name ||
            r.assetName ||
            r.asset_tag ||
            '',
          'RFID Tag':
            r.rfid_tag ||
            r.rfidTag ||
            '',
          Reader:
            r.reader_id ||
            r.readerId ||
            '',
          Location:
            r.reader_location ||
            r.location ||
            '',
          'Previous Location':
            r.previous_location ||
            r.previousLocation ||
            '',
          'New Location':
            r.new_location ||
            r.newLocation ||
            '',
          Status:
            r.isAnomaly ||
            r.is_anomaly ||
            r.anomaly
              ? 'Anomaly'
              : 'Normal',
          Timestamp: formatDateTime(
            r.timestamp ||
              r.created_at ||
              r.createdAt
          ),
        }));

      case 'procurement':
        return data.map((p) => ({
          'Request #':
            p.request_number ||
            p.requestNumber ||
            p.id ||
            '',
          Title: p.title || p.name || '',
          Supplier:
            p.supplier_name ||
            p.supplierName ||
            p.supplier ||
            '',
          Department:
            p.department_name ||
            p.department ||
            '',
          Status: p.status || '',
          Quantity:
            p.quantity ||
            p.requested_quantity ||
            0,
          'Unit Cost': Number(
            p.unit_cost ??
              p.unitCost ??
              0
          ),
          'Total Cost': Number(
            p.total_cost ??
              p.totalCost ??
              p.amount ??
              0
          ),
          Date: formatDate(
            p.created_at ||
              p.createdAt ||
              p.request_date
          ),
        }));

      case 'financial':
        return data.map((f) => {
          const purchase = Number(
            f.purchase_cost ??
              f.purchaseCost ??
              0
          );

          const current = Number(
            f.current_value ??
              f.currentValue ??
              0
          );

          const depreciation = purchase - current;

          return {
            'Asset Tag':
              f.asset_tag ||
              f.assetTag ||
              '',
            Name:
              f.name ||
              f.asset_name ||
              '',
            Category:
              f.category ||
              f.category_name ||
              '',
            Department:
              f.department_name ||
              f.department ||
              '',
            'Purchase Cost': purchase,
            'Current Value': current,
            Depreciation: depreciation,
            'Depreciation %':
              purchase > 0
                ? `${(
                    (depreciation / purchase) *
                    100
                  ).toFixed(1)}%`
                : '0%',
          };
        });

      case 'departments':
        return data.map((d) => ({
          ID: d.id || '',
          Department:
            d.name ||
            d.department_name ||
            '',
          Code: d.code || '',
          Head:
            d.head_name ||
            d.department_head ||
            '',
          'Asset Count':
            d.asset_count ||
            d.assetCount ||
            0,
          'Asset Value':
            d.asset_value ||
            d.assetValue ||
            0,
          'User Count':
            d.user_count ||
            d.userCount ||
            0,
          Status: d.status || 'Active',
        }));

      case 'users':
        return data.map((u) => ({
          ID: u.id || '',
          Username:
            u.username ||
            u.user_name ||
            '',
          Name:
            u.name ||
            u.full_name ||
            '',
          Email: u.email || '',
          Role: u.role || '',
          Department:
            u.department_name ||
            u.department ||
            '',
          Status: u.status || '',
          'Asset Count':
            u.asset_count ||
            u.assetCount ||
            0,
        }));

      default:
        return data.map((item) => {
          const output = {};

          Object.entries(item || {}).forEach(
            ([key, value]) => {
              if (
                typeof value !== 'object' ||
                value === null
              ) {
                output[key] = value;
              } else {
                output[key] = JSON.stringify(value);
              }
            }
          );

          return output;
        });
    }
  }, [filteredData, reportType]);

  const exportToExcel = () => {
    const data = getExportData();

    if (!data.length) {
      toast.warning(t.noData);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Report'
    );

    XLSX.writeFile(
      workbook,
      `${reportType}_report_${getDateStamp()}.xlsx`
    );

    toast.success(t.exportSuccess);
  };

  const exportToCSV = () => {
    const data = getExportData();

    if (!data.length) {
      toast.warning(t.noData);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${reportType}_report_${getDateStamp()}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const exportToPDF = () => {
    const data = getExportData();

    if (!data.length) {
      toast.warning(t.noData);
      return;
    }

    const doc = new jsPDF(
      'landscape',
      'mm',
      'a4'
    );

    const headers = Object.keys(data[0] || {});

    const rows = data.map((item) =>
      headers.map((header) =>
        String(item[header] ?? '')
      )
    );

    doc.setFontSize(16);

    doc.text(
      `${t.reports} - ${getReportLabel()}`,
      14,
      15
    );

    doc.setFontSize(9);

    doc.text(
      `${t.reportType}: ${getCategoryLabel(
        reportCategory
      )}`,
      14,
      21
    );

    doc.text(
      `${t.generated}: ${new Date().toLocaleString()}`,
      14,
      27
    );

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 33,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [43, 108, 176],
        textColor: 255,
        fontStyle: 'bold',
      },
      margin: {
        left: 10,
        right: 10,
      },
    });

    doc.save(
      `${reportType}_report_${getDateStamp()}.pdf`
    );

    toast.success(t.exportSuccess);
  };

  const handlePrint = () => {
    if (!filteredData.length) {
      toast.warning(t.noData);
      return;
    }

    window.print();
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      category: '',
      location: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    });

    setSearch('');
    setReportCategory('all');
  };

  const handleReportTypeChange = (type) => {
    setReportType(type);
    setReportCategory(
      reportGroups[type]?.types?.[0] || 'all'
    );

    setSearch('');

    setFilters({
      department: '',
      category: '',
      location: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  const renderFilters = () => {
    return (
      <>
        {(reportType === 'assets' ||
          reportType === 'inventory' ||
          reportType === 'financial' ||
          reportType === 'assignments' ||
          reportType === 'transfers' ||
          reportType === 'maintenance' ||
          reportType === 'procurement') && (
          <select
            style={styles.select}
            value={filters.department}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                department: e.target.value,
              }))
            }
          >
            <option value="">
              {t.allDepartments}
            </option>

            {departments.map((department) => (
              <option
                key={department.id}
                value={department.id}
              >
                {department.name}
              </option>
            ))}
          </select>
        )}

        {(reportType === 'assets' ||
          reportType === 'inventory' ||
          reportType === 'financial') && (
          <select
            style={styles.select}
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: e.target.value,
              }))
            }
          >
            <option value="">
              {t.allCategories}
            </option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={
                  category.name ||
                  category.id
                }
              >
                {category.name}
              </option>
            ))}
          </select>
        )}

        {(reportType === 'assets' ||
          reportType === 'inventory') && (
          <select
            style={styles.select}
            value={filters.location}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                location: e.target.value,
              }))
            }
          >
            <option value="">
              {t.allLocations}
            </option>

            {locations.map((location) => (
              <option
                key={location.id}
                value={
                  location.name ||
                  location.id
                }
              >
                {location.name}
              </option>
            ))}
          </select>
        )}

        {(reportType === 'assets' ||
          reportType === 'inventory' ||
          reportType === 'assignments' ||
          reportType === 'transfers' ||
          reportType === 'maintenance' ||
          reportType === 'procurement') && (
          <select
            style={styles.select}
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value,
              }))
            }
          >
            <option value="">
              {t.allStatus}
            </option>

            <option value="Active">
              {t.active}
            </option>

            <option value="Available">
              {t.available}
            </option>

            <option value="Assigned">
              {t.assigned}
            </option>

            <option value="In-Use">
              {t.inUse}
            </option>

            <option value="Pending">
              {t.pending}
            </option>

            <option value="Approved">
              {t.approved}
            </option>

            <option value="Completed">
              {t.completed}
            </option>

            <option value="Rejected">
              {t.rejected}
            </option>

            <option value="Cancelled">
              {t.cancelled}
            </option>

            <option value="Lost">
              {t.lost}
            </option>

            <option value="Disposed">
              {t.disposed}
            </option>
          </select>
        )}

        <input
          type="date"
          style={styles.dateInput}
          value={filters.dateFrom}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              dateFrom: e.target.value,
            }))
          }
          aria-label={t.dateFrom}
        />

        <input
          type="date"
          style={styles.dateInput}
          value={filters.dateTo}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              dateTo: e.target.value,
            }))
          }
          aria-label={t.dateTo}
        />
      </>
    );
  };

  const renderSummary = () => {
    if (!Object.keys(summary).length) {
      return null;
    }

    const cards = [];

    if (
      reportType === 'assets' ||
      reportType === 'inventory'
    ) {
      cards.push(
        {
          label: t.totalAssets,
          value: summary.total,
          icon: '📦',
        },
        {
          label: t.available,
          value: summary.available,
          icon: '✅',
        },
        {
          label: t.assigned,
          value: summary.assigned,
          icon: '📋',
        },
        {
          label: t.totalValue,
          value: formatCurrency(
            summary.totalValue
          ),
          icon: '💰',
        }
      );
    }

    if (reportType === 'assignments') {
      cards.push(
        {
          label: t.totalAssignments,
          value: summary.total,
          icon: '📋',
        },
        {
          label: t.activeAssignments,
          value: summary.active,
          icon: '🟢',
        },
        {
          label: t.returned,
          value: summary.returned,
          icon: '↩️',
        },
        {
          label: t.overdue,
          value: summary.overdue,
          icon: '⚠️',
        }
      );
    }

    if (reportType === 'transfers') {
      cards.push({
        label: t.totalTransfers,
        value: summary.total,
        icon: '🔄',
      });

      Object.entries(
        summary.byStatus || {}
      )
        .slice(0, 3)
        .forEach(([key, value]) => {
          cards.push({
            label: key,
            value,
            icon: '📌',
          });
        });
    }

    if (reportType === 'maintenance') {
      cards.push(
        {
          label: t.totalRequests,
          value: summary.total,
          icon: '🔧',
        },
        {
          label: t.totalCost,
          value: formatCurrency(
            summary.totalCost
          ),
          icon: '💰',
        }
      );

      Object.entries(
        summary.byStatus || {}
      )
        .slice(0, 3)
        .forEach(([key, value]) => {
          cards.push({
            label: key,
            value,
            icon: '📌',
          });
        });
    }

    if (reportType === 'rfid') {
      cards.push(
        {
          label: t.totalScans,
          value: summary.total,
          icon: '📡',
        },
        {
          label: t.anomalies,
          value: summary.anomalies,
          icon: '⚠️',
        },
        {
          label: t.uniqueAssets,
          value: summary.uniqueAssets,
          icon: '📦',
        }
      );
    }

    if (reportType === 'procurement') {
      cards.push(
        {
          label: t.totalRequests,
          value: summary.total,
          icon: '🛒',
        },
        {
          label: t.totalCost,
          value: formatCurrency(
            summary.totalCost
          ),
          icon: '💰',
        }
      );
    }

    if (reportType === 'financial') {
      cards.push(
        {
          label: t.totalAssets,
          value: summary.total,
          icon: '📦',
        },
        {
          label: t.totalPurchase,
          value: formatCurrency(
            summary.totalPurchase
          ),
          icon: '🛒',
        },
        {
          label: t.totalCurrentValue,
          value: formatCurrency(
            summary.totalValue
          ),
          icon: '💰',
        },
        {
          label: t.totalDepreciation,
          value: formatCurrency(
            summary.depreciation
          ),
          icon: '📉',
        }
      );
    }

    if (reportType === 'departments') {
      cards.push(
        {
          label: t.totalDepartments,
          value: summary.total,
          icon: '🏢',
        },
        {
          label: t.totalAssets,
          value: summary.totalAssets,
          icon: '📦',
        },
        {
          label: t.totalUsers,
          value: summary.totalUsers,
          icon: '👥',
        }
      );
    }

    if (reportType === 'users') {
      cards.push({
        label: t.totalUsers,
        value: summary.total,
        icon: '👥',
      });

      Object.entries(
        summary.byRole || {}
      )
        .slice(0, 4)
        .forEach(([key, value]) => {
          cards.push({
            label: key,
            value,
            icon: '👤',
          });
        });
    }

    if (
      reportType === 'analytics'
    ) {
      cards.push({
        label: t.totalRecords,
        value: summary.total,
        icon: '📈',
      });
    }

    return (
      <div style={styles.summaryGrid}>
        {cards.map((card, index) => (
          <div
            key={`${card.label}-${index}`}
            style={styles.summaryCard}
          >
            <div style={styles.summaryIcon}>
              {card.icon}
            </div>

            <div>
              <span
                style={
                  styles.summaryLabel
                }
              >
                {card.label}
              </span>

              <span
                style={
                  styles.summaryValue
                }
              >
                {card.value ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTable = () => {
    const rows = getExportData();

    if (!rows.length) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            📊
          </div>

          <h3 style={styles.emptyTitle}>
            {t.noData}
          </h3>

          <p style={styles.emptyText}>
            {t.noDataDescription}
          </p>
        </div>
      );
    }

    const headers = Object.keys(
      rows[0] || {}
    );

    return (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  style={styles.th}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows
              .slice(0, 500)
              .map((row, index) => (
                <tr
                  key={`${index}-${String(
                    row[headers[0]]
                  )}`}
                  style={styles.tr}
                >
                  {headers.map((header) => (
                    <td
                      key={header}
                      style={styles.td}
                    >
                      {row[header] ??
                        '-'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>

        {rows.length > 500 && (
          <div style={styles.tableNotice}>
            {t.showingFirst} 500 {t.of}{' '}
            {rows.length}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <div style={styles.titleIcon}>
              📊
            </div>

            <div>
              <h1 style={styles.title}>
                {t.reports}
              </h1>

              <p style={styles.subtitle}>
                {getReportLabel()} •{' '}
                {getCategoryLabel(
                  reportCategory
                )}
              </p>
            </div>
          </div>
        </div>

        <div style={styles.exportGroup}>
          <button
            type="button"
            style={styles.excelButton}
            onClick={exportToExcel}
            disabled={
              loading ||
              filteredData.length === 0
            }
          >
            📥 {t.excel}
          </button>

          <button
            type="button"
            style={styles.csvButton}
            onClick={exportToCSV}
            disabled={
              loading ||
              filteredData.length === 0
            }
          >
            📄 {t.csv}
          </button>

          <button
            type="button"
            style={styles.pdfButton}
            onClick={exportToPDF}
            disabled={
              loading ||
              filteredData.length === 0
            }
          >
            📕 {t.pdf}
          </button>

          <button
            type="button"
            style={styles.printButton}
            onClick={handlePrint}
            disabled={
              loading ||
              filteredData.length === 0
            }
          >
            🖨️ {t.print}
          </button>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={fetchReport}
            disabled={loading}
          >
            🔄 {loading ? t.loading : t.refresh}
          </button>
        </div>
      </div>

      {/* Main Report Categories */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              {t.reportCategories}
            </h2>

            <p style={styles.sectionSubtitle}>
              {t.selectReportType}
            </p>
          </div>
        </div>

        <div style={styles.reportTypeGrid}>
          {Object.entries(
            reportGroups
          ).map(([key, group]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                handleReportTypeChange(key)
              }
              style={styles.reportTypeButton(
                reportType === key
              )}
            >
              <span
                style={
                  styles.reportTypeIcon
                }
              >
                {group.icon}
              </span>

              <span>
                {group.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Report Sub Categories */}
      <section style={styles.section}>
        <div style={styles.subTabHeader}>
          <h3 style={styles.subTabTitle}>
            {getReportLabel()}
          </h3>

          <span style={styles.recordCount}>
            {filteredData.length}{' '}
            {t.records}
          </span>
        </div>

        <div style={styles.tabGroup}>
          {(
            reportGroups[reportType]
              ?.types || []
          ).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setReportCategory(
                  category
                )
              }
              style={styles.tab(
                reportCategory ===
                  category
              )}
            >
              {getCategoryLabel(
                category
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Search + Filters */}
      <section style={styles.filterPanel}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>
            🔍
          </span>

          <input
            type="search"
            placeholder={t.searchReports}
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterControls}>
          {renderFilters()}

          <button
            type="button"
            style={styles.applyButton}
            onClick={fetchReport}
            disabled={loading}
          >
            🔍 {t.applyFilters}
          </button>

          <button
            type="button"
            style={styles.clearButton}
            onClick={clearFilters}
          >
            ✕ {t.clearFilters}
          </button>
        </div>
      </section>

      {/* Active Filter Info */}
      {(search ||
        filters.department ||
        filters.category ||
        filters.location ||
        filters.status ||
        filters.dateFrom ||
        filters.dateTo) && (
        <div style={styles.activeFilterBar}>
          <span style={styles.activeFilterTitle}>
            🎯 {t.activeFilters}
          </span>

          {search && (
            <span style={styles.filterChip}>
              {t.search}: {search}
            </span>
          )}

          {filters.dateFrom && (
            <span style={styles.filterChip}>
              {t.dateFrom}:{' '}
              {filters.dateFrom}
            </span>
          )}

          {filters.dateTo && (
            <span style={styles.filterChip}>
              {t.dateTo}:{' '}
              {filters.dateTo}
            </span>
          )}

          <button
            type="button"
            style={styles.removeFilters}
            onClick={clearFilters}
          >
            {t.clearAll}
          </button>
        </div>
      )}

      {/* Summary */}
      {!loading && renderSummary()}

      {/* Report Table */}
      <section style={styles.dataSection}>
        <div style={styles.dataHeader}>
          <div>
            <h2 style={styles.dataTitle}>
              {getReportLabel()}
            </h2>

            <p style={styles.dataSubtitle}>
              {getCategoryLabel(
                reportCategory
              )}
            </p>
          </div>

          <div style={styles.dataMeta}>
            {loading ? (
              <span>
                ⏳ {t.loading}
              </span>
            ) : (
              <span>
                {filteredData.length}{' '}
                {t.records}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}>
              ⏳
            </div>

            <h3>
              {t.loading}
            </h3>

            <p>
              {t.loadingDescription}
            </p>
          </div>
        ) : (
          renderTable()
        )}
      </section>

      <div className="report-print-footer">
        <strong>
          Smart University Asset
          Management System
        </strong>
        <br />
        {getReportLabel()} -{' '}
        {getCategoryLabel(
          reportCategory
        )}
        <br />
        {t.generated}:{' '}
        {new Date().toLocaleString()}
      </div>
    </div>
  );
};

/* =========================================================
   HELPERS
========================================================= */

const getDateStamp = () => {
  return new Date()
    .toISOString()
    .split('T')[0];
};

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return `$${amount.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
};

/* =========================================================
   STYLES
========================================================= */

const styles = {
  container: {
    width: '100%',
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '24px',
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },

  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  titleIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '25px',
    background:
      'linear-gradient(135deg, #2b6cb0, #4299e1)',
    boxShadow:
      '0 5px 15px rgba(43,108,176,0.25)',
  },

  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 800,
    color: 'var(--report-title, #1a365d)',
  },

  subtitle: {
    margin: '5px 0 0',
    fontSize: '0.9rem',
    color: '#718096',
  },

  exportGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  excelButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#48bb78',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  csvButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#4299e1',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  pdfButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#e53e3e',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  printButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#805ad5',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  refreshButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#718096',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  section: {
    marginBottom: '18px',
  },

  sectionHeader: {
    marginBottom: '12px',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 750,
    color: '#1a365d',
  },

  sectionSubtitle: {
    margin: '3px 0 0',
    color: '#718096',
    fontSize: '0.8rem',
  },

  reportTypeGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(145px, 1fr))',
    gap: '9px',
  },

  reportTypeButton: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '12px',
    borderRadius: '10px',
    border: active
      ? '1px solid #2b6cb0'
      : '1px solid #e2e8f0',
    background: active
      ? '#2b6cb0'
      : '#ffffff',
    color: active
      ? '#ffffff'
      : '#4a5568',
    cursor: 'pointer',
    fontWeight: active ? 700 : 600,
    fontSize: '0.82rem',
    textAlign: 'left',
    transition: 'all 0.2s',
  }),

  reportTypeIcon: {
    fontSize: '18px',
  },

  subTabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },

  subTabTitle: {
    margin: 0,
    color: '#2d3748',
    fontSize: '0.95rem',
    fontWeight: 700,
  },

  recordCount: {
    fontSize: '0.78rem',
    color: '#718096',
  },

  tabGroup: {
    display: 'flex',
    gap: '7px',
    flexWrap: 'wrap',
  },

  tab: (active) => ({
    padding: '7px 12px',
    borderRadius: '7px',
    border: 'none',
    background: active
      ? '#2b6cb0'
      : '#edf2f7',
    color: active
      ? '#ffffff'
      : '#4a5568',
    fontWeight: active ? 700 : 500,
    fontSize: '0.78rem',
    cursor: 'pointer',
  }),

  filterPanel: {
    padding: '15px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    marginBottom: '14px',
  },

  searchWrapper: {
    position: 'relative',
    marginBottom: '12px',
  },

  searchIcon: {
    position: 'absolute',
    left: '13px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },

  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px 10px 38px',
    borderRadius: '8px',
    border: '1px solid #d0d8e8',
    background: '#ffffff',
    color: '#1a365d',
    outline: 'none',
    fontSize: '0.86rem',
  },

  filterControls: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  select: {
    padding: '9px 12px',
    minWidth: '145px',
    borderRadius: '8px',
    border: '1px solid #d0d8e8',
    background: '#ffffff',
    color: '#1a365d',
    fontSize: '0.82rem',
    cursor: 'pointer',
  },

  dateInput: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #d0d8e8',
    background: '#ffffff',
    color: '#1a365d',
    fontSize: '0.82rem',
  },

  applyButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background:
      'linear-gradient(135deg, #2b6cb0, #4299e1)',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  clearButton: {
    padding: '9px 15px',
    border: 'none',
    borderRadius: '8px',
    background: '#a0aec0',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  activeFilterBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '9px 12px',
    marginBottom: '14px',
    borderRadius: '8px',
    background: '#ebf8ff',
    border: '1px solid #bee3f8',
  },

  activeFilterTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#2b6cb0',
  },

  filterChip: {
    padding: '4px 9px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #bee3f8',
    fontSize: '0.75rem',
    color: '#2c5282',
  },

  removeFilters: {
    marginLeft: 'auto',
    border: 'none',
    background: 'transparent',
    color: '#e53e3e',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px',
    marginBottom: '16px',
  },

  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '13px',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow:
      '0 3px 10px rgba(0,0,0,0.04)',
  },

  summaryIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ebf8ff',
    fontSize: '18px',
    flexShrink: 0,
  },

  summaryLabel: {
    display: 'block',
    color: '#718096',
    fontSize: '0.7rem',
    marginBottom: '2px',
  },

  summaryValue: {
    display: 'block',
    color: '#1a365d',
    fontSize: '1.15rem',
    fontWeight: 800,
  },

  dataSection: {
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    overflow: 'hidden',
  },

  dataHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    padding: '15px 17px',
    borderBottom: '1px solid #e2e8f0',
  },

  dataTitle: {
    margin: 0,
    color: '#1a365d',
    fontSize: '1rem',
    fontWeight: 750,
  },

  dataSubtitle: {
    margin: '3px 0 0',
    color: '#718096',
    fontSize: '0.75rem',
  },

  dataMeta: {
    color: '#718096',
    fontSize: '0.78rem',
    fontWeight: 600,
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    minWidth: '900px',
    borderCollapse: 'collapse',
  },

  th: {
    padding: '11px 13px',
    textAlign: 'left',
    background: '#f7fafc',
    color: '#2d3748',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '0.76rem',
    fontWeight: 750,
    whiteSpace: 'nowrap',
  },

  tr: {
    borderBottom: '1px solid #edf2f7',
  },

  td: {
    padding: '10px 13px',
    color: '#4a5568',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
  },

  tableNotice: {
    padding: '12px',
    textAlign: 'center',
    color: '#718096',
    background: '#f7fafc',
    fontSize: '0.78rem',
  },

  loadingState: {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#718096',
  },

  spinner: {
    fontSize: '30px',
    marginBottom: '10px',
  },

  emptyState: {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '30px',
    color: '#718096',
  },

  emptyIcon: {
    fontSize: '42px',
    marginBottom: '8px',
  },

  emptyTitle: {
    margin: '0 0 5px',
    color: '#2d3748',
    fontSize: '1rem',
  },

  emptyText: {
    margin: 0,
    fontSize: '0.8rem',
  },
};

/* =========================================================
   ENGLISH TRANSLATIONS
========================================================= */

const englishTranslations = {
  reports: 'Reports & Analytics',

  reportCategories: 'Report Categories',
  selectReportType:
    'Select the type of report you want to generate.',

  assetReports: 'Asset Reports',
  inventoryReports: 'Inventory Reports',
  assignmentReports: 'Assignment Reports',
  transferReports: 'Transfer Reports',
  maintenanceReports: 'Maintenance Reports',
  rfidReports: 'RFID Reports',
  procurementReports: 'Procurement Reports',
  financialReports: 'Financial Reports',
  departmentReports: 'Department Reports',
  userReports: 'User Reports',
  analytics: 'Analytics',

  allRecords: 'All Records',
  byDepartment: 'By Department',
  byCategory: 'By Category',
  byLocation: 'By Location',
  byUser: 'By User',
  byAsset: 'By Asset',
  bySupplier: 'By Supplier',

  active: 'Active',
  available: 'Available',
  assigned: 'Assigned',
  returned: 'Returned',
  overdue: 'Overdue',
  damaged: 'Damaged',
  missing: 'Missing',
  disposed: 'Disposed',
  underMaintenance: 'Under Maintenance',

  stock: 'Stock',
  lowStock: 'Low Stock',

  pending: 'Pending',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  ordered: 'Ordered',
  received: 'Received',
  inProgress: 'In Progress',

  cost: 'Cost',
  technicianPerformance:
    'Technician Performance',

  assetMovement: 'Asset Movement',
  rfidActivity: 'RFID Activity',
  unauthorizedMovement:
    'Unauthorized Movement',
  locationHistory: 'Location History',
  deviceActivity: 'Device Activity',

  requests: 'Requests',

  totalValue: 'Total Value',
  purchaseCost: 'Purchase Cost',
  depreciation: 'Depreciation',

  assetCount: 'Asset Count',
  assetValue: 'Asset Value',
  assignments: 'Assignments',
  maintenance: 'Maintenance',
  transfers: 'Transfers',
  users: 'Users',

  activeUsers: 'Active Users',
  activity: 'Activity',

  overview: 'Overview',
  assetTrend: 'Asset Trend',
  assignmentTrend: 'Assignment Trend',
  maintenanceTrend: 'Maintenance Trend',
  transferTrend: 'Transfer Trend',
  procurementTrend: 'Procurement Trend',
  financialTrend: 'Financial Trend',
  departmentPerformance:
    'Department Performance',

  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allLocations: 'All Locations',
  allStatus: 'All Status',

  inUse: 'In-Use',
  lost: 'Lost',

  dateFrom: 'From Date',
  dateTo: 'To Date',

  search: 'Search',
  searchReports:
    'Search report records...',

  excel: 'Excel',
  csv: 'CSV',
  pdf: 'PDF',
  print: 'Print',
  refresh: 'Refresh',

  applyFilters: 'Apply Filters',
  clearFilters: 'Clear Filters',
  clearAll: 'Clear All',

  activeFilters: 'Active Filters',

  loading: 'Loading...',
  loadingDescription:
    'Generating report data. Please wait.',

  noData: 'No data available',
  noDataDescription:
    'No records match the selected report and filters.',

  showingFirst: 'Showing first',
  of: 'of',
  records: 'records',

  totalAssets: 'Total Assets',
  totalDepartments: 'Total Departments',
  totalUsers: 'Total Users',
  totalAssignments: 'Total Assignments',
  activeAssignments:
    'Active Assignments',
  totalTransfers: 'Total Transfers',
  totalRequests: 'Total Requests',
  totalCost: 'Total Cost',
  totalScans: 'Total Scans',
  anomalies: 'Anomalies',
  uniqueAssets: 'Unique Assets',
  totalPurchase: 'Total Purchase Cost',
  totalCurrentValue:
    'Total Current Value',
  totalDepreciation:
    'Total Depreciation',
  totalRecords: 'Total Records',

  reportType: 'Report Type',
  generated: 'Generated',

  exportSuccess:
    'Report exported successfully',

  loadFailed:
    'Failed to load report data',
};

/* =========================================================
   AMHARIC TRANSLATIONS
========================================================= */

const amharicTranslations = {
  reports: 'ሪፖርቶች እና ትንታኔ',

  reportCategories: 'የሪፖርት ምድቦች',
  selectReportType:
    'ማመንጨት የሚፈልጉትን የሪፖርት አይነት ይምረጡ።',

  assetReports: 'የንብረት ሪፖርቶች',
  inventoryReports: 'የኢንቬንተሪ ሪፖርቶች',
  assignmentReports: 'የምደባ ሪፖርቶች',
  transferReports: 'የዝውውር ሪፖርቶች',
  maintenanceReports: 'የጥገና ሪፖርቶች',
  rfidReports: 'የRFID ሪፖርቶች',
  procurementReports: 'የግዢ ሪፖርቶች',
  financialReports: 'የፋይናንስ ሪፖርቶች',
  departmentReports: 'የክፍል ሪፖርቶች',
  userReports: 'የተጠቃሚ ሪፖርቶች',
  analytics: 'ትንታኔ',

  allRecords: 'ሁሉም መዝገቦች',
  byDepartment: 'በክፍል',
  byCategory: 'በምድብ',
  byLocation: 'በቦታ',
  byUser: 'በተጠቃሚ',
  byAsset: 'በንብረት',
  bySupplier: 'በአቅራቢ',

  active: 'ንቁ',
  available: 'ይገኛል',
  assigned: 'የተመደበ',
  returned: 'የተመለሰ',
  overdue: 'ጊዜ ያለፈ',
  damaged: 'የተበላሸ',
  missing: 'የጠፋ',
  disposed: 'የተወገደ',
  underMaintenance: 'በጥገና ላይ',

  stock: 'ክምችት',
  lowStock: 'ዝቅተኛ ክምችት',

  pending: 'በመጠባበቅ ላይ',
  approved: 'የጸደቀ',
  completed: 'የተጠናቀቀ',
  rejected: 'ውድቅ የተደረገ',
  cancelled: 'የተሰረዘ',
  ordered: 'የታዘዘ',
  received: 'የተቀበለ',
  inProgress: 'በሂደት ላይ',

  cost: 'ወጪ',
  technicianPerformance:
    'የቴክኒሺያን አፈጻጸም',

  assetMovement: 'የንብረት እንቅስቃሴ',
  rfidActivity: 'የRFID እንቅስቃሴ',
  unauthorizedMovement:
    'ያልተፈቀደ እንቅስቃሴ',
  locationHistory: 'የቦታ ታሪክ',
  deviceActivity: 'የመሳሪያ እንቅስቃሴ',

  requests: 'ጥያቄዎች',

  totalValue: 'ጠቅላላ ዋጋ',
  purchaseCost: 'የግዢ ዋጋ',
  depreciation: 'የዋጋ ቅናሽ',

  assetCount: 'የንብረት ብዛት',
  assetValue: 'የንብረት ዋጋ',
  assignments: 'ምደባዎች',
  maintenance: 'ጥገና',
  transfers: 'ዝውውሮች',
  users: 'ተጠቃሚዎች',

  activeUsers: 'ንቁ ተጠቃሚዎች',
  activity: 'እንቅስቃሴ',

  overview: 'አጠቃላይ እይታ',
  assetTrend: 'የንብረት አዝማሚያ',
  assignmentTrend: 'የምደባ አዝማሚያ',
  maintenanceTrend: 'የጥገና አዝማሚያ',
  transferTrend: 'የዝውውር አዝማሚያ',
  procurementTrend: 'የግዢ አዝማሚያ',
  financialTrend: 'የፋይናንስ አዝማሚያ',
  departmentPerformance:
    'የክፍል አፈጻጸም',

  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allLocations: 'ሁሉም ቦታዎች',
  allStatus: 'ሁሉም ሁኔታዎች',

  inUse: 'በመጠቀም ላይ',
  lost: 'ጠፍቷል',

  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',

  search: 'ፈልግ',
  searchReports:
    'በሪፖርት መዝገቦች ውስጥ ፈልግ...',

  excel: 'Excel',
  csv: 'CSV',
  pdf: 'PDF',
  print: 'አትም',
  refresh: 'አድስ',

  applyFilters: 'ማጣሪያ ተግብር',
  clearFilters: 'ማጣሪያ አጽዳ',
  clearAll: 'ሁሉንም አጽዳ',

  activeFilters: 'ንቁ ማጣሪያዎች',

  loading: 'በመጫን ላይ...',
  loadingDescription:
    'የሪፖርት መረጃ በመፍጠር ላይ። እባክዎ ይጠብቁ።',

  noData: 'ምንም መረጃ የለም',
  noDataDescription:
    'በተመረጡት ሪፖርት እና ማጣሪያዎች መሰረት ምንም መዝገብ አልተገኘም።',

  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  records: 'መዝገቦች',

  totalAssets: 'ጠቅላላ ንብረቶች',
  totalDepartments: 'ጠቅላላ ክፍሎች',
  totalUsers: 'ጠቅላላ ተጠቃሚዎች',
  totalAssignments: 'ጠቅላላ ምደባዎች',
  activeAssignments: 'ንቁ ምደባዎች',
  totalTransfers: 'ጠቅላላ ዝውውሮች',
  totalRequests: 'ጠቅላላ ጥያቄዎች',
  totalCost: 'ጠቅላላ ወጪ',
  totalScans: 'ጠቅላላ ቅኝቶች',
  anomalies: 'ያልተለመዱ',
  uniqueAssets: 'ልዩ ንብረቶች',
  totalPurchase: 'ጠቅላላ የግዢ ዋጋ',
  totalCurrentValue:
    'አሁን ያለው ጠቅላላ ዋጋ',
  totalDepreciation:
    'ጠቅላላ የዋጋ ቅናሽ',
  totalRecords: 'ጠቅላላ መዝገቦች',

  reportType: 'የሪፖርት አይነት',
  generated: 'የተፈጠረ',

  exportSuccess:
    'ሪፖርቱ በተሳካ ሁኔታ ወጥቷል',

  loadFailed:
    'የሪፖርት መረጃ ማግኘት አልተቻለም',
};

export default AdminReports;