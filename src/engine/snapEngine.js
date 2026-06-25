/**
 * CineCutPro — Snap Engine.
 *
 * Handles snap-to-grid, snap-to-clip-edge, snap-to-marker, and snap-to-playhead
 * logic for the timeline. Also provides magnetic timeline gap-closing.
 *
 * Usage:
 *   import { findSnap, closeGaps } from './snapEngine.js';
 *   const { snappedTime, snapTarget } = findSnap(proposedTime, state, options);
 */

const DEFAULT_SNAP_THRESHOLD_PX = 8;

/**
 * Compute all snap targets from the current state.
 * Returns an array of { time, label, kind } objects.
 */
export function getSnapTargets(state) {
  const targets = [];

  // Playhead
  targets.push({ time: state.playhead, label: 'Playhead', kind: 'playhead' });

  // In/Out points
  if (state.inPoint != null) {
    targets.push({ time: state.inPoint, label: 'In Point', kind: 'inout' });
  }
  if (state.outPoint != null) {
    targets.push({ time: state.outPoint, label: 'Out Point', kind: 'inout' });
  }

  // Markers
  for (const m of (state.markers ?? [])) {
    targets.push({ time: m.time, label: m.label || 'Marker', kind: 'marker' });
  }

  // Clip edges (start and end of every clip)
  for (const c of state.clips) {
    targets.push({ time: c.start, label: `Clip Start`, kind: 'clip', clipId: c.id });
    targets.push({ time: c.end, label: `Clip End`, kind: 'clip', clipId: c.id });
  }

  return targets;
}

/**
 * Find the nearest snap target for a proposed time.
 *
 * @param {number} proposedTime — the time the user is dragging/trimming to
 * @param {object} state — editor state
 * @param {object} options
 *   @param {number} options.pps — pixels per second (to compute threshold)
 *   @param {number} options.thresholdPx — snap threshold in pixels (default 8)
 *   @param {string[]} options.excludeClipIds — clip IDs to exclude from snap targets
 *   @param {boolean} options.snapEnabled — whether snapping is enabled (default true)
 * @returns {{ snappedTime: number, snapTarget: object|null }}
 */
export function findSnap(proposedTime, state, options = {}) {
  const {
    pps = 60,
    thresholdPx = DEFAULT_SNAP_THRESHOLD_PX,
    excludeClipIds = [],
    snapEnabled = true
  } = options;

  if (!snapEnabled || !state.snap) {
    return { snappedTime: proposedTime, snapTarget: null };
  }

  const threshold = thresholdPx / pps; // convert pixel threshold to seconds
  const targets = getSnapTargets(state);
  const excludeSet = new Set(excludeClipIds);

  let bestTarget = null;
  let bestDist = Infinity;

  for (const t of targets) {
    // Skip targets from excluded clips
    if (t.clipId && excludeSet.has(t.clipId)) continue;

    const dist = Math.abs(proposedTime - t.time);
    if (dist < threshold && dist < bestDist) {
      bestDist = dist;
      bestTarget = t;
    }
  }

  if (bestTarget) {
    return { snappedTime: bestTarget.time, snapTarget: bestTarget };
  }

  return { snappedTime: proposedTime, snapTarget: null };
}

/**
 * Close gaps on a track — slides clips left to fill any empty space.
 * Used by the magnetic timeline mode.
 *
 * @param {object[]} clips — all clips in state
 * @param {string} trackId — the track to close gaps on
 * @returns {object[]} — new clips array with gaps closed on the specified track
 */
export function closeGaps(clips, trackId) {
  const trackClips = clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);

  const otherClips = clips.filter((c) => c.trackId !== trackId);

  if (!trackClips.length) return clips;

  const adjusted = [];
  let cursor = 0;

  for (const c of trackClips) {
    const dur = c.end - c.start;
    if (c.start > cursor) {
      // There's a gap: slide this clip left
      adjusted.push({ ...c, start: cursor, end: cursor + dur });
    } else {
      // No gap or overlapping: keep as-is
      adjusted.push(c);
    }
    cursor = adjusted[adjusted.length - 1].end;
  }

  return otherClips.concat(adjusted);
}

/**
 * Insert a clip into a track at a specific time, pushing downstream clips right.
 * Used by magnetic timeline insert edit.
 *
 * @param {object[]} clips — all clips in state
 * @param {string} trackId — target track
 * @param {number} insertTime — where to insert
 * @param {number} insertDuration — duration of the inserted clip
 * @returns {object[]} — new clips array with downstream clips shifted
 */
export function rippleInsert(clips, trackId, insertTime, insertDuration) {
  return clips.map((c) => {
    if (c.trackId !== trackId) return c;
    if (c.start >= insertTime) {
      return { ...c, start: c.start + insertDuration, end: c.end + insertDuration };
    }
    return c;
  });
}

/**
 * Get the visual snap guide lines for rendering on the timeline.
 * Returns time positions where snap guides should appear.
 *
 * @param {number} currentDragTime — the time currently being snapped
 * @param {object} snapTarget — the snap target (from findSnap)
 * @returns {number[]} — array of times to draw vertical guide lines
 */
export function getSnapGuides(currentDragTime, snapTarget) {
  if (!snapTarget) return [];
  return [snapTarget.time];
}
