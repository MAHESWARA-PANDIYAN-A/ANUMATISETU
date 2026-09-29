import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  User,
  Send,
  ShieldCheck,
  Search,
  Layers,
  Phone,
  FileCheck,
  ChevronRight,
  History,
  MapPin,
  Timer,
  Check,
  Info,
  Award,
  Download,
  ExternalLink
} from "lucide-react";

import {
  getApplicationDetails,
  getApplicationTimeline,
  submitQueryResponse,
  updateApprovalStatus,
  scheduleInspection,
  completeInspection,
} from "../api/applications";
import { useLanguage } from "../context/LanguageContext";

export default function ApplicationDetailModal({
  applicationId,
  isOpen,
  onClose,
  isOfficer = false,
  currentUser = null,
  onRefresh = () => {},
}) {
  const { t } = useLanguage();
  const [appData, setAppData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, timeline
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Officer action states
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [actionModalType, setActionModalType] = useState(null); // 'status', 'query', 'inspect', 'complete_inspect', 'respond_query'
  const [actionStatus, setActionStatus] = useState("UNDER_REVIEW");
  const [actionRemarks, setActionRemarks] = useState("");
  const [queryDetails, setQueryDetails] = useState("");
  const [queryResponse, setQueryResponse] = useState("");
  
  // Inspection form
  const [inspDate, setInspDate] = useState("");
  const [inspTime, setInspTime] = useState("10:30 AM");
  const [inspLocation, setInspLocation] = useState("");
  const [inspName, setInspName] = useState("");
  const [inspContact, setInspContact] = useState("");
  const [inspNotes, setInspNotes] = useState("");
  const [inspFindings, setInspFindings] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    if (isOpen && applicationId) {
      loadData();
    }
  }, [isOpen, applicationId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, hist] = await Promise.all([
        getApplicationDetails(applicationId),
        getApplicationTimeline(applicationId),
      ]);
      setAppData(data);
      setTimeline(hist);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load application details.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedApproval) return;
    setSubmittingAction(true);
    setError("");
    try {
      await updateApprovalStatus(
        selectedApproval.id,
        actionStatus,
        actionRemarks,
        actionStatus === "DOCUMENT_QUERY" ? queryDetails : null
      );
      setActionSuccess(`Status updated to ${actionStatus} successfully.`);
      setActionModalType(null);
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update clearance status.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleApplicantQueryResponse = async (e) => {
    e.preventDefault();
    if (!selectedApproval || !queryResponse.trim()) return;
    setSubmittingAction(true);
    setError("");
    try {
      await submitQueryResponse(selectedApproval.id, queryResponse.trim());
      setActionSuccess("Query clarification submitted successfully to the department.");
      setActionModalType(null);
      setQueryResponse("");
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit clarification.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleScheduleInspection = async (e) => {
    e.preventDefault();
    if (!selectedApproval || !inspDate || !inspName) return;
    setSubmittingAction(true);
    setError("");
    try {
      await scheduleInspection(selectedApproval.id, {
        scheduled_date: new Date(inspDate).toISOString(),
        scheduled_time: inspTime,
        location: inspLocation || (appData?.business_profile ? `${appData.business_profile.company_name} Site, ${appData.business_profile.district}` : "Enterprise Site"),
        inspector_name: inspName,
        inspector_contact: inspContact,
        report_notes: inspNotes,
      });
      setActionSuccess("Inspection scheduled successfully.");
      setActionModalType(null);
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to schedule inspection.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCompleteInspection = async (e) => {
    e.preventDefault();
    if (!selectedInspectionId || !inspFindings.trim()) return;
    setSubmittingAction(true);
    setError("");
    try {
      await completeInspection(selectedInspectionId, {
        findings: inspFindings,
        report_notes: inspNotes,
      });
      setActionSuccess("Inspection report saved and marked completed.");
      setActionModalType(null);
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to complete inspection.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case "APPROVED":
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t('status_approved')}
          </span>
        );
      case "PARTIALLY_APPROVED":
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> {t('status_under_review')}
          </span>
        );
      case "NEEDS_INFORMATION":
      case "DOCUMENT_QUERY":
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> {t('status_document_query')}
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" /> {t('status_under_review')}
          </span>
        );
      case "INSPECTION_PENDING":
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> {t('card_site_inspection')}
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" /> {t('status_rejected')}
          </span>
        );
      case "SUBMITTED":
      default:
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> {t('status_submitted')}
          </span>
        );
    }
  };

  const getSLABadge = (slaSt, daysRemaining) => {
    switch (slaSt) {
      case "OVERDUE":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/40 flex items-center gap-1.5 animate-pulse">
            <Timer className="w-3.5 h-3.5" /> OVERDUE ({Math.abs(daysRemaining)}d)
          </span>
        );
      case "AT_RISK":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> AT RISK ({daysRemaining}d)
          </span>
        );
      case "APPROACHING":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> APPROACHING ({daysRemaining}d)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> SLA COMPLETED
          </span>
        );
      case "ON_TRACK":
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" /> ON TRACK ({daysRemaining}d)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl bg-gray-950/95 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold">
                {appData?.application_number || "Loading..."}
              </span>
              {appData && getStatusBadge(appData.status)}
              {appData && getSLABadge(appData.sla_status, appData.days_remaining)}
            </div>
            <h2 className="text-xl font-bold text-white">
              {appData?.project_title || t('modal_app_details_title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback banners */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess("")} className="text-emerald-400 hover:underline">{t('btn_close')}</button>
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:underline">{t('btn_close')}</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 px-6 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('modal_tab_overview')} ({appData?.approvals?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`py-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === "timeline"
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <History className="w-4 h-4" />
            {t('modal_tab_timeline')} ({timeline.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-mono">{t('nav_connecting')}...</p>
            </div>
          ) : activeTab === "overview" ? (
            <div className="space-y-6">
              
              {/* Enterprise & SLA Quick Overview Card */}
              {appData && (
                <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">{t('modal_field_biz_name')}</span>
                      <span className="font-semibold text-white truncate block">{appData.business_profile?.company_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">{t('onboard_industry_label')} & {t('onboard_district_label')}</span>
                      <span className="font-semibold text-white">{appData.business_profile?.industry} · {appData.business_profile?.district}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">{t('modal_field_submission_date')}</span>
                      <span className="font-semibold text-gray-300 font-mono">
                        {appData.submitted_at ? new Date(appData.submitted_at).toLocaleDateString() : "Draft"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">{t('card_due_date')}</span>
                      <span className="font-semibold text-cyan-300 font-mono">
                        {appData.expected_completion_date ? new Date(appData.expected_completion_date).toLocaleDateString() : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* SLA progress indicator */}
                  <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                    <div className="flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t('card_days_elapsed')}: <strong className="text-white">{appData.days_elapsed} d</strong></span>
                      <span>·</span>
                      <span>{t('card_days_remaining')}: <strong className={appData.days_remaining <= 3 ? "text-rose-400" : "text-emerald-400"}>{appData.days_remaining} d</strong></span>
                    </div>
                    <span className="text-[10px] text-gray-500 italic">
                      *ANUMATISETU Statutory SLA Monitor
                    </span>
                  </div>
                </div>
              )}

              {/* External Headless Integration Details (Udyam & FSSAI) */}
              {appData?.udyam_application_number && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 to-orange-950/20 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t('udyam_title')}</h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {appData.udyam_status || "SUBMITTED"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">{t('portal_field_app_id')}</span>
                      <span className="font-mono font-semibold text-blue-300">{appData.udyam_application_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">MSME Tier</span>
                      <span className="font-bold text-amber-400 font-mono">{appData.msme_classification || "MICRO"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Registration</span>
                      <span className="font-mono text-emerald-400 font-bold truncate block">
                        {appData.udyam_registration_number || "Under Verification"}
                      </span>
                    </div>
                  </div>
                  {appData.udyam_registration_number && (
                    <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-xs">
                      <span className="text-emerald-300 text-xs font-semibold">{t('status_approved')}</span>
                      <a
                        href={`http://localhost:5174/certificate/${appData.udyam_registration_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('btn_download_cert')}</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {appData?.fssai_application_number && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t('fssai_title')}</h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {appData.fssai_status || "SUBMITTED"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">{t('portal_field_app_id')}</span>
                      <span className="font-mono font-semibold text-emerald-300">{appData.fssai_application_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">{t('card_status_label')}</span>
                      <span className="font-bold text-blue-400">{t('pipe_status_in_scrutiny')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Clearance Approvals List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                  <span>{t('dash_active_clearances')}</span>
                  <span className="text-xs font-normal text-gray-400">{appData?.approvals?.length || 0} clearances</span>
                </h3>

                {appData?.approvals?.map((approval) => {
                  const hasActiveQuery = approval.status === "DOCUMENT_QUERY";

                  return (
                    <div
                      key={approval.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        hasActiveQuery
                          ? "bg-amber-950/20 border-amber-500/40"
                          : approval.status === "APPROVED"
                          ? "bg-emerald-950/20 border-emerald-500/40"
                          : "bg-gray-900/50 border-gray-800"
                      } space-y-4`}
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold">
                              {approval.department_code || "DEPT"}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                              {approval.department_name}
                            </span>
                            {approval.inspection_required && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                {t('card_site_inspection')}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-white">
                            {approval.approval_name}
                          </h4>
                          <span className="text-xs text-gray-500 font-mono">Code: {approval.approval_id}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(approval.status)}
                          {getSLABadge(approval.sla_status, approval.days_remaining)}
                        </div>
                      </div>

                      {/* Details & SLA Metrics */}
                      <div className="grid sm:grid-cols-3 gap-3 text-xs bg-black/40 p-3.5 rounded-xl border border-gray-800/80">
                        <div>
                          <span className="text-gray-500 block">{t('modal_insp_officer')}:</span>
                          <span className="text-gray-200 font-medium truncate block">
                            {approval.assigned_officer_name || "Department Queue / General Pool"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">{t('card_due_date')}:</span>
                          <span className="text-cyan-300 font-mono">
                            {approval.expected_completion_date
                              ? new Date(approval.expected_completion_date).toLocaleDateString()
                              : "Standard 15 Days"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">{t('card_days_elapsed')}:</span>
                          <span className="text-gray-300 font-mono">
                            {approval.days_elapsed}d elapsed · {approval.days_remaining}d left
                          </span>
                        </div>
                        {approval.remarks && (
                          <div className="sm:col-span-3 text-gray-300 pt-1">
                            <span className="text-gray-500 block mb-0.5">Remarks:</span>
                            <p className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 italic">
                              "{approval.remarks}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* DOCUMENT_QUERY Section */}
                      {hasActiveQuery && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                              <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                                {t('modal_btn_raise_query')}
                              </h5>
                              <p className="text-xs text-amber-200 leading-relaxed font-sans">
                                {approval.query_details || "Supplementary information or technical clarification requested."}
                              </p>
                            </div>
                          </div>

                          {!isOfficer && (
                            <button
                              onClick={() => {
                                setSelectedApproval(approval);
                                setActionModalType("respond_query");
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {t('modal_btn_respond_query')}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Query Response Display */}
                      {approval.query_response && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-xs rounded-xl space-y-1">
                          <span className="text-blue-400 font-semibold block">{t('modal_btn_submit_response')}:</span>
                          <p className="text-gray-300">{approval.query_response}</p>
                        </div>
                      )}

                      {/* Scheduled / Recorded Inspection Cards */}
                      {approval.inspections && approval.inspections.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> {t('card_site_inspection')}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                              {approval.inspections.length} visit record(s)
                            </span>
                          </div>

                          {approval.inspections.map((insp) => (
                            <div
                              key={insp.id}
                              className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs space-y-3 shadow-lg"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                                    <Calendar className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-white text-sm block">
                                      {new Date(insp.scheduled_date).toLocaleDateString("en-IN", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                    <span className="text-[11px] text-indigo-300 font-mono">
                                      {t('modal_insp_time')}: {insp.scheduled_time || "10:30 AM IST"}
                                    </span>
                                  </div>
                                </div>
                                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-500/50">
                                  {insp.status === "SCHEDULED" ? t('status_inspection_pending') : insp.status}
                                </span>
                              </div>

                              <div className="grid sm:grid-cols-3 gap-3 text-gray-300 bg-gray-950/60 p-3 rounded-lg border border-indigo-500/20">
                                <div>
                                  <span className="text-gray-500 text-[10px] block uppercase font-mono">{t('modal_insp_officer')}</span>
                                  <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                                    <User className="w-3.5 h-3.5 text-indigo-400" /> {insp.inspector_name || "Field Officer"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-[10px] block uppercase font-mono">{t('modal_field_contact')}</span>
                                  <span className="text-gray-300 flex items-center gap-1.5 mt-0.5 font-mono">
                                    <Phone className="w-3.5 h-3.5 text-gray-400" /> {insp.inspector_contact || "+91 20 2550 1234"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-[10px] block uppercase font-mono">{t('modal_insp_location')}</span>
                                  <span className="text-gray-300 flex items-center gap-1.5 mt-0.5 truncate">
                                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" /> {insp.location || "Enterprise Site"}
                                  </span>
                                </div>
                              </div>

                              {insp.report_notes && (
                                <div className="text-gray-300 bg-gray-900/80 p-2.5 rounded-lg border border-gray-800 text-[11px]">
                                  <span className="text-gray-400 font-semibold block mb-0.5">Pre-Inspection Notes:</span>
                                  <p className="italic">"{insp.report_notes}"</p>
                                </div>
                              )}

                              {insp.findings && (
                                <div className="text-emerald-300 bg-emerald-950/40 p-3 rounded-lg border border-emerald-500/40 text-xs">
                                  <span className="font-bold text-emerald-400 block mb-1 flex items-center gap-1.5">
                                    <FileCheck className="w-4 h-4" /> Official Inspection Findings & Compliance Report:
                                  </span>
                                  <p className="leading-relaxed">{insp.findings}</p>
                                </div>
                              )}

                              {isOfficer && insp.status === "SCHEDULED" && (
                                <button
                                  onClick={() => {
                                    setSelectedInspectionId(insp.id);
                                    setActionModalType("complete_inspect");
                                  }}
                                  className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  Record Inspection Findings & Complete
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Officer Workflow Action Buttons */}
                      {isOfficer && (
                        <div className="pt-2 border-t border-gray-800 flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setActionStatus("UNDER_REVIEW");
                              setActionModalType("status");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium transition cursor-pointer"
                          >
                            {t('modal_btn_update_status')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setActionStatus("DOCUMENT_QUERY");
                              setActionModalType("query");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition cursor-pointer"
                          >
                            {t('modal_btn_raise_query')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setInspLocation(appData?.business_profile ? `Plot No. 42, MIDC, ${appData.business_profile.district}` : "");
                              setActionModalType("inspect");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium transition cursor-pointer"
                          >
                            {t('modal_btn_schedule_inspect')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setActionStatus("APPROVED");
                              setActionModalType("status");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition cursor-pointer"
                          >
                            {t('status_approved')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setActionStatus("REJECTED");
                              setActionModalType("status");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition cursor-pointer"
                          >
                            {t('status_rejected')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Visual Timeline Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                  {t('modal_tab_timeline')}
                </h3>
                <span className="text-xs text-gray-500 font-mono">{timeline.length} milestone events</span>
              </div>

              <div className="relative pl-8 border-l-2 border-blue-500/40 space-y-6 pt-2">
                {timeline.map((ev, idx) => {
                  let dotColor = "bg-blue-500";
                  if (ev.new_status === "APPROVED") dotColor = "bg-emerald-500";
                  else if (ev.new_status === "REJECTED") dotColor = "bg-red-500";
                  else if (ev.new_status === "DOCUMENT_QUERY") dotColor = "bg-amber-500";
                  else if (ev.new_status === "INSPECTION_PENDING") dotColor = "bg-indigo-500";

                  return (
                    <div key={ev.id || idx} className="relative space-y-1 group">
                      <div className={`absolute -left-[39px] top-1.5 w-4 h-4 rounded-full ${dotColor} border-4 border-gray-950 ring-2 ring-gray-800 shadow-md`}></div>
                      
                      <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs px-2 py-0.5 rounded bg-gray-800">
                              {ev.new_status}
                            </span>
                            {ev.approval_name && (
                              <span className="text-xs text-purple-300 font-medium">
                                · {ev.approval_name}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {new Date(ev.created_at).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed font-sans">{ev.remarks}</p>
                        
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5 pt-1 border-t border-gray-800/60">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>Action by: <strong className="text-gray-300">{ev.changed_by_name}</strong> ({ev.changed_by_role})</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span>{t('brand_name')} — {t('brand_subtitle')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            {t('btn_close')}
          </button>
        </div>
      </div>

      {/* Action Sub-Modals (Status update, Query raising, Query responding, Inspections) */}
      {actionModalType && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg bg-gray-950 border border-gray-700 rounded-2xl p-6 space-y-5 shadow-2xl">
            
            {/* 1. Update Status Form */}
            {actionModalType === "status" && (
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {t('modal_btn_update_status')}: {selectedApproval?.approval_name}
                </h3>
                <div className="space-y-1 text-xs">
                  <label className="text-gray-400 font-medium">Select Next Status</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UNDER_REVIEW">UNDER_REVIEW - Active Departmental Scrutiny</option>
                    <option value="APPROVED">APPROVED - Statutory Clearance Sanctioned</option>
                    <option value="REJECTED">REJECTED - Clearance Refused with Statutory Cause</option>
                  </select>
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-gray-400 font-medium">Scrutiny Remarks / Orders</label>
                  <textarea
                    rows={3}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder="Enter formal departmental notes or decision justification..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalType(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {submittingAction ? "Updating..." : t('modal_btn_update_status')}
                  </button>
                </div>
              </form>
            )}

            {/* 2. Raise Document Query */}
            {actionModalType === "query" && (
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  {t('modal_btn_raise_query')}
                </h3>
                <p className="text-xs text-gray-400">
                  This will transition the clearance into <span className="text-amber-300 font-bold">DOCUMENT_QUERY</span> and the overall application into <span className="text-amber-300 font-bold">NEEDS_INFORMATION</span>.
                </p>
                <div className="space-y-1 text-xs">
                  <label className="text-gray-400 font-medium">{t('modal_query_prompt')}</label>
                  <textarea
                    rows={4}
                    value={queryDetails}
                    onChange={(e) => setQueryDetails(e.target.value)}
                    placeholder="e.g. Please submit revised structural stability certificate with certified engineer stamp..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalType(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {submittingAction ? "Submitting..." : t('modal_btn_raise_query')}
                  </button>
                </div>
              </form>
            )}

            {/* 3. Applicant Respond to Query */}
            {actionModalType === "respond_query" && (
              <form onSubmit={handleApplicantQueryResponse} className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  {t('modal_btn_respond_query')}
                </h3>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                  <span className="font-bold block mb-1">{t('modal_query_prompt')}:</span>
                  {selectedApproval?.query_details}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-gray-400 font-medium">{t('modal_query_response_prompt')}</label>
                  <textarea
                    rows={4}
                    value={queryResponse}
                    onChange={(e) => setQueryResponse(e.target.value)}
                    placeholder="Describe how the deficiency was addressed, mention uploaded document references..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalType(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {submittingAction ? "Submitting..." : t('modal_btn_submit_response')}
                  </button>
                </div>
              </form>
            )}

            {/* 4. Schedule Inspection */}
            {actionModalType === "inspect" && (
              <form onSubmit={handleScheduleInspection} className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  {t('modal_btn_schedule_inspect')}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">{t('modal_insp_date')}</label>
                    <input
                      type="date"
                      value={inspDate}
                      onChange={(e) => setInspDate(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">{t('modal_insp_time')}</label>
                    <input
                      type="text"
                      value={inspTime}
                      onChange={(e) => setInspTime(e.target.value)}
                      placeholder="e.g. 10:30 AM"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-gray-400 font-medium">{t('modal_insp_location')}</label>
                    <input
                      type="text"
                      value={inspLocation}
                      onChange={(e) => setInspLocation(e.target.value)}
                      placeholder="e.g. Plot No. 44, MIDC Kurkumbh Industrial Area, Pune"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">{t('modal_insp_officer')}</label>
                    <input
                      type="text"
                      value={inspName}
                      onChange={(e) => setInspName(e.target.value)}
                      placeholder="e.g. Dr. Ananya Deshmukh"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">{t('modal_field_contact')}</label>
                    <input
                      type="text"
                      value={inspContact}
                      onChange={(e) => setInspContact(e.target.value)}
                      placeholder="+91 98200 54321"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-gray-400 font-medium">Inspection Scope & Technical Checklist Notes</label>
                    <textarea
                      rows={2}
                      value={inspNotes}
                      onChange={(e) => setInspNotes(e.target.value)}
                      placeholder="e.g. Effluent treatment plant layout and stack emission sampling verification..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalType(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    {submittingAction ? "Scheduling..." : t('modal_btn_confirm_inspect')}
                  </button>
                </div>
              </form>
            )}

            {/* 5. Complete Inspection Findings */}
            {actionModalType === "complete_inspect" && (
              <form onSubmit={handleCompleteInspection} className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  Record Inspection Findings
                </h3>
                <div className="space-y-1 text-xs">
                  <label className="text-gray-400 font-medium">Technical Findings & Compliance Verdict</label>
                  <textarea
                    rows={4}
                    value={inspFindings}
                    onChange={(e) => setInspFindings(e.target.value)}
                    placeholder="Enter on-site test results, setback measurements, observed compliance status..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalType(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {submittingAction ? "Saving..." : t('btn_save')}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
