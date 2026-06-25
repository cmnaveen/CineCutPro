import { describe, it, expect } from 'vitest';
import { diff, invert, apply, deepEqual, type Patch } from './patch';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Round-trip invariant helper: apply(redo) === b, apply(undo)(b) === a. */
function roundTrip(a: unknown, b: unknown) {
  const redo = diff(a, b);
  const undo = invert(redo);
  expect(apply(clone(a), redo)).toEqual(b);
  expect(apply(clone(b), undo)).toEqual(a);
  return redo;
}

describe('deepEqual', () => {
  it('compares primitives, arrays, objects, null', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
  });
});

describe('diff / invert / apply', () => {
  it('returns an empty patch for equal values', () => {
    expect(diff({ a: 1 }, { a: 1 })).toEqual([]);
    expect(diff([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it('replaces a scalar leaf and inverts', () => {
    const p = roundTrip({ a: 1, b: 2 }, { a: 1, b: 9 });
    expect(p).toEqual([{ op: 'replace', path: ['b'], value: 9, old: 2 }]);
  });

  it('adds and removes object keys', () => {
    roundTrip({ a: 1 }, { a: 1, b: 2 });
    roundTrip({ a: 1, b: 2 }, { a: 1 });
  });

  it('handles nested objects with structural sharing', () => {
    const a = { x: { y: { z: 1 } }, keep: { same: true } };
    const b = { x: { y: { z: 2 } }, keep: { same: true } };
    const redo = diff(a, b);
    const out = apply(a, redo) as typeof a;
    expect(out.x.y.z).toBe(2);
    expect(out).not.toBe(a); // new root
    expect(out.keep).toBe(a.keep); // untouched subtree shared
  });

  it('grows and shrinks arrays (tail add/remove)', () => {
    roundTrip([1, 2], [1, 2, 3, 4]);
    roundTrip([1, 2, 3, 4], [1, 2]);
    roundTrip([1, 2, 3], [1, 9, 3]);
  });

  it('diffs arrays of objects (clip-like)', () => {
    const a = [{ id: 'c1', start: 0 }, { id: 'c2', start: 30 }];
    const b = [{ id: 'c1', start: 5 }, { id: 'c2', start: 30 }, { id: 'c3', start: 60 }];
    roundTrip(a, b);
  });

  it('replaces the whole value on a type change at root', () => {
    roundTrip({ a: 1 }, [1, 2, 3]);
    roundTrip([1, 2], { a: 1 });
  });

  it('does not mutate the target on apply', () => {
    const a = { list: [{ n: 1 }] };
    const b = { list: [{ n: 2 }] };
    const redo = diff(a, b);
    const frozen = clone(a);
    apply(a, redo);
    expect(a).toEqual(frozen);
  });

  it('produces patches sized to the change, not the document', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 500; i++) big[`k${i}`] = i;
    const next = { ...big, k250: 9999 };
    const p: Patch = diff(big, next);
    expect(p).toHaveLength(1); // O(change), not O(500)
  });
});
