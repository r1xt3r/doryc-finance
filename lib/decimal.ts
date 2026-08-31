export function decimalNumber(value: unknown) {
  if (typeof value === 'number') return value;
  const compact = String(value ?? '').trim().replace(/\s/g, '');
  const comma = compact.lastIndexOf(',');
  const dot = compact.lastIndexOf('.');
  const normalized = comma >= 0 && dot >= 0
    ? comma > dot ? compact.replace(/\./g, '').replace(',', '.') : compact.replace(/,/g, '')
    : compact.replace(',', '.');
  return Number(normalized);
}
