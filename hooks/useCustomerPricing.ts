import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthToken } from '@/lib/utils'
import { useCommissionRate } from './useCommissionRate'
import { cachedClientRequest } from '@/lib/clientRequestCache'

interface LoyaltyDiscountInfo {
  level: string
  percentage: number
  maxDiscountAmount: number | null
}

interface LoyaltyStatusResponse {
  success?: boolean
  msg?: string
  error?: string
  data?: {
    userStats?: {
      tierInfo?: {
        name?: string
        discountPercentage?: number
        maxDiscountAmount?: number | null
      }
    }
    loyaltyStatus?: { level?: string }
  }
}

export interface CustomerPricing {
  commissionPercent: number | null
  commissionLoaded: boolean
  commissionError: Error | null
  loyalty: LoyaltyDiscountInfo | null
  loyaltyLoaded: boolean
  customerPrice: (amount: number) => number
  originalPrice: (amount: number) => number
  customerPriceWithRepeatBuyer: (amount: number, repeatBuyer?: { enabled?: boolean; percentage?: number; maxDiscountAmount?: number | null } | null, eligible?: boolean) => number
}

const toRoundedTwo = (value: number) => Math.round(value * 100) / 100

export function useCustomerPricing(): CustomerPricing {
  const { commissionPercent, commissionLoaded, commissionError, customerPrice: baseCustomerPrice } = useCommissionRate()
  const { user, isAuthenticated } = useAuth()
  const [loyalty, setLoyalty] = useState<LoyaltyDiscountInfo | null>(null)
  const [loyaltyLoaded, setLoyaltyLoaded] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') {
      setLoyalty(null)
      setLoyaltyLoaded(true)
      return
    }
    setLoyalty(null)
    setLoyaltyLoaded(false)
    let active = true
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    cachedClientRequest<LoyaltyStatusResponse>(
      `loyalty-status:${user._id}`,
      async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/loyalty/status`, {
          credentials: 'include',
          headers,
        })
        if (!res.ok) {
          throw new Error(`Loyalty status request failed (${res.status})`)
        }
        return res.json()
      },
      0,
    )
      .then((json) => {
        if (!active) return
        if (!json.success) {
          console.error('Loyalty status payload error:', json?.msg || json?.error || json)
          setLoyalty(null)
          return
        }
        const tierInfo = json?.data?.userStats?.tierInfo
        const level = json?.data?.loyaltyStatus?.level || tierInfo?.name
        const percentage = Number(tierInfo?.discountPercentage) || 0
        const maxDiscountAmount = typeof tierInfo?.maxDiscountAmount === 'number' ? tierInfo.maxDiscountAmount : null
        if (level) {
          setLoyalty({ level, percentage, maxDiscountAmount })
        } else {
          setLoyalty(null)
        }
      })
      .catch((error) => {
        if (!active) return
        console.error('Failed to fetch loyalty status:', error)
      })
      .finally(() => {
        if (active) setLoyaltyLoaded(true)
      })
    return () => {
      active = false
    }
  }, [isAuthenticated, user?.role, user?._id])

  const applyLoyaltyDiscount = useCallback(
    (commissionInclusiveAmount: number) => {
      if (!loyalty || loyalty.percentage <= 0 || commissionInclusiveAmount <= 0) return commissionInclusiveAmount
      let discount = toRoundedTwo(commissionInclusiveAmount * (loyalty.percentage / 100))
      if (loyalty.maxDiscountAmount != null && loyalty.maxDiscountAmount > 0) {
        discount = Math.min(discount, loyalty.maxDiscountAmount)
      }
      return Math.max(0, toRoundedTwo(commissionInclusiveAmount - discount))
    },
    [loyalty]
  )

  const customerPrice = useCallback(
    (amount: number) => applyLoyaltyDiscount(baseCustomerPrice(amount)),
    [applyLoyaltyDiscount, baseCustomerPrice]
  )

  /**
   * Returns the commission-inclusive base price (before any loyalty discount).
   * Use this as the strike-through reference when displaying a discounted customerPrice.
   * NOTE: this is *not* the raw professional amount; it already includes the platform commission.
   */
  const originalPrice = useCallback((amount: number) => baseCustomerPrice(amount), [baseCustomerPrice])

  const customerPriceWithRepeatBuyer = useCallback(
    (
      amount: number,
      repeatBuyer?: { enabled?: boolean; percentage?: number; maxDiscountAmount?: number | null } | null,
      eligible?: boolean
    ) => {
      const afterLoyalty = customerPrice(amount)
      if (!eligible || !repeatBuyer?.enabled || !repeatBuyer.percentage || repeatBuyer.percentage <= 0) return afterLoyalty
      let discount = toRoundedTwo(afterLoyalty * (repeatBuyer.percentage / 100))
      if (repeatBuyer.maxDiscountAmount != null && repeatBuyer.maxDiscountAmount > 0) {
        discount = Math.min(discount, repeatBuyer.maxDiscountAmount)
      }
      return Math.max(0, toRoundedTwo(afterLoyalty - discount))
    },
    [customerPrice]
  )

  return useMemo(
    () => ({
      commissionPercent,
      commissionLoaded,
      commissionError,
      loyalty,
      loyaltyLoaded,
      customerPrice,
      originalPrice,
      customerPriceWithRepeatBuyer,
    }),
    [commissionPercent, commissionLoaded, commissionError, loyalty, loyaltyLoaded, customerPrice, originalPrice, customerPriceWithRepeatBuyer]
  )
}
