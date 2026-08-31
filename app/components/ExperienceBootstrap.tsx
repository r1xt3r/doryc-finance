'use client';

import { useExperiencePreferences } from '../../lib/useExperiencePreferences';

export default function ExperienceBootstrap() {
  useExperiencePreferences();
  return null;
}
