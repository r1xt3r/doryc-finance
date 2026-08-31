const FREE_DIGITAL_TRANSFER_BANKS = new Set(['guayaquil']);
const SUPPORTED_BANKS = new Set(['pichincha', 'produbanco', 'guayaquil', 'pacifico', 'delpacifico']);

export function normalizeBankName(bank: string) {
  return bank
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bbanco\b/g, '')
    .replace(/[^a-z]/g, '');
}

export function digitalTransferFeeCents(sourceBank: string, destinationBank: string) {
  const source = normalizeBankName(sourceBank);
  const destination = normalizeBankName(destinationBank);
  if (!source || !destination || source === destination) return 0;
  if (!SUPPORTED_BANKS.has(source) || !SUPPORTED_BANKS.has(destination)) return 0;
  return FREE_DIGITAL_TRANSFER_BANKS.has(source) ? 0 : 41;
}
