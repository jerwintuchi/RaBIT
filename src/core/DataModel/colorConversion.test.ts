import { describe, it, expect } from 'vitest';
import { nearestSwatchColor } from './colorConversion';
import { packRGBA } from './pixels';
import type { Swatch } from './types';

function swatch(r: number, g: number, b: number, a = 255): Swatch {
  return { name: null, color: packRGBA(r, g, b, a) };
}

const RED   = packRGBA(255, 0,   0,   255);
const GREEN = packRGBA(0,   255, 0,   255);
const BLUE  = packRGBA(0,   0,   255, 255);
const BLACK = packRGBA(0,   0,   0,   255);

describe('nearestSwatchColor', () => {
  it('returns original color when palette is empty', () => {
    expect(nearestSwatchColor(RED, [])).toBe(RED);
  });

  it('returns exact match when color is in palette', () => {
    const palette = [swatch(255, 0, 0), swatch(0, 255, 0)];
    expect(nearestSwatchColor(RED, palette)).toBe(RED);
  });

  it('returns nearest swatch for an off-palette color', () => {
    const palette = [swatch(255, 0, 0), swatch(0, 0, 255)];
    // (240, 0, 0) is closer to red than blue
    const nearRed = packRGBA(240, 0, 0, 255);
    expect(nearestSwatchColor(nearRed, palette)).toBe(RED);
  });

  it('chooses closer of two equidistant options by first-encountered', () => {
    // Equal distance from both — first swatch wins
    const palette = [swatch(255, 0, 0), swatch(0, 255, 0)];
    const mid = packRGBA(128, 128, 0, 255); // equidistant from red and green
    const result = nearestSwatchColor(mid, palette);
    expect(result === RED || result === GREEN).toBe(true);
  });

  it('single swatch palette always returns that swatch', () => {
    expect(nearestSwatchColor(BLUE, [swatch(255, 0, 0)])).toBe(RED);
    expect(nearestSwatchColor(GREEN, [swatch(0, 0, 0)])).toBe(BLACK);
  });

  it('alpha channel is included in distance calculation', () => {
    const opaqueRed = packRGBA(255, 0, 0, 255);
    const semiRed   = packRGBA(255, 0, 0, 128);
    const palette = [
      swatch(255, 0, 0, 255), // fully opaque red
      swatch(255, 0, 0, 128), // semi-transparent red
    ];
    // opaqueRed closer to first swatch
    expect(nearestSwatchColor(opaqueRed, palette)).toBe(packRGBA(255, 0, 0, 255));
    // semiRed closer to second swatch
    expect(nearestSwatchColor(semiRed, palette)).toBe(packRGBA(255, 0, 0, 128));
  });

  it('works with a larger palette — picks correct nearest', () => {
    const palette = [
      swatch(0, 0, 0),
      swatch(255, 0, 0),
      swatch(0, 255, 0),
      swatch(0, 0, 255),
      swatch(255, 255, 255),
    ];
    // (10, 10, 200) should be closest to blue
    const nearBlue = packRGBA(10, 10, 200, 255);
    expect(nearestSwatchColor(nearBlue, palette)).toBe(BLUE);

    // (200, 10, 10) should be closest to red
    const nearRed = packRGBA(200, 10, 10, 255);
    expect(nearestSwatchColor(nearRed, palette)).toBe(RED);
  });
});
