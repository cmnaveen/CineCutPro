import React, { useMemo } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { TRANSITIONS } from '../engine/transitions.js';

export function TransitionsRail() {
  const { state, dispatch, selectedClips } = useEditor();
  const open = state.ui.transitionsRailOpen;

  const grouped = useMemo(() => {
    const m = new Map();
    for (const t of TRANSITIONS) {
      if (!m.has(t.group)) m.set(t.group, []);
      m.get(t.group).push(t);
    }
    return Array.from(m.entries());
  }, []);

  const apply = (kind, side) => {
    if (!selectedClips.length) return;
    for (const c of selectedClips) {
      dispatch({ type: 'transition/apply', clipId: c.id, side, kind, duration: 0.7 });
    }
  };

  const startDrag = (kind) => (e) => {
    e.dataTransfer.setData('application/x-cinecut-transition', kind);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={`cc-slideout cc-slideout--left ${open ? 'is-open' : ''}`}>
      <header className="cc-slideout__header">
        <div className="cc-panel__title">
          <Icon.Sparkles size={16} /> Transitions
        </div>
        <button className="cc-icon-btn" onClick={() => dispatch({ type: 'ui/toggle', key: 'transitionsRailOpen' })}>
          ✕
        </button>
      </header>

      <div className="cc-slideout__hint">
        Drag onto a clip edge — or select clips and click <strong>In</strong> / <strong>Out</strong>.
      </div>

      {grouped.map(([group, items]) => (
        <section key={group} className="cc-trans-group">
          <h4>{group}</h4>
          <div className="cc-trans-grid">
            {items.map((t) => (
              <div
                key={t.id}
                className={`cc-trans-card cc-trans-card--${t.id}`}
                draggable
                onDragStart={startDrag(t.id)}
              >
                <div className="cc-trans-card__preview">
                  <span className="cc-trans-card__a" />
                  <span className={`cc-trans-card__b cc-trans-card__b--${t.id}`} />
                </div>
                <div className="cc-trans-card__name">{t.label}</div>
                <div className="cc-trans-card__actions">
                  <button className="cc-btn cc-btn--xs" onClick={() => apply(t.id, 'in')} disabled={!selectedClips.length}>In</button>
                  <button className="cc-btn cc-btn--xs" onClick={() => apply(t.id, 'out')} disabled={!selectedClips.length}>Out</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
