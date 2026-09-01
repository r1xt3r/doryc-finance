import { createClient } from '../../../lib/supabase/server';

const exportTables = ['accounts', 'transactions', 'recurring_payments', 'shared_payment_contributions', 'credit_cards', 'credit_card_purchases', 'credit_card_payments', 'personal_loans', 'personal_loan_payments', 'bank_loans', 'bank_loan_payments', 'user_preferences'] as const;

async function authenticated(request: Request) {
  const supabase = await createClient(request.headers.get('authorization'));
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await authenticated(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const results = await Promise.all(exportTables.map(async (table) => {
    const { data, error } = await supabase.from(table).select('*');
    if (error && table !== 'bank_loan_payments' && table !== 'shared_payment_contributions') throw error;
    return [table, data || []] as const;
  }));
  return Response.json({ exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, name: user.user_metadata?.full_name || null }, data: Object.fromEntries(results) }, { headers: { 'Content-Disposition': `attachment; filename="doryc-export-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authenticated(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await supabase.rpc('doryc_delete_my_account');
  if (error) return Response.json({ error: 'Account deletion is not enabled yet. Apply the launch-readiness migration in Supabase.' }, { status: 503 });
  return Response.json({ deleted: true });
}
