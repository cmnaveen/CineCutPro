# CineCutPro

A premium, browser-based non-linear video editor built with **React 18 + Vite 5 + vanilla CSS**.

Glassmorphism slate/navy theme · dual-monitor workspace · real Web Audio routing · per-pixel chroma key · cinematic title presets (static + kinetic) · iMovie-style text motion · drag-and-drop transitions · JKL transport · rubber-band multi-select · A/B trim · boring/jump-cut analyzer · MediaRecorder export · save/load project · toast notifications · live RMS audio meters · live FPS status bar.

> **This README is the source of truth for the project.** It documents what is implemented, how it is wired, and what is planned. See [Working with this README](#working-with-this-readme) for the resume-from-here convention.

---

## Table of contents

1. [Status](#status)
2. [Run](#run)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Architecture](#architecture)
6. [Implementation reference](#implementation-reference)
   - [State shape](#state-shape)
   - [Action contract](#action-contract)
   - [Engine module API](#engine-module-api)
   - [Component map](#component-map)
   - [Key constants](#key-constants)
7. [Keyboard shortcuts](#keyboard-shortcuts)
8. [Feature catalog (implemented)](#feature-catalog-implemented)
9. [Feature improvements / roadmap](#feature-improvements--roadmap)
10. [Known issues & caveats](#known-issues--caveats)
11. [Changelog](#changelog)
12. [Working with this README](#working-with-this-readme)

---

## Status

**Working.** The app boots into a dual-monitor editing workspace with six default tracks and an empty timeline. All panels render; transport, timeline editing, inspector, mixer, analyzer, export, and save/load are wired through a single reducer.

- Last fix: **`Timeline.jsx` missing `innerRef` declaration** — an undeclared ref used during render threw `ReferenceError` and blanked the whole app (no error boundary). Declaration restored. See [Changelog](#changelog).
- No automated tests, ESLint, or TypeScript are configured yet (see [roadmap](#feature-improvements--roadmap)).

---

## Run

```bash
cd cinecutpro
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the built bundle on :4173
```

Requires **Node 18+**. Pure web stack — works identically on Windows, macOS, Linux.

> **Environment note (2026-06-23):** the current Windows workstation has **no Node/npm/bash on PATH and no `node_modules` installed**. Until a Node toolchain is available, changes here are verified by static analysis and by reading the code, not by running `vite`/tests. Install Node and `npm install` to run the app and any future test suite.

---

## Tech stack

| Concern        | Choice                                                        |
|----------------|--------------------------------------------------------------|
| UI             | React 18.3 (function components + hooks, `StrictMode`)         |
| Build/dev      | Vite 5.4 + `@vitejs/plugin-react`, target `es2020`, sourcemaps |
| State          | `useReducer` + Context, hand-rolled 50-deep undo/redo          |
| Styling        | Vanilla CSS (10 stylesheets, no framework)                     |
| Rendering      | Canvas 2D compositor on a single `requestAnimationFrame` loop  |
| Audio          | Web Audio API graph (`MediaElementAudioSourceNode` chains)     |
| Export         | `MediaRecorder` over `canvas.captureStream()`                  |
| Persistence    | JSON download/upload; `localStorage` for welcome dismissal     |

No state-management, UI-component, or icon libraries — icons are hand-drawn SVG in `IconSet.jsx`.

---

## Project structure

```
src/
├── main.jsx                 React bootstrap + EditorProvider + StrictMode
├── App.jsx                  Workspace shell; mounts every panel + modal
├── state/
│   ├── EditorContext.jsx    Provider, dispatch dry-run, undo/redo, derived selectors
│   ├── editorReducer.js     Every persistent mutation + HISTORY_ACTIONS set
│   ├── initialState.js      Tracks, ui flags, constants, welcome-dismissed persistence
│   └── history.js           Snapshot ring buffer (persistent slices only)
├── engine/
│   ├── mediaRenderer.js     Offscreen-canvas compositor + RAF loop + audio-mix snapshot
│   ├── titleCompositor.js   Title/subtitle drawing: 7 static + 4 kinetic presets, motion glue
│   ├── textMotion.js        Entry/exit motion presets (alpha/scale/x,y/blur/clipFrac)
│   ├── transitions.js       13 transitions (dissolve/dip/wipe/clock/push/zoom)
│   ├── audioEngine.js       Per-element gain→pan→master graph + per-track RMS meters
│   ├── chromaKey.js         Per-pixel CbCr chroma key with feather + spill suppression
│   ├── waveform.js          decodeAudioData → cached peak Float32Array (extractPeaks)
│   ├── projectIO.js         JSON save (downloadProject) / load (pickProjectFile)
│   ├── analyzer.js          Boring-shot + jump-cut detection (analyze)
│   └── timecode.js          SMPTE-like formatting (formatTC, formatHMS, frame helpers)
├── components/
│   ├── Header.jsx           Brand, transport, undo/redo, transitions/analyzer/export, monitor toggle
│   ├── MediaLibrary.jsx     Drag-drop ingest, metadata probing, subclips, search
│   ├── SourceMonitor.jsx    Tape scrub, marks, F9/F10 inserts
│   ├── ProgramMonitor.jsx   Canvas blit, safe zones, hero empty state, audio routing, playhead advance
│   ├── CanvasOverlay.jsx    Direct-manipulation box (move/scale/rotate) over the Program canvas
│   ├── Inspector.jsx        Transform/Filters/Audio/Keyframes/Text tabs + track mixer
│   ├── Timeline.jsx         Ruler, tracks, clips, magnetic snap, rubber-band, auto-scroll, resize, zoom/Fit
│   ├── TrimEditor.jsx       A/B side-by-side filmstrip nudger
│   ├── TransitionsRail.jsx  Drag-source transition library
│   ├── AnalyzerSlideout.jsx Boring/jump-cut diagnostics panel
│   ├── ExportDialog.jsx     MediaRecorder canvas capture → WebM/MP4
│   ├── ShortcutsModal.jsx   Keyboard cheat-sheet
│   ├── WelcomeModal.jsx     First-run hero, persisted dismissal
│   ├── ContextMenu.jsx      Right-click clip actions
│   ├── StatusBar.jsx        Live FPS, draw calls, active clips, selection, history depth
│   ├── EmptyHero.jsx        Animated orb + hints when Program is empty
│   ├── Toast.jsx            Bottom-right toast stack with auto-dismiss + hover-pause
│   └── icons/IconSet.jsx    Hand-drawn SVG icon namespace (Icon.*)
├── hooks/
│   └── useKeyboard.js       Global keydown map (transport, marks, edits, project, UI)
└── styles/                  index, app, header, media-library, monitors,
                             inspector, timeline, modals, premium, animations
```

---

## Architecture

### Compositing pipeline (`engine/mediaRenderer.js`)

A single `requestAnimationFrame` loop drives a `MediaRenderer` singleton. Per tick:

1. Resolve clips active at `playhead`.
2. Sync each `<video>`/`<audio>` element's `currentTime` + `playbackRate`.
3. Per track (**bottom-up**), draw each active clip onto its lazily-cached offscreen buffer, applying transform (x/y/scale/rotation/opacity), crop, CSS filters, optional per-pixel chroma key, and vignette.
4. If a clip's `out` transition overlaps the next clip's `in`, run the transition between scratch buffers.
5. Blit each track onto the program canvas in order.

The renderer is **state-driven but decoupled from React**: `ProgramMonitor` pushes the latest state via `mediaRenderer.setState(state)` every render and registers/unregisters media elements; the RAF loop reads that snapshot. `lastFrameStats` (fps, drawCalls, activeClips) is polled by `StatusBar`. The Apple-Glass title preset samples the program canvas to fake refraction — because tracks composite bottom-up, the glass layer sees everything beneath it.

> The program canvas is a fixed **1920×1080** (`PROGRAM_W`/`PROGRAM_H`); it does not yet honor `project.width/height`. See roadmap.

### Audio is real (`engine/audioEngine.js`)

Each registered `<video>`/`<audio>` element is wrapped in `MediaElementAudioSourceNode → Gain → StereoPanner → Master Gain → destination`. The `AudioContext` is created on the first user gesture (Space/J/K/L call `audioEngine.resume()`). Per-clip volume/pan/mute/solo, per-track volume, master volume, **and keyframed volume curves** all act on the real signal. Per-track RMS meters (with peak holds + VU-style decay) are read by the inspector mixer via `getMeter(trackId)`/`getPeak(trackId)`. `getActiveAudioMix(state)` on the renderer lets the audio engine sample the same keyframed values the visuals use.

### Chroma key is per-pixel (`engine/chromaKey.js`)

CbCr-space distance per pixel with tolerance + soft feather + spill suppression. A clip with chroma key enabled draws through a scratch canvas so `getImageData/putImageData` operate on untransformed pixels; the keyed result is then composited with the clip's transforms.

### State, history, and dispatch

A single reducer (`editorReducer.js`) owns every persistent change. `EditorContext` wraps `dispatch`: for actions in `HISTORY_ACTIONS` it **dry-runs the reducer** and only pushes onto the undo stack if the state actually changed (no-op edits don't litter history). Undo/redo swap whole persistent slices via a synthetic `__replace__` action. Volatile slices (`playhead`, transport, `ui.*`, source-monitor sub-state, toasts, rubber-band rect, context-menu position) are **excluded from history** (see `history.js` `PERSISTENT_KEYS`). Derived values (`selectedClips`, `duration`, `historyDepth`) are memoized in the provider.

### Keyframes

Clips carry a `keyframes: [{ channel, time, value }]` array (time is clip-local seconds). The renderer interpolates **linearly** between keyframes per channel (`_keyframeValue`). Channels: `opacity`, `scale`, `rotation`, `x`, `y` (and volume for audio). The Keyframes tab adds at the current local playhead; markers render on the clip body color-coded by channel.

### Project I/O (`engine/projectIO.js`)

`Ctrl+S` → `downloadProject(state)` writes a JSON snapshot of persistent state. `Ctrl+O` → `pickProjectFile()` reads one back; `project/loadAll` restores it wholesale. **Blob URLs for imported media don't survive a reload** — the snapshot keeps metadata so you can re-import the same files to reattach.

---

## Implementation reference

### State shape

```
project        { name, width:1920, height:1080, fps:30, createdAt, dirty }
media          [ { id, name, kind:'video'|'audio'|'image'|'title', src, duration, thumb, meta } ]
tracks         [ { id, kind, name, height, muted, solo, locked, visible, volume, pan, color } ]
clips          [ { id, trackId, mediaId, start, end, srcIn, srcOut, transform, filters,
                   audio, transitions, keyframes, title, kind } ]
transitions    [ ]                  // standalone markers (clips also carry transitions.in/out)
playhead       0                    // volatile
playing        false                // volatile
playbackRate   1                    // sign = direction; magnitude via JKL ladder (1/2/4)
jklIndex       0                    // 0..2 ladder index
loop           false
inPoint/outPoint  null              // timeline marks (persistent)
pixelsPerSecond   60                // zoom; clamped 6..600
snap           true
source         { mediaId, playhead, inPoint, outPoint, playing }   // volatile
selectedClipIds   [ ]
inspectorTab   'transform'
master         { volume:0.8, safeZones:false }
ui             { transitionsRailOpen, shortcutsOpen, trimEditorOpen, trimClipId,
                 analyzerOpen, exportOpen, activeBladeMode, welcomeOpen,
                 contextMenu, rubberBand, monitorMode:'dual'|'single', fitToWindow }
toasts         [ { id, kind, message, ttl } ]
analyzer       { boringSeconds:6, jumpCutFrames:8 }
```

Default tracks (top→bottom): **Text/Titles, Subtitles, Video 2 — Overlay, Video 1 — Primary, Audio 1, Audio 2**.

### Action contract

All actions dispatched through the single reducer. **Bold** = recorded in undo history (`HISTORY_ACTIONS`); the rest are volatile.

**Project:** **`project/rename`**, `project/markClean`, `project/markDirty`, **`project/loadAll`**
**Media:** **`media/add`**, **`media/remove`**, **`media/addSubclip`**
**Source monitor:** `source/load`, `source/setPlayhead`, `source/togglePlay`, `source/markIn`, `source/markOut`, `source/clearMarks`
**Tracks:** **`track/add`**, **`track/update`**, **`track/remove`**, **`track/setHeight`**
**Clips:** **`clip/insertFromMedia`**, **`clip/insertTitle`**, **`clip/move`**, **`clip/trim`**, **`clip/blade`**, **`clip/delete`** (`{ ripple? }`), **`clip/duplicate`**, **`clip/update`**, **`clip/updateTransform`**, **`clip/updateFilters`**, **`clip/updateAudio`**, **`clip/updateTitle`**, **`clip/addKeyframe`**, **`clip/clearKeyframes`**
**Transitions:** **`transition/apply`** (`{ clipId, side, kind, duration }`), **`transition/clear`**
**Selection:** `select/clips`, `select/inspectorTab`
**Playback:** `playback/setPlayhead`, `playback/togglePlay`, `playback/play`, `playback/pause`, `playback/jklForward`, `playback/jklReverse`, `playback/stop`, `playback/markIn`, `playback/markOut`, `playback/clearMarks`, `playback/toggleLoop`, `playback/setZoom`, `playback/toggleSnap`
**Master:** `master/setVolume`, `master/toggleSafeZones`
**UI:** `ui/toggle`, `ui/set`, `ui/openTrimEditor`, `ui/openContextMenu`, `ui/closeContextMenu`, `ui/rubberBand`
**Analyzer:** `analyzer/setThresholds`
**Toasts:** `toast/push`, `toast/dismiss`

Reducer invariants: clip placement uses `tryPlaceClip`/`overlaps` collision checks; `snapValue` snaps times to the 1-frame grid when `snap` is on; `clamp` bounds zoom (6–600) and volumes.

### Engine module API

| Module             | Exports                                                            |
|--------------------|-------------------------------------------------------------------|
| `mediaRenderer.js` | `mediaRenderer` (singleton: `attachProgramCanvas`, `start/stop`, `setState`, `registerMedia`, `getMediaElement`, `getActiveAudioMix`, `lastFrameStats`), `PROGRAM_W`, `PROGRAM_H` |
| `titleCompositor.js`| `TITLE_PRESETS`, `drawTitle`, `drawSubtitle`, `titleBounds`        |
| `textMotion.js`    | `TEXT_MOTIONS`, `resolveMotion(motion, localT, clipDur)`           |
| `transitions.js`   | `TRANSITIONS`, `runTransition(kind, ctx, from, to, progress, w, h)`|
| `audioEngine.js`   | `audioEngine` (`resume`, `getMeter`, `getPeak`, mixing internals)  |
| `chromaKey.js`     | `applyChromaKey(...)`                                              |
| `waveform.js`      | `extractPeaks(src, buckets)`                                       |
| `projectIO.js`     | `downloadProject(state)`, `pickProjectFile()`                     |
| `analyzer.js`      | `analyze(state) → { boring[], jumpCuts[] }`                        |
| `timecode.js`      | `formatTC`, `formatHMS`, `toFrames`, `fromFrames`, `FPS`           |

**Title presets (11):** static — `glass, neon, silver, retro3d, glitch, gold, grunge`; kinetic/elemental — `fire, rock, ground, air`.
**Transitions (13):** `crossDissolve, additiveDissolve, dipToBlack, dipToWhite, wipeLeft, wipeRight, wipeUp, wipeDown, clockWipe, pushLeft, pushRight, zoomIn, zoomOut`.
**Text motions (6 + none):** `none, focus, reveal, expand, popup, rise, slide` — independent Entry/Exit with per-side duration.

### Component map

`App` → `Header`, `main`(`MediaLibrary`, `SourceMonitor`*, `ProgramMonitor`, `Inspector`), `Timeline`, `StatusBar`, then floating: `TransitionsRail`, `AnalyzerSlideout`, `TrimEditor`, `ShortcutsModal`, `ExportDialog`, `WelcomeModal`, `ContextMenu`, `Toasts`, grain overlay. *Source pane hides in single-monitor mode. `CanvasOverlay` is rendered by `ProgramMonitor`.

### Key constants

`FPS = 30` · `DEFAULT_PIXELS_PER_SECOND = 60` · `TIMELINE_DURATION = 240s` · zoom clamp `6..600 px/s` · `TRACK_HEAD_W = 180px` (must match `.cc-track` grid in `timeline.css`) · `SNAP_PX = 8` · `HISTORY_LIMIT = 50` · program canvas `1920×1080` · welcome key `cinecutpro:welcomeDismissed`.

---

## Keyboard shortcuts

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
| Ctrl+/ | Clear marks |
| F9 | Insert from Source (ripple) |
| F10 | Overwrite from Source |
| B | Blade at playhead |
| Delete / Backspace | Delete selection |
| Shift+Delete | Ripple delete |
| Ctrl+D | Duplicate selection |
| Ctrl+A | Select all clips |
| S | Toggle snap |
| \\ | Toggle dual / single monitor view |
| Ctrl+S | Save project (JSON) |
| Ctrl+O | Open project |
| Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z | Undo / redo (50 levels) |
| + / − or Ctrl+wheel | Zoom timeline |
| ? | Open shortcut sheet |
| Esc | Close modal / context menu / clear selection |

Typing targets (`input`/`textarea`/`select`/contenteditable) suppress shortcuts.

---

## Feature catalog (implemented)

- **Dual/single monitor workspace** (Source + Program), toggle in header or `\`.
- **Multi-track timeline** with magnetic snap (clip edges, playhead, in/out, frame grid), rubber-band multi-select, auto-scroll during playback, track-height drag-resize, inline zoom slider + **Fit** (`ResizeObserver`).
- **Playhead/ruler alignment** offset by the 180px track-head gutter — frame `00:00:00:00` sits at the lane's left edge; click-to-scrub is frame-accurate.
- **JKL transport** with 1×/2×/4× ladder; frame stepping; in/out marks.
- **Inspector tabs:** Transform (position/scale/rotation/opacity, PiP 3×3 preset grid, crop), Filters (brightness/contrast/saturation/hue, vignette, per-pixel chroma key), Audio (volume/pan/mute/solo), Keyframes (add/list/clear, color-coded markers), Text (presets, typography, alignment, motion).
- **Track mixer** with live RMS meters + peak holds, dB labels, fader, M/S.
- **Titles:** 7 static + 4 kinetic presets; Apple-Glass refraction samples underlying video.
- **Text motion:** iMovie-style Entry/Exit (focus/reveal/expand/popup/rise/slide) composed into `drawTitle` so it stacks with any preset.
- **Subtitles** as a distinct clip kind (captioned scrim, bottom-third default).
- **Transitions:** 13, drag from the rail onto a clip edge (nearest within ~50px), 0.7s default.
- **Direct canvas manipulation:** dashed bbox with move/scale/rotate handles mirroring the renderer transform.
- **Analyzer:** boring-shot + jump-cut detection with adjustable thresholds, jump-to-flag.
- **A/B Trim editor**, **Context menu**, **Toasts**, **Status bar** (fps/draws/active/history), **first-run Welcome**, **animated empty hero**.
- **Real Web Audio** routing; **per-pixel chroma key**; **MediaRecorder export** (WebM/MP4 with VP9 fallback); **JSON save/load**; **50-level undo/redo**.

---

## Feature improvements / roadmap

Prioritized backlog. Check items off and move them to the [Changelog](#changelog) as they land. When asked to "implement improvements," start at the top of **P0**, then **P1**, unless a specific item is named.

### P0 — correctness & safety nets
- [ ] **Add a React error boundary** around `App` (and ideally per major panel). A single render throw currently blanks the entire app with no recovery — exactly the failure mode of the `innerRef` bug. Show a recoverable error panel with a "reload"/"reset state" action.
- [ ] **Add ESLint** (`eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`) with `no-undef` and `react-hooks/*` rules. `no-undef` would have caught the `innerRef` bug at lint time. Wire `npm run lint`.
- [ ] **Add a test suite** (Vitest + React Testing Library). Cheap, high-value targets first: the pure reducer (every action + `HISTORY_ACTIONS`/no-op dry-run), `timecode`, `analyzer`, `textMotion.resolveMotion`, `transitions` registry, `history` push/undo/redo bounds. Then component smoke tests (every panel mounts with `initialState`). Add `npm run test`.
- [ ] **Guard track-zero assumptions.** `Timeline.titleTrackId/subtitleTrackId` and `clip/insert*` fall back to `state.tracks[0]`; ensure graceful behavior if all tracks are removed.

### P1 — high-value features
- [ ] **Durable media via IndexedDB.** Persist imported `File`/`Blob`s so saved projects reload intact (kills the "re-import to reattach" caveat). Rehydrate blob URLs on load.
- [ ] **Autosave** the persistent state to `localStorage`/IndexedDB and offer restore on next launch.
- [ ] **Multi-clip drag.** Dragging moves only the grabbed clip today; move the whole selection together (preserve relative offsets, respect snap/collisions).
- [ ] **Editable transitions.** Adjust transition duration after drop (timeline handles or double-click), and a picker for kind; today it's a fixed 0.7s on the nearest edge.
- [ ] **Keyframe editing.** Delete/drag individual keyframes, per-keyframe easing (the renderer interpolates linearly only), and a small value-vs-time graph.
- [ ] **Honor project resolution.** Make the compositor render at `project.width/height` instead of the hard-coded 1920×1080, including the overlay and export.
- [ ] **Audio in export.** Verify/ensure the `MediaRecorder` stream muxes the Web Audio master output alongside `canvas.captureStream()` (mixed `MediaStream`).

### P2 — polish & UX
- [ ] **Resolution/aspect presets** + project settings dialog (rename, fps, dimensions).
- [ ] **Accessibility pass:** focus trapping in modals, ARIA roles/labels on transport and timeline controls, visible focus rings, Esc/Tab semantics.
- [ ] **Thumbnail filmstrips** for video clips (sample frames to an offscreen canvas) and richer waveform caching.
- [ ] **Snapping affordances:** visual snap guides, and snap-to-other-tracks' edges.
- [ ] **Marker/region track** for notes and chapter points.
- [ ] **Per-clip speed/retime** and reverse playback for video clips.

### P3 — stretch
- [ ] **WebCodecs/WebGL pipeline.** Move chroma key and filters to a WebGL shader; consider WebCodecs for decode/encode to lift the per-frame `getImageData` cost and enable real MP4/H.264 export.
- [ ] **Migrate to TypeScript** (or thorough JSDoc types) for compile-time safety across the reducer/engine contracts.
- [ ] **Proxy/optimized playback** for large media; off-main-thread decode via Worker + `OffscreenCanvas`.
- [ ] **Collaboration/versioning** or cloud project storage.

---

## Known issues & caveats

- **No error boundary** — any uncaught render error blanks the app (see P0).
- **Blob-URL media** doesn't survive reload; re-import the same files after loading a project (until IndexedDB lands).
- **Export H.264:** Linux Chromium often lacks it; the dialog falls back to WebM VP9 (universal).
- **Apple-Glass refraction** samples the program canvas one frame late (glass draws into a track buffer blitted on top).
- **`MediaElementAudioSourceNode`** can wrap an element only once; React strict-mode's double mount is handled in `audioEngine._wire`.
- **Compositor resolution** is fixed at 1920×1080 regardless of `project.width/height`.
- **Tooling:** no tests/lint/TS yet; current workstation has no Node toolchain installed (see [Run](#run)).

---

## Changelog

> Newest first. Add an entry whenever you complete a fix or a roadmap item.

- **2026-06-23** — Fix: declared the missing `innerRef` (`useRef(null)`) in `Timeline()`. It was used at the inner content `<div>`, in the `seek` callback, and passed to `TrackRow`, but never created — throwing `ReferenceError: innerRef is not defined` during render and blanking the UI (no error boundary). Also authored this README as the project's resume-from source of truth.
- **(earlier)** — Feature work: kinetic/elemental titles (fire/rock/ground/air), iMovie-style text motion (entry/exit), PiP preset grid, vertical alignment, timeline zoom slider + Fit, playhead/ruler gutter alignment, direct canvas manipulation, dual/single monitor toggle, live mixer meters, analyzer, MediaRecorder export, JSON save/load. (Pre-existing baseline; see `git log` once a VCS/Node environment is available.)

---

## Working with this README

This file is the **handoff contract**. The intended loop:

1. **You say:** "use the README to proceed" (or "…implement improvements").
2. **I will:**
   - Read this README first (`Status`, `Roadmap`, `Known issues`).
   - Pick the next unchecked item — top of **P0**, then **P1** — unless you name a specific feature.
   - Confirm the relevant code against the [Implementation reference](#implementation-reference), implement the change end-to-end (all call sites, no stubs), and verify it (run tests/build when a Node environment is available; otherwise static verification).
   - Update this README: check the roadmap box and add a [Changelog](#changelog) entry. Add any new actions/modules/constants to the [Implementation reference](#implementation-reference).
3. **You review** and point me at the next item.

Keep the [Action contract](#action-contract), [Engine module API](#engine-module-api), and [Key constants](#key-constants) tables in sync with the code — they are what makes "use the README" enough context to continue safely.
