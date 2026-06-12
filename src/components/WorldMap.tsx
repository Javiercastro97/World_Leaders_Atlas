// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-simple-maps has no types for React 19
import { ComposableMap, Geographies, Geography, Graticule, Sphere, ZoomableGroup } from 'react-simple-maps'
import { useEffect, useRef, useState } from 'react'
import { geoBounds, geoCentroid } from 'd3-geo'
import type { GeoPermissibleObjects } from 'd3-geo'
import { useIsMobile } from '../hooks/useIsMobile'

const GEO_URL = '/countries-110m.json'
const INITIAL_CENTER: [number, number] = [0, 0]
const INITIAL_ZOOM = 1

// Hex values used directly — SVG fill doesn't always inherit CSS vars via inline style
const C = {
  paper:    '#F5F1EA',
  ink:      '#1A1A1A',
  ink3:     '#6B6660',
  mapBase:  '#D9D2C5',
  mapHover: '#C4B89E',
  rule:     '#E5DFD3',
} as const

type GeoEntry = { id: string; rsmKey: string; [key: string]: unknown }
type Camera   = { center: [number, number]; zoom: number }

// Zoom level based on the largest geographic span (degrees) of the country's bounding box.
function calcZoom(geo: GeoPermissibleObjects): number {
  const [[x0, y0], [x1, y1]] = geoBounds(geo)
  const span = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  if (span > 100) return 1.9    // Russia, Canada, USA, China, Australia, Brazil
  if (span > 60)  return 2.7    // India, Argentina, Algeria
  if (span > 30)  return 3.7    // Spain, France, Ukraine, Japan
  if (span > 15)  return 4.7    // Portugal, Austria, South Korea
  return 5.5                     // Belgium, Israel, Lebanon (clamped to maxZoom 6)
}

// Returns the target camera for a given country, or null if the country is not in the TopoJSON
// (Andorra, Bahrain, etc.) so the panel opens without zooming.
function computeCamera(
  selectedId: string | null,
  geos: GeoEntry[],
  isMobile: boolean,
): Camera | null {
  if (!selectedId) return { center: INITIAL_CENTER, zoom: INITIAL_ZOOM }

  const geo = geos.find(g => String(g.id) === selectedId)
  if (!geo) return null  // Not in TopoJSON — no camera change

  const g = geo as unknown as GeoPermissibleObjects
  const [lon, rawLat] = geoCentroid(g)
  const targetZoom    = calcZoom(g)

  let lat = rawLat
  if (isMobile) {
    // The bottom sheet covers 86vh; visible strip center is at ~7% vs the map's 50% center.
    // Shift center southward so the country lands in that visible strip.
    // Derived formula: offset ≈ 0.43 × svgNaturalHeight(450) / (π × zoom) ≈ 61.5 / zoom,
    // clamped at 25° to avoid over-offsetting very large countries.
    const latOffset = Math.min(25, 61.5 / targetZoom)
    lat = Math.max(-70, Math.min(70, rawLat - latOffset))
  }

  return { center: [lon, lat], zoom: targetZoom }
}

interface WorldMapProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function WorldMap({ selectedId, onSelect }: WorldMapProps) {
  const isMobile = useIsMobile()
  const [camera, setCamera] = useState<Camera>({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM })

  // Cache geography objects for centroid/bounds calculation when a country is selected.
  // Populated once when Geographies renders with data; never changes after that.
  const geographiesRef = useRef<GeoEntry[]>([])

  // Imperative ref for is-panning class — bypasses React state for zero-lag gesture response.
  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Animate camera to selected country, or back to world view when panel closes.
  useEffect(() => {
    const cam = computeCamera(selectedId, geographiesRef.current, isMobile)
    if (cam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCamera(cam)
    }
  }, [selectedId, isMobile])

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '100vh', background: C.paper, overflow: 'hidden', touchAction: 'none' }}
    >
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 180 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={camera.center}
          zoom={camera.zoom}
          minZoom={1}
          maxZoom={6}
          onMoveStart={() => {
            // Disable CSS transition immediately so gestures feel instantaneous.
            mapContainerRef.current?.classList.add('is-panning')
          }}
          onMoveEnd={({ coordinates, zoom: z }: { coordinates: [number, number]; zoom: number }) => {
            // Sync controlled state with where d3-zoom landed after the gesture.
            setCamera({ center: coordinates, zoom: z })
            // Re-enable transition after the prop-change effect in useZoomPan has fired,
            // so the sync update doesn't accidentally animate.
            requestAnimationFrame(() => {
              mapContainerRef.current?.classList.remove('is-panning')
            })
          }}
        >
          <Sphere stroke={C.rule} strokeWidth={0.5} />
          <Graticule stroke={C.rule} strokeWidth={0.4} />
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeoEntry[] }) => {
              // Store on first load — used by computeCamera in the zoom effect above.
              if (geographies.length > 0 && geographiesRef.current.length === 0) {
                geographiesRef.current = geographies
              }

              return geographies.map((geo: GeoEntry) => {
                const id         = String(geo.id)
                const isSelected = selectedId === id
                const isDimmed   = selectedId !== null && !isSelected

                const transition = 'fill 180ms ease-out, stroke 180ms ease-out, stroke-width 180ms ease-out, opacity 400ms ease'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onSelect(id)}
                    tabIndex={0}
                    aria-label={`País ${id}`}
                    style={{
                      default: {
                        fill: isSelected ? C.ink : C.mapBase,
                        stroke: isSelected ? C.ink : C.paper,
                        strokeWidth: isSelected ? 1.5 : 0.5,
                        opacity: isDimmed ? 0.5 : 1,
                        outline: 'none',
                        cursor: 'pointer',
                        transition,
                      },
                      hover: {
                        fill: isSelected ? C.ink : C.mapHover,
                        stroke: isSelected ? C.ink : C.ink3,
                        strokeWidth: isSelected ? 1.5 : 0.6,
                        opacity: isDimmed ? 0.5 : 1,
                        outline: 'none',
                        cursor: 'pointer',
                        transition,
                      },
                      pressed: {
                        fill: C.ink,
                        stroke: C.paper,
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
