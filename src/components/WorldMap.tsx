// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-simple-maps has no types for React 19
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'

const GEO_URL = '/countries-110m.json'

// Hex values used directly — SVG fill doesn't always inherit CSS vars via inline style
const C = {
  paper:    '#F5F1EA',
  ink:      '#1A1A1A',
  mapBase:  '#D9D2C5',
  mapHover: '#C4B89E',
} as const

interface WorldMapProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function WorldMap({ selectedId, onSelect }: WorldMapProps) {
  return (
    <div style={{ width: '100%', height: '100vh', background: C.paper, overflow: 'hidden', touchAction: 'none' }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 180 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { id: string; rsmKey: string; [key: string]: unknown }[] }) =>
              geographies.map((geo: { id: string; rsmKey: string; [key: string]: unknown }) => {
                const id = String(geo.id)
                const isSelected = selectedId === id
                const isDimmed = selectedId !== null && !isSelected

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
                        transition: 'fill 180ms ease, opacity 400ms ease, stroke-width 180ms ease',
                      },
                      hover: {
                        fill: isSelected ? C.ink : C.mapHover,
                        stroke: isSelected ? C.ink : C.paper,
                        strokeWidth: isSelected ? 1.5 : 0.5,
                        opacity: isDimmed ? 0.5 : 1,
                        outline: 'none',
                        cursor: 'pointer',
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
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
