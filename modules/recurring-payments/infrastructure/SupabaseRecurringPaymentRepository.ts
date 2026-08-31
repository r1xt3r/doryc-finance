import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecurringPaymentRepository } from '../application/ports/RecurringPaymentRepository';

export class SupabaseRecurringPaymentRepository implements RecurringPaymentRepository {
  constructor(private readonly client: SupabaseClient) {}
  async updateDueDate(id: string, dueDate: string) {
    const { error } = await this.client.from('recurring_payments').update({ next_due_date: dueDate }).eq('id', id);
    return !error;
  }
}
