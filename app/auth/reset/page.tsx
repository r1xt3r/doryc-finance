'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { useLanguage } from '../../../lib/useLanguage';
import LanguageSelector from '../../components/LanguageSelector';
import LogoMark from '../../components/LogoMark';

export default function ResetPasswordPage() {
  const { language, setLanguage } = useLanguage();
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') || '');
    setBusy(true); setMessage('');
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage(tr('Password updated. You can return to Doryc.', 'Contraseña actualizada. Ya puedes volver a Doryc.'));
    window.setTimeout(() => window.location.replace('/'), 900);
  }
  return <main className="standalone-auth"><section><div className="standalone-auth-top"><LogoMark/><LanguageSelector language={language} onChange={setLanguage}/></div><p className="eyebrow">DORYC SECURITY</p><h1>{tr('New password', 'Nueva contraseña')}</h1><p>{tr('Use a unique password with at least eight characters.', 'Usa una contraseña única de al menos ocho caracteres.')}</p><form onSubmit={submit}><label><span>{tr('New password', 'Contraseña nueva')}</span><input name="password" type="password" minLength={8} required autoComplete="new-password"/></label>{message && <div className="auth-message" role="status">{message}</div>}<button className="save-button" disabled={busy}>{busy ? tr('Updating…', 'Actualizando…') : tr('Save password', 'Guardar contraseña')}</button></form><Link href="/login">{tr('Back to sign in', 'Volver al acceso')}</Link></section></main>;
}
