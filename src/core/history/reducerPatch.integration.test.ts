/**
 * Integration proof (Phase 0 / §11): the patch-based history reproduces the
 * EXISTING reducer's undo/redo semantics on real actions. This is what lets a
 * later increment swap snapshot history for patch history without behavior
 * change — and shows the new engine is wired to reality, not a parallel toy.
 */
import { describe, it, expect } from 'vitest';
// Real app modules (untyped JS — the working reducer + its persistent-slice snapshot).
import { reducer } from '../../state/editorReducer.js';
import { initialState } from '../../state/initialState.js';
import { snapshot } from '../../state/history.js';
import { PatchHistory } from './patchHistory';
import { CommandBus, command } from './command';

type AnyState = Record<string, unknown>;

/** Typed wrapper over the untyped JS `snapshot` (persistent-slice deep clone). */
const snap = (s: AnyState): AnyState => snapshot(s) as AnyState;

const videoTrackId = (s: AnyState): string =>
  (s.tracks as { kind: string; id: string }[]).find((t) => t.kind === 'video')!.id;

/** Drive the real reducer; record every transition's persistent slices as a patch. */
function run(actions: { type: string; [k: string]: unknown }[]) {
  let state = initialState as AnyState;
  const history = new PatchHistory();
  const persistentStates = [snap(state)];
  for (const action of actions) {
    const before = snap(state);
    state = reducer(state, action) as AnyState;
    const after = snap(state);
    history.record(before, after, { label: action.type });
    persistentStates.push(after);
  }
  return { state, history, persistentStates };
}

describe('patch history vs. real reducer', () => {
  it('records, undoes, and redoes a real edit sequence to identical states', () => {
    const m1 = { id: 'm1', name: 'a.mp4', kind: 'video', src: 'x', duration: 10 };

    // Build a sequence whose action shapes match the reducer test suite.
    let probe = reducer(initialState, { type: 'media/add', items: [m1] }) as AnyState;
    const tId = videoTrackId(probe);

    const actions = [
      { type: 'media/add', items: [m1] },
      { type: 'clip/insertFromMedia', mediaId: 'm1', trackId: tId, start: 0 },
      { type: 'project/update', patch: { name: 'Cut 1', fps: 60 } },
    ];

    const { history, persistentStates } = run(actions);
    expect(history.past.length).toBe(3);

    // Walk all the way back; each undo must land on the prior persistent snapshot.
    let cur = persistentStates[persistentStates.length - 1];
    for (let i = persistentStates.length - 2; i >= 0; i--) {
      cur = history.undo(cur);
      expect(cur).toEqual(persistentStates[i]);
    }
    expect(history.canUndo).toBe(false);

    // Redo forward; must replay to each next snapshot.
    for (let i = 1; i < persistentStates.length; i++) {
      cur = history.redo(cur);
      expect(cur).toEqual(persistentStates[i]);
    }
  });

  it('drives the reducer through the CommandBus with undo/redo', () => {
    const m1 = { id: 'm1', name: 'a.mp4', kind: 'video', src: 'x', duration: 10 };
    const probe = reducer(initialState, { type: 'media/add', items: [m1] }) as AnyState;
    const tId = videoTrackId(probe);

    // Wrap the reducer as commands over the persistent-slice model.
    const bus = new CommandBus<AnyState>(snap(initialState));
    const dispatch = (action: { type: string; [k: string]: unknown }) =>
      bus.dispatch(
        command(action.type, (model) => snap(reducer({ ...initialState, ...model }, action) as AnyState)),
      );

    dispatch({ type: 'media/add', items: [m1] });
    dispatch({ type: 'clip/insertFromMedia', mediaId: 'm1', trackId: tId, start: 0 });
    expect((bus.getState().clips as unknown[]).length).toBe(1);
    expect((bus.getState().media as unknown[]).length).toBe(1);

    bus.undo(); // remove the clip
    expect((bus.getState().clips as unknown[]).length).toBe(0);
    bus.undo(); // remove the media
    expect((bus.getState().media as unknown[]).length).toBe(0);

    bus.redo();
    expect((bus.getState().media as unknown[]).length).toBe(1);
  });
});
