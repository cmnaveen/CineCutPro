import { describe, it, expect, vi } from 'vitest';
import { CommandBus, command } from './command';

interface Model {
  clips: { id: string; start: number }[];
  selection: string[];
}

const initial: Model = { clips: [], selection: [] };

const addClip = (id: string, start: number) =>
  command<Model>('Insert Clip', (m) => ({ ...m, clips: [...m.clips, { id, start }] }));

const moveClip = (id: string, start: number) =>
  command<Model>('Move Clip', (m) => ({
    ...m,
    clips: m.clips.map((c) => (c.id === id ? { ...c, start } : c)),
  }), `move-${id}`);

describe('CommandBus', () => {
  it('applies commands immutably and exposes the new state', () => {
    const bus = new CommandBus(initial);
    const before = bus.getState();
    bus.dispatch(addClip('c1', 0));
    expect(bus.getState().clips).toHaveLength(1);
    expect(before.clips).toHaveLength(0); // original untouched
  });

  it('notifies subscribers on dispatch', () => {
    const bus = new CommandBus(initial);
    const spy = vi.fn();
    bus.subscribe(spy);
    bus.dispatch(addClip('c1', 0));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(bus.getState());
  });

  it('supports undo / redo through history', () => {
    const bus = new CommandBus(initial);
    bus.dispatch(addClip('c1', 0));
    bus.dispatch(addClip('c2', 30));
    expect(bus.getState().clips).toHaveLength(2);

    bus.undo();
    expect(bus.getState().clips).toHaveLength(1);
    bus.undo();
    expect(bus.getState().clips).toHaveLength(0);
    expect(bus.canUndo).toBe(false);

    bus.redo();
    expect(bus.getState().clips).toHaveLength(1);
  });

  it('coalesces a drag gesture (same coalesceKey) into one undo', () => {
    const bus = new CommandBus(initial);
    bus.dispatch(addClip('c1', 0));
    // simulate a drag: many move commands, same key, same tick
    bus.dispatch(moveClip('c1', 5));
    bus.dispatch(moveClip('c1', 10));
    bus.dispatch(moveClip('c1', 20));
    expect(bus.getState().clips[0].start).toBe(20);

    bus.undo(); // undoes the whole drag at once → back to 0
    expect(bus.getState().clips[0].start).toBe(0);
  });

  it('groups multiple commands into one undo step via transaction', () => {
    const bus = new CommandBus(initial);
    const spy = vi.fn();
    bus.subscribe(spy);

    bus.transaction('Paste 3 clips', (apply) => {
      apply(addClip('a', 0));
      apply(addClip('b', 30));
      apply(addClip('c', 60));
    });

    expect(bus.getState().clips).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1); // one notify for the whole transaction

    bus.undo();
    expect(bus.getState().clips).toHaveLength(0); // single undo removes all three
  });
});
