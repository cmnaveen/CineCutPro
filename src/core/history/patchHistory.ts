/**
 * CineCutPro — patch-based undo/redo (Phase 0 / §11).
 *
 * Replaces the snapshot ring (`src/state/history.js`) with O(change) patches.
 * Each entry stores a forward patch (`redo`) and its inverse (`undo`); undo/redo
 * apply patches to the caller-supplied state object (typically the persistent
 * slices of the editor model). Rapid same-key edits (e.g. a drag) coalesce into
 * one entry so a single Ctrl+Z reverts the whole gesture.
 */

import { diff, invert, apply, type Patch } from './patch';

export interface HistoryEntry {
  redo: Patch;
  undo: Patch;
  label: string;
  coalesceKey?: string;
  time: number;
}

export interface RecordOptions {
  label?: string;
  /** Same key + within `coalesceMs` ⇒ merged into the previous entry. */
  coalesceKey?: string;
  coalesceMs?: number;
  /** Test seam: override the timestamp used for coalescing. */
  time?: number;
}

export const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_COALESCE_MS = 600;

export class PatchHistory {
  past: HistoryEntry[] = [];
  future: HistoryEntry[] = [];
  readonly limit: number;

  constructor(limit: number = DEFAULT_HISTORY_LIMIT) {
    this.limit = limit;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undoLabel(): string | null {
    return this.past.length ? this.past[this.past.length - 1].label : null;
  }
  redoLabel(): string | null {
    return this.future.length ? this.future[0].label : null;
  }

  /**
   * Record the transition `before → after`.
   * @returns true if anything was recorded (state actually changed).
   */
  record<T>(before: T, after: T, opts: RecordOptions = {}): boolean {
    const redo = diff(before, after);
    if (redo.length === 0) return false;

    const time = opts.time ?? Date.now();
    const label = opts.label ?? 'Edit';
    const last = this.past[this.past.length - 1];
    const coalesceMs = opts.coalesceMs ?? DEFAULT_COALESCE_MS;

    if (
      last &&
      opts.coalesceKey &&
      last.coalesceKey === opts.coalesceKey &&
      time - last.time <= coalesceMs
    ) {
      // Recompute the merged entry from the start of the run so the single
      // undo reverts the whole gesture. runStart = before-of-this-record with
      // the previous entry's undo applied.
      const runStart = apply(before, last.undo);
      const mergedRedo = diff(runStart, after);
      this.past[this.past.length - 1] = {
        redo: mergedRedo,
        undo: invert(mergedRedo),
        label,
        coalesceKey: opts.coalesceKey,
        time,
      };
      this.future = [];
      return true;
    }

    this.past.push({ redo, undo: invert(redo), label, coalesceKey: opts.coalesceKey, time });
    while (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return true;
  }

  /** Apply the inverse of the last entry to `state`; returns the new state. */
  undo<T>(state: T): T {
    const entry = this.past.pop();
    if (!entry) return state;
    const next = apply(state, entry.undo);
    this.future.unshift(entry);
    return next;
  }

  /** Re-apply the next entry to `state`; returns the new state. */
  redo<T>(state: T): T {
    const entry = this.future.shift();
    if (!entry) return state;
    const next = apply(state, entry.redo);
    this.past.push(entry);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
