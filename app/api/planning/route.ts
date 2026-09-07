import { createClient } from '../../../lib/supabase/server';

async function context(request: Request) {
  const supabase = await createClient(request.headers.get('authorization'));
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await context(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const [budgets, goals, categories, rules, reconciliations, audit, plan, accountRoles] = await Promise.all([
    supabase.from('monthly_budgets').select('*').order('category'),
    supabase.from('savings_goals').select('*').eq('active', true).order('created_at'),
    supabase.from('custom_categories').select('*').order('name'),
    supabase.from('category_rules').select('*').order('match_text'),
    supabase.from('cash_reconciliations').select('*').order('reconciled_at', { ascending: false }).limit(10),
    supabase.from('financial_audit_log').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('financial_plans').select('*').maybeSingle(),
    supabase.from('account_roles').select('*'),
  ]);
  if (budgets.error) return Response.json({ unavailable: true, budgets: [], goals: [], categories: [], rules: [], reconciliations: [], audit: [], plan: null, accountRoles: [] });
  return Response.json({ budgets: budgets.data || [], goals: goals.data || [], categories: categories.data || [], rules: rules.data || [], reconciliations: reconciliations.data || [], audit: audit.data || [], plan: plan.data || null, accountRoles: accountRoles.data || [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await context(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const cents = (value: unknown) => Math.round(Number(String(value ?? 0).trim().replace(',', '.')) * 100);
  let result;
  if (body.entity === 'budgetDistribution') {
    const entries = Array.isArray(body.entries) ? body.entries.filter((entry: { category?: unknown; limit?: unknown }) => String(entry.category || '').trim() && cents(entry.limit) > 0) : [];
    if (!entries.length) return Response.json({ error: 'Add at least one spending category.' }, { status: 400 });
    result = await supabase.from('monthly_budgets').upsert(entries.map((entry: { category: unknown; limit: unknown }) => ({ user_id: user.id, month: `${body.month}-01`, category: String(entry.category).trim(), limit_cents: cents(entry.limit), mode: 'balanced', updated_at: new Date().toISOString() })), { onConflict: 'user_id,month,category' });
  }
  else if (body.entity === 'budget') result = await supabase.from('monthly_budgets').upsert({ user_id: user.id, month: `${body.month}-01`, category: body.category, limit_cents: cents(body.limit), mode: body.mode || 'custom', updated_at: new Date().toISOString() }, { onConflict: 'user_id,month,category' });
  else if (body.entity === 'goal') {
    if (!String(body.name || '').trim() || cents(body.target) <= 0) return Response.json({ error: 'Add a name and a valid target amount.' }, { status: 400 });
    result = await supabase.from('savings_goals').insert({ user_id: user.id, name: String(body.name).trim(), target_cents: cents(body.target), saved_cents: Math.max(0, cents(body.saved || 0)), target_date: body.targetDate || null, account_id: body.accountId || null, color: body.color || '#b49cff' });
  }
  else if (body.entity === 'goalUpdate') {
    if (!body.id || !String(body.name || '').trim() || cents(body.target) <= 0) return Response.json({ error: 'Invalid savings goal.' }, { status: 400 });
    result = await supabase.from('savings_goals').update({ name: String(body.name).trim(), target_cents: cents(body.target), target_date: body.targetDate || null, account_id: body.accountId || null }).eq('id', body.id);
  }
  else if (body.entity === 'goalDelete') {
    if (!body.id) return Response.json({ error: 'Invalid savings goal.' }, { status: 400 });
    result = await supabase.from('savings_goals').update({ active: false }).eq('id', body.id);
  }
  else if (body.entity === 'category') result = await supabase.from('custom_categories').insert({ user_id: user.id, name: String(body.name).trim(), icon: body.icon || '•', color: body.color || '#b49cff', kind: body.kind || 'expense' });
  else if (body.entity === 'rule') result = await supabase.from('category_rules').upsert({ user_id: user.id, match_text: String(body.matchText).trim().toLowerCase(), category: body.category }, { onConflict: 'user_id,match_text' });
  else if (body.entity === 'reconciliation') result = await supabase.from('cash_reconciliations').insert({ user_id: user.id, account_id: body.accountId, expected_cents: cents(body.expected), counted_cents: cents(body.counted), difference_cents: cents(Number(body.counted) - Number(body.expected)) });
  else if (body.entity === 'financialPlan') {
    if (body.savingsAccountId && body.savingsRoleConfirmed !== true) return Response.json({ error: 'Confirm the selected account as your savings destination.' }, { status: 400 });
    if (body.savingsAccountId) {
      const { data: account } = await supabase.from('accounts').select('id').eq('id', body.savingsAccountId).maybeSingle();
      if (!account) return Response.json({ error: 'Invalid savings account.' }, { status: 400 });
      const roleResult = await supabase.from('account_roles').upsert({ user_id: user.id, account_id: body.savingsAccountId, role: 'savings', confirmed_at: new Date().toISOString() }, { onConflict: 'account_id' });
      if (roleResult.error) return Response.json({ error: roleResult.error.message }, { status: 400 });
    }
    result = await supabase.from('financial_plans').upsert({ user_id: user.id, strategy: body.strategy || 'prioritize_savings', monthly_income_cents: cents(body.monthlyIncome), personal_allowance_cents: cents(body.personalAllowance), surplus_destination: body.surplusDestination || 'savings', savings_account_id: body.savingsAccountId || null, include_credit_estimate: body.includeCreditEstimate !== false, savings_role_confirmed: Boolean(body.savingsAccountId && body.savingsRoleConfirmed), updated_at: new Date().toISOString() });
  }
  else return Response.json({ error: 'Unsupported planning entry.' }, { status: 400 });
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  await supabase.from('financial_audit_log').insert({ user_id: user.id, action: 'create_or_update', entity_type: body.entity, detail: { source: 'planning' } });
  return GET(request);
}
