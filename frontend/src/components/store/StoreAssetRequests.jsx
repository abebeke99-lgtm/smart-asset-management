/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  CheckCircle,
  CircleX,
  Clock,
  Eye,
  History,
  LoaderCircle,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  X,
  XCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { getDepartmentLabel } from '../../utils/department';
import { apiClient } from '../../utils/api';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.assets)) return payload.assets;
  if (Array.isArray(payload?.departments)) return payload.departments;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const fetchPages = async (url, pageSize, readItems, pageCount) => {
  const firstPage = await apiClient.get(url, {
    params: { page: 1, limit: pageSize, ...pageCount.firstParams }
  });
  const firstPayload = firstPage.data ?? firstPage;
  const pages = Number(pageCount.pages(firstPayload)) || 1;
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => apiClient.get(url, {
      params: { page: index + 2, limit: pageSize, ...pageCount.nextParams }
    }))
  );
  return [
    ...readItems(firstPayload),
    ...remainingPages.flatMap((response) => readItems(response.data ?? response))
  ];
};

const fetchAssets = () => fetchPages(
  '/api/assets',
  50,
  (response) => normalizeListResponse(response),
  {
    firstParams: {},
    nextParams: {},
    pages: (response) => response?.pagination?.pages || response?.data?.pagination?.pages || response?.pages || 1
  }
);

const fetchUsers = () => fetchPages(
  '/api/users',
  100,
  (response) => normalizeListResponse(response),
  {
    firstParams: {},
    nextParams: {},
    pages: (response) => response?.pagination?.pages || response?.data?.pagination?.pages || response?.pages || 1
  }
);

const fetchDepartments = () => fetchPages(
  '/api/departments',
  100,
  (response) => normalizeListResponse(response),
  {
    firstParams: {},
    nextParams: {},
    pages: (response) => response?.pagination?.pages || response?.data?.pagination?.pages || response?.pages || 1
  }
);

const fetchApprovalRequests = () => fetchPages(
  '/api/approvals',
  100,
  (response) => Array.isArray(response?.requests) ? response.requests : [],
  {
    firstParams: {},
    nextParams: {},
    pages: (response) => response?.pagination?.pages || 1
  }
);

const StoreAssetRequests = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [formErrors, setFormErrors] = useState({});

  const [activeTab, setActiveTab] = useState('new');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const selectedRequestId = useRef(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [form, setForm] = useState({
    assetId: '',
    quantity: 1,
    departmentId: '',
    requestedFor: '',
    priority: 'Normal',
    requiredDate: '',
    purpose: '',
    remarks: ''
  });

  const t = isAmharic
    ? {
        title: 'የንብረት ጥያቄዎች',
        subtitle: 'የንብረት ጥያቄዎችን መፍጠር፣ መከታተል እና ማስተዳደር',
        newRequests: 'አዲስ ጥያቄ',
        pending: 'በመጠባበቅ ላይ',
        approved: 'የጸደቁ',
        rejected: 'የተከለከሉ',
        details: 'ዝርዝር',
        history: 'የጥያቄ ታሪክ',
        createRequest: 'ጥያቄ ፍጠር',
        asset: 'ንብረት',
        quantity: 'ብዛት',
        department: 'ክፍል',
        requestedFor: 'ለተጠቃሚ',
        priority: 'ቅድሚያ',
        requiredDate: 'የሚያስፈልግበት ቀን',
        purpose: 'ዓላማ',
        remarks: 'ማስታወሻ',
        selectAsset: 'ንብረት ይምረጡ',
        selectDepartment: 'ክፍል ይምረጡ',
        selectUser: 'ተጠቃሚ ይምረጡ',
        normal: 'መደበኛ',
        high: 'ከፍተኛ',
        urgent: 'አስቸኳይ',
        submit: 'ጥያቄ ላክ',
        submitting: 'በመላክ ላይ...',
        search: 'ፈልግ...',
        all: 'ሁሉም',
        pendingStatus: 'በመጠባበቅ ላይ',
        approvedStatus: 'ጸድቋል',
        rejectedStatus: 'ተከልክሏል',
        cancelled: 'ተሰርዟል',
        requestId: 'የጥያቄ መለያ',
        requester: 'ጠያቂ',
        date: 'ቀን',
        status: 'ሁኔታ',
        actions: 'ተግባራት',
        view: 'ይመልከቱ',
        approve: 'አጽድቅ',
        reject: 'ከልክል',
        close: 'ዝጋ',
        discardConfirm: 'ያልተላኩ ለውጦችን ሳይቀመጡ መውጣት ይፈልጋሉ?',
        previous: 'ቀዳሚ',
        next: 'ቀጣይ',
        page: 'ገጽ',
        noRequests: 'ምንም ጥያቄ አልተገኘም',
        loading: 'በመጫን ላይ...',
        success: 'የንብረት ጥያቄ በተሳካ ሁኔታ ተፈጥሯል',
        retry: 'እንደገና ይሞክሩ',
        approveSuccess: 'ጥያቄው ጸድቋል',
        rejectSuccess: 'ጥያቄው ተከልክሏል',
        fulfill: 'ማሟላት',
        fulfilled: 'ተሟልቷል',
        fulfillSuccess: 'ጥያቄው ተሟልቷል',
        cancelRequest: 'ጥያቄ ሰርዝ',
        cancelReason: 'ምክንያት ያስገቡ...',
        cancelSuccess: 'ጥያቄው ተሰርዟል',
        error: 'ሂደቱ አልተሳካም',
        loadFailed: 'የጥያቄ መረጃን መጫን አልተቻለም። እንደገና ይሞክሩ።',
        reason: 'ምክንያት',
        rejectionReason: 'የመከልከያ ምክንያት',
        enterReason: 'ምክንያት ያስገቡ...',
        requestDetails: 'የጥያቄ ዝርዝር',
        createdAt: 'የተፈጠረበት ቀን',
        updatedAt: 'የተሻሻለበት ቀን'
      }
    : {
        title: 'Asset Requests',
        subtitle: 'Create, track, review, and manage asset requests',
        newRequests: 'New Requests',
        pending: 'Pending Requests',
        approved: 'Approved Requests',
        rejected: 'Rejected Requests',
        details: 'Request Details',
        history: 'Request History',
        createRequest: 'Create New Request',
        asset: 'Asset',
        quantity: 'Quantity',
        department: 'Department',
        requestedFor: 'Requested For',
        priority: 'Priority',
        requiredDate: 'Required Date',
        purpose: 'Purpose',
        remarks: 'Remarks',
        selectAsset: 'Select Asset',
        selectDepartment: 'Select Department',
        selectUser: 'Select User',
        normal: 'Normal',
        high: 'High',
        urgent: 'Urgent',
        submit: 'Submit Request',
        submitting: 'Submitting...',
        search: 'Search requests...',
        all: 'All',
        pendingStatus: 'Pending',
        approvedStatus: 'Approved',
        rejectedStatus: 'Rejected',
        cancelled: 'Cancelled',
        requestId: 'Request ID',
        requester: 'Requester',
        date: 'Date',
        status: 'Status',
        actions: 'Actions',
        view: 'View',
        approve: 'Approve',
        reject: 'Reject',
        close: 'Close',
        discardConfirm: 'Discard your unsaved request changes?',
        previous: 'Previous',
        next: 'Next',
        page: 'Page',
        noRequests: 'No requests found',
        loading: 'Loading...',
        success: 'Asset request created successfully',
        retry: 'Retry',
        approveSuccess: 'Request approved successfully',
        rejectSuccess: 'Request rejected',
        fulfill: 'Fulfill',
        fulfilled: 'Fulfilled',
        fulfillSuccess: 'Request fulfilled successfully',
        cancelRequest: 'Cancel Request',
        cancelReason: 'Cancellation reason',
        cancelSuccess: 'Request cancelled successfully',
        error: 'Operation failed',
        loadFailed: 'Unable to load request data. Please try again.',
        reason: 'Reason',
        rejectionReason: 'Rejection Reason',
        enterReason: 'Enter reason...',
        requestDetails: 'Request Details',
        createdAt: 'Created At',
        updatedAt: 'Updated At'
      };

  const normalizeRequests = (data) => {
    if (Array.isArray(data)) return data;

    return (
      data?.requests ||
      data?.data ||
      data?.assetRequests ||
      data?.asset_requests ||
      []
    );
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const [requestsRes, assetsRes, usersRes, departmentsRes] = await Promise.allSettled([
      Promise.resolve().then(fetchApprovalRequests),
      Promise.resolve().then(fetchAssets),
      Promise.resolve().then(fetchUsers),
      Promise.resolve().then(fetchDepartments)
    ]);

    if (requestsRes.status === 'fulfilled') {
      setRequests(normalizeRequests(requestsRes.value));
    } else {
      setRequests([]);
      setLoadError(true);
      toast.error(t.error);
    }

    if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value);
    if (usersRes.status === 'fulfilled') setUsers(usersRes.value);
    if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value);

    setLoading(false);
  }, [t.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRequestId = (request) =>
    request?.id ||
    request?.request_id ||
    request?.requestId;

  const getStatus = (request) => {
    const status = String(
      request?.status ||
        request?.request_status ||
        request?.approval_status ||
        'Pending'
    ).trim();

    const normalized = status.toLowerCase();

    if (normalized === 'pending') return 'Pending';
    if (normalized === 'approved' || normalized === 'approve') return 'Approved';
    if (normalized === 'rejected' || normalized === 'reject') return 'Rejected';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';

    return status || 'Pending';
  };

  const getAssetName = (request) =>
    request?.asset_name ||
    request?.assetName ||
    request?.name ||
    assets.find(
      (a) =>
        String(a.id) === String(request?.asset_id) ||
        String(a.id) === String(request?.assetId)
    )?.name ||
    'Unknown Asset';

  const getRequesterName = (request) =>
    request?.requester_name ||
    request?.requesterName ||
    request?.user_name ||
    request?.userName ||
    request?.requested_by_name ||
    request?.requestedByName ||
    users.find(
      (u) =>
        String(u.id) ===
        String(
          request?.requested_by ||
            request?.requestedBy ||
            request?.user_id
        )
    )?.full_name ||
    'Unknown';

  const getDepartmentName = (request) => {
    const department =
      request?.department ||
      request?.department_name ||
      request?.departmentName;

    if (department) {
      return getDepartmentLabel(department) || department;
    }

    return (
      departments.find(
        (d) =>
          String(d.id) ===
          String(
            request?.department_id ||
              request?.departmentId
          )
      )?.name || '-'
    );
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const status = getStatus(request);

      const matchesStatus =
        activeTab === 'history'
          ? statusFilter === 'all' || status.toLowerCase() === statusFilter.toLowerCase()
          : activeTab === 'pending'
            ? status === 'Pending'
            : activeTab === 'approved'
              ? status === 'Approved'
              : activeTab === 'rejected'
                ? status === 'Rejected'
                : activeTab === 'cancelled'
                  ? status === 'Cancelled'
                  : false;

      if (!matchesStatus) return false;

      if (!query) return true;

      const searchable = [
        getRequestId(request),
        getAssetName(request),
        getRequesterName(request),
        getDepartmentName(request),
        request?.purpose,
        request?.remarks,
        status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    requests,
    search,
    statusFilter,
    activeTab,
    assets,
    users,
    departments
  ]);

  const pendingRequests = useMemo(() => requests.filter((request) => getStatus(request) === 'Pending'), [requests]);
  const approvedRequests = useMemo(() => requests.filter((request) => getStatus(request) === 'Approved'), [requests]);
  const rejectedRequests = useMemo(() => requests.filter((request) => getStatus(request) === 'Rejected'), [requests]);
  const cancelledRequests = useMemo(() => requests.filter((request) => getStatus(request) === 'Cancelled'), [requests]);

  const formIsDirty = Boolean(
    form.assetId ||
    Number(form.quantity) !== 1 ||
    form.departmentId ||
    form.requestedFor ||
    form.priority !== 'Normal' ||
    form.requiredDate ||
    form.purpose.trim() ||
    form.remarks.trim()
  );

  const resetForm = () => {
    setForm({
      assetId: '',
      quantity: 1,
      departmentId: '',
      requestedFor: '',
      priority: 'Normal',
      requiredDate: '',
      purpose: '',
      remarks: ''
    });
    setFormErrors({});
  };

  const changeTab = (nextTab) => {
    if (nextTab === activeTab) return;
    if (activeTab === 'new' && formIsDirty && !window.confirm(t.discardConfirm)) return;
    setActiveTab(nextTab);
    setPage(1);
    if (activeTab === 'new') resetForm();
  };

  useEffect(() => {
    if (activeTab !== 'new') return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') changeTab('history');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeTab, formIsDirty, t.discardConfirm]);

  const setFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!form.assetId) {
      errors.assetId = t.selectAsset;
    }
    if (!form.departmentId) {
      errors.departmentId = t.selectDepartment;
    }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      errors.quantity = isAmharic ? 'እባክዎ አዎንታዊ ሙሉ ቁጥር ያስገቡ' : 'Enter a valid quantity';
    }
    if (!form.purpose.trim()) {
      errors.purpose = isAmharic ? 'እባክዎ ዓላማውን ያስገቡ' : 'Purpose is required';
    }
    const selectedAsset = assets.find((asset) => String(asset.id) === String(form.assetId));
    const availableStock = Number(selectedAsset?.availableQuantity ?? selectedAsset?.available_quantity ?? 0);
    if (!errors.quantity && selectedAsset && quantity > availableStock) {
      errors.quantity = isAmharic
        ? `ከሚገኘው ብዛት (${availableStock}) በላይ መጠየቅ አይቻልም`
        : `Quantity exceeds available stock (${availableStock})`;
    }
    if (Object.values(errors).some(Boolean)) {
      setFormErrors(errors);
      toast.error(Object.values(errors).find(Boolean));
      return;
    }

    setProcessing(true);

    try {
      await apiClient.post('/api/approvals', {
        type: 'asset_issue',
        asset_id: form.assetId,
        item: selectedAsset?.name || selectedAsset?.asset_name || 'Asset Request',
        quantity,
        department_id: form.departmentId,
        requested_for: form.requestedFor || null,
        priority: String(form.priority || 'Normal').toLowerCase(),
        required_date: form.requiredDate || null,
        reason: form.purpose.trim(),
        comment: form.remarks.trim()
      });

      toast.success(t.success);
      resetForm();
      await fetchData();
      setActiveTab('pending');
      setPage(1);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (request) => {
    const id = getRequestId(request);

    if (!id) return;

    setProcessing(true);

    try {
      await apiClient.patch(`/api/approvals/${id}`, {
        status: 'approved',
        comment: request?.approval_comment || request?.comment || 'Approved by Store Manager'
      });

      toast.success(t.approveSuccess);

      setShowDetails(false);
      setSelectedRequest(null);

      await fetchData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request) => {
    const id = getRequestId(request);

    if (!id) return;

    const reason = window.prompt(t.rejectionReason);

    if (reason === null) return;

    if (!reason.trim()) {
      toast.error(t.enterReason);
      return;
    }

    setProcessing(true);

    try {
      await apiClient.patch(`/api/approvals/${id}`, {
        status: 'rejected',
        reason: reason.trim(),
        comment: reason.trim()
      });

      toast.success(t.rejectSuccess);

      setShowDetails(false);
      setSelectedRequest(null);

      await fetchData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleFulfill = async (request) => {
    const id = getRequestId(request);
    if (!id) return;

    setProcessing(true);
    try {
      await apiClient.post(`/api/assignments/fulfill-request/${id}`);
      toast.success(t.fulfillSuccess);
      setShowDetails(false);
      setSelectedRequest(null);
      await fetchData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelApproved = async (request) => {
    const id = getRequestId(request);
    if (!id) return;

    const reason = window.prompt(t.cancelReason);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error(t.enterReason);
      return;
    }

    setProcessing(true);
    try {
      await apiClient.patch(`/api/approvals/${id}`, {
        status: 'cancelled',
        reason: reason.trim(),
        comment: reason.trim()
      });
      toast.success(t.cancelSuccess);
      setShowDetails(false);
      setSelectedRequest(null);
      await fetchData();
      setActiveTab('cancelled');
      setPage(1);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = async (request) => {
    selectedRequestId.current = request.id;
    setSelectedRequest(request);
    setRequestHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    setShowDetails(true);
    try {
      const response = await apiClient.get(`/api/approvals/${request.id}`);
      if (selectedRequestId.current !== request.id) return;
      const detail = response.data?.request || response.data?.approval;
      setRequestHistory(Array.isArray(detail?.history) ? detail.history : []);
      if (detail) setSelectedRequest((current) => current?.id === request.id ? { ...current, ...detail } : current);
    } catch (error) {
      if (selectedRequestId.current === request.id) {
        setHistoryError(error?.response?.data?.message || t.loadFailed);
      }
    } finally {
      if (selectedRequestId.current === request.id) setHistoryLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return parsed.toLocaleDateString(
      isAmharic ? 'am-ET' : 'en-US'
    );
  };

  const statusStyle = (status) => {
    const normalized = String(status).toLowerCase();

    if (normalized === 'approved') {
      return {
        background: isDark ? '#123c2a' : '#dcfce7',
        color: isDark ? '#86efac' : '#15803d'
      };
    }

    if (normalized === 'rejected') {
      return {
        background: isDark ? '#451a1a' : '#fee2e2',
        color: isDark ? '#fca5a5' : '#b91c1c'
      };
    }

    if (normalized === 'cancelled') {
      return {
        background: isDark ? '#3b2f10' : '#fef3c7',
        color: isDark ? '#fcd34d' : '#92400e'
      };
    }

    return {
      background: isDark ? '#172554' : '#EAF2FA',
      color: isDark ? '#93c5fd' : '#245783'
    };
  };

  const priorityStyle = (priority) => {
    const normalized = String(priority).toLowerCase();

    if (normalized === 'urgent') {
      return {
        background: isDark ? '#450a0a' : '#fee2e2',
        color: isDark ? '#fca5a5' : '#dc2626'
      };
    }

    if (normalized === 'high') {
      return {
        background: isDark ? '#431407' : '#ffedd5',
        color: isDark ? '#fdba74' : '#ea580c'
      };
    }

    return {
      background: isDark ? '#172554' : '#EAF2FA',
      color: isDark ? '#93c5fd' : '#3074B3'
    };
  };

  const cardStyle = {
    background: isDark ? '#172338' : '#ffffff',
    border: `1px solid ${
      isDark ? '#293b56' : '#e2e8f0'
    }`,
    borderRadius: 14,
    boxShadow: isDark
      ? '0 8px 24px rgba(0,0,0,.25)'
      : '0 6px 20px rgba(15,23,42,.06)'
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 8,
    border: `1px solid ${
      isDark ? '#3a4c66' : '#cbd5e1'
    }`,
    background: isDark ? '#0f1a2b' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 700,
    color: isDark ? '#b7c6da' : '#475569'
  };

  const tabs = [
    { id: 'new', label: t.newRequests, shortLabel: 'New', Icon: PlusCircle, count: null },
    { id: 'pending', label: t.pending, shortLabel: 'Pending', Icon: Clock, count: pendingRequests.length },
    { id: 'approved', label: t.approved, shortLabel: 'Approved', Icon: CheckCircle, count: approvedRequests.length },
    { id: 'rejected', label: t.rejected, shortLabel: 'Rejected', Icon: XCircle, count: rejectedRequests.length },
    { id: 'cancelled', label: t.cancelled, shortLabel: 'Cancelled', Icon: Ban, count: cancelledRequests.length },
    { id: 'history', label: t.history, shortLabel: 'History', Icon: History, count: requests.length }
  ];

  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const tableRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);
  const selectedAsset = assets.find((asset) => String(asset.id) === String(form.assetId));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pages));
  }, [pages]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: 24,
          background: isDark
            ? '#0d1726'
            : '#F5F7FA',
          color: isDark
            ? '#e2e8f0'
            : '#1e293b'
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: 50,
            textAlign: 'center'
          }}
        >
          <LoaderCircle size={36} aria-label={t.loading} />
          <h3>{t.loading}</h3>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: isDark
          ? '#0d1726'
          : '#F5F7FA',
        color: isDark
          ? '#e2e8f0'
          : '#1e293b'
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 22
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.8rem',
              fontWeight: 800
            }}
          >
            {t.title}
          </h1>

          <p
            style={{
              margin: '7px 0 0',
              color: isDark
                ? '#94a3b8'
                : '#64748b'
            }}
          >
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          aria-label="Create new request button"
          onClick={() => {
            changeTab('new');
          }}
          style={{
            border: 'none',
            borderRadius: 9,
            padding: '11px 18px',
            background:
              '#3074B3',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          <PlusCircle size={18} aria-hidden="true" /> {t.newRequests}
        </button>
      </div>

      {loadError && (
        <div role="alert" style={{ ...cardStyle, marginBottom: 18, padding: 16, color: '#b91c1c' }}>
          <span>{t.loadFailed}</span>
          <button type="button" onClick={fetchData} style={{ marginLeft: 12 }}>{t.retry}</button>
        </div>
      )}

      {/* SUMMARY */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(180px,1fr))',
          gap: 14,
          marginBottom: 22
        }}
      >
        {tabs.map(({ id, Icon, count, label, shortLabel }) => (
          <button
            key={id}
            type="button"
            aria-label={`${shortLabel} overview`}
            aria-pressed={activeTab === id}
            onClick={() => changeTab(id)}
            style={{
              ...cardStyle,
              padding: 18,
              display: 'block',
              textAlign: 'left',
              color: isDark ? '#e2e8f0' : '#1e293b',
              cursor: 'pointer',
              borderColor: activeTab === id ? '#3074B3' : undefined,
              boxShadow: activeTab === id ? '0 0 0 2px rgba(48,116,179,.18)' : cardStyle.boxShadow
            }}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                marginTop: 5
              }}
            >
              {count === null ? '—' : count}
            </div>

            <div
              style={{
                color: isDark
                  ? '#94a3b8'
                  : '#64748b',
                fontSize: 13
              }}
            >
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* TABS */}
      <div
        role="tablist"
        aria-label="Request status"
        style={{
          ...cardStyle,
          padding: 6,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          marginBottom: 20
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={`${tab.label} tab`}
            onClick={() => changeTab(tab.id)}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 15px',
              cursor: 'pointer',
              fontWeight: 700,
              background:
                activeTab === tab.id
                  ? isDark
                    ? '#263d5c'
                    : '#EAF2FA'
                  : 'transparent',
              color:
                activeTab === tab.id
                  ? isDark
                    ? '#93c5fd'
                    : '#245783'
                  : isDark
                  ? '#94a3b8'
                  : '#64748b'
            }}
          >
            <tab.Icon size={16} strokeWidth={2} aria-hidden="true" />
            {tab.label}

            {tab.count !== null && (
              <span
                style={{
                  marginLeft: 7,
                  padding: '2px 7px',
                  borderRadius: 20,
                  fontSize: 11,
                  background:
                    isDark
                      ? '#334155'
                      : '#e2e8f0'
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* NEW REQUEST */}
      {activeTab === 'new' && (
        <div
          style={{
            ...cardStyle,
            padding: 24
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 20
            }}
          >
            <PlusCircle size={20} aria-hidden="true" /> {t.createRequest}
          </h2>

          <form onSubmit={handleCreateRequest}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(230px,1fr))',
                gap: 18
              }}
            >
              <div>
                <label htmlFor="asset-request-asset" style={labelStyle}>
                  {t.asset} *
                </label>

                <select
                  id="asset-request-asset"
                  value={form.assetId}
                  onChange={(e) => setFormField('assetId', e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {`#${asset.id} ${asset.assetCode || asset.asset_tag || ''} — ${asset.name || asset.asset_name || 'Unnamed Asset'} (${asset.availableQuantity ?? asset.available_quantity ?? 0} available)`}
                    </option>
                  ))}
                </select>
                {selectedAsset && (
                  <small style={{ display: 'block', marginTop: 5, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {selectedAsset.availableQuantity ?? selectedAsset.available_quantity ?? 0} {t.quantity.toLowerCase()} available
                  </small>
                )}
                {formErrors.assetId && <small role="alert" style={{ color: '#dc2626' }}>{formErrors.assetId}</small>}
              </div>

              <div>
                <label htmlFor="asset-request-quantity" style={labelStyle}>
                  {t.quantity} *
                </label>

                <input
                  id="asset-request-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setFormField('quantity', e.target.value)}
                  style={inputStyle}
                  required
                />
                {formErrors.quantity && <small role="alert" style={{ color: '#dc2626' }}>{formErrors.quantity}</small>}
              </div>

              <div>
                <label htmlFor="asset-request-department" style={labelStyle}>
                  {t.department} *
                </label>

                <select
                  id="asset-request-department"
                  value={form.departmentId}
                  onChange={(e) => setFormField('departmentId', e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">
                    {t.selectDepartment}
                  </option>

                  {departments.filter((department) => !['inactive', 'suspended', 'deleted'].includes(String(department.status || '').toLowerCase())).map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {getDepartmentLabel(
                        department
                      ) || department.name}
                    </option>
                  ))}
                </select>
                {formErrors.departmentId && <small role="alert" style={{ color: '#dc2626' }}>{formErrors.departmentId}</small>}
              </div>

              <div>
                <label htmlFor="asset-request-beneficiary" style={labelStyle}>
                  {t.requestedFor}
                </label>

                <select
                  id="asset-request-beneficiary"
                  value={form.requestedFor}
                  onChange={(e) => setFormField('requestedFor', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">
                    {t.selectUser}
                  </option>

                  {users.map((u) => (
                    <option
                      key={u.id}
                      value={u.id}
                    >
                      {u.fullName ||
                        u.full_name ||
                        u.name ||
                        u.username ||
                        `User #${u.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="asset-request-priority" style={labelStyle}>
                  {t.priority}
                </label>

                <select
                  id="asset-request-priority"
                  value={form.priority}
                  onChange={(e) => setFormField('priority', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Normal">
                    {t.normal}
                  </option>
                  <option value="High">
                    {t.high}
                  </option>
                  <option value="Urgent">
                    {t.urgent}
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="asset-request-required-date" style={labelStyle}>
                  {t.requiredDate}
                </label>

                <input
                  id="asset-request-required-date"
                  type="date"
                  min={today}
                  value={form.requiredDate}
                  onChange={(e) => setFormField('requiredDate', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label htmlFor="asset-request-purpose" style={labelStyle}>
                {t.purpose}
              </label>

              <textarea
                id="asset-request-purpose"
                value={form.purpose}
                onChange={(e) => setFormField('purpose', e.target.value)}
                maxLength={5000}
                required
                style={{
                  ...inputStyle,
                  minHeight: 90,
                  resize: 'vertical'
                }}
              />
              {formErrors.purpose && <small role="alert" style={{ color: '#dc2626' }}>{formErrors.purpose}</small>}
            </div>

            <div style={{ marginTop: 18 }}>
              <label htmlFor="asset-request-remarks" style={labelStyle}>
                {t.remarks}
              </label>

              <textarea
                id="asset-request-remarks"
                value={form.remarks}
                onChange={(e) => setFormField('remarks', e.target.value)}
                maxLength={5000}
                style={{
                  ...inputStyle,
                  minHeight: 80,
                  resize: 'vertical'
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 22
              }}
            >
              <button
                type="button"
                onClick={() => changeTab('history')}
                style={{
                  padding: '11px 18px',
                  borderRadius: 8,
                  border: `1px solid ${
                    isDark
                      ? '#475569'
                      : '#cbd5e1'
                  }`,
                  background: 'transparent',
                  color: isDark
                    ? '#cbd5e1'
                    : '#475569',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <X size={16} aria-hidden="true" /> {t.close}
              </button>

              <button
                type="submit"
                disabled={processing}
                style={{
                  padding: '11px 20px',
                  border: 'none',
                  borderRadius: 8,
                  background:
                    '#3074B3',
                  color: '#fff',
                  cursor: processing
                    ? 'not-allowed'
                    : 'pointer',
                  fontWeight: 800,
                  opacity: processing ? 0.7 : 1
                }}
              >
                {processing
                  ? t.submitting
                  : <><Send size={16} aria-hidden="true" /> {t.submit}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIST VIEWS */}
      {activeTab !== 'new' && (
        <div
          style={{
            ...cardStyle,
            padding: 20
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 15,
              flexWrap: 'wrap',
              marginBottom: 18
            }}
          >
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {(() => {
                const currentTab = tabs.find((tab) => tab.id === activeTab);
                const Icon = currentTab?.Icon || History;
                return <><Icon size={20} aria-hidden="true" /> {currentTab?.label || t.history}</>;
              })()}
            </h2>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <label style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 10, color: isDark ? '#94a3b8' : '#64748b' }} />
                <input
                  aria-label={t.search}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t.search}
                  style={{ ...inputStyle, width: 230, paddingLeft: 34 }}
                />
              </label>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                aria-label={t.retry}
                title={t.retry}
                style={{ ...inputStyle, width: 'auto', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={16} aria-hidden="true" /> {t.retry}
              </button>

              {activeTab === 'history' && (
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{
                    ...inputStyle,
                    width: 150
                  }}
                >
                  <option value="all">
                    {t.all}
                  </option>
                  <option value="Pending">
                    {t.pendingStatus}
                  </option>
                  <option value="Approved">
                    {t.approvedStatus}
                  </option>
                  <option value="Rejected">
                    {t.rejectedStatus}
                  </option>
                  <option value="Cancelled">
                    {t.cancelled}
                  </option>
                </select>
              )}
            </div>
          </div>

          <div
            style={{
              overflowX: 'auto'
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 950,
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr
                  style={{
                    background: isDark
                      ? '#0f1a2b'
                      : '#F5F7FA'
                  }}
                >
                  {[
                    t.requestId,
                    t.asset,
                    t.requester,
                    t.department,
                    t.quantity,
                    t.priority,
                    t.date,
                    t.status,
                    t.actions
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: '12px 10px',
                        textAlign: 'left',
                        fontSize: 12,
                        color: isDark
                          ? '#cbd5e1'
                          : '#475569',
                        borderBottom: `1px solid ${
                          isDark
                            ? '#293b56'
                            : '#e2e8f0'
                        }`
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {tableRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      style={{
                        padding: 50,
                        textAlign: 'center',
                        color: isDark
                          ? '#94a3b8'
                          : '#64748b'
                      }}
                    >
                      {t.noRequests}
                    </td>
                  </tr>
                ) : (
                  tableRequests.map((request) => {
                    const id =
                      getRequestId(request);

                    const status =
                      getStatus(request);
                    const isAssetIssueRequest =
                      String(request?.type || '').toLowerCase().includes('issue') &&
                      Boolean(request?.assetId || request?.asset_id);

                    return (
                      <tr
                        key={id}
                        style={{
                          borderBottom: `1px solid ${
                            isDark
                              ? '#293b56'
                              : '#eef2f7'
                          }`
                        }}
                      >
                        <td
                          style={{
                            padding: 12,
                            fontWeight: 700
                          }}
                        >
                          #{id}
                        </td>

                        <td style={{ padding: 12 }}>
                          <div
                            style={{
                              fontWeight: 700
                            }}
                          >
                            {getAssetName(
                              request
                            )}
                          </div>

                          {request.asset_tag && (
                            <div
                              style={{
                                fontSize: 12,
                                color: isDark
                                  ? '#94a3b8'
                                  : '#64748b'
                              }}
                            >
                              {request.asset_tag}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 12 }}>
                          {getRequesterName(
                            request
                          )}
                        </td>

                        <td style={{ padding: 12 }}>
                          {getDepartmentName(
                            request
                          )}
                        </td>

                        <td style={{ padding: 12 }}>
                          {request.quantity || 1}
                        </td>

                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              ...priorityStyle(
                                request.priority ||
                                  'Normal'
                              ),
                              display:
                                'inline-block',
                              padding:
                                '4px 9px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800
                            }}
                          >
                            {request.priority ||
                              t.normal}
                          </span>
                        </td>

                        <td style={{ padding: 12 }}>
                          {formatDate(
                            request.created_at ||
                              request.createdAt ||
                              request.request_date
                          )}
                        </td>

                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              ...statusStyle(
                                status
                              ),
                              display:
                                'inline-block',
                              padding:
                                '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        <td style={{ padding: 12 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openDetails(
                                  request
                                )
                              }
                              style={{
                                border: 'none',
                                borderRadius: 6,
                                padding:
                                  '6px 10px',
                                background:
                                  '#3074B3',
                                color: '#fff',
                                cursor:
                                  'pointer',
                                fontWeight: 700
                              }}
                            >
                              <Eye size={15} aria-hidden="true" /> {t.view}
                            </button>

                            {status ===
                              'Pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    processing
                                  }
                                  onClick={() =>
                                    handleApprove(
                                      request
                                    )
                                  }
                                  style={{
                                    border:
                                      'none',
                                    borderRadius: 6,
                                    padding:
                                      '6px 10px',
                                    background:
                                      '#16a34a',
                                    color: '#fff',
                                    cursor:
                                      'pointer',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  <CheckCircle size={15} aria-hidden="true" /> {t.approve}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    processing
                                  }
                                  onClick={() =>
                                    handleReject(
                                      request
                                    )
                                  }
                                  style={{
                                    border:
                                      'none',
                                    borderRadius: 6,
                                    padding:
                                      '6px 10px',
                                    background:
                                      '#dc2626',
                                    color: '#fff',
                                    cursor:
                                      'pointer',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  <XCircle size={15} aria-hidden="true" /> {t.reject}
                                </button>
                              </>
                            )}
                            {status === 'Approved' && isAssetIssueRequest && (
                              request.fulfilledAt || request.fulfilled_at ? (
                                <span
                                  style={{
                                    padding: '6px 10px',
                                    color: '#15803d',
                                    fontWeight: 700
                                  }}
                                >
                                  {t.fulfilled}
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => handleFulfill(request)}
                                    style={{
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '6px 10px',
                                      background: '#7c3aed',
                                      color: '#fff',
                                      cursor: processing ? 'wait' : 'pointer',
                                      fontWeight: 700
                                    }}
                                  >
                                    {t.fulfill}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => handleCancelApproved(request)}
                                    style={{
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '6px 10px',
                                      background: '#dc2626',
                                      color: '#fff',
                                      cursor: processing ? 'wait' : 'pointer',
                                      fontWeight: 700
                                    }}
                                  >
                                    <CircleX size={15} aria-hidden="true" />{' '}
                                    {t.cancelRequest}
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <span aria-live="polite">
              {t.page} {page} / {pages} · {filteredRequests.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)}>
                {t.previous}
              </button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((currentPage) => currentPage + 1)}>
                {t.next}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetails && selectedRequest && (
        <div
          role="dialog"
          aria-labelledby="asset-request-details-title"
          aria-modal="true"
          onClick={() => {
            setShowDetails(false);
            setSelectedRequest(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background:
              'rgba(0,0,0,.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: '100%',
              maxWidth: 700,
              maxHeight: '90vh',
              overflowY: 'auto',
              ...cardStyle,
              padding: 25
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                marginBottom: 20
              }}
            >
              <h2 id="asset-request-details-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={19} aria-hidden="true" /> {t.requestDetails}
              </h2>

              <button
                type="button"
                aria-label={t.close}
                title={t.close}
                onClick={() => {
                  setShowDetails(false);
                  setSelectedRequest(null);
                }}
                style={{
                  border: 'none',
                  background:
                    isDark
                      ? '#293b56'
                      : '#f1f5f9',
                  color: isDark
                    ? '#e2e8f0'
                    : '#334155',
                  borderRadius: 7,
                  padding: '7px 11px',
                  cursor: 'pointer',
                  fontSize: 18
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(210px,1fr))',
                gap: 15
              }}
            >
              {[
                [
                  t.requestId,
                  `#${getRequestId(
                    selectedRequest
                  )}`
                ],
                [
                  t.asset,
                  getAssetName(
                    selectedRequest
                  )
                ],
                [
                  t.requester,
                  getRequesterName(
                    selectedRequest
                  )
                ],
                [
                  t.requestedFor,
                  selectedRequest.requested_for_name ||
                    users.find(
                      (user) => String(user.id) === String(selectedRequest.requested_for || selectedRequest.requestedFor)
                    )?.full_name ||
                    '-'
                ],
                [
                  t.department,
                  getDepartmentName(
                    selectedRequest
                  )
                ],
                [
                  t.quantity,
                  selectedRequest.quantity ||
                    1
                ],
                [
                  t.priority,
                  selectedRequest.priority ||
                    t.normal
                ],
                [
                  t.status,
                  selectedRequest.lifecycleStatus === 'fulfilled'
                    ? t.fulfilled
                    : getStatus(
                    selectedRequest
                  )
                ],
                [
                  t.createdAt,
                  formatDate(
                    selectedRequest.created_at ||
                      selectedRequest.createdAt
                  )
                ],
                [
                  t.requiredDate,
                  formatDate(
                    selectedRequest.required_date ||
                      selectedRequest.requiredDate
                  )
                ]
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: 14,
                    borderRadius: 9,
                    background: isDark
                      ? '#0f1a2b'
                      : '#F5F7FA',
                    border: `1px solid ${
                      isDark
                        ? '#293b56'
                        : '#e2e8f0'
                    }`
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isDark
                        ? '#94a3b8'
                        : '#64748b',
                      marginBottom: 5
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontWeight: 700
                    }}
                  >
                    {value || '-'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={labelStyle}>
                {t.purpose}
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 9,
                  background: isDark
                    ? '#0f1a2b'
                    : '#F5F7FA',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedRequest.purpose ||
                  '-'}
              </div>
            </div>

            <div style={{ marginTop: 15 }}>
              <div style={labelStyle}>
                {t.remarks}
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 9,
                  background: isDark
                    ? '#0f1a2b'
                    : '#F5F7FA',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedRequest.remarks ||
                  '-'}
              </div>
            </div>

            <section style={{ marginTop: 18 }} aria-label={t.history}>
              <div style={labelStyle}>{t.history}</div>
              {historyLoading ? (
                <p role="status">{t.loading}</p>
              ) : historyError ? (
                <div role="alert">
                  <p>{historyError}</p>
                  <button type="button" onClick={() => openDetails(selectedRequest)}>{t.retry}</button>
                </div>
              ) : requestHistory.length ? (
                <ol>
                  {requestHistory.map((entry) => (
                    <li key={entry.id} style={{ marginBottom: 8 }}>
                      <strong>{entry.newStatus || entry.action || 'Updated'}</strong>
                      {' — '}{formatDate(entry.createdAt)}
                      {entry.comment && <div>{entry.comment}</div>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No request history has been recorded.</p>
              )}
            </section>

            {getStatus(
              selectedRequest
            ) === 'Rejected' && (
              <div style={{ marginTop: 15 }}>
                <div style={labelStyle}>
                  {t.rejectionReason}
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 9,
                    background: isDark
                      ? '#3b1616'
                      : '#fef2f2',
                    color: isDark
                      ? '#fca5a5'
                      : '#991b1b'
                  }}
                >
                  {selectedRequest.rejection_reason ||
                    selectedRequest.rejectionReason ||
                    '-'}
                </div>
              </div>
            )}

            {getStatus(
              selectedRequest
            ) === 'Pending' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'flex-end',
                  gap: 10,
                  marginTop: 25
                }}
              >
                <button
                  type="button"
                  disabled={processing}
                  onClick={() =>
                    handleReject(
                      selectedRequest
                    )
                  }
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    padding:
                      '10px 17px',
                    background:
                      '#dc2626',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  <XCircle size={15} aria-hidden="true" /> {t.reject}
                </button>

                <button
                  type="button"
                  disabled={processing}
                  onClick={() =>
                    handleApprove(
                      selectedRequest
                    )
                  }
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    padding:
                      '10px 17px',
                    background:
                      '#16a34a',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  <CheckCircle size={15} aria-hidden="true" /> {t.approve}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreAssetRequests;