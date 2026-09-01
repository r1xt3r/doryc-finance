'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { useLanguage } from '../../lib/useLanguage';
import LanguageSelector from '../components/LanguageSelector';
import LogoMark from '../components/LogoMark';

async function accessToken() {
  const stored = window.sessionStorage.getItem('doryc_access_token');
  if (stored) return stored;
  return Promise.race([createClient().auth.getSession().then((result: { data: { session: { access_token: string } | null } }) => result.data.session?.access_token || null), new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4_000))]);
}

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [confirmation, setConfirmation] = useState('');
  const [paymentReminders, setPaymentReminders] = useState(false); const [monthlyExpenseReport, setMonthlyExpenseReport] = useState(false); const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace('/login'), 12_000);
    createClient().auth.getUser().then((result: { data: { user: { email?: string; user_metadata?: { full_name?: string } } | null } }) => { const { data } = result; window.clearTimeout(timer); if (!data.user) { window.location.replace('/login'); return; } setEmail(data.user.email || ''); setName(String(data.user.user_metadata?.full_name || '')); });
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    accessToken().then(async (token) => {
      if (!token) return;
      const response = await fetch('/api/notification-preferences', { headers: { authorization: `Bearer ${token}` } });
      if (response.ok) { const preferences = await response.json(); setPaymentReminders(Boolean(preferences.payment_reminders)); setMonthlyExpenseReport(Boolean(preferences.monthly_expense_report)); }
      setNotificationsLoaded(true);
    });
  }, []);
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const password = String(new FormData(event.currentTarget).get('password') || '');
    const attributes: { data: { full_name: string }; password?: string } = { data: { full_name: name.trim() } }; if (password) attributes.password = password;
    const { error } = await createClient().auth.updateUser(attributes); setBusy(false); setMessage(error ? error.message : tr('Changes saved successfully.', 'Cambios guardados correctamente.'));
  }
  async function exportData() {
    setBusy(true); setMessage(''); const token = await accessToken(); const response = await fetch('/api/account', { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!response.ok) { setMessage(tr('We could not prepare the export.', 'No pudimos preparar la exportación.')); setBusy(false); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `doryc-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setBusy(false); setMessage(tr('Export downloaded.', 'Exportación descargada.'));
  }
  async function deleteAccount() {
    const deletionWord = language === 'es' ? 'ELIMINAR' : 'DELETE'; if (confirmation !== deletionWord) return; setBusy(true); setMessage(''); const token = await accessToken();
    const response = await fetch('/api/account', { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} }); const result = await response.json();
    if (!response.ok) { setMessage(result.error || tr('We could not delete the account.', 'No pudimos eliminar la cuenta.')); setBusy(false); return; }
    await createClient().auth.signOut(); window.sessionStorage.clear(); window.location.replace('/login');
  }
  async function saveNotifications(unsubscribeAll = false) {
    setBusy(true); setMessage(''); const token = await accessToken();
    const response = await fetch('/api/notification-preferences', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ paymentReminders, monthlyExpenseReport, unsubscribeAll }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(result.error || tr('We could not save your email preferences.', 'No pudimos guardar tus preferencias de correo.')); return; }
    setPaymentReminders(Boolean(result.payment_reminders)); setMonthlyExpenseReport(Boolean(result.monthly_expense_report));
    setMessage(unsubscribeAll ? tr('You have unsubscribed from all Doryc emails.', 'Te diste de baja de todos los correos de Doryc.') : tr('Email preferences saved.', 'Preferencias de correo guardadas.'));
  }
  const deletionWord = language === 'es' ? 'ELIMINAR' : 'DELETE';
  return <main className="settings-page"><header><Link href="/" aria-label={tr('Back to Doryc', 'Volver a Doryc')}><LogoMark/></Link><div className="settings-header-actions"><LanguageSelector language={language} onChange={setLanguage}/><Link href="/">← {tr('Back to dashboard', 'Volver al dashboard')}</Link></div></header><section className="settings-hero"><p className="eyebrow">{tr('ACCOUNT & DATA', 'CUENTA Y DATOS')}</p><h1>{tr('Your space in Doryc', 'Tu espacio en Doryc')}</h1><p>{tr('Manage your identity, security and a copy of your information.', 'Administra tu identidad, seguridad y una copia de tu información.')}</p></section>{message && <div className="settings-message" role="status">{message}</div>}<div className="settings-grid">
    <section className="settings-card"><p className="eyebrow">{tr('PROFILE & SECURITY', 'PERFIL Y SEGURIDAD')}</p><h2>{tr('Access information', 'Información de acceso')}</h2><form onSubmit={updateProfile}><label><span>{tr('Name', 'Nombre')}</span><input value={name} onChange={(event) => setName(event.target.value)} required/></label><label><span>{tr('Email', 'Correo')}</span><input value={email} disabled/></label><label><span>{tr('New password (optional)', 'Nueva contraseña (opcional)')}</span><input name="password" type="password" minLength={8} autoComplete="new-password" placeholder={tr('Leave empty to keep it', 'Déjalo vacío para conservarla')}/></label><button className="save-button" disabled={busy}>{tr('Save changes', 'Guardar cambios')}</button></form></section>
    <section className="settings-card"><p className="eyebrow">{tr('PORTABILITY', 'PORTABILIDAD')}</p><h2>{tr('Export your data', 'Exporta tus datos')}</h2><p>{tr('Download all your accounts, movements, payments, cards and loans as JSON.', 'Descarga en JSON todas tus cuentas, movimientos, pagos, tarjetas y préstamos.')}</p><button className="secondary-button" type="button" onClick={exportData} disabled={busy}>{tr('Download my information', 'Descargar mi información')}</button></section>
    <section className="settings-card notification-settings"><p className="eyebrow">{tr('EMAIL NOTIFICATIONS', 'NOTIFICACIONES POR CORREO')}</p><h2>{tr('Useful emails, under your control', 'Correos útiles, bajo tu control')}</h2><p>{tr('Choose exactly what Doryc may send to your registered email.', 'Elige exactamente qué puede enviar Doryc a tu correo registrado.')}</p><div className="notification-options"><label><input type="checkbox" checked={paymentReminders} onChange={(event) => setPaymentReminders(event.target.checked)} disabled={!notificationsLoaded || busy}/><span><strong>{tr('Payment reminder', 'Recordatorio de pago')}</strong><small>{tr('One email, one day before each recurring payment.', 'Un correo, un día antes de cada pago recurrente.')}</small></span></label><label><input type="checkbox" checked={monthlyExpenseReport} onChange={(event) => setMonthlyExpenseReport(event.target.checked)} disabled={!notificationsLoaded || busy}/><span><strong>{tr('Monthly expense report', 'Reporte mensual de gastos')}</strong><small>{tr('A monthly total and breakdown by spending category.', 'Total mensual y desglose por categoría de gastos.')}</small></span></label></div><button className="secondary-button" type="button" onClick={() => saveNotifications(false)} disabled={!notificationsLoaded || busy}>{tr('Save notification preferences', 'Guardar preferencias')}</button><button className="unsubscribe-button" type="button" onClick={() => saveNotifications(true)} disabled={!notificationsLoaded || busy}>{tr('Unsubscribe from all emails', 'Darme de baja de todos los correos')}</button></section>
    <section className="settings-card danger-zone"><p className="eyebrow">{tr('DANGER ZONE', 'ZONA DE RIESGO')}</p><h2>{tr('Delete account', 'Eliminar cuenta')}</h2><p>{tr('This permanently deletes your user and all associated financial information.', 'Esta acción elimina permanentemente tu usuario y toda la información financiera asociada.')}</p><label><span>{tr(`Type ${deletionWord} to confirm`, `Escribe ${deletionWord} para confirmar`)}</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></label><button type="button" onClick={deleteAccount} disabled={busy || confirmation !== deletionWord}>{tr('Delete my account', 'Eliminar mi cuenta')}</button></section>
  </div><footer><Link href="/privacy">{tr('Privacy', 'Privacidad')}</Link><Link href="/terms">{tr('Terms', 'Términos')}</Link><a href="mailto:ramolinap03@gmail.com">{tr('Support: Richard Molina', 'Soporte: Richard Molina')}</a></footer></main>;
}
