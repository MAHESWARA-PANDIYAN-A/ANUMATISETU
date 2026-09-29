import api from './axios';

const BASE = '/api/v1/business-profiles';

/**
 * Fetch the authenticated applicant's business profile.
 * Resolves null when profile doesn't exist yet (HTTP 404).
 */
export async function fetchMyProfile() {
  try {
    const res = await api.get(`${BASE}/me`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Create a new business profile.
 */
export async function createProfile(data) {
  const res = await api.post(BASE, data);
  return res.data;
}

/**
 * Update the existing business profile.
 */
export async function updateProfile(data) {
  const res = await api.put(`${BASE}/me`, data);
  return res.data;
}

/**
 * Universal save function that automatically creates or updates the business profile.
 */
export async function saveBusinessProfile(data) {
  try {
    const existing = await fetchMyProfile();
    if (existing && existing.id) {
      return await updateProfile(data);
    }
    return await createProfile(data);
  } catch (err) {
    if (err.response?.status === 409) {
      return await updateProfile(data);
    }
    return await createProfile(data);
  }
}

export const getBusinessProfile = fetchMyProfile;
