/**
 * Undo / redo stack.
 *
 * We keep a bounded ring of deep-cloned snapshots. Only the persistent slices
 * of state participate (project, media, tracks, clips, transitions, selection,
 * markers, sequences, groups); volatile UI bits (playhead, ui flags, source
 * monitor) are excluded so trivial scrubs do not litter history.
 *
 * v2 enhancements:
 *   - History entries carry action labels for "Undo X" / "Redo X" display.
 *   - groupHistory() batches related operations (e.g., multi-clip move) into
 *     a single undo step.
 *   - Limit increased to 100.
 */

export const HISTORY_LIMIT = 100;

const PERSISTENT_KEYS = [
  'project',
  'media',
  'tracks',
  'clips',
  'transitions',
  'inPoint',
  'outPoint',
  'selectedClipIds',
  // v2 additions
  'markers',
  'sequences',
  'groups'
];

const deepClone = (v) => {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
};

export const snapshot = (state) => {
  const out = {};
  for (const k of PERSISTENT_KEYS) out[k] = deepClone(state[k]);
  return out;
};

/** ACTION_LABELS maps action types to human-readable undo/redo descriptions. */
export const ACTION_LABELS = {
  'media/add': 'Import Media',
  'media/remove': 'Remove Media',
  'media/addSubclip': 'Create Subclip',
  'track/add': 'Add Track',
  'track/update': 'Update Track',
  'track/remove': 'Remove Track',
  'track/setHeight': 'Resize Track',
  'track/reorder': 'Reorder Tracks',
  'clip/insertFromMedia': 'Insert Clip',
  'clip/insertTitle': 'Insert Title',
  'clip/move': 'Move Clip',
  'clip/moveSelection': 'Move Selection',
  'clip/trim': 'Trim Clip',
  'clip/blade': 'Blade / Split',
  'clip/delete': 'Delete Clip',
  'clip/duplicate': 'Duplicate Clip',
  'clip/update': 'Update Clip',
  'clip/setSpeed': 'Change Speed',
  'clip/updateTransform': 'Transform',
  'clip/updateFilters': 'Adjust Filters',
  'clip/updateAudio': 'Adjust Audio',
  'clip/updateTitle': 'Edit Title',
  'clip/addKeyframe': 'Add Keyframe',
  'clip/clearKeyframes': 'Clear Keyframes',
  'clip/removeKeyframe': 'Remove Keyframe',
  'clip/updateKeyframe': 'Update Keyframe',
  'transition/apply': 'Apply Transition',
  'transition/clear': 'Remove Transition',
  'project/rename': 'Rename Project',
  'project/update': 'Update Project',
  'project/loadAll': 'Load Project',
  // Phase 1/2 actions
  'marker/add': 'Add Marker',
  'marker/remove': 'Remove Marker',
  'marker/update': 'Update Marker',
  'clipboard/cut': 'Cut',
  'clipboard/paste': 'Paste',
  'clip/group': 'Group Clips',
  'clip/ungroup': 'Ungroup Clips',
  'clip/rippleDelete': 'Ripple Delete',
  'clip/rollEdit': 'Roll Edit',
  'clip/slipEdit': 'Slip Edit',
  'clip/slideEdit': 'Slide Edit',
  'clip/freeze': 'Freeze Frame',
  'clip/toggleReverse': 'Toggle Reverse',
  'clip/linkAudio': 'Link Audio',
  'clip/unlinkAudio': 'Unlink Audio',
  'clip/updateEffects': 'Update Effects',
  'clip/addEffect': 'Add Effect',
  'clip/removeEffect': 'Remove Effect',
  'clip/updateEffect': 'Update Effect',
  'clip/reorderEffects': 'Reorder Effects',
  'sequence/create': 'Create Sequence',
  'sequence/delete': 'Delete Sequence',
  'sequence/nest': 'Nest Clips',
  'version/save': 'Save Version',
  'version/restore': 'Restore Version',
  'version/delete': 'Delete Version'
};

export const pushHistory = (history, state, actionType) => {
  const entry = {
    snapshot: snapshot(state),
    label: ACTION_LABELS[actionType] ?? actionType ?? 'Edit'
  };
  const past = history.past.concat([entry]);
  while (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [] };
};

export const undo = (history, state) => {
  if (!history.past.length) return { history, state };
  const past = history.past.slice();
  const prev = past.pop();
  const current = {
    snapshot: snapshot(state),
    label: prev.label ?? 'Edit'
  };
  const future = [current, ...history.future].slice(0, HISTORY_LIMIT);
  // prev may be old-style (just a snapshot object) or new-style (entry with .snapshot)
  const restoredSnapshot = prev.snapshot ?? prev;
  return {
    history: { past, future },
    state: { ...state, ...restoredSnapshot }
  };
};

export const redo = (history, state) => {
  if (!history.future.length) return { history, state };
  const future = history.future.slice();
  const next = future.shift();
  const current = {
    snapshot: snapshot(state),
    label: next.label ?? 'Edit'
  };
  const past = history.past.concat([current]).slice(-HISTORY_LIMIT);
  const restoredSnapshot = next.snapshot ?? next;
  return {
    history: { past, future },
    state: { ...state, ...restoredSnapshot }
  };
};

export const emptyHistory = () => ({ past: [], future: [] });

/**
 * Get the label for the next undo/redo operation.
 * Useful for displaying "Undo Insert Clip" in the menu.
 */
export const undoLabel = (history) => {
  if (!history.past.length) return null;
  const last = history.past[history.past.length - 1];
  return last.label ?? 'Edit';
};

export const redoLabel = (history) => {
  if (!history.future.length) return null;
  return history.future[0].label ?? 'Edit';
};

/**
 * Group multiple sequential actions into a single undo step.
 * Call startGroup() before dispatching, endGroup() after.
 * All actions between start and end become one undo entry.
 */
let groupState = null;

export const startGroup = (history, state) => {
  if (!groupState) {
    groupState = { snapshot: snapshot(state), history: { ...history } };
  }
};

export const endGroup = (history, label) => {
  if (!groupState) return history;
  const entry = {
    snapshot: groupState.snapshot,
    label: label ?? 'Grouped Edit'
  };
  const past = history.past.concat([entry]);
  while (past.length > HISTORY_LIMIT) past.shift();
  groupState = null;
  return { past, future: [] };
};

export const cancelGroup = () => {
  groupState = null;
};

export const isGrouping = () => !!groupState;
