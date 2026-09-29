import api from "./axios";

export const getDepartments = async () => {
  const response = await api.get("/api/departments");
  return response.data;
};

export const getApplications = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get("/api/applications", { params });
  return response.data;
};

export const getApplicationDetails = async (id) => {
  const response = await api.get(`/api/applications/${id}`);
  return response.data;
};

export const createApplication = async (data) => {
  const response = await api.post("/api/applications", data);
  return response.data;
};

export const submitApplication = async (id) => {
  const response = await api.post(`/api/applications/${id}/submit`);
  return response.data;
};

export const getApplicationTimeline = async (id) => {
  const response = await api.get(`/api/applications/${id}/timeline`);
  return response.data;
};

export const updateApprovalStatus = async (approvalId, status, remarks, queryDetails = null) => {
  const response = await api.patch(`/api/application-approvals/${approvalId}/status`, {
    status,
    remarks,
    query_details: queryDetails,
  });
  return response.data;
};

export const submitQueryResponse = async (approvalId, queryResponse) => {
  const response = await api.post(`/api/application-approvals/${approvalId}/query-response`, {
    query_response: queryResponse,
  });
  return response.data;
};

export const scheduleInspection = async (approvalId, data) => {
  const response = await api.post(`/api/application-approvals/${approvalId}/schedule-inspection`, data);
  return response.data;
};

export const completeInspection = async (inspectionId, data) => {
  const response = await api.patch(`/api/inspections/${inspectionId}/complete`, data);
  return response.data;
};

export const getOfficerMetrics = async () => {
  const response = await api.get("/api/officer/metrics");
  return response.data;
};

export const getApplicantMetrics = async () => {
  const response = await api.get("/api/applicant/metrics");
  return response.data;
};

export const getInspectionsList = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get("/api/inspections", { params });
  return response.data;
};
