import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Receipt,
  Award,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  Layers,
  Clock,
  HelpCircle,
  FileCheck2,
  AlertCircle
} from "lucide-react";
import { getRequirementRecommendations, saveApprovalSelections } from "../api/requirements";
import { fetchMyProfile } from "../api/businessProfile";
import { useTaskerAssistant } from "../context/AssistantContext";
import { useLanguage } from "../context/LanguageContext";

export default function ApprovalRecommendationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { explainApproval } = useTaskerAssistant();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [recommendations, setRecommendations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedMap, setSelectedMap] = useState({});
  const [expandedReasons, setExpandedReasons] = useState({});

  useEffect(() => {
    loadRecommendationsData();
  }, []);

  const loadRecommendationsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [recRes, profRes] = await Promise.all([
        getRequirementRecommendations(),
        fetchMyProfile().catch(() => null)
      ]);

      const recs = recRes.recommendations || [];
      setRecommendations(recs);
      setProfile(profRes);

      // Leave checkboxes unselected by default for manual applicant selection
      setSelectedMap({});
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setError("Unable to load approval recommendations. Showing default statutory options.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (approvalId) => {
    setSelectedMap((prev) => ({
      ...prev,
      [approvalId]: !prev[approvalId]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = {};
    recommendations.forEach((r) => {
      allSelected[r.approval_id] = true;
    });
    setSelectedMap(allSelected);
  };

  const handleClearAll = () => {
    setSelectedMap({});
  };

  const toggleReason = (approvalId) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [approvalId]: !prev[approvalId]
    }));
  };

  const selectedCount = Object.values(selectedMap).filter(Boolean).length;

  const handleContinue = async () => {
    const selectedList = Object.entries(selectedMap)
      .filter(([_, isSel]) => isSel)
      .map(([id]) => id);

    if (selectedList.length === 0) {
      setError("Please select at least one approval workflow to continue.");
      return;
    }

    try {
      setSaving(true);
      await saveApprovalSelections(selectedList);

      // Navigate to the Unified Form
      navigate("/applications/new", {
        state: { selected_approvals: selectedList }
      });
    } catch (err) {
      console.error("Failed to save approval selections:", err);
      setError("Failed to save your selections. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getApprovalIcon = (approvalId) => {
    switch (approvalId) {
      case "FSSAI":
        return <ShieldCheck className="w-6 h-6 text-[#1F2A44]" />;
      case "GST":
        return <Receipt className="w-6 h-6 text-[#C6A75E]" />;
      case "UDYAM":
        return <Award className="w-6 h-6 text-[#1F2A44]" />;
      default:
        return <Sparkles className="w-6 h-6 text-[#C6A75E]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2 border-b border-[#E8DCC8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
            {t("rec_step_badge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F2A44] tracking-tight">
            {t("rec_title")}
          </h1>
          <p className="text-sm text-[#1F2A44]/70 max-w-2xl mx-auto">
            {t("rec_subtitle", { 
              industry: profile?.industry || "Food Processing", 
              location: `${profile?.district || "Salem"}, ${profile?.state || "Tamil Nadu"}` 
            })}
          </p>
        </div>

        {/* Change Business Info Banner */}
        <div className="p-4 rounded-2xl bg-white border border-[#E8DCC8] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[#1F2A44]">
            <Building2 className="w-4 h-4 text-[#C6A75E]" />
            <span>{t("rec_evaluating_for")} <strong className="text-[#1F2A44] font-bold">{profile?.company_name || "ABC Foods Private Limited"}</strong> ({profile?.business_activity || "Food Manufacturing"})</span>
          </div>
          <Link
            to="/onboarding/business"
            className="text-[#1F2A44] hover:text-[#C6A75E] font-bold underline shrink-0 transition-colors"
          >
            {t("dash_update_info")}
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-rose-300 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Recommended Approvals List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#1F2A44]/70 px-1">
            <span className="font-bold uppercase tracking-wider text-[#1F2A44]">
              {t("rec_applicable_count", { count: selectedCount })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF6F0] border border-[#E8DCC8] text-[11px] font-semibold text-[#1F2A44] transition cursor-pointer"
              >
                {t("btn_select_all")}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF6F0] border border-[#E8DCC8] text-[11px] font-semibold text-[#1F2A44]/70 transition cursor-pointer"
              >
                {t("btn_clear_all")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recommendations.map((rec) => {
              const isSelected = Boolean(selectedMap[rec.approval_id]);
              const isExpanded = Boolean(expandedReasons[rec.approval_id]);

              return (
                <div
                  key={rec.approval_id}
                  className={`p-6 rounded-3xl border transition-all duration-200 ${
                    isSelected
                      ? "bg-white border-[#C6A75E] shadow-md ring-2 ring-[#C6A75E]/30"
                      : "bg-white/80 border-[#E8DCC8] opacity-80 hover:opacity-100 shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    
                    {/* Custom Styled Checkbox */}
                    <div className="pt-1 shrink-0">
                      <input
                        type="checkbox"
                        id={`rec-${rec.approval_id}`}
                        checked={isSelected}
                        onChange={() => toggleSelection(rec.approval_id)}
                        className="w-5 h-5 rounded-lg text-[#1F2A44] bg-white border-[#E8DCC8] focus:ring-[#C6A75E] cursor-pointer accent-[#1F2A44]"
                      />
                    </div>

                    {/* Icon */}
                    <div className="p-3 rounded-2xl bg-[#FAF6F0] border border-[#E8DCC8] shrink-0">
                      {getApprovalIcon(rec.approval_id)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <label
                            htmlFor={`rec-${rec.approval_id}`}
                            className="text-base font-bold text-[#1F2A44] hover:text-[#C6A75E] cursor-pointer flex items-center gap-2 transition-colors"
                          >
                            {rec.approval_name}
                          </label>
                          <p className="text-xs text-[#1F2A44]/60">{rec.department}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono bg-[#FAF6F0] text-[#1F2A44] border-[#E8DCC8]">
                            {rec.category}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] font-mono">
                            {t("rec_sla_days", { days: rec.sla_days })}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#1F2A44]/75 leading-relaxed">
                        {rec.reason}
                      </p>

                      {/* Expandable "Why is this recommended?" */}
                      <div className="pt-2 border-t border-[#E8DCC8]">
                        <button
                          type="button"
                          onClick={() => toggleReason(rec.approval_id)}
                          className="text-[11px] font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1 transition cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-[#C6A75E]" />
                          <span>{t("btn_why_recommended")}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] text-xs text-[#1F2A44] space-y-2">
                            <p><strong className="text-[#1F2A44] font-bold">{t("rec_eval_basis")}</strong> {rec.confidence_or_basis || "Statutory Rule Assessment"}</p>
                            <p><strong className="text-[#1F2A44] font-bold">{t("rec_single_vault_val")}</strong> {t("rec_single_vault_val_desc")}</p>
                            <p className="text-[10px] text-[#1F2A44]/60 font-mono">{t("rec_rule_verification", { date: rec.last_verified_date || "2026-09-28" })}</p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => explainApproval(rec.approval_id, rec.approval_name)}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
                                <span>{t("btn_ask_assistant")}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-[#1F2A44]">
              {t("rec_selection_summary", { count: selectedCount })}
            </h4>
            <p className="text-xs text-[#1F2A44]/70">
              {t("rec_dedup_note")}
            </p>
          </div>

          <button
            onClick={handleContinue}
            disabled={saving || selectedCount === 0}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-lg shadow-[#1F2A44]/20 flex items-center justify-center gap-2.5 transition transform active:scale-95 disabled:opacity-50 cursor-pointer border border-[#1F2A44]"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-[#C6A75E] rounded-full animate-spin" />
                <span>{t("rec_btn_preparing")}</span>
              </>
            ) : (
              <>
                <span>{t("rec_btn_continue")}</span>
                <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
