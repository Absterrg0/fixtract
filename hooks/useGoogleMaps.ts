'use client'

import { useCallback, useEffect, useState } from 'react'

interface GoogleMapsHook {
  isLoaded: boolean
  loadGoogleMaps: () => Promise<boolean>
  validateAddress: (address: string) => Promise<boolean>
  geocodeAddress: (address: string) => Promise<{ lat: number; lng: number } | null>
}

let googleMapsLoadPromise: Promise<boolean> | null = null

const hasPlacesLibrary = () =>
  typeof window !== 'undefined' && Boolean(window.google?.maps?.places)
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 15_000

const loadGoogleMapsScript = async (): Promise<boolean> => {
  if (hasPlacesLibrary()) return true

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/public/google-maps-config`,
  )
  if (!response.ok) {
    throw new Error('Failed to get Google Maps configuration')
  }

  const data = await response.json()
  if (!data.success || !data.scriptUrl) {
    throw new Error('Invalid Google Maps config response')
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src*="maps.googleapis.com"]',
  )
  const script = existingScript ?? document.createElement('script')

  return new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Timed out waiting for the Google Maps Places library'))
    }, GOOGLE_MAPS_LOAD_TIMEOUT_MS)

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      if (hasPlacesLibrary()) {
        resolve(true)
      } else {
        reject(new Error('Google Maps Places library was unavailable after script load'))
      }
    }

    script.addEventListener('load', finish, { once: true })
    script.addEventListener(
      'error',
      () => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        reject(new Error('Failed to load the Google Maps script'))
      },
      { once: true },
    )

    if (!existingScript) {
      script.src = data.scriptUrl
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    // A script can have completed between the initial check and listener setup.
    if (hasPlacesLibrary()) finish()
  })
}

export const useGoogleMaps = (): GoogleMapsHook => {
  const [isLoaded, setIsLoaded] = useState(hasPlacesLibrary)

  useEffect(() => {
    if (hasPlacesLibrary()) setIsLoaded(true)
  }, [])

  const loadGoogleMaps = useCallback(async (): Promise<boolean> => {
    if (hasPlacesLibrary()) {
      setIsLoaded(true)
      return true
    }

    if (!googleMapsLoadPromise) {
      googleMapsLoadPromise = loadGoogleMapsScript().catch((error) => {
        googleMapsLoadPromise = null
        throw error
      })
    }

    try {
      const loaded = await googleMapsLoadPromise
      setIsLoaded(loaded)
      return loaded
    } catch (error) {
      console.error('Failed to load Google Maps:', error)
      setIsLoaded(false)
      return false
    }
  }, [])

  const validateAddress = async (address: string): Promise<boolean> => {
    if (!address) return false

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/public/validate-address`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ address })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[GoogleMaps] Validation request failed:', response.status, data)
        return false
      }

      return data.success && data.isValid
    } catch (error) {
      console.error('Address validation error:', error)
      return false
    }
  }

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address || typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
      return null
    }

    // Check if Google Maps and Geocoder are available
    if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
      console.error('❌ Google Maps Geocoder not available')
      return null
    }

    try {
      const geocoder = new google.maps.Geocoder()

      return new Promise((resolve) => {
        // Set a timeout to avoid hanging promises
        const timeoutId = setTimeout(() => {
          console.error('❌ Geocoding timeout')
          resolve(null)
        }, 10000)

        geocoder.geocode({ address }, (results, status) => {
          clearTimeout(timeoutId)

          if (status === 'OK' && results && results.length > 0 && results[0]) {
            try {
              const location = results[0].geometry.location
              const lat = typeof location.lat === 'function' ? location.lat() : location.lat
              const lng = typeof location.lng === 'function' ? location.lng() : location.lng

              if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                console.log('✅ Geocoded address:', address, '→', { lat, lng })
                resolve({ lat, lng })
              } else {
                console.error('❌ Invalid coordinates from geocoding:', { lat, lng })
                resolve(null)
              }
            } catch (parseError) {
              console.error('❌ Error parsing geocoding result:', parseError)
              resolve(null)
            }
          } else {
            console.warn(`⚠️ Geocoding failed: ${status}`)
            resolve(null)
          }
        })
      })
    } catch (error) {
      console.error('❌ Geocoding error:', error)
      return null
    }
  }

  return { isLoaded, loadGoogleMaps, validateAddress, geocodeAddress }
}
