import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", nativeName: "मराठी", flag: "🇮🇳" }
];

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem("anumatisetu_lang") || "en";
  });

  const setLanguage = (langCode) => {
    if (translations[langCode]) {
      setLanguageState(langCode);
      localStorage.setItem("anumatisetu_lang", langCode);
      document.documentElement.lang = langCode;
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Translation helper function with parameter interpolation
  const t = (key, params = {}, fallback = "") => {
    const langDict = translations[language] || translations.en;
    let translation = langDict[key] || translations.en[key] || fallback || key;

    if (typeof translation === "string" && params && typeof params === "object") {
      Object.keys(params).forEach((paramKey) => {
        translation = translation.replace(new RegExp(`{${paramKey}}`, "g"), params[paramKey]);
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
        currentLanguage: SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0]
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
