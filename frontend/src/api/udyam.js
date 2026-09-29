import api from "./axios";

/**
 * Dynamically fetches the Udyam form schema specifications from the microservice.
 */
export async function getUdyamSchema() {
  const response = await api.get("/api/udyam/schema");
  return response.data;
}

/**
 * Fetches prefill data mapped from the applicant's existing business profile.
 */
export async function getUdyamPrefillData() {
  const response = await api.get("/api/udyam/prefill-data");
  return response.data;
}

/**
 * Executes Method 2 — 100% Automated Headless Direct Submission.
 * @param {Object} formData Form fields according to Udyam schema.
 */
export async function submitUdyamDirect(formData) {
  const response = await api.post("/api/udyam/direct-submit", formData);
  return response.data;
}

/**
 * Syncs and returns real-time approval status for a specific Udyam application.
 * @param {string} applicationNumber Udyam application number (e.g. UDYAM-MOCK-2026-XXXXXX).
 */
export async function syncUdyamStatus(applicationNumber) {
  const response = await api.get(`/api/udyam/status/${applicationNumber}`);
  return response.data;
}

/**
 * Syncs all active Udyam applications for the logged-in applicant.
 */
export async function syncAllUdyam() {
  const response = await api.post("/api/udyam/sync-all");
  return response.data;
}
