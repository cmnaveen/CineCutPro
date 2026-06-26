import { useMemo } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { analyze } from '../engine/analyzer.js';
import { formatTC } from '../engine/timecode.js';

export function AnalyzerSlideout() {
  const { state, dispatch } = useEditor();
  const open = state.ui.analyzerOpen;
  const report = useMemo(() => analyze(state), [state]);

  const focusClip = (id, jump) => {
    dispatch({ type: 'select/clips', ids: [id] });
    if (jump != null) dispatch({ type: 'playback/setPlayhead', t: jump });
  };

  return (
    <div className={`cc-slideout cc-slideout--right ${open ? 'is-open' : ''}`}>
      <header className="cc-slideout__header">
        <div className="cc-panel__title">
          <Icon.Wand size={16} /> Boring / Jump Cut Analyzer
        </div>
        <button className="cc-icon-btn" onClick={() => dispatch({ type: 'ui/toggle', key: 'analyzerOpen' })}>✕</button>
      </header>

      <section className="cc-slideout__section">
        <label className="cc-field">
          <span className="cc-field__label">Boring shot threshold <strong>{state.analyzer.boringSeconds}s</strong></span>
          <input
            type="range"
            min={2}
            max={20}
            step={0.5}
            value={state.analyzer.boringSeconds}
            onChange={(e) =>
              dispatch({ type: 'analyzer/setThresholds', patch: { boringSeconds: parseFloat(e.target.value) } })
            }
          />
        </label>
        <label className="cc-field">
          <span className="cc-field__label">Jump cut gap ≤ <strong>{state.analyzer.jumpCutFrames}f</strong></span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={state.analyzer.jumpCutFrames}
            onChange={(e) =>
              dispatch({ type: 'analyzer/setThresholds', patch: { jumpCutFrames: parseInt(e.target.value, 10) } })
            }
          />
        </label>
      </section>

      <section className="cc-slideout__section">
        <h4>
          <span className="cc-dot cc-dot--warn" />
          Boring shots <span className="cc-panel__count">{report.boring.length}</span>
        </h4>
        <ul className="cc-slideout__list">
          {report.boring.length === 0 && <em>Nothing flagged.</em>}
          {report.boring.map((b) => (
            <li key={b.id} onClick={() => focusClip(b.id, b.start)}>
              <div>
                <strong>{formatTC(b.duration)}</strong> · starts {formatTC(b.start)}
              </div>
              <div className="cc-slideout__bar">
                <div style={{ width: `${Math.min(100, (b.duration / state.analyzer.boringSeconds) * 50)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cc-slideout__section">
        <h4>
          <span className="cc-dot cc-dot--bad" />
          Jump cuts <span className="cc-panel__count">{report.jumpCuts.length}</span>
        </h4>
        <ul className="cc-slideout__list">
          {report.jumpCuts.length === 0 && <em>No jump cuts.</em>}
          {report.jumpCuts.map((j, i) => (
            <li key={i} onClick={() => focusClip(j.aId, j.at)}>
              <div>
                Gap <strong>{j.gapFrames}f</strong> @ {formatTC(j.at)}
              </div>
              <div className="cc-slideout__sub">Same source · adjacent</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
