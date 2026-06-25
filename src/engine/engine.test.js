import { describe, it, expect } from 'vitest';
import { formatTC, toFrames, fromFrames } from './timecode.js';
import { analyze } from './analyzer.js';
import { resolveMotion, TEXT_MOTIONS } from './textMotion.js';
import { TRANSITIONS } from './transitions.js';
import { TITLE_PRESETS } from './titleCompositor.js';

describe('timecode', () => {
  it('formats zero', () => expect(formatTC(0)).toBe('00:00:00:00'));
  it('formats 1.5s at 30fps as 1s:15f', () => expect(formatTC(1.5)).toBe('00:00:01:15'));
  it('round-trips frames', () => {
    expect(toFrames(2)).toBe(60);
    expect(fromFrames(60)).toBeCloseTo(2, 5);
  });
  it('guards non-finite input', () => expect(formatTC(NaN)).toBe('00:00:00:00'));
});

describe('analyzer', () => {
  it('flags boring shots and same-source jump cuts', () => {
    const state = {
      analyzer: { boringSeconds: 6, jumpCutFrames: 8 },
      clips: [
        { id: 'a', trackId: 't1', mediaId: 'm', start: 0, end: 7 },    // boring (>= 6s)
        { id: 'b', trackId: 't1', mediaId: 'm', start: 7.1, end: 9 },  // jump cut (same media, ~3f gap)
        { id: 'c', trackId: 't1', mediaId: 'n', start: 9, end: 10 }    // different media
      ]
    };
    const { boring, jumpCuts } = analyze(state);
    expect(boring.map((b) => b.id)).toContain('a');
    expect(jumpCuts).toHaveLength(1);
    expect(jumpCuts[0].aId).toBe('a');
    expect(jumpCuts[0].bId).toBe('b');
  });
});

describe('textMotion', () => {
  it('exposes a "none" preset', () => {
    expect(TEXT_MOTIONS.find((m) => m.id === 'none')).toBeTruthy();
  });
  it('returns null when no motion is configured', () => {
    expect(resolveMotion({ in: 'none', out: 'none' }, 1, 4)).toBeNull();
    expect(resolveMotion(null, 1, 4)).toBeNull();
  });
  it('focus entry starts fully animated (alpha 0, heavy blur) at t=0', () => {
    const m = resolveMotion({ in: 'focus', inDuration: 1 }, 0, 4);
    expect(m).toBeTruthy();
    expect(m.alpha).toBeCloseTo(0, 5);
    expect(m.blur).toBeGreaterThan(0);
  });
  it('resolves to identity-ish well inside the clip', () => {
    const m = resolveMotion({ in: 'focus', inDuration: 0.5 }, 2, 4);
    expect(m.alpha).toBeGreaterThan(0.95); // focus eases to ~1 (slight overshoot, clamped at draw)
    expect(m.blur).toBeCloseTo(0, 2);
  });
});

describe('registries', () => {
  it('ships 13 transitions', () => expect(TRANSITIONS).toHaveLength(13));
  it('every title preset declares a kind', () => {
    expect(TITLE_PRESETS.every((p) => p.kind === 'static' || p.kind === 'kinetic')).toBe(true);
  });
  it('includes standard plain preset', () => {
    expect(TITLE_PRESETS.find((p) => p.id === 'plain')).toBeTruthy();
  });
});
