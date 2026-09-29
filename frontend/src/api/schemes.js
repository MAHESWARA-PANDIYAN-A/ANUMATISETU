import api from "./axios";

export const getAllSchemes = async () => {
  const response = await api.get("/api/schemes");
  return response.data;
};

export const getSchemeById = async (schemeId) => {
  const response = await api.get(`/api/schemes/${schemeId}`);
  return response.data;
};

export const matchSchemes = async (params = {}) => {
  const response = await api.post("/api/schemes/match", params);
  return response.data;
};
