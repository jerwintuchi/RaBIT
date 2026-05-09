/** Discrete zoom levels supported by the canvas viewport. */
/** Discrete zoom levels: 100% – 6400% */
export const ZOOM_LEVELS = [1, 2, 4, 8, 16, 32, 64] as const;

export function snapZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    return ZOOM_LEVELS.find((z) => z > current) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!;
  }
  return [...ZOOM_LEVELS].reverse().find((z) => z < current) ?? ZOOM_LEVELS[0];
}
