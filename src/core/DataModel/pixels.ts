import type { RGBA } from './types';

/** Packs four 8-bit channels into a 32-bit unsigned RGBA. */
export function packRGBA(r: number, g: number, b: number, a: number): RGBA {
  return (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;
}

/** Unpacks a 32-bit RGBA into [r, g, b, a]. */
export function unpackRGBA(rgba: RGBA): [number, number, number, number] {
  return [(rgba >>> 24) & 0xff, (rgba >>> 16) & 0xff, (rgba >>> 8) & 0xff, rgba & 0xff];
}

/** Reads the packed RGBA at (x, y) from a row-major pixel buffer. */
export function readPixel(
  buf: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
): RGBA {
  const i = (y * width + x) * 4;
  return (
    (((buf[i] ?? 0) << 24) |
      ((buf[i + 1] ?? 0) << 16) |
      ((buf[i + 2] ?? 0) << 8) |
      (buf[i + 3] ?? 0)) >>>
    0
  );
}

/** Writes a packed RGBA at (x, y) into a row-major pixel buffer. */
export function writePixel(
  buf: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  rgba: RGBA,
): void {
  const i = (y * width + x) * 4;
  buf[i] = (rgba >>> 24) & 0xff;
  buf[i + 1] = (rgba >>> 16) & 0xff;
  buf[i + 2] = (rgba >>> 8) & 0xff;
  buf[i + 3] = rgba & 0xff;
}
