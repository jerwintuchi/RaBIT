export interface Command {
  readonly id: string; // nanoid, unique per-instance
  readonly description: string; // shown in History panel
  execute(): void;
  undo(): void;
  // Optional: merge consecutive same-type commands (e.g., brush strokes).
  // Return merged Command, or null if merge is not possible.
  merge?(other: Command): Command | null;
}
