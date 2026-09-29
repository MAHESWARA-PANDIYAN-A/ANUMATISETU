import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Lock, Mail, ArrowRight, AlertCircle, Sparkles, Building2 } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect');
  const wasSessionExpired = queryParams.get('expired') === '1';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      if (redirectPath) {
        navigate(redirectPath);
      } else if (result.user.role === 'OFFICER') {
        navigate('/officer');
      } else if (result.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/applicant');
      }
    } else {
      setError(result.error);
    }
  };

  const fillDemoCredentials = (role) => {
    if (role === 'APPLICANT') {
      setEmail('applicant@demo.com');
      setPassword('Password123!');
    } else if (role === 'OFFICER') {
      setEmail('officer.mpcb@gov.in');
      setPassword('Password123!');
    } else if (role === 'ADMIN') {
      setEmail('admin@sih26130.gov.in');
      setPassword('Password123!');
    }
    setError('');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F2A44] border border-[#C6A75E]/30 mx-auto flex items-center justify-center shadow-lg shadow-[#1F2A44]/15">
            <Building2 className="w-6 h-6 text-[#C6A75E]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1F2A44] tracking-tight">{t('auth_login_title')}</h2>
          <p className="text-xs text-[#1F2A44]/70">{t('auth_login_sub')}</p>
        </div>

        {/* Demo Fast-Fill Bar */}
        <div className="glass-card rounded-xl p-3.5 border border-[#E8DCC8] space-y-2 bg-white shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-[#1F2A44] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
            <span>Quick Demo Credentials (One-Click Auto-Fill):</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoCredentials('APPLICANT')}
              className="px-2 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8]/40 border border-[#E8DCC8] text-[#1F2A44] text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Applicant
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials('OFFICER')}
              className="px-2 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8]/40 border border-[#E8DCC8] text-[#1F2A44] text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Officer (MPCB)
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials('ADMIN')}
              className="px-2 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8]/40 border border-[#E8DCC8] text-[#1F2A44] text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="glass-panel rounded-2xl p-8 border border-[#E8DCC8] space-y-6 shadow-lg bg-white">
          {wasSessionExpired && (
            <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#C6A75E] text-[#1F2A44] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C6A75E] shrink-0" />
              <span>Your session has expired. Please log in again to continue.</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#FAF6F0] border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_email_lbl')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@enterprise.com"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all text-[#1F2A44]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_password_lbl')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all text-[#1F2A44]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-md shadow-[#1F2A44]/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#1F2A44]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-[#C6A75E] rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{t('auth_btn_login')}</span>
                  <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-[#E8DCC8]">
            <p className="text-xs text-[#1F2A44]/70">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#1F2A44] hover:text-[#C6A75E] font-bold transition-colors">
                {t('auth_btn_register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
