const UNSIGNED_NUMBER = /^\d+(?:[.,]\d+)?$/

// Whitespace is accepted only as a thousands separator ("1 500,50" or "-1 500");
// arbitrary internal whitespace such as "2 1" is rejected.
const SPACE_GROUPED_NUMBER = /^[+-]?\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/

const normalizeGroupedInteger = (value: string, separator: ',' | '.'): string | null => {
  const escapedSeparator = separator === '.' ? '\\.' : ','
  const groupedPattern = new RegExp(`^\\d{1,3}(?:${escapedSeparator}\\d{3})+$`)
  if (!groupedPattern.test(value)) return null
  return value.split(separator).join('')
}

/** Parse a user-entered number using either European or English decimals. */
export const parseFlexibleNumber = (value: string): number => {
  const trimmed = value.trim()
  if (!trimmed) return Number.NaN
  if (/\s/.test(trimmed) && !SPACE_GROUPED_NUMBER.test(trimmed)) return Number.NaN
  const raw = trimmed.replace(/\s/g, '')

  const sign = raw.startsWith('-') || raw.startsWith('+') ? raw[0] : ''
  const unsigned = sign ? raw.slice(1) : raw
  if (!UNSIGNED_NUMBER.test(unsigned) && !unsigned.includes(',') && !unsigned.includes('.')) {
    return Number.NaN
  }

  let normalized: string | null = null
  const hasComma = unsigned.includes(',')
  const hasDot = unsigned.includes('.')

  if (hasComma && hasDot) {
    const decimalSeparator = unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.') ? ',' : '.'
    const decimalIndex = unsigned.lastIndexOf(decimalSeparator)
    const integerPart = unsigned.slice(0, decimalIndex)
    const decimalPart = unsigned.slice(decimalIndex + 1)
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    const normalizedInteger = integerPart.includes(groupingSeparator)
      ? normalizeGroupedInteger(integerPart, groupingSeparator)
      : integerPart

    if (normalizedInteger && /^\d+$/.test(decimalPart)) {
      normalized = `${normalizedInteger}.${decimalPart}`
    }
  } else if (hasComma) {
    normalized = normalizeGroupedInteger(unsigned, ',')
    if (!normalized) {
      normalized = unsigned.replace(',', '.')
    }
  } else if (hasDot) {
    normalized = unsigned.indexOf('.') === unsigned.lastIndexOf('.')
      ? unsigned
      : normalizeGroupedInteger(unsigned, '.')
  } else {
    normalized = unsigned
  }

  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return Number.NaN

  const parsed = Number(`${sign}${normalized}`)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
