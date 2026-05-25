import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';

export interface TransformPayload {
  layerId: string;
  frameIndex: number;
  beforeData: Uint8ClampedArray;
  afterData: Uint8ClampedArray;
  beforeCanvas?: { width: number; height: number };
  afterCanvas?: { width: number; height: number };
}

export interface TransformCommandDeps {
  notifyLayerChanged(layerId: string, data: Uint8ClampedArray): void;
  resizeCanvas(width: number, height: number): void;
  setCell(layerId: string, frameIndex: number, data: Uint8ClampedArray): void;
}

export class TransformCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Transform layer';

  constructor(
    private readonly payload: TransformPayload,
    private readonly deps: TransformCommandDeps,
  ) {}

  execute(): void {
    const { layerId, frameIndex, afterData, afterCanvas, beforeCanvas } = this.payload;
    if (afterCanvas && beforeCanvas &&
        (afterCanvas.width !== beforeCanvas.width || afterCanvas.height !== beforeCanvas.height)) {
      this.deps.resizeCanvas(afterCanvas.width, afterCanvas.height);
    }
    this.deps.setCell(layerId, frameIndex, afterData);
    this.deps.notifyLayerChanged(layerId, afterData);
  }

  undo(): void {
    const { layerId, frameIndex, beforeData, beforeCanvas, afterCanvas } = this.payload;
    if (afterCanvas && beforeCanvas &&
        (afterCanvas.width !== beforeCanvas.width || afterCanvas.height !== beforeCanvas.height)) {
      this.deps.resizeCanvas(beforeCanvas.width, beforeCanvas.height);
    }
    this.deps.setCell(layerId, frameIndex, beforeData);
    this.deps.notifyLayerChanged(layerId, beforeData);
  }
}
