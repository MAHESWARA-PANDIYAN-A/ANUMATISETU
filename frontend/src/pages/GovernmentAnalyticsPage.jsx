import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  Building2,
  Filter,
  Calendar,
  Layers,
  RefreshCw,
  ShieldCheck,
  Search,
  Activity,
  Zap,
  ArrowUpRight,
  Info,
  ChevronRight,
  AlertOctagon
} from "lucide-react";
import { getAnalyticsDashboard } from "../api/analytics";
import { useLanguage } from "../context/LanguageContext";

export default function GovernmentAnalyticsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Filter States
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    department_id: "ALL",
    status: "ALL",
    industry: "ALL",
    state: "ALL",
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (activeFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      const data = await getAnalyticsDashboard(activeFilters);
      setAnalyticsData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load analytics dashboard:", err);
      setError("Failed to fetch analytics metrics from the database engine.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchDashboardData(filters);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      start_date: "",
      end_date: "",
      department_id: "ALL",
      status: "ALL",
      industry: "ALL",
      state: "ALL",
    };
    setFilters(defaultFilters);
    fetchDashboardData(defaultFilters);
  };

  const metrics = analyticsData?.metrics || {
    total_applications: 0,
    submitted_applications: 0,
    pending_applications: 0,
    approved_applications: 0,
    rejected_applications: 0,
    overdue_applications: 0,
    inspections_pending: 0,
    average_processing_duration: 0.0,
  };

  const charts = analyticsData?.charts || {
    application_status_distribution: [],
    department_workload: [],
    sla_status_distribution: [],
    department_processing_time: [],
    industry_processing_time: [],
    monthly_application_volume: [],
  };

  const bottlenecks = analyticsData?.bottlenecks || [];

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem", color: "#1e293b" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #092e20 100%)",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          color: "#ffffff",
          boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.4)",
          marginBottom: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.2)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#34d399",
                    padding: "0.35rem 0.85rem",
                    borderRadius: "9999px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <Activity size={15} /> {t('brand_name')} {t('analytics_badge')}
                </span>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    padding: "0.35rem 0.85rem",
                    borderRadius: "9999px",
                    fontSize: "0.8rem",
                    color: "#94a3b8",
                  }}
                >
                  Live DB Telemetry Engine
                </span>
              </div>

              <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 0.5rem 0", letterSpacing: "-0.025em" }}>
                {t('analytics_title')}
              </h1>
              <p style={{ fontSize: "1.05rem", color: "#94a3b8", maxWidth: "850px", lineHeight: 1.6, margin: 0 }}>
                {t('analytics_subtitle')}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
              <button
                onClick={() => fetchDashboardData(filters)}
                disabled={loading}
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  padding: "0.6rem 1.1rem",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.2s",
                }}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "Calculating..." : t('portal_sync_records')}
              </button>
              {lastRefreshed && (
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Last Updated: {lastRefreshed}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          padding: "1.25rem 1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", color: "#334155", fontWeight: 700, fontSize: "0.95rem" }}>
          <Filter size={18} color="#047857" />
          Filter Analytics Dimension
        </div>

        <form onSubmit={handleFilterSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
              {t('card_status_label')}
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="PARTIALLY_APPROVED">Partially Approved</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="NEEDS_INFORMATION">Needs Information</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
              {t('profile_industry')}
            </label>
            <select
              value={filters.industry}
              onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <option value="ALL">All Industries</option>
              <option value="Food Processing">Food Processing</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Textiles">Textiles & Garments</option>
              <option value="Chemical">Chemical & Petrochemical</option>
              <option value="Pharmaceuticals">Pharmaceuticals</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
              {t('profile_state')}
            </label>
            <select
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <option value="ALL">All States</option>
              <option value="Maharashtra">Maharashtra</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: "#047857",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {t('btn_clear')}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "1rem", color: "#b91c1c", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* KPI Metric Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Total Applications */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('analytics_stat_apps')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={18} color="#047857" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
            {metrics.total_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Registered single-window dossiers</span>
        </div>

        {/* Submitted Applications */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('status_submitted')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileCheck size={18} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#2563eb", fontFamily: "monospace" }}>
            {metrics.submitted_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Formally lodged by applicants</span>
        </div>

        {/* Pending Applications */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('status_under_review')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#d97706", fontFamily: "monospace" }}>
            {metrics.pending_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Under departmental scrutiny</span>
        </div>

        {/* Approved Applications */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('analytics_stat_approved')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} color="#16a34a" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#16a34a", fontFamily: "monospace" }}>
            {metrics.approved_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Clearance certificates issued</span>
        </div>

        {/* Rejected Applications */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('status_rejected')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={18} color="#dc2626" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#dc2626", fontFamily: "monospace" }}>
            {metrics.rejected_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Non-compliant submissions</span>
        </div>

        {/* Overdue Applications */}
        <div style={{ background: metrics.overdue_applications > 0 ? "#fff1f2" : "#ffffff", borderRadius: "12px", padding: "1.25rem", border: metrics.overdue_applications > 0 ? "1px solid #fecdd3" : "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: metrics.overdue_applications > 0 ? "#be123c" : "#64748b", textTransform: "uppercase" }}>SLA Overdue</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#ffe4e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={18} color="#e11d48" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#e11d48", fontFamily: "monospace" }}>
            {metrics.overdue_applications}
          </div>
          <span style={{ fontSize: "0.75rem", color: metrics.overdue_applications > 0 ? "#be123c" : "#64748b" }}>Exceeded statutory deadline</span>
        </div>

        {/* Inspections Pending */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('card_site_inspection')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={18} color="#4f46e5" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#4f46e5", fontFamily: "monospace" }}>
            {metrics.inspections_pending}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Scheduled site field visits</span>
        </div>

        {/* Avg Processing Duration */}
        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t('analytics_stat_avg_days')}</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={18} color="#0d9488" />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0d9488", fontFamily: "monospace" }}>
            {metrics.average_processing_duration} <span style={{ fontSize: "1rem", fontWeight: 500, color: "#64748b" }}>days</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>From submission to completion</span>
        </div>
      </div>

      {/* Bottleneck Observation Panel */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertOctagon size={20} color="#e11d48" />
              {t('analytics_tab_bottlenecks')}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
              Empirical anomaly detection identifying departmental queues with elevated processing durations.
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              padding: "0.3rem 0.65rem",
              borderRadius: "6px",
              color: "#475569",
              fontWeight: 600,
            }}
          >
            Strict non-causation analysis
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {bottlenecks.map((b) => (
            <div
              key={b.department_id}
              style={{
                borderRadius: "10px",
                padding: "1rem 1.25rem",
                border: b.is_bottleneck ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                background: b.is_bottleneck ? "#fff1f2" : "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Building2 size={18} color={b.is_bottleneck ? "#e11d48" : "#475569"} />
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{b.department_name}</strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", background: "#ffffff", padding: "0.15rem 0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                    {b.department_code}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "6px",
                    background: b.is_bottleneck ? "#ffe4e6" : "#dcfce7",
                    color: b.is_bottleneck ? "#be123c" : "#166534",
                    border: b.is_bottleneck ? "1px solid #fecdd3" : "1px solid #bbf7d0",
                  }}
                >
                  {b.flag}
                </span>
              </div>

              <div style={{ fontSize: "0.85rem", color: b.is_bottleneck ? "#9f1239" : "#475569", lineHeight: 1.5 }}>
                {b.observation}
              </div>

              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" }}>
                <span>Active Pending: <strong>{b.pending_clearances}</strong></span>
                <span>Overdue Clearances: <strong>{b.overdue_clearances}</strong></span>
                <span>Avg Pending Duration: <strong>{b.average_pending_days} days</strong></span>
                <span>Global Benchmark: <strong>{b.global_benchmark_days} days</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section: 5 Visualizations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        {/* Chart 1: Application Status Distribution */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BarChart3 size={18} color="#047857" /> 1. Application Status Distribution
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {charts.application_status_distribution.map((item) => {
              const total = metrics.total_applications || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{item.label}</span>
                    <span style={{ color: "#64748b" }}>{item.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: item.status === "APPROVED" ? "#10b981" : item.status === "REJECTED" ? "#ef4444" : item.status === "UNDER_REVIEW" ? "#f59e0b" : "#3b82f6",
                        borderRadius: "9999px",
                        transition: "width 0.5s ease-in-out",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: SLA Status Breakdown */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={18} color="#0284c7" /> 2. SLA Compliance Distribution
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {charts.sla_status_distribution.map((item) => {
              const total = metrics.total_applications || 1;
              const pct = Math.round((item.count / total) * 100);
              const colorMap = {
                ON_TRACK: "#10b981",
                APPROACHING: "#eab308",
                AT_RISK: "#f97316",
                OVERDUE: "#ef4444",
                COMPLETED: "#6366f1",
              };
              return (
                <div key={item.sla_status}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{item.label}</span>
                    <span style={{ color: "#64748b" }}>{item.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: colorMap[item.sla_status] || "#94a3b8",
                        borderRadius: "9999px",
                        transition: "width 0.5s ease-in-out",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart 3: Department Workload Matrix */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Building2 size={18} color="#047857" /> 3. Inter-Departmental Clearance Workload
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Department</th>
                <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "center" }}>Total Clearances</th>
                <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "center" }}>Pending</th>
                <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "center" }}>Approved</th>
                <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "center" }}>Rejected</th>
                <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "center" }}>Inspection Pending</th>
              </tr>
            </thead>
            <tbody>
              {charts.department_workload.map((dw) => (
                <tr key={dw.department_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#1e293b" }}>
                    {dw.department_name} <span style={{ fontSize: "0.75rem", color: "#64748b" }}>({dw.department_code})</span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontWeight: 700 }}>{dw.total_clearances}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", color: dw.pending > 0 ? "#d97706" : "#64748b", fontWeight: 600 }}>{dw.pending}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{dw.approved}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", color: dw.rejected > 0 ? "#dc2626" : "#64748b" }}>{dw.rejected}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", color: dw.inspection_pending > 0 ? "#4f46e5" : "#64748b" }}>{dw.inspection_pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row with Chart 4 (Processing Time) and Chart 5 (Monthly Volume) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Chart 4: Average Processing Time Benchmarks */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} color="#0d9488" /> 4. Average Processing Duration by Department (Days)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {charts.department_processing_time.map((dpt) => {
              const maxDays = Math.max(...charts.department_processing_time.map(x => x.average_days), 15);
              const barWidth = Math.min(100, Math.round((dpt.average_days / maxDays) * 100));
              return (
                <div key={dpt.department_id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{dpt.department_name}</span>
                    <span style={{ fontWeight: 700, color: "#0d9488" }}>{dpt.average_days} days</span>
                  </div>
                  <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        background: "#0d9488",
                        borderRadius: "9999px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 5: Monthly Application Volume */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={18} color="#4f46e5" /> 5. Monthly Application Volume Trend
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {charts.monthly_application_volume.map((m) => {
              const maxVol = Math.max(...charts.monthly_application_volume.map(x => x.count), 10);
              const barWidth = Math.min(100, Math.round((m.count / maxVol) * 100));
              return (
                <div key={m.month}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{m.label}</span>
                    <span style={{ fontWeight: 700, color: "#4f46e5" }}>{m.count} filings</span>
                  </div>
                  <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        background: "#4f46e5",
                        borderRadius: "9999px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
