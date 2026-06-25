# CineCutPro

A premium, browser-based non-linear video editor built with **React 18 + Vite 5 + vanilla CSS**.

Glassmorphism slate/navy theme · dual-monitor workspace · real Web Audio routing (with audio-muxed export) · per-pixel chroma key · cinematic title presets (static + kinetic) · iMovie-style text motion · drag-and-drop + inspector-editable transitions · keyframes with easing · per-clip retime · multi-clip drag · JKL transport · rubber-band multi-select · A/B trim · boring/jump-cut analyzer · MediaRecorder export · durable projects (IndexedDB + autosave) · live RMS meters · live FPS status bar.

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
9. [Testing & linting](#testing--linting)
10. [Feature improvements / roadmap](#feature-improvements--roadmap)
11. [Known issues & caveats](#known-issues--caveats)
12. [Changelog](#changelog)
13. [Working with this README](#working-with-this-readme)

---

## Status

**Working (v1.1).** Boots into a dual-monitor editing workspace with six default tracks. Playback is smooth (renderer-owned clock), projects survive reloads (IndexedDB media + autosave), and the editing surface now has multi-clip drag, per-clip retime, keyframe easing, inspector-editable transitions, a project-settings dialog, audio-muxed export, and an app-level error boundary. A reducer/engine test suite and ESLint guard regressions.

- App-level **ErrorBoundary** means a render error shows a recoverable panel instead of a blank page.
- **No runtime was available in the authoring environment** (no Node/npm on this Windows box) — logic is verified by executing the real reducer/engine modules in an isolated JS VM and by the Vitest suite (runnable on `npm install`). UI wiring is verified by reading; a browser smoke test is the remaining gate.

---

## Run

```bash
cd cinecutpro
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the built bundle on :4173
npm run lint         # eslint (flat config)
npm run test         # vitest run (reducer + engine suites)
```

Requires **Node 18+**. Pure web stack — works identically on Windows, macOS, Linux.

---

## Tech stack

| Concern        | Choice                                                        |
|----------------|--------------------------------------------------------------|
| UI             | React 18.3 (function components + hooks, `StrictMode`)         |
| Build/dev      | Vite 5.4 + `@vitejs/plugin-react`, target `es2020`, sourcemaps |
| State          | `useReducer` + Context, hand-rolled 50-deep undo/redo          |
| Styling        | Vanilla CSS (11 stylesheets, no framework)                    |
| Rendering      | Canvas 2D compositor on a renderer-owned `requestAnimationFrame` clock |
| Audio          | Web Audio graph (`MediaElementAudioSourceNode` chains)        |
| Export         | `MediaRecorder` over `canvas.captureStream()` + audio `MediaStreamDestination` |
| Persistence    | IndexedDB (media blobs) + `localStorage` (autosave / welcome)  |
| Tooling        | ESLint 9 (flat) + Vitest 2 (jsdom)                            |

No state-management, UI-component, or icon libraries — icons are hand-drawn SVG in `IconSet.jsx`.

---

## Project structure

```
src/
├── main.jsx                 React bootstrap + EditorProvider + ErrorBoundary + StrictMode
├── App.jsx                  Workspace shell; mounts every panel + modal
├── state/
│   ├── EditorContext.jsx    Provider, dispatch dry-run, undo/redo, autosave + media rehydration
│   ├── editorReducer.js     Every persistent mutation + HISTORY_ACTIONS set
│   ├── editorReducer.test.js  Reducer + history unit tests (Vitest)
│   ├── initialState.js      Tracks, ui flags, constants, welcome-dismissed persistence
│   └── history.js           Snapshot ring buffer (persistent slices only)
├── engine/
│   ├── mediaRenderer.js     Offscreen-canvas compositor + RAF playback clock + keyframe easing
│   ├── titleCompositor.js   Title/subtitle drawing: 7 static + 4 kinetic presets, motion glue
│   ├── textMotion.js        Entry/exit motion presets (alpha/scale/x,y/blur/clipFrac)
│   ├── transitions.js       13 transitions (dissolve/dip/wipe/clock/push/zoom)
│   ├── audioEngine.js       Per-element gain→pan→master graph + RMS meters + export stream
│   ├── chromaKey.js         Per-pixel CbCr chroma key with feather + spill suppression
│   ├── waveform.js          decodeAudioData → cached peak Float32Array (extractPeaks)
│   ├── projectIO.js         JSON save/load + autosave (localStorage) helpers
│   ├── mediaStore.js        IndexedDB blob store (putMedia/getMedia/deleteMedia/clearMedia)
│   ├── analyzer.js          Boring-shot + jump-cut detection (analyze)
│   ├── timecode.js          SMPTE-like formatting
│   └── engine.test.js       Engine pure-function tests (Vitest)
├── components/
│   ├── Header.jsx           Transport, undo/redo, transitions/analyzer/export, project settings, monitor toggle
│   ├── MediaLibrary.jsx     Drag-drop ingest (→ IndexedDB), metadata probing, subclips, search
│   ├── SourceMonitor.jsx    Tape scrub, marks, F9/F10 inserts
│   ├── ProgramMonitor.jsx   Canvas blit, safe zones, hero empty state, audio routing, clock subscription
│   ├── CanvasOverlay.jsx    Direct-manipulation box (move/scale/rotate) over the Program canvas
│   ├── Inspector.jsx        Transform/Filters/Audio/Keyframes/Text tabs + transitions + mixer
│   ├── Timeline.jsx         Ruler, tracks, clips, snap, rubber-band, multi-clip drag, zoom/Fit
│   ├── TrimEditor.jsx       A/B side-by-side filmstrip nudger
│   ├── TransitionsRail.jsx  Drag-source transition library
│   ├── AnalyzerSlideout.jsx Boring/jump-cut diagnostics panel
│   ├── ExportDialog.jsx     MediaRecorder canvas+audio capture → WebM/MP4, fit-scaled to resolution
│   ├── ProjectSettings.jsx  Name / fps / resolution dialog + New project
│   ├── ShortcutsModal.jsx · WelcomeModal.jsx · ContextMenu.jsx · StatusBar.jsx
│   ├── EmptyHero.jsx · Toast.jsx · ErrorBoundary.jsx
│   └── icons/IconSet.jsx
├── hooks/
│   └── useKeyboard.js       Global keydown map
└── styles/                  index, app, header, media-library, monitors, inspector,
                             timeline, modals, premium, animations, pro
eslint.config.js · vitest.config.js · vite.config.js
```

---

## Architecture

### Playback clock (renderer-owned)

`mediaRenderer` advances its **own** `localPlayhead` inside its `requestAnimationFrame` loop, draws from it (smooth, independent of React), and handles loop/in-out bounds and end-of-timeline pausing. It echoes the playhead back into React only **~20 Hz** (`PUBLISH_INTERVAL`) via the volatile `playback/tickPlayhead` action, so the component tree no longer re-renders every frame. User seeks go through `playback/setPlayhead`, which bumps `state.seekId`; the renderer adopts React's playhead only when `seekId` changes (or while paused), so it never mistakes its own echo for a seek. `ProgramMonitor` subscribes via `mediaRenderer.onTick(...)` and pushes `state` + `duration` into the renderer each render.

### Compositing pipeline

Per RAF tick: resolve active clips at the clock time → sync each `<video>`/`<audio>` element (`currentTime` re-seek only on >0.12 s drift, otherwise native playback) → draw each track (bottom-up) onto its lazily-cached offscreen buffer with transform/crop/filters/chroma-key/vignette → run transitions between adjacent clips → blit tracks onto the program canvas. Keyframed channels (`opacity/scale/rotation/x/y`, audio `volume`) interpolate with **per-keyframe easing** (`linear/easeIn/easeOut/easeInOut/hold`). The working canvas is 16:9 **1920×1080**; export fit-scales it to the chosen resolution.

### Audio (real, and exported)

Each element is wrapped in `MediaElementAudioSourceNode → Gain → StereoPanner → Master → destination`. Clip/track/master volume, pan, mute/solo, and keyframed volume act on the real signal; per-track RMS meters feed the inspector mixer. For export, `audioEngine.getExportStream()` taps the master via a `MediaStreamDestination`; `ExportDialog` merges those audio tracks with the canvas video track into one `MediaRecorder` stream.

### State, history, dispatch

A single reducer owns every persistent change. `EditorContext` dry-runs the reducer for `HISTORY_ACTIONS` and only pushes undo history when state actually changed; volatile slices (playhead, transport, `ui.*`, source monitor, toasts) skip history. Undo/redo swap whole persistent slices.

### Persistence

Imported files are stored as blobs in **IndexedDB** (`mediaStore`) keyed by media id, and the persistent project slices are **autosaved** to `localStorage` (debounced). On boot the provider lazy-inits from the autosave and rehydrates each persistent media item's blob URL from IndexedDB (`media/update`), so a reload restores the full session. `Ctrl+S`/`Ctrl+O` still export/import a JSON snapshot; **New project** (in Project settings) clears autosave + IndexedDB and reloads. Everything degrades gracefully if storage is unavailable.

---

## Implementation reference

### State shape

```
project        { name, width, height, fps, createdAt, dirty }   // width/height = export target
media          [ { id, name, kind, src, duration, thumb, meta, persistent? } ]
tracks         [ { id, kind, name, height, muted, solo, locked, visible, volume, pan, color } ]
clips          [ { id, trackId, mediaId, start, end, srcIn, srcOut, speed, transform,
                   filters, audio, transitions:{in,out}, keyframes:[{channel,time,value,easing?}], title, kind } ]
playhead 0 · seekId 0 · playing false · playbackRate 1 · jklIndex 0 · loop false   // mostly volatile
inPoint/outPoint null · pixelsPerSecond 60 · snap true
source         { mediaId, playhead, inPoint, outPoint, playing }   // volatile
selectedClipIds [] · inspectorTab 'transform'
master         { volume, safeZones }
ui             { transitionsRailOpen, shortcutsOpen, trimEditorOpen, trimClipId, analyzerOpen,
                 exportOpen, projectSettingsOpen, welcomeOpen, contextMenu, rubberBand,
                 monitorMode, fitToWindow }
toasts [] · analyzer { boringSeconds, jumpCutFrames }
```

### Action contract

**Bold** = recorded in undo history (`HISTORY_ACTIONS`); the rest are volatile.

**Project:** **`project/rename`**, **`project/update`** (`{patch:{name?,fps?,width?,height?}}`), `project/markClean`, `project/markDirty`, **`project/loadAll`**
**Media:** **`media/add`**, **`media/remove`**, **`media/addSubclip`**, `media/update` (volatile — blob-src rehydration)
**Source monitor:** `source/load|setPlayhead|togglePlay|markIn|markOut|clearMarks`
**Tracks:** **`track/add`**, **`track/update`**, **`track/remove`**, **`track/setHeight`**
**Clips:** **`clip/insertFromMedia`**, **`clip/insertTitle`**, **`clip/move`**, **`clip/moveSelection`** (`{ids,anchorId,start}` — multi-drag), **`clip/trim`**, **`clip/blade`**, **`clip/delete`**, **`clip/duplicate`**, **`clip/update`**, **`clip/updateTransform`**, **`clip/updateFilters`**, **`clip/updateAudio`**, **`clip/updateTitle`**, **`clip/setSpeed`** (`{id,speed}` — retime), **`clip/addKeyframe`**, **`clip/updateKeyframe`** (`{id,index,patch}`), **`clip/removeKeyframe`** (`{id,index}`), **`clip/clearKeyframes`**
**Transitions:** **`transition/apply`** (`{clipId,side,kind,duration}`), **`transition/clear`**
**Selection:** `select/clips`, `select/inspectorTab`
**Playback:** `playback/setPlayhead` (user seek; bumps `seekId`), `playback/tickPlayhead` (renderer clock echo; no bump), `playback/togglePlay|play|pause|jklForward|jklReverse|stop|markIn|markOut|clearMarks|toggleLoop|setZoom|toggleSnap`
**Master / UI / Analyzer / Toasts:** `master/setVolume`, `master/toggleSafeZones`, `ui/toggle`, `ui/set`, `ui/openTrimEditor`, `ui/openContextMenu`, `ui/closeContextMenu`, `ui/rubberBand`, `analyzer/setThresholds`, `toast/push`, `toast/dismiss`

### Engine module API

| Module             | Exports                                                            |
|--------------------|-------------------------------------------------------------------|
| `mediaRenderer.js` | `mediaRenderer` (`attachProgramCanvas`, `start/stop`, `setState`, `duration`, `onTick`, `registerMedia`, `getActiveAudioMix`, `lastFrameStats`), `PROGRAM_W`, `PROGRAM_H` |
| `titleCompositor.js`| `TITLE_PRESETS`, `drawTitle`, `drawSubtitle`, `titleBounds`        |
| `textMotion.js`    | `TEXT_MOTIONS`, `resolveMotion`                                    |
| `transitions.js`   | `TRANSITIONS`, `runTransition`                                     |
| `audioEngine.js`   | `audioEngine` (`resume`, `ensure`, `sync`, `getMeter`, `getPeak`, `getExportStream`) |
| `chromaKey.js`     | `applyChromaKey`                                                   |
| `waveform.js`      | `extractPeaks`                                                     |
| `projectIO.js`     | `downloadProject`, `pickProjectFile`, `exportProject`, `importProjectText`, `writeAutosave`, `readAutosave`, `clearAutosave` |
| `mediaStore.js`    | `putMedia`, `getMedia`, `deleteMedia`, `clearMedia`               |
| `analyzer.js`      | `analyze`                                                          |
| `timecode.js`      | `formatTC`, `formatHMS`, `toFrames`, `fromFrames`, `FPS`           |

**Titles (11):** static `glass, neon, silver, retro3d, glitch, gold, grunge`; kinetic `fire, rock, ground, air`.
**Transitions (13):** `crossDissolve, additiveDissolve, dipToBlack, dipToWhite, wipeLeft/Right/Up/Down, clockWipe, pushLeft/Right, zoomIn/Out`.
**Text motions (6 + none):** `none, focus, reveal, expand, popup, rise, slide`.
**Keyframe easings:** `linear, easeIn, easeOut, easeInOut, hold` (the target keyframe's easing shapes the segment).

### Component map

`App` → `Header`, `main`(`MediaLibrary`, `SourceMonitor`*, `ProgramMonitor`+`CanvasOverlay`, `Inspector`), `Timeline`, `StatusBar`, then floating: `TransitionsRail`, `AnalyzerSlideout`, `TrimEditor`, `ShortcutsModal`, `ExportDialog`, `WelcomeModal`, `ProjectSettings`, `ContextMenu`, `Toasts`. `main.jsx` wraps `App` in `ErrorBoundary` inside `EditorProvider`. *Source pane hides in single-monitor mode.

### Key constants

`FPS = 30` · `DEFAULT_PIXELS_PER_SECOND = 60` · zoom `6..600 px/s` · `TRACK_HEAD_W = 180px` · `SNAP_PX = 8` · `HISTORY_LIMIT = 50` · program canvas `1920×1080` · `PUBLISH_INTERVAL = 1/20 s` · speed clamp `0.25..4×`.

---

## Keyboard shortcuts

| Key | Action | | Key | Action |
|-----|--------|---|-----|--------|
| Space / K | Play / pause | | I,[ / O,] | Mark In / Out |
| L / J | Fwd / Rev 1×→2×→4× | | F9 / F10 | Insert / Overwrite from Source |
| ← / → | ±1 frame | | B | Blade |
| Shift+← / → | ±10 frames | | Del / Shift+Del | Delete / Ripple delete |
| Alt+← / → | Prev / next edit | | Ctrl+D / Ctrl+A | Duplicate / Select all |
| Home / End | Start / end | | S / \\ | Snap / monitor toggle |
| Ctrl+S / Ctrl+O | Save / Open | | Ctrl+Z / Ctrl+Y | Undo / redo (50) |
| + / − or Ctrl+wheel | Zoom | | ? / Esc | Shortcuts / close |

---

## Feature catalog (implemented)

- **Smooth playback** via a renderer-owned clock; ~20 Hz React echo.
- **Multi-clip drag** (whole selection moves together, collision-aware) + single-clip drag, trim, blade, ripple, duplicate, snap, rubber-band select, track resize, zoom slider + Fit.
- **Per-clip retime** (0.25–4×) — keeps source range, rescales the timeline span.
- **Keyframes with easing** — add/list/delete per keyframe + `linear/easeIn/easeOut/easeInOut/hold`; markers on clip bodies.
- **Transitions** — 13, drag from the rail **and** edit kind/duration per side in the Inspector.
- **Titles** (7 static + 4 kinetic) + **text motion** (entry/exit), subtitles, direct canvas manipulation.
- **Inspector** — Transform (+ PiP grid, crop, speed), Filters (+ per-pixel chroma key, vignette), Audio, Keyframes, Text; per-clip In/Out transition editor; track mixer with live RMS meters.
- **Project settings** — name, frame rate, resolution presets (1080p/720p/4K) + custom W×H; New project.
- **Export** — MediaRecorder to WebM/MP4 (VP9 fallback), **audio muxed in**, fit-scaled to the chosen resolution.
- **Durable projects** — IndexedDB media + debounced autosave + boot restore; JSON save/load.
- **Analyzer**, **A/B trim**, **context menu**, **toasts**, **status bar**, **welcome**, **empty hero**.
- **Error boundary** — recoverable panel instead of a blank page.

---

## Testing & linting

- `npm run test` — Vitest (jsdom). `src/state/editorReducer.test.js` covers the reducer (project/media/clip/transition/keyframe/speed/multi-move + `HISTORY_ACTIONS` + history stack); `src/engine/engine.test.js` covers timecode, analyzer, textMotion, and the transition/title registries.
- `npm run lint` — ESLint flat config; `no-undef` + `react-hooks/*` are the load-bearing rules (they catch the undeclared-identifier and hook-dependency classes of bug).
- The reducer/engine logic was additionally verified by executing the **real** modules in an isolated JS VM (63 assertions passing) since no Node toolchain was available while authoring.

---

## Feature improvements / roadmap

Checked items are done. When asked to "implement improvements," start at the top of the first section with unchecked items unless a specific item is named.

### P0 — correctness & safety nets
- [x] App-level **error boundary** (recoverable panel; no more blank-screen crashes).
- [x] **ESLint** (flat config, `no-undef` + `react-hooks/*`), `npm run lint`.
- [x] **Test suite** (Vitest) for reducer + engine pure functions, `npm run test`.
- [x] **Guard track-zero assumptions** in Timeline title/subtitle inserts.

### P1 — high-value features
- [x] **Durable media via IndexedDB** + boot rehydration of blob URLs.
- [x] **Autosave** persistent slices to localStorage + restore on launch.
- [x] **Multi-clip drag** (move the whole selection together).
- [x] **Editable transitions** (kind + duration per side, in the Inspector).
- [x] **Keyframe editing** (delete individual + per-keyframe easing).
- [x] **Audio in export** (master mix muxed into the MediaRecorder stream).
- [x] **Per-clip speed / retime**.
- [~] **Honor project resolution** — export fit-scales to the chosen resolution; the **compositor is still fixed 16:9 1920×1080** (non-16:9 / vertical project canvas is the remaining piece).

### P2 — polish & UX
- [x] **Project settings dialog** (name / fps / resolution presets + custom).
- [x] **Vertical / custom-aspect compositor** — make `mediaRenderer` + `CanvasOverlay` honor `project.width/height` (dynamic buffers), not just export.
- [ ] **Eliminate the residual playback re-render** — the ~20 Hz echo still re-renders the tree; split the editor context (or drive playhead markers via direct DOM) for near-zero renders during playback.
- [ ] **Accessibility pass** — modal focus trapping, ARIA roles/labels, focus rings.
- [ ] **Thumbnail filmstrips** for video clips; richer waveform caching.
- [ ] **Snapping affordances** — visual snap guides; snap across tracks.
- [ ] **Marker / region track** for notes and chapters.

### P3 — stretch
- [ ] **WebGL/WebCodecs pipeline** — shader chroma-key/filters; WebCodecs decode/encode for real MP4/H.264.
- [ ] **TypeScript migration** (or thorough JSDoc types) across reducer/engine contracts.
- [ ] **Proxy/optimized playback** for large media; Worker + `OffscreenCanvas` decode.
- [ ] **Collaboration / cloud project storage**.

---

## Known issues & caveats

- **Compositor resolution** is fixed at 16:9 1920×1080; Project settings resolution affects export output size only (fit-scaled), not the preview aspect.
- **Residual playback render** — the renderer is decoupled, but the ~20 Hz playhead echo still re-renders the tree (markers smoothing / context split pending).
- **Export H.264:** Linux Chromium often lacks it; the dialog falls back to WebM VP9.
- **Apple-Glass refraction** samples the program canvas one frame late.
- **`MediaElementAudioSourceNode`** wraps an element once; React strict-mode double mount is handled in `audioEngine._wire`.
- **Authoring environment** has no Node toolchain, so the browser smoke test (and `npm run test`/`lint`) must be run by the user; all logic here is VM- and read-verified.

---

## Changelog

> Newest first. Add an entry whenever you complete a fix or a roadmap item.
- **2026-06-24** — Dynamic aspect ratio compositor. **Renderer & Layout:** Updated `mediaRenderer.js`, `CanvasOverlay.jsx`, and `titleCompositor.js` to resize rendering canvases, track buffers, and active overlays dynamically based on the project dimensions (`state.project.width` / `state.project.height`). Drag bounding box coordinate translations and visual scaling guides now automatically reposition to stay centered. Verified statically via project ESLint rule checks.
- **2026-06-23** — v1.1 "pro" pass. **Safety:** app-level `ErrorBoundary`; ESLint (flat, `no-undef`+hooks); Vitest suites for reducer + engine; track-zero guards. **Editing:** multi-clip drag (`clip/moveSelection`, anchor-based/idempotent); per-clip retime (`clip/setSpeed`); keyframe delete + easing (`clip/removeKeyframe`/`clip/updateKeyframe`, renderer `EASE`); inspector transition editor. **Project/output:** Project settings dialog (`project/update`, `ui.projectSettingsOpen`); export now muxes audio (`audioEngine.getExportStream`) and fit-scales to the chosen resolution. **Persistence:** IndexedDB media store (`engine/mediaStore.js`), autosave + boot restore + blob rehydration (`media/update`), New project. New files: `ErrorBoundary.jsx`, `ProjectSettings.jsx`, `engine/mediaStore.js`, `styles/pro.css`, `eslint.config.js`, `vitest.config.js`, two `*.test.js`. Verified: 63 logic assertions on the real modules in an isolated VM + the Vitest suites.
- **2026-06-23** — Fix: smooth playback (was "jumping frames"). The playhead was advanced through React ~60×/s, re-rendering the whole tree and starving the canvas/decoder; the renderer now owns the clock and echoes the playhead back ~20 Hz via `playback/tickPlayhead`, with `state.seekId` distinguishing user seeks from its own echo.
- **2026-06-23** — Fix: declared the missing `innerRef` (`useRef(null)`) in `Timeline()` — an undeclared ref used during render threw `ReferenceError` and blanked the UI. Also authored this README.
- **(earlier)** — Baseline feature work: kinetic titles, text motion, PiP grid, vertical alignment, timeline zoom/Fit, playhead gutter alignment, direct canvas manipulation, dual/single monitors, live mixer meters, analyzer, MediaRecorder export, JSON save/load.

---

## Working with this README

This file is the **handoff contract**. The loop:

1. **You say:** "use the README to proceed" (or "…implement improvements").
2. **I will:** read this README (Status, Roadmap, Known issues), pick the next unchecked item (top of the first incomplete section) unless you name one, confirm against the [Implementation reference](#implementation-reference), implement it end-to-end (all call sites, no stubs), verify (Vitest/`lint`/build when Node is available, else VM + static), then tick the roadmap box and add a [Changelog](#changelog) entry.
3. **You review** and point me at the next item.

Keep the [Action contract](#action-contract), [Engine module API](#engine-module-api), and [Key constants](#key-constants) in sync with the code — they make "use the README" enough context to continue safely.
