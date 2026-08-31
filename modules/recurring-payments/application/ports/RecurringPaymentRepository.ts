export interface RecurringPaymentRepository {
  updateDueDate(id: string, dueDate: string): Promise<boolean>;
}
