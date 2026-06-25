/**
 * CineCutPro — Multicam Editing Engine.
 *
 * Manages camera angle synchronization and live cut switching on the timeline.
 */


/**
 * Synchronize multiple clips using the specified sync method.
 *
 * @param {object[]} clips - Array of clip objects to synchronize
 * @param {string} method - 'start' | 'inPoint' | 'audio'
 * @returns {object[]} - Updated clips with synchronized start times and offsets
 */
export function alignClips(clips, method = 'start') {
  if (clips.length <= 1) return clips;

  const baseClip = clips[0];
  const aligned = [ { ...baseClip } ];

  for (let i = 1; i < clips.length; i++) {
    const clip = clips[i];
    let offset = 0;

    if (method === 'start') {
      // Align timeline start times (simplest sync)
      offset = baseClip.start - clip.start;
    } else if (method === 'inPoint') {
      // Sync by matching source in-points (e.g. clapboard sync)
      // We align the timeline start such that srcIn corresponds to the same timeline moment
      const baseMediaIn = baseClip.srcIn ?? 0;
      const clipMediaIn = clip.srcIn ?? 0;
      offset = (baseClip.start - baseMediaIn) - (clip.start - clipMediaIn);
    } else if (method === 'audio') {
      // Audio-waveform correlation sync (simulated offset for browser-only mock)
      offset = (Math.random() - 0.5) * 1.5; // Random minor offset to simulate matching peaks
    }

    aligned.push({
      ...clip,
      start: baseClip.start,
      srcIn: Math.max(0, (clip.srcIn ?? 0) - offset),
      end: baseClip.start + (clip.end - clip.start)
    });
  }

  return aligned;
}

/**
 * Switch camera angle at the active playhead.
 * Splits the active clip under the playhead and swaps the media source to the chosen camera angle.
 *
 * @param {object} state - Current editor state
 * @param {number} playhead - Timeline playhead time
 * @param {string} targetMediaId - Media ID of the target camera angle
 * @returns {object|null} - Action patch with updated clips list, or null if no active clip
 */
export function cutToAngle(state, playhead, targetMediaId) {
  // Find the track and clip under the playhead on the primary video track (usually the lowest video track index)
  const videoTracks = state.tracks.filter(t => t.kind === 'video' && !t.muted);
  if (!videoTracks.length) return null;
  
  // Cut on the first active video track
  const primaryTrack = videoTracks[0];
  const targetClip = state.clips.find(c => 
    c.trackId === primaryTrack.id && c.start < playhead && c.end > playhead
  );

  if (!targetClip) return null;

  // Split target clip at the playhead
  const speed = targetClip.speed ?? 1;
  const splitSrc = targetClip.srcIn + (playhead - targetClip.start) * speed;

  const leftClip = { ...targetClip, end: playhead, srcOut: splitSrc };
  
  // Find the target media item to get duration bounds
  const targetMedia = state.media.find(m => m.id === targetMediaId);
  if (!targetMedia) return null;

  // The new split segment switches to the target media ID
  const rightClip = {
    ...targetClip,
    id: `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    start: playhead,
    srcIn: splitSrc, // align sync point
    mediaId: targetMediaId,
    transitions: { in: null, out: targetClip.transitions?.out ?? null }
  };
  leftClip.transitions = { in: targetClip.transitions?.in ?? null, out: null };

  const nextClips = state.clips.map(c => {
    if (c.id === targetClip.id) return leftClip;
    return c;
  }).concat([rightClip]);

  return nextClips;
}
