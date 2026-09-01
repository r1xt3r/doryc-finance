import { createClient } from '@supabase/supabase-js';
import { emailLayout, escapeHtml, sendEmail } from '../../../../lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Preference = { user_id: string; payment_reminders: boolean; monthly_expense_report: boolean };
type Recurring = { name: string; amount_cents: number; next_due_date: string; payment_method: string | null };
type Expense = { amount_cents: number; category: string | null };

const dateInEcuador = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const previousMonth = (value: string) => { const date = new Date(`${value.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7); };
const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Notification service is not configured.' }, { status: 503 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: preferences, error } = await admin.from('notification_preferences').select('user_id,payment_reminders,monthly_expense_report').is('unsubscribed_at', null).or('payment_reminders.eq.true,monthly_expense_report.eq.true');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const today = dateInEcuador();
  const tomorrow = addDays(today, 1);
  const reportMonth = previousMonth(today);
  let sent = 0;
  const failures: string[] = [];

  for (const preference of (preferences || []) as Preference[]) {
    const { data: userResult } = await admin.auth.admin.getUserById(preference.user_id);
    const email = userResult.user?.email;
    if (!email) continue;
    try {
      if (preference.payment_reminders) {
        const deliveryKey = tomorrow;
        const { data: delivered } = await admin.from('email_deliveries').select('id').eq('user_id', preference.user_id).eq('email_type', 'payment_reminder').eq('delivery_key', deliveryKey).maybeSingle();
        if (!delivered) {
          const { data: payments } = await admin.from('recurring_payments').select('name,amount_cents,next_due_date,payment_method').eq('user_id', preference.user_id).eq('active', true).eq('next_due_date', tomorrow);
          const upcoming = (payments || []) as Recurring[];
          if (upcoming.length) {
            const rows = upcoming.map((payment) => `<tr><td style="padding:10px 0;border-bottom:1px solid #273027"><strong>${escapeHtml(payment.name)}</strong><br><small style="color:#929b90">${escapeHtml(payment.payment_method || 'Pago programado')}</small></td><td align="right" style="padding:10px 0;border-bottom:1px solid #273027;font-weight:800">${money(payment.amount_cents)}</td></tr>`).join('');
            const total = upcoming.reduce((sum, payment) => sum + payment.amount_cents, 0);
            const html = emailLayout('Pagos para mañana', `Tienes ${upcoming.length} ${upcoming.length === 1 ? 'pago programado' : 'pagos programados'} para mañana.`, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}<tr><td style="padding-top:14px;color:#bdf477;font-weight:800">Total</td><td align="right" style="padding-top:14px;color:#bdf477;font-weight:900">${money(total)}</td></tr></table>`);
            const providerId = await sendEmail(email, upcoming.length === 1 ? `Mañana: ${upcoming[0].name}` : `Tus ${upcoming.length} pagos de mañana`, html, `reminder-${preference.user_id}-${deliveryKey}`);
            await admin.from('email_deliveries').insert({ user_id: preference.user_id, email_type: 'payment_reminder', delivery_key: deliveryKey, provider_id: providerId });
            sent++;
          }
        }
      }
      if (preference.monthly_expense_report && today.endsWith('-01')) {
        const { data: delivered } = await admin.from('email_deliveries').select('id').eq('user_id', preference.user_id).eq('email_type', 'monthly_expense_report').eq('delivery_key', reportMonth).maybeSingle();
        if (!delivered) {
          const { data: expenses } = await admin.from('transactions').select('amount_cents,category').eq('user_id', preference.user_id).eq('type', 'expense').gte('budget_month', `${reportMonth}-01`).lt('budget_month', `${today.slice(0, 7)}-01`);
          const rows = (expenses || []) as Expense[];
          const byCategory = new Map<string, number>();
          for (const expense of rows) byCategory.set(expense.category || 'Otros', (byCategory.get(expense.category || 'Otros') || 0) + expense.amount_cents);
          const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
          const total = rows.reduce((sum, expense) => sum + expense.amount_cents, 0);
          const details = categories.length ? categories.map(([category, amount]) => `<tr><td style="padding:9px 0;border-bottom:1px solid #273027">${escapeHtml(category)}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #273027;font-weight:800">${money(amount)}</td></tr>`).join('') : '<tr><td style="padding:12px 0;color:#929b90">No registraste gastos durante este mes.</td></tr>';
          const html = emailLayout('Tu reporte mensual de gastos', `Este es el resumen de tus gastos correspondientes a ${reportMonth}.`, `<p style="margin:0 0 14px;color:#bdf477;font-size:24px;font-weight:900">${money(total)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${details}</table>`);
          const providerId = await sendEmail(email, `Reporte de gastos · ${reportMonth}`, html, `monthly-${preference.user_id}-${reportMonth}`);
          await admin.from('email_deliveries').insert({ user_id: preference.user_id, email_type: 'monthly_expense_report', delivery_key: reportMonth, provider_id: providerId });
          sent++;
        }
      }
    } catch (cause) {
      failures.push(`${preference.user_id}: ${cause instanceof Error ? cause.message : 'Unknown error'}`);
    }
  }
  return Response.json({ checked: preferences?.length || 0, sent, failures });
}
