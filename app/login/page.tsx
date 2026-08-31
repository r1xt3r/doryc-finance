'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import type { AuthResponse } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import LogoMark from '../components/LogoMark';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../../lib/useLanguage';

const AUTH_TIMEOUT_MS = 15_000;

function withAuthTimeout(request: PromiseLike<AuthResponse>): Promise<AuthResponse> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Supabase está tardando demasiado en responder. Espera un momento e inténtalo nuevamente.')), AUTH_TIMEOUT_MS)),
  ]);
}

export default function LoginPage() {
  const root = useRef<HTMLElement>(null);
  const { language, setLanguage } = useLanguage();
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="auth-language"><LanguageSelector language={language} onChange={setLanguage} /></div>
      <section className="auth-brand">
        <LogoMark />
        <p className="eyebrow">{tr('PERSONAL FINANCE, IN MOTION', 'FINANZAS PERSONALES, EN MOVIMIENTO')}</p>
        <h1>{tr('Your money,', 'Tu dinero,')}<br />{tr('calmly organized.', 'en calma y orden.')}</h1>
        <p>{tr('Accounts, recurring payments and daily spending in one private place.', 'Cuentas, pagos recurrentes y gastos diarios en un solo lugar privado.')}</p>
        <div className="auth-points" aria-label={tr('Doryc benefits', 'Beneficios de Doryc')}><span>01 <b>{tr('Private by design', 'Privado por diseño')}</b></span><span>02 <b>{tr('Your month at a glance', 'Tu mes de un vistazo')}</b></span><span>03 <b>{tr('Built for real life', 'Hecho para la vida real')}</b></span></div>
        <div className="auth-orbit"><span /><span /><span /></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">{tr('WELCOME TO DORYC', 'BIENVENIDO A DORYC')}</p>
            <h2>{mode === 'signin' ? tr('Sign in', 'Iniciar sesión') : tr('Create your account', 'Crea tu cuenta')}</h2>
            <p>{mode === 'signin' ? tr('Use your email and password.', 'Usa tu correo y contraseña.') : tr('Your financial information will belong only to this account.', 'Tu información financiera pertenecerá únicamente a esta cuenta.')}</p>
          </div>
          <form onSubmit={submit}>
            {mode === 'signup' && <label><span>{tr('Name', 'Nombre')}</span><input name="fullName" required autoComplete="name" placeholder="Richard" /></label>}
            <label><span>{tr('Email', 'Correo')}</span><input name="email" required type="email" autoComplete="email" placeholder="tu@ejemplo.com" /></label>
            <label><span>{tr('Password', 'Contraseña')}</span><div className="password-field"><input name="password" required type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={tr('At least 8 characters', 'Mínimo 8 caracteres')} /><button type="button" aria-label={showPassword ? tr('Hide password', 'Ocultar contraseña') : tr('Show password', 'Mostrar contraseña')} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? tr('Hide', 'Ocultar') : tr('Show', 'Mostrar')}</button></div></label>
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="save-button" type="submit" disabled={busy}>{busy ? tr('Please wait…', 'Espera…') : mode === 'signin' ? tr('Sign in', 'Iniciar sesión') : tr('Create account', 'Crear cuenta')}</button>
          </form>
          <button className="mode-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
            {mode === 'signin' ? tr('New to Doryc? Create an account', '¿Nuevo en Doryc? Crea una cuenta') : tr('Already have an account? Sign in', '¿Ya tienes cuenta? Inicia sesión')}
          </button>
        </div>
      </section>
    </main>
  );
}
