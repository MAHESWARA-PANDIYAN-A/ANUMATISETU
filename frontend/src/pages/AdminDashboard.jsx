import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, BarChart3, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [backendData, setBackendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const response = await api.get('/api/v1/admin/dashboard');
        setBackendData(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load admin intelligence center.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="glass-panel rounded-2xl p-8 border border-rose-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>ANUMATISETU Admin Console · Full Platform Privilege</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Administrator Intelligence Center
            </h1>
            <p className="text-sm text-gray-400">
              System Administration, Master Clearance Configurations & State Analytics
            </p>
          </div>
          <div className="text-right font-mono text-xs text-rose-300 bg-gray-900/80 px-4 py-2.5 rounded-xl border border-gray-800">
            {user?.email}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Backend API Verification */}
      <div className="glass-card rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-rose-400" />
            <h3 className="text-base font-bold text-white">Backend Protected Endpoint Response</h3>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
            GET /api/v1/admin/dashboard
          </span>
        </div>

        {loading ? (
          <div className="py-6 flex items-center justify-center space-x-3 text-sm text-gray-400">
            <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Validating admin permissions...</span>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 font-mono text-xs text-gray-300 overflow-x-auto">
            <pre className="text-rose-300">{JSON.stringify(backendData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
