import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  ShieldCheck,
  Receipt,
  Award,
  Sparkles,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  FileText,
  FileCheck,
  FileCheck2,
  HelpCircle,
  BarChart3,
  Search,
  Check,
  ChevronRight,
  Zap,
  Calendar,
  Layers,
  MapPin,
  TrendingUp,
  Compass,
} from "lucide-react";
import { fetchMyProfile } from "../api/businessProfile";
import { getDashboardMyApprovals, getOnboardingStatus, simulateApprovalStatus } from "../api/requirements";
import { syncAllFssai } from "../api/fssai";
import { syncAllUdyam } from "../api/udyam";
import { syncAllGst } from "../api/gst";
import { getApplicantMetrics } from "../api/applications";
import { fetchMyDocuments } from "../api/documents";
import { useTaskerAssistant } from "../context/AssistantContext";
import { useLanguage } from "../context/LanguageContext";
import { getNextAction } from "../api/assistant";
import { 
  getApprovalPlan, 
  getCoverageOverview, 
  getComplianceDashboard, 
  getApplicationDelayAnalysis 
} from "../api/approvals";
import DelayExplanationModal from "../components/approvals/DelayExplanationModal";

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openAssistant, explainApplication } = useTaskerAssistant();
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [nextAction, setNextAction] = useState(null);

  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    approvals: [],
    has_profile: false,
    total_active_approvals: 0
  });
  const [metrics, setMetrics] = useState({});
  const [docSummary, setDocSummary] = useState({ total: 0, ready: 0, needsAttention: 0 });
  
  // Approval Intelligence State
  const [planSummary, setPlanSummary] = useState(null);
  const [coverageSummary, setCoverageSummary] = useState(null);
  const [complianceSummary, setComplianceSummary] = useState(null);
  const [delayModalData, setDelayModalData] = useState(null);
  const [delayModalOpen, setDelayModalOpen] = useState(false);

  useEffect(() => {
    loadCleanDashboard();
  }, []);

  const loadCleanDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch all core and approval intelligence data immediately in parallel
      const [
        profRes, 
        dashRes, 
        metRes, 
        docsRes, 
        nextActRes,
        planRes,
        covRes,
        compRes
      ] = await Promise.all([
        fetchMyProfile().catch(() => null),
        getDashboardMyApprovals().catch(() => ({ approvals: [], has_profile: false })),
        getApplicantMetrics().catch(() => ({})),
        fetchMyDocuments().catch(() => ({ items: [] })),
        getNextAction().catch(() => null),
        getApprovalPlan().catch(() => null),
        getCoverageOverview().catch(() => null),
        getComplianceDashboard().catch(() => null)
      ]);

      // If user has never set up business profile, guide them to onboarding
      if (!profRes || !profRes.company_name) {
        navigate("/onboarding/business");
        return;
      }

      const docItems = Array.isArray(docsRes) ? docsRes : (docsRes?.items || []);
      const readyCount = docItems.filter((d) => d.validation_status === "VALID" || d.validation_status === "READY").length;
      const attentionCount = docItems.filter((d) => d.validation_status === "WARNING" || d.validation_status === "INVALID" || d.validation_status === "FAILED").length;

      setProfile(profRes);
      setDashboardData(dashRes);
      setMetrics(metRes || {});
      setDocSummary({ total: docItems.length, ready: readyCount, needsAttention: attentionCount });
      setNextAction(nextActRes);
      setPlanSummary(planRes);
      setCoverageSummary(covRes);
      setComplianceSummary(compRes);

      // 2. Trigger non-blocking background sync with external mock portals (FSSAI, Udyam, GST)
      Promise.all([
        syncAllFssai().catch(() => null),
        syncAllUdyam().catch(() => null),
        syncAllGst().catch(() => null)
      ]).then(() => {
        // Silently refresh approval statuses once external sync completes
        getDashboardMyApprovals().then((freshDash) => {
          if (freshDash) setDashboardData(freshDash);
        }).catch(() => null);
      }).catch(() => null);

    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Failed to load dashboard data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDelayModal = async (app) => {
    try {
      const diag = await getApplicationDelayAnalysis(app.id || 1);
      setDelayModalData(diag);
      setDelayModalOpen(true);
    } catch (err) {
      openAssistant({
        page: 'dashboard',
        approval_id: app.approval_id,
        message: `Why is my ${app.approval_id} application delayed?`
      });
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      await Promise.all([
        syncAllFssai().catch(() => null),
        syncAllUdyam().catch(() => null),
        syncAllGst().catch(() => null)
      ]);
      const dashRes = await getDashboardMyApprovals();
      setDashboardData(dashRes);
    } catch (err) {
      console.error("Status sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const [selectedModalApp, setSelectedModalApp] = useState(null);
  const [simulatingId, setSimulatingId] = useState(null);

  const handleSimulateStatus = async (approvalId, targetStatus) => {
    try {
      setSimulatingId(approvalId);
      await simulateApprovalStatus(approvalId, targetStatus);
      const dashRes = await getDashboardMyApprovals();
      setDashboardData(dashRes);
      if (selectedModalApp && selectedModalApp.approval_id === approvalId) {
        const updated = (dashRes.approvals || []).find((a) => a.approval_id === approvalId);
        if (updated) setSelectedModalApp(updated);
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulatingId(null);
    }
  };

  const getApprovalIcon = (approvalId) => {
    switch (approvalId) {
      case "FSSAI":
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case "GST":
        return <Receipt className="w-5 h-5 text-teal-400" />;
      case "UDYAM":
        return <Award className="w-5 h-5 text-amber-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || "").toUpperCase();
    switch (s) {
      case "APPROVED":
      case "ISSUED":
      case "REGISTERED":
      case "ACTIVE":
      case "LICENSE_ISSUED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#C6A75E]" />
            {t("status_approved")}
          </span>
        );
      case "UNDER_REVIEW":
      case "UNDER_SCRUTINY":
      case "UNDER_VERIFICATION":
      case "IN_PROGRESS":
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#1F2A44] border border-[#C6A75E]">
            <Clock className="w-3.5 h-3.5 text-[#C6A75E] animate-spin" />
            {t("status_under_review")}
          </span>
        );
      case "DOCUMENT_QUERY":
      case "NEEDS_INFORMATION":
      case "CORRECTION_REQUIRED":
      case "NEEDS_CORRECTION":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#1F2A44] border border-[#C6A75E]">
            <AlertCircle className="w-3.5 h-3.5 text-[#C6A75E]" />
            {t("status_document_query")}
          </span>
        );
      case "SUBMITTED":
      case "APPLIED":
      case "LODGED":
      case "FILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E8DCC8]/60 text-[#1F2A44] border border-[#D6C4A8]">
            <Check className="w-3.5 h-3.5 text-[#1F2A44]" />
            {t("status_submitted")}
          </span>
        );
      case "NOT_STARTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#1F2A44]/80 border border-[#E8DCC8]">
            <Clock className="w-3.5 h-3.5 text-[#1F2A44]/60" />
            {t("card_not_started")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#1F2A44]/80 border border-[#E8DCC8]">
            <Clock className="w-3.5 h-3.5 text-[#1F2A44]/60" />
            {status || t("status_selected")}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#1F2A44] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#1F2A44]/70">Loading your business approval control center...</p>
        </div>
      </div>
    );
  }

  const rawApprovals = dashboardData.approvals || [];
  const activeApprovals = rawApprovals.map((app) => {
    const isApp = app.status === "APPROVED" || Boolean(app.registration_ref);
    let resolvedStatus = app.status;
    if (isApp) {
      resolvedStatus = "APPROVED";
    } else if (app.application_number && (!app.status || app.status === "NOT_STARTED" || app.status === "SELECTED" || app.status === "DRAFT")) {
      resolvedStatus = "SUBMITTED";
    }
    return {
      ...app,
      status: resolvedStatus
    };
  });
  const hasActiveApprovals = activeApprovals.length > 0;
  const approvedCount = activeApprovals.filter((a) => a.status === "APPROVED" || a.registration_ref).length;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 1. TOP GREETING & HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8DCC8] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#1F2A44] uppercase tracking-wider">
                {t("dash_single_window")}
              </span>
              <span className="text-[#C6A75E]">•</span>
              <span className="text-xs text-[#1F2A44]/70">{t("brand_subtitle")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44] tracking-tight">
              {t("dash_greeting", { name: user?.full_name?.split(" ")[0] || "Rahul" })}
            </h1>
            <p className="text-xs sm:text-sm text-[#1F2A44]/80">
              {t("dash_subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] shadow-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C6A75E] ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? t("dash_syncing") : t("dash_sync_all")}</span>
            </button>

            <Link
              to="/requirements"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] flex items-center gap-1.5 transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#C6A75E]" />
              <span>{t("dash_add_approval")}</span>
            </Link>
          </div>
        </div>

        {/* AI NEXT ACTION GUIDANCE BANNER */}
        <div className="p-5 rounded-3xl bg-white border border-[#E8DCC8] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-[#1F2A44] text-[#FAF6F0] shrink-0">
              <Sparkles className="w-5 h-5 text-[#C6A75E]" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1F2A44]">
                  {t("dash_ai_guidance")}
                </span>
                {nextAction?.priority && nextAction.priority !== 'none' ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    nextAction.priority === 'urgent'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]'
                  }`}>
                    {nextAction.priority.toUpperCase()} ACTION
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
                    {t("dash_all_caught_up")}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#1F2A44]">
                {nextAction?.title || "Your business applications and vault are up to date."}
              </h3>
              <p className="text-xs text-[#1F2A44]/75 max-w-2xl leading-relaxed">
                {nextAction?.description || "All required documents are pre-validated and no pending officer queries require your attention."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {nextAction?.route && (
              <Link
                to={nextAction.route}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] transition flex items-center gap-1.5 shadow-xs"
              >
                <span>{nextAction.action_label || "Take Action"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
              </Link>
            )}
            <button
              onClick={() => openAssistant({
                page: 'dashboard',
                approval_id: nextAction?.approval_id || null,
                document_id: nextAction?.document_id || null,
                message: nextAction?.title ? `What should I do about: ${nextAction.title}?` : "What is the status of my business approvals?"
              })}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Open personalized AI assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
              <span>{t("dash_ask_ai")}</span>
            </button>
          </div>
        </div>

        {/* 2. BUSINESS PROFILE SUMMARY BANNER */}
        <div className="p-5 rounded-3xl bg-white border border-[#E8DCC8] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8] shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#1F2A44]">
                  {profile?.company_name || "Enterprise Entity"}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
                  {t("dash_profile_complete")}
                </span>
                {approvedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E8DCC8]/70 text-[#1F2A44] border border-[#D6C4A8]">
                    {t("dash_issued_count", { approved: approvedCount, total: activeApprovals.length })}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#1F2A44]/70 flex flex-wrap items-center gap-2">
                <span className="font-medium">{profile?.industry || "Food Processing"}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#C6A75E]" />
                  {profile?.district || "Salem"}, {profile?.state || "Tamil Nadu"}
                </span>
                <span>•</span>
                <span>{profile?.business_activity || "Manufacturing"}</span>
              </p>
            </div>
          </div>

          <Link
            to="/onboarding/business"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition text-center shrink-0"
          >
            {t("dash_update_info")}
          </Link>
        </div>

        {/* 3. CORE APPROVAL INTELLIGENCE ROW: PLAN, COVERAGE & COMPLIANCE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* A. Approval Plan Card */}
          <div className="bg-white rounded-3xl p-5 border border-[#E8DCC8] shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F2A44] font-mono flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t("dash_plan_title")}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8DCC8] text-[#1F2A44]">
                  {planSummary?.total || activeApprovals.length} Workflows
                </span>
              </div>
              
              <div className="space-y-2 mt-3">
                {planSummary?.items?.slice(0, 3).map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8]/70 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-[#1F2A44] text-[#E8DCC8] font-bold text-[10px] flex items-center justify-center">
                        {String(it.sequence).padStart(2, '0')}
                      </span>
                      <span className="font-bold text-slate-900">{it.approval_id}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      it.current_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      (it.priority_label === 'Start First' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800')
                    }`}>
                      {it.current_status === 'APPROVED' ? t('status_approved') : it.priority_label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/approvals"
              className="w-full py-2 bg-[#1F2A44] hover:bg-[#141C2E] text-[#E8DCC8] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>{t("dash_plan_btn")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
            </Link>
          </div>

          {/* B. Approval Coverage Card */}
          <div className="bg-white rounded-3xl p-5 border border-[#E8DCC8] shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F2A44] font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t("dash_coverage_title")}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {t("dash_coverage_sub")}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-lg font-extrabold text-emerald-800 block">
                    {coverageSummary?.summary?.online_count || 2}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700">{t("cov_stat_digital")}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-lg font-extrabold text-amber-800 block">
                    {coverageSummary?.summary?.hybrid_count || 1}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700">{t("cov_stat_hybrid")}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-lg font-extrabold text-rose-800 block">
                    {coverageSummary?.summary?.external_count || 1}
                  </span>
                  <span className="text-[10px] font-bold text-rose-700">{t("cov_stat_external")}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                {t("dash_coverage_desc")}
              </p>
            </div>

            <Link
              to="/coverage"
              className="w-full py-2 bg-white hover:bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>{t("dash_coverage_btn")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
            </Link>
          </div>

          {/* C. Compliance & Renewals Card */}
          <div className="bg-white rounded-3xl p-5 border border-[#E8DCC8] shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F2A44] font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t("dash_compliance_title")}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {t("status_approved")}
                </span>
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                  <span className="font-medium text-emerald-900">{t("status_approved")}</span>
                  <span className="font-extrabold text-emerald-800 font-mono">
                    {complianceSummary?.summary?.active_approvals_count || approvedCount || 2} Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <span className="font-medium text-amber-900">{t("status_renewal_approaching")}</span>
                  <span className="font-extrabold text-amber-800 font-mono">
                    {complianceSummary?.summary?.renewals_approaching_count || 1} Due
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                {t("dash_compliance_desc")}
              </p>
            </div>

            <Link
              to="/compliance"
              className="w-full py-2 bg-white hover:bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>{t("dash_compliance_btn")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
            </Link>
          </div>
        </div>

        {/* 4. DOCUMENT VAULT & REUSE BANNER */}
        <div className="p-5 rounded-3xl bg-[#FAF6F0] border border-[#E8DCC8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#1F2A44] text-[#FAF6F0] shadow-sm shrink-0">
              <FileCheck className="w-5 h-5 text-[#C6A75E]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#1F2A44]">{t("dash_doc_vault_title")}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
                  {t("dash_doc_avail", { count: docSummary.ready })}
                </span>
                {docSummary.needsAttention > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#FAF6F0] text-[#1F2A44] border border-[#C6A75E]">
                    {t("dash_doc_need_att", { count: docSummary.needsAttention })}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white text-[#1F2A44] border border-[#E8DCC8]">
                  {t("dash_doc_upload_once")}
                </span>
              </div>
              <p className="text-xs text-[#1F2A44]/70 mt-0.5">
                {t("dash_doc_vault_desc")}
              </p>
            </div>
          </div>

          <Link
            to="/documents"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] shadow-xs transition flex items-center gap-1.5 shrink-0"
          >
            <span>{t("dash_doc_vault_btn")}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#1F2A44]/60" />
          </Link>
        </div>

        {/* 5. MY APPROVALS (SHOWS ONLY RELEVANT USER APPROVALS) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1F2A44] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#C6A75E]" />
                <span>{t("dash_my_active_appr", { count: activeApprovals.length })}</span>
              </h2>
              <p className="text-xs text-[#1F2A44]/70">
                {t("dash_my_active_sub")}
              </p>
            </div>

            {hasActiveApprovals && (
              <Link
                to="/requirements"
                className="text-xs font-semibold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1"
              >
                <span>{t("dash_add_more_approvals")}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {hasActiveApprovals ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {activeApprovals.map((app) => {
                const isApproved = app.status === "APPROVED" || Boolean(app.registration_ref);

                return (
                  <div
                    key={app.approval_id}
                    className={`p-5 rounded-3xl border space-y-4 shadow-sm flex flex-col justify-between transition relative overflow-hidden ${
                      isApproved
                        ? "bg-white border-emerald-300 shadow-emerald-500/5 hover:shadow-md"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                    }`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-2xl border ${
                          isApproved ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}>
                          {getApprovalIcon(app.approval_id)}
                        </div>
                        {getStatusBadge(isApproved ? "APPROVED" : app.status)}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{app.title}</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">{app.department}</p>
                      </div>

                      {/* APPROVED STATE DISPLAY */}
                      {isApproved ? (
                        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-mono font-bold text-emerald-700">
                              {app.approval_id === "UDYAM" ? t("dash_udyam_number") : app.approval_id === "GST" ? t("dash_gstin") : t("dash_license_number")}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              {t("status_active")}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-extrabold text-emerald-800 block tracking-wider">
                            {app.registration_ref || "CERTIFIED"}
                          </span>
                          {app.classification && (
                            <p className="text-[10px] text-slate-600 border-t border-emerald-200 pt-1.5">
                              {app.classification}
                            </p>
                          )}
                        </div>
                      ) : app.application_number ? (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] text-slate-500 block font-mono">{t("dash_app_reference")}</span>
                          <span className="text-xs font-bold text-blue-700 font-mono block truncate">
                            {app.application_number}
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">{t("doc_col_status")}</span>
                          <span className="text-xs font-semibold text-amber-700">{t("dash_ready_for_submission")}</span>
                        </div>
                      )}

                      {/* Officer / Rule Scrutiny Note */}
                      {app.officer_remarks && (
                        <p className="text-[10.5px] text-slate-600 italic line-clamp-2">
                          "{app.officer_remarks}"
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E8DCC8] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedModalApp(app)}
                            className="text-xs font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>{t("btn_view_details")}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          
                          {(app.status === 'DOCUMENT_QUERY' || app.status === 'UNDER_REVIEW' || app.status === 'NEEDS_CORRECTION') && (
                            <button
                              onClick={() => handleOpenDelayModal(app)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition flex items-center gap-1 cursor-pointer"
                              title="Diagnose delay cause and evidence"
                            >
                              <AlertCircle className="w-2.5 h-2.5 text-amber-700" />
                              <span>{t("dash_why_delayed")}</span>
                            </button>
                          )}

                          <button
                            onClick={() => explainApplication(app.approval_id, app.title)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8DCC8] hover:bg-[#D6C4A8] text-[#1F2A44] border border-[#C6A75E] transition flex items-center gap-1 cursor-pointer"
                            title="Ask Assistant why this application is in this status"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-[#C6A75E]" />
                            <span>{t("dash_explain")}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleSyncAll}
                            className="p-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition cursor-pointer"
                            title="Sync Status with Department Portal"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-300 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t("dash_no_approvals_title")}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t("dash_no_approvals_desc")}
              </p>
              <Link
                to="/requirements"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] text-white text-xs font-bold transition shadow-sm"
              >
                <span>{t("dash_find_applicable_btn")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* 5. SECONDARY SUPPORT SERVICES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/applicant/documents"
            className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700 transition">{t("nav_documents")}</h4>
                <p className="text-[11px] text-slate-500">{t("doc_vault_subtitle")}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/schemes"
            className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition">{t("dash_schemes_card_title")}</h4>
                <p className="text-[11px] text-slate-500">{t("dash_schemes_card_sub")}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/assistant"
            className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition">{t("dash_assistant_card_title")}</h4>
                <p className="text-[11px] text-slate-500">{t("dash_assistant_card_sub")}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>

      {/* 6. MODAL: DETAILED APPROVAL INFORMATION & SIMULATION CONTROLS */}
      {selectedModalApp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  {getApprovalIcon(selectedModalApp.approval_id)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedModalApp.title}</h3>
                  <p className="text-xs text-slate-500">{selectedModalApp.department}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedModalApp(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status & References */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">{t("dash_modal_current_status")}</span>
                {getStatusBadge(selectedModalApp.status === "APPROVED" || selectedModalApp.registration_ref ? "APPROVED" : selectedModalApp.status)}
              </div>

              {/* Certificate Box */}
              {(selectedModalApp.status === "APPROVED" || selectedModalApp.registration_ref) && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t("dash_statutory_cert_issued")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-mono">{t("dash_license_number")}</span>
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {selectedModalApp.registration_ref || "CERTIFIED"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-mono">{t("dash_validity")}</span>
                      <span className="font-semibold text-slate-700">
                        {selectedModalApp.validity || t("dash_lifetime_recognition")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Application Details */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("dash_modal_app_num")}</span>
                  <span className="font-mono font-bold text-blue-700">{selectedModalApp.application_number || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("dash_modal_category")}</span>
                  <span className="font-semibold text-slate-800">{selectedModalApp.classification || selectedModalApp.category}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("dash_modal_submitted_biz")}</span>
                  <span className="font-semibold text-slate-800">{profile?.company_name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">{t("dash_modal_scrutiny_remarks")}</span>
                  <span className="text-slate-700 text-right max-w-[280px]">{selectedModalApp.officer_remarks || t("dash_modal_awaiting_verification")}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedModalApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
              >
                {t("btn_close")}
              </button>
              {selectedModalApp.portal_route && (
                <Link
                  to={selectedModalApp.portal_route}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-white flex items-center gap-1.5 transition shadow-xs"
                >
                  <span>{t("dash_modal_open_portal")}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#C6A75E]" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. DELAY EXPLANATION MODAL */}
      <DelayExplanationModal
        isOpen={delayModalOpen}
        onClose={() => setDelayModalOpen(false)}
        delayData={delayModalData}
        onAskAssistant={(query) => {
          openAssistant({
            page: 'dashboard',
            approval_id: delayModalData?.approval_code || null,
            message: query
          });
        }}
      />
    </div>
  );
}
