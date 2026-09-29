import React, { createContext, useContext, useState, useCallback } from 'react';

const AssistantContext = createContext(null);

export const AssistantProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState({
    page: 'dashboard',
    application_id: null,
    document_id: null,
    approval_id: null,
  });
  const [initialMessage, setInitialMessage] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const openAssistant = useCallback((contextOverride = {}, promptMessage = null) => {
    setCurrentContext((prev) => ({
      ...prev,
      ...contextOverride,
    }));
    if (promptMessage) {
      setInitialMessage(promptMessage);
    }
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    setInitialMessage(null);
  }, []);

  const toggleAssistant = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        currentContext,
        setCurrentContext,
        initialMessage,
        setInitialMessage,
        activeSessionId,
        setActiveSessionId,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

export const useTaskerAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useTaskerAssistant must be used within an AssistantProvider');
  }
  return context;
};
