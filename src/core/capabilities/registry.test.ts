import { describe, it, expect } from 'vitest';
import { CapabilityRegistry } from './registry';
import type { Storage } from './types';

class MemoryStorage implements Storage {
  private media = new Map<string, Blob>();
  private project: unknown = null;
  async putMedia(id: string, blob: Blob) {
    this.media.set(id, blob);
  }
  async getMedia(id: string) {
    return this.media.get(id) ?? null;
  }
  async deleteMedia(id: string) {
    this.media.delete(id);
  }
  async clearMedia() {
    this.media.clear();
  }
  async writeProject(doc: unknown) {
    this.project = doc;
  }
  async readProject() {
    return this.project;
  }
  async clearProject() {
    this.project = null;
  }
}

describe('CapabilityRegistry', () => {
  it('provides and resolves a capability', () => {
    const reg = new CapabilityRegistry();
    const storage = new MemoryStorage();
    reg.provide('storage', storage);
    expect(reg.has('storage')).toBe(true);
    expect(reg.resolve('storage')).toBe(storage);
  });

  it('throws a helpful error when a capability is missing', () => {
    const reg = new CapabilityRegistry();
    expect(() => reg.resolve('render')).toThrow(/not provided/);
  });

  it('tryResolve returns null when absent', () => {
    const reg = new CapabilityRegistry();
    expect(reg.tryResolve('ai')).toBeNull();
  });

  it('resets all registrations', () => {
    const reg = new CapabilityRegistry();
    reg.provide('storage', new MemoryStorage());
    reg.reset();
    expect(reg.has('storage')).toBe(false);
  });

  it('the resolved storage round-trips media and project docs', async () => {
    const reg = new CapabilityRegistry();
    reg.provide('storage', new MemoryStorage());
    const s = reg.resolve('storage');
    const blob = new Blob(['hi']);
    await s.putMedia('m1', blob);
    expect(await s.getMedia('m1')).toBe(blob);
    await s.writeProject({ name: 'proj' });
    expect(await s.readProject()).toEqual({ name: 'proj' });
  });
});
