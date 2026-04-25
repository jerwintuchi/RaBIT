// Re-export of DataModel types so UI can reach them without importing from
// `src/core` directly (no-restricted-paths). State is allowed to depend on
// Core, so this module bridges the type surface for the UI layer.
export type {
  LayerId,
  FrameId,
  TagId,
  PaletteId,
  RGBA,
  BlendMode,
  LoopDirection,
  ColorMode,
  CanvasConfig,
  Layer,
  Cell,
  Frame,
  Swatch,
  Palette,
  Tag,
  Project,
} from '../core/DataModel';
