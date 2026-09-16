/// <reference types="vite/client" />

declare module 'tokml' {
  import type { FeatureCollection } from 'geojson';

  export default function tokml(geojson: FeatureCollection, options?: Record<string, unknown>): string;
}
