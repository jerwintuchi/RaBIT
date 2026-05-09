import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { Cell, FrameId, LayerId } from '../DataModel';

export type ResizeMode = 'crop' | 'scale';

export interface ResizeCanvasCommandDeps {
  getFrameIds(): FrameId[];
  getLayerIds(): LayerId[];
  /** Raw cell for a frame+layer (not linked-resolved — we need the actual stored cell). */
  getRawCell(frameId: FrameId, layerId: LayerId): Cell | undefined;
  setCell(frameId: FrameId, layerId: LayerId, cell: Cell): void;
  removeCell(frameId: FrameId, layerId: LayerId): void;
  setCanvasSize(width: number, height: number): void;
  invalidateAllTextures(): void;
}

/** Pixel data snapshot for a single cell, keyed by `${frameId}/${layerId}`. */
type CellSnapshot = Map<string, { had: Cell | undefined; will: Cell }>;

function cropExpand(
  src: Uint8ClampedArray,
  srcW: number, srcH: number,
  dstW: number, dstH: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const copyW = Math.min(srcW, dstW);
  const copyH = Math.min(srcH, dstH);
  for (let y = 0; y < copyH; y++) {
    const srcOff = y * srcW * 4;
    const dstOff = y * dstW * 4;
    dst.set(src.subarray(srcOff, srcOff + copyW * 4), dstOff);
  }
  return dst;
}

function nearestNeighbour(
  src: Uint8ClampedArray,
  srcW: number, srcH: number,
  dstW: number, dstH: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.floor(dy * srcH / dstH);
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.floor(dx * srcW / dstW);
      const si = (sy * srcW + sx) * 4;
      const di = (dy * dstW + dx) * 4;
      dst[di]     = src[si]!;
      dst[di + 1] = src[si + 1]!;
      dst[di + 2] = src[si + 2]!;
      dst[di + 3] = src[si + 3]!;
    }
  }
  return dst;
}

export class ResizeCanvasCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  private readonly snapshot: CellSnapshot = new Map();

  constructor(
    private readonly oldW: number,
    private readonly oldH: number,
    private readonly newW: number,
    private readonly newH: number,
    private readonly mode: ResizeMode,
    private readonly deps: ResizeCanvasCommandDeps,
  ) {
    this.description = `Resize canvas ${oldW}×${oldH} → ${newW}×${newH}`;
    this._buildSnapshot();
  }

  private _buildSnapshot(): void {
    const { oldW, oldH, newW, newH, mode, deps } = this;
    const transform = mode === 'scale' ? nearestNeighbour : cropExpand;

    for (const frameId of deps.getFrameIds()) {
      for (const layerId of deps.getLayerIds()) {
        const key = `${frameId}/${layerId}`;
        const had = deps.getRawCell(frameId, layerId);

        let will: Cell;
        if (!had || had.linked || had.data === null) {
          // No pixel data — cell stays as-is after resize (transparent / linked unchanged)
          will = had ? { ...had } : { linked: false, data: null };
        } else {
          const newData = transform(had.data, oldW, oldH, newW, newH);
          will = { linked: false, data: newData };
        }

        this.snapshot.set(key, { had, will });
      }
    }
  }

  execute(): void {
    const { deps, newW, newH } = this;
    for (const [key, { will }] of this.snapshot) {
      const [frameId, layerId] = key.split('/') as [FrameId, LayerId];
      if (will.data === null && !will.linked) {
        deps.removeCell(frameId, layerId);
      } else {
        deps.setCell(frameId, layerId, will);
      }
    }
    deps.setCanvasSize(newW, newH);
    deps.invalidateAllTextures();
  }

  undo(): void {
    const { deps, oldW, oldH } = this;
    for (const [key, { had }] of this.snapshot) {
      const [frameId, layerId] = key.split('/') as [FrameId, LayerId];
      if (!had) {
        deps.removeCell(frameId, layerId);
      } else {
        deps.setCell(frameId, layerId, had);
      }
    }
    deps.setCanvasSize(oldW, oldH);
    deps.invalidateAllTextures();
  }
}
