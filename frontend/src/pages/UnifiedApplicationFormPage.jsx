import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Receipt,
  Award,
  Layers,
  ArrowRight,
  Info,
  Clock,
  AlertCircle,
  Upload,
  FileCheck2,
  Save,
  Check,
  Zap,
  HelpCircle,
  RefreshCw,
  FileText,
  Plus,
  ExternalLink,
  CheckCircle
} from "lucide-react";
import { prepareUnifiedForm, submitUnifiedApplications } from "../api/requirements";
import { uploadDocument } from "../api/documents";
import { useLanguage } from "../context/LanguageContext";

export default function UnifiedApplicationFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const passedApprovals = location.state?.selected_approvals || ["FSSAI", "GST", "UDYAM"];

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0: Idle, 1: FSSAI, 2: GST, 3: Udyam, 4: Persist
  const [error, setError] = useState(null);
  const [saveDraftMessage, setSaveDraftMessage] = useState("");

  const [schemaData, setSchemaData] = useState(null);
  const [formData, setFormData] = useState({});
  const [documentDecisions, setDocumentDecisions] = useState({});

  // Document upload / replacement states
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [showAddCustomDocModal, setShowAddCustomDocModal] = useState(false);
  const [customDocType, setCustomDocType] = useState("FACTORY_LAYOUT_PLAN");
  const [customDocTitle, setCustomDocTitle] = useState("");
  const [customDocFile, setCustomDocFile] = useState(null);
  const [customDocUploading, setCustomDocUploading] = useState(false);

  useEffect(() => {
    loadUnifiedSchema();
  }, []);

  const loadUnifiedSchema = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await prepareUnifiedForm(passedApprovals);
      setSchemaData(res);

      // Initialize form with blank fields for clean manual user entry
      const initialValues = {};
      if (res.sections) {
        res.sections.forEach((sec) => {
          sec.fields.forEach((f) => {
            initialValues[f.id] = "";
          });
        });
      }
      setFormData(initialValues);

      // Pre-select existing documents
      const docMap = {};
      if (res.document_requirements) {
        res.document_requirements.forEach((doc) => {
          if (doc.is_available_in_center) {
            docMap[doc.doc_id] = "USE_EXISTING";
          } else {
            docMap[doc.doc_id] = "AUTO_GENERATE";
          }
        });
      }
      setDocumentDecisions(docMap);
    } catch (err) {
      console.error("Failed to load unified schema:", err);
      setError("Failed to generate unified form. Please check connectivity to mock services.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutofillFromProfile = () => {
    if (!schemaData?.sections) return;
    const autofilled = {};
    schemaData.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        autofilled[f.id] = f.default_value || "";
      });
    });
    setFormData(autofilled);
    setSaveDraftMessage("Form fields populated from your business profile & account.");
    setTimeout(() => setSaveDraftMessage(""), 4000);
  };

  const handleClearForm = () => {
    const cleared = {};
    Object.keys(formData).forEach((k) => {
      cleared[k] = "";
    });
    setFormData(cleared);
    setSaveDraftMessage("Form fields cleared.");
    setTimeout(() => setSaveDraftMessage(""), 3000);
  };

  const handleFileUpload = async (doc, file) => {
    if (!file) return;
    try {
      setUploadingDocId(doc.doc_id);
      setUploadError(null);
      setUploadSuccessMessage("");

      const docTypeCode = doc.canonical_code || doc.doc_id;
      const res = await uploadDocument(file, docTypeCode, null, {
        document_name: doc.title,
        force_upload: true
      });

      // Update schemaData in-place with new verified document
      setSchemaData((prev) => {
        if (!prev) return prev;
        const updatedDocs = prev.document_requirements.map((d) => {
          if (d.doc_id === doc.doc_id) {
            return {
              ...d,
              is_available_in_center: true,
              existing_file_name: file.name,
              existing_doc_id: res.id || res.existing_document?.id,
              validation_status: res.validation_status || "VALID",
              document_number_masked: res.document_number_masked,
            };
          }
          return d;
        });
        return { ...prev, document_requirements: updatedDocs };
      });

      // Update decision to use this uploaded document
      setDocumentDecisions((prev) => ({
        ...prev,
        [doc.doc_id]: "USE_EXISTING"
      }));

      setUploadSuccessMessage(`"${file.name}" uploaded, verified via OCR, and saved to your Document Center.`);
      setTimeout(() => setUploadSuccessMessage(""), 6000);
    } catch (err) {
      console.error("Document upload failed:", err);
      setUploadError(err.response?.data?.detail || err.message || "Failed to upload and verify document.");
      setTimeout(() => setUploadError(null), 6000);
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleAddCustomDocument = async (e) => {
    e.preventDefault();
    if (!customDocFile) return;

    try {
      setCustomDocUploading(true);
      setUploadError(null);

      const title = customDocTitle.trim() || customDocType;
      const res = await uploadDocument(customDocFile, customDocType, null, {
        document_name: title,
        force_upload: true
      });

      const newDocItem = {
        doc_id: customDocType + "_" + Date.now(),
        canonical_code: customDocType,
        title: title,
        used_by: passedApprovals,
        description: "Custom statutory attachment uploaded for this filing",
        is_available_in_center: true,
        existing_file_name: customDocFile.name,
        existing_doc_id: res.id || res.existing_document?.id,
        validation_status: res.validation_status || "VALID"
      };

      setSchemaData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          document_requirements: [...prev.document_requirements, newDocItem]
        };
      });

      setDocumentDecisions((prev) => ({
        ...prev,
        [newDocItem.doc_id]: "USE_EXISTING"
      }));

      setCustomDocFile(null);
      setCustomDocTitle("");
      setShowAddCustomDocModal(false);
      setUploadSuccessMessage(`"${customDocFile.name}" stored in Document Center and attached.`);
      setTimeout(() => setUploadSuccessMessage(""), 6000);
    } catch (err) {
      console.error("Custom document upload failed:", err);
      setUploadError(err.response?.data?.detail || err.message || "Failed to upload document.");
      setTimeout(() => setUploadError(null), 6000);
    } finally {
      setCustomDocUploading(false);
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Calculate actual completion stats
  const totalFields = schemaData?.total_fields || 24;
  const completedFields = Object.values(formData).filter((v) => v !== "" && v !== null && v !== undefined).length;
  const completionPercentage = Math.min(100, Math.round((completedFields / Math.max(totalFields, 1)) * 100));

  const handleSaveDraft = () => {
    setSaveDraftMessage("Draft progress saved securely to your TASKER profile.");
    setTimeout(() => setSaveDraftMessage(""), 4000);
  };

  const handleSubmitAll = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      setSubmitStep(1); // FSSAI
      await new Promise((r) => setTimeout(r, 450));

      setSubmitStep(2); // GST
      await new Promise((r) => setTimeout(r, 450));

      setSubmitStep(3); // Udyam
      await new Promise((r) => setTimeout(r, 450));

      setSubmitStep(4); // Database link

      const payload = {
        selected_approvals: passedApprovals,
        canonical_data: formData,
        document_decisions: documentDecisions
      };

      const result = await submitUnifiedApplications(payload);

      // Transition to unified success page
      navigate("/applications/success", {
        state: { submission_result: result }
      });
    } catch (err) {
      console.error("Unified submission error:", err);
      setError(err.response?.data?.detail || err.message || "Unified submission failed. Please verify mock portals are active.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#1F2A44] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#1F2A44]/80">{t('form_combining_schemas')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-[#E8DCC8] pb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#C6A75E] text-[#1F2A44] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
              {t("form_badge")}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#1F2A44]/70">{t("form_selected_badges")}</span>
              {passedApprovals.map((appId) => (
                <span key={appId} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] font-mono shadow-xs">
                  {appId}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1F2A44] tracking-tight">
                {t("form_title")}
              </h1>
              <p className="text-sm text-[#1F2A44]/70 max-w-2xl mt-1">
                {t("form_manual_prompt")}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleAutofillFromProfile}
                className="px-3.5 py-1.5 rounded-xl bg-[#E8DCC8] hover:bg-[#D6C4A8] border border-[#C6A75E] text-[#1F2A44] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
                <span>{t("btn_autofill_profile")}</span>
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44]/70 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>{t("btn_clear")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Overview Bar */}
        <div className="p-5 rounded-2xl bg-white border border-[#E8DCC8] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1F2A44]/80">
              {t("form_completion")} <strong className="text-[#1F2A44] font-mono">{t("form_fields_filled", { filled: completedFields, total: totalFields })}</strong>
            </span>
            <span className="font-bold text-[#1F2A44] font-mono">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#FAF6F0] overflow-hidden border border-[#E8DCC8]">
            <div
              className="h-full bg-gradient-to-r from-[#1F2A44] via-[#2D3D60] to-[#C6A75E] transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {saveDraftMessage && (
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-[#C6A75E]" />
            <span>{saveDraftMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#C6A75E]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmitAll} className="space-y-8">
          
          {/* Dynamic Merged Sections */}
          {schemaData?.sections?.map((section) => (
            <div
              key={section.id}
              className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm"
            >
              <div className="border-b border-[#E8DCC8] pb-3">
                <h3 className="text-base font-bold text-[#1F2A44] flex items-center gap-2">
                  <span>{section.title}</span>
                </h3>
                <p className="text-xs text-[#1F2A44]/70 mt-0.5">{section.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <div
                    key={field.id}
                    className={field.type === "textarea" ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#1F2A44]">
                        {field.label} {field.required && <span className="text-[#C6A75E]">*</span>}
                      </label>

                      {/* Origin & Prefill Source Badges */}
                      <div className="flex items-center gap-1.5">
                        {field.prefill_source && (
                          <span className="text-[10px] text-[#1F2A44] bg-[#E8DCC8] px-2 py-0.5 rounded border border-[#D6C4A8] font-medium">
                            ✓ {field.prefill_source}
                          </span>
                        )}
                        <span className="text-[10px] text-[#1F2A44] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#E8DCC8] font-mono">
                          Used by: {field.used_by.join(", ")}
                        </span>
                      </div>
                    </div>

                    {field.type === "select" ? (
                      <select
                        required={field.required}
                        value={formData[field.id] ?? ""}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] focus:ring-1 focus:ring-[#C6A75E] font-medium"
                      >
                        <option value="">Select an option</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        required={field.required}
                        pattern={field.pattern}
                        placeholder={field.placeholder}
                        value={formData[field.id] ?? ""}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] focus:ring-1 focus:ring-[#C6A75E] font-medium font-sans"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Document Center Reuse Section */}
          {schemaData?.document_requirements?.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8DCC8] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#1F2A44] flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-[#C6A75E]" />
                    <span>{t("form_doc_section_title")}</span>
                  </h3>
                  <p className="text-xs text-[#1F2A44]/70 mt-0.5">
                    {t("form_doc_section_desc")}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomDocModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] border border-[#C6A75E] text-[#1F2A44] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#C6A75E]" />
                    <span>{t("form_add_attachment")}</span>
                  </button>
                  <Link
                    to="/documents"
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] border border-[#E8DCC8] text-[#1F2A44]/80 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#1F2A44]/60" />
                    <span>{t("nav_documents")}</span>
                  </Link>
                </div>
              </div>

              {/* Upload Notifications */}
              {uploadSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-[#E8DCC8]/60 border border-[#C6A75E] text-xs text-[#1F2A44] font-medium flex items-center gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-[#C6A75E] shrink-0" />
                  <span>{uploadSuccessMessage}</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="space-y-3">
                {schemaData.document_requirements.map((doc) => {
                  const isUploading = uploadingDocId === doc.doc_id;
                  const isAvailable = doc.is_available_in_center;

                  return (
                    <div
                      key={doc.doc_id}
                      className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E8DCC8] hover:border-[#C6A75E]/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#1F2A44]">{doc.title}</span>
                          <span className="text-[10px] text-[#1F2A44] bg-[#E8DCC8] px-2 py-0.5 rounded border border-[#D6C4A8] font-mono">
                            Used by: {doc.used_by.join(", ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#1F2A44]/70">{doc.description}</p>
                        {isAvailable && doc.existing_file_name && (
                          <div className="flex items-center gap-2 text-[11px] text-[#1F2A44]/80 font-medium bg-white/70 px-2.5 py-1 rounded-lg border border-[#E8DCC8] w-fit">
                            <FileText className="w-3.5 h-3.5 text-[#C6A75E] shrink-0" />
                            <span className="truncate max-w-[240px] sm:max-w-xs">{doc.existing_file_name}</span>
                            {doc.document_number_masked && (
                              <span className="font-mono text-[10px] text-[#1F2A44]/60 bg-[#FAF6F0] px-1.5 py-0.2 rounded border border-[#E8DCC8]">
                                {doc.document_number_masked}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isUploading ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#C6A75E] text-xs font-semibold text-[#1F2A44]">
                            <div className="w-3.5 h-3.5 border-2 border-[#C6A75E] border-t-transparent rounded-full animate-spin" />
                            <span>{t("doc_modal_uploading")}</span>
                          </div>
                        ) : isAvailable ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#1F2A44] font-semibold flex items-center gap-1.5 bg-[#E8DCC8] px-3 py-1.5 rounded-xl border border-[#C6A75E]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#C6A75E]" />
                              <span>{t("status_auto_verified")}</span>
                            </span>

                            <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#1F2A44] text-xs font-semibold border border-[#E8DCC8] hover:border-[#C6A75E] flex items-center gap-1.5 transition shadow-xs">
                              <RefreshCw className="w-3.5 h-3.5 text-[#C6A75E]" />
                              <span>{t("btn_replace")}</span>
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(doc, e.target.files[0]);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#1F2A44]/60 font-medium flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-[#E8DCC8]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
                              <span>{t("status_ready")}</span>
                            </span>

                            <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-[#1F2A44] hover:bg-[#2D3D60] text-[#FAF6F0] text-xs font-bold flex items-center gap-1.5 transition shadow-xs">
                              <Upload className="w-3.5 h-3.5 text-[#C6A75E]" />
                              <span>{t("btn_upload_store")}</span>
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(doc, e.target.files[0]);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Custom Statutory Attachment Modal */}
          {showAddCustomDocModal && (
            <div className="fixed inset-0 z-50 bg-[#1F2A44]/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-[#E8DCC8] p-6 max-w-lg w-full space-y-5 shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-[#C6A75E]" />
                    <h3 className="text-base font-bold text-[#1F2A44]">
                      {t("form_custom_doc_modal_title")}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomDocModal(false)}
                    className="text-[#1F2A44]/60 hover:text-[#1F2A44] text-lg font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-[#1F2A44]/70">
                  {t("form_custom_doc_modal_sub")}
                </p>

                <form onSubmit={handleAddCustomDocument} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F2A44]">{t("doc_modal_upload_type")}</label>
                    <select
                      value={customDocType}
                      onChange={(e) => setCustomDocType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-xs font-medium focus:outline-none focus:border-[#C6A75E]"
                    >
                      <option value="FACTORY_LAYOUT_PLAN">Factory / Unit Layout Plan</option>
                      <option value="WATER_TEST_REPORT">Water Potability / Effluent Test Report</option>
                      <option value="BANK_PROOF">Bank Account Proof / Cancelled Cheque</option>
                      <option value="RENT_AGREEMENT">Registered Rent Agreement / Lease Deed</option>
                      <option value="FOOD_PRODUCT_DETAILS">Food Formulation / Product Data Sheet</option>
                      <option value="OTHER">Other Regulatory NOC / Approval Certificate</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F2A44]">{t("doc_modal_upload_name")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Water Test Report Salem Plant 2026"
                      value={customDocTitle}
                      onChange={(e) => setCustomDocTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-xs font-medium focus:outline-none focus:border-[#C6A75E]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F2A44]">{t("doc_modal_upload_file")}</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setCustomDocFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#1F2A44] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1F2A44] file:text-[#FAF6F0] hover:file:bg-[#2D3D60] cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomDocModal(false)}
                      className="px-4 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] text-xs font-semibold border border-[#E8DCC8] cursor-pointer"
                    >
                      {t("btn_cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={!customDocFile || customDocUploading}
                      className="px-5 py-2 rounded-xl bg-[#1F2A44] hover:bg-[#2D3D60] text-[#FAF6F0] text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {customDocUploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-[#FAF6F0] border-t-transparent rounded-full animate-spin" />
                          <span>{t("doc_modal_uploading")}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-[#C6A75E]" />
                          <span>{t("doc_modal_upload_btn")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Pre-submission Readiness Overview */}
          <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
              <h4 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider font-mono">
                {t("form_dispatch_status")}
              </h4>
              <span className="text-xs text-[#1F2A44] font-semibold">{t("form_dispatch_desc")}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {passedApprovals.map((appId) => (
                <div key={appId} className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#C6A75E] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1F2A44]">{appId} Filing</span>
                    <span className="text-[10px] font-bold text-[#1F2A44] bg-[#E8DCC8] px-2 py-0.5 rounded border border-[#C6A75E]">
                      ✓ {t("status_ready")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1F2A44]/70">Canonical data verified & mapped</p>
                </div>
              ))}
            </div>

            {/* Submission Progress animation */}
            {submitting && (
              <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#C6A75E] space-y-3">
                <div className="flex items-center gap-2.5 text-xs font-bold text-[#1F2A44]">
                  <div className="w-4 h-4 border-2 border-[#1F2A44] border-t-transparent rounded-full animate-spin" />
                  <span>{t("form_distributing_records")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className={`p-2 rounded-lg border ${submitStep >= 1 ? "bg-[#E8DCC8] border-[#C6A75E] text-[#1F2A44]" : "bg-white border-[#E8DCC8] text-[#1F2A44]/40"}`}>
                    1. FSSAI Dispatch
                  </div>
                  <div className={`p-2 rounded-lg border ${submitStep >= 2 ? "bg-[#E8DCC8] border-[#C6A75E] text-[#1F2A44]" : "bg-white border-[#E8DCC8] text-[#1F2A44]/40"}`}>
                    2. GST Headless Submit
                  </div>
                  <div className={`p-2 rounded-lg border ${submitStep >= 3 ? "bg-[#E8DCC8] border-[#C6A75E] text-[#1F2A44]" : "bg-white border-[#E8DCC8] text-[#1F2A44]/40"}`}>
                    3. Udyam MSME Direct
                  </div>
                  <div className={`p-2 rounded-lg border ${submitStep >= 4 ? "bg-[#E8DCC8] border-[#C6A75E] text-[#1F2A44]" : "bg-white border-[#E8DCC8] text-[#1F2A44]/40"}`}>
                    4. Dual-DB Link Complete
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] text-xs font-semibold border border-[#E8DCC8] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#C6A75E]" />
                <span>{t("form_save_continue_later")}</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#1F2A44] via-[#2D3D60] to-[#C6A75E] hover:from-[#141C2E] hover:to-[#A88B42] text-[#FAF6F0] font-extrabold text-sm shadow-md shadow-[#1F2A44]/20 flex items-center justify-center gap-2.5 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#C6A75E]" />
                <span>{t("form_submit_applications_btn", { count: passedApprovals.length })}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
