import { create } from 'zustand';
import { CommandManager } from '../core/CommandSystem';
import type { Command } from '../core/CommandSystem';

interface HistoryState {
  // Expose stack lengths reactively so UI re-renders when stacks change
  undoCount: number;
  redoCount: number;
  maxHistory: number;

  // The CommandManager instance (not reactive — mutated in place)
  manager: CommandManager;

  execute(cmd: Command): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  setMaxHistory(n: number): void;
}

export const useHistoryStore = create<HistoryState>()((set, get) => {
  const sync = () =>
    set(() => ({
      undoCount: get().manager.getUndoStack().length,
      redoCount: get().manager.getRedoStack().length,
    }));

  const manager = new CommandManager({
    maxHistory: 1000,
    onChange: sync,
  });

  return {
    undoCount: 0,
    redoCount: 0,
    maxHistory: 1000,
    manager,

    execute(cmd) {
      get().manager.execute(cmd);
    },

    undo() {
      get().manager.undo();
    },

    redo() {
      get().manager.redo();
    },

    canUndo() {
      return get().manager.canUndo();
    },

    canRedo() {
      return get().manager.canRedo();
    },

    clear() {
      get().manager.clear();
    },

    setMaxHistory(n) {
      set({ maxHistory: n });
      // Recreate manager with new limit; existing stacks are cleared
      const newManager = new CommandManager({ maxHistory: n, onChange: sync });
      set({ manager: newManager, undoCount: 0, redoCount: 0 });
    },
  };
});
