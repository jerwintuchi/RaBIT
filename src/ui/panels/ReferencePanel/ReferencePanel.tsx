import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ipcLoadReferenceImage } from '../../../bridge/referenceIpc';
import { useReferenceStore } from '../../../state/useReferenceStore';
import { useProjectStore } from '../../../state/useProjectStore';
import { toast } from '../../../state/useUIStore';

async function changeReferenceImage(): Promise<void> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (typeof selected !== 'string') return;
  try {
    const result = await ipcLoadReferenceImage(selected);
    const pixels = new Uint8ClampedArray(result.pixels);
    useReferenceStore.getState().setImage(selected, pixels, result.width, result.height);
    useProjectStore.getState().setReferencePath(selected);
    toast.info('Reference image loaded');
  } catch (e) {
    toast.error(`Failed to load reference image: ${String(e)}`);
  }
}

export function ReferencePanel(): JSX.Element | null {
  const imageData = useReferenceStore((s) => s.imageData);
  const opacity = useReferenceStore((s) => s.opacity);
  const visible = useReferenceStore((s) => s.visible);

  if (!imageData) return null;

  function handleOpacity(e: React.ChangeEvent<HTMLInputElement>) {
    useReferenceStore.getState().setOpacity(Number(e.target.value) / 100);
  }

  function handleVisible(e: React.ChangeEvent<HTMLInputElement>) {
    useReferenceStore.getState().setVisible(e.target.checked);
  }

  function handleRemove() {
    useReferenceStore.getState().clear();
    useProjectStore.getState().setReferencePath(null);
  }

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>
        Reference Image
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
        <input type="checkbox" checked={visible} onChange={handleVisible} />
        Visible
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        Opacity: {Math.round(opacity * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={handleOpacity}
          style={{ width: '100%' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          style={{ flex: 1, fontSize: '11px', padding: '4px 6px' }}
          onClick={() => void changeReferenceImage()}
        >
          Change…
        </button>
        <button
          style={{ flex: 1, fontSize: '11px', padding: '4px 6px' }}
          onClick={handleRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
