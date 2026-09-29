import api from './axios';

export const fetchDocumentTypes = async () => {
  const response = await api.get('/api/document-types');
  return response.data;
};

export const fetchMyDocuments = async (params = {}) => {
  const response = await api.get('/api/documents', { params });
  return response.data;
};

export const fetchDocumentDetails = async (id) => {
  const response = await api.get(`/api/documents/${id}`);
  return response.data;
};

export const fetchDocumentMetrics = async () => {
  const response = await api.get('/api/documents/metrics');
  return response.data;
};

export const fetchDocumentViewUrl = async (id) => {
  const response = await api.get(`/api/documents/${id}/view`);
  return response.data;
};

export const fetchDocumentDownloadUrl = async (id) => {
  const response = await api.get(`/api/documents/${id}/download`);
  return response.data;
};

export const fetchDocumentVersions = async (id) => {
  const response = await api.get(`/api/documents/${id}/versions`);
  return response.data;
};

export const uploadDocument = async (file, documentType, approvalId = null, extra = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  if (approvalId) formData.append('approval_id', approvalId);
  if (extra.document_name) formData.append('document_name', extra.document_name);
  if (extra.issue_date) formData.append('issue_date', extra.issue_date);
  if (extra.expiry_date) formData.append('expiry_date', extra.expiry_date);
  if (extra.force_upload) formData.append('force_upload', 'true');

  const response = await api.post('/api/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const replaceDocument = async (id, file, notes = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (notes) formData.append('notes', notes);

  const response = await api.post(`/api/documents/${id}/replace`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const archiveDocument = async (id) => {
  const response = await api.post(`/api/documents/${id}/archive`);
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/api/documents/${id}`);
  return response.data;
};

export const revalidateDocument = async (id) => {
  const response = await api.post(`/api/documents/${id}/validate`);
  return response.data;
};

export const fetchDocumentUsage = async (id) => {
  const response = await api.get(`/api/documents/${id}/usage`);
  return response.data;
};

export const fetchDocumentCompleteness = async (approvals = '') => {
  const response = await api.get('/api/documents/completeness', {
    params: { approvals },
  });
  return response.data;
};

export const fetchMissingDocuments = async (approvals = '') => {
  const response = await api.get('/api/documents/missing', {
    params: { approvals },
  });
  return response.data;
};

export const reuseDocumentForApplication = async (applicationId, documentId, approvalId, requiredDocType) => {
  const formData = new FormData();
  formData.append('document_id', documentId);
  formData.append('approval_id', approvalId);
  formData.append('required_document_type', requiredDocType);

  const response = await api.post(`/api/applications/${applicationId}/documents/reuse`, formData);
  return response.data;
};

export const getDownloadUrl = (id) => `/api/documents/${id}/download`;
