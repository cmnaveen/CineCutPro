/**
 * CineCutPro — capability registry (Phase 0 / §4.2 Strategy + DI).
 *
 * A tiny typed dependency-injection container. Platform bootstraps (web / Tauri)
 * `provide()` their implementations once at startup; the engine and UI
 * `resolve()` capabilities by key. This is the seam that keeps the web and
 * native builds from drifting.
 */

import type { CapabilityKey, CapabilityMap } from './types';

export class CapabilityRegistry {
  private readonly impls = new Map<CapabilityKey, unknown>();

  provide<K extends CapabilityKey>(key: K, impl: CapabilityMap[K]): void {
    this.impls.set(key, impl);
  }

  has(key: CapabilityKey): boolean {
    return this.impls.has(key);
  }

  resolve<K extends CapabilityKey>(key: K): CapabilityMap[K] {
    const impl = this.impls.get(key);
    if (impl === undefined) {
      throw new Error(
        `Capability "${key}" is not provided. Did the platform bootstrap call provide("${key}", …)?`,
      );
    }
    return impl as CapabilityMap[K];
  }

  /** Resolve without throwing — null when absent (web build lacks native caps). */
  tryResolve<K extends CapabilityKey>(key: K): CapabilityMap[K] | null {
    return this.has(key) ? this.resolve(key) : null;
  }

  reset(): void {
    this.impls.clear();
  }
}

/** Default app-wide registry. Tests can construct their own instance. */
export const capabilities = new CapabilityRegistry();
