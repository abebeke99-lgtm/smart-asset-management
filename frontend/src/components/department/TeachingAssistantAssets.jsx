import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "../admin/ui/PageHeader";
import "./TeachingAssistantAssets.css";

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

export default function TeachingAssistantAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/api/assets", { params: { page: 1, limit: 25 } });
      const data = response?.data?.data;
      if (!Array.isArray(data)) throw new Error("The asset list response is invalid.");
      setAssets(data);
    } catch (loadError) {
      console.error("Teaching Assistant asset list request failed:", {
        status: loadError.response?.status || 0,
        message: loadError.message,
      });
      setAssets([]);
      setError(getApiErrorMessage(loadError, "Unable to load department assets."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <main className="teaching-assistant-assets">
      <div className="teaching-assistant-assets-heading">
        <PageHeader
          eyebrow="Teaching Assistant"
          title="Department assets"
          subtitle="Read-only asset information for your assigned department."
        />
        <button
          className="admin-roles-button admin-roles-button-secondary"
          type="button"
          onClick={loadAssets}
          disabled={loading}
          aria-label="Refresh department assets"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && <div className="admin-roles-alert admin-roles-alert-error" role="alert">{error}</div>}
      {loading ? (
        <div className="admin-roles-state" role="status">Loading department assets...</div>
      ) : assets.length === 0 ? (
        <div className="admin-roles-state">No assets are assigned to your department.</div>
      ) : (
        <div className="teaching-assistant-assets-table-scroll">
          <table className="admin-roles-matrix teaching-assistant-assets-table">
            <thead>
              <tr>
                <th scope="col">Asset ID</th>
                <th scope="col">Name</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{displayValue(asset.assetCode || asset.assetId || asset.id)}</td>
                  <td>{displayValue(asset.name)}</td>
                  <td>{displayValue(asset.DepartmentRecord?.name || asset.department)}</td>
                  <td>{displayValue(asset.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
