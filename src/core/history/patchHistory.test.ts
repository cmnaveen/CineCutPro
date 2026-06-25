import { describe, it, expect } from 'vitest';
import { PatchHistory } from './patchHistory';

describe('PatchHistory', () => {
  it('records, undoes and redoes a single change', () => {
    const h = new PatchHistory();
    const s0 = { count: 0 };
    const s1 = { count: 1 };
    expect(h.record(s0, s1, { label: 'Inc' })).toBe(true);
    expect(h.canUndo).toBe(true);
    expect(h.undoLabel()).toBe('Inc');

    const back = h.undo(s1);
    expect(back).toEqual(s0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);

    const fwd = h.redo(back);
    expect(fwd).toEqual(s1);
  });

  it('ignores no-op records', () => {
    const h = new PatchHistory();
    expect(h.record({ a: 1 }, { a: 1 })).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('clears the redo stack on a new record', () => {
    const h = new PatchHistory();
    h.record({ n: 0 }, { n: 1 }, { label: 'a' });
    h.undo({ n: 1 });
    expect(h.canRedo).toBe(true);
    h.record({ n: 0 }, { n: 5 }, { label: 'b' });
    expect(h.canRedo).toBe(false);
  });

  it('walks a multi-step stack back to origin', () => {
    const h = new PatchHistory();
    const states = [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }];
    for (let i = 1; i < states.length; i++) h.record(states[i - 1], states[i], { label: `s${i}` });
    let cur: { n: number } = states[3];
    cur = h.undo(cur);
    cur = h.undo(cur);
    cur = h.undo(cur);
    expect(cur).toEqual({ n: 0 });
    expect(h.canUndo).toBe(false);
  });

  it('enforces the history limit', () => {
    const h = new PatchHistory(3);
    for (let i = 0; i < 6; i++) h.record({ n: i }, { n: i + 1 }, { label: `${i}` });
    expect(h.past.length).toBe(3);
  });

  it('coalesces same-key edits within the window into one undo step', () => {
    const h = new PatchHistory();
    const key = 'drag-clip-1';
    h.record({ x: 0 }, { x: 1 }, { label: 'Move', coalesceKey: key, time: 1000 });
    h.record({ x: 1 }, { x: 2 }, { label: 'Move', coalesceKey: key, time: 1100 });
    h.record({ x: 2 }, { x: 3 }, { label: 'Move', coalesceKey: key, time: 1200 });
    expect(h.past.length).toBe(1); // one gesture, one entry

    const reverted = h.undo({ x: 3 });
    expect(reverted).toEqual({ x: 0 }); // reverts the whole gesture
  });

  it('does not coalesce once the time window lapses', () => {
    const h = new PatchHistory();
    const key = 'drag';
    h.record({ x: 0 }, { x: 1 }, { coalesceKey: key, time: 0, coalesceMs: 500 });
    h.record({ x: 1 }, { x: 2 }, { coalesceKey: key, time: 9999, coalesceMs: 500 });
    expect(h.past.length).toBe(2);
  });

  it('does not coalesce across different keys', () => {
    const h = new PatchHistory();
    h.record({ x: 0 }, { x: 1 }, { coalesceKey: 'a', time: 0 });
    h.record({ x: 1 }, { x: 2 }, { coalesceKey: 'b', time: 10 });
    expect(h.past.length).toBe(2);
  });
});
