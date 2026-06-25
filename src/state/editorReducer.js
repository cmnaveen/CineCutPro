/**
 * CineCutPro reducer.
 *
 * Action conventions:
 *   - Mutating actions (anything that the user would expect to undo) must be
 *     pushed onto the history stack by the dispatcher in EditorContext.
 *   - Volatile actions (playhead/transport/UI flags) skip history.
 *
 * Most logic lives here so components stay thin.
 */

import { TRACK_KINDS, FPS } from './initialState.js';

const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const snapValue = (t, snap, pps) => {
  if (!snap) return t;
  // Snap to 1 frame
  const frame = 1 / FPS;
  return Math.round(t / frame) * frame;
};

// ---------- Collision helpers ----------
const overlaps = (a, b) =>
  a.trackId === b.trackId && a.id !== b.id && a.start < b.end && b.start < a.end;

const isOverlapping = (clips, clip) => clips.some((c) => overlaps(c, clip));

const tryPlaceClip = (clips, target) => {
  // Sweep forward until the clip fits without collision.
  let candidate = { ...target };
  let safety = 200;
  while (safety-- > 0) {
    const conflict = clips.find((c) => overlaps(c, candidate));
    if (!conflict) return candidate;
    const shift = conflict.end - candidate.start + 0.001;
    candidate = { ...candidate, start: candidate.start + shift, end: candidate.end + shift };
  }
  return candidate;
};

const packTrackMagnetic = (clips, trackId) => {
  const trackClips = clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
  if (!trackClips.length) return clips;
  const otherClips = clips.filter((c) => c.trackId !== trackId);
  const adjusted = [];
  let cursor = 0;
  for (const c of trackClips) {
    const dur = c.end - c.start;
    adjusted.push({ ...c, start: cursor, end: cursor + dur });
    cursor += dur;
  }
  return otherClips.concat(adjusted);
};

// ---------- Default clip shape ----------
const defaultTransform = () => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  crop: { top: 0, right: 0, bottom: 0, left: 0 }
});

const defaultFilters = () => ({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hueRotate: 0,
  vignette: 0,
  chromaKey: { enabled: false, color: '#00ff00', tolerance: 0.35, softness: 0.1 }
});

const defaultAudio = () => ({ volume: 1, pan: 0, muted: false, solo: false });

const makeClip = ({ trackId, mediaId, start, duration, srcIn = 0, kind = 'video', title }) => ({
  id: uid('clip'),
  trackId,
  mediaId: mediaId ?? null,
  kind,
  start,
  end: start + duration,
  srcIn,
  srcOut: srcIn + duration,
  speed: 1,
  transform: defaultTransform(),
  filters: defaultFilters(),
  audio: defaultAudio(),
  keyframes: [],
  transitions: { in: null, out: null },
  title: title ?? null
});

// ---------- Reducer ----------
export function reducer(state, action) {
  switch (action.type) {
    /* ===== Project ===== */
    case 'project/rename':
      return { ...state, project: { ...state.project, name: action.name, dirty: true } };
    case 'project/markClean':
      return { ...state, project: { ...state.project, dirty: false } };
    case 'project/markDirty':
      return { ...state, project: { ...state.project, dirty: true } };
    case 'project/update':
      return { ...state, project: { ...state.project, ...action.patch, dirty: true } };

    /* ===== Media bin ===== */
    case 'media/add': {
      const next = action.items.map((m) => ({ id: uid('med'), ...m }));
      return { ...state, media: state.media.concat(next) };
    }
    case 'media/remove':
      return {
        ...state,
        media: state.media.filter((m) => m.id !== action.id),
        clips: state.clips.filter((c) => c.mediaId !== action.id)
      };
    case 'media/addSubclip': {
      const parent = state.media.find((m) => m.id === action.id);
      if (!parent) return state;
      const sub = {
        ...parent,
        id: uid('med'),
        name: `${parent.name} • subclip`,
        srcIn: action.inPoint,
        srcOut: action.outPoint,
        duration: Math.max(0.05, (action.outPoint ?? parent.duration) - (action.inPoint ?? 0)),
        isSubclip: true,
        parentId: parent.id
      };
      return { ...state, media: state.media.concat([sub]) };
    }
    case 'media/update':
      // Non-undoable: used to (re)attach blob src after IndexedDB rehydration.
      return { ...state, media: state.media.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) };

    /* ===== Source monitor ===== */
    case 'source/load':
      return { ...state, source: { ...state.source, mediaId: action.id, playhead: 0, playing: false, inPoint: null, outPoint: null } };
    case 'source/setPlayhead':
      return { ...state, source: { ...state.source, playhead: Math.max(0, action.t) } };
    case 'source/togglePlay':
      return { ...state, source: { ...state.source, playing: !state.source.playing } };
    case 'source/markIn':
      return { ...state, source: { ...state.source, inPoint: state.source.playhead } };
    case 'source/markOut':
      return { ...state, source: { ...state.source, outPoint: state.source.playhead } };
    case 'source/clearMarks':
      return { ...state, source: { ...state.source, inPoint: null, outPoint: null } };

    /* ===== Tracks ===== */
    case 'track/add': {
      const id = `trk_${state.tracks.length + 1}_${Date.now().toString(36)}`;
      const tr = {
        id,
        kind: action.kind,
        name: action.name ?? action.kind,
        height: action.kind === TRACK_KINDS.AUDIO ? 64 : 78,
        muted: false,
        solo: false,
        locked: false,
        visible: true,
        volume: 1,
        pan: 0,
        color: action.color ?? '#5b8def'
      };
      return { ...state, tracks: state.tracks.concat([tr]) };
    }
    case 'track/update':
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
      };
    case 'track/remove':
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== action.id),
        clips: state.clips.filter((c) => c.trackId !== action.id)
      };

    /* ===== Clips ===== */
    case 'clip/insertFromMedia': {
      const media = state.media.find((m) => m.id === action.mediaId);
      if (!media) return state;
      const track = state.tracks.find((t) => t.id === action.trackId);
      if (!track) return state;
      const srcIn = action.srcIn ?? media.srcIn ?? 0;
      const srcOut = action.srcOut ?? media.srcOut ?? media.duration ?? 4;
      const dur = Math.max(0.1, srcOut - srcIn);
      const start = snapValue(action.start ?? state.playhead, state.snap, state.pixelsPerSecond);
      const candidate = makeClip({
        trackId: track.id,
        mediaId: media.id,
        kind: media.kind === 'audio' ? 'audio' : 'video',
        start,
        duration: dur,
        srcIn
      });
      let nextClips;
      if (state.ui.timelineMode === 'magnetic') {
        nextClips = packTrackMagnetic(state.clips.concat([candidate]), track.id);
      } else {
        const placed = action.ripple
          ? candidate
          : tryPlaceClip(state.clips.filter((c) => c.trackId === track.id), candidate);
        nextClips = state.clips.concat([placed]);
      }
      const added = nextClips.find(c => c.mediaId === media.id && c.trackId === track.id && Math.abs(c.srcIn - srcIn) < 0.001) ?? candidate;
      return { ...state, clips: nextClips, selectedClipIds: [added.id] };
    }

    case 'clip/insertTitle': {
      const track = state.tracks.find((t) => t.id === action.trackId);
      if (!track) return state;
      const start = snapValue(action.start ?? state.playhead, state.snap, state.pixelsPerSecond);
      const candidate = makeClip({
        trackId: track.id,
        mediaId: null,
        kind: 'title',
        start,
        duration: action.duration ?? 4,
        title: action.title ?? {
          text: 'CineCutPro',
          preset: 'glass',
          font: 'Inter',
          weight: 800,
          size: 96,
          align: 'center',
          color: '#ffffff'
        }
      });
      let nextClips;
      if (state.ui.timelineMode === 'magnetic') {
        nextClips = packTrackMagnetic(state.clips.concat([candidate]), track.id);
      } else {
        const placed = tryPlaceClip(state.clips.filter((c) => c.trackId === track.id), candidate);
        nextClips = state.clips.concat([placed]);
      }
      const added = nextClips.find(c => c.kind === 'title' && c.trackId === track.id && Math.abs(c.start - start) < 0.5) ?? candidate;
      return { ...state, clips: nextClips, selectedClipIds: [added.id] };
    }

    case 'clip/move': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const newStart = Math.max(0, snapValue(action.start, state.snap, state.pixelsPerSecond));
      const moved = { ...target, start: newStart, end: newStart + (target.end - target.start), trackId: action.trackId ?? target.trackId };
      const sourceTrackId = target.trackId;
      const destTrackId = moved.trackId;
      let nextClips = state.clips.map((c) => (c.id === target.id ? moved : c));

      if (state.ui.timelineMode === 'magnetic') {
        nextClips = packTrackMagnetic(nextClips, sourceTrackId);
        if (destTrackId !== sourceTrackId) {
          nextClips = packTrackMagnetic(nextClips, destTrackId);
        }
      } else {
        const peers = state.clips.filter((c) => c.id !== target.id && c.trackId === moved.trackId);
        if (peers.some((p) => overlaps(p, moved))) {
          const placed = tryPlaceClip(peers, moved);
          return { ...state, clips: state.clips.map((c) => (c.id === target.id ? placed : c)) };
        }
      }
      return { ...state, clips: nextClips };
    }
    case 'clip/moveSelection': {
      // Move every selected clip so the dragged anchor lands at `action.start`,
      // keeping the others' relative offsets. Idempotent across drag updates.
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      if (!ids.length) return state;
      const idSet = new Set(ids);
      const sel = state.clips.filter((c) => idSet.has(c.id));
      if (!sel.length) return state;
      const anchor = state.clips.find((c) => c.id === action.anchorId) ?? sel[0];
      const targetStart = Math.max(0, snapValue(action.start, state.snap, state.pixelsPerSecond));
      let delta = targetStart - anchor.start;
      const minStart = Math.min(...sel.map((c) => c.start));
      if (minStart + delta < 0) delta = -minStart;          // clamp earliest at 0
      if (Math.abs(delta) < 1e-6) return state;
      const moved = sel.map((c) => ({ ...c, start: c.start + delta, end: c.end + delta }));
      for (const m of moved) {
        const peers = state.clips.filter((c) => !idSet.has(c.id) && c.trackId === m.trackId);
        if (peers.some((p) => overlaps(p, m))) return state; // refuse to overlap others
      }
      const byId = new Map(moved.map((m) => [m.id, m]));
      return { ...state, clips: state.clips.map((c) => byId.get(c.id) ?? c) };
    }

    case 'clip/trim': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const next = { ...target };
      if (action.side === 'in') {
        const proposed = clamp(action.t, 0, target.end - 0.1);
        const delta = proposed - target.start;
        next.start = proposed;
        next.srcIn = Math.max(0, target.srcIn + delta);
      } else {
        const proposed = Math.max(target.start + 0.1, action.t);
        next.end = proposed;
        next.srcOut = target.srcIn + (next.end - next.start);
      }
      let nextClips = state.clips.map((c) => (c.id === target.id ? next : c));
      if (state.ui.timelineMode === 'magnetic') {
        nextClips = packTrackMagnetic(nextClips, target.trackId);
      } else {
        const peers = state.clips.filter((c) => c.id !== target.id && c.trackId === target.trackId);
        if (peers.some((p) => overlaps(p, next))) return state;
      }
      return { ...state, clips: nextClips };
    }

    case 'clip/blade': {
      // Split every selected clip at action.t (or every clip under playhead if none selected).
      const t = action.t ?? state.playhead;
      const targets = state.clips.filter((c) =>
        action.ids?.length ? action.ids.includes(c.id) : c.start < t && c.end > t
      );
      if (!targets.length) return state;
      const out = state.clips.slice();
      for (const target of targets) {
        const idx = out.findIndex((c) => c.id === target.id);
        if (idx < 0) continue;
        const splitSrc = target.srcIn + (t - target.start) * (target.speed ?? 1);
        const left = { ...target, end: t, srcOut: splitSrc };
        const right = {
          ...target,
          id: uid('clip'),
          start: t,
          srcIn: splitSrc,
          transitions: { in: null, out: target.transitions?.out ?? null }
        };
        left.transitions = { in: target.transitions?.in ?? null, out: null };
        out.splice(idx, 1, left, right);
      }
      return { ...state, clips: out };
    }

    case 'clip/multiBlade': {
      const { clipId, times } = action;
      if (!times || !times.length) return state;
      const target = state.clips.find((c) => c.id === clipId);
      if (!target) return state;

      // Filter and sort times that are strictly inside the clip duration (timeline time)
      const validTimes = times
        .filter((t) => t > target.start && t < target.end)
        .sort((a, b) => a - b);
      if (!validTimes.length) return state;

      const outClips = state.clips.filter((c) => c.id !== clipId);
      const speed = target.speed ?? 1;

      let currentStart = target.start;
      let currentSrcIn = target.srcIn;
      
      const newSegments = [];
      for (let i = 0; i <= validTimes.length; i++) {
        const nextEnd = i < validTimes.length ? validTimes[i] : target.end;
        const duration = nextEnd - currentStart;
        const nextSrcOut = currentSrcIn + duration * speed;
        
        newSegments.push({
          ...target,
          id: i === 0 ? target.id : uid('clip'),
          start: currentStart,
          end: nextEnd,
          srcIn: currentSrcIn,
          srcOut: nextSrcOut,
          transitions: {
            in: i === 0 ? (target.transitions?.in ?? null) : null,
            out: i === validTimes.length ? (target.transitions?.out ?? null) : null
          }
        });
        
        currentStart = nextEnd;
        currentSrcIn = nextSrcOut;
      }

      let nextClips = outClips.concat(newSegments);
      if (state.ui.timelineMode === 'magnetic') {
        nextClips = packTrackMagnetic(nextClips, target.trackId);
      }
      return { ...state, clips: nextClips };
    }


    case 'clip/delete': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      if (!ids.length) return state;
      // `let`: the magnetic branch below repacks `remaining` track-by-track.
      let remaining = state.clips.filter((c) => !ids.includes(c.id));
      if (state.ui.timelineMode === 'magnetic') {
        const removed = state.clips.filter((c) => ids.includes(c.id));
        const trackIds = new Set(removed.map((c) => c.trackId));
        for (const tid of trackIds) {
          remaining = packTrackMagnetic(remaining, tid);
        }
        return { ...state, clips: remaining, selectedClipIds: [] };
      }
      if (!action.ripple) {
        return { ...state, clips: remaining, selectedClipIds: [] };
      }
      // Ripple delete: pull subsequent clips on the same track left.
      const removed = state.clips.filter((c) => ids.includes(c.id));
      const shifts = new Map(); // trackId -> [{after, by}]
      for (const r of removed) {
        const list = shifts.get(r.trackId) ?? [];
        list.push({ after: r.start, by: r.end - r.start });
        shifts.set(r.trackId, list);
      }
      const out = remaining.map((c) => {
        const list = shifts.get(c.trackId);
        if (!list) return c;
        let shift = 0;
        for (const s of list) if (c.start >= s.after) shift += s.by;
        return shift ? { ...c, start: c.start - shift, end: c.end - shift } : c;
      });
      return { ...state, clips: out, selectedClipIds: [] };
    }

    case 'clip/duplicate': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      const newClips = [];
      const newIds = [];
      for (const id of ids) {
        const c = state.clips.find((x) => x.id === id);
        if (!c) continue;
        const dur = c.end - c.start;
        const candidate = { ...c, id: uid('clip'), start: c.end, end: c.end + dur };
        const peers = state.clips.concat(newClips).filter((p) => p.trackId === candidate.trackId && p.id !== candidate.id);
        const placed = peers.some((p) => overlaps(p, candidate))
          ? tryPlaceClip(peers, candidate)
          : candidate;
        newClips.push(placed);
        newIds.push(placed.id);
      }
      return { ...state, clips: state.clips.concat(newClips), selectedClipIds: newIds };
    }

    case 'clip/updateAll':
      return { ...state, clips: action.clips };

    case 'clip/update':
      return {
        ...state,
        clips: state.clips.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c))
      };
    case 'clip/setSpeed': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const speed = clamp(action.speed, 0.25, 4);
      const srcLen = (target.srcOut ?? target.srcIn + (target.end - target.start)) - target.srcIn;
      const newDur = Math.max(0.1, srcLen / speed); // faster speed => shorter timeline span
      const next = { ...target, speed, end: target.start + newDur };
      if (next.keyframes?.length) {
        next.keyframes = next.keyframes.map((k) => (k.time > newDur ? { ...k, time: newDur } : k));
      }
      const peers = state.clips.filter((c) => c.id !== target.id && c.trackId === target.trackId);
      if (peers.some((p) => overlaps(p, next))) return state;
      return { ...state, clips: state.clips.map((c) => (c.id === target.id ? next : c)) };
    }

    case 'clip/updateTransform':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, transform: { ...c.transform, ...action.patch } } : c
        )
      };
    case 'clip/updateFilters':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, filters: { ...c.filters, ...action.patch } } : c
        )
      };
    case 'clip/updateAudio':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, audio: { ...c.audio, ...action.patch } } : c
        )
      };
    case 'clip/updateTitle':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, title: { ...c.title, ...action.patch } } : c
        )
      };
    case 'clip/addKeyframe': {
      const { id, channel, time, value } = action;
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id !== id) return c;
          const kf = (c.keyframes ?? []).filter((k) => !(k.channel === channel && Math.abs(k.time - time) < 1 / 120));
          kf.push({ channel, time, value });
          kf.sort((a, b) => a.time - b.time);
          return { ...c, keyframes: kf };
        })
      };
    }
    case 'clip/clearKeyframes':
      return {
        ...state,
        clips: state.clips.map((c) => (c.id === action.id ? { ...c, keyframes: [] } : c))
      };
    case 'clip/removeKeyframe':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, keyframes: (c.keyframes ?? []).filter((_, i) => i !== action.index) } : c
        )
      };
    case 'clip/updateKeyframe':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? { ...c, keyframes: (c.keyframes ?? []).map((k, i) => (i === action.index ? { ...k, ...action.patch } : k)) }
            : c
        )
      };

    /* ===== Transitions ===== */
    case 'transition/apply': {
      const { clipId, side, kind, duration } = action;
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === clipId
            ? { ...c, transitions: { ...c.transitions, [side]: { kind, duration: duration ?? 0.6 } } }
            : c
        )
      };
    }
    case 'transition/clear':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId
            ? { ...c, transitions: { ...c.transitions, [action.side]: null } }
            : c
        )
      };

    /* ===== Selection ===== */
    case 'select/clips':
      return { ...state, selectedClipIds: action.ids ?? [] };
    case 'select/inspectorTab':
      return { ...state, inspectorTab: action.tab };

    /* ===== Playback ===== */
    case 'playback/setPlayhead':
      // User-initiated seek: bump seekId so the renderer adopts this playhead.
      return { ...state, playhead: Math.max(0, action.t), seekId: (state.seekId ?? 0) + 1 };
    case 'playback/tickPlayhead':
      // Renderer-owned playback clock echoing its time back to React (throttled).
      // Deliberately does NOT bump seekId, so the renderer ignores its own echo.
      return { ...state, playhead: Math.max(0, action.t) };
    case 'playback/togglePlay':
      return { ...state, playing: !state.playing, playbackRate: state.playing ? state.playbackRate : Math.sign(state.playbackRate || 1) };
    case 'playback/play':
      return { ...state, playing: true };
    case 'playback/pause':
      return { ...state, playing: false, playbackRate: Math.sign(state.playbackRate || 1) };
    case 'playback/jklForward': {
      // Sequence: 1x -> 2x -> 4x
      const ladder = [1, 2, 4];
      const next = state.playbackRate > 0 ? Math.min(2, state.jklIndex + 1) : 0;
      return { ...state, playing: true, playbackRate: ladder[next], jklIndex: next };
    }
    case 'playback/jklReverse': {
      const ladder = [1, 2, 4];
      const next = state.playbackRate < 0 ? Math.min(2, state.jklIndex + 1) : 0;
      return { ...state, playing: true, playbackRate: -ladder[next], jklIndex: next };
    }
    case 'playback/stop':
      return { ...state, playing: false, playbackRate: 1, jklIndex: 0 };
    case 'playback/markIn':
      return { ...state, inPoint: state.playhead };
    case 'playback/markOut':
      return { ...state, outPoint: state.playhead };
    case 'playback/clearMarks':
      return { ...state, inPoint: null, outPoint: null };
    case 'playback/toggleLoop':
      return { ...state, loop: !state.loop };
    case 'playback/setZoom':
      return { ...state, pixelsPerSecond: clamp(action.pps, 6, 600) };
    case 'playback/toggleSnap':
      return { ...state, snap: !state.snap };

    /* ===== Master / mixer ===== */
    case 'master/setVolume':
      return { ...state, master: { ...state.master, volume: clamp(action.v, 0, 2) } };
    case 'master/toggleSafeZones':
      return { ...state, master: { ...state.master, safeZones: !state.master.safeZones } };

    /* ===== UI flags ===== */
    case 'ui/toggle':
      return { ...state, ui: { ...state.ui, [action.key]: !state.ui[action.key] } };
    case 'ui/set': {
      let nextClips = state.clips;
      if (action.key === 'timelineMode' && action.value === 'magnetic') {
        for (const track of state.tracks) {
          nextClips = packTrackMagnetic(nextClips, track.id);
        }
      }
      return { ...state, ui: { ...state.ui, [action.key]: action.value }, clips: nextClips };
    }
    case 'ui/openTrimEditor':
      return { ...state, ui: { ...state.ui, trimEditorOpen: true, trimClipId: action.id } };

    /* ===== Analyzer ===== */
    case 'analyzer/setThresholds':
      return { ...state, analyzer: { ...state.analyzer, ...action.patch } };

    /* ===== Project I/O ===== */
    case 'project/loadAll':
      // Wholesale state restore (drag-loaded JSON).
      return {
        ...state,
        ...action.snapshot,
        ui: { ...state.ui, exportOpen: false, welcomeOpen: false }
      };

    /* ===== Toasts ===== */
    case 'toast/push': {
      const t = {
        id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        kind: action.kind ?? 'info',
        message: action.message,
        ttl: action.ttl ?? 3200
      };
      // Keep the stack short.
      const next = state.toasts.concat([t]).slice(-5);
      return { ...state, toasts: next };
    }
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((x) => x.id !== action.id) };

    /* ===== Context menu ===== */
    case 'ui/openContextMenu':
      return { ...state, ui: { ...state.ui, contextMenu: action.payload } };
    case 'ui/closeContextMenu':
      return { ...state, ui: { ...state.ui, contextMenu: null } };

    /* ===== Rubber band ===== */
    case 'ui/rubberBand':
      return { ...state, ui: { ...state.ui, rubberBand: action.payload } };

    /* ===== Track resize ===== */
    case 'track/setHeight':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.id ? { ...t, height: Math.max(40, Math.min(220, action.height)) } : t
        )
      };

    /* ===== Timeline Markers ===== */
    case 'marker/add': {
      const m = {
        id: uid('mkr'),
        time: action.time ?? state.playhead,
        label: action.label ?? '',
        color: action.color ?? '#fbbf24',
        chapter: action.chapter ?? false
      };
      return { ...state, markers: state.markers.concat([m]) };
    }
    case 'marker/remove':
      return { ...state, markers: state.markers.filter((m) => m.id !== action.id) };
    case 'marker/update':
      return {
        ...state,
        markers: state.markers.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m))
      };

    /* ===== Clipboard ===== */
    case 'clipboard/copy': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      const copied = state.clips.filter((c) => ids.includes(c.id)).map((c) => ({ ...c }));
      return { ...state, clipboard: copied };
    }
    case 'clipboard/cut': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      const cut = state.clips.filter((c) => ids.includes(c.id)).map((c) => ({ ...c }));
      return {
        ...state,
        clipboard: cut,
        clips: state.clips.filter((c) => !ids.includes(c.id)),
        selectedClipIds: []
      };
    }
    case 'clipboard/paste': {
      if (!state.clipboard.length) return state;
      const offset = action.time ?? state.playhead;
      const earliest = Math.min(...state.clipboard.map((c) => c.start));
      const delta = offset - earliest;
      const newClips = state.clipboard.map((c) => ({
        ...c,
        id: uid('clip'),
        start: c.start + delta,
        end: c.end + delta
      }));
      const newIds = newClips.map((c) => c.id);
      return { ...state, clips: state.clips.concat(newClips), selectedClipIds: newIds };
    }

    /* ===== Clip Groups ===== */
    case 'clip/group': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      if (ids.length < 2) return state;
      const groupId = uid('grp');
      const group = { id: groupId, clipIds: ids.slice() };
      return {
        ...state,
        groups: state.groups.concat([group]),
        clips: state.clips.map((c) => (ids.includes(c.id) ? { ...c, groupId } : c))
      };
    }
    case 'clip/ungroup': {
      const gid = action.groupId;
      if (!gid) return state;
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== gid),
        clips: state.clips.map((c) => (c.groupId === gid ? { ...c, groupId: null } : c))
      };
    }

    /* ===== Advanced Edits ===== */
    case 'clip/rippleDelete': {
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      if (!ids.length) return state;
      const removed = state.clips.filter((c) => ids.includes(c.id));
      const remaining = state.clips.filter((c) => !ids.includes(c.id));
      // Build shift map per track
      const shifts = new Map(); // trackId -> [{after, by}]
      for (const r of removed) {
        const list = shifts.get(r.trackId) ?? [];
        list.push({ after: r.start, by: r.end - r.start });
        shifts.set(r.trackId, list);
      }
      // Sort shift entries by 'after' descending so we apply from right to left
      for (const list of shifts.values()) list.sort((a, b) => b.after - a.after);
      const out = remaining.map((c) => {
        const list = shifts.get(c.trackId);
        if (!list) return c;
        let shift = 0;
        for (const s of list) if (c.start >= s.after) shift += s.by;
        return shift ? { ...c, start: Math.max(0, c.start - shift), end: Math.max(0.1, c.end - shift) } : c;
      });
      return { ...state, clips: out, selectedClipIds: [] };
    }

    case 'clip/rollEdit': {
      // Adjust boundary between two adjacent clips
      const { leftId, rightId, delta } = action;
      const left = state.clips.find((c) => c.id === leftId);
      const right = state.clips.find((c) => c.id === rightId);
      if (!left || !right) return state;
      const newLeftEnd = left.end + delta;
      const newRightStart = right.start + delta;
      if (newLeftEnd <= left.start + 0.1 || newRightStart >= right.end - 0.1) return state;
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id === leftId) return { ...c, end: newLeftEnd, srcOut: c.srcIn + (newLeftEnd - c.start) };
          if (c.id === rightId) return { ...c, start: newRightStart, srcIn: c.srcIn + delta };
          return c;
        })
      };
    }

    case 'clip/slipEdit': {
      // Shift source window without changing timeline position
      const { id, delta } = action;
      const target = state.clips.find((c) => c.id === id);
      if (!target) return state;
      const newSrcIn = Math.max(0, target.srcIn + delta);
      const newSrcOut = newSrcIn + (target.end - target.start);
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === id ? { ...c, srcIn: newSrcIn, srcOut: newSrcOut } : c
        )
      };
    }

    case 'clip/slideEdit': {
      // Move clip on timeline, trimming adjacent clips to accommodate
      const { id, delta } = action;
      const target = state.clips.find((c) => c.id === id);
      if (!target) return state;
      const peers = state.clips.filter((c) => c.id !== id && c.trackId === target.trackId);
      peers.sort((a, b) => a.start - b.start);
      const prevClip = peers.filter((c) => c.end <= target.start + 0.001).pop();
      const nextClip = peers.find((c) => c.start >= target.end - 0.001);
      if (delta < 0 && prevClip) {
        const newPrevEnd = prevClip.end + delta;
        if (newPrevEnd <= prevClip.start + 0.1) return state;
      }
      if (delta > 0 && nextClip) {
        const newNextStart = nextClip.start + delta;
        if (newNextStart >= nextClip.end - 0.1) return state;
      }
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id === id) return { ...c, start: c.start + delta, end: c.end + delta };
          if (prevClip && c.id === prevClip.id) return { ...c, end: c.end + delta, srcOut: c.srcIn + (c.end + delta - c.start) };
          if (nextClip && c.id === nextClip.id) return { ...c, start: c.start + delta, srcIn: c.srcIn + delta };
          return c;
        })
      };
    }

    case 'clip/freeze': {
      // Create a freeze frame at the current playhead position
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const freezeStart = action.time ?? state.playhead;
      const freezeDur = action.duration ?? 2;
      const freezeClip = {
        id: uid('clip'),
        trackId: target.trackId,
        mediaId: target.mediaId,
        kind: target.kind,
        start: freezeStart,
        end: freezeStart + freezeDur,
        srcIn: (freezeStart - target.start) * (target.speed ?? 1) + target.srcIn,
        srcOut: (freezeStart - target.start) * (target.speed ?? 1) + target.srcIn + 0.001,
        speed: 0, // speed 0 = freeze frame
        transform: { ...target.transform },
        filters: { ...target.filters },
        effects: [...(target.effects ?? [])],
        audio: { volume: 0, pan: 0, muted: true, solo: false },
        keyframes: [],
        transitions: { in: null, out: null },
        title: null,
        reversed: false,
        groupId: null,
        linkedClipId: null,
        adjustmentLayer: false
      };
      const placed = tryPlaceClip(state.clips.filter((c) => c.trackId === target.trackId), freezeClip);
      return { ...state, clips: state.clips.concat([placed]), selectedClipIds: [placed.id] };
    }

    case 'clip/toggleReverse': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, reversed: !c.reversed } : c
        )
      };
    }

    case 'clip/linkAudio': {
      // Link two clips (video + audio) so they move together
      const { videoClipId, audioClipId } = action;
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id === videoClipId) return { ...c, linkedClipId: audioClipId };
          if (c.id === audioClipId) return { ...c, linkedClipId: videoClipId };
          return c;
        })
      };
    }
    case 'clip/unlinkAudio': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target || !target.linkedClipId) return state;
      const linkedId = target.linkedClipId;
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id === action.id || c.id === linkedId) return { ...c, linkedClipId: null };
          return c;
        })
      };
    }

    case 'clip/updateEffects':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id ? { ...c, effects: action.effects } : c
        )
      };
    case 'clip/addEffect': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const effect = { id: uid('fx'), ...action.effect };
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? { ...c, effects: [...(c.effects ?? []), effect] }
            : c
        )
      };
    }
    case 'clip/removeEffect':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? { ...c, effects: (c.effects ?? []).filter((e) => e.id !== action.effectId) }
            : c
        )
      };
    case 'clip/updateEffect':
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? {
                ...c,
                effects: (c.effects ?? []).map((e) =>
                  e.id === action.effectId ? { ...e, ...action.patch } : e
                )
              }
            : c
        )
      };
    case 'clip/reorderEffects': {
      const target = state.clips.find((c) => c.id === action.id);
      if (!target) return state;
      const effects = [...(target.effects ?? [])];
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= effects.length || toIndex < 0 || toIndex >= effects.length) return state;
      const [moved] = effects.splice(fromIndex, 1);
      effects.splice(toIndex, 0, moved);
      return {
        ...state,
        clips: state.clips.map((c) => (c.id === action.id ? { ...c, effects } : c))
      };
    }

    /* ===== Sequences (Compound Clips / Nested Timelines) ===== */
    case 'sequence/create': {
      const seq = {
        id: uid('seq'),
        name: action.name ?? 'Sequence',
        tracks: action.tracks ?? [],
        clips: action.clips ?? [],
        transitions: action.transitions ?? [],
        parentId: action.parentId ?? null
      };
      return { ...state, sequences: state.sequences.concat([seq]) };
    }
    case 'sequence/open':
      return { ...state, activeSequenceId: action.id };
    case 'sequence/close':
      return { ...state, activeSequenceId: null };
    case 'sequence/delete':
      return {
        ...state,
        sequences: state.sequences.filter((s) => s.id !== action.id),
        activeSequenceId: state.activeSequenceId === action.id ? null : state.activeSequenceId
      };
    case 'sequence/nest': {
      // Nest selected clips into a compound clip / sequence
      const ids = action.ids?.length ? action.ids : state.selectedClipIds;
      if (ids.length < 2) return state;
      const selected = state.clips.filter((c) => ids.includes(c.id));
      const seqId = uid('seq');
      const earliest = Math.min(...selected.map((c) => c.start));
      const latest = Math.max(...selected.map((c) => c.end));
      const seq = {
        id: seqId,
        name: action.name ?? 'Compound Clip',
        tracks: [], // simplified: real impl would derive unique tracks
        clips: selected.map((c) => ({ ...c, start: c.start - earliest, end: c.end - earliest })),
        transitions: [],
        parentId: null
      };
      // Replace selected clips with a single compound clip reference
      const compoundClip = {
        id: uid('clip'),
        trackId: selected[0].trackId,
        mediaId: null,
        kind: 'compound',
        start: earliest,
        end: latest,
        srcIn: 0,
        srcOut: latest - earliest,
        speed: 1,
        transform: defaultTransform(),
        filters: defaultFilters(),
        effects: [],
        audio: defaultAudio(),
        keyframes: [],
        transitions: { in: null, out: null },
        title: null,
        reversed: false,
        groupId: null,
        linkedClipId: null,
        adjustmentLayer: false,
        sequenceId: seqId
      };
      return {
        ...state,
        sequences: state.sequences.concat([seq]),
        clips: state.clips.filter((c) => !ids.includes(c.id)).concat([compoundClip]),
        selectedClipIds: [compoundClip.id]
      };
    }

    /* ===== Version History ===== */
    case 'version/save': {
      const entry = {
        id: uid('ver'),
        label: action.label ?? `Version ${state.versionHistory.length + 1}`,
        savedAt: Date.now(),
        snapshot: {
          project: state.project,
          media: state.media,
          tracks: state.tracks,
          clips: state.clips,
          transitions: state.transitions,
          markers: state.markers,
          sequences: state.sequences,
          groups: state.groups
        }
      };
      return { ...state, versionHistory: state.versionHistory.concat([entry]) };
    }
    case 'version/restore': {
      const entry = state.versionHistory.find((v) => v.id === action.id);
      if (!entry?.snapshot) return state;
      return { ...state, ...entry.snapshot };
    }
    case 'version/delete':
      return { ...state, versionHistory: state.versionHistory.filter((v) => v.id !== action.id) };

    /* ===== Track reorder ===== */
    case 'track/reorder': {
      const { fromIndex, toIndex } = action;
      const tracks = state.tracks.slice();
      if (fromIndex < 0 || fromIndex >= tracks.length || toIndex < 0 || toIndex >= tracks.length) return state;
      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);
      return { ...state, tracks };
    }

    default:
      return state;
  }
}

// Actions that should be recorded into the undo history.
export const HISTORY_ACTIONS = new Set([
  'media/add',
  'media/remove',
  'media/addSubclip',
  'track/add',
  'track/update',
  'track/remove',
  'clip/insertFromMedia',
  'clip/insertTitle',
  'clip/move',
  'clip/trim',
  'clip/blade',
  'clip/delete',
  'clip/duplicate',
  'clip/update',
  'clip/updateTransform',
  'clip/updateFilters',
  'clip/updateAudio',
  'clip/updateTitle',
  'clip/addKeyframe',
  'clip/clearKeyframes',
  'transition/apply',
  'transition/clear',
  'project/rename',
  'project/loadAll',
  'track/setHeight',
  'project/update',
  'clip/moveSelection',
  'clip/setSpeed',
  'clip/removeKeyframe',
  'clip/updateKeyframe',
  // Phase 1/2 additions
  'marker/add',
  'marker/remove',
  'marker/update',
  'clipboard/cut',
  'clipboard/paste',
  'clip/group',
  'clip/ungroup',
  'clip/rippleDelete',
  'clip/rollEdit',
  'clip/slipEdit',
  'clip/slideEdit',
  'clip/freeze',
  'clip/toggleReverse',
  'clip/linkAudio',
  'clip/unlinkAudio',
  'clip/updateEffects',
  'clip/addEffect',
  'clip/removeEffect',
  'clip/updateEffect',
  'clip/reorderEffects',
  'sequence/create',
  'sequence/delete',
  'sequence/nest',
  'version/save',
  'version/restore',
  'version/delete',
  'track/reorder'
]);
