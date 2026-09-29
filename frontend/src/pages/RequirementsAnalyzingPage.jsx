import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Building2,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Layers
} from "lucide-react";
import { getRequirementRecommendations } from "../api/requirements";
import { useLanguage } from "../context/LanguageContext";

export default function RequirementsAnalyzingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const profileContext = location.state || {};

  const [step, setStep] = useState(1);
  const [recommendationsData, setRecommendationsData] = useState(null);

  useEffect(() => {
    runAnalysisPipeline();
  }, []);

  const runAnalysisPipeline = async () => {
    // Step 1: Understanding business
    await new Promise((r) => setTimeout(r, 450));
    setStep(2);

    // Step 2: Checking business activity
    await new Promise((r) => setTimeout(r, 450));
    setStep(3);

    // Step 3: Location check
    await new Promise((r) => setTimeout(r, 450));
    setStep(4);

    try {
      // Step 4: Real rule evaluation from backend
      const res = await getRequirementRecommendations();
      setRecommendationsData(res);
      setStep(5);

      await new Promise((r) => setTimeout(r, 600));

      // Transition smoothly to /requirements
      navigate("/requirements", {
        state: {
          recommendations: res.recommendations || [],
          profileContext: profileContext
        }
      });
    } catch (err) {
      console.error("Requirement analysis error:", err);
      // Fallback transition
      navigate("/requirements");
    }
  };

  const stepsList = [
    { id: 1, title: "Understanding your business entity", desc: profileContext.company_name || "Enterprise profile and constitution" },
    { id: 2, title: "Checking business activity and industrial sector", desc: profileContext.business_activity || "Operational categorization" },
    { id: 3, title: "Evaluating state and regional statutory jurisdiction", desc: `${profileContext.district || "District"}, ${profileContext.state || "State"}` },
    { id: 4, title: "Checking applicable statutory approval rules", desc: "FSS Act, CGST/SGST thresholds, MSMED Composite Criteria" },
    { id: 5, title: "Preparing personalized approval recommendations", desc: "Deduplicating shared statutory requirements" }
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] flex items-center justify-center p-4">
      <div className="max-w-xl w-full p-8 rounded-3xl bg-white border border-[#E8DCC8] shadow-xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F2A44] border border-[#C6A75E]/30 mx-auto flex items-center justify-center shadow-lg shadow-[#1F2A44]/15 animate-pulse">
            <Sparkles className="w-6 h-6 text-[#C6A75E]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#1F2A44] tracking-tight">
            Checking your business requirements
          </h2>
          <p className="text-xs text-[#1F2A44]/70">
            {t('brand_name')} is analyzing statutory rules across central and state departmental databases.
          </p>
        </div>

        {/* Dynamic Checklist */}
        <div className="space-y-4">
          {stepsList.map((item) => {
            const isDone = step > item.id;
            const isCurrent = step === item.id;
            const isPending = step < item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center gap-3.5 ${
                  isDone
                    ? "bg-[#FAF6F0] border-[#C6A75E] text-[#1F2A44]"
                    : isCurrent
                    ? "bg-white border-[#1F2A44] text-[#1F2A44] shadow-md shadow-[#1F2A44]/10"
                    : "bg-[#FAF6F0]/60 border-[#E8DCC8] text-[#1F2A44]/40"
                }`}
              >
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-[#C6A75E]" />
                  ) : isCurrent ? (
                    <div className="w-5 h-5 border-2 border-[#1F2A44] border-t-[#C6A75E] rounded-full animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-[#E8DCC8] flex items-center justify-center text-[10px] font-mono text-[#1F2A44]/50">
                      {item.id}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-tight ${isCurrent ? "text-[#1F2A44]" : ""}`}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[#1F2A44]/60 truncate mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info pill */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#1F2A44] bg-[#FAF6F0] px-3.5 py-1.5 rounded-full border border-[#E8DCC8]">
            <span className="w-2 h-2 rounded-full bg-[#C6A75E] animate-pulse" />
            Active Decision Support Engine
          </span>
        </div>
      </div>
    </div>
  );
}
