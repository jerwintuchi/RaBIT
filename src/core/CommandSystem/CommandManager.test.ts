import { describe, it, expect, vi } from 'vitest';
import { CommandManager } from './CommandManager';
import { NoOpCommand } from '../commands/NoOpCommand';
import type { Command } from './Command';

function makeCmd(description?: string) {
  return new NoOpCommand(description);
}

describe('CommandManager', () => {
  it('execute calls cmd.execute and pushes to undo stack', () => {
    const mgr = new CommandManager();
    const cmd = makeCmd();
    mgr.execute(cmd);
    expect(cmd.executeCalls).toBe(1);
    expect(mgr.getUndoStack()).toHaveLength(1);
    expect(mgr.getRedoStack()).toHaveLength(0);
    expect(mgr.canUndo()).toBe(true);
    expect(mgr.canRedo()).toBe(false);
  });

  it('undo pops from undo stack and pushes to redo stack', () => {
    const mgr = new CommandManager();
    const cmd = makeCmd();
    mgr.execute(cmd);
    const undone = mgr.undo();
    expect(undone).toBe(cmd);
    expect(cmd.undoCalls).toBe(1);
    expect(mgr.getUndoStack()).toHaveLength(0);
    expect(mgr.getRedoStack()).toHaveLength(1);
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(true);
  });

  it('redo re-executes and moves back to undo stack', () => {
    const mgr = new CommandManager();
    const cmd = makeCmd();
    mgr.execute(cmd);
    mgr.undo();
    const redone = mgr.redo();
    expect(redone).toBe(cmd);
    expect(cmd.executeCalls).toBe(2);
    expect(mgr.getUndoStack()).toHaveLength(1);
    expect(mgr.getRedoStack()).toHaveLength(0);
  });

  it('new execute clears the redo stack', () => {
    const mgr = new CommandManager();
    const a = makeCmd('a');
    const b = makeCmd('b');
    const c = makeCmd('c');
    mgr.execute(a);
    mgr.execute(b);
    mgr.undo();
    expect(mgr.canRedo()).toBe(true);
    mgr.execute(c);
    expect(mgr.canRedo()).toBe(false);
    expect(mgr.getUndoStack()).toHaveLength(2);
  });

  it('undo on empty stack returns undefined and does not throw', () => {
    const mgr = new CommandManager();
    expect(mgr.undo()).toBeUndefined();
  });

  it('redo on empty stack returns undefined and does not throw', () => {
    const mgr = new CommandManager();
    expect(mgr.redo()).toBeUndefined();
  });

  it('maxHistory trims oldest entries when exceeded', () => {
    const mgr = new CommandManager({ maxHistory: 3 });
    const cmds = [makeCmd(), makeCmd(), makeCmd(), makeCmd(), makeCmd()];
    for (const cmd of cmds) mgr.execute(cmd);
    expect(mgr.getUndoStack()).toHaveLength(3);
  });

  it('clear empties both stacks', () => {
    const mgr = new CommandManager();
    mgr.execute(makeCmd());
    mgr.execute(makeCmd());
    mgr.clear();
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(false);
  });

  it('onChange is called after execute, undo, redo, and clear', () => {
    const onChange = vi.fn();
    const mgr = new CommandManager({ onChange });
    const cmd = makeCmd();
    mgr.execute(cmd); // +1
    expect(onChange).toHaveBeenCalledTimes(1);
    mgr.undo(); // +1
    expect(onChange).toHaveBeenCalledTimes(2);
    mgr.redo(); // +1
    expect(onChange).toHaveBeenCalledTimes(3);
    mgr.clear(); // +1
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('merge combines consecutive compatible commands', () => {
    // A command that merges with same-description siblings
    class MergeableCmd implements Command {
      readonly id: string;
      readonly description: string;
      public value: number;
      executeCalls = 0;
      undoCalls = 0;

      constructor(value: number) {
        this.id = `${value}`;
        this.description = 'mergeable';
        this.value = value;
      }

      execute() {
        this.executeCalls++;
      }
      undo() {
        this.undoCalls++;
      }

      merge(other: Command): Command | null {
        if (other.description !== 'mergeable') return null;
        const merged = new MergeableCmd(this.value + (other as MergeableCmd).value);
        return merged;
      }
    }

    const mgr = new CommandManager();
    const a = new MergeableCmd(1);
    const b = new MergeableCmd(2);
    mgr.execute(a);
    mgr.execute(b);
    // a and b should have merged → still 1 entry
    expect(mgr.getUndoStack()).toHaveLength(1);
    expect((mgr.getUndoStack()[0] as MergeableCmd).value).toBe(3);
  });

  it('merge returning null keeps both commands separate', () => {
    const mgr = new CommandManager();
    const a = makeCmd('a');
    const b = makeCmd('b');
    mgr.execute(a);
    mgr.execute(b);
    expect(mgr.getUndoStack()).toHaveLength(2);
  });
});
