import React from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { clearAutosave } from '../engine/projectIO.js';
import { clearMedia } from '../engine/mediaStore.js';

const RES_PRESETS = [
  { id: '1080p', label: '1080p', w: 1920, h: 1080 },
  { id: '720p',  label: '720p',  w: 1280, h: 720 },
  { id: '4k',    label: '4K UHD', w: 3840, h: 2160 }
];
const FPS_OPTIONS = [24, 25, 30, 50, 60];

/**
 * Project settings — name, frame rate, and target resolution.
 *
 * The compositor works at 16:9; resolution sets the export output size (the
 * program canvas is fit-scaled into it). Frame rate drives transport math and
 * export capture rate.
 */
export function ProjectSettings() {
  const { state, dispatch } = useEditor();
  if (!state.ui.projectSettingsOpen) return null;

  const p = state.project;
  const close = () => dispatch({ type: 'ui/set', key: 'projectSettingsOpen', value: false });
  const upd = (patch) => dispatch({ type: 'project/update', patch });
  const activeRes = RES_PRESETS.find((r) => r.w === p.width && r.h === p.height);
  const newProject = () => {
    if (!window.confirm('Start a new project? This clears the autosaved session and imported media.')) return;
    clearAutosave();
    clearMedia();
    window.location.reload();
  };

  return (
    <div className="cc-modal-root" onClick={close}>
      <div className="cc-modal cc-project-settings" onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal__header">
          <div className="cc-modal__title">
            <Icon.Settings size={16} /> Project settings
          </div>
          <button className="cc-icon-btn" onClick={close}>✕</button>
        </header>

        <div className="cc-project-settings__body">
          <label className="cc-field">
            <span className="cc-field__label">Project name</span>
            <input
              className="cc-input"
              type="text"
              value={p.name}
              onChange={(e) => upd({ name: e.target.value })}
            />
          </label>

          <label className="cc-field cc-field--row">
            <span>Frame rate</span>
            <select value={p.fps} onChange={(e) => upd({ fps: parseInt(e.target.value, 10) })}>
              {FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>{f} fps</option>
              ))}
            </select>
          </label>

          <h4 className="cc-section__h4--gap">Resolution</h4>
          <div className="cc-project-settings__res">
            {RES_PRESETS.map((r) => (
              <button
                key={r.id}
                className={`cc-export__option ${activeRes?.id === r.id ? 'is-on' : ''}`}
                onClick={() => upd({ width: r.w, height: r.h })}
              >
                {r.label}
                <em>{r.w}×{r.h}</em>
              </button>
            ))}
          </div>

          <div className="cc-project-settings__custom">
            <label className="cc-field">
              <span className="cc-field__label">Width</span>
              <input
                className="cc-input"
                type="number"
                min={16}
                max={7680}
                value={p.width}
                onChange={(e) => upd({ width: Math.max(16, parseInt(e.target.value, 10) || 16) })}
              />
            </label>
            <label className="cc-field">
              <span className="cc-field__label">Height</span>
              <input
                className="cc-input"
                type="number"
                min={16}
                max={4320}
                value={p.height}
                onChange={(e) => upd({ height: Math.max(16, parseInt(e.target.value, 10) || 16) })}
              />
            </label>
          </div>
        </div>

        <footer className="cc-project-settings__footer">
          <button className="cc-btn cc-btn--ghost cc-btn--danger" onClick={newProject}>New project</button>
          <button className="cc-btn cc-btn--primary" onClick={close}>Done</button>
        </footer>
      </div>
    </div>
  );
}
