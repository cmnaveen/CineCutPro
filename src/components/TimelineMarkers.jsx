import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';

const MARKER_COLORS = [
  { value: '#fbbf24', name: 'Amber' },
  { value: '#ef4444', name: 'Red' },
  { value: '#10b981', name: 'Green' },
  { value: '#3b82f6', name: 'Blue' },
  { value: '#8b5cf6', name: 'Purple' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#06b6d4', name: 'Cyan' }
];

export function TimelineMarkers() {
  const { state, dispatch } = useEditor();
  const open = state.ui.markersOpen;

  const markers = (state.markers ?? []).slice().sort((a, b) => a.time - b.time);

  const handleSeek = (time) => {
    dispatch({ type: 'playback/setPlayhead', t: time });
  };

  const handleUpdate = (id, patch) => {
    dispatch({ type: 'marker/update', id, patch });
  };

  const handleAdd = () => {
    dispatch({
      type: 'marker/add',
      time: state.playhead,
      label: `Marker ${markers.length + 1}`,
      color: '#fbbf24',
      chapter: false
    });
    dispatch({ type: 'toast/push', kind: 'success', message: 'Added timeline marker' });
  };

  return (
    <div className={`cc-slideout cc-slideout--right ${open ? 'is-open' : ''}`} style={{ zIndex: 100 }}>
      <header className="cc-slideout__header">
        <div className="cc-panel__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📍</span> Timeline Markers
        </div>
        <button className="cc-icon-btn" onClick={() => dispatch({ type: 'ui/toggle', key: 'markersOpen' })}>✕</button>
      </header>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          {markers.length} marker{markers.length !== 1 ? 's' : ''} on timeline
        </span>
        <button className="cc-btn cc-btn--accent cc-btn--sm" onClick={handleAdd}>
          ＋ Add Marker
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {markers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📍</span>
            No markers on the timeline. Double-click the ruler or click the button above to add one at the playhead.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {markers.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}
              >
                {/* Header row: time + navigation + delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    className="cc-btn cc-btn--text cc-btn--sm"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: m.color,
                      padding: 0,
                      fontWeight: 'bold',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSeek(m.time)}
                    title="Seek to marker time"
                  >
                    ⏱️ {formatTC(m.time)}
                  </button>

                  <button
                    className="cc-icon-btn cc-icon-btn--danger"
                    onClick={() => dispatch({ type: 'marker/remove', id: m.id })}
                    title="Delete marker"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Icon.Trash size={14} />
                  </button>
                </div>

                {/* Input row: Label */}
                <input
                  type="text"
                  placeholder="Untitled Marker"
                  value={m.label}
                  onChange={(e) => handleUpdate(m.id, { label: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#121217',
                    border: '1px solid var(--line-2)',
                    color: 'var(--text-1)',
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: '4px'
                  }}
                />

                {/* Bottom row: colors & chapter toggles */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  {/* Colors */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {MARKER_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => handleUpdate(m.id, { color: c.value })}
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: c.value,
                          border: m.color === c.value ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>

                  {/* Chapter toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-2)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={m.chapter ?? false}
                      onChange={(e) => handleUpdate(m.id, { chapter: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    YouTube Chapter
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
