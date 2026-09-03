import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const AdminTransfer = () => {
  const { theme } = useLanguage();

  const isDark = theme === 'dark';

  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetLoading, setAssetLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const getToday = () => new Date().toISOString().split('T')[0];

  const emptyForm = {
    assetId: '',
    sourceDepartment: '',
    destinationDepartment: '',
    currentLocation: '',
    newLocation: '',
    sourceUser: '',
    destinationUser: '',
    transferDate: getToday(),
    reason: '',
    notes: '',
    status: 'Pending'
  };

  const [formData, setFormData] = useState(emptyForm);

  const styles = {
    light: {
      bg: '#f0f5ff',
      card: '#ffffff',
      input: '#f8f9fa',
      text: '#1a375d',
      subText: '#4a5568',
      border: '#b4d2f0',
      hover: '#e0e7ff',
      accent: '#2b6cb0',
      danger: '#e53e3e',
      success: '#48bb78',
      warning: '#ed8936',
      info: '#3182ce',
      muted: '#718096',
      shadow: '0 4px 12px rgba(0, 0, 100, 0.10)'
    },
    dark: {
      bg: '#141e2d',
      card: '#1e2d45',
      input: '#0d1b2a',
      text: '#c8dcf5',
      subText: '#a0aec0',
      border: '#32465f',
      hover: '#334155',
      accent: '#63b3ed',
      danger: '#fc8181',
      success: '#48bb78',
      warning: '#ed8936',
      info: '#63b3ed',
      muted: '#a0aec0',
      shadow: '0 4px 12px rgba(0, 0, 0, 0.30)'
    }
  };

  const s = styles[isDark ? 'dark' : 'light'];

  const statusOptions = [
    'Pending',
    'Approved',
    'Rejected',
    'In Progress',
    'Completed',
    'Cancelled'
  ];

  const normalizeArray = (response, keys = []) => {
    const data = response?.data;

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    return [];
  };

  const normalizeTransfer = (transfer) => ({
    ...transfer,

    id: transfer.id,

    assetId:
      transfer.assetId ??
      transfer.asset_id ??
      transfer.asset?.id ??
      '',

    assetName:
      transfer.assetName ??
      transfer.asset_name ??
      transfer.asset?.name ??
      'N/A',

    assetCode:
      transfer.assetCode ??
      transfer.asset_code ??
      transfer.asset_tag ??
      transfer.asset?.assetCode ??
      transfer.asset?.asset_code ??
      transfer.asset?.asset_tag ??
      '',

    sourceDepartment:
      transfer.sourceDepartment ??
      transfer.source_department ??
      transfer.from_department ??
      transfer.fromDepartment ??
      transfer.from?.department ??
      'N/A',

    destinationDepartment:
      transfer.destinationDepartment ??
      transfer.destination_department ??
      transfer.to_department ??
      transfer.toDepartment ??
      transfer.to?.department ??
      'N/A',

    currentLocation:
      transfer.currentLocation ??
      transfer.current_location ??
      transfer.from_location ??
      transfer.fromLocation ??
      transfer.sourceLocation ??
      'N/A',

    newLocation:
      transfer.newLocation ??
      transfer.new_location ??
      transfer.to_location ??
      transfer.toLocation ??
      transfer.destinationLocation ??
      'N/A',

    sourceUser:
      transfer.sourceUser ??
      transfer.source_user ??
      transfer.from_user ??
      transfer.fromUser ??
      '',

    destinationUser:
      transfer.destinationUser ??
      transfer.destination_user ??
      transfer.to_user ??
      transfer.toUser ??
      '',

    requestedBy:
      transfer.requestedBy ??
      transfer.requested_by_name ??
      transfer.requested_by ??
      transfer.requester?.fullName ??
      transfer.requester?.full_name ??
      transfer.requester?.username ??
      'N/A',

    approvedBy:
      transfer.approvedBy ??
      transfer.approved_by_name ??
      transfer.approved_by ??
      transfer.approver?.fullName ??
      transfer.approver?.full_name ??
      transfer.approver?.username ??
      'N/A',

    transferDate:
      transfer.transferDate ??
      transfer.transfer_date ??
      transfer.date ??
      transfer.created_at ??
      '',

    reason:
      transfer.reason ??
      transfer.transferReason ??
      transfer.transfer_reason ??
      '',

    notes: transfer.notes ?? '',

    status: transfer.status || 'Pending'
  });

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/transfers');

      const list = normalizeArray(response, [
        'transfers',
        'results'
      ]);

      setTransfers(list.map(normalizeTransfer));
    } catch (err) {
      console.error('Failed to load transfers:', err);

      const message =
        err.response?.data?.message ||
        'Unable to load asset transfers.';

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);

    try {
      const response = await axios.get('/api/assets');

      const list = normalizeArray(response, [
        'assets',
        'results'
      ]);

      setAssets(list);
    } catch (err) {
      console.error('Failed to load assets:', err);

      toast.error(
        err.response?.data?.message ||
        'Unable to load assets.'
      );
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    setDepartmentsLoading(true);

    try {
      const response = await axios.get('/api/departments');

      const list = normalizeArray(response, [
        'departments',
        'results'
      ]);

      setDepartments(list);
    } catch (err) {
      console.error('Failed to load departments:', err);

      toast.error(
        err.response?.data?.message ||
        'Unable to load departments.'
      );
    } finally {
      setDepartmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
    fetchAssets();
    fetchDepartments();
  }, [fetchTransfers, fetchAssets, fetchDepartments]);

  const loadAsset = async (assetId) => {
    if (!assetId) {
      setSelectedAsset(null);
      return;
    }

    setAssetLoading(true);

    try {
      const response = await axios.get(`/api/assets/${assetId}`);

      const asset =
        response?.data?.asset ||
        response?.data?.data ||
        response?.data;

      setSelectedAsset(asset);

      setFormData((previous) => ({
        ...previous,

        sourceDepartment:
          asset?.department_name ||
          asset?.department ||
          asset?.departmentName ||
          previous.sourceDepartment ||
          '',

        currentLocation:
          asset?.location ||
          asset?.current_location ||
          previous.currentLocation ||
          '',

        sourceUser:
          asset?.assigned_to_name ||
          asset?.assigned_to ||
          asset?.assignedUser ||
          previous.sourceUser ||
          ''
      }));
    } catch (err) {
      console.error('Failed to load asset:', err);

      setSelectedAsset(null);

      toast.error(
        err.response?.data?.message ||
        'Unable to load selected asset.'
      );
    } finally {
      setAssetLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleAssetChange = async (event) => {
    const assetId = event.target.value;

    setFormData((previous) => ({
      ...previous,
      assetId
    }));

    if (!assetId) {
      setSelectedAsset(null);
      return;
    }

    const localAsset = assets.find(
      (asset) => String(asset.id) === String(assetId)
    );

    if (localAsset) {
      setSelectedAsset(localAsset);

      setFormData((previous) => ({
        ...previous,

        sourceDepartment:
          localAsset.department_name ||
          localAsset.department ||
          localAsset.departmentName ||
          '',

        currentLocation:
          localAsset.location ||
          localAsset.current_location ||
          '',

        sourceUser:
          localAsset.assigned_to_name ||
          localAsset.assigned_to ||
          localAsset.assignedUser ||
          ''
      }));
    }

    await loadAsset(assetId);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSelectedAsset(null);
    setEditingId(null);
    setShowPreview(false);
  };

  const openNewTransfer = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    resetForm();
  };

  const validateForm = () => {
    if (!formData.assetId) {
      toast.error('Please select an asset.');
      return false;
    }

    if (!formData.destinationDepartment) {
      toast.error('Please select a destination department.');
      return false;
    }

    if (!formData.newLocation.trim()) {
      toast.error('Please enter the new location.');
      return false;
    }

    if (!formData.transferDate) {
      toast.error('Please select a transfer date.');
      return false;
    }

    if (
      Number.isNaN(
        new Date(formData.transferDate).getTime()
      )
    ) {
      toast.error('Please enter a valid transfer date.');
      return false;
    }

    if (!formData.reason.trim()) {
      toast.error('Transfer reason is required.');
      return false;
    }

    if (
      formData.sourceDepartment &&
      String(formData.sourceDepartment).toLowerCase() ===
        String(formData.destinationDepartment).toLowerCase()
    ) {
      toast.error(
        'Source and destination department cannot be the same.'
      );
      return false;
    }

    return true;
  };

  const buildPayload = () => {
    return {
      assetId: Number(formData.assetId),

      sourceDepartment:
        formData.sourceDepartment || null,

      destinationDepartment:
        formData.destinationDepartment || null,

      currentLocation:
        formData.currentLocation || null,

      newLocation:
        formData.newLocation.trim(),

      sourceUser:
        formData.sourceUser || null,

      destinationUser:
        formData.destinationUser || null,

      transferDate:
        formData.transferDate,

      reason:
        formData.reason.trim(),

      notes:
        formData.notes.trim()
    };
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setShowPreview(true);
  };

  const confirmTransfer = async () => {
    if (saving) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      let response;

      if (editingId) {
        response = await axios.put(
          `/api/transfers/${editingId}`,
          payload
        );
      } else {
        response = await axios.post(
          '/api/transfers',
          payload
        );
      }

      toast.success(
        response?.data?.message ||
        (
          editingId
            ? 'Transfer updated successfully.'
            : 'Transfer request created successfully.'
        )
      );

      setShowPreview(false);
      setShowForm(false);

      resetForm();

      await Promise.all([
        fetchTransfers(),
        fetchAssets()
      ]);
    } catch (err) {
      console.error('Transfer save error:', err);

      toast.error(
        err.response?.data?.message ||
        'Unable to save transfer.'
      );
    } finally {
      setSaving(false);
    }
  };

  const performStatusAction = async (
    id,
    status,
    successMessage
  ) => {
    if (!id || actionId) {
      return;
    }

    setActionId(id);

    try {
      await axios.patch(
        `/api/transfers/${id}`,
        { status }
      );

      toast.success(successMessage);

      await Promise.all([
        fetchTransfers(),
        fetchAssets()
      ]);
    } catch (err) {
      console.error(
        `Transfer ${status} error:`,
        err
      );

      toast.error(
        err.response?.data?.message ||
        `Unable to change transfer status to ${status}.`
      );
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = async (transfer) => {
    if (
      !window.confirm(
        'Approve this asset transfer?'
      )
    ) {
      return;
    }

    await performStatusAction(
      transfer.id,
      'Approved',
      'Transfer approved successfully.'
    );
  };

  const handleReject = async (transfer) => {
    if (
      !window.confirm(
        'Reject this asset transfer?'
      )
    ) {
      return;
    }

    await performStatusAction(
      transfer.id,
      'Rejected',
      'Transfer rejected successfully.'
    );
  };

  const handleComplete = async (transfer) => {
    if (
      !window.confirm(
        'Complete this transfer? The backend may update the asset department/location.'
      )
    ) {
      return;
    }

    await performStatusAction(
      transfer.id,
      'Completed',
      'Transfer completed successfully.'
    );
  };

  const handleCancel = async (transfer) => {
    if (
      !window.confirm(
        'Cancel this transfer?'
      )
    ) {
      return;
    }

    await performStatusAction(
      transfer.id,
      'Cancelled',
      'Transfer cancelled successfully.'
    );
  };

  const handleEdit = async (transfer) => {
    const status = String(
      transfer.status || ''
    ).toLowerCase();

    if (
      ['completed', 'rejected', 'cancelled'].includes(
        status
      )
    ) {
      toast.warning(
        'This transfer cannot be edited.'
      );
      return;
    }

    const destinationDepartment =
      departments.find(
        (department) =>
          String(department.id) ===
          String(
            transfer.destinationDepartmentId ??
            transfer.destination_department_id ??
            transfer.to_department_id ??
            ''
          )
      )?.id ||
      transfer.destinationDepartmentId ||
      transfer.destination_department_id ||
      transfer.to_department_id ||
      '';

    setFormData({
      assetId:
        transfer.assetId || '',

      sourceDepartment:
        transfer.sourceDepartment || '',

      destinationDepartment,

      currentLocation:
        transfer.currentLocation || '',

      newLocation:
        transfer.newLocation !== 'N/A'
          ? transfer.newLocation
          : '',

      sourceUser:
        transfer.sourceUser || '',

      destinationUser:
        transfer.destinationUser || '',

      transferDate:
        transfer.transferDate
          ? String(
              transfer.transferDate
            ).substring(0, 10)
          : getToday(),

      reason:
        transfer.reason || '',

      notes:
        transfer.notes || '',

      status:
        transfer.status || 'Pending'
    });

    setEditingId(transfer.id);
    setShowForm(true);

    if (transfer.assetId) {
      await loadAsset(
        transfer.assetId
      );
    }
  };

  const handleDelete = async (transfer) => {
    const status = String(
      transfer.status || ''
    ).toLowerCase();

    if (status === 'completed') {
      toast.warning(
        'Completed transfers should not be deleted.'
      );
      return;
    }

    if (
      !window.confirm(
        'Delete this transfer record? This action cannot be undone.'
      )
    ) {
      return;
    }

    setActionId(transfer.id);

    try {
      await axios.delete(
        `/api/transfers/${transfer.id}`
      );

      toast.success(
        'Transfer deleted successfully.'
      );

      await fetchTransfers();
    } catch (err) {
      console.error(
        'Delete transfer error:',
        err
      );

      toast.error(
        err.response?.data?.message ||
        'Unable to delete transfer.'
      );
    } finally {
      setActionId(null);
    }
  };

  const getDepartmentName = (value) => {
    if (!value) {
      return 'N/A';
    }

    const department = departments.find(
      (item) =>
        String(item.id) === String(value)
    );

    return (
      department?.name ||
      department?.department_name ||
      value
    );
  };

  const getAssetLabel = (asset) => {
    if (!asset) {
      return 'N/A';
    }

    const code =
      asset.assetCode ||
      asset.asset_code ||
      asset.asset_tag ||
      asset.code ||
      asset.id;

    const name =
      asset.name ||
      asset.asset_name ||
      'Unnamed Asset';

    return `${code} - ${name}`;
  };

  const getStatusColor = (status) => {
    switch (
      String(status || '').toLowerCase()
    ) {
      case 'pending':
        return {
          background: '#feebc8',
          color: '#744210'
        };

      case 'approved':
        return {
          background: '#c6f6d5',
          color: '#22543d'
        };

      case 'rejected':
        return {
          background: '#fed7d7',
          color: '#742a2a'
        };

      case 'in progress':
        return {
          background: '#bee3f8',
          color: '#2a4365'
        };

      case 'completed':
        return {
          background: '#c6f6d5',
          color: '#22543d'
        };

      case 'cancelled':
        return {
          background: '#e2e8f0',
          color: '#4a5568'
        };

      default:
        return {
          background: '#e2e8f0',
          color: '#4a5568'
        };
    }
  };

  const getTransferStatus = (transfer) => {
    return (
      transfer.status ||
      'Pending'
    );
  };

  const filteredTransfers = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const searchableValues = [
        transfer.assetName,
        transfer.assetCode,
        transfer.sourceDepartment,
        transfer.destinationDepartment,
        transfer.currentLocation,
        transfer.newLocation,
        transfer.requestedBy,
        transfer.approvedBy,
        transfer.reason,
        transfer.status
      ];

      const matchesSearch =
        !query ||
        searchableValues.some(
          (value) =>
            String(value || '')
              .toLowerCase()
              .includes(query)
        );

      const matchesStatus =
        filterStatus === 'all' ||
        String(
          transfer.status || ''
        ).toLowerCase() ===
          filterStatus.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    transfers,
    searchQuery,
    filterStatus
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    filterStatus
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTransfers.length /
        itemsPerPage
    )
  );

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages
  ]);

  const paginatedTransfers =
    filteredTransfers.slice(
      (currentPage - 1) *
        itemsPerPage,
      currentPage *
        itemsPerPage
    );

  const totalTransfers =
    transfers.length;

  const pendingTransfers =
    transfers.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        'pending'
    ).length;

  const approvedTransfers =
    transfers.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        'approved'
    ).length;

  const completedTransfers =
    transfers.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        'completed'
    ).length;

  const rejectedTransfers =
    transfers.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        'rejected'
    ).length;

  const availableTransferAssets =
    assets.filter((asset) => {
      const status =
        String(
          asset.status || ''
        ).toLowerCase();

      return ![
        'retired',
        'missing'
      ].includes(status);
    });

  const cardStyle = {
    backgroundColor: s.card,
    border: `1px solid ${s.border}`,
    borderRadius: '10px',
    padding: '16px',
    boxShadow: s.shadow
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    backgroundColor: s.input,
    color: s.text,
    border: `1px solid ${s.border}`,
    borderRadius: '6px',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    color: s.text,
    fontWeight: 600,
    marginBottom: '6px',
    fontSize: '0.9rem'
  };

  const buttonBase = {
    border: 'none',
    borderRadius: '6px',
    padding: '9px 13px',
    cursor: 'pointer',
    fontWeight: 600
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: s.bg,
        minHeight: '100vh',
        color: s.text
      }}
    >
      <div
        style={{
          backgroundColor: s.card,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: s.shadow
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1
              style={{
                color: s.text,
                margin: 0,
                fontSize: '1.7rem'
              }}
            >
              🔄 Asset Transfer Management
            </h1>

            <p
              style={{
                color: s.subText,
                margin: '7px 0 0'
              }}
            >
              Transfer assets between departments,
              locations, and users.
            </p>
          </div>

          <button
            type="button"
            onClick={
              showForm
                ? closeForm
                : openNewTransfer
            }
            disabled={saving}
            style={{
              ...buttonBase,
              backgroundColor: s.accent,
              color: '#fff'
            }}
          >
            {showForm
              ? '✕ Close'
              : '➕ New Transfer'}
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}
        >
          {[
            [
              'Total Transfers',
              totalTransfers,
              s.accent,
              'all'
            ],
            [
              'Pending',
              pendingTransfers,
              s.warning,
              'Pending'
            ],
            [
              'Approved',
              approvedTransfers,
              s.success,
              'Approved'
            ],
            [
              'Completed',
              completedTransfers,
              s.info,
              'Completed'
            ],
            [
              'Rejected',
              rejectedTransfers,
              s.danger,
              'Rejected'
            ]
          ].map(
            ([
              label,
              value,
              color,
              status
            ]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  setFilterStatus(status);
                  setCurrentPage(1);
                }}
                style={{
                  ...cardStyle,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${color}`
                }}
              >
                <div
                  style={{
                    color,
                    fontSize: '1.55rem',
                    fontWeight: 700
                  }}
                >
                  {value}
                </div>

                <div
                  style={{
                    color: s.subText,
                    marginTop: '5px',
                    fontSize: '0.85rem'
                  }}
                >
                  {label}
                </div>
              </button>
            )
          )}
        </div>

        {/* SEARCH / FILTER */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(
                event.target.value
              );
            }}
            placeholder="Search asset, department, location, user, reason..."
            style={{
              ...inputStyle,
              flex: 1,
              minWidth: '240px'
            }}
          />

          <select
            value={filterStatus}
            onChange={(event) => {
              setFilterStatus(
                event.target.value
              );
            }}
            style={{
              ...inputStyle,
              width: '190px'
            }}
          >
            <option value="all">
              All Status
            </option>

            {statusOptions.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>

          {(searchQuery ||
            filterStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setCurrentPage(1);
              }}
              style={{
                ...buttonBase,
                backgroundColor: s.border,
                color: s.text
              }}
            >
              🔄 Reset
            </button>
          )}
        </div>

        {/* NEW / EDIT FORM */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: isDark
                ? '#0d1b2a'
                : '#f8f9fa',
              border: `1px solid ${s.border}`,
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '22px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px'
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: s.text,
                    fontSize: '1.25rem'
                  }}
                >
                  {editingId
                    ? '✏️ Edit Transfer'
                    : '➕ New Asset Transfer'}
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: s.subText,
                    fontSize: '0.85rem'
                  }}
                >
                  Create a transfer request using
                  real asset and department data.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '15px'
              }}
            >
              {/* ASSET */}
              <div>
                <label style={labelStyle}>
                  Asset *
                </label>

                <select
                  name="assetId"
                  value={formData.assetId}
                  onChange={handleAssetChange}
                  disabled={
                    assetLoading ||
                    saving
                  }
                  required
                  style={inputStyle}
                >
                  <option value="">
                    {assetsLoading ||
                    assetLoading
                      ? 'Loading assets...'
                      : 'Select Asset'}
                  </option>

                  {availableTransferAssets.map(
                    (asset) => (
                      <option
                        key={asset.id}
                        value={asset.id}
                      >
                        {getAssetLabel(
                          asset
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* SOURCE DEPARTMENT */}
              <div>
                <label style={labelStyle}>
                  From Department
                </label>

                <input
                  type="text"
                  value={
                    formData.sourceDepartment ||
                    'Not assigned'
                  }
                  readOnly
                  style={{
                    ...inputStyle,
                    opacity: 0.8
                  }}
                />
              </div>

              {/* DESTINATION */}
              <div>
                <label style={labelStyle}>
                  To Department *
                </label>

                <select
                  name="destinationDepartment"
                  value={
                    formData.destinationDepartment
                  }
                  onChange={
                    handleInputChange
                  }
                  required
                  disabled={
                    departmentsLoading ||
                    saving
                  }
                  style={inputStyle}
                >
                  <option value="">
                    {departmentsLoading
                      ? 'Loading departments...'
                      : 'Select Department'}
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name ||
                          department.department_name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* CURRENT LOCATION */}
              <div>
                <label style={labelStyle}>
                  From Location
                </label>

                <input
                  type="text"
                  value={
                    formData.currentLocation ||
                    'Not assigned'
                  }
                  readOnly
                  style={{
                    ...inputStyle,
                    opacity: 0.8
                  }}
                />
              </div>

              {/* NEW LOCATION */}
              <div>
                <label style={labelStyle}>
                  To Location *
                </label>

                <input
                  type="text"
                  name="newLocation"
                  value={
                    formData.newLocation
                  }
                  onChange={
                    handleInputChange
                  }
                  required
                  placeholder="Enter destination location"
                  style={inputStyle}
                />
              </div>

              {/* SOURCE USER */}
              <div>
                <label style={labelStyle}>
                  From User
                </label>

                <input
                  type="text"
                  value={
                    formData.sourceUser ||
                    'Not assigned'
                  }
                  readOnly
                  style={{
                    ...inputStyle,
                    opacity: 0.8
                  }}
                />
              </div>

              {/* DESTINATION USER */}
              <div>
                <label style={labelStyle}>
                  To User
                </label>

                <input
                  type="text"
                  name="destinationUser"
                  value={
                    formData.destinationUser
                  }
                  onChange={
                    handleInputChange
                  }
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>

              {/* DATE */}
              <div>
                <label style={labelStyle}>
                  Transfer Date *
                </label>

                <input
                  type="date"
                  name="transferDate"
                  value={
                    formData.transferDate
                  }
                  onChange={
                    handleInputChange
                  }
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {/* REASON */}
            <div
              style={{
                marginTop: '15px'
              }}
            >
              <label style={labelStyle}>
                Transfer Reason *
              </label>

              <textarea
                name="reason"
                value={
                  formData.reason
                }
                onChange={
                  handleInputChange
                }
                required
                rows={3}
                placeholder="Explain why this asset is being transferred..."
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* NOTES */}
            <div
              style={{
                marginTop: '15px'
              }}
            >
              <label style={labelStyle}>
                Notes
              </label>

              <textarea
                name="notes"
                value={
                  formData.notes
                }
                onChange={
                  handleInputChange
                }
                rows={2}
                placeholder="Additional notes..."
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* BUTTONS */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '18px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="submit"
                disabled={
                  saving ||
                  assetLoading
                }
                style={{
                  ...buttonBase,
                  backgroundColor:
                    s.success,
                  color: '#fff',
                  cursor:
                    saving ||
                    assetLoading
                      ? 'wait'
                      : 'pointer'
                }}
              >
                {editingId
                  ? '💾 Preview Update'
                  : '✔️ Preview Transfer'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  ...buttonBase,
                  backgroundColor:
                    s.border,
                  color: s.text
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* PREVIEW */}
        {showPreview && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              backgroundColor: s.card,
              border: `2px solid ${s.accent}`,
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '22px',
              boxShadow: s.shadow
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: s.text
              }}
            >
              🔎 Transfer Preview
            </h2>

            <div
              style={{
                backgroundColor: isDark
                  ? '#0d1b2a'
                  : '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px'
              }}
            >
              <strong
                style={{
                  color: s.text
                }}
              >
                Asset
              </strong>

              <div
                style={{
                  color: s.subText,
                  marginTop: '5px'
                }}
              >
                {selectedAsset
                  ? getAssetLabel(
                      selectedAsset
                    )
                  : 'N/A'}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '15px'
              }}
            >
              <div
                style={{
                  backgroundColor: isDark
                    ? '#172235'
                    : '#edf2f7',
                  borderRadius: '8px',
                  padding: '16px'
                }}
              >
                <h3
                  style={{
                    color: s.danger,
                    marginTop: 0
                  }}
                >
                  FROM
                </h3>

                <div
                  style={{
                    color: s.text,
                    lineHeight: 1.8
                  }}
                >
                  <strong>
                    Department:
                  </strong>{' '}
                  {formData.sourceDepartment ||
                    'Not assigned'}
                  <br />

                  <strong>
                    Location:
                  </strong>{' '}
                  {formData.currentLocation ||
                    'Not assigned'}
                  <br />

                  <strong>
                    User:
                  </strong>{' '}
                  {formData.sourceUser ||
                    'Not assigned'}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: isDark
                    ? '#172235'
                    : '#f0fff4',
                  borderRadius: '8px',
                  padding: '16px'
                }}
              >
                <h3
                  style={{
                    color: s.success,
                    marginTop: 0
                  }}
                >
                  TO
                </h3>

                <div
                  style={{
                    color: s.text,
                    lineHeight: 1.8
                  }}
                >
                  <strong>
                    Department:
                  </strong>{' '}
                  {getDepartmentName(
                    formData.destinationDepartment
                  )}
                  <br />

                  <strong>
                    Location:
                  </strong>{' '}
                  {formData.newLocation ||
                    'Not selected'}
                  <br />

                  <strong>
                    User:
                  </strong>{' '}
                  {formData.destinationUser ||
                    'Not assigned'}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '15px',
                color: s.text,
                lineHeight: 1.8
              }}
            >
              <strong>
                Transfer Date:
              </strong>{' '}
              {formData.transferDate}
              <br />

              <strong>
                Reason:
              </strong>{' '}
              {formData.reason}
              <br />

              <strong>
                Notes:
              </strong>{' '}
              {formData.notes ||
                'No notes'}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowPreview(false)
                }
                disabled={saving}
                style={{
                  ...buttonBase,
                  backgroundColor:
                    s.border,
                  color: s.text
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={
                  confirmTransfer
                }
                disabled={saving}
                style={{
                  ...buttonBase,
                  backgroundColor:
                    s.success,
                  color: '#fff',
                  cursor: saving
                    ? 'wait'
                    : 'pointer'
                }}
              >
                {saving
                  ? '⏳ Saving...'
                  : editingId
                    ? '💾 Confirm Update'
                    : '✔️ Confirm Transfer'}
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && !loading && (
          <div
            style={{
              backgroundColor: isDark
                ? '#3b1f24'
                : '#fff5f5',
              border: `1px solid ${s.danger}`,
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '20px',
              color: s.danger
            }}
          >
            <strong>
              ⚠️ Unable to load transfers
            </strong>

            <div
              style={{
                marginTop: '6px'
              }}
            >
              {error}
            </div>

            <button
              type="button"
              onClick={fetchTransfers}
              style={{
                ...buttonBase,
                backgroundColor:
                  s.accent,
                color: '#fff',
                marginTop: '10px'
              }}
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* TABLE */}
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '55px 20px',
              color: s.subText
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                marginBottom: '10px'
              }}
            >
              ⏳
            </div>

            <div>
              Loading transfers...
            </div>
          </div>
        ) : paginatedTransfers.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '55px 20px',
              color: s.subText
            }}
          >
            <div
              style={{
                fontSize: '2.5rem',
                marginBottom: '10px'
              }}
            >
              📭
            </div>

            <h2
              style={{
                color: s.text,
                marginBottom: '8px'
              }}
            >
              No transfers found
            </h2>

            <p>
              No asset transfers match the
              current search/filter.
            </p>

            <button
              type="button"
              onClick={openNewTransfer}
              style={{
                ...buttonBase,
                backgroundColor:
                  s.accent,
                color: '#fff'
              }}
            >
              ➕ Create Transfer
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                overflowX: 'auto',
                border: `1px solid ${s.border}`,
                borderRadius: '8px'
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: '1100px',
                  borderCollapse:
                    'collapse',
                  fontSize: '0.88rem'
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor:
                        isDark
                          ? '#0d1b2a'
                          : '#f8f9fa'
                    }}
                  >
                    {[
                      'Asset',
                      'From',
                      'To',
                      'Requested By',
                      'Date',
                      'Reason',
                      'Status',
                      'Approved By',
                      'Actions'
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          style={{
                            padding:
                              '13px 10px',
                            textAlign:
                              heading ===
                              'Actions'
                                ? 'center'
                                : 'left',
                            color:
                              s.text,
                            borderBottom: `2px solid ${s.border}`,
                            whiteSpace:
                              'nowrap'
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {paginatedTransfers.map(
                    (transfer) => {
                      const status =
                        getTransferStatus(
                          transfer
                        );

                      const statusStyle =
                        getStatusColor(
                          status
                        );

                      const busy =
                        actionId ===
                        transfer.id;

                      return (
                        <tr
                          key={
                            transfer.id
                          }
                          style={{
                            borderBottom: `1px solid ${s.border}`
                          }}
                        >
                          {/* ASSET */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text
                            }}
                          >
                            <strong>
                              {transfer.assetCode ||
                                transfer.assetName}
                            </strong>

                            {transfer.assetName &&
                              transfer.assetCode && (
                                <div
                                  style={{
                                    color:
                                      s.subText,
                                    fontSize:
                                      '0.78rem',
                                    marginTop:
                                      '3px'
                                  }}
                                >
                                  {
                                    transfer.assetName
                                  }
                                </div>
                              )}
                          </td>

                          {/* FROM */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text
                            }}
                          >
                            <div>
                              {transfer.sourceDepartment ||
                                'N/A'}
                            </div>

                            <small
                              style={{
                                color:
                                  s.subText
                              }}
                            >
                              {transfer.currentLocation ||
                                'No location'}
                            </small>
                          </td>

                          {/* TO */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text
                            }}
                          >
                            <div>
                              {transfer.destinationDepartment ||
                                'N/A'}
                            </div>

                            <small
                              style={{
                                color:
                                  s.subText
                              }}
                            >
                              {transfer.newLocation ||
                                'No location'}
                            </small>
                          </td>

                          {/* REQUESTED BY */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text
                            }}
                          >
                            {
                              transfer.requestedBy
                            }
                          </td>

                          {/* DATE */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text,
                              whiteSpace:
                                'nowrap'
                            }}
                          >
                            {transfer.transferDate
                              ? new Date(
                                  transfer.transferDate
                                ).toLocaleDateString()
                              : 'N/A'}
                          </td>

                          {/* REASON */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text,
                              maxWidth:
                                '220px'
                            }}
                          >
                            <div
                              title={
                                transfer.reason
                              }
                              style={{
                                overflow:
                                  'hidden',
                                textOverflow:
                                  'ellipsis',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {transfer.reason ||
                                'N/A'}
                            </div>
                          </td>

                          {/* STATUS */}
                          <td
                            style={{
                              padding:
                                '12px 10px'
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'inline-block',
                                padding:
                                  '5px 9px',
                                borderRadius:
                                  '20px',
                                backgroundColor:
                                  statusStyle.background,
                                color:
                                  statusStyle.color,
                                fontWeight:
                                  700,
                                fontSize:
                                  '0.76rem',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {status}
                            </span>
                          </td>

                          {/* APPROVED BY */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              color:
                                s.text
                            }}
                          >
                            {status ===
                            'Pending'
                              ? '—'
                              : transfer.approvedBy ||
                                'N/A'}
                          </td>

                          {/* ACTIONS */}
                          <td
                            style={{
                              padding:
                                '12px 10px',
                              textAlign:
                                'center'
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                justifyContent:
                                  'center',
                                gap: '5px',
                                flexWrap:
                                  'wrap'
                              }}
                            >
                              {[
                                'Pending',
                                'Approved'
                              ].includes(
                                status
                              ) && (
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() =>
                                    handleEdit(
                                      transfer
                                    )
                                  }
                                  disabled={
                                    busy ||
                                    saving
                                  }
                                  style={{
                                    ...buttonBase,
                                    padding:
                                      '6px 8px',
                                    backgroundColor:
                                      s.accent,
                                    color:
                                      '#fff'
                                  }}
                                >
                                  ✏️
                                </button>
                              )}

                              {status ===
                                'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    title="Approve"
                                    onClick={() =>
                                      handleApprove(
                                        transfer
                                      )
                                    }
                                    disabled={
                                      busy
                                    }
                                    style={{
                                      ...buttonBase,
                                      padding:
                                        '6px 8px',
                                      backgroundColor:
                                        s.success,
                                      color:
                                        '#fff'
                                    }}
                                  >
                                    {busy
                                      ? '⏳'
                                      : '✔️'}
                                  </button>

                                  <button
                                    type="button"
                                    title="Reject"
                                    onClick={() =>
                                      handleReject(
                                        transfer
                                      )
                                    }
                                    disabled={
                                      busy
                                    }
                                    style={{
                                      ...buttonBase,
                                      padding:
                                        '6px 8px',
                                      backgroundColor:
                                        s.danger,
                                      color:
                                        '#fff'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}

                              {status ===
                                'Approved' && (
                                <button
                                  type="button"
                                  title="Complete"
                                  onClick={() =>
                                    handleComplete(
                                      transfer
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  style={{
                                    ...buttonBase,
                                    padding:
                                      '6px 8px',
                                    backgroundColor:
                                      s.success,
                                    color:
                                      '#fff'
                                  }}
                                >
                                  {busy
                                    ? '⏳'
                                    : '✅'}
                                </button>
                              )}

                              {[
                                'Pending',
                                'Approved',
                                'In Progress'
                              ].includes(
                                status
                              ) && (
                                <button
                                  type="button"
                                  title="Cancel"
                                  onClick={() =>
                                    handleCancel(
                                      transfer
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  style={{
                                    ...buttonBase,
                                    padding:
                                      '6px 8px',
                                    backgroundColor:
                                      s.warning,
                                    color:
                                      '#fff'
                                  }}
                                >
                                  ⛔
                                </button>
                              )}

                              {status !==
                                'Completed' && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() =>
                                    handleDelete(
                                      transfer
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  style={{
                                    ...buttonBase,
                                    padding:
                                      '6px 8px',
                                    backgroundColor:
                                      isDark
                                        ? '#475569'
                                        : '#cbd5e0',
                                    color:
                                      isDark
                                        ? '#fff'
                                        : '#1a365d'
                                  }}
                                >
                                  {busy
                                    ? '⏳'
                                    : '🗑️'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '15px',
                marginTop: '18px',
                color: s.subText,
                flexWrap: 'wrap'
              }}
            >
              <div>
                Showing{' '}
                {filteredTransfers.length ===
                0
                  ? 0
                  : (currentPage -
                      1) *
                      itemsPerPage +
                    1}{' '}
                to{' '}
                {Math.min(
                  currentPage *
                    itemsPerPage,
                  filteredTransfers.length
                )}{' '}
                of{' '}
                {filteredTransfers.length}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '5px',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          page - 1,
                          1
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    1
                  }
                  style={{
                    ...buttonBase,
                    backgroundColor:
                      currentPage === 1
                        ? s.border
                        : s.accent,
                    color:
                      currentPage === 1
                        ? s.subText
                        : '#fff',
                    cursor:
                      currentPage === 1
                        ? 'not-allowed'
                        : 'pointer'
                  }}
                >
                  ← Prev
                </button>

                {Array.from(
                  {
                    length:
                      totalPages
                  },
                  (_, index) =>
                    index + 1
                ).map(
                  (page) => (
                    <button
                      type="button"
                      key={page}
                      onClick={() =>
                        setCurrentPage(
                          page
                        )
                      }
                      style={{
                        ...buttonBase,
                        padding:
                          '7px 10px',
                        backgroundColor:
                          page ===
                          currentPage
                            ? s.accent
                            : s.input,
                        color:
                          page ===
                          currentPage
                            ? '#fff'
                            : s.text,
                        border: `1px solid ${s.border}`
                      }}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          page + 1,
                          totalPages
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  style={{
                    ...buttonBase,
                    backgroundColor:
                      currentPage ===
                      totalPages
                        ? s.border
                        : s.accent,
                    color:
                      currentPage ===
                      totalPages
                        ? s.subText
                        : '#fff',
                    cursor:
                      currentPage ===
                      totalPages
                        ? 'not-allowed'
                        : 'pointer'
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTransfer;
