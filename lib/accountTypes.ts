export function normalizeAccountType(value: string) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function isSavingsAccountType(value: string) {
  return ['savings', 'saving', 'ahorros', 'ahorro'].includes(normalizeAccountType(value));
}

export function isDedicatedSavingsAccount(bank: string, accountType: string) {
  const normalizedBank = bank.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return (normalizedBank.includes('produbanco') || normalizedBank.includes('promerica')) && isSavingsAccountType(accountType);
}
