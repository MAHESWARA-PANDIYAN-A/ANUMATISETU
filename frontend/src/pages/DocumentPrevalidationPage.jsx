import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Building2,
  FileCheck,
  Info,
  Calendar,
  Tag,
  MapPin,
  Sparkles,
  Layers,
  Check,
  Eye,
  AlertCircle,
  Trash2,
  Download,
  Search,
  Filter,
  History,
  Archive,
  FolderOpen,
  Plus,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  X,
  FileSpreadsheet,
  CheckSquare
} from 'lucide-react';
import {
  fetchMyDocuments,
  fetchDocumentDetails,
  uploadDocument,
  replaceDocument,
  archiveDocument,
  deleteDocument,
  revalidateDocument,
  fetchDocumentTypes,
  fetchDocumentCompleteness,
  fetchDocumentViewUrl,
  fetchDocumentDownloadUrl,
  getDownloadUrl,
} from '../api/documents';
import { fetchMyProfile } from '../api/businessProfile';
import { useTaskerAssistant } from '../context/AssistantContext';
import { useLanguage } from '../context/LanguageContext';

const CATEGORY_TABS = [
  { id: 'ALL', key: 'doc_cat_all', fallback: 'All Documents' },
  { id: 'IDENTITY', key: 'doc_cat_identity', fallback: 'Identity' },
  { id: 'ADDRESS', key: 'doc_cat_address', fallback: 'Address' },
  { id: 'TAX', key: 'doc_cat_tax', fallback: 'Tax & PAN' },
  { id: 'BANK', key: 'doc_cat_bank', fallback: 'Bank' },
  { id: 'PHOTO', key: 'doc_cat_photo', fallback: 'Photo' },
  { id: 'PRODUCT', key: 'doc_cat_product', fallback: 'Product & Tech' },
  { id: 'CERTIFICATE', key: 'doc_cat_cert', fallback: 'Certificates' },
  { id: 'BRAND', key: 'doc_cat_brand', fallback: 'Brand & IP' },
  { id: 'SUPPORTING', key: 'doc_cat_support', fallback: 'Supporting' },
];

const APPROVAL_FILTERS = [
  { id: 'ALL', labelKey: 'doc_filter_portal_all', fallback: 'All Portals' },
  { id: 'fssai', fallback: 'FSSAI' },
  { id: 'gst', fallback: 'GST' },
  { id: 'udyam', fallback: 'Udyam' },
  { id: 'trademark', fallback: 'Trademark' },
];

const DocumentCenterPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: paramDocId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { explainDocument, openAssistant } = useTaskerAssistant();

  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedApproval, setSelectedApproval] = useState('ALL');

  // Modals State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [missingModalOpen, setMissingModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [activeDetailDoc, setActiveDetailDoc] = useState(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('PAN_CARD');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadApprovalId, setUploadApprovalId] = useState('general-compliance');
  const [uploadIssueDate, setUploadIssueDate] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Replace Form State
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceNotes, setReplaceNotes] = useState('');
  const [replacing, setReplacing] = useState(false);

  // Completeness / Missing Requirements State
  const [completenessData, setCompletenessData] = useState(null);
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (paramDocId && documents.length > 0) {
      const found = documents.find((d) => String(d.id) === String(paramDocId));
      if (found) setActiveDetailDoc(found);
    }
  }, [paramDocId, documents]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [prof, docsRes, typesRes] = await Promise.all([
        fetchMyProfile().catch(() => null),
        fetchMyDocuments().catch(() => ({ items: [] })),
        fetchDocumentTypes().catch(() => []),
      ]);
      setProfile(prof);
      const items = Array.isArray(docsRes) ? docsRes : (docsRes?.items || []);
      setDocuments(items);
      setDocumentTypes(typesRes || []);

      if (items.length > 0 && !activeDetailDoc && !paramDocId) {
        setActiveDetailDoc(items[0]);
      }
    } catch (err) {
      console.error('Error loading Document Center data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMissingModal = async () => {
    setMissingModalOpen(true);
    setLoadingCompleteness(true);
    try {
      const comp = await fetchDocumentCompleteness('fssai,gst,udyam');
      setCompletenessData(comp);
    } catch (err) {
      console.error('Failed to calculate completeness:', err);
    } finally {
      setLoadingCompleteness(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const validExts = ['pdf', 'png', 'jpg', 'jpeg'];
      const ext = f.name.split('.').pop().toLowerCase();
      if (!validExts.includes(ext)) {
        setUploadError('Unsupported format. Please upload a PDF, PNG, or JPG document.');
        setUploadFile(null);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setUploadError('File exceeds maximum size of 5 MB.');
        setUploadFile(null);
        return;
      }
      setUploadFile(f);
      setUploadError('');
      setDuplicateWarning(null);
    }
  };

  const handleUploadSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadDocument(uploadFile, uploadDocType, uploadApprovalId, {
        document_name: uploadDocName || uploadDocType,
        issue_date: uploadIssueDate,
        expiry_date: uploadExpiryDate,
        force_upload: force,
      });

      if (result.duplicate_detected && !force) {
        setDuplicateWarning(result);
        setUploading(false);
        return;
      }

      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadDocName('');
      setDuplicateWarning(null);

      // Reload document list and inspect uploaded doc
      const updatedDocsRes = await fetchMyDocuments();
      const updatedItems = Array.isArray(updatedDocsRes) ? updatedDocsRes : (updatedDocsRes?.items || []);
      setDocuments(updatedItems);
      const newDoc = updatedItems.find((d) => d.id === result.id) || result;
      setActiveDetailDoc(newDoc);
    } catch (err) {
      setUploadError(
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        'Document upload failed. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!replaceFile || !activeDetailDoc) return;
    setReplacing(true);
    try {
      await replaceDocument(activeDetailDoc.id, replaceFile, replaceNotes);
      setReplaceModalOpen(false);
      setReplaceFile(null);
      setReplaceNotes('');
      
      const updatedDocsRes = await fetchMyDocuments();
      const updatedItems = Array.isArray(updatedDocsRes) ? updatedDocsRes : (updatedDocsRes?.items || []);
      setDocuments(updatedItems);
      const refreshedDoc = await fetchDocumentDetails(activeDetailDoc.id);
      setActiveDetailDoc(refreshedDoc);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to replace document.');
    } finally {
      setReplacing(false);
    }
  };

  const handleArchive = async (docId) => {
    if (!window.confirm('Archive this document? It will not be attached to new applications.')) return;
    setActionLoadingId(docId);
    try {
      await archiveDocument(docId);
      const updatedDocsRes = await fetchMyDocuments();
      const updatedItems = Array.isArray(updatedDocsRes) ? updatedDocsRes : (updatedDocsRes?.items || []);
      setDocuments(updatedItems);
      if (activeDetailDoc?.id === docId) {
        const refreshed = await fetchDocumentDetails(docId);
        setActiveDetailDoc(refreshed);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to archive document.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (docId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Permanently remove this document from your vault?')) return;
    setActionLoadingId(docId);
    try {
      await deleteDocument(docId);
      const remaining = documents.filter((d) => d.id !== docId);
      setDocuments(remaining);
      if (activeDetailDoc?.id === docId) {
        setActiveDetailDoc(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete document attached to an active application. Please Archive it instead.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewDocument = async (docId, e) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(docId);
      const res = await fetchDocumentViewUrl(docId);
      if (res?.view_url) {
        window.open(res.view_url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Unable to generate secure view URL.');
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to open secure document view.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadDocument = async (docId, e) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(docId);
      const res = await fetchDocumentDownloadUrl(docId);
      if (res?.download_url) {
        const link = document.createElement('a');
        link.href = res.download_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        if (res.file_name) link.download = res.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Unable to generate secure download URL.');
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initiate secure download.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Dynamic Statistics
  const totalCount = documents.length;
  const readyCount = documents.filter((d) => d.validation_status === 'VALID' || d.validation_status === 'READY').length;
  const issueCount = documents.filter((d) => d.validation_status === 'WARNING' || d.validation_status === 'INVALID' || d.validation_status === 'FAILED').length;
  const recentCount = documents.filter((d) => {
    if (!d.created_at) return false;
    const diffHours = (new Date() - new Date(d.created_at)) / (1000 * 60 * 60);
    return diffHours <= 48;
  }).length;

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (doc.document_name || '').toLowerCase().includes(q);
        const matchType = (doc.document_type || '').toLowerCase().includes(q);
        const matchFile = (doc.file_name || '').toLowerCase().includes(q);
        const matchNum = (doc.document_number_masked || '').toLowerCase().includes(q);
        if (!matchName && !matchType && !matchFile && !matchNum) return false;
      }

      // Status
      if (selectedStatus === 'READY' && !(doc.validation_status === 'VALID' || doc.validation_status === 'READY')) return false;
      if (selectedStatus === 'NEEDS_ATTENTION' && !(doc.validation_status === 'WARNING' || doc.validation_status === 'INVALID' || doc.validation_status === 'FAILED')) return false;
      if (selectedStatus === 'ARCHIVED' && doc.status !== 'ARCHIVED') return false;

      // Category
      if (selectedCategory !== 'ALL') {
        const t = (doc.document_type || '').toUpperCase();
        if (selectedCategory === 'TAX' && !t.includes('PAN') && !t.includes('TAX') && !t.includes('GST')) return false;
        if (selectedCategory === 'IDENTITY' && !t.includes('AADHAAR') && !t.includes('IDENTITY') && !t.includes('PAN')) return false;
        if (selectedCategory === 'ADDRESS' && !t.includes('ADDRESS') && !t.includes('ELECTRICITY') && !t.includes('RENT')) return false;
        if (selectedCategory === 'CERTIFICATE' && !t.includes('INCORPORATION') && !t.includes('CERTIFICATE') && !t.includes('TEST')) return false;
        if (selectedCategory === 'PHOTO' && !t.includes('PHOTO') && !t.includes('PASSPORT')) return false;
        if (selectedCategory === 'PRODUCT' && !t.includes('FOOD') && !t.includes('PRODUCT')) return false;
      }

      // Approval
      if (selectedApproval !== 'ALL') {
        const used = (doc.used_by || []).map((u) => u.toLowerCase());
        const hasApproval = used.some((u) => u.includes(selectedApproval));
        if (!hasApproval) return false;
      }

      return true;
    });
  }, [documents, searchQuery, selectedCategory, selectedStatus, selectedApproval]);

  const renderStatusBadge = (status, isArchived) => {
    if (isArchived) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#E8DCC8]/60 text-[#1F2A44] border border-[#D6C4A8]">
          <Archive className="w-3 h-3 text-[#1F2A44]" />
          {t("status_archived")}
        </span>
      );
    }
    switch (status) {
      case 'VALID':
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
            <CheckCircle2 className="w-3 h-3 text-[#C6A75E]" />
            {t("status_ready")}
          </span>
        );
      case 'WARNING':
      case 'INVALID':
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#1F2A44] border border-[#C6A75E]">
            <AlertTriangle className="w-3 h-3 text-[#C6A75E]" />
            {t("status_needs_attention")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#1F2A44]/80 border border-[#E8DCC8]">
            <Clock className="w-3 h-3 text-[#1F2A44]/60" />
            {t("status_processing")}
          </span>
        );
    }
  };

  const formatDate = (dStr) => {
    if (!dStr) return 'Recent';
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'PDF Document';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      
      {/* ─── 1. Header Banner ────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-[#E8DCC8] relative overflow-hidden bg-white shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#E8DCC8]/70 border border-[#D6C4A8] text-[#1F2A44] text-xs font-mono font-bold">
              <FileCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
              <span>{t("doc_vault_badge")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44] tracking-tight">
              {t("doc_vault_title")}
            </h1>
            <p className="text-xs sm:text-sm text-[#1F2A44]/80 leading-relaxed">
              {t("doc_vault_subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleOpenMissingModal}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#C6A75E]" />
              <span>{t("doc_btn_find_missing")}</span>
            </button>

            <button
              onClick={() => {
                setUploadFile(null);
                setUploadError('');
                setDuplicateWarning(null);
                setUploadModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#FAF6F0] bg-gradient-to-r from-[#1F2A44] via-[#2D3D60] to-[#C6A75E] hover:from-[#141C2E] hover:to-[#A88B42] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("doc_upload_btn")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Top Summary Metrics ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] bg-white space-y-1 shadow-xs">
          <span className="text-[11px] text-[#1F2A44]/70 font-medium">{t("doc_stat_total")}</span>
          <p className="text-2xl font-bold text-[#1F2A44] font-mono">{totalCount}</p>
          <span className="text-[10px] text-[#1F2A44]/50">{t("doc_stat_total_sub")}</span>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] bg-[#FAF6F0] space-y-1 shadow-xs">
          <span className="text-[11px] text-[#1F2A44] font-semibold">{t("doc_stat_ready")}</span>
          <p className="text-2xl font-bold text-[#1F2A44] font-mono">{readyCount}</p>
          <span className="text-[10px] text-[#C6A75E] font-medium">{t("doc_stat_ready_sub")}</span>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] bg-[#FAF6F0] space-y-1 shadow-xs">
          <span className="text-[11px] text-[#1F2A44] font-semibold">{t("doc_stat_attention")}</span>
          <p className="text-2xl font-bold text-[#1F2A44] font-mono">{issueCount}</p>
          <span className="text-[10px] text-[#C6A75E] font-medium">{t("doc_stat_attention_sub")}</span>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] bg-[#FAF6F0] space-y-1 shadow-xs">
          <span className="text-[11px] text-[#1F2A44] font-semibold">{t("doc_stat_recent")}</span>
          <p className="text-2xl font-bold text-[#1F2A44] font-mono">{recentCount}</p>
          <span className="text-[10px] text-[#C6A75E] font-medium">{t("doc_stat_recent_sub")}</span>
        </div>
      </div>

      {/* ─── 3. Search & Filtering Controls ─────────────────────────── */}
      <div className="glass-panel rounded-2xl p-4 border border-[#E8DCC8] bg-white space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#C6A75E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("doc_search_placeholder")}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs glass-input"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="glass-input px-3 py-1.5 rounded-xl text-xs shrink-0"
            >
              <option value="ALL">{t("doc_filter_status_all")}</option>
              <option value="READY">{t("doc_filter_status_ready")}</option>
              <option value="NEEDS_ATTENTION">{t("doc_filter_status_attention")}</option>
              <option value="ARCHIVED">{t("doc_filter_status_archived")}</option>
            </select>

            <select
              value={selectedApproval}
              onChange={(e) => setSelectedApproval(e.target.value)}
              className="glass-input px-3 py-1.5 rounded-xl text-xs shrink-0"
            >
              {APPROVAL_FILTERS.map((a) => (
                <option key={a.id} value={a.id}>{a.labelKey ? t(a.labelKey, {}, a.fallback) : a.fallback}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#E8DCC8] text-xs no-scrollbar">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold'
                  : 'text-[#1F2A44]/70 hover:text-[#1F2A44] hover:bg-[#FAF6F0]'
              }`}
            >
              {t(cat.key, {}, cat.fallback)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 4. Main Document Vault Content (Table + Detail View) ─────── */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Documents Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-2xl border border-[#E8DCC8] bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#E8DCC8] flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">
                {t("doc_vault_list_title", { count: filteredDocuments.length })}
              </h2>
              <span className="text-[11px] text-[#1F2A44]/60 font-mono">{t("doc_vault_list_sub")}</span>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FolderOpen className="w-10 h-10 text-[#C6A75E] mx-auto" />
                <h3 className="text-sm font-bold text-[#1F2A44]">{t("doc_empty_title")}</h3>
                <p className="text-xs text-[#1F2A44]/70 max-w-sm mx-auto">
                  {t("doc_empty_sub")}
                </p>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#FAF6F0] bg-[#1F2A44] hover:bg-[#141C2E] shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("doc_upload_first")}</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E8DCC8] text-[#1F2A44]/70 text-[10px] uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">{t("doc_col_doc")}</th>
                      <th className="py-3 px-3">{t("doc_col_status")}</th>
                      <th className="py-3 px-3">{t("doc_col_used_by")}</th>
                      <th className="py-3 px-3">{t("doc_col_ver")}</th>
                      <th className="py-3 px-4 text-right">{t("doc_col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DCC8]/60">
                    {filteredDocuments.map((doc) => {
                      const isSelected = activeDetailDoc?.id === doc.id;
                      const usedList = Array.isArray(doc.used_by) ? doc.used_by : [];
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setActiveDetailDoc(doc)}
                          className={`hover:bg-[#FAF6F0]/80 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#E8DCC8]/40 font-medium' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-[#1F2A44] truncate max-w-[200px]">
                                {doc.document_name || doc.document_type}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-[#1F2A44]/60 font-mono">
                                <span>{doc.file_name}</span>
                                <span>•</span>
                                <span>{formatDate(doc.created_at)}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {renderStatusBadge(doc.validation_status, doc.status === 'ARCHIVED')}
                              {(doc.validation_status === 'WARNING' || doc.validation_status === 'INVALID' || doc.validation_status === 'FAILED') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    explainDocument(doc.id, doc.document_name || doc.document_type);
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition-all flex items-center gap-1 cursor-pointer"
                                  title="Ask ANUMATISETU Assistant why this document has a notice"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-[#C6A75E]" />
                                  <span>{t("doc_explain_btn")}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {usedList.length > 0 ? (
                                usedList.slice(0, 3).map((u, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8]">
                                    {u.replace(/-/g, ' ').toUpperCase()}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-[#1F2A44]/50 italic">Not yet assigned</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#1F2A44]">
                            v{doc.current_version || 1}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => explainDocument(doc.id, doc.document_name || doc.document_type)}
                                className="p-1.5 rounded-lg text-[#1F2A44]/70 hover:text-[#1F2A44] hover:bg-[#E8DCC8] transition-colors cursor-pointer"
                                title="Explain with ANUMATISETU AI"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
                              </button>
                              <button
                                onClick={(e) => handleViewDocument(doc.id, e)}
                                className="p-1.5 rounded-lg text-[#1F2A44]/70 hover:text-[#1F2A44] hover:bg-[#E8DCC8] transition-colors cursor-pointer"
                                title="View Document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDownloadDocument(doc.id, e)}
                                className="p-1.5 rounded-lg text-[#1F2A44]/70 hover:text-[#1F2A44] hover:bg-[#E8DCC8] transition-colors cursor-pointer"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(doc.id, e)}
                                disabled={actionLoadingId === doc.id}
                                className="p-1.5 rounded-lg text-[#1F2A44]/70 hover:text-[#1F2A44] hover:bg-[#E8DCC8] transition-colors cursor-pointer"
                                title="Remove Document"
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${actionLoadingId === doc.id ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pre-validation & Document Detail Inspection */}
        <div className="lg:col-span-5">
          {activeDetailDoc ? (
            <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] bg-white space-y-6 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-[#E8DCC8] pb-4">
                <div>
                  <span className="text-[10px] font-mono text-[#C6A75E] uppercase tracking-wider block font-bold">{t("doc_detail_title")}</span>
                  <h3 className="text-lg font-bold text-[#1F2A44] tracking-tight">
                    {activeDetailDoc.document_name || activeDetailDoc.document_type}
                  </h3>
                  <p className="text-xs text-[#1F2A44]/70 font-mono mt-0.5">
                    File: {activeDetailDoc.file_name} · v{activeDetailDoc.current_version || 1}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRevalidate(activeDetailDoc.id)}
                    disabled={actionLoadingId === activeDetailDoc.id}
                    className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] transition-colors"
                    title="Re-run Pre-validation"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingId === activeDetailDoc.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      setReplaceFile(null);
                      setReplaceNotes('');
                      setReplaceModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] hover:bg-[#D6C4A8] transition-colors flex items-center gap-1"
                    title="Replace with new version"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t("btn_replace")}</span>
                  </button>
                </div>
              </div>

              {/* Status and Used By */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] space-y-1">
                  <span className="text-[10px] text-[#1F2A44]/60 font-mono uppercase block">{t("doc_state_validation")}</span>
                  <div>{renderStatusBadge(activeDetailDoc.validation_status, activeDetailDoc.status === 'ARCHIVED')}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] space-y-1">
                  <span className="text-[10px] text-[#1F2A44]/60 font-mono uppercase block">{t("doc_state_size")}</span>
                  <span className="font-mono font-semibold text-[#1F2A44]">{formatFileSize(activeDetailDoc.file_size)}</span>
                </div>
              </div>

              {/* Reusable Portals */}
              <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] text-xs flex items-center justify-between gap-2">
                <span className="text-[#1F2A44] font-semibold">{t("doc_mapped_approvals")}</span>
                <div className="flex flex-wrap gap-1">
                  {(activeDetailDoc.used_by || ['General Vault']).map((u, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8] font-semibold">
                      {String(u).replace(/-/g, ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Extracted Identifiers Card */}
              {(() => {
                const extData = activeDetailDoc.validation?.extracted_data || {};
                const extRegs = extData.registration_numbers || {};
                const panNum = extRegs.PAN || extData.pan_number;
                const cardholder = extData.cardholder_name || extData.company_name;

                if (!panNum && Object.keys(extRegs).length === 0 && !cardholder) return null;

                return (
                  <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1F2A44] uppercase font-mono text-[11px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
                        {t("doc_extracted_ids")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1F2A44] bg-[#E8DCC8] border border-[#C6A75E] px-2 py-0.5 rounded-full font-bold">
                        <Check className="w-3 h-3 text-[#C6A75E]" /> {t("doc_auto_synced")}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {panNum && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#E8DCC8] shadow-xs">
                          <span className="text-[10px] font-mono text-[#1F2A44]/60 uppercase block">{t("onboard_lbl_pan")}</span>
                          <span className="text-sm font-mono font-bold text-[#1F2A44]">{panNum}</span>
                        </div>
                      )}

                      {cardholder && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#E8DCC8] shadow-xs">
                          <span className="text-[10px] font-mono text-[#1F2A44]/60 uppercase block">Cardholder / Legal Entity</span>
                          <span className="text-xs font-semibold text-[#1F2A44] truncate block">{cardholder}</span>
                        </div>
                      )}

                      {extData.relevant_dates && extData.relevant_dates.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#E8DCC8] shadow-xs">
                          <span className="text-[10px] font-mono text-[#1F2A44]/60 uppercase block">Relevant Dates / DOB</span>
                          <span className="text-xs font-mono font-semibold text-[#1F2A44]">{extData.relevant_dates.join(', ')}</span>
                        </div>
                      )}

                      {Object.entries(extRegs)
                        .filter(([k]) => k !== 'PAN')
                        .map(([k, v]) => (
                          <div key={k} className="p-2.5 rounded-lg bg-white border border-[#E8DCC8] shadow-xs">
                            <span className="text-[10px] font-mono text-[#1F2A44]/60 uppercase block">{k}</span>
                            <span className="text-xs font-mono font-bold text-[#1F2A44]">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })()}

              {/* Assessment & Notices */}
              {activeDetailDoc.validation && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1F2A44] uppercase font-mono text-[10px] block">
                        ANUMATISETU Pre-validation Report
                      </span>
                      <button
                        onClick={() => explainDocument(activeDetailDoc.id, activeDetailDoc.document_name || activeDetailDoc.document_type)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition-all flex items-center gap-1 cursor-pointer"
                        title="Get personalized AI explanation for this document"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-[#C6A75E]" />
                        <span>{t("doc_explain_btn")}</span>
                      </button>
                    </div>
                    <p className="text-[#1F2A44]/80 leading-relaxed text-xs">
                      {activeDetailDoc.validation.assessment || activeDetailDoc.validation.summary || 'Vision OCR successfully processed document content.'}
                    </p>
                    {activeDetailDoc.validation.recommended_action && (
                      <div className="p-2 rounded-lg bg-[#E8DCC8]/60 border border-[#C6A75E] text-[#1F2A44] text-[11px] mt-2 font-medium">
                        <strong>Recommended Action:</strong> {activeDetailDoc.validation.recommended_action}
                      </div>
                    )}
                  </div>

                  {/* Discrepancies if any */}
                  {activeDetailDoc.validation.discrepancies && activeDetailDoc.validation.discrepancies.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-[#1F2A44] uppercase font-mono text-[10px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#C6A75E]" />
                        Discrepancies & Notices ({activeDetailDoc.validation.discrepancies.length})
                      </span>
                      {activeDetailDoc.validation.discrepancies.map((disc, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-xs">
                          <span className="font-bold">{disc.field || 'Field'}: </span>
                          <span>{disc.message || disc.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Toolbar */}
              <div className="pt-2 border-t border-[#E8DCC8] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewDocument(activeDetailDoc.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] font-semibold inline-flex items-center gap-1.5 transition-colors border border-[#E8DCC8] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#C6A75E]" />
                    <span>View / Preview</span>
                  </button>
                  <button
                    onClick={() => handleDownloadDocument(activeDetailDoc.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] font-semibold inline-flex items-center gap-1.5 transition-colors border border-[#E8DCC8] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C6A75E]" />
                    <span>Download</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleArchive(activeDetailDoc.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition-colors cursor-pointer"
                  >
                    Archive
                  </button>
                  <button
                    onClick={(e) => handleDelete(activeDetailDoc.id, e)}
                    className="px-3 py-1.5 rounded-xl bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition-colors cursor-pointer font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 border border-[#E8DCC8] text-center space-y-3 bg-white shadow-xs">
              <FileCheck className="w-10 h-10 text-[#C6A75E] mx-auto" />
              <h3 className="text-sm font-bold text-[#1F2A44]">No Document Selected</h3>
              <p className="text-xs text-[#1F2A44]/70 max-w-sm mx-auto">
                Select a document from your vault to view its pre-validation report, extracted identifiers, and version history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 5. UPLOAD MODAL ────────────────────────────────────────── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2A44]/60 backdrop-blur-xs">
          <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] bg-white max-w-lg w-full space-y-5 shadow-xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#C6A75E]" />
                <h3 className="text-sm font-bold text-[#1F2A44] uppercase tracking-wider">{t("doc_modal_upload_title")}</h3>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-[#1F2A44]/60 hover:text-[#1F2A44] hover:bg-[#FAF6F0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C6A75E] shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C6A75E] shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block">Duplicate File Detected</strong>
                    <p className="mt-0.5">{duplicateWarning.message}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8DCC8]">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadModalOpen(false);
                      const existing = documents.find((d) => d.id === duplicateWarning.existing_document?.id);
                      if (existing) setActiveDetailDoc(existing);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] font-semibold cursor-pointer border border-[#C6A75E]"
                  >
                    Use Existing Document
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadSubmit(null, true)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E8DCC8] text-[#1F2A44] hover:bg-[#FAF6F0] cursor-pointer"
                  >
                    Upload Anyway
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleUploadSubmit(e, false)} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[#1F2A44] font-semibold block uppercase tracking-wide">
                  {t("doc_modal_upload_type")} <span className="text-[#C6A75E]">*</span>
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs"
                >
                  {documentTypes.length > 0 ? (
                    documentTypes.map((t) => (
                      <option key={t.code} value={t.code}>{t.name} ({t.category})</option>
                    ))
                  ) : (
                    <>
                      <option value="PAN_CARD">Permanent Account Number (PAN)</option>
                      <option value="CERTIFICATE_OF_INCORPORATION">Certificate of Incorporation</option>
                      <option value="AADHAAR_CARD">Aadhaar Card (Authorized Signatory)</option>
                      <option value="ADDRESS_PROOF">Business Address Proof / Electricity Bill</option>
                      <option value="PASSPORT_PHOTO">Passport Size Photograph</option>
                      <option value="FOOD_PRODUCT_DETAILS">Food Product / Category Details</option>
                      <option value="BANK_PROOF">Bank Account Proof</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#1F2A44] font-semibold block uppercase tracking-wide">
                  {t("doc_modal_upload_name")}
                </label>
                <input
                  type="text"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  placeholder="e.g. Director PAN Card or Main Unit Electricity Bill"
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[#1F2A44] font-semibold block uppercase tracking-wide">
                  {t("doc_modal_upload_file")} <span className="text-[#C6A75E]">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-[#1F2A44]/70 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#E8DCC8] file:text-[#1F2A44] hover:file:bg-[#D6C4A8] file:cursor-pointer glass-input rounded-xl p-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#1F2A44]/80 font-medium block">{t("doc_modal_issue_date")}</label>
                  <input
                    type="date"
                    value={uploadIssueDate}
                    onChange={(e) => setUploadIssueDate(e.target.value)}
                    className="w-full glass-input px-2.5 py-1.5 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#1F2A44]/80 font-medium block">{t("doc_modal_expiry_date")}</label>
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="w-full glass-input px-2.5 py-1.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8DCC8]">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#1F2A44]/70 hover:bg-[#FAF6F0] transition-colors cursor-pointer"
                >
                  {t("btn_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 rounded-xl font-bold text-[#FAF6F0] bg-[#1F2A44] hover:bg-[#141C2E] shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploading ? t("doc_modal_uploading") : t("doc_modal_upload_btn")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. FIND MISSING DOCUMENTS MODAL ───────────────────────── */}
      {missingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2A44]/60 backdrop-blur-xs">
          <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] bg-white max-w-2xl w-full space-y-5 shadow-xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#C6A75E]" />
                <h3 className="text-sm font-bold text-[#1F2A44] uppercase tracking-wider">
                  {t("doc_modal_missing_title")}
                </h3>
              </div>
              <button
                onClick={() => setMissingModalOpen(false)}
                className="p-1.5 rounded-lg text-[#1F2A44]/60 hover:text-[#1F2A44] hover:bg-[#FAF6F0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingCompleteness ? (
              <div className="p-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#C6A75E] mx-auto" />
                <p className="text-xs text-[#1F2A44]/70">Checking document repository against statutory requirements…</p>
              </div>
            ) : completenessData ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm block">
                      {completenessData.available} of {completenessData.total_required} Documents Available
                    </span>
                    <span className="text-[11px] text-[#1F2A44]/70">
                      {completenessData.missing === 0
                        ? t("doc_modal_missing_all_ok")
                        : `${completenessData.missing} document(s) still required before application submission.`}
                    </span>
                  </div>
                  {completenessData.ready_for_submission ? (
                    <span className="px-3 py-1 rounded-full bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-mono font-bold text-xs">
                      ✓ {t("status_ready")}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[#E8DCC8]/50 text-[#1F2A44] border border-[#D6C4A8] font-mono font-bold text-xs">
                      {t("status_needs_attention")}
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {completenessData.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        item.status === 'AVAILABLE'
                          ? 'bg-[#E8DCC8]/40 border-[#C6A75E]'
                          : item.status === 'NEEDS_ATTENTION'
                          ? 'bg-[#FAF6F0] border-[#C6A75E]'
                          : 'bg-[#FAF6F0] border-[#E8DCC8]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1F2A44]">{item.name}</span>
                          {item.status === 'AVAILABLE' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[#1F2A44] bg-[#E8DCC8] px-2 py-0.5 rounded-full font-semibold border border-[#D6C4A8]">
                              <Check className="w-3 h-3 text-[#C6A75E]" /> {t("status_auto_verified")}
                            </span>
                          )}
                          {item.status === 'MISSING' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[#1F2A44] bg-[#FAF6F0] px-2 py-0.5 rounded-full border border-[#E8DCC8]">
                              {t("status_needs_attention")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#1F2A44]/60">
                          Required by: {(item.required_by || []).join(', ')}
                        </p>
                      </div>

                      {item.status === 'MISSING' ? (
                        <button
                          onClick={() => {
                            setMissingModalOpen(false);
                            setUploadDocType(item.code);
                            setUploadDocName(item.name);
                            setUploadModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] font-bold shadow-xs cursor-pointer shrink-0"
                        >
                          {t("btn_upload_store")}
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#C6A75E] font-mono font-semibold">Reusable</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ─── 7. REPLACE VERSION MODAL ────────────────────────────────── */}
      {replaceModalOpen && activeDetailDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2A44]/60 backdrop-blur-xs">
          <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] bg-white max-w-md w-full space-y-4 shadow-xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
              <h3 className="text-sm font-bold text-[#1F2A44] uppercase tracking-wider">
                {t("doc_modal_replace_title")} (v{(activeDetailDoc.current_version || 1) + 1})
              </h3>
              <button
                onClick={() => setReplaceModalOpen(false)}
                className="p-1.5 rounded-lg text-[#1F2A44]/60 hover:text-[#1F2A44] hover:bg-[#FAF6F0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#1F2A44]/80">
              Replacing <strong>{activeDetailDoc.document_name || activeDetailDoc.document_type}</strong> will create a new version while preserving the previous version for historical clearance tracking.
            </p>

            <form onSubmit={handleReplaceSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[#1F2A44] font-semibold block">{t("doc_modal_upload_file")}</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setReplaceFile(e.target.files[0])}
                  className="w-full text-xs text-[#1F2A44]/70 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#E8DCC8] file:text-[#1F2A44] glass-input p-1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#1F2A44] font-semibold block">Version Notes</label>
                <input
                  type="text"
                  value={replaceNotes}
                  onChange={(e) => setReplaceNotes(e.target.value)}
                  placeholder="e.g. Updated with correct authorized signatory address"
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplaceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#1F2A44]/70 hover:bg-[#FAF6F0]"
                >
                  {t("btn_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={replacing || !replaceFile}
                  className="px-4 py-2 rounded-xl font-bold text-[#FAF6F0] bg-[#1F2A44] hover:bg-[#141C2E] disabled:opacity-50"
                >
                  {replacing ? t("doc_modal_uploading") : t("doc_modal_replace_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentCenterPage;
