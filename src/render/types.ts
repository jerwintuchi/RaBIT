import type { BlendMode } from '../core/DataModel';

export const DirtyFlag = {
  LAYER_DATA: 1 << 0,
  LAYER_ORDER: 1 << 1,
  ONION: 1 << 2,
  OVERLAY: 1 << 3,
  FULL: 0xffff,
} as const;

export type DirtyFlags = number;

export interface RenderLayerSpec {
  id: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  isGroup?: boolean;
  parentGroupId?: string | null;
}

export interface ViewTransform {
  panX: number; // screen pixel X of canvas top-left
  panY: number; // screen pixel Y of canvas top-left
  zoom: number; // 1, 2, 4, 8, 16, 32
}
