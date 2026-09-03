import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';

const StoreReceive = () => {
  const { language, theme } = useLanguage();
  const dark = theme === 'dark';
  const t = language === 'en' ? en : am;

  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [source, setSource] = useState('procurement');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    assetId: '',
    quantity: 1,
    reason: 'Stock received',
    location: 'Main Store',
    condition: 'Good',
    reference: '',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const inventoryResponse =
        await axios.get('/api/inventory');

      const data =
        inventoryResponse.data?.inventory ||
        inventoryResponse.data?.data ||
        [];

      setInventory(Array.isArray(data) ? data : []);

      try {
        const movementResponse =
          await axios.get('/api/inventory/movements');

        const movementData =
          movementResponse.data?.movements ||
          movementResponse.data?.data ||
          [];

        setMovements(
          Array.isArray(movementData)
            ? movementData
            : []
        );
      } catch {
        setMovements([]);
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

  const selectedAsset = useMemo(
    () =>
      inventory.find(
        (item) =>
          String(item.asset_id || item.id) ===
          String(form.assetId)
      ),
    [inventory, form.assetId]
  );

  const filteredMovements = useMemo(() => {
    const query = search.toLowerCase();

    return movements.filter((item) => {
      const text = [
        item.asset_name,
        item.name,
        item.asset_tag,
        item.reason,
        item.reference,
        item.type
      ]
        .join(' ')
        .toLowerCase();

      return !query || text.includes(query);
    });
  }, [movements, search]);

  const receive = async (event) => {
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
      await axios.post(
        `/api/inventory/${form.assetId}/movement`,
        {
          type: 'receive',
          quantity: Number(form.quantity),
          reason: form.reason,
          to_location: form.location,
          condition: form.condition,
          reference: form.reference,
          source,
          notes: form.notes || 'Received into store'
        }
      );

      toast.success(t.success);

      setForm({
        assetId: '',
        quantity: 1,
        reason: 'Stock received',
        location: 'Main Store',
        condition: 'Good',
        reference: '',
        notes: ''
      });

      await fetchData();
      setActiveTab('received');
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

  const tabs = [
    ['new', `➕ ${t.newReceipt}`],
    ['pending', `⏳ ${t.pending}`],
    ['received', `📥 ${t.received}`],
    ['procurement', `🛒 ${t.procurement}`],
    ['transfer', `🔄 ${t.transfer}`],
    ['returned', `↩️ ${t.returned}`],
    ['verify', `🔍 ${t.verify}`],
    ['condition', `📝 ${t.condition}`],
    ['history', `📜 ${t.history}`]
  ];

  if (loading) {
    return (
      <div style={page(dark)}>
        <div style={center}>{t.loading}</div>
      </div>
    );
  }

  return (
    <div style={page(dark)}>
      <div style={header}>
        <div>
          <h1 style={title(dark)}>
            📥 {t.title}
          </h1>
          <p style={sub(dark)}>
            {t.description}
          </p>
        </div>

        <div
          style={{
            padding: '10px 15px',
            borderRadius: 10,
            background: dark ? '#20334d' : '#e0f2fe',
            color: dark ? '#bfdbfe' : '#075985',
            fontWeight: 700
          }}
        >
          📦 {inventory.length} {t.inventoryItems}
        </div>
      </div>

      <div style={tabsStyle}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              ...tabButton,
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

      {activeTab === 'new' && (
        <div style={card}>
          <h2 style={heading(dark)}>
            ➕ {t.newReceipt}
          </h2>

          <form onSubmit={receive}>
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

                  {inventory.map((item) => (
                    <option
                      key={item.asset_id || item.id}
                      value={item.asset_id || item.id}
                    >
                      {item.name ||
                        item.asset_name ||
                        item.asset_tag ||
                        'Asset'}
                      {item.asset_tag
                        ? ` (${item.asset_tag})`
                        : ''}
                    </option>
                  ))}
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

              <label style={label(dark)}>
                {t.source}
                <select
                  style={input}
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value)
                  }
                >
                  <option value="procurement">
                    {t.procurement}
                  </option>
                  <option value="transfer">
                    {t.transfer}
                  </option>
                  <option value="return">
                    {t.returned}
                  </option>
                  <option value="other">
                    {t.other}
                  </option>
                </select>
              </label>

              <label style={label(dark)}>
                {t.location}
                <input
                  style={input}
                  value={form.location}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      location: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label style={label(dark)}>
                {t.condition}
                <select
                  style={input}
                  value={form.condition}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition: e.target.value
                    })
                  }
                >
                  <option>New</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Poor</option>
                  <option>Damaged</option>
                </select>
              </label>

              <label style={label(dark)}>
                {t.reference}
                <input
                  style={input}
                  value={form.reference}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reference: e.target.value
                    })
                  }
                  placeholder={t.referencePlaceholder}
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
                  minHeight: 90,
                  resize: 'vertical'
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

            {selectedAsset && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 10,
                  background: dark ? '#0f1a2b' : '#f8fafc'
                }}
              >
                <strong>
                  {selectedAsset.name ||
                    selectedAsset.asset_name}
                </strong>

                <div style={sub(dark)}>
                  {t.currentAvailable}:{' '}
                  {selectedAsset.available_quantity ??
                    selectedAsset.availableQuantity ??
                    0}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primary,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? t.saving : `📥 ${t.save}`}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'received' && (
        <InventoryTable
          inventory={inventory}
          dark={dark}
          title={t.received}
          t={t}
        />
      )}

      {activeTab === 'pending' && (
        <MovementList
          title={t.pending}
          movements={filteredMovements.filter(
            (m) =>
              String(m.status || '').toLowerCase() ===
              'pending'
          )}
          dark={dark}
          t={t}
          search={search}
          setSearch={setSearch}
        />
      )}

      {activeTab === 'history' && (
        <MovementList
          title={t.history}
          movements={filteredMovements}
          dark={dark}
          t={t}
          search={search}
          setSearch={setSearch}
        />
      )}

      {['procurement', 'transfer', 'returned'].includes(
        activeTab
      ) && (
        <div style={card}>
          <h2 style={heading(dark)}>
            {tabs.find(
              ([id]) => id === activeTab
            )?.[1]}
          </h2>

          <p style={sub(dark)}>
            {activeTab === 'procurement'
              ? t.procurementDescription
              : activeTab === 'transfer'
                ? t.transferDescription
                : t.returnDescription}
          </p>

          <button
            style={primary}
            onClick={() => setActiveTab('new')}
          >
            ➕ {t.newReceipt}
          </button>
        </div>
      )}

      {['verify', 'condition'].includes(activeTab) && (
        <div style={card}>
          <h2 style={heading(dark)}>
            {activeTab === 'verify'
              ? `🔍 ${t.verify}`
              : `📝 ${t.condition}`}
          </h2>

          <InventoryTable
            inventory={inventory}
            dark={dark}
            title=""
            t={t}
          />
        </div>
      )}
    </div>
  );
};

function InventoryTable({ inventory, dark, title, t }) {
  return (
    <div style={cardStyle(dark)}>
      {title && (
        <h2 style={heading(dark)}>
          {title}
        </h2>
      )}

      {inventory.length === 0 ? (
        <div style={center}>
          {t.noInventory}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th(dark)}>{t.asset}</th>
                <th style={th(dark)}>{t.available}</th>
                <th style={th(dark)}>{t.location}</th>
                <th style={th(dark)}>{t.status}</th>
              </tr>
            </thead>

            <tbody>
              {inventory.map((item) => (
                <tr key={item.asset_id || item.id}>
                  <td style={td(dark)}>
                    <strong>
                      {item.name ||
                        item.asset_name ||
                        'Asset'}
                    </strong>
                    <div style={small(dark)}>
                      {item.asset_tag || ''}
                    </div>
                  </td>

                  <td style={td(dark)}>
                    {item.available_quantity ??
                      item.availableQuantity ??
                      0}
                  </td>

                  <td style={td(dark)}>
                    {item.location ||
                      item.location_name ||
                      'Main Store'}
                  </td>

                  <td style={td(dark)}>
                    {item.status || 'Available'}
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

function MovementList({
  title,
  movements,
  dark,
  t,
  search,
  setSearch
}) {
  return (
    <div style={cardStyle(dark)}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
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

      {movements.length === 0 ? (
        <div style={center}>
          {t.noMovements}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th(dark)}>{t.asset}</th>
                <th style={th(dark)}>{t.type}</th>
                <th style={th(dark)}>{t.quantity}</th>
                <th style={th(dark)}>{t.reason}</th>
                <th style={th(dark)}>{t.date}</th>
              </tr>
            </thead>

            <tbody>
              {movements.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={td(dark)}>
                    {item.asset_name ||
                      item.name ||
                      item.asset_tag ||
                      'Asset'}
                  </td>

                  <td style={td(dark)}>
                    {item.type ||
                      item.movement_type ||
                      '-'}
                  </td>

                  <td style={td(dark)}>
                    {item.quantity ?? '-'}
                  </td>

                  <td style={td(dark)}>
                    {item.reason ||
                      item.notes ||
                      '-'}
                  </td>

                  <td style={td(dark)}>
                    {item.created_at
                      ? new Date(
                          item.created_at
                        ).toLocaleString()
                      : '-'}
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
  background: dark ? '#0b1424' : '#f1f5f9',
  color: dark ? '#e2e8f0' : '#172033'
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

const tabsStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 18
};

const tabButton = {
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

const heading = (dark) => ({
  marginTop: 0,
  color: dark ? '#f8fafc' : '#172033'
});

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 700
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
  title: 'Receive Assets',
  description: 'Receive, verify and record assets entering the store.',
  newReceipt: 'New Receipt',
  pending: 'Pending Receipts',
  received: 'Received Assets',
  procurement: 'Receive from Procurement',
  transfer: 'Receive from Transfer',
  returned: 'Receive Returned Assets',
  verify: 'Verify Asset',
  condition: 'Record Condition',
  history: 'Receiving History',
  asset: 'Asset',
  quantity: 'Quantity',
  source: 'Source',
  location: 'Location',
  condition: 'Condition',
  reference: 'Reference',
  notes: 'Notes',
  save: 'Save Receipt',
  saving: 'Saving...',
  selectAsset: 'Select an asset.',
  validQuantity: 'Enter a valid quantity.',
  success: 'Asset receipt recorded successfully.',
  error: 'Failed to record receipt.',
  loadError: 'Unable to load inventory.',
  loading: 'Loading inventory...',
  inventoryItems: 'inventory items',
  available: 'Available',
  status: 'Status',
  type: 'Type',
  reason: 'Reason',
  date: 'Date',
  currentAvailable: 'Current available',
  referencePlaceholder: 'PO, transfer or return reference...',
  search: 'Search...',
  noInventory: 'No inventory found.',
  noMovements: 'No receiving records found.',
  other: 'Other',
  procurementDescription: 'Record assets received from procurement.',
  transferDescription: 'Record assets received from another store or department.',
  returnDescription: 'Record returned assets received into store.'
};

const am = {
  title: 'ንብረት ተቀበል',
  description: 'ወደ መደብር የሚገቡ ንብረቶችን ይቀበሉ፣ ያረጋግጡ እና ይመዝግቡ።',
  newReceipt: 'አዲስ ደረሰኝ',
  pending: 'በመጠባበቅ ላይ',
  received: 'የተቀበሉ ንብረቶች',
  procurement: 'ከግዢ ተቀበል',
  transfer: 'ከዝውውር ተቀበል',
  returned: 'የተመለሱ ንብረቶችን ተቀበል',
  verify: 'ንብረት አረጋግጥ',
  condition: 'ሁኔታ መዝግብ',
  history: 'የመቀበያ ታሪክ',
  asset: 'ንብረት',
  quantity: 'ብዛት',
  source: 'ምንጭ',
  location: 'ቦታ',
  condition: 'ሁኔታ',
  reference: 'ማጣቀሻ',
  notes: 'ማስታወሻ',
  save: 'ደረሰኝ አስቀምጥ',
  saving: 'በማስቀመጥ ላይ...',
  selectAsset: 'ንብረት ይምረጡ።',
  validQuantity: 'ትክክለኛ ብዛት ያስገቡ።',
  success: 'የንብረት መቀበያ በተሳካ ሁኔታ ተመዝግቧል።',
  error: 'ንብረት መቀበል አልተቻለም።',
  loadError: 'ኢንቬንተሪ መጫን አልተቻለም።',
  loading: 'ኢንቬንተሪ በመጫን ላይ...',
  inventoryItems: 'የኢንቬንተሪ እቃዎች',
  available: 'ይገኛል',
  status: 'ሁኔታ',
  type: 'አይነት',
  reason: 'ምክንያት',
  date: 'ቀን',
  currentAvailable: 'አሁን የሚገኝ',
  referencePlaceholder: 'የግዢ፣ ዝውውር ወይም መመለሻ ማጣቀሻ...',
  search: 'ፈልግ...',
  noInventory: 'ኢንቬንተሪ አልተገኘም።',
  noMovements: 'የመቀበያ መዝገብ አልተገኘም።',
  other: 'ሌላ',
  procurementDescription: 'ከግዢ የተቀበሉ ንብረቶችን ይመዝግቡ።',
  transferDescription: 'ከሌላ መደብር ወይም ክፍል የተቀበሉ ንብረቶችን ይመዝግቡ።',
  returnDescription: 'የተመለሱ ንብረቶችን ወደ መደብር መቀበል ይመዝግቡ።'
};

export default StoreReceive;