import api from "./axios";

export const getAnalyticsDashboard = async (filters = {}) => {
  const params = {};
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  if (filters.department_id && filters.department_id !== "ALL") params.department_id = filters.department_id;
  if (filters.status && filters.status !== "ALL") params.status = filters.status;
  if (filters.industry && filters.industry !== "ALL") params.industry = filters.industry;
  if (filters.state && filters.state !== "ALL") params.state = filters.state;

  const response = await api.get("/api/analytics/dashboard", { params });
  return response.data;
};

export const getExecutiveMetrics = async (filters = {}) => {
  const response = await api.get("/api/analytics/metrics", { params: filters });
  return response.data;
};

export const getBottlenecks = async () => {
  const response = await api.get("/api/analytics/bottlenecks");
  return response.data;
};

export const getAnalyticsCharts = async (filters = {}) => {
  const response = await api.get("/api/analytics/charts", { params: filters });
  return response.data;
};
