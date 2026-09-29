import api from "./axios";

/**
 * Checks applicant's onboarding state for smart state-based routing.
 */
export async function getOnboardingStatus() {
  const response = await api.get("/api/onboarding/status");
  return response.data;
}

/**
 * Dynamically computes potentially applicable approvals based on business profile.
 */
export async function getRequirementRecommendations() {
  const response = await api.get("/api/requirements/recommendations");
  return response.data;
}

/**
 * Saves the applicant's chosen approval workflows.
 * @param {string[]} selectedApprovals e.g. ['FSSAI', 'GST', 'UDYAM']
 */
export async function saveApprovalSelections(selectedApprovals) {
  const response = await api.post("/api/approval-selections", {
    selected_approvals: selectedApprovals,
  });
  return response.data;
}

/**
 * Retrieves the applicant's active approval selections.
 */
export async function getUserApprovalSelections() {
  const response = await api.get("/api/approval-selections");
  return response.data;
}

/**
 * Fetches the unified, deduplicated form schema for chosen approvals.
 * @param {string[]} [approvalIds] Optional list of approval IDs to merge.
 */
export async function prepareUnifiedForm(approvalIds = null) {
  const response = await api.post("/api/applications/prepare", {
    approval_ids: approvalIds,
  });
  return response.data;
}

/**
 * Submits the unified canonical form headlessly across all selected portals.
 * @param {Object} payload { selected_approvals: string[], canonical_data: Object }
 */
export async function submitUnifiedApplications(payload) {
  const response = await api.post("/api/applications/unified-submit", payload);
  return response.data;
}

/**
 * Returns dynamic active approvals for the clean applicant dashboard.
 */
export async function getDashboardMyApprovals() {
  const response = await api.get("/api/dashboard/my-approvals");
  return response.data;
}

/**
 * Simulates status transition for demo / verification purposes.
 * @param {string} approvalId e.g. 'FSSAI', 'UDYAM', 'GST'
 * @param {string} status 'APPROVED', 'UNDER_REVIEW', 'DOCUMENT_QUERY', 'SUBMITTED'
 */
export async function simulateApprovalStatus(approvalId, status = "APPROVED") {
  const response = await api.post(`/api/requirements/applications/${approvalId}/simulate-status`, {
    status: status,
  });
  return response.data;
}
