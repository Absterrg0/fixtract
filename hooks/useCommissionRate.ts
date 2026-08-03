import { useState, useEffect, useCallback } from 'react'
import { cachedClientRequest } from '@/lib/clientRequestCache'

const COMMISSION_CACHE_KEY = 'commission-rate'

export function useCommissionRate() {
  const [commissionPercent, setCommissionPercent] = useState<number | null>(null)
  const [commissionLoaded, setCommissionLoaded] = useState(false)
  const [commissionError, setCommissionError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true

    const fetchCommission = async () => {
      try {
        const commission = await cachedClientRequest<number>(
          COMMISSION_CACHE_KEY,
          async () => {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/commission-rate`,
              { credentials: 'include' },
            )
            if (!res.ok) {
              throw new Error(`Commission rate request failed (${res.status})`)
            }
            const json = await res.json()
            return Number(json?.data?.commissionPercent) || 0
          },
          0,
        )
        if (!active) return
        setCommissionPercent(commission)
        setCommissionError(null)
      } catch (error) {
        if (!active) return
        console.error('Failed to fetch commission rate:', error)
        setCommissionPercent(0)
        setCommissionError(error instanceof Error ? error : new Error('Failed to fetch commission rate'))
      } finally {
        if (active) setCommissionLoaded(true)
      }
    }

    fetchCommission()
    return () => {
      active = false
    }
  }, [])

  const customerPrice = useCallback(
    (amount: number) => {
      if (commissionPercent == null || !amount) return amount
      return +(amount * (1 + commissionPercent / 100)).toFixed(2)
    },
    [commissionPercent]
  )

  return { commissionPercent, commissionLoaded, commissionError, customerPrice }
}
