'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import type { AuthResponse } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import LogoMark from '../components/LogoMark';

const AUTH_TIMEOUT_MS = 15_000;

function withAuthTimeout(request: PromiseLike<AuthResponse>): Promise<AuthResponse> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Supabase está tardando demasiado en responder. Espera un momento e inténtalo nuevamente.')), AUTH_TIMEOUT_MS)),
  ]);
}

export default function LoginPage() {
  const root = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(root.current.querySelectorAll('.auth-brand > .brand-mark,.auth-brand > .eyebrow,.auth-brand > h1,.auth-brand > p'), {
      opacity: [0, 1], y: [24, 0], delay: stagger(110), duration: 760, ease: 'outExpo',
    });
    animate(root.current.querySelectorAll('.auth-card > *'), {
      opacity: [0, 1], x: [24, 0], delay: stagger(90, { start: 260 }), duration: 680, ease: 'outExpo',
    });
    animate(root.current.querySelectorAll('.auth-orbit span'), {
      scale: [0, 1], opacity: [0, 1], delay: stagger(130, { start: 520 }), duration: 900, ease: 'outElastic(1, .6)',
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    const fullName = String(form.get('fullName') || '');
    const supabase = createClient();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signup') {
        const { error } = await withAuthTimeout(supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        }));
        if (error) throw error;
        setMessage('Revisa tu correo y confirma tu cuenta para continuar.');
      } else {
        const { data, error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (error) throw error;
        if (!data.session) throw new Error('No se pudo crear la sesión. Confirma primero tu correo.');
        window.sessionStorage.setItem('doryc_access_token', data.session.access_token);
        window.location.replace('/');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos completar el acceso.');
    } finally { setBusy(false); }
  }

  return (
    <main ref={root} className="auth-shell">
      <section className="auth-brand">
        <LogoMark />
        <p className="eyebrow">PERSONAL FINANCE, IN MOTION</p>
        <h1>Your money,<br />calmly organized.</h1>
        <p>Accounts, recurring payments and daily spending in one private place.</p>
        <div className="auth-orbit"><span /><span /><span /></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">WELCOME TO DORYC</p>
            <h2>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
            <p>{mode === 'signin' ? 'Use your email and password.' : 'Your financial information will belong only to this account.'}</p>
          </div>
          <form onSubmit={submit}>
            {mode === 'signup' && <label><span>Name</span><input name="fullName" required autoComplete="name" placeholder="Richard" /></label>}
            <label><span>Email</span><input name="email" required type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <label><span>Password</span><input name="password" required type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" /></label>
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="save-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          </form>
          <button className="mode-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
            {mode === 'signin' ? 'New to Doryc? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}
