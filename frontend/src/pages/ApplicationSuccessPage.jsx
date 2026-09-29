import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ShieldCheck,
  Receipt,
  Award,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Building2,
  FileCheck2,
  Clock
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function ApplicationSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const submissionResult = location.state?.submission_result || {
    success: true,
    journey_number: "ANUMATISETU-JOURNEY-2026-0001",
    status: "SUBMITTED",
    results: [
      {
        approval_id: "FSSAI",
        name: "FSSAI Food Safety Licensing",
        success: true,
        application_number: "FSSAI-MOCK-2026-770931",
        status: "SUBMITTED",
        message: "FSSAI License application headlessly filed."
      },
      {
        approval_id: "GST",
        name: "GST Registration",
        success: true,
        application_number: "GST-MOCK-2026-608325",
        status: "SUBMITTED",
        message: "GST Registration headlessly submitted to Mock GST portal."
      },
      {
        approval_id: "UDYAM",
        name: "Udyam MSME Registration",
        success: true,
        application_number: "UDYAM-MOCK-2026-382914",
        status: "SUBMITTED",
        message: "Udyam MSME application submitted & classified."
      }
    ]
  };

  const getApprovalIcon = (approvalId) => {
    switch (approvalId) {
      case "FSSAI":
        return <ShieldCheck className="w-6 h-6 text-[#1F2A44]" />;
      case "GST":
        return <Receipt className="w-6 h-6 text-[#C6A75E]" />;
      case "UDYAM":
        return <Award className="w-6 h-6 text-[#1F2A44]" />;
      default:
        return <Sparkles className="w-6 h-6 text-[#C6A75E]" />;
    }
  };

  const getApprovalRoute = (approvalId) => {
    switch (approvalId) {
      case "FSSAI":
        return "/fssai-license";
      case "GST":
        return "/gst-registration";
      case "UDYAM":
        return "/udyam-registration";
      default:
        return "/applicant";
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2A44] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Header Banner */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-[#E8DCC8] border border-[#D6C4A8] text-[#1F2A44] mx-auto flex items-center justify-center shadow-lg shadow-[#1F2A44]/10">
            <CheckCircle2 className="w-10 h-10 text-[#1F2A44]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F2A44] tracking-tight">
            Your applications are ready
          </h1>
          <p className="text-sm text-[#1F2A44]/70 max-w-lg mx-auto">
            ANUMATISETU has distributed your single unified submission with vault documents to all selected statutory portals.
          </p>
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-white border border-[#E8DCC8] text-[#1F2A44] shadow-xs">
            Journey Ref: {submissionResult.journey_number || "ANUMATISETU-JOURNEY-2026-0001"}
          </span>
        </div>

        {/* Application Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {submissionResult.results?.map((app) => (
            <div
              key={app.approval_id}
              className="p-5 rounded-3xl bg-white border border-[#E8DCC8] space-y-4 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-2xl bg-[#FAF6F0] border border-[#E8DCC8]">
                    {getApprovalIcon(app.approval_id)}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8] font-mono">
                    {app.status || "SUBMITTED"}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#1F2A44]">{app.name}</h3>
                  <p className="text-xs font-mono font-bold text-[#C6A75E] mt-1">
                    {app.application_number}
                  </p>
                </div>

                <p className="text-[11px] text-[#1F2A44]/70">
                  {app.message || "Submitted headlessly and stored in dual databases."}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E8DCC8]">
                <Link
                  to={getApprovalRoute(app.approval_id)}
                  className="text-xs font-bold text-[#1F2A44] hover:text-[#C6A75E] flex items-center justify-between transition-colors"
                >
                  <span>Open Details & Tracking</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#C6A75E]" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Next Steps CTA */}
        <div className="p-6 rounded-3xl bg-white border border-[#E8DCC8] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-[#1F2A44]">Your Approval Control Center is Active</h4>
            <p className="text-xs text-[#1F2A44]/70">
              Track live officer scrutiny, respond to document queries, and sync approvals anytime.
            </p>
          </div>

          <button
            onClick={() => navigate("/applicant")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#1F2A44] to-[#2D3D60] hover:from-[#141C2E] hover:to-[#1F2A44] text-[#FAF6F0] font-bold text-sm shadow-md shadow-[#1F2A44]/20 flex items-center justify-center gap-2.5 transition transform active:scale-95 cursor-pointer border border-[#1F2A44]"
          >
            <span>{t("btn_open_dashboard")}</span>
            <ArrowRight className="w-4 h-4 text-[#C6A75E]" />
          </button>
        </div>
      </div>
    </div>
  );
}
