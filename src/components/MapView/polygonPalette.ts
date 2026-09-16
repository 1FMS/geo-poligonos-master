// Distinct hues (no amber/red — those are reserved for "selected" and
// "overlapping" so their meaning never collides with plain identity color).
const PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#0d9488', // teal
  '#db2777', // pink
  '#4338ca', // indigo
  '#0891b2', // cyan
  '#9333ea', // purple
  '#be185d', // rose
  '#1d4ed8', // deep blue
  '#65a30d', // olive
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export function colorForPolygonId(id: string): string {
  return PALETTE[hashString(id) % PALETTE.length];
}
