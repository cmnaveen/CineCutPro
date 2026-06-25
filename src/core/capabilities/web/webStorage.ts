/**
 * CineCutPro — web Storage implementation (Phase 0).
 *
 * The first concrete capability: wraps the existing IndexedDB media store and
 * the localStorage autosave so the new engine boundary controls persistence
 * without rewriting working code. The native build will later provide a
 * SQLite + content-addressed-cache implementation of this same interface.
 */

import type { Storage } from '../types';
// Legacy JS modules (untyped under this tsconfig — treated as the working impl).
import { putMedia, getMedia, deleteMedia, clearMedia } from '../../../engine/mediaStore.js';
import { writeAutosave, readAutosave, clearAutosave } from '../../../engine/projectIO.js';

export class WebStorage implements Storage {
  async putMedia(id: string, blob: Blob): Promise<void> {
    await putMedia(id, blob);
  }

  async getMedia(id: string): Promise<Blob | null> {
    const blob = await getMedia(id);
    return (blob as Blob) ?? null;
  }

  async deleteMedia(id: string): Promise<void> {
    await deleteMedia(id);
  }

  async clearMedia(): Promise<void> {
    await clearMedia();
  }

  async writeProject(doc: unknown): Promise<void> {
    writeAutosave(doc);
  }

  async readProject(): Promise<unknown | null> {
    return readAutosave() ?? null;
  }

  async clearProject(): Promise<void> {
    clearAutosave();
  }
}
