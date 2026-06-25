/**
 * CineCutPro edit-engine core — public surface (Phase 0).
 *
 * Seed of `packages/engine` in the target monorepo (§21). Framework-agnostic,
 * headless, unit-testable. The React app consumes it through this barrel.
 */

// History / commands (§11)
export {
  diff,
  invert,
  apply,
  deepEqual,
  type Patch,
  type PatchOp,
  type Path,
} from './history/patch';
export {
  PatchHistory,
  DEFAULT_HISTORY_LIMIT,
  type HistoryEntry,
  type RecordOptions,
} from './history/patchHistory';
export { CommandBus, command, type Command } from './history/command';

// Capabilities (§3 portability rule)
export { CapabilityRegistry, capabilities } from './capabilities/registry';
export type {
  CapabilityKey,
  CapabilityMap,
  Storage,
  FileSystem,
  CodecIO,
  Encoder,
  EncodeOptions,
  DecodedFrame,
  RenderBackend,
  RenderTarget,
  AudioBackend,
  AIProvider,
  AIJob,
} from './capabilities/types';
export { WebStorage } from './capabilities/web/webStorage';
