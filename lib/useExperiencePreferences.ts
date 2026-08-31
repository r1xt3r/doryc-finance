'use client';
import { useEffect, useState } from 'react';

export type ExperiencePreferences = { theme: 'forest' | 'midnight' | 'warm'; motion: 'full' | 'reduced' };
const defaults: ExperiencePreferences = { theme: 'forest', motion: 'full' };

export function useExperiencePreferences() {
  const [preferences, setPreferences] = useState<ExperiencePreferences>(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = JSON.parse(window.localStorage.getItem('doryc_experience') || '{}');
      return { ...defaults, ...saved };
    } catch { /* Keep safe defaults. */ }
    return defaults;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.motion;
    window.localStorage.setItem('doryc_experience', JSON.stringify(preferences));
  }, [preferences]);
  return { preferences, setPreferences };
}
