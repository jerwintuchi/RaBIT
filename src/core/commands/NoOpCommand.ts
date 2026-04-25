import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem/Command';

// A no-operation command used for testing the CommandManager pipeline.
export class NoOpCommand implements Command {
  readonly id: string;
  readonly description: string;
  public executeCalls = 0;
  public undoCalls = 0;

  constructor(description = 'No-op') {
    this.id = nanoid(12);
    this.description = description;
  }

  execute(): void {
    this.executeCalls++;
  }

  undo(): void {
    this.undoCalls++;
  }
}
