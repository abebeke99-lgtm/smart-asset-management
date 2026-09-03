import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';

const StoreIssue = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  const dark = theme === 'dark';
  const t = language === 'en' ? en : am;

  const [inventory, setInventory] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [targetType, setTargetType] = useState('department');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    assetId: '',
    quantity: 1,
    recipient: '',
    departmentId: '',
    staffId: '',
    reason: 'Issue to department',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const inventoryResponse =
        await axios.get('/api/inventory');

      const inventoryData =
        inventoryResponse.data?.inventory ||
        inventoryResponse.data?.data ||
        [];

      setInventory(
        Array.isArray(inventoryData)
          ? inventoryData
          : []
      );

      try {
        const assignmentResponse =
          await axios.get('/api/assignments', {
            params: { limit: 500 }
          });

        const data =
          assignmentResponse.data?.assignments ||
          assignmentResponse.data?.data ||
          [];

        setAssignments(
          Array.isArray(data) ? data : []
        );
      } catch {
        setAssignments([]);
      }
    } catch (error) {
      setInventory([]);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableInventory = useMemo(() => {
    return inventory.filter(
      (item) =>
        Number(
          item.available_quantity ??
          item.availableQuantity ??
          0
        ) > 0
    );
  }, [inventory]);

  const filteredAssignments = useMemo(() => {
    const query = search.toLowerCase();

    return assignments.filter((item) => {
      const text = [
        item.asset_name,
        item.asset_tag,
        item.user_name,
        item.department,
        item.status,
        item.reason
      ]
        .join(' ')
        .toLowerCase();

      return !query || text.includes(query);
    });
  }, [assignments, search]);

  const issueAsset = async (event) => {
    event.preventDefault();

    if (!form.assetId) {
      toast.error(t.selectAsset);
      return;
    }

    if (Number(form.quantity) <= 0) {
      toast.error(t.validQuantity);
      return;
    }

    setSaving(true);

    try {
      /*
       * Keep the existing inventory movement endpoint.
       * The extra information is included without changing
       * the endpoint contract used by your existing system.
       */
      await axios.post(
        `/api/inventory/${form.assetId}/movement`,
        {
          type: 'issue',
          quantity: Number(form.quantity),
          reason: form.reason,
          recipient:
            form.recipient ||
            form.departmentId ||
            form.staffId,
          department_id: form.departmentId || undefined,
          user_id: form.staffId || undefined,
          notes:
            form.notes ||
            'Issued from store',
          issued_by: user?.id
        }
      );

      toast.success(t.success);

      setForm({
        assetId: '',
        quantity: 1,
        recipient: '',
        departmentId: '',
        staffId: '',
        reason:
          targetType === 'staff'
            ? 'Issue to staff'
            : 'Issue to department',
        notes: ''
      });

      await fetchData();
      setActiveTab('issued');
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
        t.error
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    ['new', `➕ ${t.newIssue}`],
    ['pending', `⏳ ${t.pending}`],
    ['approved', `✅ ${t.approved}`],
    ['department', `🏢 ${t.department}`],
    ['staff', `👤 ${t.staff}`],
    ['issued', `📤 ${t.issued}`],
    ['details', `🔎 ${t.details}`],
    ['history', `📜 ${t.history}`]
  ];

  const card = {
    background: dark ? '#172338' : '#fff',
    border: `1px solid ${dark ? '#2d405d' : '#e2e8f0'}`,
    borderRadius: 14,
    padding: 20
  };

  const input = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${dark ? '#38506f' : '#cbd5e1'}`,
    background: dark ? '#0f1a2b' : '#fff',
    color: dark ? '#f1f5f9' : '#172033'
  };

  if (loading) {
    return (
      <div style={page(dark)}>
        <div style={center}>
          ⏳ {t.loading}
        </div>
      </div>
    );
  }

  return (
    <div style={page(dark)}>
      <div style={header}>
        <div>
          <h1 style={title(dark)}>
            📤 {t.title}
          </h1>
          <p style={sub(dark)}>
            {t.description}
          </p>
        </div>

        <div style={stockBadge(dark)}>
          📦 {availableInventory.length}{' '}
          {t.availableItems}
        </div>
      </div>

      <div style={tabs}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);

              if (
                id === 'department' ||
                id === 'staff'
              ) {
                setTargetType(id);
              }
            }}
            style={{
              ...tab,
              background:
                activeTab === id
                  ? '#2563eb'
                  : dark
                    ? '#22334d'
                    : '#f1f5f9',
              color:
                activeTab === id
                  ? '#fff'
                  : dark
                    ? '#cbd5e1'
                    : '#334155'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {(activeTab === 'new' ||
        activeTab === 'department' ||
        activeTab === 'staff') && (
        <div style={card}>
          <h2 style={heading(dark)}>
            {activeTab === 'staff'
              ? `👤 ${t.issueToStaff}`
              : activeTab === 'department'
                ? `🏢 ${t.issueToDepartment}`
                : `➕ ${t.newIssue}`}
          </h2>

          <div style={targetButtons}>
            <button
              type="button"
              onClick={() => setTargetType('department')}
              style={{
                ...targetButton,
                background:
                  targetType === 'department'
                    ? '#2563eb'
                    : dark
                      ? '#22334d'
                      : '#f1f5f9',
                color:
                  targetType === 'department'
                    ? '#fff'
                    : dark
                      ? '#cbd5e1'
                      : '#334155'
              }}
            >
              🏢 {t.department}
            </button>

            <button
              type="button"
              onClick={() => setTargetType('staff')}
              style={{
                ...targetButton,
                background:
                  targetType === 'staff'
                    ? '#2563eb'
                    : dark
                      ? '#22334d'
                      : '#f1f5f9',
                color:
                  targetType === 'staff'
                    ? '#fff'
                    : dark
                      ? '#cbd5e1'
                      : '#334155'
              }}
            >
              👤 {t.staff}
            </button>
          </div>

          <form onSubmit={issueAsset}>
            <div style={grid}>
              <label style={label(dark)}>
                {t.asset}
                <select
                  style={input}
                  value={form.assetId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assetId: e.target.value
                    })
                  }
                  required
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {availableInventory.map(
                    (item) => (
                      <option
                        key={
                          item.asset_id ||
                          item.id
                        }
                        value={
                          item.asset_id ||
                          item.id
                        }
                      >
                        {item.name ||
                          item.asset_name ||
                          'Asset'}
                        {' — '}
                        {item.available_quantity ??
                          item.availableQuantity ??
                          0}{' '}
                        {t.available}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label style={label(dark)}>
                {t.quantity}
                <input
                  style={input}
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: e.target.value
                    })
                  }
                  required
                />
              </label>

              {targetType === 'department' ? (
                <label style={label(dark)}>
                  {t.department}
                  <input
                    style={input}
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        departmentId:
                          e.target.value
                      })
                    }
                    placeholder={
                      t.departmentPlaceholder
                    }
                  />
                </label>
              ) : (
                <label style={label(dark)}>
                  {t.staff}
                  <input
                    style={input}
                    value={form.staffId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        staffId:
                          e.target.value
                      })
                    }
                    placeholder={
                      t.staffPlaceholder
                    }
                  />
                </label>
              )}

              <label style={label(dark)}>
                {t.recipient}
                <input
                  style={input}
                  value={form.recipient}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recipient:
                        e.target.value
                    })
                  }
                  placeholder={
                    t.recipientPlaceholder
                  }
                />
              </label>

              <label style={label(dark)}>
                {t.reason}
                <input
                  style={input}
                  value={form.reason}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reason: e.target.value
                    })
                  }
                />
              </label>
            </div>

            <label
              style={{
                ...label(dark),
                display: 'block',
                marginTop: 16
              }}
            >
              {t.notes}
              <textarea
                style={{
                  ...input,
                  minHeight: 90
                }}
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value
                  })
                }
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primary,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving
                ? t.saving
                : `📤 ${t.recordIssue}`}
            </button>
          </form>
        </div>
      )}

      {[
        'pending',
        'approved',
        'issued',
        'history',
        'details'
      ].includes(activeTab) && (
        <AssignmentTable
          title={
            tabs.find(
              ([id]) => id === activeTab
            )?.[1]
          }
          assignments={filteredAssignments}
          activeTab={activeTab}
          dark={dark}
          search={search}
          setSearch={setSearch}
          t={t}
        />
      )}
    </div>
  );
};

function AssignmentTable({
  title,
  assignments,
  activeTab,
  dark,
  search,
  setSearch,
  t
}) {
  const data =
    activeTab === 'pending'
      ? assignments.filter(
          (a) =>
            String(a.status || '')
              .toLowerCase() === 'pending'
        )
      : activeTab === 'approved'
        ? assignments.filter(
            (a) =>
              String(a.status || '')
                .toLowerCase() === 'approved'
          )
        : activeTab === 'issued'
          ? assignments.filter((a) =>
              ['active', 'issued'].includes(
                String(a.status || '').toLowerCase()
              )
            )
          : assignments;

  return (
    <div style={cardStyle(dark)}>
      <div style={tableHeader}>
        <h2 style={heading(dark)}>
          {title}
        </h2>

        <input
          style={{
            ...searchInput(dark),
            maxWidth: 300
          }}
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder={t.search}
        />
      </div>

      {data.length === 0 ? (
        <div style={center}>
          {t.noAssignments}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th(dark)}>
                  {t.asset}
                </th>
                <th style={th(dark)}>
                  {t.recipient}
                </th>
                <th style={th(dark)}>
                  {t.department}
                </th>
                <th style={th(dark)}>
                  {t.issueDate}
                </th>
                <th style={th(dark)}>
                  {t.status}
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={td(dark)}>
                    <strong>
                      {item.asset_name ||
                        item.assetName ||
                        'Asset'}
                    </strong>

                    <div style={small(dark)}>
                      {item.asset_tag || ''}
                    </div>
                  </td>

                  <td style={td(dark)}>
                    {item.user_name ||
                      item.assigned_to_name ||
                      item.recipient ||
                      '-'}
                  </td>

                  <td style={td(dark)}>
                    {item.department || '-'}
                  </td>

                  <td style={td(dark)}>
                    {item.issue_date
                      ? new Date(
                          item.issue_date
                        ).toLocaleDateString()
                      : item.created_at
                        ? new Date(
                            item.created_at
                          ).toLocaleDateString()
                        : '-'}
                  </td>

                  <td style={td(dark)}>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: 20,
                        background:
                          String(
                            item.status || ''
                          ).toLowerCase() ===
                          'active'
                            ? '#dcfce7'
                            : '#dbeafe',
                        color:
                          String(
                            item.status || ''
                          ).toLowerCase() ===
                          'active'
                            ? '#166534'
                            : '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {item.status || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const page = (dark) => ({
  minHeight: '100vh',
  padding: 24,
  boxSizing: 'border-box',
  background: dark ? '#0b1424' : '#f1f5f9'
});

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: 15,
  marginBottom: 20
};

const title = (dark) => ({
  margin: 0,
  color: dark ? '#f8fafc' : '#172033'
});

const sub = (dark) => ({
  color: dark ? '#94a3b8' : '#64748b',
  marginTop: 6
});

const stockBadge = (dark) => ({
  padding: '10px 15px',
  borderRadius: 10,
  background: dark ? '#20334d' : '#e0f2fe',
  color: dark ? '#bfdbfe' : '#075985',
  fontWeight: 700
});

const tabs = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 18
};

const tab = {
  border: 0,
  borderRadius: 8,
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 700
};

const cardStyle = (dark) => ({
  background: dark ? '#172338' : '#fff',
  border: `1px solid ${dark ? '#2d405d' : '#e2e8f0'}`,
  borderRadius: 14,
  padding: 20
});

const grid = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit,minmax(220px,1fr))',
  gap: 15
};

const label = (dark) => ({
  display: 'flex',
  flexDirection: 'column',
  color: dark ? '#cbd5e1' : '#475569',
  fontWeight: 700,
  fontSize: 13
});

const heading = (dark) => ({
  marginTop: 0,
  color: dark ? '#f8fafc' : '#172033'
});

const primary = {
  marginTop: 20,
  border: 0,
  borderRadius: 8,
  padding: '12px 18px',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer'
};

const targetButtons = {
  display: 'flex',
  gap: 8,
  marginBottom: 18
};

const targetButton = {
  border: 0,
  borderRadius: 8,
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 700
};

const tableHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 15,
  flexWrap: 'wrap',
  marginBottom: 15
};

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 750
};

const th = (dark) => ({
  textAlign: 'left',
  padding: 12,
  background: dark ? '#0f1a2b' : '#f8fafc',
  color: dark ? '#cbd5e1' : '#475569',
  borderBottom: `2px solid ${dark ? '#30445f' : '#e2e8f0'}`
});

const td = (dark) => ({
  padding: 12,
  borderBottom: `1px solid ${dark ? '#293b55' : '#e2e8f0'}`,
  color: dark ? '#e2e8f0' : '#172033'
});

const small = (dark) => ({
  fontSize: 12,
  color: dark ? '#94a3b8' : '#64748b'
});

const center = {
  padding: 50,
  textAlign: 'center',
  color: '#64748b'
};

const searchInput = (dark) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${dark ? '#38506f' : '#cbd5e1'}`,
  background: dark ? '#0f1a2b' : '#fff',
  color: dark ? '#f1f5f9' : '#172033'
});

const en = {
  title: 'Issue Assets',
  description: 'Manage asset requests, approvals and issuing assets to departments or staff.',
  newIssue: 'New Issue',
  pending: 'Pending Issues',
  approved: 'Approved Issues',
  department: 'Issue to Department',
  staff: 'Issue to Staff',
  issued: 'Issued Assets',
  details: 'Issue Details',
  history: 'Issue History',
  asset: 'Asset',
  quantity: 'Quantity',
  recipient: 'Recipient',
  reason: 'Reason',
  notes: 'Notes',
  selectAsset: 'Select an asset.',
  validQuantity: 'Enter a valid quantity.',
  departmentPlaceholder: 'Department ID or name...',
  staffPlaceholder: 'Staff ID...',
  recipientPlaceholder: 'Recipient name...',
  recordIssue: 'Record Issue',
  saving: 'Saving...',
  success: 'Asset issue recorded successfully.',
  error: 'Failed to issue asset.',
  loadError: 'Unable to load inventory.',
  loading: 'Loading...',
  availableItems: 'available items',
  status: 'Status',
  issueDate: 'Issue Date',
  search: 'Search...',
  noAssignments: 'No issue records found.'
};

const am = {
  title: 'ንብረት ስጥ',
  description: 'የንብረት ጥያቄዎችን፣ ማጽደቆችን እና ለክፍል ወይም ለሰራተኛ ንብረት መስጠትን ያስተዳድሩ።',
  newIssue: 'አዲስ መስጫ',
  pending: 'በመጠባበቅ ላይ',
  approved: 'የጸደቁ',
  department: 'ለክፍል ስጥ',
  staff: 'ለሰራተኛ ስጥ',
  issued: 'የተሰጡ ንብረቶች',
  details: 'የመስጫ ዝርዝር',
  history: 'የመስጫ ታሪክ',
  asset: 'ንብረት',
  quantity: 'ብዛት',
  recipient: 'ተቀባይ',
  reason: 'ምክንያት',
  notes: 'ማስታወሻ',
  selectAsset: 'ንብረት ይምረጡ።',
  validQuantity: 'ትክክለኛ ብዛት ያስገቡ።',
  departmentPlaceholder: 'የክፍል መለያ ወይም ስም...',
  staffPlaceholder: 'የሰራተኛ መለያ...',
  recipientPlaceholder: 'የተቀባይ ስም...',
  recordIssue: 'መስጫ መዝግብ',
  saving: 'በማስቀመጥ ላይ...',
  success: 'የንብረት መስጫ በተሳካ ሁኔታ ተመዝግቧል።',
  error: 'ንብረት መስጠት አልተቻለም።',
  loadError: 'ኢንቬንተሪ መጫን አልተቻለም።',
  loading: 'በመጫን ላይ...',
  availableItems: 'የሚገኙ እቃዎች',
  status: 'ሁኔታ',
  issueDate: 'የመስጫ ቀን',
  search: 'ፈልግ...',
  noAssignments: 'የመስጫ መዝገብ አልተገኘም።'
};

export default StoreIssue;