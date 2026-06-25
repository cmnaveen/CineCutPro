/**
 * CineCutPro — immutable JSON patch (Phase 0 / §11 of IMPLEMENTATION_PLAN.md).
 *
 * The pro history engine stores O(change) patches instead of O(project)
 * snapshots. A patch is a list of path-addressed ops, each carrying BOTH the
 * new value and the previous value so it can be inverted without re-diffing.
 *
 * Scope: plain JSON-shaped state (objects, arrays, primitives, null) — exactly
 * the persistent slices of the editor model. No Date/Map/Set/cycles.
 */

export type PathKey = string | number;
export type Path = PathKey[];

export type PatchOp =
  | { op: 'replace'; path: Path; value: unknown; old: unknown }
  | { op: 'add'; path: Path; value: unknown }
  | { op: 'remove'; path: Path; old: unknown };

export type Patch = PatchOp[];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structural equality for JSON-shaped values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

function diffValue(a: unknown, b: unknown, path: Path, out: Patch): void {
  if (deepEqual(a, b)) return;

  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const inA = Object.prototype.hasOwnProperty.call(a, k);
      const inB = Object.prototype.hasOwnProperty.call(b, k);
      if (inA && !inB) out.push({ op: 'remove', path: [...path, k], old: a[k] });
      else if (!inA && inB) out.push({ op: 'add', path: [...path, k], value: b[k] });
      else diffValue(a[k], b[k], [...path, k], out);
    }
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const common = Math.min(a.length, b.length);
    for (let i = 0; i < common; i++) diffValue(a[i], b[i], [...path, i], out);
    // Tail growth: append in ascending order.
    for (let i = common; i < b.length; i++) out.push({ op: 'add', path: [...path, i], value: b[i] });
    // Tail shrink: remove from the end so earlier indices stay valid during apply.
    for (let i = a.length - 1; i >= common; i--) out.push({ op: 'remove', path: [...path, i], old: a[i] });
    return;
  }

  out.push({ op: 'replace', path, value: b, old: a });
}

/** Produce a patch transforming `a` into `b`. Empty patch ⇒ no change. */
export function diff(a: unknown, b: unknown): Patch {
  const out: Patch = [];
  diffValue(a, b, [], out);
  return out;
}

/** Produce the inverse patch (transforms `b` back into `a`). */
export function invert(patch: Patch): Patch {
  const out: Patch = [];
  // Reverse order so array tail add/remove invert correctly.
  for (let i = patch.length - 1; i >= 0; i--) {
    const op = patch[i];
    if (op.op === 'replace') out.push({ op: 'replace', path: op.path, value: op.old, old: op.value });
    else if (op.op === 'add') out.push({ op: 'remove', path: op.path, old: op.value });
    else out.push({ op: 'add', path: op.path, value: op.old });
  }
  return out;
}

function setPath(node: unknown, path: Path, op: PatchOp, idx: number): unknown {
  const key = path[idx];
  const last = idx === path.length - 1;

  if (Array.isArray(node)) {
    const copy = node.slice();
    const i = key as number;
    if (last) {
      if (op.op === 'remove') copy.splice(i, 1);
      else copy[i] = (op as { value: unknown }).value;
    } else {
      copy[i] = setPath(node[i], path, op, idx + 1);
    }
    return copy;
  }

  // object (or create container if missing)
  const src = isObject(node) ? node : {};
  const copy: Record<string, unknown> = { ...src };
  const k = String(key);
  if (last) {
    if (op.op === 'remove') delete copy[k];
    else copy[k] = (op as { value: unknown }).value;
  } else {
    const child = copy[k];
    const seed = child !== undefined ? child : typeof path[idx + 1] === 'number' ? [] : {};
    copy[k] = setPath(seed, path, op, idx + 1);
  }
  return copy;
}

/** Apply a patch immutably (structural sharing); `target` is never mutated. */
export function apply<T>(target: T, patch: Patch): T {
  let result: unknown = target;
  for (const op of patch) {
    if (op.path.length === 0) {
      result = op.op === 'remove' ? undefined : (op as { value: unknown }).value;
    } else {
      result = setPath(result, op.path, op, 0);
    }
  }
  return result as T;
}
