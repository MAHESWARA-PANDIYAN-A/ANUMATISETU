import api from "./axios";

export const askRegulatoryQuestion = async (question, departmentFilter = null) => {
  const payload = { question };
  if (departmentFilter) {
    payload.department_filter = departmentFilter;
  }
  const response = await api.post("/api/regulatory-assistant/ask", payload);
  return response.data;
};

export const getRegulatorySources = async () => {
  const response = await api.get("/api/regulatory-assistant/sources");
  return response.data;
};
