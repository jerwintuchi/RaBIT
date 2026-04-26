import { packRGBA } from './pixels';
import { parseHex } from './colorConversion';
import type { RGBA } from './types';

export interface ImportedSwatch {
  color: RGBA;
  name: string | null;
}

// ── GPL (GIMP Palette) ─────────────────────────────────────────────────────
// Format: header "GIMP Palette", optional "Name:" / "Columns:" lines,
//         then: R G B  [optional name]  (whitespace-separated, # = comment)

export function parseGPL(text: string): ImportedSwatch[] {
  const result: ImportedSwatch[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('GIMP') || line.startsWith('Name:') ||
        line.startsWith('Columns:') || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const r = parseInt(parts[0] ?? '', 10);
    const g = parseInt(parts[1] ?? '', 10);
    const b = parseInt(parts[2] ?? '', 10);
    if (isNaN(r) || isNaN(g) || isNaN(b)) continue;
    const name = parts.slice(3).join(' ').trim() || null;
    result.push({ color: packRGBA(r, g, b, 255), name });
  }
  return result;
}

// ── Hex list ───────────────────────────────────────────────────────────────
// One hex color per line: #RRGGBB, #RRGGBBAA, RRGGBB, etc.
// Optional trailing comment after whitespace is used as the name.

export function parseHexList(text: string): ImportedSwatch[] {
  const result: ImportedSwatch[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('//')) continue;
    const [hexPart, ...rest] = line.split(/\s+/);
    if (!hexPart) continue;
    const color = parseHex(hexPart);
    if (color === null) continue;
    const name = rest.join(' ').trim() || null;
    result.push({ color, name });
  }
  return result;
}

// ── CSV ────────────────────────────────────────────────────────────────────
// Flexible CSV: each row is one of:
//   R,G,B[,Name]
//   R,G,B,A[,Name]
//   #Hex[,Name]
// Header rows (containing non-numeric/non-hex first column) are skipped.

export function parseCSV(text: string): ImportedSwatch[] {
  const result: ImportedSwatch[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());
    const first = cols[0] ?? '';

    // Hex column
    if (first.startsWith('#') || /^[0-9a-fA-F]{6,8}$/.test(first)) {
      const color = parseHex(first);
      if (color === null) continue;
      const name = cols.slice(1).join(',').trim() || null;
      result.push({ color, name });
      continue;
    }

    // R,G,B[,A][,Name]
    const r = parseInt(first, 10);
    const g = parseInt(cols[1] ?? '', 10);
    const b = parseInt(cols[2] ?? '', 10);
    if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

    const maybeA = parseInt(cols[3] ?? '', 10);
    let a = 255;
    let nameStart = 3;
    if (!isNaN(maybeA) && maybeA >= 0 && maybeA <= 255) {
      a = maybeA;
      nameStart = 4;
    }
    const name = cols.slice(nameStart).join(',').trim() || null;
    result.push({ color: packRGBA(r, g, b, a), name });
  }
  return result;
}

// ── Dispatcher ─────────────────────────────────────────────────────────────
// Picks parser based on file extension / content sniff.

export function parsePaletteFile(filename: string, text: string): ImportedSwatch[] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'gpl') return parseGPL(text);
  if (ext === 'csv') return parseCSV(text);
  // .txt / .hex / unknown → hex list first, fall back to GPL
  const hexResult = parseHexList(text);
  if (hexResult.length > 0) return hexResult;
  return parseGPL(text);
}
