export type AddressComponentLike = {
  types?: string[]
  short_name?: string
  long_name?: string
}

export type ServicePlaceLike = {
  formatted_address?: string
  coordinates?: { lat: number; lng: number }
  address_components?: AddressComponentLike[]
}

const componentByType = (
  components: AddressComponentLike[] | undefined,
  type: string
): AddressComponentLike | undefined =>
  components?.find((component) => component.types?.includes(type))

export const countryFromPlace = (place?: ServicePlaceLike | null): string => {
  const country = componentByType(place?.address_components, 'country')
  return (country?.short_name || country?.long_name || '').trim()
}

export const locationFieldsFromPlace = (place?: ServicePlaceLike | null) => {
  const components = place?.address_components
  const city =
    componentByType(components, 'locality')?.long_name ||
    componentByType(components, 'postal_town')?.long_name ||
    componentByType(components, 'administrative_area_level_2')?.long_name ||
    ''
  const postalCode = componentByType(components, 'postal_code')?.long_name || ''
  const country = countryFromPlace(place)
  const lat = place?.coordinates?.lat
  const lng = place?.coordinates?.lng
  const hasCoordinates =
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng)

  return {
    address: place?.formatted_address || '',
    city,
    postalCode,
    country,
    coordinates: hasCoordinates ? ([lng, lat] as [number, number]) : undefined,
  }
}
