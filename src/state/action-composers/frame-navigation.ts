import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';

// Cross-store: navigate to a frame, triggering any per-frame side effects.
// The rendering engine will need to be notified separately (done in M3).
export function goToFrame(index: number): void {
  useFrameStore.getState().setActiveFrameIndex(index);
  // Layer thumbnails will be invalidated here once the render engine exists (M3)
  // Onion skinning buffer will be marked dirty here once the render engine exists (M3)
  void useLayerStore.getState(); // referenced to ensure no tree-shaking removes the import
}

export function goToNextFrame(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  goToFrame((activeFrameIndex + 1) % frames.length);
}

export function goToPrevFrame(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  goToFrame((activeFrameIndex - 1 + frames.length) % frames.length);
}

export function goToFirstFrame(): void {
  goToFrame(0);
}

export function goToLastFrame(): void {
  const { frames } = useFrameStore.getState();
  goToFrame(frames.length - 1);
}
