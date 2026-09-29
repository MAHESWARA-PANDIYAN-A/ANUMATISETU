import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  FileSearch,
  ArrowRight,
  AlertCircle,
  Clock,
  Layers,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Timer,
  Calendar,
  MapPin,
  Phone,
  FileCheck,
  Info,
} from "lucide-react";
import { getApplications, getOfficerMetrics, completeInspection } from "../api/applications";
import { getOfficerBottlenecks } from "../api/approvals";
import ApplicationDetailModal from "../components/ApplicationDetailModal";

const OfficerDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState({
    total_applications: 0,
    pending_count: 0,
    approaching_sla_count: 0,
    at_risk_sla_count: 0,
    overdue_count: 0,
    inspection_pending_count: 0,
    active_inspections: [],
  });
  const [bottlenecks, setBottlenecks] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & Inspection states
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Inspection findings direct modal
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [inspFindings, setInspFindings] = useState("");
  const [inspNotes, setInspNotes] = useState("");
  const [isSubmittingFindings, setIsSubmittingFindings] = useState(false);

  useEffect(() => {
    loadOfficerDesk();
  }, []);

  const loadOfficerDesk = async () => {
    setLoading(true);
    setError("");
    try {
      const [metRes, appsRes, botRes] = await Promise.all([
        getOfficerMetrics(),
        getApplications(),
        getOfficerBottlenecks().catch(() => null),
      ]);
      setMetrics(metRes || {});
      setApplications(appsRes || []);
      setBottlenecks(botRes);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load officer scrutiny desk.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteInspectionDirect = async (e) => {
    e.preventDefault();
    if (!selectedInspection || !inspFindings.trim()) return;
    setIsSubmittingFindings(true);
    try {
      await completeInspection(selectedInspection.id, {
        findings: inspFindings,
        report_notes: inspNotes,
      });
      setSelectedInspection(null);
      setInspFindings("");
      setInspNotes("");
      await loadOfficerDesk();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit inspection findings.");
    } finally {
      setIsSubmittingFindings(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesFilter =
      statusFilter === "ALL" ||
      app.status === statusFilter ||
      app.sla_status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      app.application_number.toLowerCase().includes(q) ||
      (app.company_name && app.company_name.toLowerCase().includes(q)) ||
      (app.industry && app.industry.toLowerCase().includes(q)) ||
      (app.district && app.district.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (st) => {
    switch (st) {
      case "APPROVED":
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">{t('status_approved')}</span>;
      case "PARTIALLY_APPROVED":
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">{t('status_under_review')}</span>;
      case "NEEDS_INFORMATION":
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t('status_document_query')}</span>;
      case "UNDER_REVIEW":
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">{t('status_under_review')}</span>;
      case "REJECTED":
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/30">{t('status_rejected')}</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-300 border border-gray-700">{t('status_submitted')}</span>;
    }
  };

  const getSLABadge = (slaSt, daysRemaining) => {
    switch (slaSt) {
      case "OVERDUE":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1 animate-pulse">
            <Timer className="w-3 h-3" /> OVERDUE ({Math.abs(daysRemaining)}d)
          </span>
        );
      case "AT_RISK":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> AT RISK ({daysRemaining}d)
          </span>
        );
      case "APPROACHING":
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> APPROACHING ({daysRemaining}d)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            COMPLETED
          </span>
        );
      case "ON_TRACK":
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            ON TRACK ({daysRemaining}d)
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-8 border border-purple-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('brand_name')} {t('officer_badge')} · {t('ws_officer_title')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t('officer_title')}: {user?.full_name}
            </h1>
            <p className="text-sm text-gray-400">
              Department: <span className="text-purple-300 font-semibold">{user?.department || "State Industrial Regulatory Scrutiny"}</span>
            </p>
          </div>

          <div className="text-right font-mono text-xs text-gray-400 bg-gray-900/80 px-4 py-2.5 rounded-xl border border-gray-800">
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Officer Privileges Active
            </div>
            <div className="text-gray-500 truncate max-w-[200px]" title={user?.email}>
              {user?.email}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Phase 6: KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Applications */}
        <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-2">
          <span className="text-xs font-semibold text-gray-400 block">{t('analytics_stat_apps')}</span>
          <div className="text-2xl font-bold text-white font-mono">{metrics.total_applications}</div>
          <span className="text-[11px] text-gray-500">Filed via portal</span>
        </div>

        {/* Pending Scrutiny */}
        <div className="glass-panel rounded-2xl p-5 border border-blue-500/30 bg-blue-950/20 space-y-2">
          <span className="text-xs font-semibold text-blue-300 block">{t('status_under_review')}</span>
          <div className="text-2xl font-bold text-blue-400 font-mono">{metrics.pending_count}</div>
          <span className="text-[11px] text-blue-300/70">Awaiting clearance</span>
        </div>

        {/* Approaching / At Risk SLA */}
        <div className={`glass-panel rounded-2xl p-5 border ${metrics.at_risk_sla_count > 0 ? "border-rose-500/40 bg-rose-950/20" : "border-amber-500/30 bg-amber-950/20"} space-y-2`}>
          <span className="text-xs font-semibold text-amber-300 block">Approaching / At Risk</span>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {metrics.approaching_sla_count + metrics.at_risk_sla_count}
          </div>
          <span className="text-[11px] text-amber-300/70">
            {metrics.at_risk_sla_count} at urgent risk (&le;3d)
          </span>
        </div>

        {/* Overdue SLA */}
        <div className={`glass-panel rounded-2xl p-5 border ${metrics.overdue_count > 0 ? "border-red-500/50 bg-red-950/30 animate-pulse" : "border-gray-800"} space-y-2`}>
          <span className="text-xs font-semibold text-red-300 block">Overdue Deadlines</span>
          <div className="text-2xl font-bold text-red-400 font-mono">{metrics.overdue_count}</div>
          <span className="text-[11px] text-red-300/70">Exceeded SLA limit</span>
        </div>

        {/* Inspection Pending */}
        <div className="glass-panel rounded-2xl p-5 border border-indigo-500/30 bg-indigo-950/20 space-y-2 col-span-2 md:col-span-1">
          <span className="text-xs font-semibold text-indigo-300 block">{t('card_site_inspection')}</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{metrics.inspection_pending_count}</div>
          <span className="text-[11px] text-indigo-300/70">Field/Site visits</span>
        </div>
      </div>

      {/* Observed Bottleneck Analysis Desk */}
      {bottlenecks && bottlenecks.bottleneck_stages && (
        <div className="glass-card rounded-2xl p-6 border border-amber-500/30 bg-[#1F2A44]/60 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Timer className="w-5 h-5 text-amber-400" />
                <span>{t('analytics_tab_bottlenecks')}</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Calculated from status event history timestamps and active pending blockers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {bottlenecks.summary?.awaiting_applicant || 0} Awaiting Applicant
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {bottlenecks.summary?.awaiting_department || 0} Awaiting Dept
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Workflow Stage</th>
                  <th className="py-2.5 px-3 text-center">Applications</th>
                  <th className="py-2.5 px-3 text-center">Average Time in Stage</th>
                  <th className="py-2.5 px-3 text-center">Pending Queue</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-medium">
                {bottlenecks.bottleneck_stages.map((st, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 text-white font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      {st.display_name}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-300 font-mono">{st.applications_count}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">{st.average_time_days} days</td>
                    <td className="py-3 px-3 text-center font-mono text-gray-300">{st.pending_count}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.average_time_days > 5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {st.average_time_days > 5 ? 'High Duration' : 'Normal SLA'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disclaimer Alert */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0 text-purple-400" />
        <span>
          <strong>SLA Regulatory Simulation Notice:</strong> Statutory clearance targets, SLA counters, and site inspection schedules are configured for prototype simulation unless specified in the published state industrial gazette.
        </span>
      </div>

      {/* Phase 6: Scheduled Inspections Management Desk */}
      {metrics.active_inspections && metrics.active_inspections.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/30 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">{t('officer_queue_inspections', { count: metrics.active_inspections.length })}</h3>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {metrics.active_inspections.length} Scheduled
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.active_inspections.map((insp) => (
              <div
                key={insp.id}
                className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {insp.application_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {insp.scheduled_time || "10:30 AM"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white truncate">
                      {insp.company_name}
                    </h4>
                    <span className="text-xs text-gray-400 block">{insp.approval_name}</span>
                  </div>

                  <div className="space-y-1 text-xs text-gray-300 bg-black/40 p-2.5 rounded-lg border border-gray-800/60">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                      <span className="truncate">{insp.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <span>Inspector: <strong className="text-gray-200">{insp.inspector_name}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-mono">
                    {new Date(insp.scheduled_date).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedInspection(insp);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Record Findings</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrutiny Queue Overview */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-3">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-purple-400" />
              {t('officer_title')}
            </h2>
            <p className="text-xs text-gray-400">
              {t('officer_subtitle')}
            </p>
          </div>

          <button
            onClick={loadOfficerDesk}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {t('portal_sync_records')}
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "SUBMITTED", "UNDER_REVIEW", "NEEDS_INFORMATION", "AT_RISK", "OVERDUE", "APPROVED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30 font-bold"
                    : "bg-gray-900/60 text-gray-400 hover:text-white border border-gray-800"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder={t('nav_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-9 pr-3 py-1.5 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Applications Grid */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">{t('nav_connecting')}...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 border border-gray-800 text-center space-y-2">
            <Layers className="w-8 h-8 text-gray-500 mx-auto" />
            <div className="text-sm font-semibold text-gray-300">No applications match this filter</div>
            <p className="text-xs text-gray-500">Incoming industrialist submissions will appear here for review.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="glass-card rounded-2xl p-5 border border-gray-800 hover:border-purple-500/40 transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20">
                      {app.application_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(app.status)}
                      {getSLABadge(app.sla_status, app.days_remaining)}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      {app.company_name}
                    </h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>{app.industry} · {app.district}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-900/60 rounded-xl border border-gray-800 text-center text-xs">
                    <div>
                      <span className="text-gray-500 text-[10px] block">Clearances</span>
                      <span className="font-bold text-white">{app.total_approvals}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">{t('status_approved')}</span>
                      <span className="font-bold text-emerald-400">{app.approved_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">Queries</span>
                      <span className="font-bold text-amber-400">{app.query_count}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-mono">
                    Expected: {app.expected_completion_date ? new Date(app.expected_completion_date).toLocaleDateString() : "Pending"}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedAppId(app.id);
                      setIsDetailModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all cursor-pointer"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>{t('officer_btn_open_scrutiny')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrutiny Modal */}
      <ApplicationDetailModal
        applicationId={selectedAppId}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        isOfficer={true}
        currentUser={user}
        onRefresh={loadOfficerDesk}
      />

      {/* Direct Record Inspection Findings Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg bg-gray-950 border border-gray-700 rounded-2xl p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Record Inspection Findings: {selectedInspection.application_number}
            </h3>
            <p className="text-xs text-gray-400">
              Site: <span className="text-white">{selectedInspection.location}</span> ({selectedInspection.company_name})
            </p>

            <form onSubmit={handleCompleteInspectionDirect} className="space-y-4">
              <div className="space-y-1 text-xs">
                <label className="text-gray-400 font-medium">Technical Findings & Compliance Verdict</label>
                <textarea
                  rows={4}
                  value={inspFindings}
                  onChange={(e) => setInspFindings(e.target.value)}
                  placeholder="Enter on-site observations, effluent sampling results, fire setback checks..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-gray-400 font-medium">Supplementary Notes</label>
                <textarea
                  rows={2}
                  value={inspNotes}
                  onChange={(e) => setInspNotes(e.target.value)}
                  placeholder="Optional notes for final sign-off..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInspection(null)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs cursor-pointer"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFindings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  {isSubmittingFindings ? "Saving..." : "Save Findings & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;
