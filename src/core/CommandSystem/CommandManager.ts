import type { Command } from './Command';

export interface CommandManagerOptions {
  maxHistory?: number; // default 1000
  onChange?: () => void; // called after any stack mutation (for store sync)
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxHistory: number;
  private readonly onChange: (() => void) | undefined;

  constructor(options: CommandManagerOptions = {}) {
    this.maxHistory = options.maxHistory ?? 1000;
    this.onChange = options.onChange;
  }

  execute(cmd: Command): void {
    cmd.execute();

    // Attempt to merge with the previous command
    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev?.merge) {
      const merged = prev.merge(cmd);
      if (merged !== null) {
        this.undoStack[this.undoStack.length - 1] = merged;
        this.redoStack = [];
        this.trim();
        this.onChange?.();
        return;
      }
    }

    this.undoStack.push(cmd);
    this.redoStack = [];
    this.trim();
    this.onChange?.();
  }

  undo(): Command | undefined {
    const cmd = this.undoStack.pop();
    if (!cmd) return undefined;
    cmd.undo();
    this.redoStack.push(cmd);
    this.onChange?.();
    return cmd;
  }

  redo(): Command | undefined {
    const cmd = this.redoStack.pop();
    if (!cmd) return undefined;
    cmd.execute();
    this.undoStack.push(cmd);
    this.onChange?.();
    return cmd;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoStack(): readonly Command[] {
    return this.undoStack;
  }

  getRedoStack(): readonly Command[] {
    return this.redoStack;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange?.();
  }

  private trim(): void {
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.splice(0, this.undoStack.length - this.maxHistory);
    }
  }
}
