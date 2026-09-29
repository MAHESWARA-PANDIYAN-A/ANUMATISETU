import React, { useState, useEffect } from "react";
import {
  Award,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Building2,
  IndianRupee,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Info
} from "lucide-react";
import { getAllSchemes, matchSchemes } from "../api/schemes";
import { getBusinessProfile } from "../api/businessProfile";
import { useLanguage } from "../context/LanguageContext";

export default function SchemeDiscoveryPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("match"); // "match", "catalog"
  const [loading, setLoading] = useState(false);
  const [allSchemes, setAllSchemes] = useState([]);
  const [matchedResults, setMatchedResults] = useState(null);
  const [error, setError] = useState("");
  const [expandedSchemeId, setExpandedSchemeId] = useState(null);

  // Profile Form state for discovery matching
  const [profileForm, setProfileForm] = useState({
    company_name: "Sahyadri Organic Agro & Food Processing Ltd",
    industry: "Food Processing",
    state: "Maharashtra",
    business_type: "Private Limited Company",
    investment_amount: 15000000, // 1.5 Crore
    project_stage: "Setting Up",
    use_ai: true,
  });

  // Filter & Search states for Knowledge Base
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch all verified schemes
      const schemes = await getAllSchemes();
      setAllSchemes(schemes);

      // 2. Fetch logged-in user profile if available
      try {
        const userProfile = await getBusinessProfile();
        if (userProfile && userProfile.company_name) {
          setProfileForm((prev) => ({
            ...prev,
            company_name: userProfile.company_name || prev.company_name,
            industry: userProfile.industry || prev.industry,
            state: userProfile.state || prev.state,
            business_type: userProfile.business_type || prev.business_type,
            investment_amount: userProfile.investment_amount || prev.investment_amount,
            project_stage: userProfile.project_stage || prev.project_stage,
          }));
        }
      } catch (err) {
        // Guest mode or fallback
        console.log("Using default demo business profile");
      }

      // 3. Run initial match for default profile
      const matchRes = await matchSchemes({
        industry: profileForm.industry,
        state: profileForm.state,
        business_type: profileForm.business_type,
        investment_amount: profileForm.investment_amount,
        project_stage: profileForm.project_stage,
        use_ai: true,
      });
      setMatchedResults(matchRes);
    } catch (err) {
      console.error("Failed to load scheme data:", err);
      setError("Failed to connect to Government Scheme Discovery service.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatching = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const matchRes = await matchSchemes({
        industry: profileForm.industry,
        state: profileForm.state,
        business_type: profileForm.business_type,
        investment_amount: Number(profileForm.investment_amount),
        project_stage: profileForm.project_stage,
        use_ai: profileForm.use_ai,
      });
      setMatchedResults(matchRes);
    } catch (err) {
      console.error("Scheme matching failed:", err);
      setError("Failed to calculate scheme eligibility. Please check parameters.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedSchemeId(expandedSchemeId === id ? null : id);
  };

  // Filtered schemes for Catalog tab
  const filteredSchemes = allSchemes.filter((s) => {
    const matchesSearch =
      s.scheme_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.benefits || []).some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept =
      filterDepartment === "all" || s.department.toLowerCase().includes(filterDepartment.toLowerCase());

    const matchesInd =
      filterIndustry === "all" ||
      s.applicable_industries.includes("ALL") ||
      s.applicable_industries.some((i) => i.toLowerCase().includes(filterIndustry.toLowerCase()));

    return matchesSearch && matchesDept && matchesInd;
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem", color: "#1e293b" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f766e 100%)",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          color: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(6, 78, 59, 0.3)",
          marginBottom: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <ShieldCheck size={16} /> {t('brand_name')} {t('scheme_badge')}
            </span>
            <span
              style={{
                background: "rgba(16, 185, 129, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              Knowledge Base
            </span>
          </div>

          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 0.75rem 0", letterSpacing: "-0.025em" }}>
            {t('scheme_title')}
          </h1>
          <p style={{ fontSize: "1.05rem", opacity: 0.9, maxWidth: "800px", lineHeight: 1.6, margin: 0 }}>
            {t('scheme_subtitle')}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginTop: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Building2 size={18} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: "0.9rem" }}><strong>State & Central</strong> Portals</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck size={18} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: "0.9rem" }}><strong>Deterministic</strong> Rules Engine</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={18} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: "0.9rem" }}><strong>AI Grounded</strong> Reasoning</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          marginBottom: "2rem",
          gap: "1.5rem",
        }}
      >
        <button
          onClick={() => setActiveTab("match")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.75rem 0.5rem",
            border: "none",
            background: "none",
            fontSize: "1.05rem",
            fontWeight: 700,
            color: activeTab === "match" ? "#047857" : "#64748b",
            borderBottom: activeTab === "match" ? "3px solid #047857" : "3px solid transparent",
            cursor: "pointer",
            transition: "all 0.2s",
            marginBottom: "-2px",
          }}
        >
          <Sparkles size={20} />
          {t('scheme_btn_check_eligibility')}
          {matchedResults && (
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                fontSize: "0.75rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
            >
              {matchedResults.total_matched}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("catalog")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.75rem 0.5rem",
            border: "none",
            background: "none",
            fontSize: "1.05rem",
            fontWeight: 700,
            color: activeTab === "catalog" ? "#047857" : "#64748b",
            borderBottom: activeTab === "catalog" ? "3px solid #047857" : "3px solid transparent",
            cursor: "pointer",
            transition: "all 0.2s",
            marginBottom: "-2px",
          }}
        >
          <Layers size={20} />
          {t('scheme_title')}
          <span
            style={{
              background: "#e2e8f0",
              color: "#475569",
              fontSize: "0.75rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              fontWeight: 700,
            }}
          >
            {allSchemes.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Profile Matching & Discovery */}
      {activeTab === "match" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2.4fr", gap: "2rem", alignItems: "start" }}>
          {/* Left Column: Business Profile Form */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Briefcase size={18} color="#047857" />
                {t('profile_sec_basic')}
              </h3>
              <button
                type="button"
                onClick={handleRunMatching}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "#047857",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t('portal_sync_records')}
              </button>
            </div>

            <form onSubmit={handleRunMatching} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_company_name')}
                </label>
                <input
                  type="text"
                  value={profileForm.company_name}
                  onChange={(e) => setProfileForm({ ...profileForm, company_name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_industry')}
                </label>
                <select
                  value={profileForm.industry}
                  onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Food Processing">Food Processing & Agro</option>
                  <option value="Manufacturing">General Manufacturing</option>
                  <option value="Textiles & Garments">Textiles & Garments</option>
                  <option value="Chemical & Petrochemical">Chemical & Petrochemical</option>
                  <option value="Pharmaceuticals">Pharmaceuticals & Healthcare</option>
                  <option value="Electronics & IT Hardware">Electronics & IT Hardware</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_state')}
                </label>
                <input
                  type="text"
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_constitution')}
                </label>
                <select
                  value={profileForm.business_type}
                  onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Private Limited Company">Private Limited Company</option>
                  <option value="Public Limited Company">Public Limited Company</option>
                  <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_investment')} (₹)
                </label>
                <input
                  type="number"
                  value={profileForm.investment_amount}
                  onChange={(e) => setProfileForm({ ...profileForm, investment_amount: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem", display: "block" }}>
                  ≈ ₹{(profileForm.investment_amount / 10000000).toFixed(2)} Crore (₹{(profileForm.investment_amount / 100000).toFixed(1)} Lakhs)
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  {t('profile_project_stage')}
                </label>
                <select
                  value={profileForm.project_stage}
                  onChange={(e) => setProfileForm({ ...profileForm, project_stage: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Pre-Construction">Pre-Construction / Planning</option>
                  <option value="Setting Up">Setting Up / Land Acquired</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="Machinery Installation">Machinery Installation</option>
                  <option value="Operational Expansion">Operational Expansion</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <input
                  type="checkbox"
                  id="use_ai_chk"
                  checked={profileForm.use_ai}
                  onChange={(e) => setProfileForm({ ...profileForm, use_ai: e.target.checked })}
                  style={{ accentColor: "#047857", width: "16px", height: "16px" }}
                />
                <label htmlFor="use_ai_chk" style={{ fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  AI Grounded Relevance Reasoning
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "0.5rem",
                  background: "#047857",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 10px rgba(4, 120, 87, 0.25)",
                  transition: "background 0.2s",
                }}
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? "Matching..." : t('scheme_btn_check_eligibility')}
              </button>
            </form>

            <div
              style={{
                marginTop: "1.5rem",
                padding: "0.85rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
                fontSize: "0.8rem",
                color: "#64748b",
                lineHeight: 1.4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                <Info size={14} /> Rule Engine Note
              </div>
              Schemes are evaluated deterministically on sector applicability, geographic jurisdiction, investment tier, and corporate constitution.
            </div>
          </div>

          {/* Right Column: Matched Schemes List */}
          <div>
            {/* Disclaimer Alert */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "0.85rem 1.25rem",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <ShieldCheck size={20} color="#15803d" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ color: "#166534", fontSize: "0.9rem" }}>Regulatory Compliance Standard:</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#15803d", lineHeight: 1.4 }}>
                  In accordance with single-window guidelines, all schemes below are labelled as <strong>Potentially relevant</strong> based on configured deterministic rules. Definitive eligibility and final financial sanctions are subject to statutory verification by the nodal department.
                </p>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: "3rem 0" }}>
                <RefreshCw size={36} color="#047857" style={{ animation: "spin 1s linear infinite" }} />
                <p style={{ marginTop: "1rem", color: "#64748b", fontWeight: 600 }}>
                  Evaluating statutory rules & generating grounded explanations...
                </p>
              </div>
            )}

            {!loading && matchedResults && matchedResults.matched_schemes?.length === 0 && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "3rem 2rem",
                  textAlign: "center",
                  border: "1px solid #e2e8f0",
                }}
              >
                <HelpCircle size={48} color="#94a3b8" style={{ margin: "0 auto 1rem auto" }} />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#334155" }}>No Schemes Matched</h3>
                <p style={{ color: "#64748b", maxWidth: "450px", margin: "0.5rem auto 1.5rem auto", fontSize: "0.9rem" }}>
                  No schemes in the current database match your selected industry, investment amount, or state criteria.
                </p>
              </div>
            )}

            {!loading && matchedResults && matchedResults.matched_schemes?.map((scheme) => {
              const isExpanded = expandedSchemeId === scheme.id;
              return (
                <div
                  key={scheme.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    marginBottom: "1.5rem",
                    overflow: "hidden",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: "1.25rem 1.5rem",
                      background: "linear-gradient(to right, #f8fafc, #ffffff)",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <CheckCircle2 size={13} /> {scheme.relevance_status}
                        </span>
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "6px",
                          }}
                        >
                          {scheme.state}
                        </span>
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#1e40af",
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "6px",
                          }}
                        >
                          Match Score: {Math.round(scheme.match_score * 100)}%
                        </span>
                      </div>

                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0f172a" }}>
                        {scheme.scheme_name}
                      </h3>
                      <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <Building2 size={14} />
                        <strong>Nodal Department:</strong> {scheme.department}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(scheme.id)}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "0.5rem 0.85rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        flexShrink: 0,
                      }}
                    >
                      {isExpanded ? <>Less <ChevronUp size={16} /></> : <>{t('btn_view_details')} <ChevronDown size={16} /></>}
                    </button>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "1.5rem" }}>
                    {/* Why it may be relevant */}
                    <div
                      style={{
                        background: "#f0fdf4",
                        borderLeft: "4px solid #10b981",
                        borderRadius: "0 8px 8px 0",
                        padding: "1rem 1.25rem",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "#065f46", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
                        <Sparkles size={16} /> {t('btn_why_recommended')}:
                      </div>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#047857", lineHeight: 1.5 }}>
                        {scheme.why_relevant}
                      </p>
                    </div>

                    {/* Key Benefits */}
                    <div style={{ marginBottom: "1.25rem" }}>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#334155", margin: "0 0 0.6rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <TrendingUp size={16} color="#047857" /> Key Incentives & Benefits:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {scheme.benefits?.map((benefit, bIdx) => (
                          <li key={bIdx} style={{ fontSize: "0.88rem", color: "#1e293b", lineHeight: 1.4 }}>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Expandable Section: Key Conditions, Required Docs, Official Source */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem", marginTop: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.25rem" }}>
                          {/* Key Eligibility Conditions */}
                          <div>
                            <h5 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <CheckCircle2 size={15} color="#047857" /> Eligibility Conditions:
                            </h5>
                            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                              {scheme.eligibility_conditions?.map((cond, cIdx) => (
                                <li key={cIdx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.4 }}>
                                  {cond}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Required Documents */}
                          <div>
                            <h5 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <FileText size={15} color="#0284c7" /> Required Documents:
                            </h5>
                            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                              {scheme.required_documents?.map((doc, dIdx) => (
                                <li key={dIdx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.4 }}>
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Official Source & Verification Badge */}
                        <div
                          style={{
                            background: "#f8fafc",
                            borderRadius: "8px",
                            padding: "0.85rem 1.1rem",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <ShieldCheck size={18} color="#059669" />
                            <div>
                              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Official Statutory Source:</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>{scheme.source}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            Last Verified: <strong>{scheme.last_verified_date}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Verified Schemes Knowledge Base Catalog */}
      {activeTab === "catalog" && (
        <div>
          {/* Filter Bar */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              marginBottom: "1.5rem",
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 1fr",
              gap: "1rem",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder={t('scheme_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem 0.65rem 2.4rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Industries</option>
                <option value="Food Processing">Food Processing & Agro</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Textiles">Textiles & Garments</option>
                <option value="Energy">Clean Energy / Solar</option>
                <option value="MSME">General MSME</option>
              </select>
            </div>

            <div>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Departments</option>
                <option value="Industries">Directorate of Industries, Maharashtra</option>
                <option value="Food Processing">MoFPI / State Food Mission</option>
                <option value="MSME">Ministry of MSME / KVIC</option>
                <option value="MEDA">Maharashtra Energy Dev. Agency (MEDA)</option>
              </select>
            </div>
          </div>

          {/* Scheme Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            {filteredSchemes.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "1.5rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                      <span
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                        }}
                      >
                        {s.state}
                      </span>
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                        }}
                      >
                        {s.department}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                      {s.scheme_name}
                    </h3>
                  </div>
                  <span
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      padding: "0.3rem 0.6rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    Verified: {s.last_verified_date}
                  </span>
                </div>

                {/* Investment & Industries */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0.75rem 0" }}>
                  {s.applicable_industries?.slice(0, 4).map((ind, iIdx) => (
                    <span
                      key={iIdx}
                      style={{
                        background: "#f1f5f9",
                        color: "#334155",
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                      }}
                    >
                      {ind}
                    </span>
                  ))}
                  {s.applicable_industries?.length > 4 && (
                    <span style={{ fontSize: "0.75rem", color: "#64748b", alignSelf: "center" }}>
                      +{s.applicable_industries.length - 4} more
                    </span>
                  )}
                </div>

                {/* Benefits List */}
                <div style={{ margin: "1rem 0" }}>
                  <strong style={{ fontSize: "0.85rem", color: "#334155" }}>Incentives & Benefits:</strong>
                  <ul style={{ margin: "0.4rem 0 0 0", paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {s.benefits?.map((b, bIdx) => (
                      <li key={bIdx} style={{ fontSize: "0.85rem", color: "#475569" }}>{b}</li>
                    ))}
                  </ul>
                </div>

                {/* Statutory Source Footer */}
                <div
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "0.85rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    <strong>Statutory Source:</strong> {s.source}
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("match");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#047857",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    {t('btn_view_details')} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
