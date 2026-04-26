import { initNewProject } from '../../state/action-composers';
import { useFrameStore } from '../../state/useFrameStore';
import { useLayerStore } from '../../state/useLayerStore';

/**
 * Seeds a 4096×4096 four-layer project for the M3 performance test.
 * Each layer is a solid flat color so GPU upload is fast and compositing
 * is the bottleneck being measured (not JS fill time).
 */
export function seedPerfFixture(): void {
  const W = 4096;
  const H = 4096;
  initNewProject('M3 Perf 4K', W, H);

  const frame = useFrameStore.getState().frames[0];
  if (!frame) return;

  const colors: [number, number, number][] = [
    [180, 40, 40],   // red
    [40, 180, 40],   // green
    [40, 40, 180],   // blue
    [180, 180, 40],  // yellow
  ];

  const baseLayer = useLayerStore.getState().layers[0];
  const layerIds: string[] = baseLayer ? [baseLayer.id] : [];
  for (let i = 1; i < 4; i++) {
    const l = useLayerStore.getState().addLayer({ name: `Layer ${i + 1}`, opacity: 0.5 });
    layerIds.push(l.id);
  }

  for (let li = 0; li < layerIds.length; li++) {
    const id = layerIds[li];
    if (!id) continue;
    const [r, g, b] = colors[li] ?? [128, 128, 128];
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
    useFrameStore.getState().setCell(frame.id, id, { linked: false, data });
  }
}

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
