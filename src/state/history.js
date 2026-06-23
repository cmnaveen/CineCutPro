/**
 * Undo / redo stack.
 *
 * We keep a bounded ring of deep-cloned snapshots. Only the persistent slices
 * of state participate (project, media, tracks, clips, transitions, selection);
 * volatile UI bits (playhead, ui flags, source monitor) are excluded so trivial
 * scrubs do not litter history.
 */

export const HISTORY_LIMIT = 50;

const PERSISTENT_KEYS = [
  'project',
  'media',
  'tracks',
  'clips',
  'transitions',
  'inPoint',
  'outPoint',
  'selectedClipIds'
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

export const pushHistory = (history, state) => {
  const past = history.past.concat([snapshot(state)]);
  while (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [] };
};

export const undo = (history, state) => {
  if (!history.past.length) return { history, state };
  const past = history.past.slice();
  const prev = past.pop();
  const future = [snapshot(state), ...history.future].slice(0, HISTORY_LIMIT);
  return {
    history: { past, future },
    state: { ...state, ...prev }
  };
};

export const redo = (history, state) => {
  if (!history.future.length) return { history, state };
  const future = history.future.slice();
  const next = future.shift();
  const past = history.past.concat([snapshot(state)]).slice(-HISTORY_LIMIT);
  return {
    history: { past, future },
    state: { ...state, ...next }
  };
};

export const emptyHistory = () => ({ past: [], future: [] });
