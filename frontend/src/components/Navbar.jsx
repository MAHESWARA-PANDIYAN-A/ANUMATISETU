import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Building2,
  FileCheck,
  FileText,
  Sparkles,
  BarChart3,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  Compass,
  Calendar,
  Layers,
  HelpCircle,
  ExternalLink,
  Award,
  Receipt,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';

import api from '../api/axios';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t, languages, currentLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [health, setHealth] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.get('/api/health');
        setHealth(res.data);
      } catch (err) {
        setHealth({ status: 'offline', database: 'disconnected' });
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    navigate(`/applicant?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'OFFICER':
        return 'bg-[#E8DCC8] text-[#1F2A44] border-[#C6A75E]';
      case 'ADMIN':
        return 'bg-[#C6A75E]/20 text-[#1F2A44] border-[#C6A75E]';
      case 'APPLICANT':
      default:
        return 'bg-[#E8DCC8]/60 text-[#1F2A44] border-[#D6C4A8]';
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="glass-panel sticky top-0 z-50 px-4 sm:px-6 py-2.5 border-b border-[#E8DCC8] backdrop-blur-xl bg-white/95 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand: ANUMATISETU */}
          <Link to="/" className="flex items-center space-x-3 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1F2A44] via-[#2D3D60] to-[#C6A75E] flex items-center justify-center shadow-md shadow-[#1F2A44]/20 group-hover:scale-105 transition-transform duration-200">
              <Compass className="w-5 h-5 text-[#FAF6F0]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-[#1F2A44] group-hover:text-[#C6A75E] transition-colors">
                  {t('brand_name')}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8DCC8]/70 text-[#1F2A44] border border-[#D6C4A8] font-mono font-semibold">
                  {t('prototype_badge')}
                </span>
              </div>
              <p className="text-[11px] text-[#1F2A44]/70 hidden sm:block font-medium">
                {t('brand_subtitle')}
              </p>
            </div>
          </Link>

          {/* Desktop Center Nav */}
          <div className="hidden lg:flex items-center space-x-1 text-xs font-medium">
            {isAuthenticated && (user?.role === 'APPLICANT' || user?.role === 'ADMIN') && (
              <>
                <Link
                  to="/applicant"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/applicant')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t('nav_dashboard')}
                </Link>

                <Link
                  to="/onboarding/business"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/onboarding/business') || isActive('/applicant/business-profile')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-[#1F2A44]" />
                  {t('nav_my_business')}
                </Link>

                <Link
                  to="/approvals"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/approvals') || isActive('/requirements')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t('nav_approval_plan')}
                </Link>

                <Link
                  to="/applicant/documents"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/applicant/documents') || isActive('/documents')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#1F2A44]" />
                  {t('nav_documents')}
                </Link>

                <Link
                  to="/compliance"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/compliance') || isActive('/compliance/calendar')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t('nav_compliance')}
                </Link>

                <Link
                  to="/coverage"
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive('/coverage')
                      ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                      : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#C6A75E]" />
                  {t('nav_coverage')}
                </Link>
              </>
            )}

            <Link
              to="/assistant"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                isActive('/assistant')
                  ? 'bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] font-bold shadow-xs'
                  : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
              <span>{t('nav_assistant')}</span>
            </Link>

            {isAuthenticated && (user?.role === 'OFFICER' || user?.role === 'ADMIN') && (
              <Link
                to="/officer"
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive('/officer')
                    ? 'bg-[#1F2A44] text-[#FAF6F0] border border-[#1F2A44] font-bold shadow-xs'
                    : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
                {t('nav_officer_desk')}
              </Link>
            )}

            {isAuthenticated && user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive('/admin')
                    ? 'bg-[#1F2A44] text-[#FAF6F0] border border-[#1F2A44] font-bold shadow-xs'
                    : 'text-[#1F2A44]/80 hover:text-[#1F2A44] hover:bg-[#E8DCC8]/40'
                }`}
              >
                {t('nav_admin')}
              </Link>
            )}
          </div>

          {/* Right Section: Language Selector + Search + Health + Auth */}
          <div className="flex items-center space-x-2">

            {/* Multilingual Selector Dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8] border border-[#E8DCC8] text-xs font-semibold text-[#1F2A44] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Select Language / भाषा निवडा"
              >
                <span className="text-sm">{currentLanguage.flag}</span>
                <span className="font-bold">{currentLanguage.nativeName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#1F2A44]/60" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white border border-[#E8DCC8] shadow-xl py-1.5 z-50 animate-fadeIn text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#1F2A44]/60 uppercase tracking-wider border-b border-[#E8DCC8]/60">
                    {t('lang_selector_label')} / Select Language
                  </div>
                  {languages.map((lang) => {
                    const isCurrent = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#E8DCC8]/80 text-[#1F2A44] font-bold'
                            : 'text-[#1F2A44]/80 hover:bg-[#FAF6F0] hover:text-[#1F2A44]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.nativeName}</span>
                          <span className="text-[10px] text-[#1F2A44]/50">({lang.label})</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-[#C6A75E]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Global Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition-colors"
              title="Search Applications & Approvals (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Health Status Pill */}
            <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44]">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-[#C6A75E] animate-pulse' : 'bg-[#D6C4A8]'}`} />
              <span>{health?.status === 'healthy' ? t('nav_platform_active') : t('nav_connecting')}</span>
            </div>

            {/* User Profile / Auth State */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-[#1F2A44] leading-tight">{user?.full_name}</p>
                  <span className={`inline-block text-[10px] font-mono px-1.5 py-0.2 rounded border ${getRoleBadge(user?.role)}`}>
                    {user?.role} {user?.department ? `• ${user.department.split(' ')[0]}` : ''}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8] hover:text-[#1F2A44] text-[#1F2A44]/70 border border-[#E8DCC8] transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] bg-[#FAF6F0] border border-[#E8DCC8] transition-colors"
                >
                  {t('nav_sign_in')}
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-[#FAF6F0] bg-gradient-to-r from-[#1F2A44] via-[#2D3D60] to-[#C6A75E] hover:from-[#141C2E] hover:to-[#A88B42] shadow-sm transition-all"
                >
                  {t('nav_get_started')}
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-[#FAF6F0] text-[#1F2A44] border border-[#E8DCC8]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden pt-3 pb-2 border-t border-[#E8DCC8] mt-2.5 space-y-1 text-xs">
            {isAuthenticated && (user?.role === 'APPLICANT' || user?.role === 'ADMIN') && (
              <>
                <Link
                  to="/applicant"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_dashboard')}
                </Link>
                <Link
                  to="/onboarding/business"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_my_business')}
                </Link>
                <Link
                  to="/approvals"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_approval_plan')}
                </Link>
                <Link
                  to="/applicant/documents"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_documents')}
                </Link>
                <Link
                  to="/compliance"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_compliance')}
                </Link>
                <Link
                  to="/coverage"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
                >
                  {t('nav_coverage')}
                </Link>
              </>
            )}
            <Link
              to="/assistant"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
            >
              {t('nav_assistant')}
            </Link>
            <Link
              to="/schemes"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
            >
              {t('nav_schemes')}
            </Link>
            <Link
              to="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-[#1F2A44] hover:bg-[#E8DCC8] font-medium"
            >
              {t('nav_analytics')}
            </Link>
            {isAuthenticated && (user?.role === 'OFFICER' || user?.role === 'ADMIN') && (
              <Link
                to="/officer"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-[#FAF6F0] bg-[#1F2A44] font-medium"
              >
                {t('nav_officer_desk')}
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F2A44]/60 backdrop-blur-sm flex items-start justify-center pt-24 p-4">
          <div className="glass-panel w-full max-w-xl bg-[#FAF6F0] border border-[#E8DCC8] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8DCC8]">
              <span className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-[#C6A75E]" />
                {t('nav_global_search')}
              </span>
              <button onClick={() => setSearchOpen(false)} className="text-[#1F2A44]/60 hover:text-[#1F2A44] text-xs font-mono">ESC / Close</button>
            </div>
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder={t('nav_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              />
              <div className="flex items-center justify-between text-xs text-[#1F2A44]/70 pt-1">
                <span>{t('nav_search_sub')}</span>
                <button type="submit" className="px-3.5 py-1.5 bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] rounded-lg font-semibold text-xs transition-colors shadow-xs">
                  {t('nav_global_search')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
