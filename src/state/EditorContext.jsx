import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { initialState, FPS } from './initialState.js';
import { reducer as baseReducer, HISTORY_ACTIONS } from './editorReducer.js';
import { emptyHistory, pushHistory, undo as undoFn, redo as redoFn, undoLabel, redoLabel } from './history.js';
import { readAutosave, writeAutosave } from '../engine/projectIO.js';
import { getMedia } from '../engine/mediaStore.js';
import { migrate, needsMigration } from '../engine/migrator.js';

const EditorContext = createContext(null);

export const useEditor = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within <EditorProvider>');
  return ctx;
};

/** Wrapped reducer that knows how to swap state wholesale (used by undo/redo). */
function reducer(state, action) {
  if (action.type === '__replace__') return action.state;
  return baseReducer(state, action);
}

export function EditorProvider({ children }) {
  const [state, baseDispatch] = useReducer(reducer, initialState, (init) => {
    const snap = readAutosave();
    if (snap) {
      // Apply migration if needed
      const migrated = needsMigration(snap) ? migrate(snap) : snap;
      return { ...init, ...migrated };
    }
    return init;
  });
  const historyRef = useRef(emptyHistory());
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action) => {
    if (HISTORY_ACTIONS.has(action.type)) {
      // Reducer is pure: a dry-run lets us skip history when the action no-ops.
      const next = baseReducer(stateRef.current, action);
      if (next !== stateRef.current) {
        historyRef.current = pushHistory(historyRef.current, stateRef.current, action.type);
      }
    }
    baseDispatch(action);
  }, []);

  const undo = useCallback(() => {
    const { history, state: next } = undoFn(historyRef.current, stateRef.current);
    if (next !== stateRef.current) {
      historyRef.current = history;
      baseDispatch({ type: '__replace__', state: next });
    }
  }, []);

  const redo = useCallback(() => {
    const { history, state: next } = redoFn(historyRef.current, stateRef.current);
    if (next !== stateRef.current) {
      historyRef.current = history;
      baseDispatch({ type: '__replace__', state: next });
    }
  }, []);

  // Rehydrate IndexedDB-backed media: blob: src dies on reload, so refetch the
  // stored file and mint a fresh object URL for any persistent item missing one.
  const needsRehydrate = state.media
    .filter((m) => m.persistent && !m.src)
    .map((m) => m.id)
    .join(',');
  useEffect(() => {
    if (!needsRehydrate) return;
    let cancelled = false;
    (async () => {
      for (const id of needsRehydrate.split(',')) {
        const blob = await getMedia(id);
        if (blob && !cancelled) {
          dispatch({ type: 'media/update', id, patch: { src: URL.createObjectURL(blob) } });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [needsRehydrate, dispatch]);

  // Debounced autosave of the persistent project slices.
  useEffect(() => {
    const id = setTimeout(() => writeAutosave(stateRef.current), 800);
    return () => clearTimeout(id);
  }, [state.project, state.media, state.tracks, state.clips, state.transitions, state.inPoint, state.outPoint, state.master, state.analyzer, state.markers, state.sequences, state.groups]);

  const selectedClips = useMemo(
    () => state.clips.filter((c) => state.selectedClipIds.includes(c.id)),
    [state.clips, state.selectedClipIds]
  );

  const duration = useMemo(() => {
    if (!state.clips.length) return 60;
    return Math.max(60, ...state.clips.map((c) => c.end)) + 4;
  }, [state.clips]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      undo,
      redo,
      selectedClips,
      duration,
      fps: FPS,
      historyDepth: historyRef.current.past.length,
      undoLabel: undoLabel(historyRef.current),
      redoLabel: redoLabel(historyRef.current)
    }),
    // historyDepth is intentionally not tracked precisely: it is informational.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, dispatch, undo, redo, selectedClips, duration]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

