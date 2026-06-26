import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { clearAutosave } from '../engine/projectIO.js';
import { clearMedia } from '../engine/mediaStore.js';

const AR_PRESETS = [
  { id: '16_9', label: '16:9 Landscape', w: 1920, h: 1080 },
  { id: '9_16', label: '9:16 Vertical',  w: 1080, h: 1920 },
  { id: '1_1',  label: '1:1 Square',     w: 1080, h: 1080 },
  { id: '4_3',  label: '4:3 Traditional',w: 1440, h: 1080 },
  { id: '2_39', label: '2.39:1 Cinema',  w: 2560, h: 1080 }
];
const FPS_OPTIONS = [24, 25, 30, 50, 60];

/**
 * Project settings — name, frame rate, and target resolution.
 */
export function ProjectSettings() {
  const { state, dispatch } = useEditor();
  if (!state.ui.projectSettingsOpen) return null;

  const p = state.project;
  const close = () => dispatch({ type: 'ui/set', key: 'projectSettingsOpen', value: false });
  const upd = (patch) => dispatch({ type: 'project/update', patch });

  const currentRatio = p.width / p.height;
  const isVertical = p.height > p.width;
  const dynamicResList = [
    { id: '720p', label: '720p', w: isVertical ? 720 : Math.round(720 * currentRatio), h: isVertical ? Math.round(720 / currentRatio) : 720 },
    { id: '1080p', label: '1080p', w: isVertical ? 1080 : Math.round(1080 * currentRatio), h: isVertical ? Math.round(1080 / currentRatio) : 1080 },
    { id: '4k', label: '4K UHD', w: isVertical ? 2160 : Math.round(2160 * currentRatio), h: isVertical ? Math.round(2160 / currentRatio) : 2160 }
  ];

  const activeRes = dynamicResList.find((r) => r.w === p.width && r.h === p.height);

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

          <h4 className="cc-section__h4--gap">Aspect Ratio</h4>
          <div className="cc-project-settings__res" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {AR_PRESETS.map((ar) => {
              const active = p.width === ar.w && p.height === ar.h;
              return (
                <button
                  key={ar.id}
                  className={`cc-export__option ${active ? 'is-on' : ''}`}
                  onClick={() => upd({ width: ar.w, height: ar.h })}
                  style={{ padding: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <strong>{ar.label}</strong>
                  <em style={{ fontSize: '9px', opacity: 0.6 }}>{ar.w}×{ar.h}</em>
                </button>
              );
            })}
          </div>

          <h4 className="cc-section__h4--gap">Target Resolution</h4>
          <div className="cc-project-settings__res">
            {dynamicResList.map((r) => (
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
