import React from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';
import { audioEngine } from '../engine/audioEngine.js';

export function Header() {
  const { state, dispatch, undo, redo, historyDepth } = useEditor();
  const playing = state.playing;
  const dir = state.playbackRate >= 0 ? '▶' : '◀';
  const mag = Math.abs(state.playbackRate || 1);

  return (
    <header className="cc-header" style={{ background: '#09090b', borderBottom: '1px solid #1c1c21' }}>
      {/* Left: CapCut Hex Logo & Project Renaming */}
      <div className="cc-header__brand" style={{ gap: '14px' }}>
        <div 
          className="cc-left-sidebar__logo-icon" 
          style={{ 
            width: '28px', 
            height: '28px', 
            background: '#fff', 
            color: '#000', 
            fontWeight: '900',
            fontSize: '14px',
            borderRadius: '0' 
          }}
          aria-hidden
        >
          C
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              value={state.project.name}
              onChange={(e) => dispatch({ type: 'project/rename', name: e.target.value })}
              title="Click to rename project"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f4f4f5',
                fontWeight: 700,
                fontSize: '13.5px',
                padding: '2px 4px',
                borderRadius: '4px',
                width: '150px',
                outline: 'none',
                transition: 'background 0.2s'
              }}
              className="cc-header-project-name-input"
            />
            <span style={{ fontSize: '10px', color: '#71717a' }}>▼</span>
          </div>
          <div className="cc-header__subtitle" style={{ fontSize: '10px', color: '#71717a', margin: '2px 0 0 4px' }}>
            <span>{state.project.width}×{state.project.height} · {state.project.fps}fps</span>
            {state.project.dirty && (
              <span style={{ color: '#eab308', marginLeft: '6px', fontWeight: 'bold' }}>[unsaved]</span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Playback & Timeline Navigation Controls */}
      <div className="cc-header__center">
        <div className="cc-transport" style={{ background: '#121215', borderColor: '#27272a' }}>
          <button className="cc-icon-btn" onClick={undo} title="Undo (Ctrl+Z)" style={{ border: 'none' }}>
            <Icon.Undo size={14} />
          </button>
          <button className="cc-icon-btn" onClick={redo} title="Redo (Ctrl+Y)" style={{ border: 'none' }}>
            <Icon.Redo size={14} />
          </button>
          <span className="cc-transport__divider" />
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/setPlayhead', t: 0 })}
            title="Go to start (Home)"
            style={{ border: 'none' }}
          >
            ⏮
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => {
              audioEngine.resume();
              dispatch({ type: 'playback/jklReverse' });
            }}
            title="Reverse (J)"
            style={{ border: 'none' }}
          >
            <Icon.Back size={14} />
          </button>
          <button
            className="cc-icon-btn cc-icon-btn--primary"
            onClick={() => {
              audioEngine.resume();
              dispatch({ type: 'playback/togglePlay' });
            }}
            title="Play / Pause (Space / K)"
            style={{ 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              padding: 0, 
              display: 'grid', 
              placeItems: 'center', 
              background: '#fff', 
              color: '#000', 
              border: 'none',
              boxShadow: '0 2px 8px rgba(255,255,255,0.15)'
            }}
          >
            {playing ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => {
              audioEngine.resume();
              dispatch({ type: 'playback/jklForward' });
            }}
            title="Forward (L)"
            style={{ border: 'none' }}
          >
            <Icon.Fwd size={14} />
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/stop' })}
            title="Stop"
            style={{ border: 'none' }}
          >
            <Icon.Stop size={14} />
          </button>
          <span className="cc-transport__divider" />
          <div className="cc-timecode" title="Timeline timecode" style={{ background: '#09090b', borderColor: '#1c1c21' }}>
            <span className="cc-timecode__rate" style={{ fontSize: '10px' }}>
              {dir} {mag}×
            </span>
            <span className="cc-timecode__value" style={{ fontSize: '11px' }}>{formatTC(state.playhead)}</span>
          </div>
        </div>
      </div>

      {/* Right: Menu buttons and Bright Blue Export Button */}
      <div className="cc-header__right" style={{ gap: '8px' }}>
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
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          <Icon.Layers size={13} /> {state.ui.monitorMode === 'dual' ? 'Dual' : 'Single'}
        </button>

        <button
          className={`cc-chip ${state.ui.multicamOpen ? 'is-on' : ''}`}
          onClick={() =>
            dispatch({
              type: 'ui/set',
              key: 'multicamOpen',
              value: !state.ui.multicamOpen
            })
          }
          title="Toggle Multicam Grid"
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          🎬 Multicam
        </button>

        <select
          value={state.ui.panelLayout}
          onChange={(e) => dispatch({ type: 'ui/set', key: 'panelLayout', value: e.target.value })}
          style={{
            background: '#121215',
            color: '#f4f4f5',
            border: '1px solid #27272a',
            borderRadius: '6px',
            fontSize: '11px',
            padding: '4px 8px',
            outline: 'none',
            cursor: 'pointer'
          }}
          title="Switch workspace layout"
        >
          <option value="default">🎬 Edit Workspace</option>
          <option value="color">🎨 Color Grading</option>
          <option value="audio">🔊 Audio Mixer</option>
        </select>
        
        <button
          className="cc-btn cc-btn--ghost"
          onClick={async () => {
            const { downloadProject } = await import('../engine/projectIO.js');
            downloadProject(state);
            dispatch({ type: 'toast/push', kind: 'success', message: 'Project saved' });
          }}
          title="Save project (Ctrl+S)"
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          ⤓ Save
        </button>
        
        <button
          className="cc-btn cc-btn--ghost"
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
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          ⤒ Open
        </button>

        <button
          className="cc-btn cc-btn--ghost"
          onClick={() => dispatch({ type: 'ui/set', key: 'projectSettingsOpen', value: true })}
          title="Project settings"
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          <Icon.Settings size={13} /> Settings
        </button>

        <button
          className="cc-btn cc-btn--ghost"
          onClick={() => dispatch({ type: 'ui/toggle', key: 'shortcutsOpen' })}
          title="Keyboard shortcuts (?)"
          style={{ fontSize: '11px', padding: '5px 10px' }}
        >
          <Icon.Help size={13} /> Shortcuts
        </button>

        {/* CapCut-style bright blue export button */}
        <button
          className="cc-btn cc-btn--primary"
          onClick={() => dispatch({ type: 'ui/set', key: 'exportOpen', value: true })}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#fff',
            fontWeight: 700,
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '12px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}
        >
          <Icon.Export size={13} style={{ stroke: '#fff' }} /> Export
        </button>

        {/* User profile avatar style */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#27272a',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '11px',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid #3f3f46',
          cursor: 'pointer'
        }} title="User Profile">
          U
        </div>

        <div className="cc-history" title="Undo history depth" style={{ fontSize: '10px', padding: '2px 6px' }}>
          {historyDepth}/50
        </div>
      </div>
    </header>
  );
}
