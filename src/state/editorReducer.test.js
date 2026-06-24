import { describe, it, expect } from 'vitest';
import { reducer, HISTORY_ACTIONS } from './editorReducer.js';
import { initialState } from './initialState.js';
import { emptyHistory, pushHistory, undo, redo } from './history.js';

const videoTrack = (s) => s.tracks.find((t) => t.kind === 'video').id;
const withMedia = () =>
  reducer(initialState, {
    type: 'media/add',
    items: [{ id: 'm1', name: 'a.mp4', kind: 'video', src: 'x', duration: 10 }]
  });
const withClip = (start = 0) => {
  let s = withMedia();
  s = reducer(s, { type: 'clip/insertFromMedia', mediaId: 'm1', trackId: videoTrack(s), start });
  return s;
};

describe('project', () => {
  it('project/update merges and marks dirty', () => {
    const s = reducer(initialState, { type: 'project/update', patch: { fps: 60, width: 1280, height: 720 } });
    expect(s.project.fps).toBe(60);
    expect(s.project.width).toBe(1280);
    expect(s.project.dirty).toBe(true);
  });
});

describe('media', () => {
  it('media/add keeps a provided id; media/update patches src', () => {
    let s = withMedia();
    expect(s.media[0].id).toBe('m1');
    s = reducer(s, { type: 'media/update', id: 'm1', patch: { src: 'blob:new' } });
    expect(s.media[0].src).toBe('blob:new');
  });
});

describe('playback clock', () => {
  it('setPlayhead bumps seekId; tickPlayhead does not', () => {
    const a = reducer(initialState, { type: 'playback/setPlayhead', t: 5 });
    expect(a.playhead).toBe(5);
    expect(a.seekId).toBe(initialState.seekId + 1);
    const b = reducer(a, { type: 'playback/tickPlayhead', t: 6 });
    expect(b.playhead).toBe(6);
    expect(b.seekId).toBe(a.seekId);
  });
  it('setPlayhead clamps negative time to 0', () => {
    expect(reducer(initialState, { type: 'playback/setPlayhead', t: -3 }).playhead).toBe(0);
  });
});

describe('clips', () => {
  it('insertFromMedia creates a clip with the full source range', () => {
    const s = withClip(2);
    expect(s.clips).toHaveLength(1);
    expect(s.clips[0].start).toBeCloseTo(2, 5);
    expect(s.clips[0].end - s.clips[0].start).toBeCloseTo(10, 5);
  });

  it('move clamps to >= 0', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    s = reducer(s, { type: 'clip/move', id, start: -5 });
    expect(s.clips[0].start).toBe(0);
  });

  it('setSpeed scales timeline span while preserving source length', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    const srcLen = s.clips[0].srcOut - s.clips[0].srcIn;
    s = reducer(s, { type: 'clip/setSpeed', id, speed: 2 });
    expect(s.clips[0].speed).toBe(2);
    expect(s.clips[0].end - s.clips[0].start).toBeCloseTo(srcLen / 2, 4);
  });

  it('setSpeed clamps to [0.25, 4]', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    expect(reducer(s, { type: 'clip/setSpeed', id, speed: 99 }).clips[0].speed).toBe(4);
    expect(reducer(s, { type: 'clip/setSpeed', id, speed: 0.01 }).clips[0].speed).toBe(0.25);
  });

  it('moveSelection is idempotent (anchor-based)', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    s = reducer(s, { type: 'select/clips', ids: [id] });
    const s1 = reducer(s, { type: 'clip/moveSelection', ids: [id], anchorId: id, start: 5 });
    expect(s1.clips[0].start).toBeCloseTo(5, 5);
    const s2 = reducer(s1, { type: 'clip/moveSelection', ids: [id], anchorId: id, start: 5 });
    expect(s2).toBe(s1); // second move resolves to a no-op
  });

  it('keyframe add / update easing / remove', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    s = reducer(s, { type: 'clip/addKeyframe', id, channel: 'opacity', time: 1, value: 0.5 });
    expect(s.clips[0].keyframes).toHaveLength(1);
    s = reducer(s, { type: 'clip/updateKeyframe', id, index: 0, patch: { easing: 'easeInOut' } });
    expect(s.clips[0].keyframes[0].easing).toBe('easeInOut');
    s = reducer(s, { type: 'clip/removeKeyframe', id, index: 0 });
    expect(s.clips[0].keyframes).toHaveLength(0);
  });
});

describe('transitions', () => {
  it('apply sets kind + duration; clear removes', () => {
    let s = withClip(0);
    const id = s.clips[0].id;
    s = reducer(s, { type: 'transition/apply', clipId: id, side: 'in', kind: 'crossDissolve', duration: 0.8 });
    expect(s.clips[0].transitions.in).toEqual({ kind: 'crossDissolve', duration: 0.8 });
    s = reducer(s, { type: 'transition/clear', clipId: id, side: 'in' });
    expect(s.clips[0].transitions.in).toBeNull();
  });
});

describe('HISTORY_ACTIONS membership', () => {
  it('records the new undoable actions but not volatile ones', () => {
    for (const a of ['project/update', 'clip/moveSelection', 'clip/setSpeed', 'clip/removeKeyframe', 'clip/updateKeyframe']) {
      expect(HISTORY_ACTIONS.has(a)).toBe(true);
    }
    expect(HISTORY_ACTIONS.has('media/update')).toBe(false);
    expect(HISTORY_ACTIONS.has('playback/tickPlayhead')).toBe(false);
  });
});

describe('history stack', () => {
  it('undo restores the prior persistent slices; redo re-applies', () => {
    const s0 = { ...initialState, clips: [] };
    const s1 = { ...initialState, clips: [{ id: 'x', start: 0, end: 1 }] };
    let h = emptyHistory();
    h = pushHistory(h, s0); // record s0 before transitioning to s1
    const u = undo(h, s1);
    expect(u.state.clips).toEqual([]);
    const r = redo(u.history, u.state);
    expect(r.state.clips).toEqual(s1.clips);
  });
});
