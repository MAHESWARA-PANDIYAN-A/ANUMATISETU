import React, { useEffect, useState, useCallback } from "react";
import {
  Building2, Save, Pencil, CheckCircle2, AlertCircle, Loader2,
  Briefcase, MapPin, TrendingUp, Users, Layers, LandPlot, BadgeCheck,
  Plus, X, FileText, ArrowRight, ShieldCheck, Sparkles, Check
} from "lucide-react";
import { fetchMyProfile, createProfile, updateProfile } from "../api/businessProfile";
import { useLanguage } from "../context/LanguageContext";

// ─── Option Lists ─────────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  "Sole Proprietorship", "Partnership Firm", "Limited Liability Partnership (LLP)",
  "Private Limited (Pvt Ltd)", "Public Limited", "One Person Company (OPC)",
  "Section 8 / Non-Profit", "Cooperative Society",
];

const INDUSTRIES = [
  "Food Processing", "Agro-processing", "Manufacturing", "Textile & Garments",
  "Chemical & Pharmaceuticals", "Electronics & IT Hardware", "Automobile & Auto-Components",
  "Construction & Infrastructure", "Renewable Energy & Clean Tech",
  "Tourism & Hospitality", "Retail & E-Commerce", "Logistics & Warehousing",
  "Healthcare & Biotech", "Defense & Aerospace", "Other",
];

const MAHARASHTRA_DISTRICTS = [
  "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara",
  "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli",
  "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban",
  "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar",
  "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara",
  "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal",
];

const PROJECT_STAGES = [
  "Concept / Planning Stage", "DPR Prepared", "Land Identified",
  "Factory Construction", "Machinery Installation", "Pre-Commissioning", "Operational Expansion",
];

const LAND_STATUSES = [
  "Owned", "Leased from Private Party", "Government Allotted / MIDC",
  "Under Acquisition", "Not Yet Identified",
];

const COMMON_APPROVALS = [
  "GST Registration", "MSME / Udyam Registration", "Factory License",
  "Consent to Establish (CTE) – MPCB", "Consent to Operate (CTO) – MPCB",
  "Provisional Fire NOC", "Final Fire NOC", "MIDC Building Plan Approval",
  "FSSAI Manufacturing License", "Industrial Power Sanction (MSEDCL)",
];

const Field = ({ label, error, children, required, hint }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="block text-xs font-bold text-[#1F2A44] uppercase tracking-wide">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[10px] text-[#1F2A44]/60">{hint}</span>}
    </div>
    {children}
    {error && (
      <p className="text-xs text-rose-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3 shrink-0" />{error}
      </p>
    )}
  </div>
);

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl glass-input text-xs sm:text-sm transition-all duration-200 focus:ring-2 focus:ring-[#C6A75E]/40 text-[#1F2A44]";
const selectClass = inputClass + " cursor-pointer";

function validate(form) {
  const errs = {};
  if (!form.company_name?.trim()) errs.company_name = "Business name is required.";
  else if (form.company_name.trim().length < 2) errs.company_name = "Must be at least 2 characters.";
  if (!form.business_type) errs.business_type = "Select an enterprise business type.";
  if (!form.industry) errs.industry = "Select an industry sector.";
  if (!form.district) errs.district = "Select a district.";
  if (!form.investment_amount || isNaN(Number(form.investment_amount)) || Number(form.investment_amount) <= 0)
    errs.investment_amount = "Enter a valid project investment amount in INR.";
  if (!form.employee_count || isNaN(Number(form.employee_count)) || Number(form.employee_count) < 1)
    errs.employee_count = "Employee count must be at least 1.";
  if (!form.project_stage) errs.project_stage = "Select the current project stage.";
  if (!form.land_status) errs.land_status = "Select land ownership status.";
  return errs;
}

// Calculates dynamic completion percentage based on fields filled
function calculateCompletion(form) {
  const fields = [
    { key: "company_name", label: "Business Name" },
    { key: "business_type", label: "Business Type" },
    { key: "industry", label: "Industry" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "investment_amount", label: "Project Investment" },
    { key: "employee_count", label: "Employee Count" },
    { key: "project_stage", label: "Project Stage" },
    { key: "land_status", label: "Land Status" },
  ];

  let completed = 0;
  const missing = [];
  fields.forEach((f) => {
    const val = form[f.key];
    if (val !== "" && val !== null && val !== undefined && !(typeof val === "number" && isNaN(val))) {
      completed += 1;
    } else {
      missing.push(f.label);
    }
  });

  const percentage = Math.round((completed / fields.length) * 100);
  return { percentage, missing };
}

const EMPTY = {
  company_name: "", business_type: "", industry: "",
  state: "Maharashtra", district: "", investment_amount: "",
  employee_count: "", project_stage: "", land_status: "", existing_approvals: [],
};

const BusinessProfilePage = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [customApproval, setCustomApproval] = useState("");

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      if (data) {
        setForm({
          ...data,
          investment_amount: String(data.investment_amount),
          employee_count: String(data.employee_count),
        });
        setEditMode(false);
      } else {
        setEditMode(true);
      }
    } catch {
      showToast("error", "Failed to load your business profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const toggleApproval = (item) => {
    setForm((f) => {
      const list = f.existing_approvals.includes(item)
        ? f.existing_approvals.filter((a) => a !== item)
        : [...f.existing_approvals, item];
      return { ...f, existing_approvals: list };
    });
  };

  const addCustomApproval = () => {
    const trimmed = customApproval.trim();
    if (!trimmed) return;
    setForm((f) => ({
      ...f,
      existing_approvals: f.existing_approvals.includes(trimmed)
        ? f.existing_approvals
        : [...f.existing_approvals, trimmed],
    }));
    setCustomApproval("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        investment_amount: Number(form.investment_amount),
        employee_count: Number(form.employee_count),
      };

      let saved;
      if (profile) {
        saved = await updateProfile(payload);
      } else {
        saved = await createProfile(payload);
      }
      setProfile(saved);
      setForm({
        ...saved,
        investment_amount: String(saved.investment_amount),
        employee_count: String(saved.employee_count),
      });
      setEditMode(false);
      showToast("success", t("profile_saved_toast"));
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || "Failed to save the profile.";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (profile) {
      setForm({
        ...profile,
        investment_amount: String(profile.investment_amount),
        employee_count: String(profile.employee_count),
      });
      setErrors({});
      setEditMode(false);
    }
  };

  const completion = calculateCompletion(form);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-[#C6A75E] animate-spin" />
        <p className="text-sm text-[#1F2A44]/70 font-mono">Loading business profile…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] text-xs font-bold font-mono mb-2">
            <Building2 className="w-3.5 h-3.5 text-[#C6A75E]" />
            <span>{t("nav_my_business")}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44] tracking-tight">{t("profile_view_title")}</h1>
          <p className="text-xs sm:text-sm text-[#1F2A44]/70 mt-1">
            {t("profile_view_sub")}
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs sm:text-sm animate-fade-in ${
          toast.type === "success"
            ? "bg-[#FAF6F0] border-[#C6A75E] text-[#1F2A44]"
            : "bg-[#FAF6F0] border-rose-300 text-rose-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Toggle View or Form */}
      {editMode ? (
        <form id="business-profile-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Section 1: Enterprise Information */}
          <section className="glass-card rounded-2xl p-6 border border-[#E8DCC8] space-y-5 bg-white shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCC8]">
              <Building2 className="w-4 h-4 text-[#1F2A44]" />
              <h3 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("onboard_sec_basics")}</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label={t("onboard_lbl_company_name")} error={errors.company_name} required hint="Registered entity title">
                <input
                  id="company_name"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="e.g. ABC Foods Pvt Ltd"
                  className={inputClass}
                />
              </Field>
              <Field label={t("onboard_lbl_biz_type")} error={errors.business_type} required>
                <select id="business_type" name="business_type" value={form.business_type} onChange={handleChange} className={selectClass}>
                  <option value="">— Select Type —</option>
                  {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label={t("onboard_lbl_industry")} error={errors.industry} required>
                <select id="industry" name="industry" value={form.industry} onChange={handleChange} className={selectClass}>
                  <option value="">— Select Sector —</option>
                  {INDUSTRIES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 2: Location */}
          <section className="glass-card rounded-2xl p-6 border border-[#E8DCC8] space-y-5 bg-white shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCC8]">
              <MapPin className="w-4 h-4 text-[#C6A75E]" />
              <h3 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("onboard_sec_ops")}</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label={t("onboard_lbl_state")} required>
                <input id="state" name="state" value={form.state} onChange={handleChange} className={inputClass} />
              </Field>
              <Field label={t("onboard_lbl_district")} error={errors.district} required>
                <select id="district" name="district" value={form.district} onChange={handleChange} className={selectClass}>
                  <option value="">— Select District —</option>
                  {MAHARASHTRA_DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 3: Project Details & Scale */}
          <section className="glass-card rounded-2xl p-6 border border-[#E8DCC8] space-y-5 bg-white shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCC8]">
              <TrendingUp className="w-4 h-4 text-[#1F2A44]" />
              <h3 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("onboard_sec_scale")}</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label={t("onboard_lbl_investment")} error={errors.investment_amount} required hint="Gross Plant & Machinery (INR)">
                <input
                  id="investment_amount"
                  name="investment_amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.investment_amount}
                  onChange={handleChange}
                  placeholder="e.g. 50000000"
                  className={inputClass}
                />
              </Field>
              <Field label={t("onboard_lbl_workers")} error={errors.employee_count} required hint="Total workforce">
                <input
                  id="employee_count"
                  name="employee_count"
                  type="number"
                  min="1"
                  step="1"
                  value={form.employee_count}
                  onChange={handleChange}
                  placeholder="e.g. 100"
                  className={inputClass}
                />
              </Field>
              <Field label={t("onboard_lbl_project_stage")} error={errors.project_stage} required>
                <select id="project_stage" name="project_stage" value={form.project_stage} onChange={handleChange} className={selectClass}>
                  <option value="">— Select Stage —</option>
                  {PROJECT_STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={t("onboard_lbl_land")} error={errors.land_status} required>
                <select id="land_status" name="land_status" value={form.land_status} onChange={handleChange} className={selectClass}>
                  <option value="">— Select Land Status —</option>
                  {LAND_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 4: Existing Clearances */}
          <section className="glass-card rounded-2xl p-6 border border-[#E8DCC8] space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCC8]">
              <BadgeCheck className="w-4 h-4 text-[#C6A75E]" />
              <h3 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("profile_common_approvals_title")}</h3>
              <span className="text-[11px] text-[#1F2A44]/60 font-normal">({t("profile_common_approvals_sub")})</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {COMMON_APPROVALS.map((item) => {
                const selected = form.existing_approvals.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleApproval(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                      selected
                        ? "bg-[#1F2A44] text-[#FAF6F0] border-[#1F2A44]"
                        : "bg-[#FAF6F0] text-[#1F2A44] border-[#E8DCC8] hover:bg-[#E8DCC8]/40"
                    }`}
                  >
                    {selected && <CheckCircle2 className="inline w-3 h-3 mr-1 text-[#C6A75E]" />}
                    {item}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customApproval}
                onChange={(e) => setCustomApproval(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomApproval(); }}}
                placeholder="Add a custom clearance badge…"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={addCustomApproval}
                className="px-3.5 py-2 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] border border-[#1F2A44] transition-all text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C6A75E]" />
              </button>
            </div>
          </section>

          {/* Form Action Controls */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {profile && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#1F2A44] hover:bg-[#FAF6F0] border border-[#E8DCC8] transition-all cursor-pointer"
              >
                {t("btn_cancel")}
              </button>
            )}
            <button
              id="save-profile-btn"
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] shadow-md shadow-[#1F2A44]/20 disabled:opacity-60 transition-all border border-[#1F2A44] cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-[#C6A75E]" /> : <Save className="w-4 h-4 text-[#C6A75E]" />}
              {saving ? t("onboard_saving") : profile ? t("profile_save_btn") : t("btn_save")}
            </button>
          </div>
        </form>
      ) : profile ? (
        <div className="space-y-6">
          {/* Profile Header Card */}
          <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] relative overflow-hidden bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] text-xs font-bold font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1F2A44]" />
                  {t("status_auto_verified")}
                </div>
                <h2 className="text-2xl font-bold text-[#1F2A44] tracking-tight">{profile.company_name}</h2>
                <p className="text-xs sm:text-sm text-[#1F2A44]/70">
                  {profile.business_type} · {profile.industry}
                </p>
              </div>
              <button
                id="edit-profile-btn"
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] border border-[#1F2A44] transition-all shadow-sm cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-[#C6A75E]" />
                <span>{t("profile_edit_btn")}</span>
              </button>
            </div>
          </div>

          {/* Dynamic Completion Banner */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider font-mono">{t("dash_compliance_score_label")}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8] font-bold">
                  {t("profile_completion_badge", { percent: completion.percentage })}
                </span>
              </div>
              <p className="text-xs text-[#1F2A44]/70">
                {completion.percentage === 100
                  ? "All essential business attributes are complete for one-click application prefilling."
                  : `${t("profile_missing_fields")}: ${completion.missing.join(", ")}`}
              </p>
            </div>
            <div className="w-full sm:w-48 bg-[#FAF6F0] rounded-full h-2.5 overflow-hidden border border-[#E8DCC8]">
              <div
                className="bg-[#C6A75E] h-full rounded-full transition-all duration-500"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </div>

          {/* Structured Details Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: MapPin, label: t("onboard_lbl_district"), value: `${profile.district}, ${profile.state}` },
              { icon: TrendingUp, label: t("onboard_lbl_investment"), value: `₹ ${Number(profile.investment_amount).toLocaleString("en-IN")}` },
              { icon: Users, label: t("onboard_lbl_workers"), value: `${profile.employee_count}` },
              { icon: Layers, label: t("onboard_lbl_project_stage"), value: profile.project_stage },
              { icon: LandPlot, label: t("onboard_lbl_land"), value: profile.land_status },
              { icon: Briefcase, label: t("onboard_lbl_biz_type"), value: profile.business_type },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="glass-card rounded-2xl p-4 sm:p-5 border border-[#E8DCC8] flex items-start gap-3.5 bg-white shadow-xs">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#FAF6F0] border border-[#E8DCC8]">
                  <Icon className="w-4 h-4 text-[#1F2A44]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#1F2A44]/60 uppercase tracking-wider font-mono font-bold">{label}</p>
                  <p className="text-sm font-bold text-[#1F2A44] mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Existing Clearances Section */}
          {profile.existing_approvals?.length > 0 && (
            <div className="glass-card rounded-2xl p-5 border border-[#E8DCC8] space-y-3 bg-white shadow-xs">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-[#C6A75E]" />
                <h3 className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("profile_common_approvals_title")}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.existing_approvals.map((a) => (
                  <span key={a} className="px-3 py-1 text-xs rounded-full bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] font-semibold">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default BusinessProfilePage;
