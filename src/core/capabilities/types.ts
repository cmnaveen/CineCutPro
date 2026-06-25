/**
 * CineCutPro — capability interfaces (Phase 0 / §3 the portability rule).
 *
 * Every platform-touching feature is defined here as an interface with (at
 * least) a `web` and a `native` implementation. The edit engine and UI depend
 * ONLY on these interfaces — never on WebGPU/WebCodecs/Tauri/FFmpeg directly —
 * so the same codebase ships as a PWA and a desktop app.
 *
 * Phase 0 lands the contracts + the first web impls. Later phases fill in the
 * GPU render graph, WebCodecs/FFmpeg I/O, native FS, and AI providers behind
 * these same signatures.
 */

// ─── Storage: media blobs + project autosave ────────────────────────────────
export interface Storage {
  putMedia(id: string, blob: Blob): Promise<void>;
  getMedia(id: string): Promise<Blob | null>;
  deleteMedia(id: string): Promise<void>;
  clearMedia(): Promise<void>;
  /** Persist the serialized project document (autosave). */
  writeProject(doc: unknown): Promise<void>;
  readProject(): Promise<unknown | null>;
  clearProject(): Promise<void>;
}

// ─── FileSystem: pick/read/write files (web: File API; native: OS FS) ────────
export interface FileSystem {
  /** Whether real random-access disk I/O is available (native only). */
  readonly hasNativeAccess: boolean;
  openFile(opts?: { accept?: string[]; multiple?: boolean }): Promise<File[]>;
  saveFile(data: Blob | string, suggestedName: string): Promise<void>;
}

// ─── CodecIO: decode to frames, encode frames to a container ─────────────────
export interface DecodedFrame {
  readonly timestamp: number; // microseconds
  readonly width: number;
  readonly height: number;
  /** Backend-specific frame handle (VideoFrame, ImageBitmap, GPU texture…). */
  readonly handle: unknown;
  close(): void;
}

export interface EncodeOptions {
  width: number;
  height: number;
  fps: number;
  codec: 'h264' | 'hevc' | 'av1' | 'vp9' | 'prores' | 'dnxhr';
  bitrate?: number;
  alpha?: boolean;
  hdr?: boolean;
}

export interface CodecIO {
  readonly supportedDecode: string[];
  readonly supportedEncode: string[];
  decodeFrame(mediaId: string, timeSec: number): Promise<DecodedFrame>;
  createEncoder(opts: EncodeOptions): Encoder;
}

export interface Encoder {
  encode(frame: DecodedFrame): Promise<void>;
  finish(): Promise<Blob>;
}

// ─── RenderBackend: composite a frame graph to a target ──────────────────────
export interface RenderTarget {
  readonly width: number;
  readonly height: number;
}
export interface RenderBackend {
  readonly kind: 'canvas2d' | 'webgl2' | 'webgpu' | 'wgpu';
  init(canvas: unknown): Promise<void>;
  /** Composite the resolved frame graph for `timeSec` to the target. */
  renderFrame(graph: unknown, target: RenderTarget, timeSec: number): Promise<void>;
  dispose(): void;
}

// ─── AudioBackend: monitor graph + offline bounce ────────────────────────────
export interface AudioBackend {
  resume(): Promise<void>;
  /** Faster-than-realtime render of the mix for export. */
  bounce(graph: unknown, durationSec: number): Promise<AudioBuffer>;
  getExportStream(): MediaStream | null;
}

// ─── AIProvider: on-device + cloud inference (Phase 8/9) ─────────────────────
export interface AIJob<R> {
  readonly id: string;
  cancel(): void;
  onProgress(cb: (pct: number) => void): void;
  result(): Promise<R>;
}
export interface AIProvider {
  readonly id: string;
  readonly location: 'on-device' | 'cloud';
  readonly capabilities: string[]; // 'transcribe' | 'matte' | 'reframe' | …
  run<R>(op: string, input: unknown): AIJob<R>;
}

// ─── The registry key map (extend as capabilities land) ──────────────────────
export interface CapabilityMap {
  storage: Storage;
  fs: FileSystem;
  codec: CodecIO;
  render: RenderBackend;
  audio: AudioBackend;
  ai: AIProvider;
}

export type CapabilityKey = keyof CapabilityMap;
