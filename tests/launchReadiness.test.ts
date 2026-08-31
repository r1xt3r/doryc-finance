import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('every financial table in the canonical schema enables row-level security', () => {
  const schema = read('supabase/schema.sql');
  const tables = ['accounts', 'transactions', 'recurring_payments', 'credit_cards', 'credit_card_purchases', 'credit_card_payments', 'personal_loans', 'personal_loan_payments', 'user_preferences', 'bank_loans'];
  for (const table of tables) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS`);
    assert.match(schema, new RegExp(`auth\\.uid\\(\\).*user_id`, 'is'), 'policies must be scoped to auth.uid()');
  }
});

test('launch migrations restrict account deletion to authenticated users', () => {
  const migration = read('supabase/launch_readiness.sql');
  assert.match(migration, /revoke all[\s\S]*from public, anon/i);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);
  assert.match(migration, /where id = auth\.uid\(\)/i);
});

test('production surface includes recovery and legal routes', () => {
  assert.match(read('app/login/page.tsx'), /resetPasswordForEmail/);
  assert.match(read('app/auth/confirm/route.ts'), /startsWith\('\/'\)/);
  assert.match(read('app/components/LegalPage.tsx'), /Privacy Policy/);
  assert.match(read('next.config.ts'), /X-Frame-Options/);
});
