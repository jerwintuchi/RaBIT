// Primitive ID aliases — all nanoid 12-char strings
export type LayerId = string;
export type FrameId = string;
export type CommandId = string;
export type TagId = string;
export type PaletteId = string;

// 32-bit packed RGBA: (R << 24) | (G << 16) | (B << 8) | A
// Big-endian in-memory for GPU upload consistency
export type RGBA = number;

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';

export type LoopDirection = 'forward' | 'reverse' | 'ping-pong';

export type ColorMode = 'rgba';

export interface CanvasConfig {
  width: number; // 1–4096, integer
  height: number; // 1–4096, integer
  colorMode: ColorMode;
  backgroundColor: RGBA; // transparent by default (0x00000000)
  dpi: number; // metadata only, defaults to 72
}

export interface Layer {
  id: LayerId;
  name: string; // 1–64 chars UTF-8
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0–1.0
  blendMode: BlendMode;
}

export interface Cell {
  // When linked = true, data is null. Rendering resolves backward to prior non-linked cell.
  linked: boolean;
  data: Uint8ClampedArray | null;
}

export interface Frame {
  id: FrameId;
  duration: number; // ms, 10–10000, default 100
  cells: Record<LayerId, Cell>; // sparse — only populated cells present
}

export interface Swatch {
  color: RGBA;
  name: string | null;
}

export interface Palette {
  id: PaletteId;
  name: string;
  swatches: Swatch[];
}

export interface Tag {
  id: TagId;
  name: string; // "walk", "idle", etc.
  from: number; // frame index, inclusive
  to: number; // frame index, inclusive
  loopDirection: LoopDirection;
  color: RGBA; // display color in timeline
}

export interface Project {
  // Identity
  schemaVersion: 1;
  projectId: string; // nanoid, stable across saves

  // Metadata
  name: string;
  author: string | null;
  createdAt: number; // unix ms
  modifiedAt: number; // unix ms
  application: string; // "RaBIT 0.1.0"

  // Canvas configuration
  canvas: CanvasConfig;

  // Content
  layers: Layer[]; // ordered bottom-to-top (index 0 = background)
  frames: Frame[]; // ordered, index = frame number
  palette: Palette;
  tags: Tag[];

  // View state (persisted so opening feels continuous)
  activeLayerId: LayerId | null;
  activeFrameIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };

  // Reference image (optional, not part of artwork)
  referencePath?: string | null;
}
