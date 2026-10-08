import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translateMessage } from '../i18n/messages';

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
    t: context.t,
    theme: context.theme
  };
};

export const useTranslation = () => {
  const context = useContext(UiContext);
  return {
    language: normalizeLanguage(context?.language),
    t: context?.t || ((key, fallback, values) => (
      translateMessage(normalizeLanguage(context?.language), key, fallback, values)
    ))
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
  const t = useCallback((key, fallback, values) => (
    translateMessage(language, key, fallback, values)
  ), [language]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language === 'am' ? 'am' : 'en';
    document.documentElement.dir = 'ltr';
  }, [language]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const value = {
    language,
    setLanguage: setSupportedLanguage,
    t,
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