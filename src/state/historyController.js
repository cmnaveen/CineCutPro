/**
 * Unified undo/redo controller — selects the history backend behind a flag.
 *
 *   'snapshot' : the original ring of deep-cloned persistent slices
 *                (src/state/history.js) — battle-tested, O(project) per entry.
 *   'patch'    : the Phase 0 command / inverse-patch engine (src/core) —
 *                O(change) per entry, gesture coalescing, the seam the plugin
 *                and scripting APIs will later build on.
 *
 * Both operate on the full editor state but only persist the persistent slices
 * (via `snapshot()`), so they are drop-in interchangeable. `patch` is the
 * default; set localStorage `ccp.historyMode = 'snapshot'` to fall back.
 *
 * See IMPLEMENTATION_PLAN.md §11 and the Phase 0 increment-2 changelog.
 */

import {
  emptyHistory,
  pushHistory,
  undo as snapUndo,
  redo as snapRedo,
  undoLabel as snapUndoLabel,
  redoLabel as snapRedoLabel,
  snapshot,
  ACTION_LABELS,
} from './history.js';
import { PatchHistory } from '../core/history/patchHistory';

export const HISTORY_MODES = ['snapshot', 'patch'];
const DEFAULT_MODE = 'patch';

export function getHistoryMode() {
  try {
    if (typeof localStorage !== 'undefined') {
      const m = localStorage.getItem('ccp.historyMode');
      if (HISTORY_MODES.includes(m)) return m;
    }
  } catch {
    /* storage unavailable — fall through to default */
  }
  return DEFAULT_MODE;
}

/** Backend A: deep-clone snapshots (the original behavior, unchanged). */
function snapshotController() {
  let h = emptyHistory();
  return {
    mode: 'snapshot',
    record(prev /* next */, _next, type) {
      h = pushHistory(h, prev, type);
    },
    undo(cur) {
      const r = snapUndo(h, cur);
      h = r.history;
      return r.state;
    },
    redo(cur) {
      const r = snapRedo(h, cur);
      h = r.history;
      return r.state;
    },
    canUndo: () => h.past.length > 0,
    canRedo: () => h.future.length > 0,
    depth: () => h.past.length,
    undoLabel: () => snapUndoLabel(h),
    redoLabel: () => snapRedoLabel(h),
    clear() {
      h = emptyHistory();
    },
  };
}

/** Backend B: command / inverse-patch engine (Phase 0 core). */
function patchController() {
  const ph = new PatchHistory();
  return {
    mode: 'patch',
    record(prev, next, type) {
      ph.record(snapshot(prev), snapshot(next), { label: ACTION_LABELS[type] ?? type ?? 'Edit' });
    },
    undo(cur) {
      if (!ph.canUndo) return cur;
      return { ...cur, ...ph.undo(snapshot(cur)) };
    },
    redo(cur) {
      if (!ph.canRedo) return cur;
      return { ...cur, ...ph.redo(snapshot(cur)) };
    },
    canUndo: () => ph.canUndo,
    canRedo: () => ph.canRedo,
    depth: () => ph.past.length,
    undoLabel: () => ph.undoLabel(),
    redoLabel: () => ph.redoLabel(),
    clear() {
      ph.clear();
    },
  };
}

export function createHistoryController(mode = getHistoryMode()) {
  return mode === 'snapshot' ? snapshotController() : patchController();
}
