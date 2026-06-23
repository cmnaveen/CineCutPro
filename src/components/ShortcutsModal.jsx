import React from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';

const SECTIONS = [
  {
    title: 'Transport',
    rows: [
      ['Space / K', 'Play / Pause'],
      ['L', 'Forward — 1× → 2× → 4×'],
      ['J', 'Reverse — −1× → −2× → −4×'],
      ['Home', 'Jump to start']
    ]
  },
  {
    title: 'Marks',
    rows: [
      ['I  /  [', 'Mark In at playhead'],
      ['O  /  ]', 'Mark Out at playhead'],
      ['Ctrl + /', 'Clear marks']
    ]
  },
  {
    title: 'Source → Timeline',
    rows: [
      ['F9', 'Insert with ripple from Source'],
      ['F10', 'Overwrite from Source']
    ]
  },
  {
    title: 'Timeline edits',
    rows: [
      ['B', 'Blade at playhead'],
      ['Delete', 'Delete selection'],
      ['Shift + Delete', 'Ripple delete'],
      ['Ctrl + D', 'Duplicate selection'],
      ['S', 'Toggle snap']
    ]
  },
  {
    title: 'Zoom & undo',
    rows: [
      ['+', 'Zoom in (Ctrl+wheel also works)'],
      ['−', 'Zoom out'],
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y · Ctrl+Shift+Z', 'Redo']
    ]
  },
  {
    title: 'Misc',
    rows: [
      ['?', 'Show this help'],
      ['Esc', 'Clear selection / close modal']
    ]
  }
];

export function ShortcutsModal() {
  const { state, dispatch } = useEditor();
  if (!state.ui.shortcutsOpen) return null;
  return (
    <div className="cc-modal-root" onClick={() => dispatch({ type: 'ui/set', key: 'shortcutsOpen', value: false })}>
      <div className="cc-modal cc-shortcuts" onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal__header">
          <div className="cc-modal__title">
            <Icon.Help size={16} /> Keyboard shortcuts
          </div>
          <button className="cc-icon-btn" onClick={() => dispatch({ type: 'ui/set', key: 'shortcutsOpen', value: false })}>
            ✕
          </button>
        </header>
        <div className="cc-shortcuts__grid">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h4>{s.title}</h4>
              <dl>
                {s.rows.map(([k, v]) => (
                  <div key={k} className="cc-shortcuts__row">
                    <dt>
                      {k.split(' ').map((tok, i) =>
                        tok === '+' || tok === '·' ? (
                          <span key={i} className="cc-shortcuts__sep">{tok}</span>
                        ) : tok === '/' ? (
                          <span key={i} className="cc-shortcuts__sep">/</span>
                        ) : (
                          <span key={i} className="cc-kbd">{tok}</span>
                        )
                      )}
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
