import type { QuotationPricingLine } from '@/types/quotation'

export interface VatPricingTotals {
  netAmount: number
  vatAmount: number
  total: number
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export const calculateVatTotalsFromPricingLines = (
  lines: Array<Pick<QuotationPricingLine, 'price' | 'vatRate'>>,
  mapNetAmount?: (netAmount: number) => number
): VatPricingTotals => {
  const validLines = lines.filter(
    (line) => Number.isFinite(Number(line.price)) && Number(line.price) > 0
  )

  if (validLines.length === 0) {
    return { netAmount: 0, vatAmount: 0, total: 0 }
  }

  let netAmount = 0
  let vatAmount = 0

  for (const line of validLines) {
    const rawNet = Number(line.price)
    const lineNet = mapNetAmount ? mapNetAmount(rawNet) : rawNet
    const lineVat = (lineNet * (Number(line.vatRate) || 0)) / 100
    netAmount += lineNet
    vatAmount += lineVat
  }

  netAmount = roundMoney(netAmount)
  vatAmount = roundMoney(vatAmount)

  return {
    netAmount,
    vatAmount,
    total: roundMoney(netAmount + vatAmount),
  }
}
