import { initNewProject } from '../../state/action-composers';
import { useFrameStore } from '../../state/useFrameStore';
import { useLayerStore } from '../../state/useLayerStore';

/**
 * Seeds the stores with a 32×32 two-layer test project for M3 visual verification.
 * Layer 0 (bottom): 8×8 checker pattern in red/blue.
 * Layer 1 (top):    solid orange, 60% opacity, Normal blend.
 */
export function seedTestFixture(): void {
  const W = 32;
  const H = 32;

  initNewProject('M3 Test', W, H);

  const layer0 = useLayerStore.getState().layers[0];
  if (!layer0) return;

  const layer1 = useLayerStore.getState().addLayer({ name: 'Overlay', opacity: 0.6 });

  const frame = useFrameStore.getState().frames[0];
  if (!frame) return;

  // Layer 0: 8×8 checker in red / blue
  const d0 = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      d0[i] = checker ? 220 : 40;
      d0[i + 1] = 40;
      d0[i + 2] = checker ? 40 : 220;
      d0[i + 3] = 255;
    }
  }
  useFrameStore.getState().setCell(frame.id, layer0.id, { linked: false, data: d0 });

  // Layer 1: solid orange (addLayer doesn't create frame cells, so set it manually)
  const d1 = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d1.length; i += 4) {
    d1[i] = 255;
    d1[i + 1] = 140;
    d1[i + 2] = 0;
    d1[i + 3] = 255;
  }
  useFrameStore.getState().setCell(frame.id, layer1.id, { linked: false, data: d1 });
}
