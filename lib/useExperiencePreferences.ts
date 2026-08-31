'use client';
import { useEffect, useState } from 'react';

export type ExperiencePreferences = { theme: 'forest' | 'midnight' | 'warm'; motion: 'full' | 'reduced' };
const defaults: ExperiencePreferences = { theme: 'forest', motion: 'full' };

export function useExperiencePreferences() {
  const [preferences, setPreferences] = useState(defaults);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setPreferences({ ...defaults, ...JSON.parse(window.localStorage.getItem('doryc_experience') || '{}') }); } catch { /* Keep safe defaults. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.motion;
    window.localStorage.setItem('doryc_experience', JSON.stringify(preferences));
  }, [preferences]);
  return { preferences, setPreferences };
}
