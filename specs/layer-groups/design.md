# Layer Groups — Design

## Approach
Groups are represented as special `Layer` entries (type `'group'`) in the existing flat `layers[]` array. Each regular layer gets an optional `parentGroupId` field. The array order determines render order — group members follow their group header in the array. Rendering composites group members into a temporary off-screen buffer, then blends that buffer onto the main output using the group's blend mode and opacity.

V1 is one level deep only — a group cannot have `parentGroupId` set.

## Affected Components

| File | Change |
|---|---|
| `src/core/DataModel/types.ts` | Add `type?: 'layer' \| 'group'` and `parentGroupId?: string \| null` to `Layer` |
| `src/core/DataModel/factories.ts` | `makeLayerGroup()` factory; update `makeLayer()` to set `type: 'layer'` |
| `src/core/commands/LayerCommands.ts` | Add `AddGroupCommand`; update `RemoveLayerCommand` to cascade-delete group members |
| `src/state/action-composers/layer-actions.ts` | `addGroup()`, `moveLayerToGroup(layerId, groupId)`, `moveLayerOutOfGroup(layerId)` |
| `src/render/RenderingEngine.ts` | Detect group boundaries when building layer specs; composite group members into a temp FBO |
| `src/ui/panels/LayerPanel/LayerPanel.tsx` | Add "Add Group" button; pass group info to `LayerRow` |
| `src/ui/panels/LayerPanel/LayerRow.tsx` | Render group header variant (chevron, no thumbnail); indent member rows; group drag-into-group drop zone |
| `src/ui/panels/LayerPanel/LayerRow.module.css` | Group header and member indent styles |
| `src-tauri/src/project_io/dto.rs` | Add `layer_type` and `parent_group_id` to `LayerDto` with `#[serde(default)]` |
| Timeline | Group header rows in layer label column (display only — no frame cells for group rows) |

## Data Model Changes

```ts
// types.ts additions
export type LayerType = 'layer' | 'group';

export interface Layer {
  id: LayerId;
  name: string;
  type: LayerType;          // new — default 'layer'
  parentGroupId: LayerId | null; // new — null = top-level
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  collapsed?: boolean;       // group only — controls panel display
}
```

Backward compat: `type` defaults to `'layer'` and `parentGroupId` defaults to `null` via `#[serde(default)]` in Rust and optional field in JS hydration.

## Key Flows

### Rendering with groups
The renderer iterates `layers[]` bottom to top. When it encounters a group layer:
1. Collect the immediately following layers that have `parentGroupId === group.id`.
2. Composite those members into a temp FBO (reusing the existing layer-by-layer composite logic, just targeting a temp texture instead of the output).
3. Apply the group's opacity and blend mode when blitting the temp texture onto the main output.
4. Skip the member layers in the main loop (already consumed).

For groups with no members, render nothing.

### Layer panel — group display
- Group rows show a collapse chevron, group icon, and name. No thumbnail.
- Member rows are indented by 16px.
- A collapsed group hides member rows visually but they still exist in state.
- Drag target: dragging a layer over a group header for >300ms shows a highlight indicating "drop into group". Dropping outside any group header = move to top level.

### Delete group cascade
`RemoveLayerCommand` for a group: checks `layers.filter(l => l.parentGroupId === groupId)`. If any members exist, the command also removes them. This is shown as a single undo step ("Delete group 'FX' and 2 layers").

### Drag into group
`reorderLayer` action extended: if the drop target is a group header, set `parentGroupId` on the moved layer and insert it after the group's last existing member in `layers[]`.

## Trade-offs
- **Flat array with parentGroupId vs. nested tree**: flat array is simpler and avoids restructuring the entire codebase that indexes into `layers[]`. The rendering and display code can walk the array once and derive group structure.
- **One-level depth**: keeps command logic, drag-drop, and file format simple for V1. Nesting can be added by allowing groups to have `parentGroupId` in a future version.
- **Temp FBO for composite**: requires one additional FBO per group active in a single frame. At 60fps this is negligible for V1's canvas sizes.

## Risks
- Rendering engine (`RenderingEngine.ts`) needs to be read in full before implementing the FBO composite path — the existing pipeline must be understood before modifying it.
- The flat `layers[]` ordering invariant (group header must precede all its members) must be enforced by every command that reorders layers. This is an implementation invariant that needs tests.
