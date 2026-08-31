 'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExperiencePreferences } from '../../lib/useExperiencePreferences';

export default function ExperienceSettings({ value, language, onChange, open, onToggle, onStartTour }: { value: ExperiencePreferences; language: 'en' | 'es'; onChange: (value: ExperiencePreferences) => void; open: boolean; onToggle: () => void; onStartTour: () => void }) {
  const es = language === 'es';
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 82, left: 12 });
  const toggle = () => {
    const bounds = trigger.current?.getBoundingClientRect();
    if (!open && bounds) {
      const width = Math.min(286, window.innerWidth - 24);
      setPosition({ top: bounds.bottom + 8, left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)) });
    }
    onToggle();
  };
  const themes: Array<{ id: ExperiencePreferences['theme']; name: string; colors: string[] }> = [
    { id: 'forest', name: es ? 'Bosque' : 'Forest', colors: ['#bdf477', '#182019'] },
    { id: 'midnight', name: es ? 'Medianoche' : 'Midnight', colors: ['#80baff', '#101722'] },
    { id: 'warm', name: es ? 'Cálido' : 'Warm', colors: ['#f4c477', '#211b15'] },
  ];
  const popover = open && typeof document !== 'undefined' ? createPortal(<section className="experience-popover experience-popover-portal" style={{ top: position.top, left: position.left }} aria-label={es ? 'Preferencias de experiencia' : 'Experience preferences'} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <p className="eyebrow">{es ? 'EXPERIENCIA' : 'EXPERIENCE'}</p><h3>{es ? 'Hazlo tuyo' : 'Make it yours'}</h3>
      <div className="experience-group"><span>{es ? 'Tema' : 'Theme'}</span><div className="theme-options">{themes.map((theme) => <button key={theme.id} type="button" className={value.theme === theme.id ? 'active' : ''} aria-pressed={value.theme === theme.id} onClick={() => onChange({ ...value, theme: theme.id })}><i style={{ background: `linear-gradient(135deg,${theme.colors[0]} 0 50%,${theme.colors[1]} 50%)` }} /><b>{theme.name}</b>{value.theme === theme.id && <em>✓</em>}</button>)}</div></div>
      <div className="experience-group"><span>{es ? 'Movimiento' : 'Motion'}</span><div className="motion-options"><button type="button" className={value.motion === 'full' ? 'active' : ''} aria-pressed={value.motion === 'full'} onClick={() => onChange({ ...value, motion: 'full' })}><b>{es ? 'Completo' : 'Full'}</b><small>{es ? 'Animaciones y celebraciones' : 'Animations and celebrations'}</small></button><button type="button" className={value.motion === 'reduced' ? 'active' : ''} aria-pressed={value.motion === 'reduced'} onClick={() => onChange({ ...value, motion: 'reduced' })}><b>{es ? 'Reducido' : 'Reduced'}</b><small>{es ? 'Una experiencia más tranquila' : 'A calmer experience'}</small></button></div></div>
      <button className="restart-tour-button" type="button" onClick={onStartTour}><span>▷</span><b>{es ? 'Repetir tour de Doryc' : 'Replay Doryc tour'}</b><i>→</i></button>
      <a className="account-settings-link" href="/settings"><span>⚿</span><b>{es ? 'Cuenta y datos' : 'Account & data'}</b><i>→</i></a>
      <p className="experience-saved"><i />{es ? 'Los cambios se guardan automáticamente' : 'Changes save automatically'}</p>
    </section>, document.body) : null;
  return <div className="experience-settings">
    <button ref={trigger} className="experience-trigger" type="button" aria-label={es ? 'Personalizar Doryc' : 'Customize Doryc'} aria-expanded={open} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>
    </button>
    {popover}
  </div>;
}
