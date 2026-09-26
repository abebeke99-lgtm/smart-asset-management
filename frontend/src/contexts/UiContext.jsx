import React, { createContext, useContext, useState, useEffect } from 'react';

const UiContext = createContext();
const normalizeLanguage = (language) => language === 'am' ? 'am' : 'en';

export const useLanguage = () => {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error('useLanguage must be used within UiProvider');
  }
  return { 
    language: context.language, 
    setLanguage: context.setLanguage, 
    theme: context.theme 
  };
};

export const useTheme = () => {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error('useTheme must be used within UiProvider');
  }
  return { 
    theme: context.theme, 
    setTheme: context.setTheme 
  };
};

export const UiProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return normalizeLanguage(localStorage.getItem('language'));
  });
  const setSupportedLanguage = (nextLanguage) => {
    setLanguage((currentLanguage) => normalizeLanguage(
      typeof nextLanguage === 'function' ? nextLanguage(currentLanguage) : nextLanguage
    ));
  };
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language === 'am' ? 'am' : 'en';
  }, [language]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.style.backgroundColor = theme === 'dark' ? '#0d1b2a' : '#f7fafc';
  }, [theme]);

  const value = {
    language,
    setLanguage: setSupportedLanguage,
    theme,
    setTheme
  };

  return (
    <UiContext.Provider value={value}>
      {children}
    </UiContext.Provider>
  );
};

export const UIProvider = UiProvider;