import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FileCheck2,
  Building2,
  Receipt,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Zap,
  Info,
  Check,
  Send,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
  Users,
  Package,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";
import {
  getGstSchema,
  getGstPrefillData,
  submitGstHeadless,
  syncGstStatus,
} from "../api/gst";
import { fetchMyProfile } from "../api/businessProfile";
import { useLanguage } from "../context/LanguageContext";

export default function GstIntegrationPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0: Idle, 1: Schema Payload, 2: Microservice Dispatch, 3: Dual DB Sync, 4: Persist
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const [schemaData, setSchemaData] = useState(null);
  const [activeTab, setActiveTab] = useState("form"); // 'form' | 'status' | 'schema'

  // Dynamic Form State
  const [formData, setFormData] = useState({
    external_reference_id: "",
    applicant: {
      name: "",
      mobile: "",
      email: "",
    },
    business: {
      legal_name: "",
      trade_name: "",
      pan: "",
      constitution: "PRIVATE_LIMITED",
      business_activity: "MANUFACTURER",
      primary_activity: "",
      state: "",
      district: "",
      pincode: "",
      reason_for_reg: "",
    },
    principal_place: {
      premise_name: "",
      locality: "",
      state: "",
      district: "",
      pincode: "",
      nature_of_possession: "OWNED",
    },
    promoters: [
      {
        name: "",
        role: "Managing Director",
        pan: "",
        aadhaar_last4: "",
        mobile: "",
        email: "",
        address: "",
      },
    ],
    goods_services: [
      {
        type: "GOODS",
        description: "",
        hsn_sac_code: "",
      },
    ],
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Dynamic Schema
      try {
        const schemaRes = await getGstSchema();
        if (schemaRes && schemaRes.data) {
          setSchemaData(schemaRes.data);
        } else if (schemaRes && schemaRes.sections) {
          setSchemaData(schemaRes);
        }
      } catch (err) {
        console.warn("Could not load dynamic GST schema from API, using fallback:", err);
      }

      // 2. Fetch Business Profile & Prefill
      try {
        const prof = await fetchMyProfile();
        const prefill = await getGstPrefillData();
        const pData = prefill?.data || {};

        setFormData((prev) => ({
          ...prev,
          external_reference_id: `SIH-GST-${Date.now().toString().slice(-6)}`,
          applicant: {
            name: pData.applicant?.name || user?.full_name || "Authorized Signatory",
            mobile: pData.applicant?.mobile || user?.phone || "9876543210",
            email: pData.applicant?.email || user?.email || "applicant@example.com",
          },
          business: {
            ...prev.business,
            legal_name: prof?.company_name || pData.business?.legal_name || "Enterprise Foods Private Limited",
            trade_name: prof?.company_name || pData.business?.trade_name || "Enterprise Foods",
            state: prof?.state || pData.business?.state || "Maharashtra",
            district: prof?.district || pData.business?.district || "Pune",
            constitution: prof?.business_type?.toLowerCase().includes("private")
              ? "PRIVATE_LIMITED"
              : pData.business?.constitution || "PRIVATE_LIMITED",
          },
          principal_place: {
            ...prev.principal_place,
            premise_name: `${prof?.company_name || "Enterprise"} Production Facility`,
            state: prof?.state || "Maharashtra",
            district: prof?.district || "Pune",
          },
          promoters: pData.promoters?.length
            ? pData.promoters
            : [
                {
                  name: user?.full_name || "Authorized Director",
                  role: "Managing Director",
                  pan: "ABCDE1234F",
                  aadhaar_last4: "1234",
                  mobile: user?.phone || "9876543210",
                  email: user?.email || "director@example.com",
                  address: `Plot 12, SIDCO Industrial Complex, ${prof?.district || "Pune"}`,
                },
              ],
          goods_services: pData.goods_services?.length
            ? pData.goods_services
            : [
                {
                  type: "GOODS",
                  description: "Processed Agro & Packaged Snack Foods",
                  hsn_sac_code: "2106",
                },
              ],
        }));
      } catch (e) {
        console.warn("Prefill loading notice:", e);
      }
    } catch (err) {
      console.error("Failed to load GST initial data:", err);
      setError("Failed to initialize GST connection. Please verify the Mock GST service is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (sectionId, fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || {}),
        [fieldName]: value,
      },
    }));
  };

  const handleArrayFieldChange = (sectionId, index, fieldName, value) => {
    setFormData((prev) => {
      const arr = [...(prev[sectionId] || [])];
      arr[index] = { ...arr[index], [fieldName]: value };
      return { ...prev, [sectionId]: arr };
    });
  };

  const addArrayItem = (sectionId, defaultItem) => {
    setFormData((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), defaultItem],
    }));
  };

  const removeArrayItem = (sectionId, index) => {
    setFormData((prev) => {
      const arr = [...(prev[sectionId] || [])];
      if (arr.length > 1) {
        arr.splice(index, 1);
      }
      return { ...prev, [sectionId]: arr };
    });
  };

  const handleHeadlessSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSubmitStep(1); // Preparing Schema & Payload

      await new Promise((r) => setTimeout(r, 400));
      setSubmitStep(2); // Headless API Dispatch to Mock GST

      await new Promise((r) => setTimeout(r, 400));
      setSubmitStep(3); // Statutory Key Authentication & Dual-DB Sync

      const payload = {
        ...formData,
        external_reference_id:
          formData.external_reference_id || `SIH-GST-${Date.now().toString().slice(-6)}`,
        source_system: "MAIN_SIH_PORTAL",
        auto_generate_mock_documents: true,
      };

      const result = await submitGstHeadless(payload);

      setSubmitStep(4); // Database Persistence Complete
      setSuccessResult(result);
      setActiveTab("status");
    } catch (err) {
      console.error("GST Headless Submission failed:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          err.message ||
          "GST Headless submission failed. Please verify Mock GST service is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncStatus = async () => {
    const appNo = successResult?.application_number;
    if (!appNo) return;
    try {
      setSyncing(true);
      const res = await syncGstStatus(appNo);
      setSuccessResult((prev) => ({
        ...prev,
        status: res.status,
        mock_registration_ref: res.mock_registration_ref || prev.mock_registration_ref,
        pending_actions: res.pending_actions || [],
      }));
    } catch (err) {
      console.error("Status sync failed:", err);
      alert("Failed to sync status: " + (err.response?.data?.detail || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            OFFICIALLY APPROVED
          </span>
        );
      case "UNDER_SCRUTINY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            OFFICER SCRUTINY IN PROGRESS
          </span>
        );
      case "DOCUMENT_QUERY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            DOCUMENT QUERY RAISED
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            REJECTED BY TAX OFFICER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            SUBMITTED TO GST QUEUE
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                Method 2 Headless Integration
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Goods and Services Tax Network (GSTN)</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Receipt className="w-8 h-8 text-emerald-400" />
              Dynamic GST Registration
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              100% automated direct submission with dynamic schema discovery, single-window profile prefilling, and real-time dual-database synchronization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
            >
              Back to Dashboard
            </Link>
            <a
              href="http://localhost:8003/docs"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mock GST API Docs
            </a>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Integration Method</p>
                <p className="text-sm font-bold text-white">100% Headless API</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Schema Discovery</p>
                <p className="text-sm font-bold text-white">Dynamic 5-Section Fields</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Persistence Model</p>
                <p className="text-sm font-bold text-white">Dual-DB Linked Sync</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Officer Scrutiny</p>
                <p className="text-sm font-bold text-white">Live State Polling</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("form")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === "form"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Dynamic Registration Form
          </button>
          {successResult && (
            <button
              onClick={() => setActiveTab("status")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "status"
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Application Status & Sync
            </button>
          )}
          <button
            onClick={() => setActiveTab("schema")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === "schema"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Schema Specifications & API Key
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Integration Notice</p>
              <p className="text-xs text-rose-400 mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadInitialData}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* TAB 1: FORM */}
        {activeTab === "form" && (
          <form onSubmit={handleHeadlessSubmit} className="space-y-6">
            {/* Section 1: Authorized Signatory */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    1. Authorized Signatory / Primary Applicant Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Individual holding Power of Attorney or Director rights for GST statutory filing.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Applicant Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.applicant.name}
                    onChange={(e) => handleFieldChange("applicant", "name", e.target.value)}
                    placeholder="e.g. Rahul Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Mobile Number (10 Digits) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    pattern="^[6-9]\d{9}$"
                    value={formData.applicant.mobile}
                    onChange={(e) => handleFieldChange("applicant", "mobile", e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.applicant.email}
                    onChange={(e) => handleFieldChange("applicant", "email", e.target.value)}
                    placeholder="rahul@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Business Entity & Constitution */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    2. Business Entity & Constitution
                  </h3>
                  <p className="text-xs text-slate-400">
                    Legal business constitution, PAN verification, and operational categorizations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Legal Name of Business (as per PAN) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business.legal_name}
                    onChange={(e) => handleFieldChange("business", "legal_name", e.target.value)}
                    placeholder="e.g. ABC Foods Private Limited"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Trade Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business.trade_name}
                    onChange={(e) => handleFieldChange("business", "trade_name", e.target.value)}
                    placeholder="e.g. ABC Foods"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Permanent Account Number (PAN) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                    value={formData.business.pan}
                    onChange={(e) => handleFieldChange("business", "pan", e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Constitution of Business <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.business.constitution}
                    onChange={(e) => handleFieldChange("business", "constitution", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PRIVATE_LIMITED">Private Limited Company</option>
                    <option value="PUBLIC_LIMITED">Public Limited Company</option>
                    <option value="LLP">Limited Liability Partnership (LLP)</option>
                    <option value="PROPRIETORSHIP">Proprietorship</option>
                    <option value="PARTNERSHIP">Partnership Firm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nature of Business Activity <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.business.business_activity}
                    onChange={(e) => handleFieldChange("business", "business_activity", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MANUFACTURER">Manufacturing Unit</option>
                    <option value="WHOLESALE">Wholesale / Distribution</option>
                    <option value="RETAIL">Retail Trade</option>
                    <option value="SERVICE_PROVIDER">Service Provision</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Primary Activity Description <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business.primary_activity}
                    onChange={(e) => handleFieldChange("business", "primary_activity", e.target.value)}
                    placeholder="e.g. Food Manufacturing & Packaged Snacks"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    State <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business.state}
                    onChange={(e) => handleFieldChange("business", "state", e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    District <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business.district}
                    onChange={(e) => handleFieldChange("business", "district", e.target.value)}
                    placeholder="Pune"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Pincode <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^[1-9][0-9]{5}$"
                    value={formData.business.pincode}
                    onChange={(e) => handleFieldChange("business", "pincode", e.target.value)}
                    placeholder="411028"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Principal Place of Business */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    3. Principal Place of Business
                  </h3>
                  <p className="text-xs text-slate-400">
                    Physical premise address and premise possession nature.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Premise / Building / Complex Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.principal_place.premise_name}
                    onChange={(e) => handleFieldChange("principal_place", "premise_name", e.target.value)}
                    placeholder="e.g. ABC Food Processing Complex"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Street / Locality / Industrial Estate <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.principal_place.locality}
                    onChange={(e) => handleFieldChange("principal_place", "locality", e.target.value)}
                    placeholder="e.g. SIDCO Industrial Estate"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nature of Possession <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.principal_place.nature_of_possession}
                    onChange={(e) => handleFieldChange("principal_place", "nature_of_possession", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="RENTED">Rented</option>
                    <option value="OWNED">Owned</option>
                    <option value="LEASED">Leased</option>
                    <option value="CONSENT">Consent / Shared</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Promoters / Directors (Dynamic Array) */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      4. Promoters / Partners / Managing Directors
                    </h3>
                    <p className="text-xs text-slate-400">
                      Key management personnel and directorship roster.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    addArrayItem("promoters", {
                      name: "",
                      role: "Director",
                      pan: "ABCDE1234F",
                      aadhaar_last4: "1234",
                      mobile: "9876543210",
                      email: "",
                      address: "Industrial Complex",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Promoter
                </button>
              </div>

              <div className="space-y-4">
                {formData.promoters.map((promoter, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        Promoter #{idx + 1}
                      </span>
                      {formData.promoters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeArrayItem("promoters", idx)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={promoter.name}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "name", e.target.value)
                          }
                          placeholder="e.g. Rahul Kumar"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Designation / Role *
                        </label>
                        <input
                          type="text"
                          required
                          value={promoter.role}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "role", e.target.value)
                          }
                          placeholder="Director"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Individual PAN *
                        </label>
                        <input
                          type="text"
                          required
                          pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                          value={promoter.pan}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "pan", e.target.value.toUpperCase())
                          }
                          placeholder="ABCDE1234F"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 uppercase font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Aadhaar Last 4 Digits *
                        </label>
                        <input
                          type="text"
                          required
                          pattern="^\d{4}$"
                          maxLength={4}
                          value={promoter.aadhaar_last4}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "aadhaar_last4", e.target.value)
                          }
                          placeholder="1234"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Mobile *
                        </label>
                        <input
                          type="tel"
                          required
                          pattern="^[6-9]\d{9}$"
                          value={promoter.mobile}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "mobile", e.target.value)
                          }
                          placeholder="9876543210"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={promoter.email}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "email", e.target.value)
                          }
                          placeholder="rahul@example.com"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Residential Address *
                        </label>
                        <input
                          type="text"
                          required
                          value={promoter.address}
                          onChange={(e) =>
                            handleArrayFieldChange("promoters", idx, "address", e.target.value)
                          }
                          placeholder="12 SIDCO Industrial Estate, Salem"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Goods & Services (Dynamic Array) */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      5. Goods & Services Supplied (HSN / SAC Codes)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Standardized classification of items manufactured or services rendered.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    addArrayItem("goods_services", {
                      type: "GOODS",
                      description: "",
                      hsn_sac_code: "2106",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Commodity
                </button>
              </div>

              <div className="space-y-4">
                {formData.goods_services.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                        Supply Item #{idx + 1}
                      </span>
                      {formData.goods_services.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeArrayItem("goods_services", idx)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Classification *
                        </label>
                        <select
                          value={item.type}
                          onChange={(e) =>
                            handleArrayFieldChange("goods_services", idx, "type", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        >
                          <option value="GOODS">Goods (HSN Code)</option>
                          <option value="SERVICES">Services (SAC Code)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          HSN / SAC Code (4-8 Digits) *
                        </label>
                        <input
                          type="text"
                          required
                          pattern="^\d{4,8}$"
                          value={item.hsn_sac_code}
                          onChange={(e) =>
                            handleArrayFieldChange("goods_services", idx, "hsn_sac_code", e.target.value)
                          }
                          placeholder="2106"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Description *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) =>
                            handleArrayFieldChange("goods_services", idx, "description", e.target.value)
                          }
                          placeholder="Packaged Snacks and Processed Foods"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Progress / Action Button */}
            {submitting ? (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <p className="font-bold text-white text-sm">
                    Executing Method 2 Headless GST Registration...
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      submitStep >= 1
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    1. Dynamic Schema Validation
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      submitStep >= 2
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    2. Headless API Dispatch
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      submitStep >= 3
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    3. Dual-Database Sync
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      submitStep >= 4
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    4. Scrutiny Queue Routed
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition group cursor-pointer"
              >
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Submit GST Registration (Method 2 Headless)
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </form>
        )}

        {/* TAB 2: APPLICATION STATUS & LIVE SYNC */}
        {activeTab === "status" && successResult && (
          <div className="space-y-6">
            <div className="p-8 rounded-3xl bg-slate-900/70 border border-emerald-500/40 space-y-6 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">
                      GST Application Successfully Submitted!
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    Application dispatched headlessly and linked across both Main Website & Mock GST databases.
                  </p>
                </div>
                <div>{getStatusBadge(successResult.status)}</div>
              </div>

              {/* Application Details Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-xs text-slate-400">Official GST Application Number</p>
                  <p className="text-base font-mono font-bold text-emerald-400">
                    {successResult.application_number}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-xs text-slate-400">Platform External Reference ID</p>
                  <p className="text-base font-mono font-bold text-slate-200">
                    {successResult.external_reference_id}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-xs text-slate-400">Official GSTIN Ref (On Approval)</p>
                  <p className="text-base font-mono font-bold text-blue-400">
                    {successResult.mock_registration_ref || "Pending Officer Scrutiny"}
                  </p>
                </div>
              </div>

              {/* Live Status Sync Action Panel */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <RefreshCw
                      className={`w-4 h-4 text-emerald-400 ${syncing ? "animate-spin" : ""}`}
                    />
                    Live Officer Scrutiny Synchronization
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Queries <code className="text-emerald-300 font-mono">GET /applications/{successResult.application_number}/status</code> and refreshes status in real-time.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSyncStatus}
                    disabled={syncing}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "🔄 Refresh / Sync Status"}
                  </button>

                  <button
                    onClick={() => {
                      setSuccessResult(null);
                      setActiveTab("form");
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    New Application
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMA SPECIFICATIONS */}
        {activeTab === "schema" && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Mock GST REST API & Dynamic Schema Definition
                    </h3>
                    <p className="text-xs text-slate-400">
                      Discovered from <code className="text-emerald-400 font-mono">GET /api/integrations/v1/schema</code>
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                  X-API-Key: gst_sih26130_secret_api_key_mock_2026
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800/80">
                <pre>{JSON.stringify(schemaData || formData, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
