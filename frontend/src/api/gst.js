import api from "./axios";

/**
 * Dynamically fetches the GST form schema specifications from the microservice.
 */
export async function getGstSchema() {
  const response = await api.get("/api/gst/schema");
  return response.data;
}

/**
 * Fetches prefill data mapped from the applicant's existing business profile.
 */
export async function getGstPrefillData() {
  const response = await api.get("/api/gst/prefill-data");
  return response.data;
}

/**
 * Executes Method 2 — 100% Automated Headless Direct Submission to Mock GST.
 * @param {Object} formData Form fields according to GST schema.
 */
export async function submitGstHeadless(formData) {
  const response = await api.post("/api/gst/headless-submit", formData);
  return response.data;
}

/**
 * Syncs and returns real-time approval status for a specific GST application.
 * @param {string} applicationNumber GST application number (e.g. GST-MOCK-2026-XXXXXX).
 */
export async function syncGstStatus(applicationNumber) {
  const response = await api.get(`/api/gst/status/${applicationNumber}`);
  return response.data;
}

/**
 * Syncs all active GST applications for the logged-in applicant.
 */
export async function syncAllGst() {
  const response = await api.post("/api/gst/sync-all");
  return response.data;
}
