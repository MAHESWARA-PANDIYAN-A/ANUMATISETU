import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AssistantProvider } from "./context/AssistantContext";
import { LanguageProvider } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import TaskerAssistantDrawer from "./components/TaskerAssistantDrawer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ApplicantDashboard from "./pages/ApplicantDashboard";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import DocumentPrevalidationPage from "./pages/DocumentPrevalidationPage";
import RegulatoryAssistantPage from "./pages/RegulatoryAssistantPage";
import SchemeDiscoveryPage from "./pages/SchemeDiscoveryPage";
import GovernmentAnalyticsPage from "./pages/GovernmentAnalyticsPage";
import OfficerDashboard from "./pages/OfficerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FssaiIntegrationPage from "./pages/FssaiIntegrationPage";
import UdyamIntegrationPage from "./pages/UdyamIntegrationPage";
import GstIntegrationPage from "./pages/GstIntegrationPage";
import OnboardingBusinessPage from "./pages/OnboardingBusinessPage";
import RequirementsAnalyzingPage from "./pages/RequirementsAnalyzingPage";
import ApprovalRecommendationsPage from "./pages/ApprovalRecommendationsPage";
import ApprovalPlanPage from "./pages/ApprovalPlanPage";
import CoverageMapPage from "./pages/CoverageMapPage";
import PostApprovalCompliancePage from "./pages/PostApprovalCompliancePage";
import UnifiedApplicationFormPage from "./pages/UnifiedApplicationFormPage";
import ApplicationSuccessPage from "./pages/ApplicationSuccessPage";
import Unauthorized from "./pages/Unauthorized";

import NotFound from "./pages/NotFound";

function App() {
  return (
    <Router>
      <LanguageProvider>
        <AuthProvider>
          <AssistantProvider>
            <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#1F2A44] selection:bg-[#C6A75E]/30 selection:text-[#1F2A44]">
              <Navbar />
              <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              
              {/* Onboarding & Requirement Journey Routes */}
              <Route
                path="/onboarding/business"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <OnboardingBusinessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requirements/analyzing"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <RequirementsAnalyzingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requirements"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApprovalRecommendationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/approvals"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApprovalPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/approvals/plan"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApprovalPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/coverage"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "OFFICER", "ADMIN"]}>
                    <CoverageMapPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compliance"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <PostApprovalCompliancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compliance/calendar"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <PostApprovalCompliancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/approvals/find"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApprovalRecommendationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications/new"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <UnifiedApplicationFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications/success"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApplicationSuccessPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 7: Regulatory Knowledge Assistant (Accessible to all authenticated users) */}
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "OFFICER", "ADMIN"]}>
                    <RegulatoryAssistantPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/assistant"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <RegulatoryAssistantPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 8: Government Scheme Discovery */}
              <Route
                path="/schemes"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "OFFICER", "ADMIN"]}>
                    <SchemeDiscoveryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/schemes"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <SchemeDiscoveryPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 9: Government Analytics Dashboard */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "OFFICER", "ADMIN"]}>
                    <GovernmentAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/analytics"
                element={
                  <ProtectedRoute allowedRoles={["OFFICER", "ADMIN"]}>
                    <GovernmentAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <GovernmentAnalyticsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes: Applicant Role */}
              <Route
                path="/applicant"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApplicantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <ApplicantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/business-profile"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <OnboardingBusinessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <DocumentPrevalidationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/:id"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <DocumentPrevalidationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/documents"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <DocumentPrevalidationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fssai-license"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <FssaiIntegrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/fssai-license"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <FssaiIntegrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/udyam-registration"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <UdyamIntegrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/udyam-registration"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <UdyamIntegrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gst-registration"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <GstIntegrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applicant/gst-registration"
                element={
                  <ProtectedRoute allowedRoles={["APPLICANT", "ADMIN"]}>
                    <GstIntegrationPage />
                  </ProtectedRoute>
                }
              />


              {/* Protected Routes: Officer Role */}
              <Route
                path="/officer"
                element={
                  <ProtectedRoute allowedRoles={["OFFICER", "ADMIN"]}>
                    <OfficerDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes: Admin Role */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="border-t border-[#E8DCC8] bg-[#FAF6F0] py-8 px-6 text-center text-xs text-[#1F2A44]/70 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left space-y-0.5">
                <p className="font-bold text-[#1F2A44] text-sm flex items-center gap-2">
                  <span>ANUMATISETU</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8DCC8] text-[#1F2A44] border border-[#D6C4A8] font-mono">
                    SIH26130 Platform
                  </span>
                </p>
                <p className="text-xs text-[#1F2A44]/70">
                  Industrial Approval & Compliance Platform
                </p>
              </div>

              <div className="flex items-center space-x-6 text-xs text-[#1F2A44]/80 font-medium">
                <a href="#about" className="hover:text-[#C6A75E] transition-colors">About</a>
                <a href="#privacy" className="hover:text-[#C6A75E] transition-colors">Privacy</a>
                <a href="#terms" className="hover:text-[#C6A75E] transition-colors">Terms</a>
                <a href="#help" className="hover:text-[#C6A75E] transition-colors">Help</a>
              </div>

            </div>
          </footer>
          <TaskerAssistantDrawer />
        </div>
          </AssistantProvider>
        </AuthProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;
