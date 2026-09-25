import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Link,
  Package,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  Unlink,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { QRCodeCanvas } from "qrcode.react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import "./ICTAssets.css";
import "./ICTRFIDTracking.css";

const emptyState = {
  data: [],
  summary: { totalTrackedAssets: 0, qrEnabled: 0, rfidEnabled: 0, recentlyScanned: 0 },
  filters: { categories: [], locations: [], statuses: [], conditions: [] },
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "Not detected");
const displayValue = (value, fallback = "Not available") => value || fallback;

const statusIcon = (status) => {
  if (status === "Active" || status === "QR enabled") return <CheckCircle2 size={15} />;
  if (status === "Not detected") return <AlertTriangle size={15} />;
  return <XCircle size={15} />;
};

const ICTRFIDTracking = () => {
  const [state, setState] = useState(emptyState);
  const [query, setQuery] = useState({ search: "", trackingType: "", category: "", location: "", condition: "", page: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [scanValue, setScanValue] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  const loadTracking = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/api/ict/tracking", {
        params: Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "")),
        signal,
      });
      setState({ ...emptyState, ...(response.data || {}), pagination: { ...emptyState.pagination, ...(response.data?.pagination || {}) } });
    } catch (requestError) {
      if (requestError.code === "ERR_CANCELED") return;
      setError(getApiErrorMessage(requestError, "Unable to load tracking records. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadTracking(controller.signal), query.search ? 350 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadTracking, query.search]);

  const updateQuery = (name, value) => setQuery((current) => ({ ...current, [name]: value, ...(name !== "page" ? { page: 1 } : {}) }));

  const openDetails = async (asset) => {
    try {
      const response = await apiClient.get(`/api/ict/tracking/${asset.id}`);
      const detail = response.data?.data || asset;
      setSelected(detail);
      setTagValue(detail.rfidUid || "");
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, "Unable to load tracking details."));
    }
  };

  const scanIdentifier = async (event) => {
    event.preventDefault();
    if (!scanValue.trim()) return;
    try {
      const response = await apiClient.get(`/api/ict/tracking/scan/${encodeURIComponent(scanValue.trim())}`);
      setSelected(response.data?.data || null);
      setTagValue(response.data?.data?.rfidUid || "");
      setScanValue("");
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, "QR code not recognized. No matching asset was found."));
    }
  };

  const saveTag = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSavingTag(true);
    try {
      await apiClient.post("/api/ict/tracking/assign", { assetId: selected.id, rfidUid: tagValue });
      toast.success("RFID UID assigned successfully.");
      await openDetails(selected);
      await loadTracking();
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, "Unable to assign RFID UID."));
    } finally {
      setSavingTag(false);
    }
  };

  const unassignTag = async () => {
    if (!selected?.rfidUid || !window.confirm(`Unassign RFID UID ${selected.rfidUid} from ${selected.name || "this asset"}?`)) return;
    setSavingTag(true);
    try {
      await apiClient.delete(`/api/ict/tracking/${selected.id}/rfid`);
      toast.success("RFID UID unassigned successfully.");
      await openDetails({ ...selected, rfidUid: null });
      await loadTracking();
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, "Unable to unassign RFID UID."));
    } finally {
      setSavingTag(false);
    }
  };

  const downloadQr = () => {
    const canvas = document.getElementById(`tracking-qr-${selected?.id}`);
    if (!canvas || !selected?.qrIdentifier) return;
    const link = document.createElement("a");
    link.download = `${selected.assetTag || selected.id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const retry = () => loadTracking();
  const totalPages = Math.max(1, state.pagination.totalPages || 1);

  return (
    <main className="ict-assets-page">
      <header className="ict-assets-header">
        <div className="page-heading">
          <div className="heading-icon"><Radio size={24} /></div>
          <div><p className="eyebrow">Tracking</p><h1>RFID / QR Tracking</h1><p className="subtitle">Track, identify, and manage ICT assets using QR and RFID identifiers.</p></div>
        </div>
        <div className="header-actions">
          <form className="search-field" onSubmit={scanIdentifier}><ScanLine size={16} /><input value={scanValue} onChange={(event) => setScanValue(event.target.value)} placeholder="Scan QR or enter identifier" aria-label="Scan QR or enter identifier" /><button className="icon-button" type="submit" title="Find identifier"><Search size={16} /></button></form>
          <button className="quiet-button" type="button" onClick={retry} title="Refresh tracking records"><RefreshCw size={16} /> Refresh</button>
        </div>
      </header>

      <section className="ict-summary-grid" aria-label="Tracking summary">
        <SummaryCard icon={<Package size={18} />} label="Total tracked assets" value={state.summary.totalTrackedAssets} />
        <SummaryCard icon={<ScanLine size={18} />} label="QR enabled" value={state.summary.qrEnabled} />
        <SummaryCard icon={<Radio size={18} />} label="RFID enabled" value={state.summary.rfidEnabled} />
        <SummaryCard icon={<CheckCircle2 size={18} />} label="Recently scanned" value={state.summary.recentlyScanned} />
      </section>

      <section className="filter-panel">
        <div className="filter-title"><Search size={16} /> Search and filter tracking records</div>
        <div className="filter-controls">
          <label className="search-field"><Search size={16} /><input value={query.search} onChange={(event) => updateQuery("search", event.target.value)} placeholder="Asset, tag, serial, QR or RFID UID" /></label>
          <select value={query.trackingType} onChange={(event) => updateQuery("trackingType", event.target.value)} aria-label="Tracking type"><option value="">All tracking types</option><option value="qr">QR</option><option value="rfid">RFID</option><option value="qr_rfid">QR + RFID</option></select>
          <select value={query.category} onChange={(event) => updateQuery("category", event.target.value)} aria-label="Asset category"><option value="">All categories</option>{state.filters.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={query.location} onChange={(event) => updateQuery("location", event.target.value)} aria-label="Location"><option value="">All locations</option>{state.filters.locations.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={query.condition} onChange={(event) => updateQuery("condition", event.target.value)} aria-label="Condition"><option value="">All conditions</option>{state.filters.conditions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </div>
      </section>

      {error ? <section className="tracking-message error-message"><AlertTriangle size={20} /><div><strong>Unable to load tracking records.</strong><p>{error}</p><button className="quiet-button" type="button" onClick={retry}><RefreshCw size={15} /> Retry</button></div></section> : null}

      <section className="table-panel">
        <div className="table-panel-header"><div><strong>Tracked ICT assets</strong><span>{state.pagination.total} records</span></div></div>
        <div className="responsive-table"><table><thead><tr><th>Asset</th><th>Asset tag</th><th>QR identifier</th><th>RFID UID</th><th>Status</th><th>Last scan</th><th>Location</th><th>Condition</th><th>Actions</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="9" className="table-empty">Loading tracking records...</td></tr> : state.data.length === 0 ? <tr><td colSpan="9" className="table-empty"><Package size={24} /><strong>No tracked assets yet</strong><span>QR and RFID tracking records will appear here once assets are registered with identifiers.</span></td></tr> : state.data.map((asset) => <tr key={asset.id}>
            <td><strong>{displayValue(asset.name)}</strong><small>{displayValue(asset.serialNumber, "Serial not recorded")}</small></td><td>{displayValue(asset.assetTag)}</td><td>{displayValue(asset.qrIdentifier)}</td><td>{displayValue(asset.rfidUid, "Not assigned")}</td>
            <td><span className={`tracking-status ${asset.trackingStatus === "Active" ? "is-active" : "is-warning"}`}>{statusIcon(asset.trackingStatus)} {asset.trackingStatus}</span></td><td>{formatDate(asset.lastScan)}</td><td>{displayValue(asset.trackingLocation || asset.location)}</td><td>{displayValue(asset.condition)}</td>
            <td><button className="icon-button" type="button" onClick={() => openDetails(asset)} title="View tracking details"><Eye size={17} /></button></td>
          </tr>)}
        </tbody></table></div>
        <footer className="pagination-bar"><span>Page {query.page} of {totalPages}</span><div><button className="quiet-button" type="button" disabled={query.page <= 1} onClick={() => updateQuery("page", query.page - 1)}>Previous</button><button className="quiet-button" type="button" disabled={query.page >= totalPages} onClick={() => updateQuery("page", query.page + 1)}>Next</button></div></footer>
      </section>

      {selected ? <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="tracking-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><p className="eyebrow">Asset tracking</p><h2>{displayValue(selected.name)}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} title="Close details"><X size={18} /></button></div>
        <div className="detail-grid"><Detail label="Asset tag" value={selected.assetTag} /><Detail label="Serial number" value={selected.serialNumber} /><Detail label="Category" value={selected.category} /><Detail label="Condition" value={selected.condition} /><Detail label="Location" value={selected.location} /><Detail label="Assigned to" value={selected.assignedTo} /><Detail label="QR identifier" value={selected.qrIdentifier} /><Detail label="RFID UID" value={selected.rfidUid} /></div>
        <div className="tracking-detail-status"><span>Tracking status</span><strong>{statusIcon(selected.trackingStatus)} {selected.trackingStatus}</strong><small>Last detected: {formatDate(selected.lastDetected)}</small></div>
        {selected.qrIdentifier ? <div className="qr-preview"><div><h3>QR code</h3><p>Encodes this asset identifier only.</p></div><QRCodeCanvas id={`tracking-qr-${selected.id}`} value={selected.qrIdentifier} size={160} includeMargin /><button className="quiet-button" type="button" onClick={downloadQr}><Download size={16} /> Download QR</button></div> : null}
        <form className="tag-form" onSubmit={saveTag}><label>RFID UID<input value={tagValue} onChange={(event) => setTagValue(event.target.value)} placeholder="Enter RFID UID" maxLength="255" /></label><button className="primary-button" type="submit" disabled={savingTag || !tagValue.trim()}><Link size={16} /> {selected.rfidUid ? "Change tag" : "Assign tag"}</button>{selected.rfidUid ? <button className="quiet-button danger-button" type="button" onClick={unassignTag} disabled={savingTag}><Unlink size={16} /> Unassign</button> : null}</form>
        <div className="tracking-history"><h3>Tracking activity</h3>{selected.history?.length ? selected.history.map((event) => <div className="history-row" key={event.id}><span>{event.action || "Tracking event"}</span><small>{event.location || "Location not recorded"} · {formatDate(event.timestamp)}</small></div>) : <p>Never scanned. No persisted tracking events are available.</p>}</div>
      </aside></div> : null}
    </main>
  );
};

const SummaryCard = ({ icon, label, value }) => <div className="tracking-summary-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
const Detail = ({ label, value }) => <div><small>{label}</small><strong>{displayValue(value)}</strong></div>;

export default ICTRFIDTracking;
