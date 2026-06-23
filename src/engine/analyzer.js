/**
 * Scans the timeline for "Boring Shots" (clips longer than `boringSeconds`)
 * and "Jump Cuts" (two adjacent clips on the same track from the same source
 * separated by fewer than `jumpCutFrames` frames).
 */

import { FPS } from '../state/initialState.js';

export function analyze(state) {
  const { clips, analyzer } = state;
  const boring = [];
  const jumpCuts = [];

  for (const c of clips) {
    const dur = c.end - c.start;
    if (dur >= analyzer.boringSeconds) {
      boring.push({ id: c.id, trackId: c.trackId, start: c.start, end: c.end, duration: dur });
    }
  }

  // Sort by track then by start; pairwise scan.
  const grouped = new Map();
  for (const c of clips) {
    if (!grouped.has(c.trackId)) grouped.set(c.trackId, []);
    grouped.get(c.trackId).push(c);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const gapFrames = Math.round((b.start - a.end) * FPS);
      if (gapFrames <= analyzer.jumpCutFrames && a.mediaId && a.mediaId === b.mediaId) {
        jumpCuts.push({
          aId: a.id,
          bId: b.id,
          trackId: a.trackId,
          gapFrames,
          at: a.end
        });
      }
    }
  }

  return { boring, jumpCuts };
}
