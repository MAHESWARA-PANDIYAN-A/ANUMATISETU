import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  ExternalLink,
  GitFork,
  Check
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const ApprovalCard = ({ 
  item, 
  onWhyClick, 
  onActionClick, 
  onDetailsClick 
}) => {
  const { t } = useLanguage();
  const {
    approval_id,
    approval_name,
    department,
    category,
    sequence,
    priority_label,
    workflow_priority,
    priority_explanation,
    reason,
    matched_factors,
    dependencies,
    coverage_type,
    current_status,
    next_action,
    registration_ref,
    source,
    last_verified_date
  } = item;

  // Coverage badge config
  const getCoverageMeta = (type) => {
    switch (type) {
      case 'ONLINE':
        return {
          label: t('card_managed_anumatisetu'),
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-500'
        };
      case 'HYBRID':
        return {
          label: t('card_hybrid_workflow'),
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClass: 'bg-amber-500'
        };
      case 'EXTERNAL':
        return {
          label: t('card_external_required'),
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-500'
        };
      default:
        return {
          label: t('card_guide_mode'),
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-400'
        };
    }
  };

  const covMeta = getCoverageMeta(coverage_type);

  // Status badge config
  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'APPROVED':
      case 'ISSUED':
      case 'REGISTERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Check className="w-3.5 h-3.5" /> {t('card_active_license')}
          </span>
        );
      case 'SUBMITTED':
      case 'APPLIED':
      case 'LODGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
            <Check className="w-3.5 h-3.5 text-[#1F2A44]" /> {t('status_submitted')}
          </span>
        );
      case 'UNDER_REVIEW':
      case 'UNDER_SCRUTINY':
      case 'UNDER_VERIFICATION':
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5" /> {t('card_under_review')}
          </span>
        );
      case 'DOCUMENT_QUERY':
      case 'NEEDS_INFORMATION':
      case 'CORRECTION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" /> {t('card_action_required')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {t('card_not_started')}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between">
      {/* Top Header Strip */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1F2A44] text-[#E8DCC8] flex items-center justify-center font-bold text-sm shadow-sm">
              {String(sequence).padStart(2, '0')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {approval_name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {department}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {getStatusBadge(current_status)}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${covMeta.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${covMeta.dotClass}`}></span>
              {covMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-4 flex-1">
        {/* Why it may apply */}
        <div className="bg-[#FAF6F0] rounded-xl p-3.5 border border-[#E8DCC8]/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F2A44]/70">
              {t('card_why_apply')}
            </span>
            <span className="text-[10px] text-slate-500">{t('card_rule_trigger')}</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {reason}
          </p>
          {matched_factors && matched_factors.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {matched_factors.map((f, i) => (
                <span key={i} className="inline-block px-2 py-0.5 bg-white rounded text-[10px] font-medium text-slate-600 border border-[#E8DCC8]">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Priority & Dependency Section */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
              {t('card_priority_label')}
            </span>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${priority_label === 'Start First' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
              {priority_label === 'Start First' ? t('plan_filter_first') : (priority_label === 'Can Run in Parallel' ? t('plan_filter_parallel') : priority_label)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
              {priority_explanation}
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
              {t('card_prerequisites')}
            </span>
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <GitFork className="w-3.5 h-3.5 text-slate-500" />
              {dependencies && dependencies.length > 0 
                ? t('card_configured_rules', { count: dependencies.length })
                : t('card_no_blocking')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {dependencies && dependencies.length > 0
                ? dependencies[0].description
                : t('card_parallel_ok')}
            </p>
          </div>
        </div>

        {/* Active license banner if approved */}
        {registration_ref && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold block">
                {t('card_reg_ref')}
              </span>
              <span className="font-mono font-bold text-emerald-950">
                {registration_ref}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-300">
              {t('card_active_compliance')}
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={() => onWhyClick && onWhyClick(approval_id)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors"
          title="Ask Assistant why this is recommended"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#C6A75E]" />
          {t('card_btn_why')}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDetailsClick && onDetailsClick(item)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
          >
            {t('card_btn_details')}
          </button>
          
          <button
            onClick={() => onActionClick && onActionClick(item)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1F2A44] hover:bg-[#151D30] shadow-sm transition-all"
          >
            {current_status === 'APPROVED' ? t('card_btn_view_license') : (current_status === 'NOT_STARTED' ? t('card_btn_prepare') : t('card_btn_continue'))}
            <ArrowRight className="w-3.5 h-3.5 text-[#E8DCC8]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalCard;
