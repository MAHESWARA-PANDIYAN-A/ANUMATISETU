import api from './axios';

/**
 * Sends a message to the TASKER Assistant (powered by Grok / xAI).
 */
export const sendAssistantMessage = async (message, sessionId = null, context = null) => {
  const payload = {
    message,
    session_id: sessionId,
    context: context || {}
  };
  const res = await api.post('/api/assistant/chat', payload);
  return res.data;
};

/**
 * Lists previous conversation sessions.
 */
export const getAssistantSessions = async () => {
  const res = await api.get('/api/assistant/sessions');
  return res.data;
};

/**
 * Retrieves the full message history for a specific session.
 */
export const getSessionHistory = async (sessionId) => {
  const res = await api.get(`/api/assistant/sessions/${sessionId}`);
  return res.data;
};

/**
 * Deletes a conversation session.
 */
export const deleteAssistantSession = async (sessionId) => {
  const res = await api.delete(`/api/assistant/sessions/${sessionId}`);
  return res.data;
};

/**
 * Gets the single most important next actionable task for the user.
 */
export const getNextAction = async () => {
  const res = await api.get('/api/assistant/next-action');
  return res.data;
};

/**
 * Triggers a contextual explanation for a document warning / state.
 */
export const explainDocument = async (documentId, documentName = null, sessionId = null) => {
  const res = await api.post('/api/assistant/explain-document', {
    document_id: documentId,
    document_name: documentName,
    session_id: sessionId
  });
  return res.data;
};

/**
 * Triggers a contextual explanation for an application status or officer query.
 */
export const explainApplication = async (applicationId, approvalName = null, sessionId = null) => {
  const res = await api.post('/api/assistant/explain-application', {
    application_id: applicationId,
    approval_name: approvalName,
    session_id: sessionId
  });
  return res.data;
};

/**
 * Triggers a contextual explanation for an approval recommendation.
 */
export const explainApproval = async (approvalId, approvalName = null, sessionId = null) => {
  const res = await api.post('/api/assistant/explain-approval', {
    approval_id: approvalId,
    approval_name: approvalName,
    session_id: sessionId
  });
  return res.data;
};
