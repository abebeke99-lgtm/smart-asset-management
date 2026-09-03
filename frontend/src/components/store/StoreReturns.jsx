import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';

const StoreReturns = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  const dark = theme === 'dark';
  const t = language === 'en' ? en : am;

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const [condition, setCondition] =
    useState('Good');

  const [remarks, setRemarks] =
    useState('');

  const fetchReturns = useCallback(async () => {
    setLoading(true);

    try {
      const response =
        await axios.get('/api/assignments', {
          params: { limit: 500 }
        });

      const data =
        response.data?.assignments ||
        response.data?.data ||
        [];

      setReturns(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);
      setReturns([]);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const returnRecords = useMemo(() => {
    return returns.filter((item) => {
      const status =
        String(item.status || '')
          .toLowerCase();

      return (
        status === 'returned' ||
        status === 'return_requested' ||
        status === 'return request' ||
        status === 'pending_return' ||
        status === 'active' ||
        status === 'overdue'
      );
    });
  }, [returns]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return returnRecords.filter((item) => {
      const text = [
        item.asset_name,
        item.asset_tag,
        item.user_name,
        item.assigned_to_name,
        item.department,
        item.status
      ]
        .join(' ')
        .toLowerCase();

      return !query || text.includes(query);
    });
  }, [returnRecords, search]);

  const categorized = useMemo(() => {
    const pending = filtered.filter((item) =>
      [
        'return_requested',
        'return request',
        'pending_return'
      ].includes(
        String(item.status || '')
          .toLowerCase()
      )
    );

    const received = filtered.filter((item) =>
      ['returned', 'received'].includes(
        String(item.status || '')
          .toLowerCase()
      )
    );

    return {
      pending,
      received,
      all: filtered
    };
  }, [filtered]);

  const inspect = (item) => {
    setSelected(item);
    setCondition(
      item.condition_after ||
      item.condition_at_return ||
      'Good'
    );
    setRemarks(
      item.remarks ||
      item.notes ||
      ''
    );
    setActiveTab('inspect');
  };

  const processReturn = async (
    action
  ) => {
    if (!selected) {
      toast.error(t.selectReturn);
      return;
    }

    setProcessing(true);

    try {
      const id =
        selected.id ||
        selected.assignment_id;

      if (action === 'accept') {
        await axios.post(
          `/api/assignments/${id}/return`,
          {
            condition_at_return: condition,
            returned_by: user?.id,
            notes: remarks
          }
        );

        toast.success(t.acceptSuccess);
      } else {
        /*
         * There may not be a dedicated reject endpoint
         * in the current backend. Do not fake a request.
         */
        toast.info(t.rejectBackend);
        setProcessing(false);
        return;
      }

      setSelected(null);
      setActiveTab('received');
      await fetchReturns();
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
        t.processError
      );
    } finally {
      setProcessing(false);
    }
  };

  const tabs = [
    ['requests', `📩 ${t.requests}`],
    ['pending', `⏳ ${t.pending}`],
    ['received', `📥 ${t.received}`],
    ['inspect', `🔍 ${t.inspect}`],
    ['accept', `✅ ${t.accept}`],
    ['reject', `❌ ${t.reject}`],
    ['condition', `📝 ${t.condition}`],
    ['history', `📜 ${t.history}`]
  ];

  const displayData =
    activeTab === 'pending'
      ? categorized.pending
      : activeTab === 'received'
        ? categorized.received
        : categorized.all;

  const card = {
    background: dark ? '#172338' : '#fff',
    border: `1px solid ${dark ? '#2d405d' : '#e2e8f0'}`,
    borderRadius: 14,
    padding: 20
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
            ↩️ {t.title}
          </h1>

          <p style={sub(dark)}>
            {t.description}
          </p>
        </div>

        <div style={stats}>
          <Stat
            label={t.total}
            value={returnRecords.length}
            dark={dark}
          />

          <Stat
            label={t.pending}
            value={categorized.pending.length}
            dark={dark}
          />

          <Stat
            label={t.received}
            value={categorized.received.length}
            dark={dark}
          />
        </div>
      </div>

      <div style={tabsStyle}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
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

      {activeTab !== 'inspect' &&
        activeTab !== 'accept' &&
        activeTab !== 'reject' &&
        activeTab !== 'condition' && (
          <div style={card}>
            <div style={toolbar}>
              <h2 style={heading(dark)}>
                {tabs.find(
                  ([id]) => id === activeTab
                )?.[1]}
              </h2>

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder={t.search}
                style={searchInput(dark)}
              />
            </div>

            {displayData.length === 0 ? (
              <div style={center}>
                ↩️ {t.noReturns}
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
                        {t.assignedTo}
                      </th>

                      <th style={th(dark)}>
                        {t.department}
                      </th>

                      <th style={th(dark)}>
                        {t.returnDate}
                      </th>

                      <th style={th(dark)}>
                        {t.condition}
                      </th>

                      <th style={th(dark)}>
                        {t.status}
                      </th>

                      <th style={th(dark)}>
                        {t.actions}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayData.map(
                      (item, index) => (
                        <tr
                          key={
                            item.id ||
                            item.assignment_id ||
                            index
                          }
                        >
                          <td style={td(dark)}>
                            <strong>
                              {item.asset_name ||
                                item.assetName ||
                                'Asset'}
                            </strong>

                            <div style={small(dark)}>
                              {item.asset_tag ||
                                ''}
                            </div>
                          </td>

                          <td style={td(dark)}>
                            {item.user_name ||
                              item.assigned_to_name ||
                              item.assignedTo ||
                              '-'}
                          </td>

                          <td style={td(dark)}>
                            {item.department ||
                              '-'}
                          </td>

                          <td style={td(dark)}>
                            {item.actual_return_date
                              ? new Date(
                                  item.actual_return_date
                                ).toLocaleDateString()
                              : item.return_date
                                ? new Date(
                                    item.return_date
                                  ).toLocaleDateString()
                                : '-'}
                          </td>

                          <td style={td(dark)}>
                            {item.condition_after ||
                              item.condition_at_return ||
                              '-'}
                          </td>

                          <td style={td(dark)}>
                            <Status
                              value={item.status}
                            />
                          </td>

                          <td style={td(dark)}>
                            <button
                              onClick={() =>
                                inspect(item)
                              }
                              style={action}
                            >
                              🔍 {t.inspect}
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {(activeTab === 'inspect' ||
        activeTab === 'accept' ||
        activeTab === 'reject' ||
        activeTab === 'condition') && (
        <div style={card}>
          <h2 style={heading(dark)}>
            🔍 {t.inspectReturned}
          </h2>

          {!selected ? (
            <div style={center}>
              {t.selectRecordFirst}
              <br />

              <button
                style={primary}
                onClick={() =>
                  setActiveTab('requests')
                }
              >
                {t.selectRecord}
              </button>
            </div>
          ) : (
            <>
              <div style={assetInfo(dark)}>
                <div>
                  <strong>
                    {selected.asset_name ||
                      selected.assetName ||
                      'Asset'}
                  </strong>

                  <div style={small(dark)}>
                    {selected.asset_tag ||
                      '-'}
                  </div>
                </div>

                <Status
                  value={selected.status}
                />
              </div>

              <div style={formGrid}>
                <label style={label(dark)}>
                  {t.condition}
                  <select
                    value={condition}
                    onChange={(e) =>
                      setCondition(
                        e.target.value
                      )
                    }
                    style={input(dark)}
                  >
                    <option>New</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Poor</option>
                    <option>Damaged</option>
                  </select>
                </label>

                <label style={label(dark)}>
                  {t.remarks}
                  <textarea
                    value={remarks}
                    onChange={(e) =>
                      setRemarks(
                        e.target.value
                      )
                    }
                    style={{
                      ...input(dark),
                      minHeight: 100
                    }}
                  />
                </label>
              </div>

              <div style={actions}>
                <button
                  style={success}
                  disabled={processing}
                  onClick={() =>
                    processReturn('accept')
                  }
                >
                  {processing
                    ? t.processing
                    : `✅ ${t.accept}`}
                </button>

                <button
                  style={danger}
                  disabled={processing}
                  onClick={() =>
                    processReturn('reject')
                  }
                >
                  ❌ {t.reject}
                </button>
              </div>

              {activeTab === 'reject' && (
                <div
                  style={{
                    marginTop: 15,
                    padding: 14,
                    borderRadius: 10,
                    background: dark
                      ? '#3a2025'
                      : '#fef2f2',
                    color: dark
                      ? '#fecaca'
                      : '#991b1b'
                  }}
                >
                  {t.rejectBackend}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, dark }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 9,
        background: dark
          ? '#22334d'
          : '#f8fafc',
        minWidth: 75
      }}
    >
      <strong>{value}</strong>
      <div style={small(dark)}>
        {label}
      </div>
    </div>
  );
}

function Status({ value }) {
  const normalized =
    String(value || '').toLowerCase();

  const good = [
    'returned',
    'received',
    'approved',
    'active'
  ].includes(normalized);

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 9px',
        borderRadius: 20,
        background: good
          ? '#dcfce7'
          : '#fef3c7',
        color: good
          ? '#166534'
          : '#92400e',
        fontSize: 12,
        fontWeight: 700
      }}
    >
      {value || '-'}
    </span>
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
  gap: 20,
  flexWrap: 'wrap',
  marginBottom: 20
};

const title = (dark) => ({
  margin: 0,
  color: dark ? '#f8fafc' : '#172033'
});

const sub = (dark) => ({
  color: dark ? '#94a3b8' : '#64748b'
});

const stats = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const tabsStyle = {
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

const heading = (dark) => ({
  marginTop: 0,
  color: dark ? '#f8fafc' : '#172033'
});

const toolbar = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 15,
  flexWrap: 'wrap',
  marginBottom: 15
};

const searchInput = (dark) => ({
  width: 280,
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${dark ? '#38506f' : '#cbd5e1'}`,
  background: dark ? '#0f1a2b' : '#fff',
  color: dark ? '#f1f5f9' : '#172033'
});

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 900
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
  color: dark ? '#94a3b8' : '#64748b',
  marginTop: 4
});

const center = {
  padding: 50,
  textAlign: 'center',
  color: '#64748b'
};

const action = {
  border: 0,
  borderRadius: 7,
  padding: '7px 10px',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700
};

const assetInfo = (dark) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 15,
  borderRadius: 10,
  background: dark ? '#0f1a2b' : '#f8fafc',
  marginBottom: 20
});

const formGrid = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit,minmax(260px,1fr))',
  gap: 15
};

const label = (dark) => ({
  display: 'flex',
  flexDirection: 'column',
  color: dark ? '#cbd5e1' : '#475569',
  fontWeight: 700,
  fontSize: 13
});

const input = (dark) => ({
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${dark ? '#38506f' : '#cbd5e1'}`,
  background: dark ? '#0f1a2b' : '#fff',
  color: dark ? '#f1f5f9' : '#172033'
});

const actions = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 20
};

const primary = {
  marginTop: 15,
  border: 0,
  borderRadius: 8,
  padding: '10px 16px',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700
};

const success = {
  ...primary,
  background: '#16a34a'
};

const danger = {
  ...primary,
  background: '#dc2626'
};

const en = {
  title: 'Returns',
  description: 'Manage return requests, returned assets, inspection, acceptance and return history.',
  total: 'Total',
  requests: 'Return Requests',
  pending: 'Pending Returns',
  received: 'Received Returns',
  inspect: 'Inspect Returned Asset',
  accept: 'Accept Return',
  reject: 'Reject Return',
  condition: 'Return Condition',
  history: 'Return History',
  inspectReturned: 'Inspect Returned Asset',
  asset: 'Asset',
  assignedTo: 'Assigned To',
  department: 'Department',
  returnDate: 'Return Date',
  status: 'Status',
  actions: 'Actions',
  remarks: 'Remarks',
  search: 'Search returns...',
  noReturns: 'No return records found.',
  selectRecordFirst: 'Select a return record first.',
  selectRecord: 'View Return Requests',
  selectReturn: 'Select a return record.',
  acceptSuccess: 'Return accepted successfully.',
  processError: 'Failed to process return.',
  rejectBackend: 'A dedicated reject-return endpoint is not available in the current API, so no fake rejection request was sent.',
  loading: 'Loading returns...',
  loadError: 'Unable to load return records.',
  processing: 'Processing...'
};

const am = {
  title: 'መመለሻዎች',
  description: 'የመመለሻ ጥያቄዎችን፣ የተመለሱ ንብረቶችን፣ ምርመራን፣ ተቀባይነትን እና ታሪክን ያስተዳድሩ።',
  total: 'ጠቅላላ',
  requests: 'የመመለሻ ጥያቄዎች',
  pending: 'በመጠባበቅ ላይ',
  received: 'የተቀበሉ መመለሻዎች',
  inspect: 'የተመለሰ ንብረት መርምር',
  accept: 'መመለሻ ተቀበል',
  reject: 'መመለሻ አትቀበል',
  condition: 'የመመለሻ ሁኔታ',
  history: 'የመመለሻ ታሪክ',
  inspectReturned: 'የተመለሰ ንብረት መርምር',
  asset: 'ንብረት',
  assignedTo: 'የተሰጠው ለ',
  department: 'ክፍል',
  returnDate: 'የመመለሻ ቀን',
  status: 'ሁኔታ',
  actions: 'ተግባራት',
  remarks: 'ማስታወሻ',
  search: 'መመለሻ ፈልግ...',
  noReturns: 'የመመለሻ መዝገብ አልተገኘም።',
  selectRecordFirst: 'መጀመሪያ የመመለሻ መዝገብ ይምረጡ።',
  selectRecord: 'የመመለሻ ጥያቄዎችን ይመልከቱ',
  selectReturn: 'የመመለሻ መዝገብ ይምረጡ።',
  acceptSuccess: 'መመለሻው በተሳካ ሁኔታ ተቀብሏል።',
  processError: 'መመለሻውን ማስኬድ አልተቻለም።',
  rejectBackend: 'የተለየ reject-return API endpoint በአሁኑ backend ውስጥ ስለሌለ የውሸት ጥያቄ አልተላከም።',
  loading: 'መመለሻዎችን በመጫን ላይ...',
  loadError: 'የመመለሻ መዝገቦችን ማግኘት አልተቻለም።',
  processing: 'በሂደት ላይ...'
};

export default StoreReturns;