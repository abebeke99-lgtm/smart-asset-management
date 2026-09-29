import React, { useEffect, useMemo, useState } from "react";

const ASSETS_API = "/api/assets";
const RFID_API = "/api/rfid";
const QR_API = "/api/qr";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType =
    response.headers.get("content-type") || "";

  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function extractArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function normalizeAsset(asset, index) {
  return {
    id:
      asset?.id ??
      asset?.assetId ??
      asset?._id ??
      `asset-${index}`,

    assetId:
      asset?.assetId ??
      asset?.id ??
      "",

    name:
      asset?.name ??
      asset?.assetName ??
      "",

    serialNumber:
      asset?.serialNumber ??
      asset?.serial_number ??
      "",

    category:
      asset?.categoryName ??
      asset?.category?.name ??
      asset?.category ??
      "",

    department:
      asset?.departmentName ??
      asset?.department?.name ??
      asset?.department ??
      "",

    location:
      asset?.locationName ??
      asset?.location?.name ??
      asset?.location ??
      "",

    status:
      asset?.status ??
      "Available",

    condition:
      asset?.condition ??
      asset?.assetCondition ??
      "",

    rfidTag:
      asset?.rfidTag ??
      asset?.rfid_tag ??
      asset?.rfid?.tagId ??
      asset?.rfid?.uid ??
      "",

    qrCode:
      asset?.qrCode ??
      asset?.qr_code ??
      asset?.qr?.code ??
      "",

    raw: asset,
  };
}

function formatStatus(value) {
  if (!value) return "Not Assigned";

  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function RfidQrTracking() {
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [trackingFilter, setTrackingFilter] =
    useState("All");

  const [selectedAsset, setSelectedAsset] =
    useState(null);

  const [showRfidModal, setShowRfidModal] =
    useState(false);

  const [showQrModal, setShowQrModal] =
    useState(false);

  const [rfidValue, setRfidValue] = useState("");
  const [qrValue, setQrValue] = useState("");

  const loadAssets = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(ASSETS_API);

      const list = extractArray(response, [
        "assets",
      ]).map(normalizeAsset);

      setAssets(list);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load assets."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const statistics = useMemo(() => {
    const total = assets.length;

    const rfidAssigned = assets.filter(
      (asset) => Boolean(asset.rfidTag)
    ).length;

    const qrAssigned = assets.filter(
      (asset) => Boolean(asset.qrCode)
    ).length;

    const fullyTracked = assets.filter(
      (asset) =>
        Boolean(asset.rfidTag) &&
        Boolean(asset.qrCode)
    ).length;

    return {
      total,
      rfidAssigned,
      qrAssigned,
      fullyTracked,
      untracked: Math.max(
        0,
        total - fullyTracked
      ),
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !query ||
        asset.assetId
          .toLowerCase()
          .includes(query) ||
        asset.name
          .toLowerCase()
          .includes(query) ||
        asset.serialNumber
          .toLowerCase()
          .includes(query) ||
        asset.rfidTag
          .toLowerCase()
          .includes(query) ||
        asset.qrCode
          .toLowerCase()
          .includes(query) ||
        asset.department
          .toLowerCase()
          .includes(query) ||
        asset.location
          .toLowerCase()
          .includes(query);

      let matchesFilter = true;

      if (trackingFilter === "RFID Assigned") {
        matchesFilter = Boolean(asset.rfidTag);
      }

      if (trackingFilter === "QR Assigned") {
        matchesFilter = Boolean(asset.qrCode);
      }

      if (trackingFilter === "Fully Tracked") {
        matchesFilter =
          Boolean(asset.rfidTag) &&
          Boolean(asset.qrCode);
      }

      if (trackingFilter === "Not Fully Tracked") {
        matchesFilter =
          !asset.rfidTag ||
          !asset.qrCode;
      }

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [
    assets,
    search,
    trackingFilter,
  ]);

  const openRfidModal = (asset) => {
    setSelectedAsset(asset);
    setRfidValue(asset.rfidTag || "");
    setError("");
    setShowRfidModal(true);
  };

  const openQrModal = (asset) => {
    setSelectedAsset(asset);
    setQrValue(asset.qrCode || "");
    setError("");
    setShowQrModal(true);
  };

  const closeModals = () => {
    if (processing) return;

    setShowRfidModal(false);
    setShowQrModal(false);
    setSelectedAsset(null);
    setRfidValue("");
    setQrValue("");
  };

  const assignRfid = async (event) => {
    event.preventDefault();

    if (!selectedAsset) return;

    if (!rfidValue.trim()) {
      setError(
        "Please enter an RFID tag value."
      );
      return;
    }

    setProcessing(true);
    setError("");

    try {
      await apiRequest(
        `${RFID_API}/${encodeURIComponent(
          selectedAsset.assetId
        )}`,
        {
          method: "PUT",
          body: JSON.stringify({
            assetId: selectedAsset.assetId,
            rfidTag: rfidValue.trim(),
          }),
        }
      );

      closeModals();
      await loadAssets();
    } catch (err) {
      setError(
        err.message ||
          "Unable to assign the RFID tag."
      );
    } finally {
      setProcessing(false);
    }
  };

  const removeRfid = async (asset) => {
    if (!asset.rfidTag) return;

    const confirmed = window.confirm(
      `Remove RFID tag ${asset.rfidTag} from ${asset.assetId}?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");

    try {
      await apiRequest(
        `${RFID_API}/${encodeURIComponent(
          asset.assetId
        )}`,
        {
          method: "DELETE",
        }
      );

      await loadAssets();
    } catch (err) {
      setError(
        err.message ||
          "Unable to remove the RFID tag."
      );
    } finally {
      setProcessing(false);
    }
  };

  const generateQr = async () => {
    if (!selectedAsset) return;

    setProcessing(true);
    setError("");

    try {
      const response = await apiRequest(
        QR_API,
        {
          method: "POST",
          body: JSON.stringify({
            assetId: selectedAsset.assetId,
          }),
        }
      );

      const generated =
        response?.qrCode ??
        response?.code ??
        response?.data?.qrCode ??
        "";

      if (generated) {
        setQrValue(generated);
      }

      await loadAssets();

      setError("");
    } catch (err) {
      setError(
        err.message ||
          "Unable to generate the QR code."
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadQr = () => {
    if (!qrValue) return;

    const encoded = encodeURIComponent(
      qrValue
    );

    const url =
      `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;

    const link =
      document.createElement("a");

    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  return (
    <div className="tracking-page">
      <style>{`
        .tracking-page {
          min-height: 100%;
          padding: 24px;
          background: #f3f6f9;
          color: #111827;
          box-sizing: border-box;
        }

        .tracking-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 17px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
        }

        .summary-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .summary-value {
          font-size: 25px;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 15px;
          margin-bottom: 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .search-input,
        .filter-select {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #fff;
          color: #111827;
          font-size: 14px;
          outline: none;
        }

        .search-input {
          flex: 1;
          min-width: 250px;
        }

        .search-input:focus,
        .filter-select:focus,
        .modal-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .1);
        }

        .refresh-button {
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #fff;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
        }

        .table-card {
          overflow: hidden;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .asset-table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        .asset-table th {
          padding: 13px 15px;
          background: #f8fafc;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          font-size: 12px;
          white-space: nowrap;
        }

        .asset-table td {
          padding: 13px 15px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        .asset-table tr:last-child td {
          border-bottom: 0;
        }

        .asset-id {
          color: #1d4ed8;
          font-weight: 700;
        }

        .asset-name {
          margin-top: 3px;
          font-weight: 600;
        }

        .secondary {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .tracking-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .assigned {
          color: #166534;
          background: #dcfce7;
        }

        .not-assigned {
          color: #92400e;
          background: #fef3c7;
        }

        .tag-value {
          font-family: monospace;
          color: #334155;
          font-size: 12px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .action-button {
          padding: 6px 9px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .action-button.primary {
          color: #1d4ed8;
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .action-button.danger {
          color: #b91c1c;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .error-box {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 14px;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .55);
        }

        .modal {
          width: min(570px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, .25);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 18px;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .asset-summary {
          margin-bottom: 18px;
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
        }

        .asset-summary-id {
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 700;
        }

        .asset-summary-name {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 700;
        }

        .modal-label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .modal-input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          outline: none;
          font-size: 14px;
        }

        .modal-help {
          margin-top: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .qr-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 230px;
          margin-top: 15px;
          padding: 15px;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
        }

        .qr-image {
          width: 210px;
          height: 210px;
          object-fit: contain;
          border: 8px solid #fff;
          box-shadow: 0 2px 10px rgba(15, 23, 42, .1);
        }

        .qr-placeholder {
          color: #64748b;
          text-align: center;
          font-size: 13px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .secondary-button,
        .primary-button {
          padding: 10px 15px;
          border-radius: 7px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
        }

        .primary-button {
          border: 0;
          background: #2563eb;
          color: #fff;
        }

        .primary-button:hover {
          background: #1d4ed8;
        }

        .tracking-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 18px;
        }

        .info-card {
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .info-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .info-value {
          margin-top: 5px;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
          word-break: break-word;
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            min-width: 0;
          }
        }

        @media (max-width: 520px) {
          .tracking-page {
            padding: 16px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .tracking-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="tracking-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              RFID & QR Tracking
            </h1>

            <p className="page-subtitle">
              Monitor RFID and QR identification
              assignments across university assets.
            </p>
          </div>
        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Total Assets
            </div>
            <div className="summary-value">
              {statistics.total}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              RFID Assigned
            </div>
            <div className="summary-value">
              {statistics.rfidAssigned}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              QR Assigned
            </div>
            <div className="summary-value">
              {statistics.qrAssigned}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Fully Tracked
            </div>
            <div className="summary-value">
              {statistics.fullyTracked}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Not Fully Tracked
            </div>
            <div className="summary-value">
              {statistics.untracked}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search asset ID, name, serial, RFID, QR, department..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="filter-select"
            value={trackingFilter}
            onChange={(event) =>
              setTrackingFilter(event.target.value)
            }
          >
            <option value="All">
              All Tracking
            </option>

            <option value="RFID Assigned">
              RFID Assigned
            </option>

            <option value="QR Assigned">
              QR Assigned
            </option>

            <option value="Fully Tracked">
              Fully Tracked
            </option>

            <option value="Not Fully Tracked">
              Not Fully Tracked
            </option>
          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadAssets}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading asset tracking information...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="empty-state">
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                🏷️
              </div>

              <strong>
                No matching assets
              </strong>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                Try changing your search or tracking
                filter.
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="asset-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Category</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>RFID</th>
                    <th>QR Code</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <div className="asset-id">
                          {asset.assetId || "—"}
                        </div>

                        <div className="asset-name">
                          {asset.name ||
                            "Unnamed Asset"}
                        </div>

                        {asset.serialNumber && (
                          <div className="secondary">
                            SN:{" "}
                            {asset.serialNumber}
                          </div>
                        )}
                      </td>

                      <td>
                        {asset.category || "—"}
                      </td>

                      <td>
                        {asset.department || "—"}
                      </td>

                      <td>
                        {asset.location || "—"}
                      </td>

                      <td>
                        {asset.rfidTag ? (
                          <>
                            <span className="tracking-badge assigned">
                              Assigned
                            </span>

                            <div className="tag-value">
                              {asset.rfidTag}
                            </div>
                          </>
                        ) : (
                          <span className="tracking-badge not-assigned">
                            Not Assigned
                          </span>
                        )}
                      </td>

                      <td>
                        {asset.qrCode ? (
                          <>
                            <span className="tracking-badge assigned">
                              Assigned
                            </span>

                            <div className="tag-value">
                              {asset.qrCode}
                            </div>
                          </>
                        ) : (
                          <span className="tracking-badge not-assigned">
                            Not Assigned
                          </span>
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          asset.status
                        )}
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="action-button primary"
                            onClick={() =>
                              openRfidModal(asset)
                            }
                          >
                            {asset.rfidTag
                              ? "Edit RFID"
                              : "Assign RFID"}
                          </button>

                          {asset.rfidTag && (
                            <button
                              type="button"
                              className="action-button danger"
                              onClick={() =>
                                removeRfid(asset)
                              }
                              disabled={processing}
                            >
                              Remove
                            </button>
                          )}

                          <button
                            type="button"
                            className="action-button"
                            onClick={() =>
                              openQrModal(asset)
                            }
                          >
                            {asset.qrCode
                              ? "View QR"
                              : "Generate QR"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            color: "#64748b",
            fontSize: 13,
          }}
        >
          Showing {filteredAssets.length} of{" "}
          {assets.length} assets
        </div>
      </div>

      {showRfidModal && selectedAsset && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModals();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Assign RFID Tag
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeModals}
                disabled={processing}
              >
                ×
              </button>
            </div>

            <form onSubmit={assignRfid}>
              <div className="modal-body">
                <div className="asset-summary">
                  <div className="asset-summary-id">
                    {selectedAsset.assetId}
                  </div>

                  <div className="asset-summary-name">
                    {selectedAsset.name ||
                      "Unnamed Asset"}
                  </div>

                  {selectedAsset.serialNumber && (
                    <div className="secondary">
                      Serial:{" "}
                      {selectedAsset.serialNumber}
                    </div>
                  )}
                </div>

                <label className="modal-label">
                  RFID Tag / UID
                </label>

                <input
                  type="text"
                  className="modal-input"
                  value={rfidValue}
                  onChange={(event) =>
                    setRfidValue(
                      event.target.value
                    )
                  }
                  placeholder="Enter RFID tag or UID"
                  autoFocus
                  required
                />

                <div className="modal-help">
                  Enter the unique RFID identifier
                  attached to this university asset.
                </div>

                <div className="tracking-info">
                  <div className="info-card">
                    <div className="info-label">
                      Current RFID
                    </div>

                    <div className="info-value">
                      {selectedAsset.rfidTag ||
                        "Not assigned"}
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-label">
                      Current QR
                    </div>

                    <div className="info-value">
                      {selectedAsset.qrCode ||
                        "Not assigned"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModals}
                  disabled={processing}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={processing}
                >
                  {processing
                    ? "Saving..."
                    : "Save RFID"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQrModal && selectedAsset && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModals();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Asset QR Code
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeModals}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="asset-summary">
                <div className="asset-summary-id">
                  {selectedAsset.assetId}
                </div>

                <div className="asset-summary-name">
                  {selectedAsset.name ||
                    "Unnamed Asset"}
                </div>
              </div>

              <label className="modal-label">
                QR Value
              </label>

              <input
                type="text"
                className="modal-input"
                value={qrValue}
                onChange={(event) =>
                  setQrValue(event.target.value)
                }
                placeholder="QR code value"
              />

              {qrValue ? (
                <div className="qr-box">
                  <img
                    className="qr-image"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                      qrValue
                    )}`}
                    alt={`QR code for ${selectedAsset.assetId}`}
                  />

                  <div
                    className="tag-value"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    {qrValue}
                  </div>
                </div>
              ) : (
                <div className="qr-box">
                  <div className="qr-placeholder">
                    This asset does not have a QR
                    code yet.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeModals}
              >
                Close
              </button>

              {!qrValue && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={generateQr}
                  disabled={processing}
                >
                  {processing
                    ? "Generating..."
                    : "Generate QR"}
                </button>
              )}

              {qrValue && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={downloadQr}
                >
                  Open QR
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}