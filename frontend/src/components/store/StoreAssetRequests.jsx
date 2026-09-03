import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { getDepartmentLabel } from '../../utils/department';

const StoreAssetRequests = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [activeTab, setActiveTab] = useState('new');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

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
        noRequests: 'ምንም ጥያቄ አልተገኘም',
        loading: 'በመጫን ላይ...',
        success: 'የንብረት ጥያቄ በተሳካ ሁኔታ ተፈጥሯል',
        approveSuccess: 'ጥያቄው ጸድቋል',
        rejectSuccess: 'ጥያቄው ተከልክሏል',
        error: 'ሂደቱ አልተሳካም',
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
        noRequests: 'No requests found',
        loading: 'Loading...',
        success: 'Asset request created successfully',
        approveSuccess: 'Request approved successfully',
        rejectSuccess: 'Request rejected',
        error: 'Operation failed',
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

    try {
      const results = await Promise.allSettled([
        axios.get('/api/asset-requests'),
        axios.get('/api/assets', {
          params: { limit: 500 }
        }),
        axios.get('/api/users', {
          params: { limit: 500 }
        }),
        axios.get('/api/departments')
      ]);

      const [requestsRes, assetsRes, usersRes, departmentsRes] = results;

      if (requestsRes.status === 'fulfilled') {
        setRequests(normalizeRequests(requestsRes.value.data));
      } else {
        setRequests([]);
      }

      if (assetsRes.status === 'fulfilled') {
        const assetData =
          assetsRes.value.data?.assets ||
          assetsRes.value.data?.data ||
          [];

        setAssets(Array.isArray(assetData) ? assetData : []);
      }

      if (usersRes.status === 'fulfilled') {
        const userData =
          usersRes.value.data?.users ||
          usersRes.value.data?.data ||
          [];

        setUsers(Array.isArray(userData) ? userData : []);
      }

      if (departmentsRes.status === 'fulfilled') {
        const deptData =
          departmentsRes.value.data?.departments ||
          departmentsRes.value.data?.data ||
          [];

        setDepartments(Array.isArray(deptData) ? deptData : []);
      }
    } catch (error) {
      console.error('Asset request loading error:', error);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
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
        'Pending'
    ).toLowerCase();

    if (status === 'pending') return 'Pending';
    if (status === 'approved' || status === 'approve') return 'Approved';
    if (status === 'rejected' || status === 'reject') return 'Rejected';
    if (status === 'cancelled' || status === 'canceled') return 'Cancelled';

    return request?.status || 'Pending';
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
        statusFilter === 'all' ||
        status.toLowerCase() === statusFilter.toLowerCase();

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
    assets,
    users,
    departments
  ]);

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) => getStatus(request) === 'Pending'
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter(
        (request) => getStatus(request) === 'Approved'
      ),
    [requests]
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          getStatus(request) === 'Rejected'
      ),
    [requests]
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
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      toast.error(t.selectAsset);
      return;
    }

    if (!form.departmentId) {
      toast.error(t.selectDepartment);
      return;
    }

    if (Number(form.quantity) <= 0) {
      toast.error(
        isAmharic
          ? 'እባክዎ ትክክለኛ ብዛት ያስገቡ'
          : 'Enter a valid quantity'
      );
      return;
    }

    setProcessing(true);

    try {
      await axios.post('/api/asset-requests', {
        asset_id: form.assetId,
        quantity: Number(form.quantity),
        department_id: form.departmentId,
        requested_for: form.requestedFor || null,
        requested_by: user?.id,
        priority: form.priority,
        required_date: form.requiredDate || null,
        purpose: form.purpose,
        remarks: form.remarks
      });

      toast.success(t.success);
      resetForm();
      await fetchData();
      setActiveTab('pending');
    } catch (error) {
      console.error('Create request error:', error);

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
      await axios.put(
        `/api/asset-requests/${id}/approve`,
        {
          approved_by: user?.id,
          remarks: request?.approval_remarks || ''
        }
      );

      toast.success(t.approveSuccess);

      setShowDetails(false);
      setSelectedRequest(null);

      await fetchData();
    } catch (error) {
      console.error('Approve request error:', error);

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

    const reason = window.prompt(
      t.rejectionReason
    );

    if (reason === null) return;

    if (!reason.trim()) {
      toast.error(t.enterReason);
      return;
    }

    setProcessing(true);

    try {
      await axios.put(
        `/api/asset-requests/${id}/reject`,
        {
          rejected_by: user?.id,
          reason: reason.trim()
        }
      );

      toast.success(t.rejectSuccess);

      setShowDetails(false);
      setSelectedRequest(null);

      await fetchData();
    } catch (error) {
      console.error('Reject request error:', error);

      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          t.error
      );
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setShowDetails(true);
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
      background: isDark ? '#172554' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#1d4ed8'
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
      background: isDark ? '#172554' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#2563eb'
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
    {
      id: 'new',
      label: `➕ ${t.newRequests}`,
      count: null
    },
    {
      id: 'pending',
      label: `⏳ ${t.pending}`,
      count: pendingRequests.length
    },
    {
      id: 'approved',
      label: `✅ ${t.approved}`,
      count: approvedRequests.length
    },
    {
      id: 'rejected',
      label: `❌ ${t.rejected}`,
      count: rejectedRequests.length
    },
    {
      id: 'history',
      label: `📋 ${t.history}`,
      count: requests.length
    }
  ];

  const tableRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'approved'
      ? approvedRequests
      : activeTab === 'rejected'
      ? rejectedRequests
      : filteredRequests;

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: 24,
          background: isDark
            ? '#0d1726'
            : '#f8fafc',
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
          <div style={{ fontSize: 40 }}>⏳</div>
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
          : '#f8fafc',
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
            📝 {t.title}
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
          onClick={() => {
            setActiveTab('new');
            resetForm();
          }}
          style={{
            border: 'none',
            borderRadius: 9,
            padding: '11px 18px',
            background:
              'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          ➕ {t.newRequests}
        </button>
      </div>

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
        {[
          ['📋', requests.length, t.history],
          ['⏳', pendingRequests.length, t.pending],
          ['✅', approvedRequests.length, t.approved],
          ['❌', rejectedRequests.length, t.rejected]
        ].map(([icon, value, label]) => (
          <div
            key={label}
            style={{
              ...cardStyle,
              padding: 18
            }}
          >
            <div style={{ fontSize: 24 }}>
              {icon}
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                marginTop: 5
              }}
            >
              {value}
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
          </div>
        ))}
      </div>

      {/* TABS */}
      <div
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
            onClick={() => setActiveTab(tab.id)}
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
                    : '#eff6ff'
                  : 'transparent',
              color:
                activeTab === tab.id
                  ? isDark
                    ? '#93c5fd'
                    : '#1d4ed8'
                  : isDark
                  ? '#94a3b8'
                  : '#64748b'
            }}
          >
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
            ➕ {t.createRequest}
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
                <label style={labelStyle}>
                  {t.asset} *
                </label>

                <select
                  value={form.assetId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assetId: e.target.value
                    })
                  }
                  style={inputStyle}
                  required
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {assets.map((asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {asset.asset_tag
                        ? `${asset.asset_tag} - `
                        : ''}
                      {asset.name ||
                        asset.asset_name ||
                        'Unnamed Asset'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  {t.quantity} *
                </label>

                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: e.target.value
                    })
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>
                  {t.department} *
                </label>

                <select
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      departmentId: e.target.value
                    })
                  }
                  style={inputStyle}
                  required
                >
                  <option value="">
                    {t.selectDepartment}
                  </option>

                  {departments.map((department) => (
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
              </div>

              <div>
                <label style={labelStyle}>
                  {t.requestedFor}
                </label>

                <select
                  value={form.requestedFor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requestedFor: e.target.value
                    })
                  }
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
                      {u.full_name ||
                        u.username ||
                        u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  {t.priority}
                </label>

                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value
                    })
                  }
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
                <label style={labelStyle}>
                  {t.requiredDate}
                </label>

                <input
                  type="date"
                  value={form.requiredDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requiredDate: e.target.value
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>
                {t.purpose}
              </label>

              <textarea
                value={form.purpose}
                onChange={(e) =>
                  setForm({
                    ...form,
                    purpose: e.target.value
                  })
                }
                style={{
                  ...inputStyle,
                  minHeight: 90,
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>
                {t.remarks}
              </label>

              <textarea
                value={form.remarks}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remarks: e.target.value
                  })
                }
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
                onClick={resetForm}
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
                {t.close}
              </button>

              <button
                type="submit"
                disabled={processing}
                style={{
                  padding: '11px 20px',
                  border: 'none',
                  borderRadius: 8,
                  background:
                    'linear-gradient(135deg,#2563eb,#1d4ed8)',
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
                  : `📤 ${t.submit}`}
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
            <h2 style={{ margin: 0 }}>
              {activeTab === 'pending'
                ? `⏳ ${t.pending}`
                : activeTab === 'approved'
                ? `✅ ${t.approved}`
                : activeTab === 'rejected'
                ? `❌ ${t.rejected}`
                : `📋 ${t.history}`}
            </h2>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder={t.search}
                style={{
                  ...inputStyle,
                  width: 230
                }}
              />

              {activeTab === 'history' && (
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
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
                      : '#f8fafc'
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
                                  '#2563eb',
                                color: '#fff',
                                cursor:
                                  'pointer',
                                fontWeight: 700
                              }}
                            >
                              👁 {t.view}
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
                                  ✓ {t.approve}
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
                                  ✕ {t.reject}
                                </button>
                              </>
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
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetails && selectedRequest && (
        <div
          role="dialog"
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
              <h2 style={{ margin: 0 }}>
                📄 {t.requestDetails}
              </h2>

              <button
                type="button"
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
                ×
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
                  getStatus(
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
                      : '#f8fafc',
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
                    : '#f8fafc',
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
                    : '#f8fafc',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedRequest.remarks ||
                  '-'}
              </div>
            </div>

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
                  ✕ {t.reject}
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
                  ✓ {t.approve}
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