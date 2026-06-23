import { useEffect } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { audioEngine } from '../engine/audioEngine.js';
import { FPS } from '../state/initialState.js';
import { downloadProject, pickProjectFile } from '../engine/projectIO.js';

const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
};

/**
 * Desktop shortcuts.
 *
 *   Transport:    Space / K play/pause | J reverse 1→2→4 | L forward 1→2→4 | Home → start | End → end
 *   Step:         ←/→ ±1 frame  Shift+←/→ ±10f  ⌥+←/→ jump to prev/next edit on selected track
 *   Marks:        I / [ mark in  O / ] mark out  Ctrl+/ clear marks
 *   Source→TL:    F9 ripple insert  F10 overwrite
 *   Timeline:     B blade  Del delete  Shift+Del ripple delete  Ctrl+D duplicate  S snap
 *   Zoom:         + / − (or Ctrl+wheel)
 *   Project:      Ctrl+S save  Ctrl+O open  Ctrl+Z undo  Ctrl+Y / Ctrl+Shift+Z redo  Ctrl+A select all
 *   UI:           ? shortcuts  Esc clear/close
 */
export function useKeyboard() {
  const { state, dispatch, undo, redo, selectedClips } = useEditor();

  useEffect(() => {
    const onKey = async (e) => {
      if (isTypingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key;
      const code = e.code;
      const shift = e.shiftKey;
      const alt = e.altKey;

      /* ── Undo / redo ───────────────────────────────────────── */
      if (meta && !shift && (k === 'z' || k === 'Z')) { e.preventDefault(); undo(); return; }
      if (meta && ((k === 'y' || k === 'Y') || (shift && (k === 'z' || k === 'Z')))) {
        e.preventDefault(); redo(); return;
      }

      /* ── Project ──────────────────────────────────────────── */
      if (meta && (k === 's' || k === 'S')) {
        e.preventDefault();
        downloadProject(state);
        dispatch({ type: 'toast/push', kind: 'success', message: 'Project saved' });
        return;
      }
      if (meta && (k === 'o' || k === 'O')) {
        e.preventDefault();
        try {
          const snap = await pickProjectFile();
          dispatch({ type: 'project/loadAll', snapshot: snap });
          dispatch({ type: 'toast/push', kind: 'success', message: 'Project loaded' });
        } catch (err) {
          if (err?.message !== 'cancelled') {
            dispatch({ type: 'toast/push', kind: 'error', message: `Load failed: ${err.message}` });
          }
        }
        return;
      }

      /* ── Selection ────────────────────────────────────────── */
      if (meta && (k === 'a' || k === 'A')) {
        e.preventDefault();
        dispatch({ type: 'select/clips', ids: state.clips.map((c) => c.id) });
        return;
      }
      if (k === 'Escape') {
        if (state.ui.contextMenu) { dispatch({ type: 'ui/closeContextMenu' }); return; }
        if (state.ui.shortcutsOpen) { dispatch({ type: 'ui/set', key: 'shortcutsOpen', value: false }); return; }
        if (state.ui.exportOpen)    { dispatch({ type: 'ui/set', key: 'exportOpen',    value: false }); return; }
        if (state.ui.trimEditorOpen){ dispatch({ type: 'ui/set', key: 'trimEditorOpen', value: false }); return; }
        if (state.ui.welcomeOpen)   { dispatch({ type: 'ui/set', key: 'welcomeOpen',   value: false }); return; }
        dispatch({ type: 'select/clips', ids: [] });
        return;
      }

      /* ── Transport ────────────────────────────────────────── */
      if (code === 'Space' || k === 'k' || k === 'K') {
        e.preventDefault(); audioEngine.resume();
        dispatch({ type: 'playback/togglePlay' });
        return;
      }
      if (k === 'l' || k === 'L') {
        e.preventDefault(); audioEngine.resume();
        dispatch({ type: 'playback/jklForward' }); return;
      }
      if (k === 'j' || k === 'J') {
        e.preventDefault(); audioEngine.resume();
        dispatch({ type: 'playback/jklReverse' }); return;
      }
      if (k === 'Home') {
        e.preventDefault();
        dispatch({ type: 'playback/setPlayhead', t: 0 }); return;
      }
      if (k === 'End') {
        e.preventDefault();
        const end = Math.max(0, ...state.clips.map((c) => c.end));
        dispatch({ type: 'playback/setPlayhead', t: end }); return;
      }

      /* ── Frame step ───────────────────────────────────────── */
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        const dir = k === 'ArrowLeft' ? -1 : 1;
        if (alt) {
          // Jump to prev/next clip edge across the timeline.
          const edges = state.clips
            .flatMap((c) => [c.start, c.end])
            .sort((a, b) => a - b);
          const cur = state.playhead;
          const next = dir > 0 ? edges.find((x) => x > cur + 1e-3) : [...edges].reverse().find((x) => x < cur - 1e-3);
          if (next != null) dispatch({ type: 'playback/setPlayhead', t: next });
        } else {
          const step = (shift ? 10 : 1) / FPS;
          dispatch({ type: 'playback/setPlayhead', t: Math.max(0, state.playhead + dir * step) });
        }
        return;
      }

      /* ── Marks ────────────────────────────────────────────── */
      if (k === 'i' || k === 'I' || k === '[') { e.preventDefault(); dispatch({ type: 'playback/markIn' });  return; }
      if (k === 'o' || k === 'O' || k === ']') { e.preventDefault(); dispatch({ type: 'playback/markOut' }); return; }
      if (meta && (k === '/' || k === '?'))    { e.preventDefault(); dispatch({ type: 'playback/clearMarks' }); return; }

      /* ── Source → Timeline ────────────────────────────────── */
      if (code === 'F9')  { e.preventDefault(); insertFromSource(state, dispatch, { ripple: true });  return; }
      if (code === 'F10') { e.preventDefault(); insertFromSource(state, dispatch, { ripple: false }); return; }

      /* ── Timeline ops ─────────────────────────────────────── */
      if (k === 'b' || k === 'B') {
        e.preventDefault(); dispatch({ type: 'clip/blade' });
        dispatch({ type: 'toast/push', kind: 'info', message: 'Bladed at playhead' });
        return;
      }
      if (k === 'Delete' || k === 'Backspace') {
        if (!selectedClips.length) return;
        e.preventDefault();
        const n = selectedClips.length;
        dispatch({ type: 'clip/delete', ripple: shift });
        dispatch({
          type: 'toast/push',
          kind: 'info',
          message: shift ? `Ripple-deleted ${n} clip${n > 1 ? 's' : ''}` : `Deleted ${n} clip${n > 1 ? 's' : ''}`
        });
        return;
      }
      if (meta && (k === 'd' || k === 'D')) {
        e.preventDefault();
        dispatch({ type: 'clip/duplicate' });
        return;
      }

      /* ── Zoom ─────────────────────────────────────────────── */
      if (k === '=' || k === '+') { e.preventDefault(); dispatch({ type: 'playback/setZoom', pps: Math.min(600, state.pixelsPerSecond * 1.25) }); return; }
      if (k === '-' || k === '_') { e.preventDefault(); dispatch({ type: 'playback/setZoom', pps: Math.max(6,   state.pixelsPerSecond / 1.25) }); return; }

      /* ── Misc ─────────────────────────────────────────────── */
      if (k === '?') { e.preventDefault(); dispatch({ type: 'ui/toggle', key: 'shortcutsOpen' }); return; }
      if (k === '\\') {
        e.preventDefault();
        dispatch({
          type: 'ui/set',
          key: 'monitorMode',
          value: state.ui.monitorMode === 'dual' ? 'single' : 'dual'
        });
        return;
      }
      if (k === 's' || k === 'S') { if (!meta) dispatch({ type: 'playback/toggleSnap' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, dispatch, undo, redo, selectedClips]);
}

function insertFromSource(state, dispatch, { ripple }) {
  const { source } = state;
  if (!source.mediaId) return;
  const media = state.media.find((m) => m.id === source.mediaId);
  if (!media) return;
  const srcIn = source.inPoint ?? 0;
  const srcOut = source.outPoint ?? media.duration ?? 4;
  const targetTrack =
    state.tracks.find((t) => t.kind === (media.kind === 'audio' ? 'audio' : 'video')) ??
    state.tracks[0];
  dispatch({
    type: 'clip/insertFromMedia',
    mediaId: media.id,
    trackId: targetTrack.id,
    start: state.playhead,
    srcIn,
    srcOut,
    ripple
  });
  dispatch({
    type: 'toast/push',
    kind: 'success',
    message: ripple ? `Inserted (ripple): ${media.name}` : `Overwrote: ${media.name}`
  });
}
