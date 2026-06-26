# CineCutPro — Master Implementation Plan

**From a working browser NLE (v1.1) to a production-grade, cross-platform professional video editor.**

> This document is the engineering north star. It pairs with `README.md` (the current-state handoff contract). The README describes *what is*; this plan describes *what we are building toward and in what order*. Every phase below ends with concrete exit criteria so progress is measurable, not aspirational.

---

## Table of contents

1. [Vision & success criteria](#1-vision--success-criteria)
2. [Current state assessment](#2-current-state-assessment)
3. [The core architectural decision](#3-the-core-architectural-decision)
4. [Target architecture](#4-target-architecture)
5. [Project / data model](#5-project--data-model)
6. [The rendering pipeline](#6-the-rendering-pipeline)
7. [The effects pipeline](#7-the-effects-pipeline)
8. [The audio engine](#8-the-audio-engine)
9. [The animation / keyframe engine](#9-the-animation--keyframe-engine)
10. [The timeline engine](#10-the-timeline-engine)
11. [Undo/redo, history & collaboration](#11-undoredo-history--collaboration)
12. [Media engine, import & export](#12-media-engine-import--export)
13. [AI feature subsystem](#13-ai-feature-subsystem)
14. [Performance strategy](#14-performance-strategy)
15. [Professional UI/UX](#15-professional-uiux)
16. [Plugin architecture & SDK](#16-plugin-architecture--sdk)
17. [Complete feature matrix](#17-complete-feature-matrix)
18. [Phased development roadmap](#18-phased-development-roadmap)
    - [18b. Native core track (C++/Rust pro engine)](#18b-native-core-track-crust-pro-engine--the-hybrids-second-rail)
19. [Testing, QA & release engineering](#19-testing-qa--release-engineering)
20. [Risks, trade-offs & open questions](#20-risks-trade-offs--open-questions)
21. [Folder structure (target)](#21-folder-structure-target)

---

## 1. Vision & success criteria

CineCutPro becomes a **cross-platform (Windows / macOS / Linux) non-linear editor** whose core editing, color, audio, motion-graphics, and delivery feature set is competitive with CapCut (consumer/social speed + AI), iMovie (approachability), and the professional tier (DaVinci Resolve, Premiere Pro, Final Cut Pro). It keeps a **web build** (PWA) for lightweight/collaborative work and ships a **desktop build** for full hardware-accelerated, native-codec, large-project performance.

**Definition of done (production-ready v3.0):**

| Pillar | Target |
|--------|--------|
| Editing | Frame-accurate trim/ripple/roll/slip/slide, magnetic + overwrite timelines, multicam, nested sequences/compound clips, full keyframe animation with bezier curves. |
| Image quality | GPU-accelerated, color-managed (linear-light, ACES/OCIO) compositor; 8/10/12-bit, HDR (PQ/HLG), LUT, 3-way + curves color, scopes. |
| Performance | 4K timeline scrubs at ≥24 fps on a mid-range GPU; proxy + background render; project open < 2 s for 1k-clip projects. |
| Delivery | Hardware H.264/HEVC/AV1/ProRes export via FFmpeg/WebCodecs; alpha; 4K/8K/HDR/high-FPS; platform presets (YouTube/TikTok/Reels/etc.). |
| Audio | Multitrack mixer, EQ/compressor/limiter, ducking, denoise, beat detection, automation, loudness-normalized export. |
| AI | On-device background removal, captions/transcription, reframe, scene detect; cloud for transcription/translation/generation. |
| Extensibility | Sandboxed plugin SDK (effects, transitions, exporters, AI, panels). |
| Reliability | Autosave + version history + crash recovery; deterministic render; CI with unit/integration/visual/perf gates. |

**Non-goals (initially):** real-time multi-user co-editing (planned but late), film-scanner/DCP mastering, broadcast SDI I/O hardware integration.

---

## 2. Current state assessment

What exists today (verified against the source tree, ~13.4K LOC):

**Strengths to keep**
- Clean **reducer + Context** state core (`state/editorReducer.js`, `EditorContext.jsx`) with a disciplined action contract and a 50-deep snapshot undo/redo (`state/history.js`).
- A **renderer-owned playback clock** decoupled from React (`engine/mediaRenderer.js`) — smooth playback, ~20 Hz echo. This is the right instinct and must survive the rewrite.
- A real **Web Audio graph** with export muxing (`engine/audioEngine.js`).
- Already-present "pro" scaffolding from the latest commit: composable **effects registry** (`engine/effectsRegistry.js`), **LUT** parser (`engine/lutParser.js`), **scene detector** (`engine/sceneDetector.js`), **color scopes** (`engine/colorScopes.js`), **snap engine** (`engine/snapEngine.js`), **DAW mixer** (`components/AudioMixer.jsx`), **3-way color** UI (`components/ColorGrading.jsx`), markers (`components/TimelineMarkers.jsx`), subtitle export (`engine/subtitleExporter.js`), schema **migrator** (`engine/migrator.js`).
- State is already **versioned (v2)** with `sequences`, `markers`, `clipboard`, `versionHistory`, composable `clip.effects[]`, and extended project config (`colorSpace`, `sampleRate`, `proxyMode`).
- **Durable projects** (IndexedDB blobs + autosave).

**Hard limits of the current foundation (the reasons for the architecture pivot)**
1. **Canvas2D compositor.** `mediaRenderer.js` composites per-pixel on the CPU (chroma key, LUT, effects all loop over `ImageData`). This cannot scale to 4K/multi-layer/real-time and cannot be color-managed or HDR. → must move to **GPU (WebGPU/wgpu)**.
2. **MediaRecorder export.** Output is whatever the browser's recorder produces (often WebM/VP9), wall-clock-bound, not frame-accurate, no ProRes/real H.264, no alpha. → must move to **WebCodecs / native FFmpeg** offline render.
3. **No native layer.** Browser sandbox blocks large-file random access, hardware decode of arbitrary formats, VST hosting, and OS-level GPU/threads. → needs a **desktop shell** for the pro tier.
4. **JavaScript-only engine.** Decode/scale/encode/optical-flow in JS won't hit pro performance. → heavy media core moves to **Rust/WASM + native**.
5. **No types.** A pro engine of this size needs **TypeScript** (or exhaustive JSDoc) to stay maintainable.
6. **Snapshot undo** clones whole slices — fine now, too heavy for large projects. → move to **command/patch-based** history.

The strategy below **preserves the good parts** (reducer discipline, renderer-owned clock, action contract) while replacing the compositor, exporter, and codec layers and adding a desktop shell + native media core.

---

## 3. The core architectural decision

The single most consequential choice is **how to escape the browser sandbox without throwing away the web app**.

> **Decision (confirmed): the HYBRID strategy.** Keep shipping and evolving the **web app** (the current React/TS codebase + the merged Phase 0 edit-engine core) as the always-runnable product, and in parallel build a **native pro core** (C++/Rust) for the desktop tier. Both sit behind the same capability interfaces; a Tauri 2 shell hosts the web UI over the native core. The web build runs a reduced tier; the desktop build unlocks native codecs, GPU, OpenFX/VST, and large-project performance.
>
> This is what makes the plan a **superset** of both the web-first roadmap *and* the native-C++ roadmap (see §18b): native-only deliverables (OpenFX host, FreeType/HarfBuzz shaping, Vulkan/Metal/DX12, lock-free audio, zero-copy VRAM) live in the native core track; everything else ships on the web track first and is shared.

**Why a native core (not web-only):** OpenFX hosting, VST3/AU, 32-bit-float ACEScg compositing, lock-free sample-accurate audio, zero-copy decoder→VRAM paths, and MXF/ProRes coverage are not achievable in the browser sandbox. **Why keep the web app (not native-only):** CapCut-class zero-install onboarding, collaboration/review, a continuous demo, and it *forces* the clean capability boundary that keeps both tiers honest.

**Why Tauri 2 (shell) + a Rust/C++ core:** Tauri gives a thin cross-platform shell hosting the existing web UI; the heavy lifting moves into a **Rust core** (with C/C++ libraries — FFmpeg, OpenColorIO, an OFX host, HarfBuzz) exposed to the UI through the capability interfaces. Electron is the fallback only if a hard dependency needs Chromium-only APIs.

**Why keep the web build:** CapCut-class onboarding, zero-install collaboration/review, and it forces a clean abstraction boundary (no backend feature may be reachable except through an interface that also has a browser implementation). The web build runs a **reduced** tier (WebCodecs export, FFmpeg.wasm fallback, no VST).

**The portability rule:** every capability is defined as a TypeScript **interface** with at least two implementations — `web` (WebGPU/WebCodecs/IndexedDB) and `native` (wgpu/FFmpeg/filesystem). The UI and edit engine never call a backend directly.

```
┌───────────────────────────────────────────────────────────┐
│  UI (React + TS)  —  panels, timeline, inspector, viewers  │
├───────────────────────────────────────────────────────────┤
│  Edit Engine (pure TS) — model, commands, history,         │
│  scheduler, keyframes, timeline ops  (NO platform calls)   │
├───────────────────────────────────────────────────────────┤
│  Capability interfaces:  RenderBackend · CodecIO ·         │
│  Storage · AudioBackend · AIProvider · FS · GPUCompute     │
├──────────────────────────┬────────────────────────────────┤
│  WEB impls               │  NATIVE impls (Tauri/Rust)      │
│  WebGPU, WebCodecs,      │  wgpu, FFmpeg, OS FS, VST host, │
│  FFmpeg.wasm, IndexedDB, │  ONNX/CoreML/DirectML,          │
│  OPFS, WebAudio          │  hardware NVENC/QSV/VideoToolbox│
└──────────────────────────┴────────────────────────────────┘
```

---

## 4. Target architecture

### 4.1 Layers

| Layer | Responsibility | Tech |
|-------|----------------|------|
| **Shell** | Window, menus, FS, updates, sidecars | Tauri 2 (Rust) / PWA |
| **UI** | Panels, docking, timeline canvas, inspector, viewers | React 18 + TypeScript, Zustand for view state, virtualized timeline |
| **Edit Engine** | Project model, timeline ops, command bus, history, keyframe solver, scheduler | Pure TypeScript (framework-agnostic, unit-testable headless) |
| **Render Graph** | Frame composition DAG, color management, effects, transitions | WebGPU (browser) / wgpu (native), WGSL shaders shared |
| **Media Core** | Decode/encode, proxy gen, scaling, optical flow, scopes | Rust (native) + Rust→WASM (web), WebCodecs where available |
| **Audio Core** | Mix graph, DSP effects, automation, offline bounce | WebAudio (monitor) + Rust DSP / offline render (export) |
| **AI Core** | Inference runtime + model registry | ONNX Runtime (web/native), CoreML/DirectML, cloud (Claude API) |
| **Persistence** | Project file, media DB, cache, autosave | SQLite (native) / IndexedDB+OPFS (web); content-addressed cache |

### 4.2 Design patterns
- **Command pattern** for every mutation → enables undo/redo, scripting, macros, and the plugin API surface.
- **Reducer/store** retained for UI-facing state; the edit engine emits immutable model snapshots the store consumes.
- **Strategy** for backends (render/codec/storage/AI).
- **Composite** for the render graph (clips → tracks → sequence → nested sequences).
- **Observer** for the playback clock and scope/meter taps.
- **Factory + registry** for effects, transitions, exporters, generators, AI ops, and plugins.
- **Object pool** for GPU textures, decode buffers, and AudioBuffers.

### 4.3 Threading / process model
- **UI thread**: React + interaction only.
- **Engine worker**: edit-engine evaluation, scheduling, keyframe solving (Web Worker / Rust thread).
- **Render workers**: decode + GPU submission via `OffscreenCanvas`; one pipeline, N decode workers.
- **Audio thread**: `AudioWorklet` (web) / dedicated real-time thread (native).
- **Background**: proxy generation, render cache warming, AI inference, thumbnail/waveform extraction — all preemptible job queue.

---

## 5. Project / data model

Evolve the current `state` shape (already v2) into a normalized, versioned, migration-safe document. Keep the reducer-friendly flat maps.

```ts
Project {
  schemaVersion: number
  meta: { id, name, createdAt, modifiedAt, app, author }
  settings: {
    width, height, fps, dropFrame, sampleRate, bitDepth, channels,
    colorSpace: 'rec709'|'rec2020'|'sRGB'|'displayP3'|'aces-cg',
    transfer: 'sdr'|'pq'|'hlg', workingBitDepth: 8|16|32f,
    proxyMode, renderCacheDir, scrubAudio
  }
  media:      Record<id, MediaAsset>      // source assets (content-addressed)
  bins:       Record<id, Bin>             // media library tree, smart bins
  sequences:  Record<id, Sequence>        // a project has many; one open
  activeSequenceId: id
}

Sequence { id, name, settings?, tracks: Track[], markers: Marker[], inPoint, outPoint }
Track    { id, kind:'video'|'audio'|'subtitle'|'adjustment', name, index,
           enabled, locked, muted, solo, height, blendMode, clips: id[] }
Clip {
  id, trackId, mediaId|null, kind:'av'|'image'|'title'|'shape'|'nested'|'compound'|'generator'|'adjustment',
  start, duration,                         // timeline position (frames)
  srcIn, srcOut, speed, reversed, timeRemap?: Curve,
  enabled, label, color, groupId?, linkedId?, nestedSequenceId?,
  transform: { x,y,scale,scaleX,scaleY,rotation,anchor,opacity,blendMode },
  crop, mask?: Mask[], motionTracker?: TrackId,
  effects: EffectInstance[],               // ordered stack
  transitions: { in?: Transition, out?: Transition },
  audio: { gain, pan, mute, channels, automation: Curve[] },
  keyframes: KeyframeChannel[],            // param path → keyframes (bezier)
  speedRamp?: Curve, captions?: CaptionRef
}
EffectInstance { id, effectId, enabled, params: Record<string,Value|Curve>, mask?, blend }
Keyframe { time, value, interp:'linear'|'bezier'|'hold'|'ease', inHandle, outHandle }
Marker   { id, time, duration?, color, name, note, kind:'standard'|'chapter'|'todo'|'beat' }
MediaAsset { id, hash, name, kind, uri, proxyUri?, duration, fps, width, height,
             colorSpace, audioStreams, metadata, tags[], scenes?: number[], waveformRef }
```

**Rules**
- Frames (not seconds) are the canonical time unit on the timeline → frame-accurate, fps-agnostic math.
- Media is **content-addressed by hash** → dedupe + reliable relink.
- Everything mutates through **commands**, never direct edits → history + scripting for free.
- A **migrator** (already started in `engine/migrator.js`) upgrades old `schemaVersion` documents on load. Never break old projects.

---

## 6. The rendering pipeline

Replace the CPU Canvas2D compositor with a **color-managed GPU render graph**. This is the centerpiece of the rewrite.

### 6.1 Frame evaluation (per requested time `t`)
1. **Resolve** active clips per track at `t` (the existing renderer already does temporal resolution — reuse the logic).
2. **Decode** each needed source frame → GPU texture (WebCodecs `VideoFrame` / native decode → texture upload). Decode is cached + prefetched.
3. **Build the graph**: clip node → effect-stack nodes → transform node → mask node → track-composite node → transition node → sequence-composite. Nested sequences recurse.
4. **Convert to working space** on input (e.g. Rec.709 → linear) → composite in **linear light** → tone-map/convert to display/output space.
5. **Composite** tracks bottom-up with per-track blend modes; apply adjustment layers to everything beneath.
6. **Output** to the viewer (display-referred) and, for export, to the encoder (output-referred, correct transfer).

### 6.2 Color management (non-negotiable for "pro")
- Working space: **linear, 16-bit float** GPU textures.
- Input/output transforms via **OCIO-style config**; ACES option for HDR/film.
- HDR: PQ/HLG output, tone mapping for SDR preview, scopes in the working space.
- LUT (`.cube`) applied as a 3D texture in-shader (replaces the CPU `lutParser` path for realtime; keep CPU parser for thumbnails).

### 6.3 Realtime vs. quality
- **Draft path**: lower-res proxy + reduced effect quality for smooth scrubbing.
- **Render cache**: composited segments cached to disk (content-addressed by the graph hash); invalidated only on the parameters that changed. Background renderer warms the cache.
- **Frame-accurate seek**: decode nearest keyframe + decode-forward; cache GOP.

### 6.4 Shaders
- WGSL shaders shared between WebGPU (browser) and wgpu (native).
- Each effect = a shader pass with typed uniforms; transitions = two-input shader passes (port the 13 existing transitions to WGSL).
- WebGL2 fallback path for browsers without WebGPU.

---

## 7. The effects pipeline

Build on the **composable effects registry** that already exists (`engine/effectsRegistry.js`). Promote it to a typed, GPU-backed plugin surface.

**Effect contract**
```ts
interface Effect {
  id; name; group; params: ParamSpec[];
  gpu?: { shader: WGSL; passes };     // realtime
  cpu?: (frame, params) => frame;     // fallback / thumbnails
  ui?: ParamLayout;                   // inspector controls
  animatable: string[];               // which params accept keyframes
}
```

**Built-in effect library (ship targets)**
- **Color correction/grading:** lift/gamma/gain (3-way wheels — UI exists in `ColorGrading.jsx`), curves (RGB/HSL), white balance, exposure, contrast, saturation/vibrance, HSL qualifier, color match, LUT, scopes (waveform/vectorscope/histogram/parade — math exists in `colorScopes.js`).
- **Keying:** chroma key (port `chromaKey.js` to GPU), luma key, difference key, spill suppression, **AI matting** (background removal).
- **Stylize:** blur (gaussian/directional/radial), sharpen, glow, bloom, vignette, film grain, halation, prism/chromatic aberration, posterize, pixelate, comic/cartoon.
- **Distortion:** transform, warp, lens distortion/correction, mirror, displacement, ripple, mosaic.
- **Spatial fixes:** stabilization, rolling-shutter, lens correction, denoise (temporal + spatial), deflicker.
- **Time:** optical-flow retiming, frame interpolation, slow-mo, time remap with speed ramps, motion blur, freeze frame, reverse, strobe.
- **Generate:** solids, gradients, noise, shapes, text, timecode, adjustment layers.
- **Compositing:** 25+ blend modes, track mattes (alpha/luma), masks (bezier/shape/feather/expansion, animatable), motion tracking → mask/transform link, planar/object tracking.

**Masking & tracking subsystem**
- Vector masks (bezier + primitive shapes), per-point feather, mask animation via keyframes, boolean mask combine.
- **Point + planar motion tracking** (native: optical flow in Rust; web: lightweight tracker / WASM) feeding transforms, masks, and text ("stick to object").

---

## 8. The audio engine

Extend the working Web Audio graph (`audioEngine.js`) and the DAW mixer (`AudioMixer.jsx`) into a professional audio post chain.

- **Mixer:** per-clip → per-track → bus → master, with sends, groups, solo/mute, pan/balance, channel mapping (mono/stereo/5.1).
- **DSP effects (per insert slot):** parametric EQ, compressor, limiter, gate/expander, de-esser, de-noise, de-hum, reverb, delay, pitch/time, voice enhance/clarity.
- **Automation:** volume/pan/param keyframe curves drawn on the track (clip-relative or track-absolute).
- **Audio ducking:** sidechain music to dialogue (auto-detect speech), threshold/ratio controls.
- **Beat detection** → snap markers (`Marker.kind:'beat'`); **auto-sync** clips by audio waveform (multicam + dual-system sound).
- **Loudness:** real-time LUFS/true-peak meters; export loudness normalization (-14 LUFS YouTube, -16 podcasts, broadcast presets).
- **Waveforms:** reuse `engine/waveform.js`; cache peaks per asset; render in timeline + clip bodies.
- **Realtime engine:** move DSP to `AudioWorklet` (web) / Rust real-time thread (native) for glitch-free monitoring; **offline bounce** via `OfflineAudioContext` / native render for export (frame-accurate, faster-than-realtime).
- **VST/AU support: desktop only** — native plugin host bridge (Rust) exposing VST3/AU; the web build gracefully hides these slots.

---

## 9. The animation / keyframe engine

A single, unified keyframe system drives **every** animatable parameter (transform, effect params, audio, masks, text).

- **Channels** keyed by parameter path (`transform.scale`, `effects[2].params.blur`, `audio.gain`).
- **Interpolation:** linear, hold, ease presets, and full **bezier** with draggable handles in a **curve editor** (graph editor panel) — extends the existing `easing` field.
- **Spatial paths:** position keyframes form a **motion path** with editable bezier handles directly on the viewer; auto-orient to path.
- **Speed/time curves:** `timeRemap` and `speedRamp` are first-class Curves with the same editor.
- **Presets:** save/apply animation presets (the registry pattern); built-in library (fade/slide/pop/bounce/typewriter).
- **Physics-based:** spring/inertia/overshoot easing options; wiggle/expression-lite generators (deterministic, seedable).
- **Solver** lives in the edit engine (pure TS), evaluated per frame by the scheduler, consumed by render + audio.

---

## 10. The timeline engine

The interaction core. Most primitives already exist (`Timeline.jsx`, `snapEngine.js`, multi-clip drag, blade, ripple) — formalize and complete them.

- **Edit modes:** insert/overwrite, **ripple, roll, slip, slide**, rate stretch, replace, three/four-point editing (source in/out → timeline in/out).
- **Magnetic timeline** (FCP-style) *and* track-based (Premiere-style) — a toggle; magnetic mode auto-closes gaps and keeps linked A/V + connected clips attached.
- **Trim/split/merge**, blade (all tracks / single), join through edits, extend edit, ripple delete, lift/extract.
- **Multi-track** video/audio/subtitle/adjustment; reorder, lock, hide, solo, color, resize, group.
- **Linked audio/video**, clip groups, sync locks.
- **Snapping:** clips, playhead, markers, cross-track edges, beat markers — visual snap guides (extend `snapEngine.js`).
- **Markers & regions:** standard/chapter/todo/beat, ranges, comments (extend `TimelineMarkers.jsx`).
- **Nested sequences & compound clips:** select clips → collapse to a nested sequence editable in place; nested sequences recurse in the render graph.
- **Multicam:** sync N angles (timecode/audio/marker), angle switcher in the viewer, cut/flatten to a multicam clip.
- **Scene detection** → auto-split a clip at cuts (`sceneDetector.js` already computes boundaries).
- **Virtualized rendering** of the timeline canvas (only draw visible clips/thumbs) for thousand-clip projects; thumbnail filmstrips + waveforms cached.
- **Zoom/scroll/Fit**, frame-snap ruler, dual playhead (skimmer + playhead).

---

## 11. Undo/redo, history & collaboration

- **Replace snapshot history** (`state/history.js`) with **command + inverse-patch** history: each command records a forward and inverse op (or a structural patch). O(change), not O(project) — essential for large projects. Coalesce rapid edits (drag) into one undo step.
- **Named version history / snapshots** (slice already exists): periodic + manual checkpoints, restore-to-version, diff view.
- **Autosave** (have it) + **crash recovery** (recover unsaved on relaunch).
- **Collaboration (later phase):** because all mutations are commands, layer a **CRDT/OT** transport for real-time co-edit + cloud projects; presence cursors; comment threads on clips/markers. Designed-for now, built last.

---

## 12. Media engine, import & export

### 12.1 Import / ingest
- **Decode coverage:** native FFmpeg (desktop) → essentially every format; web → WebCodecs + FFmpeg.wasm fallback.
- Containers/codecs: MP4/MOV/MKV/WebM/AVI, H.264/HEVC/AV1/VP9/ProRes/DNxHD; images PNG/JPG/WebP/TIFF/HEIC/RAW; audio WAV/MP3/AAC/FLAC/OGG; image sequences; GIF.
- **Metadata** probe (codec, color space, fps, timecode, GPS, camera), **thumbnail + waveform + scene** extraction on ingest (background jobs).
- **Proxy generation:** auto-create low-res proxies (e.g. 1/2 or 1/4 res, ProRes Proxy/H.264) on ingest; transparent proxy↔full toggle; "optimized media."
- **Relink** by hash; offline media placeholders.

### 12.2 Export / delivery
- **Offline frame-accurate render** (never MediaRecorder): edit engine renders frame N → encoder. WebCodecs `VideoEncoder` (web) / FFmpeg + hardware (NVENC/QuickSync/VideoToolbox/AMF) (native).
- **Formats:** H.264, HEVC, AV1, VP9, ProRes 422/4444 (alpha), DNxHR, image sequence (PNG/EXR/TIFF), GIF, audio-only (WAV/MP3/AAC).
- **Alpha channel** export (ProRes 4444 / PNG seq / WebM).
- **4K/8K, HDR (PQ/HLG), high-FPS (60/120/240)**, variable bitrate, two-pass, custom GOP.
- **Platform presets:** YouTube (incl. HDR), TikTok, Instagram (Reels/feed/story), Facebook, Vimeo, Twitter/X — correct resolution/fps/bitrate/loudness; one-click.
- **Batch export** (multiple presets/sequences in a render queue with priorities + background rendering).
- **Direct publish** (optional, OAuth, desktop) to YouTube/TikTok/etc.
- **Subtitle/caption export** (extend `subtitleExporter.js`): SRT/VTT/ASS, burned-in or sidecar.
- **Project interchange:** XML/AAF/EDL/OTIO export-import for round-tripping with Resolve/Premiere/FCP (stretch).

---

## 13. AI feature subsystem

A unified **AIProvider** interface with on-device and cloud strategies. On-device models run in **ONNX Runtime** (Web/Native, with CoreML/DirectML/TensorRT EPs); cloud uses the **Claude API** (latest models) for language tasks and partner APIs for generative media.

| Feature | Approach |
|---------|----------|
| **Captions / transcription** | On-device Whisper (or cloud); word-level timing → editable caption track; auto-style. |
| **Auto-translate captions** | Cloud LLM (Claude) translation of transcript; per-language caption tracks. |
| **AI background removal / matting** | On-device segmentation (RVM/MODNet/SAM) → alpha; realtime via GPU. |
| **AI object removal** | Segmentation + inpainting (on-device or cloud). |
| **AI reframe** (smart vertical/social crop) | Subject tracking → animated crop to target aspect. |
| **AI scene detection** | Already have luminance/histogram detector; optionally upgrade to learned shot detection. |
| **AI color correction / auto-grade** | Auto white-balance/exposure + reference-match; LLM-assisted look suggestions. |
| **AI auto-edit / highlights** | Analyze speech + scene energy + beats → suggested rough cut / highlight reel (silence removal, filler-word cut). |
| **AI voice enhancement / denoise** | On-device speech enhancement model. |
| **AI music generation / SFX** | Cloud generative-audio partner API. |
| **AI voice cloning / TTS** | Cloud partner API; clear consent UX + watermark. |
| **AI translation / dubbing** | Transcribe → translate → TTS pipeline. |

**Guardrails:** all AI is opt-in, runs on a background job queue, shows progress, is cancelable, caches results, and is fully **non-destructive** (results are clip effects/tracks, never overwrite source). Cloud calls require explicit consent and surface that data leaves the device.

---

## 14. Performance strategy

- **GPU everything** in the hot path (composite, effects, transitions, scopes).
- **Proxy + render cache + background rendering** (section 6.3) — the biggest realtime win.
- **Multi-threading:** decode workers, engine worker, audio worklet/thread, AI/proxy job queue (section 4.3).
- **Decode management:** GOP-aware seeking, frame prefetch ring buffer, texture/buffer **object pools**, LRU GPU texture cache sized to VRAM.
- **Hardware decode/encode** via the platform codec APIs.
- **Virtualized UI** (timeline, media library, effect lists); memoized selectors; the existing **renderer-owned clock** (keep, and finish removing the residual ~20 Hz re-render via a split store / direct-DOM playhead).
- **Fast project load:** lazy-load media (proxies first), stream the project file, defer thumbnail/waveform hydration.
- **Memory:** budget-aware caches, disposal on tab/window blur, OffscreenCanvas to keep the main thread free.
- **Determinism & benchmarks:** a perf harness (scrub fps, export rate, open time, memory) gated in CI to catch regressions.

---

## 15. Professional UI/UX

- **Dockable, resizable panel system** with saved **workspaces** (Edit / Color / Audio / Cut / Effects layouts) — the current fixed grid (`App.jsx`) becomes a docking layout manager.
- **Panels:** Media library/bins, Source & Program viewers, Timeline, Inspector, Effects browser, Color page (wheels/curves/scopes), Audio mixer, Captions/Transcript, Markers, Render queue, History.
- **Multi-viewer:** source/program, scopes overlay, range/safe-zone guides, transparency checkerboard.
- **Fully customizable keyboard shortcuts** with editor-emulation presets (Premiere/FCP/Resolve keymaps) — extends `hooks/useKeyboard.js`.
- **Context menus, drag-and-drop everywhere, timeline zoom, search-driven command palette.**
- **Inspector** is param-driven from the effect/clip schema (auto-generates controls) — extends current `Inspector.jsx`.
- **Theming** (dark/light/contrast), DPI scaling, **accessibility** (focus traps, ARIA, keyboard-only operation, reduced-motion) — currently a roadmap gap, made a first-class requirement.
- **Onboarding:** templates, presets, tooltips, sample project (keep `WelcomeModal`/`EmptyHero`).
- **Localization** (i18n framework from the start).

---

## 16. Plugin architecture & SDK

- **Sandboxed plugins** (web: Worker/iframe; native: WASM/process) with a capability-scoped, versioned API.
- **Extension points:** Effects API, Transition API, Generator API, Exporter API, AI provider API, Panel/UI API, Importer/decoder API.
- **Manifest** (id, version, permissions, entry, contributes), semver compatibility, signing for the marketplace.
- **SDK:** typed templates, local dev harness, hot reload, docs, examples; everything the built-ins use is exposed so first-party effects are "just plugins."
- **Scripting/macros:** because edits are commands, expose a scripting console + recordable macros.

---

## 17. Complete feature matrix

Legend: ✅ exists · 🟡 partial/scaffolded · ⬜ to build.

### Timeline & editing
✅ Multi-track, drag-drop, trim, split/blade, ripple, duplicate, snap, rubber-band, multi-clip drag, zoom/fit · 🟡 markers, snap guides, scene detect, edit modes (advanced modes scaffolded), keyframes (easing only) · ⬜ roll/slip/slide formalized, magnetic timeline, three/four-point, multicam, nested sequences, compound clips, full bezier keyframes, speed ramping curves, optical-flow retime, proxies, render cache, virtualized timeline, version history UI.

### Video / image
✅ Transforms, crop, PiP, opacity, vignette, per-pixel chroma key, 13 transitions, LUT parse, basic filters, composable effect stack, 3-way color UI, scopes math · 🟡 color grading (UI without GPU pipeline), reverse/freeze, blend modes · ⬜ GPU color-managed compositor, curves/HSL qualifier, HDR, AI matting/bg-removal, motion/object tracking, masking, stabilization, lens correction, denoise, optical flow, frame interpolation, full blend-mode set.

### Audio
✅ Multitrack mix, gain/pan, mute/solo, RMS meters, keyframed volume, waveforms, export mux · 🟡 DAW mixer UI · ⬜ EQ/compressor/limiter/gate, denoise, voice enhance, ducking, beat detection, audio-sync, automation curves, LUFS metering + normalized export, AudioWorklet engine, VST/AU.

### Text & graphics
✅ Titles (7 static + 4 kinetic), subtitles, text motion, rich text styling, Google Fonts, direct manipulation · 🟡 subtitle export (SRT) · ⬜ lower-third templates, animated text presets library, closed captions/CEA-608, AI caption generation, stickers, shapes, SVG import, motion-graphics templates.

### Animation
✅ Keyframes with easing presets · ⬜ bezier curve editor (graph editor), motion paths on viewer, animation preset library, physics easing, expression-lite.

### Media management
✅ Library, drag-drop ingest, metadata probe, subclips, search, IndexedDB durability · ⬜ bins/collections, smart bins, tags/favorites, duplicate detection (hash), proxy management UI, relink, offline media.

### Import / export
✅ Multi-format import (browser-supported), MediaRecorder export, adaptive resolution, save/load JSON, autosave · ⬜ FFmpeg/WebCodecs offline render, H.264/HEVC/AV1/ProRes/DNx, alpha export, 8K/HDR/high-fps, batch/render queue, platform presets, GIF, direct publish, OTIO/XML/EDL/AAF interchange.

### AI
🟡 Scene detection, boring/jump-cut analyzer · ⬜ captions/transcription, translation, bg removal/matting, object removal, reframe, auto-grade, auto-edit/highlights, voice enhance, music gen, voice clone/dubbing.

### Performance / platform
✅ Renderer-owned clock, durable projects · 🟡 dynamic aspect compositor · ⬜ GPU pipeline, proxy/render cache, multi-threading, hardware codecs, virtualized UI, desktop shell, cross-platform packaging.

### UI/UX & extensibility
✅ Inspector, context menu, shortcuts, toasts, status bar, error boundary · ⬜ dockable panels/workspaces, customizable keymaps + editor presets, command palette, accessibility pass, i18n, plugin SDK, scripting/macros, collaboration.

### Native pro tier (track N — desktop only, §18b)
⬜ **OpenFX (OFX) host** (BorisFX/Sapphire), **VST3/AU host**, **OpenTimelineIO as the native schema**, **ACEScg 32-bit-float** compositing, **Vulkan/Metal/DX12** HAL, **tetrahedral 65³ 3D-LUT**, **FreeType/HarfBuzz** shaping, **MXF** + ProRes/DNx coverage, **NVDEC/QuickSync/VideoToolbox** decode + **NVENC/QSV/Apple** encode, **lock-free** sample-accurate audio, **zero-copy** decoder→VRAM, **SQLite** asset index + transactional state log, **MSI/DMG/AppImage/Flatpak** + **delta** auto-update.

---

## 18. Phased development roadmap

Each phase is independently shippable and ends with **exit criteria**. Phases 0–4 are the structural rewrite; 5–11 layer pro features onto it. Order favors de-risking the hardest dependencies (GPU pipeline, native shell, codecs) early.

> Effort labels (S/M/L/XL) are relative complexity, not calendar promises.

### Phase 0 — Foundation & hardening (S–M) — 🟡 in progress
TypeScript migration of state + engine contracts; extract the **pure edit-engine** out of React; introduce the **capability interfaces** (render/codec/storage/audio/AI/FS) with today's browser code as the first impl; convert history to **command/inverse-patch**; expand the test harness; set up CI (lint + unit + build) and a perf baseline.
**Exit:** existing features pass through the new engine boundary unchanged; types green; command-based undo working; CI gates live.

**Landed (increment 1) — the pure edit-engine core under `src/core/` (seed of `packages/engine`):**
- ✅ **TypeScript toolchain**: `tsconfig.json` (strict, scoped to `src/core`), `npm run typecheck` (green); Vitest + Vite already transpile `.ts` via esbuild. ESLint temporarily ignores `.ts` (a typescript-eslint pass is increment 2).
- ✅ **Capability interfaces** (`src/core/capabilities/`) — `Storage · FileSystem · CodecIO · RenderBackend · AudioBackend · AIProvider` + a typed DI `CapabilityRegistry`; first web impl `WebStorage` wraps the existing IndexedDB media store + autosave (the portability seam, proven non-breaking).
- ✅ **Command + inverse-patch history** (`src/core/history/`) — immutable JSON `patch` (`diff/invert/apply`, O(change) not O(project), structural sharing), `PatchHistory` (undo/redo + gesture coalescing + limit), `CommandBus` (dispatch/transaction/subscribe — the single mutation seam for undo, scripting, plugins).
- ✅ **Tests**: 30 new specs (patch round-trips, history, command bus, registry) **+ an integration test that drives the real `editorReducer` and proves the patch engine reproduces its undo/redo exactly** — 55/55 green.

**Landed (increment 2) — the new engine is live, and CI gates exist:**
- ✅ **Patch history wired into the running app.** `EditorContext` now drives undo/redo through a `historyController` (`src/state/historyController.js`) with two interchangeable backends — `snapshot` (original) and `patch` (the new core). **`patch` is the default**; `localStorage ccp.historyMode = 'snapshot'` reverts. Verified by build + dev-server boot (the `.ts` core transforms and loads through Vite).
- ✅ **Equivalence safety net.** A new test runs a 16-action real-reducer sequence through *both* backends and asserts identical persistent states + labels at every undo/redo step (`src/state/historyController.test.js`). This is what justifies defaulting to `patch`.
- ✅ **`typescript-eslint`** added; the blanket `.ts` lint-ignore is gone. A dedicated `.ts/.tsx` ESLint block lints the core (clean); the JS/JSX block is unchanged.
- ✅ **CI** (`.github/workflows/ci.yml`): `npm ci` → typecheck → test → build (required) + advisory lint + a required clean-lint gate on `src/core`. **59/59 tests, typecheck green, build green, `npm ci` in sync.**

**Phase 0 exit status:** command-based undo working ✅ · types green ✅ · CI gates live ✅ · existing features unchanged ✅ (equivalence-tested). **Remaining for full Phase 0 close:** finish extracting the reducer into the pure engine (commands as first-class), pay down the pre-existing JS lint debt (incl. a real `no-const-assign` crash in `clip/delete` magnetic mode — flagged), and add the perf baseline harness.

### Phase 1 — Desktop shell & media core (L)
Stand up the **Tauri 2** app from the same frontend; bundle **FFmpeg** sidecar; implement the **native** CodecIO + FS + Storage impls (SQLite project DB, content-addressed cache); proxy/thumbnail/waveform/scene **ingest jobs**; relink-by-hash.
**Exit:** desktop build opens, imports real-world formats via FFmpeg, generates proxies, plays back; web build still runs the reduced tier.

### Phase 2 — GPU render graph (XL)
Replace Canvas2D with a **WebGPU/wgpu** color-managed render graph; linear-light compositing; port chroma key + 13 transitions + the effect registry to WGSL; LUT-as-3D-texture; track blend modes; WebGL2 fallback; **render cache + background renderer**.
**Exit:** frame-identical-or-better output vs. old compositor, 4K multi-layer scrubs at target fps on a mid GPU; render cache invalidation correct.

### Phase 3 — Export / delivery engine (L)
Offline frame-accurate render to **WebCodecs (web) / FFmpeg+hardware (native)**; H.264/HEVC/AV1/ProRes/DNx, alpha, HDR, 4K/8K/high-fps; **render queue + batch**; platform presets; GIF; caption export; loudness-normalized audio bounce.
**Exit:** deterministic exports across formats; platform-preset files validate on target sites; batch queue with background rendering.

### Phase 4 — Timeline engine completion (L)
Formalize ripple/roll/slip/slide + three/four-point; **magnetic timeline** toggle; nested sequences/compound clips in model + render; **multicam**; scene-split; virtualized timeline + filmstrips/waveforms; version-history UI; crash recovery.
**Exit:** full pro trim model frame-accurate; multicam cut+flatten; 1k-clip project scrolls/edits smoothly.

### Phase 5 — Effects, color & compositing (L)
Curves/HSL qualifier/white-balance; full blend modes; masks (bezier/shape, animatable) + matte tracks; **motion/planar tracking**; stabilization, lens correction, denoise; full color page (wheels/curves/scopes wired to GPU); HDR grading.
**Exit:** a clip can be keyed, masked, tracked, graded, and the look survives export with color accuracy.

### Phase 6 — Animation & motion graphics (M)
Bezier **graph editor**; motion paths on the viewer; animation preset library; physics easing; shapes/SVG; lower-third/title templates; sticker library.
**Exit:** complex multi-param animations authored via curves and presets; templates instantiate and re-time.

### Phase 7 — Audio post (M–L)
EQ/compressor/limiter/gate/denoise/voice-enhance inserts; automation curves; ducking; beat detection + audio-sync; LUFS metering; **AudioWorklet/native** realtime engine + offline bounce; VST/AU host (desktop).
**Exit:** glitch-free monitored playback with effects; ducking + normalized export; multicam audio-sync.

### Phase 8 — Text, captions & AI captions (M)
Caption/subtitle tracks with styling; CEA-608/closed captions; **AI transcription** (on-device) → editable captions; auto-translate; transcript-based editing.
**Exit:** generate, edit, style, translate, burn-in or sidecar captions end-to-end.

### Phase 9 — AI feature suite (L)
Background removal/matting, object removal, reframe, auto-grade, auto-edit/highlights, voice enhance, music gen, voice clone/dubbing — behind the AIProvider interface with on-device + cloud strategies and the consent/job-queue guardrails.
**Exit:** each AI op runs, caches, cancels, and produces non-destructive results; cloud ops gated by consent.

### Phase 10 — Pro UI/UX, plugins & collaboration (L)
Dockable panels + workspaces; customizable keymaps + editor presets; command palette; accessibility + i18n pass; **plugin SDK** + sandbox + first marketplace; scripting/macros; (begin) CRDT collaboration + cloud projects.
**Exit:** workspaces persist; a third-party effect plugin loads sandboxed; keyboard-only + screen-reader pass; two users co-edit a sequence (beta).

### Phase 11 — Performance, QA & production release (M–L)
Perf passes to all targets; memory/VRAM budgets; visual-regression + integration + soak tests; crash telemetry (opt-in); signed installers + auto-update for Win/macOS/Linux; docs + tutorials.
**Exit:** all perf gates green; signed cross-platform builds; release checklist complete → **v3.0**.

**Dependency spine:** 0 → 1 → 2 → 3 are sequential (each unlocks the next). 4 needs 0/2. 5/6 need 2. 7 is largely parallel after 0. 8/9 need 1 (jobs) + 2 (compositing). 10/11 close out.

---

## 18b. Native core track (C++/Rust pro engine) — the hybrid's second rail

Per the §3 **hybrid decision**, the desktop pro tier is a native core developed *in parallel* with the web track, behind the same capability interfaces (so the web app keeps shipping). These phases (**N1–N11**) are a direct superset of the native-C++ roadmap; each native deliverable that the browser cannot reach lives here. The web track (Phases 0–11) and the native track (N1–N11) meet at the capability boundary: a feature ships web-first when possible and is *promoted* to the native core when it needs hardware/codec/plugin access.

| Native phase | Focus & deliverables | Verification gate |
|---|---|---|
| **N1 Foundation & shared core** | Cross-platform build (Cargo workspace + **CMake** for C/C++ deps; Win/macOS/Linux); immutable project-state tree with **transactional logging**; cross-platform **thread pools + lock-free queues**; **SQLite** asset index. | High-stress test: state integrity over **1,000,000 concurrent updates** across threads. |
| **N2 Timeline core** | **Integer-tick** time model; virtual non-destructive sequence graph (unlimited tracks/nesting); frame-accurate ripple/roll/slip/slide/split/trim; **OpenTimelineIO as the native in-memory schema**; diff-based transactional undo/redo (mirrors the TS patch engine). | Automation: sample-accurate positioning/alignment across complex edits. |
| **N3 Media framework & HW decode** | **FFmpeg** demux (`.mp4/.mov/.mkv/.mxf`); HW decode **NVDEC / QuickSync / VideoToolbox**; background **proxy** transcode pipeline. | 4K **H.265 10-bit @ 60 fps** sustained decode. |
| **N4 GPU render & ACES** | Graphics **HAL over Vulkan / Metal / DX12** (wgpu where it suffices, native where it doesn't); **ACEScg, 32-bit float (RGBA32F)** working space; real-time **DAG** node evaluator. | Zero clipping/banding across log profiles + HDR test patterns. |
| **N5 VFX & color** | Lift/Gamma/Gain, HSL curves, custom shaders; **tetrahedral 3D LUT** (`.cube`, up to **65³**); bezier masks + feather + tracker bindings + blend; **OpenFX (OFX) host**. | Industry OFX plugins (BorisFX/Sapphire) load + render correctly. |
| **N6 Audio mixer & VST** | Sample-accurate mix on **lock-free ring buffers**; 4-band parametric EQ, multiband compression, automation; **sidechain ducking**; **VST3 + AU** host. | Low-latency render, no under-runs/pops under heavy multitrack load. |
| **N7 Text & keyframes** | **FreeType + HarfBuzz** vector typography; temporal-bezier keyframe engine; physics (spring/elastic/bounce). | Interpolation matches predefined spatial paths + acceleration curves. |
| **N8 On-device AI** | **ONNX Runtime / TensorRT / CoreML**; local **Whisper**; **YOLO** smart-reframe; neural vocal isolation + frame-interpolation slow-mo. | Offline transcription **WER < 5%**, no network. |
| **N9 Real-time perf & cache** | Multi-tier render cache → fast uncompressed intermediates; **zero-copy** decoder→VRAM frame sharing; idle-cycle background render. | 5-layer 4K timeline real-time scrub, zero dropped frames. |
| **N10 Validation & compliance** | 48-hour automated UI soak; **Valgrind + AddressSanitizer** leak/corruption profiling; OTIO export/import portability vs major editors. | Zero leaks/corruptions/crashes on Win/macOS/Linux. |
| **N11 Deployment & updates** | HW export **NVENC / QuickSync / Apple Media Engine**; packages **MSI / DMG / AppImage / Flatpak**; signed auto-update with **delta patching**. | CI builds, signs, and deploys delta patches on all 3 OSes. |

**Track interplay:** N1–N2 reuse the *concepts* proven on the web track (the merged patch/command history, the capability registry). N3/N4 are the native muscle the browser lacks and are the highest-value desktop differentiators. The web track's Phase 2 (WebGPU) and N4 (native HAL) **share WGSL/shader logic and the OCIO config** so looks match across tiers. OFX (N5), VST/AU (N6), FreeType/HarfBuzz (N7), lock-free audio (N6), and zero-copy VRAM (N9) are **native-exclusive** — the web build degrades gracefully (hides those slots) per the capability rule.

---

## 19. Testing, QA & release engineering

- **Unit:** edit engine (timeline ops, keyframe solver, command/inverse-patch), parsers (LUT, OTIO), color math, audio DSP — extend the existing Vitest suites.
- **Integration:** import → edit → export round-trips; project migration across every schema version; proxy/relink flows.
- **Visual regression:** golden-frame comparisons of the render graph (per effect/transition) with perceptual diff tolerances; HDR/color-accuracy checks.
- **Performance:** automated scrub-fps, export-rate, open-time, and memory benchmarks gated in CI.
- **E2E:** Playwright (web) + native UI automation (desktop) for critical paths.
- **Soak/fuzz:** long edit sessions, malformed media, huge projects, undo/redo stress. **Native gates (track N):** 1,000,000-concurrent-update state-integrity test (N1), 48-hour UI soak (N10), **Valgrind + AddressSanitizer** leak/corruption profiling (N10), offline-transcription WER < 5% (N8).
- **Release:** semantic versioning, signed + notarized installers (macOS notarization, Windows code-signing), MSI/DMG/AppImage/Flatpak, auto-update with **delta patching**, opt-in crash/telemetry, staged rollout, reproducible builds.

---

## 20. Risks, trade-offs & open questions

| Risk | Mitigation |
|------|------------|
| WebGPU maturity/portability | wgpu native is solid; ship WebGL2 fallback on web; gate features by capability. |
| Codec licensing (HEVC/AAC patents) | Native via FFmpeg + OS encoders; document distribution terms; prefer AV1/H.264/ProRes where licensing is clean. |
| Scope explosion / never shipping | Phases are independently shippable; each has exit criteria; keep web build as a continuous demo. |
| Color accuracy regressions | Golden-frame + scope-based CI; OCIO/ACES configs reviewed. |
| Two backends drift | The capability-interface rule + shared WGSL + shared edit engine keep web/native in lockstep; CI builds both. |
| **Hybrid two-track cost** | Web (0–11) and native (N1–N11) double the surface. Mitigation: features ship web-first and are *promoted* to native only when they need it; the capability boundary forces parity; one shared edit-engine/history concept across both. |
| **Native dependency complexity** (FFmpeg, OFX SDK, OCIO, HarfBuzz, VST/AU SDKs) | Vendored via CMake/Cargo, version-pinned, behind capability interfaces; each wrapped with its own integration test so a bad upgrade fails CI, not users. |
| AI cost/privacy | On-device first; cloud opt-in with explicit consent + watermarking for synthetic voice/media. |
| Large-project memory | Budgeted caches, proxies, virtualization, content-addressed dedupe. |

**Resolved:** stack direction = **hybrid** (ship web + build native core, §3); shell = **Tauri 2**; engine split = TS edit-engine + Rust/C++ media-DSP-render core.
**Open questions before track-N kickoff:** OCIO/ACES config source; OFX host library choice; minimum GPU/OS matrix; native↔TS bridge (Tauri commands vs FFI vs shared-memory) for frame handoff; CRDT lib for collaboration.

---

## 21. Folder structure (target)

```
cinecutpro/
├── apps/
│   ├── web/                      # Vite PWA entry (current app evolves here)
│   └── desktop/                  # Tauri shell (Rust) + same UI
├── packages/
│   ├── engine/                   # PURE TS edit engine (model, commands, history, scheduler, keyframes)
│   │   ├── model/  commands/  history/  timeline/  keyframes/  scheduler/
│   ├── render/                   # render graph + WGSL shaders + backends (webgpu/wgpu/webgl2)
│   ├── effects/                  # effect registry + built-in effects (shaders + cpu fallbacks)
│   ├── audio/                    # mix graph, DSP, automation, offline bounce
│   ├── codec/                    # CodecIO interface + webcodecs/ffmpeg(.wasm)/native impls
│   ├── media/                    # ingest jobs: probe, proxy, thumbnail, waveform, scene
│   ├── ai/                       # AIProvider interface + onnx/native/cloud strategies + model registry
│   ├── storage/                  # project DB, content-addressed cache, autosave, migrator
│   ├── ui/                       # React components: panels, timeline, inspector, viewers, docking
│   ├── plugin-sdk/               # plugin host, manifest, capability API, dev harness
│   └── shared/                   # types, math, color, timecode, units
├── native/                       # Track-N pro core (Cargo workspace + CMake for C/C++ deps):
│                                  #   media-core (FFmpeg, NVDEC/QSV/VideoToolbox), gpu (wgpu + Vulkan/Metal/DX12 HAL),
│                                  #   color (OpenColorIO/ACES), ofx-host, vst-au-host, text (FreeType/HarfBuzz),
│                                  #   dsp (lock-free audio), ai-rt (ONNX/TensorRT/CoreML), state (SQLite + txn log)
├── docs/                         # architecture, SDK, user guide, this plan
├── tests/                        # integration, visual-regression goldens, perf harness, e2e
└── README.md  IMPLEMENTATION_PLAN.md
```

> **Migration note:** the current `src/` maps cleanly onto this — `state/` → `packages/engine`, `engine/mediaRenderer+transitions+chromaKey+effectsRegistry` → `packages/render`+`packages/effects`, `engine/audioEngine` → `packages/audio`, `engine/mediaStore+projectIO+migrator` → `packages/storage`, `engine/sceneDetector+waveform+lutParser` → `packages/media`, `components/` → `packages/ui`. Move incrementally behind the capability interfaces so the app keeps running every step.

---

*Pairs with `README.md`. As phases land, tick the feature matrix (section 17), update the README's roadmap, and add a changelog entry there.*
