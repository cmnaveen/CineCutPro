# CineCutPro

A premium, browser-based non-linear video editor built with React + Vite + vanilla CSS.

Glassmorphism slate/navy theme · dual-monitor workspace · real Web Audio routing · per-pixel chroma key · seven cinematic title presets · drag-and-drop transitions · JKL transport · rubber-band multi-select · A/B trim · boring/jump-cut analyzer · MediaRecorder export · save/load project · toast notifications · live RMS audio meters · live FPS status bar.

## Run

```bash
cd cinecutpro
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the built bundle
```

Requires Node 18+. Pure web stack — works identically on Windows, macOS, Linux.

## Project structure

```
src/
├── main.jsx                 React bootstrap + EditorProvider
├── App.jsx                  Workspace shell
├── state/
│   ├── EditorContext.jsx    Provider, dispatch dry-run, 50-deep undo/redo
│   ├── editorReducer.js     Every mutation (clips, tracks, ui, toasts, IO)
│   ├── initialState.js      Tracks, ui flags, welcome-dismissed persistence
│   └── history.js           Snapshot ring buffer
├── engine/
│   ├── mediaRenderer.js     Offscreen canvas compositor + RAF loop + chroma key path
│   ├── titleCompositor.js   7 title presets (glass, neon, silver, retro3d, glitch, gold, grunge)
│   ├── transitions.js       Dissolve / dip / wipes / clock / push / zoom
│   ├── audioEngine.js       MediaElementAudioSourceNode routing + per-track meters
│   ├── chromaKey.js         Per-pixel YCbCr chroma key with spill suppression
│   ├── waveform.js          decodeAudioData → cached peak Float32Array
│   ├── projectIO.js         JSON save / load
│   ├── analyzer.js          Boring shot + jump cut detection
│   └── timecode.js          SMPTE formatting
├── components/
│   ├── Header.jsx           Brand, transport, save/open, transitions, analyzer, export
│   ├── MediaLibrary.jsx     Drag-drop ingest, metadata probing, subclips
│   ├── SourceMonitor.jsx    Tape scrub, marks, F9/F10 inserts
│   ├── ProgramMonitor.jsx   Canvas blit, safe zones, hero empty state, audio routing
│   ├── Inspector.jsx        Tabs + mixer with real RMS meters
│   ├── Timeline.jsx         Ruler, tracks, magnetic snap, rubber-band, auto-scroll, resize
│   ├── TrimEditor.jsx       A/B side-by-side filmstrip nudger
│   ├── TransitionsRail.jsx  Drag-source library
│   ├── AnalyzerSlideout.jsx Boring/jump-cut diagnostics
│   ├── ExportDialog.jsx     MediaRecorder canvas capture → WebM/MP4
│   ├── ShortcutsModal.jsx
│   ├── WelcomeModal.jsx     First-run hero, persisted dismissal
│   ├── ContextMenu.jsx      Right-click on clips
│   ├── StatusBar.jsx        Live FPS, draw calls, selection, history depth
│   ├── EmptyHero.jsx        Animated orb + hints when Program is empty
│   ├── Toast.jsx            Bottom-right toast stack with auto-dismiss
│   └── icons/IconSet.jsx
├── hooks/
│   └── useKeyboard.js       JKL + I/O + B + F9/F10 + ←/→ frame step + Ctrl+S/O + ⌘Z/Y
└── styles/                  index, app, header, media-library, monitors,
                             inspector, timeline, modals, animations, premium
```

## Architecture notes

### Audio is real

Each `<video>` / `<audio>` element registered with the renderer is wrapped in a `MediaElementAudioSourceNode → Gain → StereoPanner → Master Gain → destination` chain. AudioContext is created on the first user gesture (Space/J/K/L). Per-clip volume, per-track volume, per-clip pan, mute, solo, master volume, **and keyframed volume curves** all act on the actual signal. Per-track meters envelope the summed clip gains and decay with VU-style ballistics — the bars in the inspector mixer are the real mix.

### Chroma key is per-pixel

`engine/chromaKey.js` does CbCr-space distance per pixel with tolerance + soft feather + spill suppression. Each video clip that has chroma key enabled draws through a scratch canvas so `getImageData/putImageData` operate on untransformed pixels; the result is then composited with the clip's transforms.

### Compositing pipeline

`mediaRenderer.js` runs one `requestAnimationFrame` loop. Per tick:

1. Resolve active clips at `playhead`.
2. Sync each `<video>`/`<audio>` element's `currentTime` + `playbackRate`.
3. Per track (bottom-up), draw each active clip onto its lazily-cached `OffscreenCanvas`, applying transforms, crops, CSS filters, optional chroma key, vignette.
4. If a clip's `out` transition overlaps the next clip's `in`, run the transition between scratch buffers.
5. Blit each track onto the program canvas in order.

The Apple-Glass title preset samples the program canvas to fake refraction — because tracks composite bottom-up, the glass layer sees everything beneath it.

### State

A single reducer drives every persistent change; the dispatcher dry-runs the reducer to skip no-op history pushes. Volatile slices (`playhead`, `ui.*`, source-monitor sub-state, toasts, rubber-band rect, context menu position) sidestep history.

### Project I/O

`Ctrl+S` downloads a JSON snapshot of the persistent state. `Ctrl+O` reads one back via a file picker. Blob URLs for imported media don't survive a reload — the snapshot keeps enough metadata that you can re-import the same files to reattach.

## Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play / pause |
| L | Forward 1× → 2× → 4× |
| J | Reverse −1× → −2× → −4× |
| ← / → | Step ±1 frame |
| Shift+← / → | Step ±10 frames |
| Alt+← / → | Jump to prev / next clip edge |
| Home / End | Jump to start / end |
| I, [ | Mark In |
| O, ] | Mark Out |
| F9 | Insert from Source (ripple) |
| F10 | Overwrite from Source |
| B | Blade at playhead |
| Delete | Delete selection |
| Shift+Delete | Ripple delete |
| Ctrl+D | Duplicate selection |
| Ctrl+A | Select all clips |
| S | Toggle snap |
| \ | Toggle dual / single monitor view |
| Ctrl+S | Save project (JSON) |
| Ctrl+O | Open project |
| Ctrl+Z, Ctrl+Y | Undo / redo (50 levels) |
| + / − or Ctrl+wheel | Zoom timeline |
| ? | Open shortcut sheet |
| Esc | Close modal / clear selection / close context menu |

## Premium UX

- **Magnetic snap** to clip edges, playhead, in/out marks, and frame grid (8px proximity).
- **Auto-scroll** the timeline so the playhead stays in view during playback.
- **Rubber-band multi-select** on empty lane area.
- **Track-height drag-to-resize** at the bottom edge of each track.
- **Right-click context menu** on clips (blade, duplicate, reset transform, clear keyframes, remove transitions, delete).
- **Toast notifications** for blade / insert / delete / save / load.
- **Bottom status bar** with live FPS, draw-call count, active-clip count, undo depth.
- **First-run welcome** modal with feature highlights (persists "don't show again" to localStorage).
- **Animated hero empty state** on the Program monitor when no clips exist.
- **Live RMS meters** with peak holds, per audio track, in the inspector mixer.
- **Visible keyframe markers** on clip bodies, color-coded by channel.
- **Subtitle clip kind** rendering as captioned scrim at bottom-third.
- **Dual / single monitor toggle** in the header (or `\`) — collapses the Source pane when you need more room for the Program.
- **Direct canvas manipulation** — selecting a title/subtitle/video clip overlays a dashed bounding box on the Program canvas with body-drag (move), four corner handles (uniform scale), and a rotation knob. The math mirrors the renderer's transform so the handles stay aligned with the actual glyphs.
- **Vertical alignment** (top / middle / bottom) for titles and subtitles in addition to horizontal alignment.
- **PiP / position presets** — 3×3 corner grid in the Transform tab snaps the selected clip to a 30% PiP at any corner (or center "Fit").
- **Kinetic / Elemental titles** — `Fire` (flickering glow + rising embers), `Rock` (chiseled bevel + crack lines + settling dust), `Ground` (earth gradient + mossy baseline + drifting pollen), `Air` (translucent cool tones + wind streaks + mist particles). Animations sync to the clip's local playhead time.
- **Timeline zoom slider + Fit toggle** — drag the inline slider in the timeline toolbar (6–600 px/s), or hit **Fit** to auto-size the content to the visible viewport. Fit re-runs on window resize via `ResizeObserver` and disengages the moment you manually zoom.
- **Playhead alignment fix** — playhead, ruler ticks, and I/O marks are now offset by the 180 px track-head gutter so frame `00:00:00:00` sits exactly at the lane's left edge. Ruler clicks subtract the same offset, so click-to-scrub is frame-accurate from pixel zero of any clip.
- **iMovie-style text motion** — `Focus` (blur in / sharp out), `Reveal` (horizontal wipe), `Expand` (grow + fade), `Pop Up` (spring overshoot), `Rise` (lift + fade), `Slide` (horizontal glide). Each title clip gets independent **Entry** and **Exit** pickers with per-side duration sliders; motion math lives in `engine/textMotion.js` and the renderer applies the deltas (alpha / scale / x,y / blur / clip-frac) inside `drawTitle` so it composes cleanly with any visual preset (incl. Fire / Glass / etc).

## Caveats

- Linux Chromium often ships without H.264 — the export dialog auto-falls-back to WebM VP9, which is universal.
- The Apple-Glass refraction samples the program canvas one frame late (the glass layer draws into a track buffer that is then blitted on top).
- Saved projects reference media via blob URLs that don't survive a reload — re-import the same files after loading a project to reattach.
- `MediaElementAudioSourceNode` can only wrap an element once; React strict-mode's double mount is handled silently in `audioEngine._wire`.
