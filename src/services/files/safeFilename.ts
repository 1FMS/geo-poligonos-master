const INVALID_CHARS = /[\\/:*?"<>|]/g;

/**
 * Sanitizes a string into a safe filename fragment (no extension).
 * Falls back to "poligono" when the input is empty or contains only invalid characters.
 */
export function safeFilename(name: string): string {
  const sanitized = name
    .trim()
    .replace(INVALID_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');

  return sanitized === '' ? 'poligono' : sanitized;
}
