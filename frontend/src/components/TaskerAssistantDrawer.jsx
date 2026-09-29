import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTaskerAssistant } from '../context/AssistantContext';
import { useLanguage } from '../context/LanguageContext';
import {
  sendAssistantMessage,
  getAssistantSessions,
  getSessionHistory,
  deleteAssistantSession
} from '../api/assistant';
import {
  Sparkles,
  Send,
  X,
  Plus,
  History,
  Trash2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Building2,
  AlertCircle,
  Loader2,
  ChevronRight,
  HelpCircle,
  Clock,
  Compass
} from 'lucide-react';

export default function TaskerAssistantDrawer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const {
    isOpen,
    closeAssistant,
    toggleAssistant,
    currentContext,
    initialMessage,
    setInitialMessage,
    activeSessionId,
    setActiveSessionId
  } = useTaskerAssistant();

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle auto-focus and initial message trigger when opened
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      if (initialMessage) {
        handleSendMessage(initialMessage);
        setInitialMessage(null);
      }
    }
  }, [isOpen, initialMessage]);

  // Determine current page context based on route
  const getDerivedPage = () => {
    const path = location.pathname;
    if (path.includes('/documents')) return 'document_center';
    if (path.includes('/fssai')) return 'fssai_application';
    if (path.includes('/gst')) return 'gst_application';
    if (path.includes('/udyam')) return 'udyam_application';
    if (path.includes('/requirements')) return 'approval_recommendations';
    if (path.includes('/onboarding') || path.includes('/business')) return 'business_profile';
    return 'dashboard';
  };

  // Contextual quick suggestion questions
  const getContextualPrompts = () => {
    const page = currentContext.page || getDerivedPage();
    switch (page) {
      case 'document_center':
        return [
          "Which documents need attention?",
          "Can I reuse my PAN for GST and Udyam?",
          "What documents am I missing?"
        ];
      case 'fssai_application':
        return [
          "What is pending in my FSSAI application?",
          "Why do I need a Food Safety License?",
          "What are the statutory FSSAI requirements?"
        ];
      case 'gst_application':
        return [
          "What is the status of my GST application?",
          "What did the officer request for GST?",
          "How long does GST approval take?"
        ];
      case 'udyam_application':
        return [
          "What is my Udyam MSME classification?",
          "Can I download my Udyam certificate?",
          "What benefits does MSME registration provide?"
        ];
      case 'approval_recommendations':
        return [
          "Why was FSSAI recommended for my business?",
          "What clearances apply to my industry?",
          "What documents are needed for these approvals?"
        ];
      case 'business_profile':
        return [
          "What industry is my business registered under?",
          "What is my project scale & investment category?",
          "How does my location affect my approvals?"
        ];
      default:
        return [
          "What should I do next?",
          "Which applications are pending?",
          "What documents am I missing for filing?"
        ];
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    setInputMessage('');
    setError(null);

    // Optimistic user message append
    const userMsg = {
      id: Date.now(),
      role: 'USER',
      content: query,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await sendAssistantMessage({
        message: query,
        context: {
          ...currentContext,
          page: currentContext.page || getDerivedPage()
        },
        session_id: activeSessionId
      });

      if (response.session_id && !activeSessionId) {
        setActiveSessionId(response.session_id);
      }

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'ASSISTANT',
        content: response.reply,
        sources: response.sources || [],
        actions: response.actions || [],
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Assistant error:', err);
      const errMsg = {
        id: Date.now() + 1,
        role: 'ASSISTANT',
        content: "I ran into an issue retrieving the latest regulatory information. Please try asking again.",
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionsList = async () => {
    try {
      setLoadingSessions(true);
      const data = await getAssistantSessions();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const openPreviousSession = async (sessionId) => {
    try {
      setLoading(true);
      const history = await getSessionHistory(sessionId);
      setMessages(history || []);
      setActiveSessionId(sessionId);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteAssistantSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowHistory(false);
    setInputMessage('');
  };

  const handleActionClick = (action) => {
    if (action.route) {
      navigate(action.route);
      closeAssistant();
    } else if (action.query) {
      handleSendMessage(action.query);
    }
  };

  return (
    <>
      {/* ─── Floating Trigger Button (Bottom-Right) ──────────────────────── */}
      {!isOpen && (
        <button
          onClick={toggleAssistant}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#1F2A44] via-[#2D3D60] to-[#1F2A44] hover:from-[#141C2E] hover:to-[#2D3D60] text-[#FAF6F0] shadow-xl shadow-[#1F2A44]/30 border border-[#C6A75E]/60 transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
          title={t("assistant_title")}
        >
          <div className="w-6 h-6 rounded-full bg-[#C6A75E] text-[#1F2A44] flex items-center justify-center font-bold text-xs shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-xs font-bold block leading-tight">{t("assistant_title")}</span>
            <span className="text-[10px] text-[#FAF6F0]/75 font-mono block leading-tight">{t("assistant_subtitle")}</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#C6A75E] animate-pulse" />
        </button>
      )}

      {/* ─── Assistant Slide-Over Drawer ─────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop (clickable on mobile) */}
          <div
            onClick={closeAssistant}
            className="fixed inset-0 bg-[#1F2A44]/40 backdrop-blur-xs transition-opacity duration-300 sm:bg-transparent"
          />

          <aside className="relative w-full sm:w-[420px] h-full bg-[#FAF6F0] border-l border-[#E8DCC8] shadow-2xl flex flex-col z-10 transition-transform duration-300 animate-in slide-in-from-right">
            
            {/* Header */}
            <div className="p-4 bg-white border-b border-[#E8DCC8] flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1F2A44] text-[#C6A75E] flex items-center justify-center border border-[#C6A75E]/40 shadow-xs">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#1F2A44]">{t("assistant_title")}</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1F2A44]/70 bg-[#FAF6F0] px-2 py-0.2 rounded-full border border-[#E8DCC8]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C6A75E] animate-pulse" />
                      {t("status_active")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1F2A44]/70">{t("assistant_subtitle")}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewChat}
                  className="p-1.5 rounded-lg text-[#1F2A44] hover:bg-[#FAF6F0] hover:text-[#C6A75E] transition-colors cursor-pointer"
                  title={t("assistant_new_chat")}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory);
                    if (!showHistory) loadSessionsList();
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showHistory ? 'bg-[#E8DCC8] text-[#1F2A44]' : 'text-[#1F2A44] hover:bg-[#FAF6F0]'
                  }`}
                  title={t("assistant_history")}
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={closeAssistant}
                  className="p-1.5 rounded-lg text-[#1F2A44]/70 hover:bg-[#FAF6F0] hover:text-[#1F2A44] transition-colors cursor-pointer"
                  title={t("btn_close")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* History View Overlay */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF6F0]">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8DCC8]">
                  <span className="text-xs font-bold text-[#1F2A44] uppercase tracking-wider">{t("assistant_history")}</span>
                  <button
                    onClick={startNewChat}
                    className="text-xs font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("assistant_new_chat")}</span>
                  </button>
                </div>

                {loadingSessions ? (
                  <div className="p-8 text-center text-xs text-[#1F2A44]/60">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#C6A75E]" />
                    <span>{t("assistant_thinking")}</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#1F2A44]/60">
                    <p>{t("assistant_history")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => openPreviousSession(s.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
                          activeSessionId === s.id
                            ? 'bg-white border-[#C6A75E] shadow-sm ring-1 ring-[#C6A75E]/30'
                            : 'bg-white/80 border-[#E8DCC8] hover:bg-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-[#1F2A44] truncate">{s.title || "Chat Session"}</p>
                          <p className="text-[10px] text-[#1F2A44]/60 font-mono mt-0.5">
                            {new Date(s.updated_at).toLocaleDateString()} · {s.message_count} messages
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#1F2A44]/40 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Main Chat Stream */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Greeting / Onboarding State */}
                {messages.length === 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 rounded-2xl bg-white border border-[#E8DCC8] shadow-xs space-y-2.5 text-left">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FAF6F0] text-[#1F2A44] text-[10px] font-mono font-bold border border-[#E8DCC8]">
                        <Sparkles className="w-3 h-3 text-[#C6A75E]" />
                        <span>{t("dash_ai_guidance")}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#1F2A44]">
                        {t("dash_greeting", { name: user?.full_name?.split(' ')[0] || 'Entrepreneur' })} 👋
                      </h4>
                      <p className="text-xs text-[#1F2A44]/75 leading-relaxed">
                        {t("reg_assist_subtitle")}
                      </p>
                    </div>

                    {/* Contextual Suggestions */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-[#1F2A44]/70 uppercase tracking-wider px-1">
                        {t("assistant_quick_prompts")}:
                      </p>
                      <div className="space-y-1.5">
                        {getContextualPrompts().map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(prompt)}
                            className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#E8DCC8] hover:border-[#C6A75E] text-xs text-[#1F2A44] font-medium transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                          >
                            <span>{prompt}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#C6A75E] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages List */}
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'USER';

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      {/* Sender Label */}
                      <span className="text-[10px] font-mono text-[#1F2A44]/60 px-1">
                        {isUser ? 'You' : t("assistant_title")}
                      </span>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[92%] p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-[#1F2A44] text-[#FAF6F0] rounded-tr-xs border border-[#1F2A44]'
                            : msg.isError
                            ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs'
                            : 'bg-white text-[#1F2A44] border border-[#E8DCC8] rounded-tl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.content}</p>

                        {/* Grounded Source Citations */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#E8DCC8] space-y-1.5">
                            <span className="text-[10px] font-bold text-[#1F2A44]/70 uppercase tracking-wider block font-mono">
                              {t("assistant_sources_cited")}:
                            </span>
                            <div className="space-y-1">
                              {msg.sources.map((src, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="p-2 rounded-lg bg-[#FAF6F0] border border-[#E8DCC8] flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold text-[#1F2A44] truncate">{src.title}</p>
                                    <p className="text-[10px] text-[#1F2A44]/60">{src.department} {src.last_verified_date ? `· Verified ${src.last_verified_date}` : ''}</p>
                                  </div>
                                  {src.source_url && (
                                    <a
                                      href={src.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#C6A75E] hover:text-[#1F2A44] shrink-0"
                                      title="Open Source Reference"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommended UI Actions */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#E8DCC8] flex flex-wrap gap-2">
                            {msg.actions.map((act, aIdx) => (
                              <button
                                key={aIdx}
                                onClick={() => handleActionClick(act)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F2A44] hover:bg-[#141C2E] text-[#FAF6F0] text-[11px] font-bold shadow-xs transition-colors cursor-pointer border border-[#1F2A44]"
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

                {/* Loading / Typing Indicator */}
                {loading && (
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[10px] font-mono text-[#1F2A44]/60 px-1">{t("assistant_title")}</span>
                    <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white border border-[#E8DCC8] shadow-xs flex items-center gap-2 text-xs text-[#1F2A44]/70">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6A75E]" />
                      <span className="font-mono text-[11px]">{t("assistant_thinking")}</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-[#E8DCC8] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t("assistant_placeholder")}
                  disabled={loading}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8DCC8] focus:border-[#C6A75E] text-[#1F2A44] text-xs sm:text-sm focus:outline-none transition-all placeholder:text-[#1F2A44]/50"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || loading}
                  className="p-2.5 rounded-xl bg-[#1F2A44] hover:bg-[#141C2E] disabled:opacity-40 text-[#FAF6F0] transition-colors cursor-pointer border border-[#1F2A44]"
                  title={t("assistant_send")}
                >
                  <Send className="w-4 h-4 text-[#C6A75E]" />
                </button>
              </form>
              <div className="flex items-center justify-between pt-2 px-1 text-[10px] text-[#1F2A44]/60 font-mono">
                <span>{t("status_auto_verified")}</span>
                <span>Enter to send</span>
              </div>
            </div>

          </aside>
        </div>
      )}
    </>
  );
}
