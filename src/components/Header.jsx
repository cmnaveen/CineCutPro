import React from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';

export function Header() {
  const { state, dispatch, undo, redo, historyDepth } = useEditor();
  const playing = state.playing;
  const dir = state.playbackRate >= 0 ? '▶' : '◀';
  const mag = Math.abs(state.playbackRate || 1);

  return (
    <header className="cc-header">
      <div className="cc-header__brand">
        <div className="cc-header__logo" aria-hidden>
          <span className="cc-header__logo-dot" />
          <span className="cc-header__logo-dot cc-header__logo-dot--2" />
          <span className="cc-header__logo-dot cc-header__logo-dot--3" />
        </div>
        <div>
          <div className="cc-header__title">CineCutPro</div>
          <div className="cc-header__subtitle">
            <span className="cc-pill">{state.project.name}</span>
            <span className="cc-pill cc-pill--muted">
              {state.project.width}×{state.project.height} · {state.project.fps}fps
            </span>
            {state.project.dirty && <span className="cc-pill cc-pill--dirty">unsaved</span>}
          </div>
        </div>
      </div>

      <div className="cc-header__center">
        <div className="cc-transport">
          <button className="cc-icon-btn" onClick={undo} title="Undo (Ctrl+Z)">
            <Icon.Undo />
          </button>
          <button className="cc-icon-btn" onClick={redo} title="Redo (Ctrl+Y)">
            <Icon.Redo />
          </button>
          <span className="cc-transport__divider" />
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/setPlayhead', t: 0 })}
            title="Go to start (Home)"
          >
            ⏮
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/jklReverse' })}
            title="Reverse (J)"
          >
            <Icon.Back />
          </button>
          <button
            className="cc-icon-btn cc-icon-btn--primary"
            onClick={() => dispatch({ type: 'playback/togglePlay' })}
            title="Play / Pause (Space / K)"
          >
            {playing ? <Icon.Pause /> : <Icon.Play />}
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/jklForward' })}
            title="Forward (L) — press again for 2×/4×"
          >
            <Icon.Fwd />
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/stop' })}
            title="Stop"
          >
            <Icon.Stop />
          </button>
          <span className="cc-transport__divider" />
          <div className="cc-timecode" title="Timeline timecode">
            <span className="cc-timecode__rate">
              {dir} {mag}×
            </span>
            <span className="cc-timecode__value">{formatTC(state.playhead)}</span>
          </div>
        </div>
      </div>

      <div className="cc-header__right">
        <button
          className={`cc-chip ${state.ui.transitionsRailOpen ? 'is-on' : ''}`}
          onClick={() => dispatch({ type: 'ui/toggle', key: 'transitionsRailOpen' })}
          title="Transitions rail"
        >
          <Icon.Sparkles /> Transitions
        </button>
        <button
          className={`cc-chip ${state.ui.analyzerOpen ? 'is-on' : ''}`}
          onClick={() => dispatch({ type: 'ui/toggle', key: 'analyzerOpen' })}
          title="Boring / jump cut analyzer"
        >
          <Icon.Wand /> Analyzer
        </button>
        <button
          className={`cc-chip ${state.ui.monitorMode === 'single' ? 'is-on' : ''}`}
          onClick={() =>
            dispatch({
              type: 'ui/set',
              key: 'monitorMode',
              value: state.ui.monitorMode === 'dual' ? 'single' : 'dual'
            })
          }
          title="Toggle dual / single monitor (\\)"
        >
          <Icon.Layers /> {state.ui.monitorMode === 'dual' ? 'Dual' : 'Single'}
        </button>
        <button
          className="cc-icon-btn"
          onClick={async () => {
            const { downloadProject } = await import('../engine/projectIO.js');
            downloadProject(state);
            dispatch({ type: 'toast/push', kind: 'success', message: 'Project saved' });
          }}
          title="Save project (Ctrl+S)"
        >
          ⤓ Save
        </button>
        <button
          className="cc-icon-btn"
          onClick={async () => {
            const { pickProjectFile } = await import('../engine/projectIO.js');
            try {
              const snap = await pickProjectFile();
              dispatch({ type: 'project/loadAll', snapshot: snap });
              dispatch({ type: 'toast/push', kind: 'success', message: 'Project loaded' });
            } catch (err) {
              if (err?.message !== 'cancelled') {
                dispatch({ type: 'toast/push', kind: 'error', message: `Load failed: ${err.message}` });
              }
            }
          }}
          title="Open project (Ctrl+O)"
        >
          ⤒ Open
        </button>
        <button
          className="cc-btn cc-btn--ghost"
          onClick={() => dispatch({ type: 'ui/toggle', key: 'shortcutsOpen' })}
          title="Keyboard shortcuts (?)"
        >
          <Icon.Help /> Shortcuts
        </button>
        <button
          className="cc-btn cc-btn--primary"
          onClick={() => dispatch({ type: 'ui/set', key: 'exportOpen', value: true })}
        >
          <Icon.Export /> Export
        </button>
        <div className="cc-history" title="Undo history depth">{historyDepth}/50</div>
      </div>
    </header>
  );
}
