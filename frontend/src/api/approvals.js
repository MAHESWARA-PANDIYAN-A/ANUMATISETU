import api from './axios';

// 1. Approval Plan & Priorities
export const getApprovalPlan = async () => {
  const response = await api.get('/api/approvals/plan');
  return response.data;
};

export const getApprovalRecommendations = async () => {
  const response = await api.get('/api/approvals/recommendations');
  return response.data;
};

export const getApprovalDetail = async (approvalId) => {
  const response = await api.get(`/api/approvals/${approvalId}`);
  return response.data;
};

export const getApprovalWhy = async (approvalId) => {
  const response = await api.get(`/api/approvals/${approvalId}/why`);
  return response.data;
};

export const getApprovalCoverageItem = async (approvalId) => {
  const response = await api.get(`/api/approvals/${approvalId}/coverage`);
  return response.data;
};

export const getApprovalDependencies = async (approvalId) => {
  const response = await api.get(`/api/approvals/${approvalId}/dependencies`);
  return response.data;
};

// 2. Approval Coverage & External Steps
export const getCoverageOverview = async () => {
  const response = await api.get('/api/coverage');
  return response.data;
};

export const completeExternalStep = async (stepId, data = {}) => {
  const response = await api.post(`/api/coverage/external-steps/${stepId}/complete`, data);
  return response.data;
};

// 3. Post-Approval Compliance & Renewals
export const getComplianceDashboard = async () => {
  const response = await api.get('/api/compliance');
  return response.data;
};

export const getComplianceRenewals = async () => {
  const response = await api.get('/api/compliance/renewals');
  return response.data;
};

export const getComplianceTasks = async () => {
  const response = await api.get('/api/compliance/tasks');
  return response.data;
};

export const completeComplianceTask = async (taskId, data = {}) => {
  const response = await api.post(`/api/compliance/tasks/${taskId}/complete`, data);
  return response.data;
};

export const getComplianceCalendar = async () => {
  const response = await api.get('/api/compliance/calendar');
  return response.data;
};

// 4. Delay Analysis & Health
export const getApplicationDelayAnalysis = async (applicationId) => {
  const response = await api.get(`/api/applications/${applicationId}/delay-analysis`);
  return response.data;
};

export const getApplicationHealth = async (applicationId) => {
  const response = await api.get(`/api/applications/${applicationId}/health`);
  return response.data;
};

export const getApplicationTimeline = async (applicationId) => {
  const response = await api.get(`/api/applications/${applicationId}/timeline`);
  return response.data;
};

export const getOfficerBottlenecks = async () => {
  const response = await api.get('/api/applications/bottlenecks');
  return response.data;
};
