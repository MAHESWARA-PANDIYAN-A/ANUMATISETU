import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Lock, Mail, User, Phone, Building2, ArrowRight, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'APPLICANT',
    department: 'MPCB (Pollution Control)',
    phone: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const fillSampleRegistration = (roleType) => {
    const randomId = Math.floor(100 + Math.random() * 900);
    if (roleType === 'APPLICANT') {
      setFormData({
        full_name: `Rajesh Sharma (Enterprise #${randomId})`,
        email: `entrepreneur_${randomId}@techcorp.in`,
        password: 'Password123!',
        role: 'APPLICANT',
        department: '',
        phone: '+91 98200 11223',
      });
    } else {
      setFormData({
        full_name: `Officer S. Shinde`,
        email: `officer_${randomId}@mpcb.gov.in`,
        password: 'Password123!',
        role: 'OFFICER',
        department: 'MPCB (Pollution Control)',
        phone: '+91 98200 44556',
      });
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (formData.full_name.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      setError('Please provide a valid email address (e.g. name@company.com).');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    const payload = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      role: formData.role,
      phone: formData.phone.trim() || null,
      department: formData.role === 'OFFICER' ? (formData.department || 'General Scrutiny') : null,
    };

    const result = await register(payload);
    setLoading(false);

    if (result.success) {
      if (result.user.role === 'OFFICER') {
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

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F2A44] border border-[#C6A75E]/30 mx-auto flex items-center justify-center shadow-lg shadow-[#1F2A44]/15">
            <Building2 className="w-6 h-6 text-[#C6A75E]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1F2A44] tracking-tight">{t('auth_register_title')}</h2>
          <p className="text-xs text-[#1F2A44]/70">{t('auth_register_sub')}</p>
        </div>

        {/* Demo Fast-Fill Bar */}
        <div className="glass-card rounded-xl p-3.5 border border-[#E8DCC8] space-y-2 bg-white shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-[#1F2A44] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A75E]" />
            <span>Quick Fill Sample Registration:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillSampleRegistration('APPLICANT')}
              className="px-2.5 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8]/40 border border-[#E8DCC8] text-[#1F2A44] text-xs font-semibold transition-colors cursor-pointer"
            >
              Fill Sample Applicant
            </button>
            <button
              type="button"
              onClick={() => fillSampleRegistration('OFFICER')}
              className="px-2.5 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#E8DCC8]/40 border border-[#E8DCC8] text-[#1F2A44] text-xs font-semibold transition-colors cursor-pointer"
            >
              Fill Sample Officer
            </button>
          </div>
        </div>

        {/* Container */}
        <div className="glass-panel rounded-2xl p-8 border border-[#E8DCC8] space-y-6 shadow-lg bg-white">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-rose-300 text-rose-800 text-xs flex items-center gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">Select Role</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'APPLICANT' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.role === 'APPLICANT'
                      ? 'bg-[#1F2A44] text-[#FAF6F0] border-[#1F2A44] shadow-sm shadow-[#1F2A44]/20'
                      : 'bg-[#FAF6F0] text-[#1F2A44] border-[#E8DCC8] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-[#C6A75E]" />
                  <span>Applicant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'OFFICER' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.role === 'OFFICER'
                      ? 'bg-[#1F2A44] text-[#FAF6F0] border-[#1F2A44] shadow-sm shadow-[#1F2A44]/20'
                      : 'bg-[#FAF6F0] text-[#1F2A44] border-[#E8DCC8] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C6A75E]" />
                  <span>Officer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.role === 'ADMIN'
                      ? 'bg-[#1F2A44] text-[#FAF6F0] border-[#1F2A44] shadow-sm shadow-[#1F2A44]/20'
                      : 'bg-[#FAF6F0] text-[#1F2A44] border-[#E8DCC8] hover:bg-[#E8DCC8]/40'
                  }`}
                >
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_fullname_lbl')}</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="text"
                  required
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh Patel"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-[#1F2A44]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_email_lbl')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="email"
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@enterprise.com"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-[#1F2A44]"
                />
              </div>
            </div>

            {/* Department (If Officer) */}
            {formData.role === 'OFFICER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1F2A44]">Designated Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-[#1F2A44]"
                >
                  <option value="MPCB (Pollution Control)">MPCB (Pollution Control)</option>
                  <option value="CFO (Fire Services)">CFO (Fire Services)</option>
                  <option value="DISH (Factory Inspectorate)">DISH (Factory Inspectorate)</option>
                  <option value="MIDC (Industrial Development)">MIDC (Industrial Development)</option>
                  <option value="MSEDCL (Power Feasibility)">MSEDCL (Power Feasibility)</option>
                  <option value="Labour Commissionerate">Labour Commissionerate</option>
                  <option value="District Industries Centre (DIC)">District Industries Centre (DIC)</option>
                </select>
              </div>
            )}

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_phone_lbl')} (Optional)</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-[#1F2A44]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1F2A44]">{t('auth_password_lbl')}</label>
                <span className="text-[10px] text-[#1F2A44]/60 font-mono">Min 6 characters</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F2A44]/50" />
                <input
                  type="password"
                  required
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-[#1F2A44]"
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>{t('auth_btn_register')}</span>
                  <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-[#E8DCC8]">
            <p className="text-xs text-[#1F2A44]/70">
              Already have an account?{' '}
              <Link to="/login" className="text-[#1F2A44] hover:text-[#C6A75E] font-bold transition-colors">
                {t('auth_btn_login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
