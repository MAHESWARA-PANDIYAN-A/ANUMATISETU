import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Check, 
  Sparkles, 
  RefreshCw,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  Bell
} from 'lucide-react';
import { 
  getComplianceDashboard, 
  getComplianceCalendar, 
  completeComplianceTask 
} from '../api/approvals';
import TaskerAssistantDrawer from '../components/TaskerAssistantDrawer';
import { useLanguage } from '../context/LanguageContext';

const PostApprovalCompliancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [complianceData, setComplianceData] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [activeTab, setActiveTab] = useState(location.pathname.includes('/calendar') ? 'CALENDAR' : 'OVERVIEW');
  const [filter, setFilter] = useState('ALL');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      const [overview, calendar] = await Promise.all([
        getComplianceDashboard(),
        getComplianceCalendar(),
      ]);
      setComplianceData(overview);
      setCalendarEvents(calendar);
    } catch (err) {
      console.error('Failed to load compliance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      setSubmittingStep(true);
      await completeComplianceTask(taskId);
      await fetchCompliance();
    } catch (err) {
      alert('Failed to mark task complete: ' + err.message);
    }
  };

  const summary = complianceData?.summary || {
    active_approvals_count: 0,
    renewals_approaching_count: 0,
    expired_count: 0,
    pending_tasks_count: 0,
    expiring_documents_count: 0,
  };

  const records = complianceData?.approval_records || [];
  const tasks = complianceData?.tasks || [];
  const expiringDocs = complianceData?.expiring_documents || [];

  const filteredRecords = records.filter(r => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return r.renewal_status === 'ACTIVE' || r.renewal_status === 'LIFETIME_VALIDITY';
    if (filter === 'RENEWAL') return r.renewal_status.includes('RENEWAL') || r.urgency_badge === 'WARNING' || r.urgency_badge === 'HIGH';
    if (filter === 'EXPIRED') return r.renewal_status === 'EXPIRED';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF6F0] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCC8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t("comp_badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44]">
              {t("comp_title")}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {t("comp_subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'OVERVIEW' ? 'bg-[#1F2A44] text-[#E8DCC8] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {t("comp_tab_overview")}
              </button>
              <button
                onClick={() => setActiveTab('CALENDAR')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'CALENDAR' ? 'bg-[#1F2A44] text-[#E8DCC8] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {t("comp_tab_calendar")}
              </button>
            </div>

            <button
              onClick={() => {
                setAssistantQuery('What statutory renewals and compliance tasks do I have coming up?');
                setAssistantOpen(true);
              }}
              className="p-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8]/60 text-[#1F2A44] border border-[#E8DCC8] transition-all cursor-pointer"
              title="Ask Assistant about renewals"
            >
              <Sparkles className="w-4 h-4 text-[#C6A75E]" />
            </button>
          </div>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("status_active")}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.active_approvals_count}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("status_approved")}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {t("status_renewal_approaching")}
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-900">
              {summary.renewals_approaching_count}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">{t("status_renewal_approaching")}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("card_action_required")}
              </span>
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.pending_tasks_count}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("comp_tasks_title")}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("status_expired")}
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.expired_count}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("status_expired")}</p>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' ? (
          <div className="space-y-8">
            {/* Active Licenses Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2A44]">
                    Active Statutory Licenses & Approvals
                  </h2>
                  <p className="text-xs text-slate-500">
                    Statutory registration references, validity periods, and dynamic renewal windows.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {['ALL', 'ACTIVE', 'RENEWAL'].map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        filter === t ? 'bg-[#1F2A44] text-[#E8DCC8]' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {t === 'ALL' ? 'All' : (t === 'ACTIVE' ? 'Active' : 'Renewal Approaching')}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400">Loading compliance data...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
                  No active approval records match this filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredRecords.map(record => (
                    <div 
                      key={record.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-bold font-mono">
                              {record.approval_id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {record.department}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-base">{record.approval_name}</h3>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          record.urgency_badge === 'WARNING' || record.urgency_badge === 'HIGH'
                            ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {record.renewal_status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Reference Badge */}
                      <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8DCC8] flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Registration Number
                          </span>
                          <span className="font-mono font-bold text-slate-900">{record.registration_number}</span>
                        </div>
                        {record.days_remaining !== null && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-amber-700 block">
                              Renewal Window
                            </span>
                            <span className="font-bold text-amber-900">{record.days_remaining} days remaining</span>
                          </div>
                        )}
                      </div>

                      {/* Dates Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">
                            Issue Date
                          </span>
                          <span className="font-medium text-slate-800">
                            {record.issue_date ? record.issue_date.substring(0, 10) : 'Permanent'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">
                            Expiry Date
                          </span>
                          <span className="font-medium text-slate-800">
                            {record.expiry_date ? record.expiry_date.substring(0, 10) : 'Lifetime Validity'}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => navigate('/documents')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Documents
                        </button>

                        <button
                          onClick={() => {
                            setAssistantQuery(`How do I plan renewal for my ${record.approval_id} license?`);
                            setAssistantOpen(true);
                          }}
                          className="px-4 py-1.5 bg-[#1F2A44] hover:bg-[#151D30] text-[#E8DCC8] rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          Plan Renewal
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Tasks Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F2A44]">
                  Statutory Compliance Tasks & Filings
                </h2>
                <p className="text-xs text-slate-500">
                  Recurring periodic submissions, water lab reports, and renewal preparations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {task.task_type} • {task.priority}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Due: {task.due_date ? task.due_date.substring(0, 10) : 'Ongoing'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{task.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Source: {task.source}
                      </span>
                      {task.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Done
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Calendar Timeline View */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1F2A44]">
                Statutory Compliance & Renewal Calendar
              </h2>
              <p className="text-xs text-slate-500">
                Chronological timeline of upcoming license expirations, statutory filings, and vault reviews.
              </p>
            </div>

            <div className="space-y-4">
              {calendarEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No upcoming calendar events configured.
                </div>
              ) : (
                calendarEvents.map((evt, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FAF6F0] border border-[#E8DCC8]">
                    <div className="px-3 py-2 bg-[#1F2A44] text-[#E8DCC8] rounded-xl text-center font-bold min-w-[70px]">
                      <div className="text-sm">{evt.date.split('-')[2]}</div>
                      <div className="text-[10px] uppercase">{new Date(evt.date).toLocaleString('default', { month: 'short' })}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm">{evt.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.priority === 'WARNING' || evt.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {evt.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{evt.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Assistant Drawer */}
        <TaskerAssistantDrawer
          isOpen={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          initialQuery={assistantQuery}
        />
      </div>
    </div>
  );
};

export default PostApprovalCompliancePage;
