import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Upload, Trash2, Download, Search, RefreshCw, X, File, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import './ICTDocuments.css';

const DOCUMENT_TYPES = ['warranty', 'manual', 'purchase', 'maintenance', 'transfer', 'assignment', 'other'];
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

const getFileIcon = (mimeType) => {
  if (mimeType && mimeType.startsWith('image/')) return ImageIcon;
  return File;
};

export default function ICTDocuments() {
  const [documents, setDocuments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [uploadForm, setUploadForm] = useState({ documentType: 'warranty', description: '', file: null });

  const loadDocuments = useCallback(async () => {
    if (!selectedAsset) { setDocuments([]); return; }
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/ict/assets/${selectedAsset}/documents`);
      setDocuments(response.data?.data || []);
    } catch (error) {
      toast.error('Unable to load documents.');
    } finally {
      setLoading(false);
    }
  }, [selectedAsset]);

  const loadAssets = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/ict/assets', { params: { limit: 100 } });
      setAssets(response.data?.assets || []);
    } catch (error) {
      toast.error('Unable to load assets.');
    }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, JPG, PNG, WEBP.');
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
    if (!uploadForm.file) { toast.error('Select a file to upload.'); return; }
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
          toast.success('Document uploaded successfully.');
          setShowUpload(false);
          setUploadForm({ documentType: 'warranty', description: '', file: null });
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
    if (!window.confirm('Delete this document?')) return;
    try {
      await apiClient.delete(`/api/ict/assets/${selectedAsset}/documents/${documentId}`);
      toast.success('Document deleted.');
      loadDocuments();
    } catch (error) {
      toast.error('Failed to delete document.');
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await apiClient.get(`/api/assets/${selectedAsset}/documents/${doc.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Unable to download document.');
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = !search || doc.originalName?.toLowerCase().includes(search.toLowerCase()) || doc.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || doc.documentType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <main className="ict-documents-page">
      <div className="ict-documents-shell">
        <header className="documents-header">
          <div className="documents-title">
            <div className="documents-mark"><FileText size={24} /></div>
            <div>
              <p className="documents-eyebrow">ICT OPERATIONS</p>
              <h1>Document Management</h1>
              <p>Upload, view, and manage ICT asset documents and evidence.</p>
            </div>
          </div>
          <div className="documents-actions">
            <button className="ict-documents-button secondary" onClick={() => { loadAssets(); loadDocuments(); }}><RefreshCw size={16} /> Refresh</button>
            <button className="ict-documents-button primary" onClick={() => setShowUpload(true)} disabled={!selectedAsset}><Upload size={16} /> Upload Document</button>
          </div>
        </header>

        <section className="documents-toolbar">
          <div className="documents-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="documents-filter">
            <option value="">All types</option>
            {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
          </select>
        </section>

        <section className="documents-asset-select">
          <label>Select Asset</label>
          <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
            <option value="">-- Choose an ICT asset --</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.serialNumber || `ID: ${asset.id}`})</option>
            ))}
          </select>
        </section>

        <section className="documents-list">
          {!selectedAsset ? (
            <div className="documents-empty"><FileText size={40} /><h2>No asset selected</h2><p>Select an ICT asset to view and manage its documents.</p></div>
          ) : loading ? (
            <div className="documents-loading">Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="documents-empty"><FileText size={40} /><h2>No documents found</h2><p>Upload documents for this asset using the Upload button above.</p></div>
          ) : (
            <div className="documents-grid">
              {filteredDocuments.map((doc) => {
                const FileIcon = getFileIcon(doc.mimeType);
                return (
                  <div key={doc.id} className="document-card">
                    <div className="document-card-icon"><FileIcon size={28} /></div>
                    <div className="document-card-body">
                      <h3>{doc.originalName}</h3>
                      <p>{doc.description || 'No description'}</p>
                      <div className="document-card-meta">
                        <span className="document-type">{doc.documentType}</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="document-card-actions">
                      <button className="icon-button" title="Download" onClick={() => handleDownload(doc)}><Download size={16} /></button>
                      <button className="icon-button danger" title="Delete" onClick={() => handleDelete(doc.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showUpload && (
        <div className="documents-overlay">
          <form className="documents-dialog" onSubmit={handleUpload}>
            <div className="dialog-head">
              <div><p className="documents-eyebrow">UPLOAD</p><h2>Upload Document</h2></div>
              <button type="button" className="icon-button" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <label>Document Type
                <select value={uploadForm.documentType} onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}>
                  {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                </select>
              </label>
              <label>Description
                <input value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Optional description" />
              </label>
              <label className="wide">File (PDF, JPG, PNG, WEBP — max 10 MB)
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
              </label>
              {uploadForm.file && <div className="file-preview"><FileText size={16} /> {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})</div>}
            </div>
            <div className="dialog-foot">
              <button type="button" className="ict-documents-button secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button type="submit" className="ict-documents-button primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}