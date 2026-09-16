import area from '@turf/area';
import { feature } from '@turf/helpers';

import type { PolygonGeometry } from '../../types/polygon';

export const calculateAreaSquareMeters = (geometry: PolygonGeometry): number => area(feature(geometry));

export const toHectares = (squareMeters: number): number => squareMeters / 10_000;
