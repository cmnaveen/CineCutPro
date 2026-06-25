/**
 * Project save / load.
 *
 * We serialize only the persistent slices — media items reference the original
 * file via blob: URLs that don't survive a page reload, so the saved JSON
 * carries enough metadata to reattach the same file in a re-import flow.
 * After loading a JSON, the editor presents the missing-media items and the
 * user re-attaches them via drag-drop.
 *
 * v2: added markers, sequences, groups, versionHistory persistence.
 *     Supports importing v1 projects with automatic migration.
 */

import { migrate, needsMigration } from './migrator.js';

const VERSION = 2;
const PERSIST_KEYS = [
  'project',
  'media',
  'tracks',
  'clips',
  'transitions',
  'inPoint',
  'outPoint',
  'analyzer',
  'master',
  // v2 additions
  'markers',
  'sequences',
  'groups',
  'versionHistory'
];

export function exportProject(state) {
  const out = { version: VERSION, savedAt: Date.now() };
  for (const k of PERSIST_KEYS) {
    if (state[k] !== undefined) out[k] = state[k];
  }
  // Drop blob URLs — they won't resolve on reload anyway.
  out.media = (state.media ?? []).map((m) => ({
    ...m,
    src: m.src?.startsWith?.('blob:') ? null : m.src,
    thumb: m.thumb?.startsWith?.('data:') ? m.thumb : null,
    _needsReattach: !!m.src?.startsWith?.('blob:')
  }));
  return JSON.stringify(out, null, 2);
}

export function downloadProject(state, filename) {
  const json = exportProject(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${(state.project?.name ?? 'untitled').replace(/\s+/g, '_')}.ccp.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function importProjectText(text) {
  const data = JSON.parse(text);
  // Support both v1 and v2 projects
  if (!data?.version || (data.version !== 1 && data.version !== 2)) {
    throw new Error(`Unsupported project version: ${data?.version}`);
  }
  const snapshot = {};
  // Use a broader key set for compatibility — missing keys will just be undefined
  const allKeys = new Set([...PERSIST_KEYS, 'project', 'media', 'tracks', 'clips', 'transitions', 'inPoint', 'outPoint', 'analyzer', 'master']);
  for (const k of allKeys) {
    if (data[k] !== undefined) snapshot[k] = data[k];
  }
  // Apply migration if needed
  if (needsMigration(snapshot)) {
    return migrate(snapshot);
  }
  return snapshot;
}

export function pickProjectFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('cancelled'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(importProjectText(String(reader.result)));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

/* ----- Autosave (localStorage) -----
 * Persists the same slices as a saved project so a crash/reload restores work.
 * Media blobs are rehydrated separately from IndexedDB (see engine/mediaStore). */
const AUTOSAVE_KEY = 'cinecutpro:autosave';

export function writeAutosave(state) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, exportProject(state));
    return true;
  } catch (_) {
    return false;
  }
}

export function readAutosave() {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    if (!text) return null;
    return importProjectText(text);
  } catch (_) {
    return null;
  }
}

export function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
}

