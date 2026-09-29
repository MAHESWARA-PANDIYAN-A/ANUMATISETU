import api from "./axios";

export const getFssaiRequirements = async () => {
  const response = await api.get("/api/fssai/requirements");
  return response.data;
};

export const getFssaiPrefillData = async () => {
  const response = await api.get("/api/fssai/prefill-data");
  return response.data;
};

export const submitFssaiHeadless = async (formData) => {
  const response = await api.post("/api/fssai/submit-headless", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const submitFssaiJson = async (payload) => {
  const response = await api.post("/api/fssai/submit-json", payload);
  return response.data;
};

export const syncFssaiStatus = async (fssaiApplicationNumber) => {
  const response = await api.get(`/api/fssai/status/${fssaiApplicationNumber}`);
  return response.data;
};

export const getFssaiApplicationDetails = async (fssaiApplicationNumber) => {
  const response = await api.get(`/api/fssai/application/${fssaiApplicationNumber}`);
  return response.data;
};

export const syncAllFssai = async () => {
  const response = await api.post("/api/fssai/sync-all");
  return response.data;
};
