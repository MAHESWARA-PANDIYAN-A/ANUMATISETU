import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, 
  Layers, 
  Sparkles, 
  GitFork, 
  ArrowRight, 
  AlertCircle, 
  HelpCircle, 
  CheckCircle2, 
  Info,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { getApprovalPlan } from '../api/approvals';
import ApprovalCard from '../components/approvals/ApprovalCard';
import TaskerAssistantDrawer from '../components/TaskerAssistantDrawer';
import { useLanguage } from '../context/LanguageContext';

const ApprovalPlanPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState('');
  const [selectedApprovalDetail, setSelectedApprovalDetail] = useState(null);

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const data = await getApprovalPlan();
      setPlanData(data);
    } catch (error) {
      console.error('Failed to load approval plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWhyClick = (approvalId) => {
    setAssistantInitialQuery(`Why do I need the ${approvalId} approval for my business?`);
    setAssistantOpen(true);
  };

  const handleActionClick = (item) => {
    if (item.current_status === 'APPROVED') {
      navigate('/compliance');
    } else {
      navigate('/applications/new');
    }
  };

  const filteredItems = planData?.items?.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'FIRST') return item.priority_label === 'Start First';
    if (filter === 'PARALLEL') return item.priority_label === 'Can Run in Parallel';
    if (filter === 'ACTIVE') return item.current_status === 'APPROVED';
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-[#FAF6F0] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCC8] shadow-sm relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#E8DCC8]/30 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-semibold uppercase tracking-wider mb-3">
                <Compass className="w-3.5 h-3.5" />
                {t("plan_engine_badge")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44] tracking-tight">
                {t("plan_title")}
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                {t("plan_desc")}
              </p>
              {planData?.location && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="font-bold text-slate-800">{planData.company_name}</span>
                  <span>•</span>
                  <span>{planData.industry}</span>
                  <span>•</span>
                  <span>{planData.location}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setAssistantInitialQuery('Explain my recommended sequence of industrial approvals.');
                  setAssistantOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#1F2A44] bg-[#FAF6F0] hover:bg-[#E8DCC8]/60 border border-[#E8DCC8] transition-all shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#C6A75E]" />
                {t("plan_ask_sequence")}
              </button>

              <button
                onClick={() => navigate('/coverage')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1F2A44] hover:bg-[#151D30] transition-all shadow-md cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#E8DCC8]" />
                {t("dash_coverage_btn")}
              </button>
            </div>
          </div>

          {/* Sequential Journey Stepper Strip */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('plan_seq_strip_title')}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {planData?.disclaimer}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {planData?.items?.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center gap-3 relative overflow-hidden"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1F2A44] text-[#E8DCC8] font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                    {String(item.sequence).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {item.approval_id}
                    </div>
                    <div className="text-[11px] font-semibold text-[#C6A75E] truncate">
                      {item.priority_label === 'Start First' ? t('plan_filter_first') : (item.priority_label === 'Can Run in Parallel' ? t('plan_filter_parallel') : item.priority_label)}
                    </div>
                  </div>
                  {idx < (planData?.items?.length - 1) && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden lg:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters & Count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {[
              { id: 'ALL', label: `${t('plan_filter_all')} (${planData?.total || 0})` },
              { id: 'FIRST', label: t('plan_filter_first') },
              { id: 'PARALLEL', label: t('plan_filter_parallel') },
              { id: 'ACTIVE', label: t('plan_filter_active') },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#1F2A44] text-[#E8DCC8] shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 self-end sm:self-auto">
            <Info className="w-3.5 h-3.5 text-[#C6A75E]" />
            {t('plan_seq_override_note')}
          </div>
        </div>

        {/* Approval Cards Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#1F2A44]" />
            <span className="text-sm font-medium">{t('plan_evaluating_rules')}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base">{t('plan_no_matches')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('plan_adjust_filter')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {filteredItems.map((item, index) => (
              <ApprovalCard
                key={item.approval_id || index}
                item={item}
                onWhyClick={handleWhyClick}
                onActionClick={handleActionClick}
                onDetailsClick={(it) => setSelectedApprovalDetail(it)}
              />
            ))}
          </div>
        )}

        {/* Details Drawer / Modal */}
        {selectedApprovalDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scaleUp">
              <div className="p-6 border-b border-slate-100 bg-[#FAF6F0] flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-bold font-mono">
                      {selectedApprovalDetail.approval_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedApprovalDetail.department}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-[#1F2A44]">
                    {selectedApprovalDetail.approval_name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedApprovalDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">
                    {t('plan_trigger_reason')}
                  </h4>
                  <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed font-medium">
                    {selectedApprovalDetail.reason}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {t('cov_stat_digital')}
                    </span>
                    <ul className="space-y-1 list-disc list-inside text-slate-600">
                      {selectedApprovalDetail.tasker_capabilities?.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {t('cov_stat_external')}
                    </span>
                    {selectedApprovalDetail.external_steps && selectedApprovalDetail.external_steps.length > 0 ? (
                      <ul className="space-y-1 list-disc list-inside text-slate-600">
                        {selectedApprovalDetail.external_steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 italic">100% digital workflow.</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {t('assistant_sources_cited')}
                    </span>
                    <span className="font-semibold text-slate-800">{selectedApprovalDetail.source}</span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-mono">
                    Verified: {selectedApprovalDetail.last_verified_date}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedApprovalDetail(null)}
                  className="px-5 py-2 bg-[#1F2A44] text-[#E8DCC8] rounded-xl font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Assistant Drawer */}
        <TaskerAssistantDrawer
          isOpen={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          initialQuery={assistantInitialQuery}
        />
      </div>
    </div>
  );
};

export default ApprovalPlanPage;
