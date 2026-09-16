import L from 'leaflet';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw';
import { TerraDrawLeafletAdapter } from 'terra-draw-leaflet-adapter';
import { geometryFromTerraFeature, INVALID_POLYGON_MESSAGE } from './terraDrawGeometry';

export interface TerraDrawHandlers {
  onInvalidGeometry: (message: string) => void;
}

function isValidPolygonFeature(feature: GeoJSONStoreFeatures): boolean {
  try {
    geometryFromTerraFeature(feature);
    return true;
  } catch {
    return false;
  }
}

const identityColor = ({ properties }: GeoJSONStoreFeatures): HexColor =>
  typeof properties.identityColor === 'string' && /^#[0-9a-f]{6}$/i.test(properties.identityColor)
    ? properties.identityColor as HexColor
    : '#f59e0b';

export function createTerraDraw(map: L.Map, handlers: TerraDrawHandlers): TerraDraw {
  return new TerraDraw({
    adapter: new TerraDrawLeafletAdapter({ lib: L, map, ignoreMismatchedPointerEvents: true }),
    // Editing part IDs are deterministic strings rather than Terra Draw's default UUIDs.
    idStrategy: {
      isValidId: id => typeof id === 'string',
      getId: () => crypto.randomUUID(),
    },
    modes: [
      new TerraDrawPolygonMode({
        styles: {
          fillColor: identityColor,
          outlineColor: identityColor,
          fillOpacity: ({ properties }) => properties.source === 'editing' ? 0.18 : 0.34,
          outlineWidth: ({ properties }) => properties.source === 'editing' ? 2 : 5,
        },
        validation: (feature, context) => {
          // The first two committed vertices cannot yet form a valid polygon.
          if (feature.properties.currentlyDrawing && context.updateType !== 'finish') return { valid: true };
          const valid = isValidPolygonFeature(feature);
          if (!valid) handlers.onInvalidGeometry(INVALID_POLYGON_MESSAGE);
          return valid ? { valid: true } : { valid: false, reason: INVALID_POLYGON_MESSAGE };
        },
      }),
      new TerraDrawSelectMode({
        allowManualSelection: true,
        allowManualDeselection: true,
        flags: {
          polygon: {
            feature: {
              draggable: false,
              coordinates: { midpoints: true, draggable: true, deletable: true },
              validation: feature => {
                const valid = isValidPolygonFeature(feature);
                if (!valid) handlers.onInvalidGeometry(INVALID_POLYGON_MESSAGE);
                return valid ? { valid: true } : { valid: false, reason: INVALID_POLYGON_MESSAGE };
              },
            },
          },
        },
        styles: {
          selectedPolygonColor: '#f59e0b',
          selectedPolygonOutlineColor: '#f59e0b',
          selectedPolygonFillOpacity: 0.34,
          selectedPolygonOutlineWidth: 5,
        },
      }),
    ],
  });
}
