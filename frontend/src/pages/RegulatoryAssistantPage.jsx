import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  Sparkles,
  Send,
  Building2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  ExternalLink,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  MessageSquare,
  Search,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  Award,
  Receipt,
  FileCheck,
  Info,
  Clock,
  Check,
  X,
  Bot
} from "lucide-react";
import {
  sendAssistantMessage,
  getAssistantSessions,
  getSessionHistory,
  deleteAssistantSession,
  getNextAction,
} from "../api/assistant";
import { fetchMyProfile } from "../api/businessProfile";
import { getDashboardMyApprovals } from "../api/requirements";
import { fetchMyDocuments } from "../api/documents";
import { getRegulatorySources } from "../api/regulatoryAssistant";

export default function RegulatoryAssistantPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const QUICK_PROMPTS = [
    { label: "What should I do next?", query: "What should I do next for my business approvals?" },
    { label: "What approvals do I have?", query: "What approvals and applications do I currently have?" },
    { label: "Why was FSSAI recommended?", query: "Why was FSSAI recommended for my business?" },
    { label: "What documents am I missing?", query: "What documents am I currently missing from my vault?" },
    { label: "Can I reuse my PAN?", query: "Can I reuse my uploaded PAN card across GST and Udyam?" },
    { label: "Check my document warnings", query: "Do any of my uploaded documents have validation warnings or errors?" },
  ];

  // Chat State
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Live Context State
  const [profile, setProfile] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [vaultDocs, setVaultDocs] = useState([]);
  const [nextAction, setNextAction] = useState(null);
  const [sources, setSources] = useState([]);
  const [activeRightTab, setActiveRightTab] = useState("context"); // "context" | "sources"
  const [sourceSearch, setSourceSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadInitialData = async () => {
    try {
      setSessionsLoading(true);
      const [sessRes, profRes, dashRes, docsRes, nextActRes, sourcesRes] = await Promise.all([
        getAssistantSessions().catch(() => []),
        fetchMyProfile().catch(() => null),
        getDashboardMyApprovals().catch(() => ({ approvals: [] })),
        fetchMyDocuments().catch(() => ({ items: [] })),
        getNextAction().catch(() => null),
        getRegulatorySources().catch(() => []),
      ]);

      const sessList = Array.isArray(sessRes) ? sessRes : [];
      setSessions(sessList);
      setProfile(profRes);
      setApprovals(dashRes?.approvals || []);
      const docItems = Array.isArray(docsRes) ? docsRes : (docsRes?.items || []);
      setVaultDocs(docItems);
      setNextAction(nextActRes);
      setSources(Array.isArray(sourcesRes) ? sourcesRes : []);

      // If existing sessions exist, load the most recent one
      if (sessList.length > 0) {
        loadSession(sessList[0].id);
      } else {
        startNewChat();
      }
    } catch (err) {
      console.error("Failed to load assistant workspace:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: `Hi ${user?.full_name?.split(" ")[0] || "there"} 👋\n\nI am your personalized **ANUMATISETU Assistant**. I am connected directly to your enterprise profile, centralized Document Vault, and statutory applications.\n\nAsk me anything about your clearances, document pre-validation results, or pending officer actions.`,
        created_at: new Date().toISOString(),
        actions: [
          { type: "NAVIGATE", label: t('nav_dashboard'), route: "/applicant" },
          { type: "NAVIGATE", label: t('nav_documents'), route: "/documents" }
        ],
        sources: []
      }
    ]);
    if (inputRef.current) inputRef.current.focus();
  };

  const loadSession = async (sessionId) => {
    try {
      setActiveSessionId(sessionId);
      setLoading(true);
      setError(null);
      const history = await getSessionHistory(sessionId);
      if (Array.isArray(history) && history.length > 0) {
        setMessages(
          history.map((m) => ({
            id: m.id,
            role: m.role.toLowerCase(),
            content: m.content,
            created_at: m.created_at,
            sources: m.sources || [],
            actions: m.actions || []
          }))
        );
      } else {
        startNewChat();
      }
    } catch (err) {
      console.error("Failed to load session history:", err);
      startNewChat();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm("Remove this conversation from your history?")) return;
    try {
      await deleteAssistantSession(sessionId);
      const updated = sessions.filter((s) => s.id !== sessionId);
      setSessions(updated);
      if (activeSessionId === sessionId) {
        if (updated.length > 0) {
          loadSession(updated[0].id);
        } else {
          startNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query.trim(),
      created_at: new Date().toISOString(),
      sources: [],
      actions: []
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendAssistantMessage(query.trim(), activeSessionId, {
        page: "assistant_workspace"
      });

      if (response && response.message) {
        const assistantMsg = {
          id: response.message.id || `asst-${Date.now()}`,
          role: "assistant",
          content: response.message.content || response.message,
          created_at: response.message.created_at || new Date().toISOString(),
          sources: response.sources || response.message.sources || [],
          actions: response.actions || response.message.actions || []
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.session_id && response.session_id !== activeSessionId) {
          setActiveSessionId(response.session_id);
          // Refresh session list
          const updatedSess = await getAssistantSessions().catch(() => []);
          if (Array.isArray(updatedSess)) setSessions(updatedSess);
        }
      }
    } catch (err) {
      console.error("Assistant chat error:", err);
      setError("Assistant is temporarily unavailable. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble connecting to the network right now. You can continue accessing your dashboard and documents directly.",
          created_at: new Date().toISOString(),
          actions: [{ type: "NAVIGATE", label: t('nav_dashboard'), route: "/applicant" }],
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleActionClick = (action) => {
    if (action.route) {
      navigate(action.route);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    (s.title || "Conversation").toLowerCase().includes(sessionSearch.toLowerCase())
  );

  const filteredSources = sources.filter((s) => {
    const q = sourceSearch.toLowerCase();
    return (
      (s.title || "").toLowerCase().includes(q) ||
      (s.department || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q)
    );
  });

  const readyDocsCount = vaultDocs.filter((d) => d.validation_status === "VALID" || d.validation_status === "READY").length;
  const attentionDocsCount = vaultDocs.filter((d) => d.validation_status === "WARNING" || d.validation_status === "INVALID" || d.validation_status === "FAILED").length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FAF6F0] flex flex-col">
      {/* ─── Top Brand Bar ─── */}
      <div className="border-b border-[#E8DCC8] bg-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1F2A44] text-[#FAF6F0] shadow-xs">
            <Sparkles className="w-5 h-5 text-[#C6A75E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-[#1F2A44] tracking-tight">
                {t('brand_name')} {t('reg_assist_badge')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]">
                Personalized Guidance
              </span>
            </div>
            <p className="text-xs text-[#1F2A44]/70 flex items-center gap-2">
              <span>Connected: <strong>{profile?.company_name || "Enterprise Profile"}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Database Grounded
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={startNewChat}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#C6A75E]" />
            <span>{t('assistant_new_chat')}</span>
          </button>
          <Link
            to="/applicant"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition flex items-center gap-1.5"
          >
            <span>{t('nav_dashboard')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#1F2A44]/60" />
          </Link>
        </div>
      </div>

      {/* ─── 3-Column Main Workspace Layout ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        
        {/* ─── Left Sidebar: Conversations & Profile (3 cols) ─── */}
        <aside className="hidden lg:flex lg:col-span-3 border-r border-[#E8DCC8] bg-white flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-4">
            <button
              onClick={startNewChat}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C6A75E]" />
              <span>{t('assistant_new_chat')}</span>
            </button>

            {/* Search sessions */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#1F2A44]/50 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44] focus:outline-none focus:border-[#C6A75E]"
              />
            </div>

            {/* Recent Sessions List */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F2A44]/60 font-bold block px-1">
                {t('assistant_history')} ({filteredSessions.length})
              </span>

              {sessionsLoading ? (
                <div className="py-8 text-center text-xs text-[#1F2A44]/60 space-y-2">
                  <div className="w-5 h-5 border-2 border-[#1F2A44] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading...</p>
                </div>
              ) : filteredSessions.length > 0 ? (
                <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
                  {filteredSessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`group p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isActive
                            ? "bg-[#E8DCC8] text-[#1F2A44] font-bold border border-[#C6A75E]"
                            : "hover:bg-[#FAF6F0] text-[#1F2A44]/80 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#C6A75E]" : "text-[#1F2A44]/50"}`} />
                          <span className="truncate">{s.title || "Compliance Query"}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 transition-opacity"
                          title="Delete Conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#1F2A44]/50 italic px-1 py-3">No conversations saved yet.</p>
              )}
            </div>
          </div>

          {/* Connected Enterprise Mini-Card */}
          <div className="p-4 border-t border-[#E8DCC8] bg-[#FAF6F0]/60 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F2A44]/60 font-bold block">
              Active Business Scope
            </span>
            <div className="p-3 rounded-xl bg-white border border-[#E8DCC8] space-y-1 text-xs">
              <p className="font-bold text-[#1F2A44] truncate">{profile?.company_name || "Enterprise Profile"}</p>
              <p className="text-[11px] text-[#1F2A44]/70">{profile?.industry || "Food Processing"} • {profile?.district || "Maharashtra"}</p>
              <div className="flex items-center gap-1.5 pt-1 border-t border-[#E8DCC8]/60 text-[10px] font-mono text-[#1F2A44]/70">
                <span>{approvals.length} Approvals</span>
                <span>•</span>
                <span>{vaultDocs.length} Vault Docs</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Center: Big Chatbot Workspace (6 cols on lg) ─── */}
        <main className="col-span-1 lg:col-span-6 bg-white flex flex-col justify-between h-[calc(100vh-8.5rem)] overflow-hidden">
          
          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#FAF6F0]/30">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      isUser
                        ? "bg-[#1F2A44] text-[#FAF6F0]"
                        : "bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E]"
                    }`}
                  >
                    {isUser ? (
                      <span className="text-xs font-bold font-mono">You</span>
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#C6A75E]" />
                    )}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`max-w-[85%] sm:max-w-[78%] space-y-2`}>
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-2xs ${
                        isUser
                          ? "bg-[#1F2A44] text-[#FAF6F0] rounded-tr-none font-medium"
                          : "bg-white text-[#1F2A44] rounded-tl-none border border-[#E8DCC8]"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Sources (if assistant provided verified sources) */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="p-3 rounded-xl bg-white border border-[#E8DCC8] space-y-1.5 text-xs shadow-2xs">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#C6A75E] font-bold block">
                          {t('assistant_sources_cited')}
                        </span>
                        {msg.sources.map((src, sIdx) => (
                          <div key={sIdx} className="space-y-0.5 border-t border-[#E8DCC8]/60 pt-1 first:border-t-0 first:pt-0">
                            <p className="font-bold text-[#1F2A44] text-xs">{src.title}</p>
                            <p className="text-[11px] text-[#1F2A44]/70">Department: {src.department}</p>
                            {src.last_verified_date && (
                              <span className="text-[10px] text-[#1F2A44]/50 font-mono block">
                                Verified: {src.last_verified_date}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Chips */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => handleActionClick(act)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <span>{act.label}</span>
                            <ArrowRight className="w-3 h-3 text-[#C6A75E]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8DCC8] text-[#1F2A44] border border-[#C6A75E] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[#C6A75E] animate-pulse" />
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-none bg-white border border-[#E8DCC8] shadow-2xs flex items-center gap-2">
                  <span className="text-xs text-[#1F2A44]/70 font-medium">{t('assistant_thinking')}</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C6A75E] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C6A75E] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C6A75E] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="border-t border-[#E8DCC8] bg-white px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F2A44]/50 font-bold shrink-0">
                {t('assistant_quick_prompts')}:
              </span>
              {QUICK_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.query)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-[#FAF6F0] hover:bg-[#E8DCC8] text-[#1F2A44] border border-[#E8DCC8] transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-white border-t border-[#E8DCC8]">
            {error && (
              <div className="mb-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 relative bg-[#FAF6F0] border border-[#E8DCC8] rounded-2xl p-2 focus-within:border-[#C6A75E] focus-within:ring-2 focus-within:ring-[#C6A75E]/20 transition-all">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('assistant_placeholder')}
                className="w-full bg-transparent text-xs sm:text-sm text-[#1F2A44] placeholder-[#1F2A44]/40 focus:outline-none resize-none px-2 py-1 max-h-24"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                className="p-2 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] disabled:opacity-40 transition-all cursor-pointer shrink-0"
                title={t('assistant_send')}
              >
                <Send className="w-4 h-4 text-[#C6A75E]" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#1F2A44]/50 px-2 pt-1.5">
              <span>Press <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#E8DCC8]">Enter</kbd> to send</span>
              <span>Grounded on verified enterprise database</span>
            </div>
          </div>
        </main>

        {/* ─── Right Panel: Live Context & Knowledge Library (3 cols) ─── */}
        <aside className="hidden lg:flex lg:col-span-3 border-l border-[#E8DCC8] bg-white flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-4">
            
            {/* Tabs */}
            <div className="flex rounded-xl bg-[#FAF6F0] p-1 border border-[#E8DCC8]">
              <button
                onClick={() => setActiveRightTab("context")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeRightTab === "context"
                    ? "bg-white text-[#1F2A44] shadow-2xs"
                    : "text-[#1F2A44]/70 hover:text-[#1F2A44]"
                }`}
              >
                Enterprise State
              </button>
              <button
                onClick={() => setActiveRightTab("sources")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeRightTab === "sources"
                    ? "bg-white text-[#1F2A44] shadow-2xs"
                    : "text-[#1F2A44]/70 hover:text-[#1F2A44]"
                }`}
              >
                Statutory KB ({sources.length})
              </button>
            </div>

            {/* Tab 1: Live Enterprise Context */}
            {activeRightTab === "context" && (
              <div className="space-y-4 text-xs">
                
                {/* Next Action Box */}
                {nextAction && nextAction.priority !== "none" && (
                  <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#C6A75E] space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-[#1F2A44] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#C6A75E]" /> Top Priority
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-100 text-rose-800">
                        {nextAction.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-bold text-[#1F2A44]">{nextAction.title || nextAction.label}</p>
                    <p className="text-[11px] text-[#1F2A44]/75 leading-relaxed">{nextAction.description}</p>
                    {nextAction.route && (
                      <Link
                        to={nextAction.route}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1F2A44] hover:text-[#C6A75E] pt-1"
                      >
                        <span>{t('btn_continue')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}

                {/* Active Approvals */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F2A44]/60 font-bold block">
                    {t('dash_active_clearances')} ({approvals.length})
                  </span>
                  <div className="space-y-1.5">
                    {approvals.map((app) => (
                      <div key={app.approval_id} className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#1F2A44]">{app.title}</p>
                          <p className="text-[10px] text-[#1F2A44]/60">{app.department}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          app.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : app.status === "DOCUMENT_QUERY"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[#E8DCC8] text-[#1F2A44]"
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Vault Summary */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8DCC8] space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1F2A44] flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-[#C6A75E]" />
                      {t('doc_tab_vault')}
                    </span>
                    <Link to="/documents" className="text-[10px] font-bold text-[#1F2A44] hover:underline">
                      {t('btn_view_vault')}
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8]">
                      <span className="text-sm font-bold font-mono text-[#1F2A44] block">{readyDocsCount}</span>
                      <span className="text-[10px] text-emerald-700 font-medium">{t('status_ready')}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8]">
                      <span className="text-sm font-bold font-mono text-[#1F2A44] block">{attentionDocsCount}</span>
                      <span className="text-[10px] text-amber-700 font-medium">{t('status_needs_attention')}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Tab 2: Verified Knowledge Base Catalog */}
            {activeRightTab === "sources" && (
              <div className="space-y-3 text-xs">
                <input
                  type="text"
                  placeholder="Search acts & guidelines..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#FAF6F0] border border-[#E8DCC8] text-[#1F2A44] focus:outline-none focus:border-[#C6A75E]"
                />

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredSources.map((src, sIdx) => (
                    <div key={sIdx} className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] space-y-1">
                      <p className="font-bold text-[#1F2A44] text-xs">{src.title}</p>
                      <p className="text-[11px] text-[#1F2A44]/70">{src.department}</p>
                      <p className="text-[10px] text-[#1F2A44]/60 line-clamp-2">{src.summary || src.content}</p>
                      {src.last_verified_date && (
                        <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-[#1F2A44]/50 border-t border-[#E8DCC8]/60">
                          <span>Verified: {src.last_verified_date}</span>
                          <span className="text-emerald-700 font-bold">● Active</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="p-4 border-t border-[#E8DCC8] bg-[#FAF6F0]/40 text-center text-[10px] text-[#1F2A44]/60">
            {t('assistant_subtitle')}
          </div>
        </aside>

      </div>
    </div>
  );
}
