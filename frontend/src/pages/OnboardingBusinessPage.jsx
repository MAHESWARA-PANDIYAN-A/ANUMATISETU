import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  Building2,
  MapPin,
  TrendingUp,
  FileCheck2,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { fetchMyProfile, saveBusinessProfile } from "../api/businessProfile";

// Dynamic Business Activities mapped strictly to Industry / Sector
const INDUSTRY_ACTIVITIES = {
  "Food & Food Processing": [
    "Food Manufacturing & Packaged Snacks",
    "Agro-Processing & Grains",
    "Bakery & Confectionery",
    "Dairy Processing & Packaged Milk",
    "Beverage & Edible Oil Manufacturing",
    "Restaurant & Food Service",
    "Catering Operations",
    "Cold Storage & Food Warehousing",
    "Food Retail & Distribution",
    "Other Food Business"
  ],
  "Manufacturing": [
    "Textiles & Garment Manufacturing",
    "Engineering & Heavy Fabrication",
    "Chemicals & Industrial Formulations",
    "Plastic & Polymer Products",
    "Automobile & Auto Ancillary Parts",
    "Electronics & Electrical Equipment",
    "Packaging Material Manufacturing",
    "Other Manufacturing"
  ],
  "Textiles": [
    "Spinning & Weaving Mill",
    "Garment & Apparel Manufacturing",
    "Dyeing & Textile Processing",
    "Technical Textiles",
    "Fabric Distribution & Wholesale"
  ],
  "IT / Software": [
    "Software Product & SaaS Development",
    "IT Consulting & Cloud Services",
    "Data Center & Infrastructure Operations",
    "IT Enabled Services (ITES / BPO)",
    "Cybersecurity & FinTech Services"
  ],
  "Retail": [
    "Supermarket & Retail Department Store",
    "Specialty Goods Retail",
    "Wholesale Distribution Center",
    "E-Commerce Fulfillment Hub"
  ],
  "Healthcare": [
    "Pharmaceutical Manufacturing",
    "Medical Devices & Diagnostic Kits",
    "Hospital & Clinical Establishment",
    "Ayurvedic & Herbal Formulations"
  ],
  "Hospitality": [
    "Hotel & Resort Operations",
    "Restaurant & Fine Dining",
    "Convention Center & Event Venue"
  ],
  "Logistics": [
    "Warehousing & Cold Chain Storage",
    "Freight Forwarding & Transport Terminal",
    "Container Freight Station (CFS)"
  ],
  "Other": [
    "General Commercial Enterprise",
    "Service Provision Unit",
    "Agri-Business Enterprise"
  ]
};

const INDIAN_STATES = [
  "Tamil Nadu",
  "Maharashtra",
  "Karnataka",
  "Gujarat",
  "Telangana",
  "Uttar Pradesh",
  "Rajasthan",
  "Delhi",
  "Haryana",
  "Kerala",
  "West Bengal",
  "Madhya Pradesh",
  "Andhra Pradesh",
  "Punjab"
];

export default function OnboardingBusinessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    company_name: "ABC Foods Private Limited",
    business_type: "Private Limited Company",
    organization_type: "PRIVATE_LIMITED",
    industry: "Food & Food Processing",
    business_activity: "Food Manufacturing & Packaged Snacks",
    state: "Tamil Nadu",
    district: "Salem",
    pincode: "636001",
    address: "Plot 12, SIDCO Industrial Estate, Salem",
    investment_amount: 500, // In Lakhs (₹5 Crore)
    expected_turnover: 2000, // In Lakhs (₹20 Crore)
    employee_count: 100,
    project_stage: "New Business",
    land_status: "Rented",
    premises_type: "Industrial Estate",
    expected_start_date: "2026-11-01",
    pan: "ABCDE1234F",
    gstin: "",
    udyam: ""
  });

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    try {
      setLoading(true);
      const profile = await fetchMyProfile();
      if (profile && profile.company_name) {
        setIsEditMode(true);
        setFormData((prev) => ({
          ...prev,
          company_name: profile.company_name || prev.company_name,
          business_type: profile.business_type || prev.business_type,
          organization_type: profile.organization_type || prev.organization_type,
          industry: profile.industry || prev.industry,
          business_activity: profile.business_activity || prev.business_activity,
          state: profile.state || prev.state,
          district: profile.district || prev.district,
          pincode: profile.pincode || prev.pincode,
          address: profile.address || prev.address,
          investment_amount: profile.investment_amount || prev.investment_amount,
          expected_turnover: profile.expected_turnover || prev.expected_turnover,
          employee_count: profile.employee_count || prev.employee_count,
          project_stage: profile.project_stage || prev.project_stage,
          land_status: profile.land_status || prev.land_status,
          premises_type: profile.premises_type || prev.premises_type,
          expected_start_date: profile.expected_start_date || prev.expected_start_date,
          pan: profile.existing_registrations?.pan || prev.pan,
          gstin: profile.existing_registrations?.gstin || "",
          udyam: profile.existing_registrations?.udyam || ""
        }));
      }
    } catch (e) {
      console.log("No previous profile found; initiating clean setup flow.");
    } finally {
      setLoading(false);
    }
  };

  const handleIndustryChange = (newIndustry) => {
    const activities = INDUSTRY_ACTIVITIES[newIndustry] || INDUSTRY_ACTIVITIES["Other"];
    setFormData((prev) => ({
      ...prev,
      industry: newIndustry,
      business_activity: activities[0] || "General Activity"
    }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const payload = {
        company_name: formData.company_name.trim(),
        business_type: formData.business_type,
        organization_type: formData.business_type.toLowerCase().includes("private")
          ? "PRIVATE_LIMITED"
          : formData.business_type.toLowerCase().includes("llp")
          ? "LLP"
          : "PROPRIETORSHIP",
        industry: formData.industry,
        business_activity: formData.business_activity,
        state: formData.state,
        district: formData.district,
        pincode: formData.pincode,
        address: formData.address,
        investment_amount: Number(formData.investment_amount),
        expected_turnover: Number(formData.expected_turnover),
        employee_count: Number(formData.employee_count),
        project_stage: formData.project_stage,
        land_status: formData.land_status,
        premises_type: formData.premises_type,
        expected_start_date: formData.expected_start_date,
        existing_registrations: {
          pan: formData.pan.toUpperCase(),
          gstin: formData.gstin.toUpperCase(),
          udyam: formData.udyam.toUpperCase()
        },
        existing_approvals: []
      };

      await saveBusinessProfile(payload);

      // Transition immediately to requirements analysis screen
      navigate("/requirements/analyzing", {
        state: {
          industry: formData.industry,
          company_name: formData.company_name,
          business_activity: formData.business_activity,
          state: formData.state,
          district: formData.district
        }
      });
    } catch (err) {
      console.error("Save business profile error:", err);
      setError(err.response?.data?.detail || "Failed to save business information. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const availableActivities = INDUSTRY_ACTIVITIES[formData.industry] || INDUSTRY_ACTIVITIES["Other"];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Welcome Header */}
        <div className="text-center space-y-2 border-b border-[#E8DCC8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
            {t('onboard_step1_badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F2A44] tracking-tight">
            {t('onboard_title')}
          </h1>
          <p className="text-sm text-[#1F2A44]/70 max-w-xl mx-auto">
            {t('onboard_subtitle')}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-rose-300 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: Business Basics */}
          <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#E8DCC8] pb-3">
              <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8]">
                <Building2 className="w-5 h-5 text-[#C6A75E]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1F2A44]">{t('onboard_sec_basics')}</h3>
                <p className="text-xs text-[#1F2A44]/60">{t('onboard_sec_basics_sub')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_company_name')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  placeholder="e.g. ABC Foods Private Limited"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-medium focus:ring-2 focus:ring-[#C6A75E]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_biz_type')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.business_type}
                  onChange={(e) => handleChange("business_type", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                >
                  <option value="Private Limited Company">Private Limited Company</option>
                  <option value="Public Limited Company">Public Limited Company</option>
                  <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                  <option value="Proprietorship">Proprietorship</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_industry')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleIndustryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-bold text-[#1F2A44]"
                >
                  {Object.keys(INDUSTRY_ACTIVITIES).map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5 flex items-center justify-between">
                  <span>{t('onboard_lbl_activity')} <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-[#C6A75E] font-bold">{t('onboard_lbl_activity_filtered', { industry: formData.industry })}</span>
                </label>
                <select
                  value={formData.business_activity}
                  onChange={(e) => handleChange("business_activity", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-medium"
                >
                  {availableActivities.map((act) => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Business Location */}
          <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#E8DCC8] pb-3">
              <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8]">
                <MapPin className="w-5 h-5 text-[#C6A75E]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1F2A44]">{t('onboard_sec_ops')}</h3>
                <p className="text-xs text-[#1F2A44]/60">{t('onboard_sec_ops_sub')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_state')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_district')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.district}
                  onChange={(e) => handleChange("district", e.target.value)}
                  placeholder="e.g. Salem"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_pincode')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern="^[1-9][0-9]{5}$"
                  value={formData.pincode}
                  onChange={(e) => handleChange("pincode", e.target.value)}
                  placeholder="636001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-mono"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_address')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="e.g. Plot 12, SIDCO Industrial Estate, Salem"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Business Scale & Operational Status */}
          <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#E8DCC8] pb-3">
              <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8]">
                <TrendingUp className="w-5 h-5 text-[#C6A75E]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1F2A44]">{t('onboard_sec_scale')}</h3>
                <p className="text-xs text-[#1F2A44]/60">{t('onboard_sec_scale_sub')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_investment')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-[#1F2A44]/50 font-mono">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.investment_amount}
                    onChange={(e) => handleChange("investment_amount", e.target.value)}
                    placeholder="500"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-[#1F2A44]/60 mt-1 block">
                  {t('onboard_lbl_investment_hint', { amount: formData.investment_amount || 0, cr: ((Number(formData.investment_amount) || 0) / 100).toFixed(2) })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_turnover')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-[#1F2A44]/50 font-mono">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.expected_turnover}
                    onChange={(e) => handleChange("expected_turnover", e.target.value)}
                    placeholder="2000"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-[#1F2A44]/60 mt-1 block">
                  {t('onboard_lbl_investment_hint', { amount: formData.expected_turnover || 0, cr: ((Number(formData.expected_turnover) || 0) / 100).toFixed(2) })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_workers')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.employee_count}
                  onChange={(e) => handleChange("employee_count", e.target.value)}
                  placeholder="100"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_project_stage')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.project_stage}
                  onChange={(e) => handleChange("project_stage", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                >
                  <option value="New Business">{t('onboard_stage_new')}</option>
                  <option value="Existing Business">{t('onboard_stage_existing')}</option>
                  <option value="Expansion">{t('onboard_stage_expansion')}</option>
                  <option value="Modification">{t('onboard_stage_mod')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_land')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.land_status}
                  onChange={(e) => handleChange("land_status", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E]"
                >
                  <option value="Rented">{t('onboard_land_rented')}</option>
                  <option value="Owned">{t('onboard_land_owned')}</option>
                  <option value="Leased">{t('onboard_land_leased')}</option>
                  <option value="Consent">{t('onboard_land_consent')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2A44] mb-1.5">
                  {t('onboard_lbl_pan')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                  value={formData.pan}
                  onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8DCC8] text-[#1F2A44] text-sm focus:outline-none focus:border-[#C6A75E] uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate("/applicant")}
              className="px-5 py-3 rounded-2xl bg-white hover:bg-[#FAF6F0] text-[#1F2A44] text-xs font-bold border border-[#E8DCC8] shadow-xs transition"
            >
              {t('onboard_btn_complete_later')}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-md shadow-[#1F2A44]/20 flex items-center gap-2.5 transition transform active:scale-95 disabled:opacity-50 cursor-pointer border border-[#1F2A44]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-[#C6A75E] rounded-full animate-spin" />
                  {t('onboard_saving')}
                </>
              ) : (
                <>
                  <span>{t('onboard_btn_save')}</span>
                  <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
