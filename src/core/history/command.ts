/**
 * CineCutPro — command bus (Phase 0 / §4.2 Command pattern).
 *
 * Every mutation flows through a Command. The bus applies it to an immutable
 * model, records the before→after patch in history, and notifies subscribers.
 * This single seam is what later unlocks undo/redo, transactions (coalesced
 * gestures), scripting/macros, and the plugin mutation API — all for free.
 *
 * It is framework-agnostic (no React); the UI subscribes via `subscribe`.
 */

import { PatchHistory } from './patchHistory';

export interface Command<T> {
  readonly label: string;
  /** Optional: same key within the coalesce window merges into one undo step. */
  readonly coalesceKey?: string;
  /** Pure transform: returns the next model (must not mutate `model`). */
  apply(model: T): T;
}

/** Convenience for defining a command inline. */
export function command<T>(
  label: string,
  apply: (model: T) => T,
  coalesceKey?: string,
): Command<T> {
  return { label, apply, coalesceKey };
}

type Listener<T> = (model: T) => void;

export class CommandBus<T> {
  private model: T;
  private readonly history: PatchHistory;
  private readonly listeners = new Set<Listener<T>>();
  private inTransaction = false;

  constructor(initial: T, history: PatchHistory = new PatchHistory()) {
    this.model = initial;
    this.history = history;
  }

  getState(): T {
    return this.model;
  }

  getHistory(): PatchHistory {
    return this.history;
  }

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    if (this.inTransaction) return;
    for (const fn of this.listeners) fn(this.model);
  }

  /** Apply a command, record history, and notify. Returns the new model. */
  dispatch(cmd: Command<T>): T {
    const before = this.model;
    const after = cmd.apply(before);
    this.model = after;
    if (!this.inTransaction) {
      this.history.record(before, after, { label: cmd.label, coalesceKey: cmd.coalesceKey });
      this.notify();
    }
    return after;
  }

  /**
   * Run several commands as one undo step. The inner `run` applies commands
   * without individually recording; a single entry is recorded at the end.
   */
  transaction(label: string, run: (apply: (cmd: Command<T>) => void) => void): T {
    const before = this.model;
    const wasInTransaction = this.inTransaction;
    this.inTransaction = true;
    try {
      run((cmd) => {
        this.model = cmd.apply(this.model);
      });
    } finally {
      this.inTransaction = wasInTransaction;
    }
    if (!this.inTransaction) {
      this.history.record(before, this.model, { label });
      this.notify();
    }
    return this.model;
  }

  undo(): T {
    this.model = this.history.undo(this.model);
    this.notify();
    return this.model;
  }

  redo(): T {
    this.model = this.history.redo(this.model);
    this.notify();
    return this.model;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }
}
