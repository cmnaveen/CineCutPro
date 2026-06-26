import { useEditor } from '../state/EditorContext.jsx';
import { writeWelcomeDismissed } from '../state/initialState.js';
import { Icon } from './icons/IconSet.jsx';

/**
 * First-run welcome.  Highlights the headline features and gives the user
 * three obvious next actions: import media, drop a title, open the shortcut
 * sheet.  Persists "don't show again" to localStorage.
 */
const HIGHLIGHTS = [
  { icon: 'Layers',    title: 'Triple-panel workspace',     body: 'Source + Program monitors, multi-track timeline, full inspector.' },
  { icon: 'Sparkles',  title: '13 transitions · 7 titles',  body: 'Drag transitions onto clip edges. Apple-glass titles refract video underneath.' },
  { icon: 'Wand',      title: 'Boring & jump-cut analyzer', body: 'Set thresholds, jump straight to flagged spots.' },
  { icon: 'Export',    title: 'Canvas export',              body: 'Render the live composition to WebM/MP4.' }
];

export function WelcomeModal() {
  const { state, dispatch } = useEditor();
  if (!state.ui.welcomeOpen) return null;

  const close = (dismiss = false) => {
    if (dismiss) writeWelcomeDismissed();
    dispatch({ type: 'ui/set', key: 'welcomeOpen', value: false });
  };

  return (
    <div className="cc-modal-root cc-welcome-root" onClick={() => close(false)}>
      <div className="cc-modal cc-welcome" onClick={(e) => e.stopPropagation()}>
        <div className="cc-welcome__hero">
          <div className="cc-welcome__logo">
            <span className="cc-welcome__ring cc-welcome__ring--1" />
            <span className="cc-welcome__ring cc-welcome__ring--2" />
            <span className="cc-welcome__ring cc-welcome__ring--3" />
            <span className="cc-welcome__brand">CC</span>
          </div>
          <h1>CineCutPro</h1>
          <p>A premium browser video editor.</p>
        </div>

        <div className="cc-welcome__grid">
          {HIGHLIGHTS.map((h) => {
            const I = Icon[h.icon];
            return (
              <div key={h.title} className="cc-welcome__feature">
                <div className="cc-welcome__feature-icon"><I size={18} /></div>
                <div>
                  <h4>{h.title}</h4>
                  <p>{h.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cc-welcome__shortcuts">
          <span><kbd>Space</kbd> play</span>
          <span><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> transport</span>
          <span><kbd>I</kbd> <kbd>O</kbd> marks</span>
          <span><kbd>B</kbd> blade</span>
          <span><kbd>?</kbd> all shortcuts</span>
        </div>

        <div className="cc-welcome__actions">
          <button className="cc-btn cc-btn--ghost" onClick={() => close(false)}>
            Open editor
          </button>
          <button className="cc-btn cc-btn--primary" onClick={() => close(true)}>
            Get started — don't show again
          </button>
        </div>
      </div>
    </div>
  );
}
