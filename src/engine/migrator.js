/**
 * CineCutPro — State version migrator.
 *
 * Ensures projects saved in older formats can be loaded cleanly into the
 * current state shape. Each migration function transforms the snapshot from
 * version N to N+1.
 *
 * Usage:
 *   import { migrate } from './migrator.js';
 *   const current = migrate(loadedSnapshot);
 */

import { STATE_VERSION } from '../state/initialState.js';

/**
 * Migration from v1 → v2:
 *   - Add sequences, markers, clipboard, groups, versionHistory slices
 *   - Extend project config with colorSpace, sampleRate, bitDepth, proxyMode, autoSaveInterval
 *   - Extend UI flags with timelineMode, panelLayout, etc.
 *   - Add effects[] to each clip (empty array — existing clips had inline filters only)
 *   - Add reversed, groupId, linkedClipId, adjustmentLayer to each clip
 */
function migrateV1ToV2(snapshot) {
  const out = { ...snapshot };

  // ----- Project config extensions -----
  if (out.project) {
    out.project = {
      ...out.project,
      colorSpace: out.project.colorSpace ?? 'rec709',
      sampleRate: out.project.sampleRate ?? 48000,
      bitDepth: out.project.bitDepth ?? 16,
      proxyMode: out.project.proxyMode ?? false,
      autoSaveInterval: out.project.autoSaveInterval ?? 30
    };
  }

  // ----- New top-level slices -----
  if (!out.sequences) out.sequences = [];
  if (out.activeSequenceId === undefined) out.activeSequenceId = null;
  if (!out.markers) out.markers = [];
  if (!out.clipboard) out.clipboard = [];
  if (!out.groups) out.groups = [];
  if (!out.versionHistory) out.versionHistory = [];

  // ----- Per-clip extensions -----
  if (Array.isArray(out.clips)) {
    out.clips = out.clips.map((c) => ({
      ...c,
      effects: c.effects ?? [],
      reversed: c.reversed ?? false,
      groupId: c.groupId ?? null,
      linkedClipId: c.linkedClipId ?? null,
      adjustmentLayer: c.adjustmentLayer ?? false
    }));
  }

  // ----- UI flags extensions -----
  if (out.ui) {
    out.ui = {
      ...out.ui,
      timelineMode: out.ui.timelineMode ?? 'freeform',
      effectsBrowserOpen: out.ui.effectsBrowserOpen ?? false,
      colorGradingOpen: out.ui.colorGradingOpen ?? false,
      audioMixerOpen: out.ui.audioMixerOpen ?? false,
      multicamOpen: out.ui.multicamOpen ?? false,
      markersOpen: out.ui.markersOpen ?? false,
      templateLibraryOpen: out.ui.templateLibraryOpen ?? false,
      renderQuality: out.ui.renderQuality ?? 'full',
      panelLayout: out.ui.panelLayout ?? 'default',
      gridOverlay: out.ui.gridOverlay ?? 'none'
    };
  }

  return out;
}

// Registry of migration functions: key is source version, value migrates to next.
const MIGRATIONS = {
  1: migrateV1ToV2
  // Future: 2: migrateV2ToV3, etc.
};

/**
 * Detect the version of a loaded snapshot.
 * v1 projects did not have a `version` field in the state (only in the JSON wrapper).
 */
function detectVersion(snapshot) {
  if (snapshot._stateVersion) return snapshot._stateVersion;
  // Heuristic: v1 projects lack `sequences` and `markers` slices
  if (!snapshot.sequences && !snapshot.markers) return 1;
  return STATE_VERSION;
}

/**
 * Migrate a snapshot to the current STATE_VERSION, applying each step in sequence.
 * Returns a new object (does not mutate the input).
 */
export function migrate(snapshot) {
  let version = detectVersion(snapshot);
  let current = { ...snapshot };

  while (version < STATE_VERSION) {
    const fn = MIGRATIONS[version];
    if (!fn) {
      // No migration path — return as-is (best effort)
      break;
    }
    current = fn(current);
    version++;
  }

  // Stamp the version so future saves are identifiable
  current._stateVersion = STATE_VERSION;
  return current;
}

/**
 * Check if a snapshot needs migration.
 */
export function needsMigration(snapshot) {
  return detectVersion(snapshot) < STATE_VERSION;
}
