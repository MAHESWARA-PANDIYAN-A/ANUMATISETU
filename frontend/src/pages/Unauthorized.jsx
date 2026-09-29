import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

const Unauthorized = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center shadow-md shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-rose-700 px-2.5 py-1 rounded bg-rose-50 border border-rose-200">
            HTTP 403: Forbidden
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h2>
          <p className="text-sm text-slate-500">
            Your current account role (<span className="text-slate-900 font-mono font-bold">{user?.role || 'Guest'}</span>) does not have authorization to access this departmental workspace.
          </p>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-200 text-xs text-slate-600 text-left space-y-1.5 font-mono bg-white shadow-xs">
          <p><span className="text-slate-400">Active User:</span> {user?.full_name} ({user?.email})</p>
          <p><span className="text-slate-400">Assigned Role:</span> <span className="text-amber-700 font-bold">{user?.role}</span></p>
          <p><span className="text-slate-400">Enforcement:</span> RBAC Protected Endpoint Guard</p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            to="/"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
