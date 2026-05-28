import type { CellDto, ProjectDto } from './projectIpc';

// Local type aliases so this bridge file does not import from core.
// These must stay in sync with src/core/DataModel/types.ts.
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';
type LayerType = 'layer' | 'group';
type LoopDirection = 'forward' | 'reverse' | 'ping-pong';
interface Cell { linked: boolean; data: Uint8ClampedArray | null; }
interface Project {
  schemaVersion: 1;
  projectId: string;
  name: string;
  author: string | null;
  createdAt: number;
  modifiedAt: number;
  application: string;
  canvas: { width: number; height: number; colorMode: 'rgba'; backgroundColor: number; dpi: number };
  layers: Array<{ id: string; name: string; type: LayerType; parentGroupId: string | null; visible: boolean; locked: boolean; opacity: number; blendMode: BlendMode; collapsed?: boolean }>;
  frames: Array<{ id: string; duration: number; cells: Record<string, Cell>; hiddenLayerIds: string[] }>;
  palette: { id: string; name: string; swatches: Array<{ color: number; name: string | null }> };
  tags: Array<{ id: string; name: string; from: number; to: number; loopDirection: LoopDirection; color: number }>;
  activeLayerId: string | null;
  activeFrameIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  referencePath?: string | null;
}

/**
 * Converts the in-memory Project to the wire DTO for IPC.
 * The only non-trivial conversion: Uint8ClampedArray → number[].
 * This is the single place that boundary crossing happens — keep it here.
 */
export function projectToDto(project: Project): ProjectDto {
  return {
    schemaVersion: project.schemaVersion,
    projectId: project.projectId,
    name: project.name,
    author: project.author,
    createdAt: project.createdAt,
    modifiedAt: project.modifiedAt,
    application: project.application,
    canvas: {
      width: project.canvas.width,
      height: project.canvas.height,
      colorMode: project.canvas.colorMode,
      backgroundColor: project.canvas.backgroundColor,
      dpi: project.canvas.dpi,
    },
    layers: project.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      layerType: l.type,
      parentGroupId: l.parentGroupId ?? null,
      collapsed: l.collapsed ?? null,
    })),
    frames: project.frames.map((f) => ({
      id: f.id,
      duration: f.duration,
      hiddenLayerIds: f.hiddenLayerIds,
      cells: Object.fromEntries(
        Object.entries(f.cells).map(([layerId, cell]) => [
          layerId,
          cellToDto(cell),
        ]),
      ),
    })),
    palette: {
      id: project.palette.id,
      name: project.palette.name,
      swatches: project.palette.swatches.map((s) => ({
        color: s.color,
        name: s.name,
      })),
    },
    tags: project.tags.map((t) => ({
      id: t.id,
      name: t.name,
      from: t.from,
      to: t.to,
      loopDirection: t.loopDirection,
      color: t.color,
    })),
    activeLayerId: project.activeLayerId,
    activeFrameIndex: project.activeFrameIndex,
    zoomLevel: project.zoomLevel,
    panOffset: { x: project.panOffset.x, y: project.panOffset.y },
    reference_path: project.referencePath ?? null,
  };
}

/**
 * Converts the wire DTO back to an in-memory Project.
 * The only non-trivial conversion: number[] → Uint8ClampedArray.
 */
export function dtoToProject(dto: ProjectDto): Project {
  return {
    schemaVersion: 1,
    projectId: dto.projectId,
    name: dto.name,
    author: dto.author,
    createdAt: dto.createdAt,
    modifiedAt: dto.modifiedAt,
    application: dto.application,
    canvas: {
      width: dto.canvas.width,
      height: dto.canvas.height,
      colorMode: dto.canvas.colorMode as 'rgba',
      backgroundColor: dto.canvas.backgroundColor,
      dpi: dto.canvas.dpi,
    },
    layers: dto.layers.map((l) => ({
      id: l.id,
      name: l.name,
      type: (l.layerType as LayerType | null | undefined) ?? 'layer',
      parentGroupId: l.parentGroupId ?? null,
      ...(l.collapsed != null ? { collapsed: l.collapsed } : {}),
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode as BlendMode,
    })),
    frames: dto.frames.map((f) => ({
      id: f.id,
      duration: f.duration,
      hiddenLayerIds: f.hiddenLayerIds ?? [],
      cells: Object.fromEntries(
        Object.entries(f.cells).map(([layerId, cellDto]) => [
          layerId,
          dtoToCell(cellDto),
        ]),
      ),
    })),
    palette: {
      id: dto.palette.id,
      name: dto.palette.name,
      swatches: dto.palette.swatches.map((s) => ({
        color: s.color,
        name: s.name,
      })),
    },
    tags: dto.tags.map((t) => ({
      id: t.id,
      name: t.name,
      from: t.from,
      to: t.to,
      loopDirection: t.loopDirection as LoopDirection,
      color: t.color,
    })),
    activeLayerId: dto.activeLayerId,
    activeFrameIndex: dto.activeFrameIndex,
    zoomLevel: dto.zoomLevel,
    panOffset: { x: dto.panOffset.x, y: dto.panOffset.y },
    referencePath: dto.reference_path ?? null,
  };
}

function cellToDto(cell: Cell): CellDto {
  return {
    linked: cell.linked,
    data: cell.data ? Array.from(cell.data) : null,
  };
}

function dtoToCell(dto: CellDto): Cell {
  return {
    linked: dto.linked,
    data: dto.data ? new Uint8ClampedArray(dto.data) : null,
  };
}
