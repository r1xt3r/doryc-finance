'use client';

import { useEffect, useState } from 'react';

export type Language = 'en' | 'es';

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = window.localStorage.getItem('doryc_language');
    const preferred = saved === 'es' || saved === 'en' ? saved : navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    const timer = window.setTimeout(() => setLanguageState(preferred), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
    window.localStorage.setItem('doryc_language', next);
    document.documentElement.lang = next;
  }

  return { language, setLanguage };
}
