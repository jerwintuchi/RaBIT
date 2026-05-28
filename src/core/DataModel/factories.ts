import { nanoid } from 'nanoid';
import type {
  Project,
  Layer,
  Frame,
  Cell,
  Palette,
  Swatch,
  Tag,
  CanvasConfig,
  LayerId,
  RGBA,
  BlendMode,
  LoopDirection,
  LayerType,
} from './types';

export function makeCanvasConfig(
  width = 32,
  height = 32,
  overrides: Partial<CanvasConfig> = {},
): CanvasConfig {
  return {
    width,
    height,
    colorMode: 'rgba',
    backgroundColor: 0x00000000,
    dpi: 72,
    ...overrides,
  };
}

export function makeLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: nanoid(12),
    name: 'Layer',
    type: 'layer' satisfies LayerType,
    parentGroupId: null,
    visible: true,
    locked: false,
    opacity: 1.0,
    blendMode: 'normal' satisfies BlendMode,
    ...overrides,
  };
}

export function makeLayerGroup(overrides: Partial<Layer> = {}): Layer {
  return {
    id: nanoid(12),
    name: 'Group',
    type: 'group' satisfies LayerType,
    parentGroupId: null,
    visible: true,
    locked: false,
    opacity: 1.0,
    blendMode: 'normal' satisfies BlendMode,
    collapsed: false,
    ...overrides,
  };
}

export function makeCell(width: number, height: number): Cell {
  return {
    linked: false,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

export function makeLinkedCell(): Cell {
  return { linked: true, data: null };
}

export function makeFrame(
  layerIds: LayerId[],
  canvasWidth: number,
  canvasHeight: number,
  overrides: Partial<Frame> = {},
): Frame {
  const cells: Record<LayerId, Cell> = {};
  for (const id of layerIds) {
    cells[id] = makeCell(canvasWidth, canvasHeight);
  }
  return {
    id: nanoid(12),
    duration: 100,
    cells,
    hiddenLayerIds: [],
    ...overrides,
  };
}

export function makeSwatch(color: RGBA, name: string | null = null): Swatch {
  return { color, name };
}

export function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: nanoid(12),
    name: 'Untitled Palette',
    swatches: [],
    ...overrides,
  };
}

export function makeTag(
  from: number,
  to: number,
  overrides: Partial<Tag> = {},
): Tag {
  return {
    id: nanoid(12),
    name: 'Tag',
    from,
    to,
    loopDirection: 'forward' satisfies LoopDirection,
    color: 0xff8800ff,
    ...overrides,
  };
}

export function makeProject(
  name = 'Untitled',
  width = 32,
  height = 32,
): Project {
  const canvas = makeCanvasConfig(width, height);
  const layer = makeLayer({ name: 'Layer 1' });
  const frame = makeFrame([layer.id], canvas.width, canvas.height);
  const now = Date.now();

  return {
    schemaVersion: 1,
    projectId: nanoid(12),
    name,
    author: null,
    createdAt: now,
    modifiedAt: now,
    application: 'RaBIT 0.1.0',
    canvas,
    layers: [layer],
    frames: [frame],
    palette: makePalette(),
    tags: [],
    activeLayerId: layer.id,
    activeFrameIndex: 0,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  };
}
