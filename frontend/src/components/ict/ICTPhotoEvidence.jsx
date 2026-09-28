import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Upload, Trash2, Eye, X, Image as ImageIcon, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import './ICTPhotoEvidence.css';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function ICTPhotoEvidence() {
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadForm, setUploadForm] = useState({ documentType: 'damage_evidence', description: '', file: null });

  const loadAssets = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/ict/assets', { params: { limit: 100 } });
      setAssets(response.data?.assets || []);
    } catch (error) {
      toast.error('Unable to load assets.');
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!selectedAsset) { setDocuments([]); return; }
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/ict/assets/${selectedAsset}/documents`);
      setDocuments((response.data?.data || []).filter((doc) => doc.mimeType?.startsWith('image/') || doc.documentType === 'damage_evidence' || doc.documentType === 'condition_evidence'));
    } catch (error) {
      toast.error('Unable to load evidence photos.');
    } finally {
      setLoading(false);
    }
  }, [selectedAsset]);

  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPG, PNG, WEBP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 10 MB limit.');
      return;
    }
    setUploadForm((prev) => ({ ...prev, file }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedAsset) { toast.error('Select an asset first.'); return; }
    if (!uploadForm.file) { toast.error('Select a photo to upload.'); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = String(reader.result).split(',')[1];
        try {
          await apiClient.post(`/api/ict/assets/${selectedAsset}/documents`, {
            fileName: uploadForm.file.name,
            mimeType: uploadForm.file.type,
            data: base64,
            documentType: uploadForm.documentType,
            description: uploadForm.description,
          });
          toast.success('Evidence photo uploaded successfully.');
          setShowUpload(false);
          setUploadForm({ documentType: 'damage_evidence', description: '', file: null });
          loadDocuments();
        } catch (uploadError) {
          toast.error(uploadError.response?.data?.message || 'Upload failed.');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(uploadForm.file);
    } catch (error) {
      toast.error('Failed to read file.');
      setUploading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Delete this evidence photo?')) return;
    try {
      await apiClient.delete(`/api/ict/assets/${selectedAsset}/documents/${documentId}`);
      toast.success('Evidence photo deleted.');
      loadDocuments();
    } catch (error) {
      toast.error('Failed to delete photo.');
    }
  };

  const handlePreview = (doc) => {
    setPreview(doc);
  };

  const selectedAssetData = assets.find((a) => String(a.id) === String(selectedAsset));

  return (
    <main className="ict-evidence-page">
      <div className="ict-evidence-shell">
        <header className="evidence-header">
          <div className="evidence-title">
            <div className="evidence-mark"><Camera size={24} /></div>
            <div>
              <p className="evidence-eyebrow">ICT OPERATIONS</p>
              <h1>Damage & Condition Evidence</h1>
              <p>Upload and manage photo evidence for ICT asset damage, condition, and maintenance.</p>
            </div>
          </div>
          <div className="evidence-actions">
            <button className="evidence-button secondary" onClick={() => { loadAssets(); loadDocuments(); }}><RefreshCw size={16} /> Refresh</button>
            <button className="evidence-button primary" onClick={() => setShowUpload(true)} disabled={!selectedAsset}><Upload size={16} /> Upload Evidence</button>
          </div>
        </header>

        <section className="evidence-asset-select">
          <label>Select Asset</label>
          <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
            <option value="">-- Choose an ICT asset --</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.serialNumber || `ID: ${asset.id}`})</option>
            ))}
          </select>
          {selectedAssetData && (
            <div className="evidence-asset-info">
              <span><strong>Category:</strong> {selectedAssetData.category || '—'}</span>
              <span><strong>Status:</strong> {selectedAssetData.status || '—'}</span>
              <span><strong>Condition:</strong> {selectedAssetData.condition || '—'}</span>
              <span><strong>Location:</strong> {selectedAssetData.location || '—'}</span>
            </div>
          )}
        </section>

        <section className="evidence-grid-section">
          {!selectedAsset ? (
            <div className="evidence-empty"><Camera size={40} /><h2>No asset selected</h2><p>Select an ICT asset to view and manage its evidence photos.</p></div>
          ) : loading ? (
            <div className="evidence-loading">Loading evidence photos...</div>
          ) : documents.length === 0 ? (
            <div className="evidence-empty"><ImageIcon size={40} /><h2>No evidence photos found</h2><p>Upload damage or condition evidence photos for this asset.</p></div>
          ) : (
            <div className="evidence-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="evidence-card">
                  <div className="evidence-card-image">
                    <img src={`/api/ict/assets/${selectedAsset}/documents/${doc.id}/file`} alt={doc.originalName} loading="lazy" />
                    <div className="evidence-card-overlay">
                      <button className="icon-button" title="Preview" onClick={() => handlePreview(doc)}><Eye size={16} /></button>
                      <button className="icon-button danger" title="Delete" onClick={() => handleDelete(doc.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="evidence-card-body">
                    <h3>{doc.description || doc.originalName}</h3>
                    <div className="evidence-card-meta">
                      <span className="evidence-type">{doc.documentType}</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showUpload && (
        <div className="evidence-overlay">
          <form className="evidence-dialog" onSubmit={handleUpload}>
            <div className="dialog-head">
              <div><p className="evidence-eyebrow">UPLOAD EVIDENCE</p><h2>Upload Evidence Photo</h2></div>
              <button type="button" className="icon-button" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <label>Evidence Type
                <select value={uploadForm.documentType} onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}>
                  <option value="damage_evidence">Damage Evidence</option>
                  <option value="condition_evidence">Condition Evidence</option>
                  <option value="maintenance_evidence">Maintenance Evidence</option>
                  <option value="repair_evidence">Repair Evidence</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>Description
                <input value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Describe the damage or condition..." />
              </label>
              <label className="wide">Photo (JPG, PNG, WEBP — max 10 MB)
                <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
              </label>
              {uploadForm.file && (
                <div className="file-preview">
                  <ImageIcon size={16} /> {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                </div>
              )}
            </div>
            <div className="dialog-foot">
              <button type="button" className="evidence-button secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button type="submit" className="evidence-button primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Evidence'}</button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="evidence-overlay" onClick={() => setPreview(null)}>
          <div className="evidence-preview" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <div><p className="evidence-eyebrow">PREVIEW</p><h2>{preview.description || preview.originalName}</h2></div>
              <button type="button" className="icon-button" onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <img src={`/api/ict/assets/${selectedAsset}/documents/${preview.id}/file`} alt={preview.originalName} />
            <div className="evidence-preview-meta">
              <span>{preview.documentType}</span>
              <span>{formatFileSize(preview.fileSize)}</span>
              <span>{new Date(preview.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
