import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ShieldCheck,
  Building2,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Layers,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Send,
  Zap,
  Info,
  Calendar,
  Eye,
  FileCheck
} from "lucide-react";
import {
  getFssaiRequirements,
  getFssaiPrefillData,
  submitFssaiHeadless,
  submitFssaiJson,
  syncFssaiStatus,
} from "../api/fssai";
import { fetchMyProfile } from "../api/businessProfile";
import { useLanguage } from "../context/LanguageContext";

export default function FssaiIntegrationPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0: Idle, 1: Prefill, 2: Upload Docs, 3: Submit, 4: Done
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  const [requirements, setRequirements] = useState([]);
  const [profile, setProfile] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    applicant_name: "",
    designation: "Managing Director",
    mobile: "",
    email: "",
    business_name: "",
    organization_type: "PRIVATE_LIMITED",
    business_type: "MANUFACTURING_UNIT",
    pan_number: "",
    gst_number: "",
    state: "",
    district: "",
    pincode: "",
    address_line_1: "",
    address_line_2: "",
    ownership_type: "OWNED",
    activities: ["MANUFACTURING", "PACKAGING"],
    products: [
      {
        product_name: "",
        product_category: "Packaged Foods",
        expected_capacity: 1000,
        unit_of_measure: "kg/day",
      },
    ],
  });

  // Selected file objects for 4 mandatory docs
  const [files, setFiles] = useState({
    identity_proof: null,
    address_proof: null,
    passport_photo: null,
    food_product_category: null,
  });

  const [activeTab, setActiveTab] = useState("form"); // 'form' | 'status'

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load requirements
      const reqRes = await getFssaiRequirements();
      if (reqRes && reqRes.data) {
        setRequirements(reqRes.data);
      }

      // Load profile & prefill
      try {
        const profRes = await fetchMyProfile();
        if (profRes && profRes.data) {
          setProfile(profRes.data);
          const p = profRes.data;
          setFormData((prev) => ({
            ...prev,
            business_name: p.company_name || prev.business_name,
            state: p.state || prev.state,
            district: p.district || prev.district,
            organization_type:
              p.business_type?.toLowerCase().includes("private")
                ? "PRIVATE_LIMITED"
                : "LLP",
            applicant_name: user?.full_name || prev.applicant_name,
            email: user?.email || prev.email,
          }));
        }
      } catch (e) {
        console.log("Profile load notice:", e);
      }

      // Load prefill defaults from backend service
      try {
        const preRes = await getFssaiPrefillData();
        if (preRes && preRes.data) {
          const d = preRes.data;
          setFormData((prev) => ({
            ...prev,
            applicant_name: d.applicant?.applicant_name || prev.applicant_name,
            designation: d.applicant?.designation || prev.designation,
            mobile: d.applicant?.mobile || prev.mobile,
            email: d.applicant?.email || prev.email,
            business_name: d.business?.business_name || prev.business_name,
            pan_number: d.business?.pan_number || prev.pan_number,
            gst_number: d.business?.gst_number || prev.gst_number,
            address_line_1: d.business?.address_line_1 || prev.address_line_1,
            state: d.business?.state || prev.state,
            district: d.business?.district || prev.district,
            pincode: d.business?.pincode || prev.pincode,
            products: d.products?.length ? d.products : prev.products,
          }));
        }
      } catch (e) {
        console.log("Prefill notice:", e);
      }
    } catch (err) {
      console.error("Failed to load FSSAI initial data:", err);
      setError("Unable to connect to Mock FSSAI Service. Showing offline specifications.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductChange = (index, field, value) => {
    const updated = [...formData.products];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, products: updated }));
  };

  const addProduct = () => {
    setFormData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          product_name: "",
          product_category: "Packaged Foods",
          expected_capacity: 500,
          unit_of_measure: "kg/day",
        },
      ],
    }));
  };

  const removeProduct = (index) => {
    if (formData.products.length <= 1) return;
    const updated = formData.products.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, products: updated }));
  };

  const handleFileChange = (docId, file) => {
    setFiles((prev) => ({ ...prev, [docId]: file }));
  };

  const handleHeadlessSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSubmitStep(1);

      // Check if files attached
      const hasAnyFiles = Object.values(files).some((f) => f !== null);

      let result;
      if (hasAnyFiles) {
        setSubmitStep(2);
        const data = new FormData();
        data.append("payload", JSON.stringify(formData));
        Object.keys(files).forEach((key) => {
          if (files[key]) {
            data.append(key, files[key]);
          }
        });
        setSubmitStep(3);
        result = await submitFssaiHeadless(data);
      } else {
        // Direct JSON headless submission (pre-validated documents auto-bundled)
        setSubmitStep(2);
        await new Promise((r) => setTimeout(r, 600));
        setSubmitStep(3);
        result = await submitFssaiJson(formData);
      }

      setSubmitStep(4);
      setSuccessResult(result);
      setActiveTab("status");
    } catch (err) {
      console.error("Submission failed:", err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          "Headless FSSAI submission failed. Please verify the mock service is active."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncStatus = async () => {
    if (!successResult?.fssai_application_number) return;
    try {
      setSyncing(true);
      const res = await syncFssaiStatus(successResult.fssai_application_number);
      if (res && res.success) {
        setSuccessResult((prev) => ({
          ...prev,
          fssai_status: res.status,
          officer_remarks: res.officer_remarks,
          pending_actions: res.pending_actions,
          last_synced_at: res.last_synced_at,
        }));
      }
    } catch (err) {
      console.error("Status sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Prototype Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                FSSAI — Simulated External Portal Connector
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Headless Automated
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
              FSSAI Food Safety Licensing Integration
            </h1>
            <p className="text-sm text-slate-400">
              One-click prefilled statutory application to the Food Safety and Standards Authority of India portal with live review sync.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/applicant/dashboard"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              ← Back to Dashboard
            </Link>
            <a
              href="http://localhost:8002/docs"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>FSSAI Swagger Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Integration Notice</p>
              <p className="text-xs text-rose-200/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("form")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "form"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            1. Pre-Filled Application Form
          </button>
          {successResult && (
            <button
              onClick={() => setActiveTab("status")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "status"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-slate-900 text-emerald-400 hover:text-emerald-300"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              2. Live Approval Status ({successResult.fssai_application_number})
            </button>
          )}
        </div>

        {/* Tab 1: Application Form & Headless Execution */}
        {activeTab === "form" && (
          <form onSubmit={handleHeadlessSubmit} className="space-y-6">
            {/* Progress Pipeline */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Headless Automated 3-Step Execution Pipeline
                </span>
                <span className="text-[11px] text-slate-400">
                  Data pulled automatically from Business Profile & Pre-validation Vault
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    submitStep === 1
                      ? "bg-blue-950/40 border-blue-500 text-blue-200 animate-pulse"
                      : submitStep > 1
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-900/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Step 1: Prefill Draft</span>
                    {submitStep > 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">POST /prefill</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Constructs statutory payload with business, premises & products.
                  </p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    submitStep === 2
                      ? "bg-blue-950/40 border-blue-500 text-blue-200 animate-pulse"
                      : submitStep > 2
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-900/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Step 2: Upload 4 Docs</span>
                    {submitStep > 2 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">POST /documents (x4)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Bundles ID, Address, Photo & Product specs from Vault.
                  </p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    submitStep === 3
                      ? "bg-blue-950/40 border-blue-500 text-blue-200 animate-pulse"
                      : submitStep >= 4
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-900/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Step 3: Final Submit</span>
                    {submitStep >= 4 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">POST /submit</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Executes formal filing and receives live application number.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Section: Applicant & Business */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Applicant Info */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    1. Applicant & Signatory Details
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                    Auto-Prefilled
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Applicant Name *</label>
                    <input
                      type="text"
                      value={formData.applicant_name}
                      onChange={(e) => handleInputChange("applicant_name", e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Designation *</label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={(e) => handleInputChange("designation", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Mobile (10 digits) *</label>
                      <input
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => handleInputChange("mobile", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Official Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Business & Premises */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    2. Business & Premises Details
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                    From Profile
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Business Trade Name *</label>
                    <input
                      type="text"
                      value={formData.business_name}
                      onChange={(e) => handleInputChange("business_name", e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">PAN Number *</label>
                      <input
                        type="text"
                        value={formData.pan_number}
                        onChange={(e) => handleInputChange("pan_number", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">GST Number (Optional)</label>
                      <input
                        type="text"
                        value={formData.gst_number}
                        onChange={(e) => handleInputChange("gst_number", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">State *</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">District *</label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => handleInputChange("district", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Pincode *</label>
                      <input
                        type="text"
                        value={formData.pincode}
                        onChange={(e) => handleInputChange("pincode", e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Premises Address *</label>
                    <input
                      type="text"
                      value={formData.address_line_1}
                      onChange={(e) => handleInputChange("address_line_1", e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Food Product Categories */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    3. Food Products & Operational Capacity
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Specify manufacturing product lines and daily expected output.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addProduct}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
              </div>

              <div className="space-y-3">
                {formData.products.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 text-[11px] mb-1">Product Description *</label>
                      <input
                        type="text"
                        value={p.product_name}
                        onChange={(e) => handleProductChange(idx, "product_name", e.target.value)}
                        placeholder="e.g. Packaged Potato Chips / Fruit Juice"
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Capacity *</label>
                      <input
                        type="number"
                        value={p.expected_capacity}
                        onChange={(e) => handleProductChange(idx, "expected_capacity", e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-slate-400 text-[11px] mb-1">Unit</label>
                        <select
                          value={p.unit_of_measure}
                          onChange={(e) => handleProductChange(idx, "unit_of_measure", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none text-xs"
                        >
                          <option value="kg/day">kg/day</option>
                          <option value="liters/day">liters/day</option>
                          <option value="MT/year">MT/year</option>
                          <option value="units/day">units/day</option>
                        </select>
                      </div>
                      {formData.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Mandatory Statutory Documents */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    4. Statutory Documents (4 Required by Mock FSSAI API)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Max 5MB each. If no custom file is selected, verified pre-validated vault assets are automatically bundled.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Vault Pre-Validation Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    id: "identity_proof",
                    name: "1. Identity Proof",
                    desc: "Government-issued identity card of applicant (PAN/Aadhaar/Passport)",
                    vaultTag: "PAN Card / Aadhaar",
                  },
                  {
                    id: "address_proof",
                    name: "2. Address Proof",
                    desc: "Electricity bill, lease agreement, or property tax receipt for premises",
                    vaultTag: "Electricity Bill",
                  },
                  {
                    id: "passport_photo",
                    name: "3. Passport Photograph",
                    desc: "Recent color photo of applicant / authorized signatory",
                    vaultTag: "Photograph",
                  },
                  {
                    id: "food_product_category",
                    name: "4. Food Product / Category Details",
                    desc: "Product specification and process flow chart",
                    vaultTag: "Project Report",
                  },
                ].map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{doc.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {files[doc.id] ? files[doc.id].name : "Reusing Vault Document"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{doc.desc}</p>
                    <div className="pt-2 flex items-center justify-between">
                      <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer flex items-center gap-1.5 transition-all text-[11px]">
                        <Upload className="w-3.5 h-3.5 text-blue-400" />
                        <span>{files[doc.id] ? "Change File" : "Choose Custom File"}</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(doc.id, e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Statutory Spec Matched
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white">Ready for 100% Automated Headless Submission</p>
                <p className="text-[11px] text-slate-400">
                  Target: Mock FSSAI Integration Gateway (<code className="text-blue-400">http://localhost:8002/api/integrations/v1</code>)
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Headless Submission ({submitStep}/3)...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit FSSAI Application Headlessly</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Live Status Sync & Real-Time Approval State */}
        {activeTab === "status" && successResult && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      LIVE APPLICATION
                    </span>
                    <span className="text-xs text-slate-400">
                      Single-Window ID: {successResult.main_application_number}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white font-mono flex items-center gap-2">
                    {successResult.fssai_application_number}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSyncStatus}
                    disabled={syncing}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                    <span>Sync Live Status</span>
                  </button>

                  <a
                    href="http://localhost:8002"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <span>Open Mock FSSAI Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Progress Stage Tracker */}
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 font-mono">Workflow Progression</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { label: "1. Headless Filed", done: true, current: false },
                    { label: "2. Scrutiny Queue", done: true, current: successResult.fssai_status === "SUBMITTED" },
                    { label: "3. Document Review", done: ["UNDER_REVIEW", "INSPECTION_PENDING", "APPROVED"].includes(successResult.fssai_status), current: successResult.fssai_status === "UNDER_REVIEW" },
                    { label: "4. Field Inspection", done: ["APPROVED"].includes(successResult.fssai_status), current: successResult.fssai_status === "INSPECTION_PENDING" },
                    { label: "5. License Decision", done: ["APPROVED", "REJECTED"].includes(successResult.fssai_status), current: ["APPROVED", "REJECTED"].includes(successResult.fssai_status) }
                  ].map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-center font-medium ${
                        step.current
                          ? "bg-blue-950/60 border-blue-500 text-cyan-300 animate-pulse"
                          : step.done
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900/40 border-slate-800 text-slate-500"
                      }`}
                    >
                      <span className="text-[11px] block">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Badge & Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Current Review Status</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {successResult.fssai_status || "SUBMITTED"}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Statutory Documents Uploaded</span>
                  <p className="text-base font-bold text-white">4 / 4 Complete</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Last Synced Timestamp</span>
                  <p className="text-xs font-mono text-slate-300">
                    {successResult.last_synced_at
                      ? new Date(successResult.last_synced_at).toLocaleTimeString()
                      : "Just now"}
                  </p>
                </div>
              </div>

              {/* Scheduled Inspection Card */}
              <div className="p-5 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Field / Premises Inspection Schedule
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                    Food Safety Inspector Desk
                  </span>
                </div>

                {successResult.raw?.inspections && successResult.raw.inspections.length > 0 ? (
                  <div className="space-y-3">
                    {successResult.raw.inspections.map((insp, i) => (
                      <div key={i} className="p-3.5 rounded-lg bg-slate-900/80 border border-indigo-500/20 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            Inspection Scheduled: {insp.scheduled_date} at {insp.scheduled_time || "10:30 AM IST"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            {insp.status || "SCHEDULED"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                          <div>
                            <span className="text-slate-500">Designated Inspector:</span>{" "}
                            <span className="text-slate-200 font-semibold">{insp.inspector_name || "Food Safety Officer"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Contact:</span>{" "}
                            <span className="text-slate-200 font-mono">{insp.inspector_contact || "+91 20 2612 7800"}</span>
                          </div>
                        </div>
                        {insp.notes && (
                          <p className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                            Notes: {insp.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-200">Inspection Queue: In Initial Scrutiny</p>
                      <p className="text-[11px] text-slate-400">
                        Site inspection schedule and assigned Food Safety Officer details will be posted here once document scrutiny is finalized.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-400">
                      Standard SLA: 15 Days
                    </span>
                  </div>
                )}
              </div>

              {/* Officer Remarks & Scrutiny Observations */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-400" />
                    Officer Remarks & Official Scrutiny Log
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Mock FSSAI Scrutiny Desk</span>
                </div>
                <p className="text-xs text-slate-300 italic bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 leading-relaxed">
                  "{successResult.officer_remarks || "Application received and queued for officer scrutiny."}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setActiveTab("form")}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  ← Submit Another Application
                </button>

                <Link
                  to="/applicant"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <span>Return to Main Applicant Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
