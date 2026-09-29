import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Compass,
  ArrowRight,
  CheckCircle2,
  Database,
  Lock,
  Server,
  Layers,
  Building2,
  FileCheck,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Send,
  Workflow,
  HelpCircle,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import api from '../api/axios';

const Home = () => {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.get('/api/health');
        setHealthData(res.data);
      } catch (err) {
        setHealthData({ status: 'offline', database: 'disconnected' });
      }
    };
    fetchHealth();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-20">
      
      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-12 gap-12 items-center pt-2 sm:pt-6">
        <div className="lg:col-span-7 space-y-6 text-left">
          
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44] text-xs font-mono font-medium shadow-xs">
            <Compass className="w-3.5 h-3.5 text-[#C6A75E]" />
            <span className="font-bold text-[#1F2A44]">{t('brand_name')}</span>
            <span className="text-[#C6A75E]">•</span>
            <span className="text-[#1F2A44]/70">{t('brand_subtitle')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1F2A44] tracking-tight leading-[1.15]">
            {t('tagline_hero_1')}{' '}
            <span className="bg-gradient-to-r from-[#1F2A44] via-[#C6A75E] to-[#1F2A44] bg-clip-text text-transparent">
              {t('tagline_hero_2')}
            </span>
          </h1>

          <p className="text-[#1F2A44]/75 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
            {t('hero_description')}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/register"
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-lg shadow-[#1F2A44]/20 hover:scale-[1.01] transition-all flex items-center gap-2 border border-[#1F2A44]"
                >
                  <span>{t('btn_get_started')}</span>
                  <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] font-semibold text-sm transition-all shadow-xs"
                >
                  {t('btn_explore_demo')}
                </Link>
              </>
            ) : (
              <div className="flex flex-wrap gap-4">
                {(user?.role === 'APPLICANT' || user?.role === 'ADMIN') && (
                  <Link
                    to="/applicant"
                    className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-lg shadow-[#1F2A44]/20 transition-all flex items-center gap-2 border border-[#1F2A44]"
                  >
                    <Layers className="w-4 h-4 text-[#C6A75E]" />
                    <span>{t('btn_open_dashboard')}</span>
                  </Link>
                )}
                {(user?.role === 'OFFICER' || user?.role === 'ADMIN') && (
                  <Link
                    to="/officer"
                    className="px-6 py-3.5 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] font-semibold text-sm shadow-md shadow-[#1F2A44]/20 transition-all flex items-center gap-2 border border-[#C6A75E]/40"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C6A75E]" />
                    <span>{t('nav_officer_desk')}</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Quick value props */}
          <div className="pt-4 grid grid-cols-3 gap-3 border-t border-[#E8DCC8] text-xs text-[#1F2A44]/70 font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('hero_prop_zero_uploads')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('hero_prop_ocr')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('hero_prop_sla')}</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Preview */}
        <div className="lg:col-span-5">
          <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] shadow-xl relative overflow-hidden space-y-4 bg-white/95">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#1F2A44] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#C6A75E] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#E8DCC8] inline-block" />
                <span className="text-xs font-mono text-[#1F2A44] font-semibold ml-2">{t('hero_pipeline_title')}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8] font-bold">
                {t('hero_single_vault_badge')}
              </span>
            </div>

            {/* Simulated Workflow steps */}
            <div className="space-y-2.5">
              {[
                { title: t('pipe_biz_profile'), desc: t('pipe_biz_profile_desc'), status: t('pipe_status_complete'), icon: Building2, color: "text-[#1F2A44]", bg: "bg-[#FAF6F0] border-[#E8DCC8]" },
                { title: t('pipe_doc_vault'), desc: t('pipe_doc_vault_desc'), status: t('pipe_status_secure'), icon: FileCheck, color: "text-[#C6A75E]", bg: "bg-white border-[#E8DCC8]" },
                { title: t('pipe_appr_disc'), desc: t('pipe_appr_disc_desc'), status: t('pipe_status_mapped'), icon: Sparkles, color: "text-[#1F2A44]", bg: "bg-[#FAF6F0] border-[#E8DCC8]" },
                { title: t('pipe_app_conn'), desc: t('pipe_app_conn_desc'), status: t('pipe_status_active'), icon: Send, color: "text-[#1F2A44]", bg: "bg-white border-[#C6A75E]/60 shadow-xs" },
                { title: t('pipe_dept_scrutiny'), desc: t('pipe_dept_scrutiny_desc'), status: t('pipe_status_in_scrutiny'), icon: Workflow, color: "text-[#1F2A44]", bg: "bg-[#FAF6F0] border-[#E8DCC8]" },
                { title: t('pipe_clearance_track'), desc: t('pipe_clearance_track_desc'), status: t('pipe_status_coordinated'), icon: Clock, color: "text-[#C6A75E]", bg: "bg-[#1F2A44] text-[#FAF6F0] border-[#1F2A44]" },
              ].map((step, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${step.bg}`}>
                  <div className="flex items-center gap-2.5">
                    <step.icon className={`w-4 h-4 ${step.color}`} />
                    <div>
                      <p className={`font-bold leading-tight ${step.status === t('pipe_status_coordinated') ? 'text-[#FAF6F0]' : 'text-[#1F2A44]'}`}>{step.title}</p>
                      <p className={`text-[10px] leading-tight ${step.status === t('pipe_status_coordinated') ? 'text-[#FAF6F0]/70' : 'text-[#1F2A44]/60'}`}>{step.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    step.status === t('pipe_status_coordinated') 
                      ? 'bg-[#C6A75E] text-[#1F2A44]' 
                      : 'bg-[#E8DCC8]/60 text-[#1F2A44]'
                  }`}>
                    {step.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-[#1F2A44]/70 font-mono">
                {t('hero_simulated_portals')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Problem Section ─────────────────────────────────────────── */}
      <div className="space-y-8 pt-4">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-[#1F2A44] px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] font-bold">
            {t('home_challenge_badge')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44]">
            {t('home_challenge_title')}
          </h2>
          <p className="text-xs sm:text-sm text-[#1F2A44]/70">
            {t('home_challenge_sub')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              num: "01",
              title: t('prob_1_title'),
              desc: t('prob_1_desc'),
            },
            {
              num: "02",
              title: t('prob_2_title'),
              desc: t('prob_2_desc'),
            },
            {
              num: "03",
              title: t('prob_3_title'),
              desc: t('prob_3_desc'),
            },
            {
              num: "04",
              title: t('prob_4_title'),
              desc: t('prob_4_desc'),
            },
          ].map((prob) => (
            <div key={prob.num} className="glass-card rounded-2xl p-6 border border-[#E8DCC8] space-y-3 relative overflow-hidden bg-white shadow-xs">
              <span className="text-2xl font-black font-mono text-[#C6A75E] block">{prob.num}</span>
              <h3 className="text-base font-bold text-[#1F2A44]">{prob.title}</h3>
              <p className="text-xs text-[#1F2A44]/70 leading-relaxed">{prob.desc}</p>
            </div>
          ))}
        </div>

        {/* Bridge Banner */}
        <div className="glass-panel rounded-2xl p-6 border border-[#E8DCC8] bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] text-center space-y-2">
          <h3 className="text-lg font-bold text-[#1F2A44]">
            {t('home_bridge_title')}
          </h3>
          <p className="text-xs text-[#1F2A44]/75 max-w-2xl mx-auto">
            {t('home_bridge_desc')}
          </p>
        </div>
      </div>

      {/* ─── How ANUMATISETU Works (5 Steps) ──────────────────────────────── */}
      <div className="space-y-8 pt-4">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-[#1F2A44] px-3 py-1 rounded-full bg-[#E8DCC8] border border-[#D6C4A8] font-bold">
            {t('home_how_badge')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44]">
            {t('home_how_title')}
          </h2>
          <p className="text-xs sm:text-sm text-[#1F2A44]/70">
            {t('home_how_sub')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: "1",
              title: t('step_1_title'),
              desc: t('step_1_desc'),
              icon: Building2,
            },
            {
              step: "2",
              title: t('step_2_title'),
              desc: t('step_2_desc'),
              icon: Sparkles,
            },
            {
              step: "3",
              title: t('step_3_title'),
              desc: t('step_3_desc'),
              icon: FileCheck,
            },
            {
              step: "4",
              title: t('step_4_title'),
              desc: t('step_4_desc'),
              icon: Send,
            },
            {
              step: "5",
              title: t('step_5_title'),
              desc: t('step_5_desc'),
              icon: Clock,
            },
          ].map((s) => (
            <div key={s.step} className="glass-card rounded-2xl p-5 border border-[#E8DCC8] space-y-3 flex flex-col justify-between bg-white shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FAF6F0] border border-[#E8DCC8]">
                    <s.icon className="w-4 h-4 text-[#1F2A44]" />
                  </div>
                  <span className="font-mono text-xs font-bold text-[#C6A75E]">
                    {t('step_number', { num: s.step })}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#1F2A44] leading-snug">{s.title}</h4>
                <p className="text-xs text-[#1F2A44]/70 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Integrated Workspaces (Applicant vs Officer) ─────────────── */}
      <div className="grid md:grid-cols-2 gap-6 pt-4">
        {/* Applicant Workspace */}
        <div className="glass-card rounded-2xl p-8 border border-[#E8DCC8] space-y-6 relative overflow-hidden bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] flex items-center justify-center text-[#1F2A44]">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono uppercase text-[#1F2A44] px-2.5 py-1 rounded-md bg-[#E8DCC8] border border-[#D6C4A8] font-bold">
              {t('ws_applicant_badge')}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#1F2A44]">{t('ws_applicant_title')}</h3>
            <p className="text-xs text-[#1F2A44]/75 leading-relaxed">
              {t('ws_applicant_desc')}
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#1F2A44]/80 font-medium">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_applicant_b1')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_applicant_b2')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_applicant_b3')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_applicant_b4')}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/applicant"
              className="text-xs font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1.5 transition-colors"
            >
              <span>{t('ws_applicant_btn')}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
            </Link>
          </div>
        </div>

        {/* Officer Console */}
        <div className="glass-card rounded-2xl p-8 border border-[#E8DCC8] space-y-6 relative overflow-hidden bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] flex items-center justify-center text-[#1F2A44]">
              <ShieldCheck className="w-6 h-6 text-[#C6A75E]" />
            </div>
            <span className="text-xs font-mono uppercase text-[#1F2A44] px-2.5 py-1 rounded-md bg-[#FAF6F0] border border-[#E8DCC8] font-bold">
              {t('ws_officer_badge')}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#1F2A44]">{t('ws_officer_title')}</h3>
            <p className="text-xs text-[#1F2A44]/75 leading-relaxed">
              {t('ws_officer_desc')}
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#1F2A44]/80 font-medium">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_officer_b1')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_officer_b2')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_officer_b3')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>{t('ws_officer_b4')}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/officer"
              className="text-xs font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1.5 transition-colors"
            >
              <span>{t('ws_officer_btn')}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C6A75E]" />
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
