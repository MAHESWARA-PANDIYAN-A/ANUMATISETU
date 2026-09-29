import React from 'react';
import { 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  ShieldAlert,
  UserCheck,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const DelayExplanationModal = ({ 
  isOpen, 
  onClose, 
  delayData, 
  onAskAssistant 
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!isOpen || !delayData) return null;

  const {
    approval_code,
    current_status,
    delay_status,
    health_badge,
    time_in_stage_days,
    expected_sla_days,
    reason_category,
    reason_text,
    blocking_step,
    waiting_party,
    recommended_action,
    evidence,
    analysis_timestamp
  } = delayData;

  const isAtRisk = delay_status === 'AT_RISK' || delay_status === 'OVERDUE';

  const handleAction = () => {
    if (recommended_action?.route) {
      navigate(recommended_action.route);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className={`p-6 border-b ${isAtRisk ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'} flex items-start justify-between`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAtRisk ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {t('delay_modal_title', { code: approval_code })}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  delay_status === 'AT_RISK' 
                    ? 'bg-amber-200 text-amber-900' 
                    : (delay_status === 'OVERDUE' ? 'bg-rose-200 text-rose-900' : 'bg-emerald-100 text-emerald-800')
                }`}>
                  {health_badge || delay_status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('delay_modal_sub')}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Main Reason Banner */}
          <div className="bg-[#FAF6F0] rounded-xl p-4 border border-[#E8DCC8]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F2A44]/80">
                {t('delay_cause_title')}
              </span>
              <span className="text-xs font-mono font-medium text-slate-500">
                {t('delay_days_in_stage', { days: time_in_stage_days, sla: expected_sla_days })}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {reason_text}
            </p>
          </div>

          {/* Current Blocking State Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                {t('delay_waiting_for')}
              </span>
              <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                {waiting_party === 'Awaiting Applicant' ? (
                  <UserCheck className="w-4 h-4 text-amber-600" />
                ) : (
                  <Building2 className="w-4 h-4 text-blue-600" />
                )}
                {waiting_party === 'Awaiting Applicant' ? t('delay_awaiting_applicant') : waiting_party}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stage: <span className="font-semibold text-slate-700">{current_status}</span>
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                {t('delay_blocking_step')}
              </span>
              <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-600" />
                {blocking_step}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Category: <span className="font-semibold text-slate-700">{reason_category}</span>
              </p>
            </div>
          </div>

          {/* Factual Evidence Trail */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              {t('delay_evidence_title')}
            </h4>
            <div className="space-y-2">
              {evidence && evidence.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {ev.event ? ev.event.replace(/_/g, ' ') : 'Event Logged'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {ev.date || ev.timestamp}
                      </span>
                    </div>
                    {ev.details && (
                      <p className="text-slate-600 mt-0.5">{ev.details}</p>
                    )}
                    {ev.applicant_response && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                        Applicant Response: {ev.applicant_response}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Explanation Assistant Button */}
          <div className="p-3 bg-gradient-to-r from-[#1F2A44] to-[#2A3B5F] rounded-xl text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#E8DCC8]" />
              <span className="text-xs font-medium">
                {t('delay_ask_ai_banner')}
              </span>
            </div>
            <button
              onClick={() => {
                onClose();
                if (onAskAssistant) onAskAssistant(`Why is my ${approval_code} application delayed?`);
              }}
              className="px-3 py-1 bg-[#E8DCC8] hover:bg-white text-[#1F2A44] rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {t('delay_btn_ask')}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            {t('btn_close')}
          </button>

          {recommended_action && (
            <button
              onClick={handleAction}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1F2A44] hover:bg-[#151D30] text-[#E8DCC8] rounded-xl text-xs font-bold shadow-md hover:shadow transition-all cursor-pointer"
            >
              {recommended_action.label || t('delay_btn_action')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DelayExplanationModal;
