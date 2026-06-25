/**
 * Equivalence proof: the 'patch' history backend produces identical undo/redo
 * to the proven 'snapshot' backend across a diverse, real action sequence.
 * This is the safety net that justifies defaulting EditorContext to 'patch'.
 */
import { describe, it, expect } from 'vitest';
import { reducer } from './editorReducer.js';
import { initialState } from './initialState.js';
import { snapshot } from './history.js';
import { createHistoryController } from './historyController.js';

const vTrack = (s) => s.tracks.find((t) => t.kind === 'video').id;
const m1 = { id: 'm1', name: 'a.mp4', kind: 'video', src: 'x', duration: 10 };
const m2 = { id: 'm2', name: 'b.mp4', kind: 'video', src: 'y', duration: 8 };

// Each op resolves to a real action given the live state (so ids are valid).
const ops = [
  () => ({ type: 'media/add', items: [m1] }),
  () => ({ type: 'media/add', items: [m2] }),
  (s) => ({ type: 'clip/insertFromMedia', mediaId: 'm1', trackId: vTrack(s), start: 0 }),
  (s) => ({ type: 'clip/insertFromMedia', mediaId: 'm2', trackId: vTrack(s), start: 6 }),
  (s) => ({ type: 'clip/move', id: s.clips[0].id, start: 2 }),
  (s) => ({ type: 'clip/setSpeed', id: s.clips[0].id, speed: 2 }),
  (s) => ({ type: 'clip/updateTransform', id: s.clips[0].id, patch: { scale: 1.5, x: 40 } }),
  (s) => ({ type: 'clip/addKeyframe', id: s.clips[0].id, channel: 'opacity', time: 1, value: 0.5 }),
  (s) => ({ type: 'clip/addKeyframe', id: s.clips[0].id, channel: 'scale', time: 2, value: 1.2 }),
  (s) => ({ type: 'clip/updateKeyframe', id: s.clips[0].id, index: 0, patch: { easing: 'easeInOut' } }),
  (s) => ({ type: 'transition/apply', clipId: s.clips[1].id, side: 'in', kind: 'crossDissolve', duration: 0.8 }),
  () => ({ type: 'project/update', patch: { name: 'Cut', fps: 60, width: 1280, height: 720 } }),
  () => ({ type: 'track/add', kind: 'audio', name: 'A2' }),
  (s) => ({ type: 'clip/duplicate', ids: [s.clips[0].id] }),
  (s) => ({ type: 'clip/removeKeyframe', id: s.clips[0].id, index: 1 }),
  (s) => ({ type: 'clip/delete', ids: [s.clips[s.clips.length - 1].id] }),
];

function runBoth() {
  const snap = createHistoryController('snapshot');
  const patch = createHistoryController('patch');
  let state = initialState;
  let recorded = 0;
  for (const op of ops) {
    const action = op(state);
    const next = reducer(state, action);
    if (next !== state) {
      snap.record(state, next, action.type);
      patch.record(state, next, action.type);
      recorded++;
    }
    state = next;
  }
  return { snap, patch, finalState: state, recorded };
}

describe('history backends are equivalent', () => {
  it('records the same number of undoable steps', () => {
    const { snap, patch, recorded } = runBoth();
    expect(recorded).toBeGreaterThan(10); // the sequence really exercised the reducer
    expect(snap.depth()).toBe(recorded);
    expect(patch.depth()).toBe(recorded);
  });

  it('undo walks both backends to identical persistent states at every step', () => {
    const { snap, patch, finalState } = runBoth();
    let sa = finalState;
    let pa = finalState;
    while (snap.canUndo()) {
      expect(patch.canUndo()).toBe(true);
      sa = snap.undo(sa);
      pa = patch.undo(pa);
      expect(snapshot(pa)).toEqual(snapshot(sa));
      expect(patch.undoLabel()).toBe(snap.undoLabel());
    }
    expect(patch.canUndo()).toBe(false);
  });

  it('redo walks both backends back to identical persistent states', () => {
    const { snap, patch, finalState } = runBoth();
    // wind all the way back first
    let sa = finalState;
    let pa = finalState;
    while (snap.canUndo()) {
      sa = snap.undo(sa);
      pa = patch.undo(pa);
    }
    // now redo forward
    while (snap.canRedo()) {
      expect(patch.canRedo()).toBe(true);
      sa = snap.redo(sa);
      pa = patch.redo(pa);
      expect(snapshot(pa)).toEqual(snapshot(sa));
    }
    expect(patch.canRedo()).toBe(false);
  });

  it('the patch backend reproduces the original final state after a full undo/redo cycle', () => {
    const { patch, finalState } = runBoth();
    const before = snapshot(finalState);
    let cur = finalState;
    while (patch.canUndo()) cur = patch.undo(cur);
    while (patch.canRedo()) cur = patch.redo(cur);
    expect(snapshot(cur)).toEqual(before);
  });
});
