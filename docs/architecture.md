# RaBIT — System Architecture Design
**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Approved for UI/UX Phase

---

## 1. Architecture Philosophy

Three guiding principles shaped every decision here:

1. **Render on GPU, compute on Rust, orchestrate on TypeScript.** Never block the UI thread. Never do file I/O in JavaScript.
2. **Every mutation is a Command.** There is no "apply and hope." Every change to canvas state flows through the command system. This is the only path to reliable undo/redo and a single source of truth.
3. **Layers have a strict dependency hierarchy.** No circular imports. The Rust backend knows nothing about React. The editor core knows nothing about Zustand. The UI layer is the only thing that imports UI framework code.

---

## 2. High-Level System Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                         TAURI DESKTOP SHELL                          ║
║                                                                      ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │                        UI LAYER  (React/TSX)                   │  ║
║  │  CanvasViewport  LayerPanel  Timeline  ToolBar  PalettePanel   │  ║
║  │  MenuBar  ColorPicker  ExportDialog  KeybindingSystem          │  ║
║  └──────────────────────────┬─────────────────────────────────────┘  ║
║                             │ reads/writes                           ║
║  ┌──────────────────────────▼─────────────────────────────────────┐  ║
║  │                  APPLICATION STATE  (Zustand)                  │  ║
║  │  CanvasStore  LayerStore  FrameStore  ToolStore  PaletteStore  │  ║
║  │  HistoryStore  ProjectStore  UIStore                           │  ║
║  └──────────────────────────┬─────────────────────────────────────┘  ║
║                             │ dispatches                             ║
║  ┌──────────────────────────▼─────────────────────────────────────┐  ║
║  │                      EDITOR CORE  (TypeScript)                 │  ║
║  │                                                                │  ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  ║
║  │  │ CommandSystem │  │  ToolEngine  │  │  SelectionEngine  │   │  ║
║  │  │  (undo/redo)  │  │ (per-tool    │  │  (marquee, wand,  │   │  ║
║  │  │               │  │  state mach) │  │   lasso)          │   │  ║
║  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  ║
║  │                                                                │  ║
║  │  ┌──────────────────────────────────────────────────────────┐  │  ║
║  │  │                   RENDERING ENGINE  (WebGL2)             │  │  ║
║  │  │  LayerCompositor  OnionSkinRenderer  OverlayRenderer     │  │  ║
║  │  │  ScratchRenderer  TextureCache  ShaderLibrary            │  │  ║
║  │  └──────────────────────────────────────────────────────────┘  │  ║
║  └──────────────────────────┬─────────────────────────────────────┘  ║
║                             │ Tauri IPC (invoke / emit)             ║
║  ┌──────────────────────────▼─────────────────────────────────────┐  ║
║  │                    RUST BACKEND  (Tauri)                       │  ║
║  │  ProjectSerializer  ExportPipeline  FloodFill  ImageProcessor  │  ║
║  │  AutoSaveManager  CrashRecovery  FileSystemSandbox            │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 3. Layer Definitions

### Layer 1: Rust Backend
**Responsibility:** Everything that touches the filesystem, CPU-intensive image ops, and safe deserialization.  
**Technology:** Rust + Tauri framework  
**Does NOT know about:** React, Zustand, WebGL, UI state  
**Communicates via:** Tauri `#[tauri::command]` IPC invocations and `emit` events  

Key modules:
- `project_io` — serialize/deserialize `.rabit` binary format
- `export_pipeline` — PNG sequence, spritesheet packing, GIF encoding
- `flood_fill` — optimized scanline flood fill for large canvases
- `auto_save` — periodic auto-save to temp path, atomic rename on success
- `crash_recovery` — detect stale auto-save on startup, offer recovery
- `fs_sandbox` — validate and canonicalize all output paths before write

### Layer 2: Editor Core (TypeScript, no framework)
**Responsibility:** Business logic — tools, commands, selection, data model manipulation.  
**Technology:** TypeScript — pure, no React imports, no Zustand imports  
**Does NOT know about:** React components, Zustand stores, WebGL specifics (except through defined interfaces)  
**Communicates via:** Exported functions and classes consumed by the state layer  

Key modules:
- `CommandSystem` — execute, undo, redo, history management
- `ToolEngine` — tool state machines, pointer event processing
- `SelectionEngine` — selection data, boolean operations, transform
- `RenderingEngine` — WebGL2 canvas management, texture cache, shader programs
- `DataModel` — Project, Layer, Frame, Cell, Palette pure data types

### Layer 3: Application State (Zustand)
**Responsibility:** Reactive state that drives the UI. All stores are composable slices.  
**Technology:** Zustand + Immer (for immutable updates in complex nested state)  
**Does NOT know about:** React component internals (stores are framework-agnostic)  
**Communicates via:** Hooks (`useLayerStore`, `useToolStore`, etc.) consumed by UI layer  

### Layer 4: UI Layer (React + TSX)
**Responsibility:** Rendering panels, handling pointer/keyboard events, triggering actions.  
**Technology:** React 18 (with concurrent features), TypeScript  
**Rule:** UI components are "dumb" — they read from stores and dispatch actions. No business logic lives in components.

---

## 4. Module Dependency Graph

```
UI Layer (React)
    └── imports → State Layer (Zustand)
                    └── imports → Editor Core (TypeScript)
                                    ├── imports → DataModel
                                    ├── imports → CommandSystem
                                    ├── imports → RenderingEngine (WebGL2)
                                    └── calls → Tauri IPC (typed wrappers)
                                                    └── invokes → Rust Backend
```

**Enforced rule:** No upward imports. Rust knows nothing of TypeScript. Editor Core knows nothing of React. Violations detected by ESLint `import/no-restricted-paths` rules and Rust module isolation.

---

## 5. Command System (Undo/Redo)

The Command pattern is the backbone of the entire mutation model.

### Interface
```typescript
interface Command {
  readonly id: string            // unique per-instance (nanoid)
  readonly description: string   // shown in History panel
  execute(): void                // apply the change
  undo(): void                   // reverse the change
  merge?(other: Command): Command | null  // optional: merge consecutive same-type commands
}
```

### CommandManager
```
CommandManager {
  undoStack: Command[]   // executed commands, newest at tail
  redoStack: Command[]   // undone commands, most recent at tail
  
  execute(cmd):
    cmd.execute()
    undoStack.push(cmd)
    redoStack.clear()       // new action breaks redo chain
    trim to maxHistory limit
  
  undo():
    cmd = undoStack.pop()
    cmd.undo()
    redoStack.push(cmd)
  
  redo():
    cmd = redoStack.pop()
    cmd.execute()
    undoStack.push(cmd)
}
```

### Pixel Delta Commands (memory-efficient)
Drawing operations do NOT snapshot the full canvas. They store only the changed pixels:

```typescript
class DrawCommand implements Command {
  private deltas: Array<{ x: number; y: number; before: number; after: number }>
  // 'before' and 'after' are 32-bit packed RGBA values
  
  execute(): void  // apply 'after' values to canvas buffer
  undo(): void     // apply 'before' values to canvas buffer
}
```

For a 32×32 pencil stroke with 50 pixels touched:  
- Snapshot approach: 32×32×4 = 4,096 bytes  
- Delta approach: 50 × (4+4+4+4) = 800 bytes — 5x more efficient, and scales with stroke density not canvas size

For a flood fill on a 4096×4096 canvas (worst case: entire canvas changes):  
- This is the exception where delta IS full-canvas-sized  
- Mitigation: flood fill commands are merged and discarded from undo stack if > 64MB; user is warned

### Command Merging
Consecutive pencil strokes within the same gesture (pointer held down) are merged into one Command, so a single undo undoes the full stroke, not one pixel at a time.

---

## 6. Rendering Engine (WebGL2)

### Canvas Architecture
```
WebGL2 Context
├── Framebuffers
│   ├── compositeBuffer    — final composited output (RGBA, canvas size)
│   ├── scratchBuffer      — in-progress stroke preview (not in undo stack)
│   └── onionBuffer        — pre-composited onion frames (rebuilt on frame change)
├── Textures (one per layer per visible frame)
│   └── TextureCache (LRU, max 64 textures in GPU memory at once)
├── Shader Programs
│   ├── compositeShader    — blend mode compositor (Normal, Multiply, Screen, Overlay)
│   ├── gridShader         — pixel grid lines
│   ├── checkerShader      — transparency checkerboard background
│   ├── selectionShader    — marching ants selection marquee (animated via uniform time)
│   └── onionShader        — tinted onion skin frames
└── Vertex Buffers
    └── quadVBO            — single fullscreen quad, reused for all draws
```

### Render Loop
```
requestAnimationFrame loop:

  if (dirty):
    1. Clear compositeBuffer
    2. Draw checkerboard (checkerShader, fullscreen quad)
    3. For each layer (bottom to top), if visible:
         a. Bind layer texture (upload from Uint8Array if dirty)
         b. Draw with compositeShader (apply opacity + blend mode)
    4. If onion skinning enabled:
         Draw onionBuffer over composite (tinted, semi-transparent)
    5. Draw selection marquee if selection exists
    6. Draw scratchBuffer (in-progress stroke preview)
    7. Draw grid overlay if enabled
    8. Blit compositeBuffer to screen canvas
    dirty = false
  
  else:
    // Skip — no wasted GPU cycles when nothing changed
```

### Dirty Tracking
```typescript
enum DirtyFlag {
  LAYER_DATA    = 1 << 0,   // pixel data changed → re-upload texture
  LAYER_ORDER   = 1 << 1,   // layer reordered → re-composite
  ONION         = 1 << 2,   // frame changed → rebuild onion buffer
  OVERLAY       = 1 << 3,   // grid/selection changed → re-render overlays
  FULL          = 0xFFFF    // everything
}
```
Only the necessary work is re-done each frame. A pencil stroke sets `LAYER_DATA` only.

### Texture Cache (LRU)
- Max 64 textures held in GPU memory (configurable, default ~256MB GPU budget)
- LRU eviction: oldest unused texture is freed when budget exceeded
- Re-upload on cache miss (from Uint8Array in JS memory)
- For very large canvases (≥ 2048×2048): texture is tiled into 1024×1024 tiles to fit within GPU max texture size limits

---

## 7. Tool Engine

### Tool Interface
```typescript
interface Tool {
  id: ToolId
  cursor: CursorDef         // what cursor to show on canvas

  onPointerDown(e: CanvasPointerEvent): void
  onPointerMove(e: CanvasPointerEvent): void
  onPointerUp(e: CanvasPointerEvent): void
  onKeyDown?(e: KeyboardEvent): void   // tools can intercept keys (line tool: Shift constraint)
  onCancel(): void          // e.g., Escape pressed mid-stroke
}
```

### Pointer Event Model
Raw browser pointer events are normalized before reaching tools:
```typescript
interface CanvasPointerEvent {
  canvasX: number      // pixel coordinate (floor of screen→canvas transform)
  canvasY: number
  pressure: number     // 0–1 (1.0 if not a stylus)
  button: 0 | 1 | 2   // left, middle, right
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
}
```

### Stroke → Command Lifecycle
```
pointerDown → tool.onPointerDown()
                 → begin scratch render (scratchBuffer)
                 → record 'before' pixel state for delta

pointerMove  → tool.onPointerMove() (called on every pointermove, throttled to rAF)
                 → update scratchBuffer (GPU only, no undo yet)

pointerUp    → tool.onPointerUp()
                 → finalize stroke
                 → create DrawCommand with deltas
                 → commandManager.execute(cmd)   ← now in undo stack
                 → clear scratchBuffer
                 → mark LAYER_DATA dirty
```

---

## 8. Animation Data Model

```
Project
└── frames: Frame[]          (ordered, index = frame number)
    └── Frame
        ├── duration: number  (ms)
        └── cells: Map<LayerId, Cell>  (only populated cells stored)
            └── Cell
                ├── data: Uint8ClampedArray  (RGBA, width*height*4 bytes)
                └── linked: boolean          (if true, references previous frame's cell data)

Layers are defined at project level (not per-frame):
Project
└── layers: Layer[]
    └── Layer
        ├── id: LayerId
        ├── name: string
        ├── visible: boolean
        ├── locked: boolean
        ├── opacity: number   (0–1)
        └── blendMode: BlendMode
```

**Key design decision — Linked cells:**  
If a layer doesn't change between frames, its cell is "linked" (references previous frame's data). This avoids storing N identical copies of a background layer across 100 frames. Storage is proportional to actual changes, not frame count × layer count.

---

## 9. State Management Stores

### Store Topology
```
useProjectStore
  ├─ projectMeta (name, filePath, dirty, savedAt)
  └─ canvasConfig (width, height, background)

useLayerStore
  ├─ layers: Layer[]
  └─ activeLayerId: LayerId

useFrameStore
  ├─ frames: Frame[]
  ├─ activeFrameIndex: number
  ├─ tags: Tag[]
  └─ playback: PlaybackState

useHistoryStore
  ├─ undoStack: Command[]
  ├─ redoStack: Command[]
  └─ maxHistory: number

usePaletteStore
  ├─ swatches: Color[]
  ├─ primaryColor: Color
  └─ secondaryColor: Color

useToolStore
  ├─ activeTool: ToolId
  ├─ toolOptions: Record<ToolId, ToolOptions>
  └─ selection: SelectionMask | null

useUIStore
  ├─ theme: Theme
  ├─ panels: PanelLayout
  ├─ zoomLevel: number
  └─ panOffset: { x, y }
```

### Store Communication
Stores do not import each other. Cross-store logic lives in **action composers** — plain TypeScript functions that call multiple store actions in sequence:

```typescript
// action-composers/frame-navigation.ts
export function goToFrame(index: number) {
  useFrameStore.getState().setActiveFrame(index)
  useLayerStore.getState().invalidateLayerThumbnails()
  renderingEngine.markDirty(DirtyFlag.ONION | DirtyFlag.LAYER_DATA)
}
```

This keeps stores clean and testable in isolation.

---

## 10. Tauri IPC Contract

All Rust commands are typed via auto-generated TypeScript bindings (using `tauri-plugin-bindgen` or manual typed wrappers):

```typescript
// src/bridge/tauri-commands.ts
export async function saveProject(payload: SaveProjectPayload): Promise<SaveResult>
export async function openProject(path: string): Promise<ProjectData>
export async function exportPng(payload: ExportPngPayload): Promise<void>
export async function exportSpritesheet(payload: SpritesheetPayload): Promise<SpritesheetResult>
export async function exportGif(payload: GifPayload): Promise<void>
export async function floodFill(payload: FloodFillPayload): Promise<FloodFillResult>
export async function getAutoSavePath(): Promise<string | null>
```

**Event subscriptions (Rust → TypeScript):**
```typescript
// Export progress
listen<ExportProgressEvent>('export:progress', handler)

// Auto-save status
listen<AutoSaveEvent>('autosave:complete', handler)
listen<AutoSaveEvent>('autosave:failed', handler)
```

**Security rule:** No Tauri command accepts raw file content from the renderer. The renderer passes data (pixel buffers, metadata). The Rust layer owns all filesystem paths and sanitizes them.

---

## 11. File System Sandbox

All file operations go through the `fs_sandbox` Rust module:

```rust
pub fn safe_write_path(requested: &str, allowed_dirs: &[PathBuf]) -> Result<PathBuf> {
    let canonical = canonicalize(requested)?;
    if !allowed_dirs.iter().any(|d| canonical.starts_with(d)) {
        return Err(Error::PathNotAllowed);
    }
    Ok(canonical)
}
```

Output paths for export are validated against user-chosen directories. Projects can only be saved to locations the user explicitly selected via the native file dialog (Tauri's `dialog::save_file`).

---

## 12. Project File I/O (Atomic Write)

The project file write sequence in Rust:

```
1. Serialize project to in-memory buffer (MessagePack + zstd compression)
2. Write buffer to   <filename>.rabit.tmp  (temp file, same directory)
3. Verify write (read back, validate header + checksum)
4. Atomic rename: .tmp → .rabit  (OS-level atomic on all target platforms)
5. Delete any previous .tmp file
```

If the process crashes between steps 2 and 4, the original `.rabit` file is untouched. The `.tmp` file is orphaned and cleaned up on next open.

---

## 13. Auto-Save & Crash Recovery

```
Auto-save:
  Every N minutes (default: 5):
    serialize project → write to %AppData%/rabit/autosave/<project-id>.rabit.autosave
    update autosave manifest (project-id → original path + timestamp)

On startup:
  read autosave manifest
  for each entry:
    if original file is older than autosave:
      offer recovery dialog to user
      if accepted: restore autosave, rename to recovery
      if declined: delete autosave entry
```

---

## 14. Architecture Tradeoffs

### Tauri vs Electron
| Aspect | Tauri | Electron |
|---|---|---|
| Bundle size | ~5–15MB | ~80–200MB |
| Memory overhead | Low (shared system WebView) | High (V8 + Chromium per process) |
| Native API access | Via Rust (safe, fast) | Via Node.js (fine, but slower for binary ops) |
| Ecosystem maturity | Younger but stable | Very mature |
| Developer familiarity | Rust required for backend | Node.js (more accessible) |
| **Decision** | **Chosen** | Rejected (bundle size + memory budget) |

### WebGL2 vs Native OpenGL vs wgpu

**Important clarification:** WebGL2 is OpenGL ES 3.0 exposed through a WebView context. It does not run natively outside of a browser or embedded WebView. In Tauri, it runs inside the OS-native embedded WebView (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux) — not directly on the GPU without that layer.

| Aspect | WebGL2 (in Tauri WebView) | Native OpenGL | wgpu (Rust) |
|---|---|---|---|
| Where it runs | Inside embedded WebView | Direct GPU (no WebView) | Direct GPU via Rust backend |
| Cross-platform | Yes (WebView handles abstraction) | Yes, but deprecated on macOS | Yes (Vulkan/Metal/DX12 backends) |
| Integration with React UI | Seamless (same JS context) | Complex (native window bridge) | Complex (offscreen → texture IPC) |
| Performance ceiling | Very high for 2D — sufficient | Higher, but overkill for pixel art | Highest — intended for 3D engines |
| macOS support | Via WebKit WebGL2 | Deprecated (Apple pushes Metal) | Yes (Metal backend) |
| Implementation effort | Low | High | Very high |
| **Decision** | **Chosen** | Rejected (macOS deprecation + complexity) | Rejected for now (future upgrade path if needed) |

WebGPU (the WebGL successor) is the natural upgrade path — already supported in WebView2 on Windows, arriving in WebKit. Migration from WebGL2 → WebGPU is significantly smoother than jumping to wgpu.

### WebGL2 vs CPU Canvas
| Aspect | WebGL2 | 2D Canvas (CPU) |
|---|---|---|
| Large canvas performance | GPU-accelerated | Degrades with canvas size |
| Blend mode flexibility | Custom GLSL shaders | Limited by browser API |
| Implementation complexity | Higher | Lower |
| Onion skinning with N frames | Cheap (GPU tint + blend) | Expensive (N composites per frame) |
| **Decision** | **Chosen** | Rejected (performance target requires GPU) |

### Zustand vs Redux Toolkit
| Aspect | Zustand | Redux Toolkit |
|---|---|---|
| Boilerplate | Minimal | Moderate |
| Performance | Excellent (fine-grained subscriptions) | Good |
| DevTools | React DevTools + Zustand devtools | Redux DevTools (excellent) |
| Learning curve | Low | Medium |
| **Decision** | **Chosen** | Rejected (Zustand is sufficient; Redux overhead not justified) |

### Delta Undo vs Snapshot Undo
| Aspect | Delta Undo | Snapshot Undo |
|---|---|---|
| Memory per operation | Proportional to pixels changed | Full canvas size always |
| Implementation complexity | Higher | Lower |
| 200 ops on 512×512 canvas | ~10–50MB (typical strokes) | ~200MB |
| 200 ops on 4096×4096 canvas | ~50–200MB (varies) | ~12.8GB (infeasible) |
| **Decision** | **Chosen** | Rejected (memory target requires delta) |

---

*End of Architecture Design v1.0*
