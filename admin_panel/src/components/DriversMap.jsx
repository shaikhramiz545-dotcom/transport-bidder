import { useEffect, useRef, useState } from 'react'

const DEFAULT_CENTER = { lat: -12.0464, lng: -77.0428 } // Lima, Peru
const DEFAULT_ZOOM = 12

/**
 * Load Google Maps script once. Returns a Promise that resolves when window.google.maps is ready.
 */
function loadGoogleMapsScript(apiKey) {
  if (window.google?.maps) return Promise.resolve()
  const existing = document.querySelector('script[src*="maps.googleapis.com"]')
  if (existing) {
    return new Promise((resolve) => {
      if (window.google?.maps) return resolve()
      existing.addEventListener('load', resolve)
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

export default function DriversMap({ drivers = [], vehicleFilter = 'all' }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [mapError, setMapError] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  const filtered = drivers.filter((d) => {
    if (vehicleFilter === 'all') return true
    return (d.vehicleType || 'car').toLowerCase() === vehicleFilter
  })
  const withCoords = filtered.filter((d) => d.lat != null && d.lng != null)

  useEffect(() => {
    if (!apiKey) {
      setMapError('Google Maps API key missing. Set VITE_GOOGLE_MAPS_API_KEY in .env')
      return
    }
    setMapError('')
    loadGoogleMapsScript(apiKey)
      .then(() => setMapReady(true))
      .catch((e) => setMapError(e.message || 'Failed to load map'))
  }, [apiKey])

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !mapRef.current) return

    const google = window.google
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      })
    }
    const map = mapInstanceRef.current

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (withCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      withCoords.forEach((d) => {
        const pos = { lat: Number(d.lat), lng: Number(d.lng) }
        bounds.extend(pos)
        const marker = new google.maps.Marker({
          position: pos,
          map,
          title: `${d.driverId || 'Driver'} • ${d.vehicleType || 'car'}`,
          label: {
            text: d.vehicleType === 'bike' ? '🛵' : d.vehicleType === 'taxi' ? '🚕' : d.vehicleType === 'van' ? '🚐' : d.vehicleType === 'truck' ? '🚚' : d.vehicleType === 'ambulance' ? '🚑' : '🚗',
            fontSize: '18px',
          },
        })
        markersRef.current.push(marker)
      })
      map.fitBounds(bounds)
      const z = map.getZoom()
      if (z > 14) map.setZoom(14)
    } else {
      map.setCenter(DEFAULT_CENTER)
      map.setZoom(DEFAULT_ZOOM)
    }
  }, [mapReady, withCoords])

  if (mapError) {
    return (
      <div className="drivers-map drivers-map-error">
        <span>{mapError}</span>
      </div>
    )
  }

  if (!mapReady) {
    return (
      <div className="drivers-map drivers-map-loading">
        <span>Loading map...</span>
      </div>
    )
  }

  return <div ref={mapRef} className="drivers-map" aria-label="Live drivers map" />
}
