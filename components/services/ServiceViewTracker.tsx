'use client'

import { useEffect } from 'react'

export default function ServiceViewTracker({ serviceId }: { serviceId: string }) {
  useEffect(() => {
    if (!serviceId) return
    const controller = new AbortController()
    const id = encodeURIComponent(serviceId)
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/public/services/${id}/view`,
      { method: 'POST', credentials: 'include', signal: controller.signal }
    ).catch((err) => {
      if (err?.name === 'AbortError') return
    })
    return () => controller.abort()
  }, [serviceId])

  return null
}
