'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FinanceNotification } from '../domain/notifications';
export default function NotificationCenter({ items, language, onNavigate, open, onToggle, onClose }: { items: FinanceNotification[]; language: 'en' | 'es'; onNavigate: (target: FinanceNotification['target']) => void; open: boolean; onToggle: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ top: 82, left: 12 });
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !popover.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, onClose]);
  const toggle = () => {
    const bounds = trigger.current?.getBoundingClientRect();
    if (!open && bounds) {
      const width = Math.min(360, window.innerWidth - 24);
      setPosition({ top: bounds.bottom + 8, left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)) });
    }
    onToggle();
  };
  const content = open && typeof document !== 'undefined' ? createPortal(<section ref={popover} className="notification-popover notification-popover-portal" style={{ top: position.top, left: position.left }}><header><span><p className="eyebrow">DORYC SIGNALS</p><h3>{language === 'es' ? 'Tu atención financiera' : 'Your financial attention'}</h3></span><small>{items.length}</small></header>{items.map((item) => <button type="button" className={item.tone} key={item.id} onClick={() => { onNavigate(item.target); onClose(); }}><i/><span><strong>{item.title}</strong><small>{item.detail}</small></span><b>→</b></button>)}</section>, document.body) : null;
  return <div className="notification-center" ref={root}><button ref={trigger} className="notification-trigger" type="button" aria-label={language === 'es' ? 'Notificaciones financieras' : 'Financial notifications'} aria-expanded={open} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{items.length > 0 && <b>{items.length}</b>}</button>{content}</div>;
}
