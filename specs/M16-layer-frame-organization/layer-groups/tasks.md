# Layer Groups — Tasks

## Task 1 — Extend `Layer` type
**Files:** `src/core/DataModel/types.ts`
- Add `export type LayerType = 'layer' | 'group';`
- Add to `Layer`: `type: LayerType`, `parentGroupId: LayerId | null`, `collapsed?: boolean`
**Acceptance:** `pnpm typecheck` — expect downstream errors; rest of type system adjusts in subsequent tasks.

## Task 2 — Update `makeLayer` factory and add `makeLayerGroup`
**Files:** `src/core/DataModel/factories.ts`
- `makeLayer()`: set `type: 'layer'`, `parentGroupId: null`
- New `makeLayerGroup(name?: string): Layer`: `type: 'group'`, `parentGroupId: null`, `collapsed: false`, no cell data (callers must not call `setCell` on group layers)
**Depends on:** Task 1
**Acceptance:** `pnpm typecheck` passes (factories updated).

## Task 3 — Rust DTO backward compat
**Files:** `src-tauri/src/project_io/dto.rs`
- Add `layer_type: Option<String>` and `parent_group_id: Option<String>` to `LayerDto` with `#[serde(default)]`
- Hydration: map `None` → `"layer"` and `None` → `null` respectively
**Acceptance:** `cargo build` passes; existing `.rabit` files still load.

## Task 4 — `AddGroupCommand` + cascade-delete in `RemoveLayerCommand`
**Files:** `src/core/commands/LayerCommands.ts`
- New `AddGroupCommand`: creates a group layer at a given index, undoable
- `RemoveLayerCommand`: if `layer.type === 'group'`, constructor also accepts `memberIds: LayerId[]` and on `execute()` removes members before the group; on `undo()` restores them in order
- Update `description` for group removal: `Delete group "${name}" and ${n} layers`
**Depends on:** Task 2
**Acceptance:** `pnpm typecheck` passes.

## Task 5 — Group action-composers
**Files:** `src/state/action-composers/layer-actions.ts`
- `addGroup()`: dispatch `AddGroupCommand` above the active layer
- `moveLayerToGroup(layerId, groupId)`: update `parentGroupId` on the layer; reorder it to follow the group's last member in `layers[]`
- `moveLayerOutOfGroup(layerId)`: set `parentGroupId: null`; move to just after the group in the array
- `toggleGroupCollapsed(groupId)`: toggle `collapsed` on the group layer (no command needed — display-only state)
**Depends on:** Task 4
**Acceptance:** `pnpm typecheck` passes.

## Task 6 — Renderer: group FBO composite
**Files:** `src/render/RenderingEngine.ts`
- Read the full file before modifying
- Before compositing layers, group the `layers[]` into segments: top-level layers and group clusters (`{ group: Layer, members: Layer[] }`)
- For each group cluster: composite members into a temp WebGL framebuffer/texture using existing per-layer composite logic; then blend that temp texture onto the main output using the group's `blendMode` and `opacity`
- Skip rendering group layers that have `type === 'group'` in the main pass (they have no pixel data)
- Skip rendering member layers that belong to a collapsed group (visual only — rendering still happens)
**Depends on:** Task 2
**Acceptance:** `pnpm build` passes; rendering produces correct composited output.

## Task 7 — Layer panel UI: group header + indent
**Files:** `src/ui/panels/LayerPanel/LayerPanel.tsx`, `src/ui/panels/LayerPanel/LayerRow.tsx`, `src/ui/panels/LayerPanel/LayerRow.module.css`
- `LayerPanel`: add "Add Group" button (folder icon) to header actions
- Pass `isGroupHeader`, `isGroupMember`, `groupCollapsed` props to `LayerRow`
- `LayerRow`: if `isGroupHeader`, render chevron toggle + folder icon instead of thumbnail; clicking chevron calls `toggleGroupCollapsed`
- If `isGroupMember`, add 16px left indent via CSS
- When `collapsed === true`, skip rendering member rows
- Drag-into-group: holding drag over a group header for 400ms shows drop-into highlight; on drop, call `moveLayerToGroup`
**Depends on:** Tasks 5, 6
**Acceptance:** Groups collapse/expand; members are indented; `pnpm typecheck` passes.

## Task 8 — Timeline: group rows in layer label column
**Files:** `src/ui/panels/Timeline/Timeline.tsx`, `Timeline.module.css`
- Group header rows: show folder icon + name, no frame cells
- Member rows: indented 16px
- Collapsed group: hide member rows (frame cells for members are also hidden)
**Depends on:** Task 7
**Acceptance:** `pnpm typecheck` passes; timeline renders group hierarchy correctly.

## Task 9 — Verification
- Run `pnpm build` — 0 errors; `cargo build` — 0 errors
- Run `pnpm test` — all pass
- Manual: create group, add 2 layers to it, collapse/expand, verify rendering, verify undo of group deletion restores all members
