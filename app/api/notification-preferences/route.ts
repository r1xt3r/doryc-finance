import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

async function context(request: Request) {
  const supabase = await createClient(request.headers.get('authorization'));
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await context(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('notification_preferences').select('payment_reminders,monthly_expense_report,unsubscribed_at').maybeSingle();
  if (error) return Response.json({ error: 'Unable to load email preferences.' }, { status: 500 });
  return Response.json(data || { payment_reminders: false, monthly_expense_report: false, unsubscribed_at: null });
}

export async function POST(request: Request) {
  const { supabase, user } = await context(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json() as { paymentReminders?: boolean; monthlyExpenseReport?: boolean; unsubscribeAll?: boolean };
  const paymentReminders = body.unsubscribeAll ? false : body.paymentReminders === true;
  const monthlyExpenseReport = body.unsubscribeAll ? false : body.monthlyExpenseReport === true;
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: user.id,
    payment_reminders: paymentReminders,
    monthly_expense_report: monthlyExpenseReport,
    unsubscribed_at: paymentReminders || monthlyExpenseReport ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: 'Unable to save email preferences.' }, { status: 500 });
  return Response.json({ payment_reminders: paymentReminders, monthly_expense_report: monthlyExpenseReport });
}
