/** Parse a user-entered number using either European or English decimals. */
export const parseFlexibleNumber = (value: string): number => {
  const raw = value.trim().replace(/\s/g, '')
  if (!raw) return Number.NaN
  const normalized = raw.includes(',')
    ? raw.includes('.') && raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '.')
    : raw
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
