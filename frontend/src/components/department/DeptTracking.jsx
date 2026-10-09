import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, ClipboardCheck, FileText, MapPin, RefreshCw, Search, Tag, UserRound, Wrench } from 'lucide-react';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import './DeptTracking.css';

const display = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const rows = (response) => Array.isArray(response?.data?.data) ? response.data.data : [];

export default function DeptTracking() {
  const { language } = useLanguage();
  const amharic = language === 'am';
  const copy = (english, translated) => amharic ? translated : english;
  const [identifier, setIdentifier] = useState('');
  const [asset, setAsset] = useState(null);
  const [location, setLocation] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [movementHistory, setMovementHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [panelNotice, setPanelNotice] = useState('');
  const [scannerMessage, setScannerMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const scanHandledRef = useRef(false);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch (stopError) {
      setScannerMessage(getApiErrorMessage(stopError, copy('Unable to stop the camera.', 'ካሜራውን ማቆም አልተቻለም።')));
    }
    try {
      scanner.clear();
    } catch (clearError) {
      setScannerMessage(getApiErrorMessage(clearError, copy('Unable to close the camera scanner.', 'የካሜራ ስካነሩን መዝጋት አልተቻለም።')));
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    Promise.resolve(scanner.stop())
      .then(() => scanner.clear())
      .catch((cleanupError) => console.error('Department tracking scanner cleanup failed:', cleanupError));
    scannerRef.current = null;
  }, []);

  const loadAsset = async (value) => {
    const code = String(value || '').trim();
    if (!code || loading) return;
    setLoading(true);
    setError('');
    setPanelNotice('');
    setAsset(null);
    setLocation(null);
    setAssignments([]);
    setTransfers([]);
    setMaintenance([]);
    setDocuments([]);
    setMovementHistory([]);
    const empty = { data: {} };
    const emptyList = { data: { data: [] } };
    const settle = async (path, fallback) => {
      try {
        return await apiClient.get(path);
      } catch (panelError) {
        if (!panelError) return fallback;
        if (panelError.response?.status === 401 || panelError.response?.status === 403) throw panelError;
        setPanelNotice(getApiErrorMessage(panelError, copy('Some tracking details could not be loaded.', 'አንዳንድ የክትትል ዝርዝሮች መጫን አልተቻለም።')));
        return fallback;
      }
    };
    try {
      const scanResponse = await apiClient.get(`/assets/scan/${encodeURIComponent(code)}`);
      const scannedAsset = scanResponse.data?.data?.id ? scanResponse.data.data : scanResponse.data?.asset;
      if (!scannedAsset?.id) throw new Error(copy('Asset not found in your department.', 'በክፍልዎ ውስጥ ንብረቱ አልተገኘም።'));
      const id = encodeURIComponent(scannedAsset.id);
      const [assetResponse, locationResponse, assignmentResponse, transferResponse, maintenanceResponse, documentResponse, historyResponse] = await Promise.all([
        settle(`/assets/${id}`, null),
        settle(`/assets/${id}/location`, empty),
        settle(`/assets/${id}/assignments`, emptyList),
        settle(`/assets/${id}/transfers`, emptyList),
        settle(`/assets/${id}/maintenance`, emptyList),
        settle(`/assets/${id}/documents`, emptyList),
        settle(`/assets/${id}/history`, empty),
      ]);
      setAsset(assetResponse?.data?.asset || assetResponse?.data?.data || scannedAsset);
      setLocation(locationResponse.data?.data || {});
      setAssignments(rows(assignmentResponse));
      setTransfers(rows(transferResponse));
      setMaintenance(rows(maintenanceResponse));
      setDocuments(rows(documentResponse));
      const historyRows = Array.isArray(historyResponse.data?.history) ? historyResponse.data.history : rows(historyResponse);
      setMovementHistory(historyRows.filter((record) => ['rfid', 'reader_scan', 'rfid_scan'].includes(String(record.type || '').toLowerCase())));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, copy('Unable to load tracking details for this asset.', 'የንብረቱን የክትትል ዝርዝር መጫን አልተቻለም።')));
    } finally {
      setLoading(false);
    }
  };

  const submitLookup = (event) => {
    event.preventDefault();
    if (!loading) void loadAsset(identifier);
  };

  const startScanner = async () => {
    if (scannerRef.current || scanning) return;
    setScannerMessage('');
    const hostname = window.location.hostname;
    const localHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    if (!window.isSecureContext && !localHost) {
      setScannerMessage(copy('Camera access requires HTTPS or localhost.', 'ካሜራ ለመጠቀም HTTPS ወይም localhost ያስፈልጋል።'));
      return;
    }
    scanHandledRef.current = false;
    let scanner;
    try {
      scanner = new Html5Qrcode('department-tracking-qr-reader');
      scannerRef.current = scanner;
      setScanning(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const onDecode = (decoded) => {
        if (scanHandledRef.current) return;
        scanHandledRef.current = true;
        const code = String(decoded || '').trim();
        void stopScanner().then(() => {
          if (!code) {
            setError(copy('The scanned QR code was empty.', 'የተቃኘው QR ኮድ ባዶ ነው።'));
            return;
          }
          setIdentifier(code);
          void loadAsset(code);
        });
      };
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, onDecode, () => {});
    } catch (cameraError) {
      if (scannerRef.current === scanner) scannerRef.current = null;
      setScanning(false);
      if (scanner) {
        try {
          scanner.clear();
        } catch (clearError) {
          console.error('Unable to clear the department tracking camera scanner:', clearError);
        }
      }
      setScannerMessage(getApiErrorMessage(cameraError, copy('Camera is unavailable or permission was denied.', 'ካሜራው አይገኝም ወይም ፈቃድ ተከልክሏል።')));
    }
  };

  const downloadDocument = async (document) => {
    setDownloadingId(document.id);
    try {
      const response = await apiClient.get(`/assets/${asset.id}/documents/${document.id}/file`, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName || document.original_name || document.documentType || 'asset-document';
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, copy('Unable to download this asset document.', 'ይህን የንብረት ሰነድ ማውረድ አልተቻለም።')));
    } finally {
      setDownloadingId(null);
    }
  };

  const currentAssignment = assignments.find((assignment) => String(assignment.status).toLowerCase() === 'active');
  const locationText = [location?.campus, location?.building, location?.floor !== null && location?.floor !== undefined ? `${copy('Floor', 'ወለል')} ${location.floor}` : null, location?.room]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="department-tracking">
      <header className="department-tracking__header">
        <div>
          <p className="department-tracking__eyebrow">{copy('Department operations', 'የክፍል ስራዎች')}</p>
          <h1>{copy('QR / RFID Asset Tracking', 'QR / RFID የንብረት ክትትል')}</h1>
          <p>{copy('Scan a QR code, read an RFID tag, or look up an authorized department asset.', 'QR ኮድ ይቃኙ፣ RFID መለያ ያንብቡ ወይም የተፈቀደ የክፍል ንብረት ይፈልጉ።')}</p>
        </div>
        <Link className="department-tracking__verification-link" to="/department-head/verification">
          <ClipboardCheck size={17} aria-hidden="true" />
          {copy('Physical inventory verification', 'የአካል ንብረት ማረጋገጫ')}
        </Link>
      </header>

      <form className="department-tracking__lookup" onSubmit={submitLookup}>
        <label htmlFor="department-tracking-identifier">{copy('QR code, RFID tag, or asset ID', 'QR ኮድ፣ RFID መለያ ወይም የንብረት መለያ')}</label>
        <div className="department-tracking__lookup-controls">
          <input
            id="department-tracking-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={copy('Scan or enter identifier', 'መለያ ይቃኙ ወይም ያስገቡ')}
            autoComplete="off"
          />
          <button type="submit" disabled={!identifier.trim() || loading}>
            <Search size={17} aria-hidden="true" />
            {loading ? copy('Looking up…', 'በመፈለግ ላይ…') : copy('Look up asset', 'ንብረት ፈልግ')}
          </button>
          <button type="button" className="department-tracking__camera-button" onClick={scanning ? stopScanner : startScanner} disabled={loading}>
            <Camera size={17} aria-hidden="true" />
            {scanning ? copy('Stop camera', 'ካሜራ አቁም') : copy('Scan QR', 'QR ቃኝ')}
          </button>
        </div>
      </form>
      <div id="department-tracking-qr-reader" className={scanning ? 'department-tracking__reader' : 'department-tracking__reader department-tracking__reader--hidden'} />
      {scannerMessage && <p className="department-tracking__notice" role="status">{scannerMessage}</p>}
      {error && <p className="department-tracking__error" role="alert">{error}</p>}
      {panelNotice && <p className="department-tracking__notice" role="status">{panelNotice}</p>}
      {loading && <p className="department-tracking__loading" role="status"><RefreshCw size={16} aria-hidden="true" /> {copy('Loading authorized asset records…', 'የተፈቀዱ የንብረት መዝገቦችን በመጫን ላይ…')}</p>}

      {!asset && !loading && !error && (
        <section className="department-tracking__empty">
          <Tag size={28} aria-hidden="true" />
          <p>{copy('Enter or scan an identifier to view tracking details for an asset in your department.', 'በክፍልዎ ያለ ንብረት የክትትል ዝርዝር ለማየት መለያ ያስገቡ ወይም ይቃኙ።')}</p>
        </section>
      )}

      {asset && (
        <div className="department-tracking__details">
          <section className="department-tracking__card">
            <div className="department-tracking__section-title"><Tag size={18} aria-hidden="true" /><h2>{copy('Asset identity', 'የንብረት መለያ')}</h2></div>
            <h3>{display(asset.name)}</h3>
            <dl className="department-tracking__facts">
              <div><dt>{copy('Asset ID', 'የንብረት መለያ')}</dt><dd>{display(asset.assetCode || asset.asset_tag)}</dd></div>
              <div><dt>{copy('Category', 'ምድብ')}</dt><dd>{display(asset.category || asset.category_name)}</dd></div>
              <div><dt>{copy('Serial number', 'የመለያ ቁጥር')}</dt><dd>{display(asset.serialNumber || asset.serial_number)}</dd></div>
              <div><dt>{copy('QR code', 'QR ኮድ')}</dt><dd>{display(asset.qrCode || asset.digitalId || asset.digital_id)}</dd></div>
              <div><dt>{copy('RFID tag', 'RFID መለያ')}</dt><dd>{display(asset.rfidTag || asset.rfid_tag)}</dd></div>
              <div><dt>{copy('Status', 'ሁኔታ')}</dt><dd>{display(asset.status)}</dd></div>
            </dl>
          </section>

          <section className="department-tracking__card">
            <div className="department-tracking__section-title"><MapPin size={18} aria-hidden="true" /><h2>{copy('Current location and custody', 'የአሁኑ ቦታ እና ኃላፊነት')}</h2></div>
            <dl className="department-tracking__facts">
              <div><dt>{copy('Location', 'ቦታ')}</dt><dd>{display(locationText || location?.room || asset.location)}</dd></div>
              <div><dt>{copy('Department', 'ክፍል')}</dt><dd>{display(asset.department_name || asset.department)}</dd></div>
              <div><dt>{copy('Assigned user', 'የተመደበ ተጠቃሚ')}</dt><dd><UserRound size={14} aria-hidden="true" /> {display(asset.assigned_to_name || currentAssignment?.userName)}</dd></div>
              <div><dt>{copy('Condition', 'ሁኔታ')}</dt><dd>{display(asset.condition || asset.condition_status || currentAssignment?.condition)}</dd></div>
              <div><dt>{copy('Warranty expiry', 'ዋስትና የሚያበቃበት ቀን')}</dt><dd>{display(asset.warrantyExpiry || asset.warranty_expiry)}</dd></div>
            </dl>
            <Link className="department-tracking__inline-link" to="/department-head/verification"><ClipboardCheck size={15} aria-hidden="true" />{copy('Verify physical location and condition', 'ቦታን እና ሁኔታን በአካል ያረጋግጡ')}</Link>
          </section>

          <section className="department-tracking__card">
            <div className="department-tracking__section-title"><Wrench size={18} aria-hidden="true" /><h2>{copy('Maintenance', 'ጥገና')}</h2></div>
            {maintenance.length ? <ul className="department-tracking__list">{maintenance.map((record, index) => (
              <li key={record.id || `${record.title}-${index}`}>
                <strong>{display(record.title || record.description)}</strong>
                <span>{display(record.status)} · {display(record.requestedAt || record.createdAt)}</span>
                {record.technicianName && <small>{copy('Technician', 'ቴክኒሻን')}: {record.technicianName}</small>}
              </li>
            ))}</ul> : <p className="department-tracking__muted">{copy('No maintenance records.', 'የጥገና መዝገብ የለም።')}</p>}
          </section>

          <section className="department-tracking__card">
            <div className="department-tracking__section-title"><FileText size={18} aria-hidden="true" /><h2>{copy('Documents', 'ሰነዶች')}</h2></div>
            {documents.length ? <ul className="department-tracking__list">{documents.map((document) => (
              <li key={document.id}>
                <span><strong>{display(document.originalName || document.original_name || document.documentType)}</strong><small>{display(document.documentType || document.document_type)}</small></span>
                <button type="button" onClick={() => void downloadDocument(document)} disabled={downloadingId === document.id}>
                  {downloadingId === document.id ? copy('Downloading…', 'በማውረድ ላይ…') : copy('Download', 'አውርድ')}
                </button>
              </li>
            ))}</ul> : <p className="department-tracking__muted">{copy('No documents are attached to this asset.', 'ከዚህ ንብረት ጋር ምንም ሰነድ አልተያያዘም።')}</p>}
          </section>

          <section className="department-tracking__card department-tracking__card--wide">
            <div className="department-tracking__section-title"><RefreshCw size={18} aria-hidden="true" /><h2>{copy('Transfer and movement history', 'የዝውውር እና እንቅስቃሴ ታሪክ')}</h2></div>
            {transfers.length ? <ul className="department-tracking__list">{transfers.map((transfer, index) => (
              <li key={`${transfer.transferredAt}-${index}`}>
                <strong>{display(transfer.fromLocation)} → {display(transfer.toLocation)}</strong>
                <span>{display(transfer.fromDepartment)} → {display(transfer.toDepartment)} · {display(transfer.transferredAt)}</span>
                {transfer.reason && <small>{transfer.reason}</small>}
              </li>
            ))}</ul> : <p className="department-tracking__muted">{copy('No transfer records.', 'የዝውውር መዝገብ የለም።')}</p>}
            {movementHistory.length > 0 && (
              <>
                <h3>{copy('RFID movement events', 'የRFID እንቅስቃሴ ክስተቶች')}</h3>
                <ul className="department-tracking__list">{movementHistory.map((record, index) => (
                  <li key={`${record.type}-${record.date}-${index}`}>
                    <strong>{display(record.action || 'RFID scan')}</strong>
                    <span>{display(record.description || record.newValue)} · {display(record.date)}</span>
                  </li>
                ))}</ul>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
