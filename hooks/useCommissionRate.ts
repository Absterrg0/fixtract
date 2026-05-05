import { useState, useEffect, useCallback } from 'react'

export function useCommissionRate() {
  const [commissionPercent, setCommissionPercent] = useState<number | null>(null)
  const [commissionLoaded, setCommissionLoaded] = useState(false)
  const [commissionError, setCommissionError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchCommission = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/commission-rate`,
          { credentials: 'include', signal: controller.signal }
        )
        if (controller.signal.aborted) return
        if (res.ok) {
          const json = await res.json()
          setCommissionPercent(json?.data?.commissionPercent ?? 0)
          setCommissionError(null)
        } else {
          setCommissionPercent(0)
          setCommissionError(new Error(`Commission rate request failed (${res.status})`))
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch commission rate:', error)
        setCommissionPercent(0)
        setCommissionError(error instanceof Error ? error : new Error('Failed to fetch commission rate'))
      } finally {
        if (!controller.signal.aborted) setCommissionLoaded(true)
      }
    }

    fetchCommission()
    return () => controller.abort()
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
