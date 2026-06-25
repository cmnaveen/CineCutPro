/**
 * CineCutPro — initial editor state.
 *
 * The state shape is intentionally flat-ish so reducer transitions stay cheap
 * and the history stack can deep-clone in one pass.
 */

export const TRACK_KINDS = Object.freeze({
  VIDEO: 'video',
  OVERLAY: 'overlay',
  SUBTITLE: 'subtitle',
  TITLE: 'title',
  AUDIO: 'audio'
});

export const FPS = 30;
export const DEFAULT_PIXELS_PER_SECOND = 60;
export const TIMELINE_DURATION = 240; // seconds shown by default

const WELCOME_KEY = 'cinecutpro:welcomeDismissed';
function readWelcomeDismissed() {
  try { return localStorage.getItem(WELCOME_KEY) === '1'; }
  catch (_) { return false; }
}
export function writeWelcomeDismissed() {
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch (_) {}
}

let trackId = 0;
const mkTrack = (kind, name, opts = {}) => ({
  id: `trk_${++trackId}`,
  kind,
  name,
  height: opts.height ?? (kind === 'audio' ? 64 : 78),
  muted: false,
  solo: false,
  locked: false,
  visible: true,
  volume: 1,
  pan: 0,
  color: opts.color ?? '#5b8def'
});

export const initialTracks = [
  mkTrack(TRACK_KINDS.TITLE, 'Text / Titles', { color: '#f0b429' }),
  mkTrack(TRACK_KINDS.SUBTITLE, 'Subtitles', { color: '#22d3ee' }),
  mkTrack(TRACK_KINDS.OVERLAY, 'Video 2 — Overlay', { color: '#a78bfa' }),
  mkTrack(TRACK_KINDS.VIDEO, 'Video 1 — Primary', { color: '#5b8def' }),
  mkTrack(TRACK_KINDS.AUDIO, 'Audio 1', { color: '#34d399' }),
  mkTrack(TRACK_KINDS.AUDIO, 'Audio 2', { color: '#34d399' })
];

export const initialState = {
  /* ---------- Project ---------- */
  project: {
    name: 'Untitled Project',
    width: 1920,
    height: 1080,
    fps: FPS,
    createdAt: Date.now(),
    dirty: false,
    background: { type: 'color', color: '#05080f', blur: 15 }
  },

  /* ---------- Media bin ---------- */
  media: [], // { id, name, kind: 'video'|'audio'|'image'|'title', src, duration, thumb, meta }

  /* ---------- Timeline ---------- */
  tracks: initialTracks,
  clips: [], // { id, trackId, mediaId, start, end, srcIn, srcOut, transform, filters, transitions, keyframes, title }
  transitions: [], // standalone marker { id, clipId, side:'in'|'out', kind, duration }

  /* ---------- Playback ---------- */
  playhead: 0,
  seekId: 0,         // bumped on user seeks so the renderer clock can detect scrubs
  playing: false,
  playbackRate: 1, // sign + magnitude for JKL
  jklIndex: 0,     // 0..3 for 1x/2x/4x ladder
  loop: false,
  inPoint: null,
  outPoint: null,
  pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  snap: true,

  /* ---------- Source monitor ---------- */
  source: {
    mediaId: null,
    playhead: 0,
    inPoint: null,
    outPoint: null,
    playing: false
  },

  /* ---------- Selection ---------- */
  selectedClipIds: [],
  inspectorTab: 'transform',

  /* ---------- Master mix ---------- */
  master: {
    volume: 0.8,
    safeZones: false
  },

  /* ---------- UI ---------- */
  ui: {
    transitionsRailOpen: false,
    shortcutsOpen: false,
    trimEditorOpen: false,
    trimClipId: null,
    analyzerOpen: false,
    exportOpen: false,
    activeBladeMode: false,
    welcomeOpen: !readWelcomeDismissed(),
    contextMenu: null,   // { x, y, clipId } when right-click open
    rubberBand: null,    // { x0, y0, x1, y1 } during drag
    monitorMode: 'dual', // 'dual' | 'single' — Source + Program vs Program only
    fitToWindow: false,  // when true, timeline pps auto-fits content to viewport
    projectSettingsOpen: false
  },

  /* ---------- Toasts ---------- */
  toasts: [], // { id, kind, message, ttl }

  /* ---------- Analyzer thresholds ---------- */
  analyzer: {
    boringSeconds: 6,
    jumpCutFrames: 8
  }
};
