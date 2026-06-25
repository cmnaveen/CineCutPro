import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { mediaRenderer } from '../engine/mediaRenderer.js';
import { cutToAngle, alignClips } from '../engine/multicamEditor.js';
import { Icon } from './icons/IconSet.jsx';

export function MulticamViewer() {
  const { state, dispatch } = useEditor();
  const open = state.ui.multicamOpen;

  const videoMedia = state.media.filter(m => m.kind === 'video');
  const [syncMethod, setSyncMethod] = useState('start');
  const videoRefs = useRef(new Map());

  // Listen to mediaRenderer ticks to keep all grid video elements in sync with playhead
  useEffect(() => {
    if (!open) return;

    const unsubscribe = mediaRenderer.onTick(({ t, playing }) => {
      for (const [mediaId, videoEl] of videoRefs.current.entries()) {
        if (!videoEl) continue;

        // Sync timecode
        const diff = t - videoEl.currentTime;
        if (Math.abs(diff) > 0.08) {
          videoEl.currentTime = t;
        }

        // Sync play/pause state
        if (playing && videoEl.paused) {
          videoEl.play().catch(() => {});
        } else if (!playing && !videoEl.paused) {
          videoEl.pause();
        }
      }
    });

    return () => unsubscribe();
  }, [open, state.playhead]);

  if (!open) return null;

  const handleAngleClick = (mediaId) => {
    const nextClips = cutToAngle(state, state.playhead, mediaId);
    if (nextClips) {
      dispatch({ type: 'clip/updateAll', clips: nextClips });
      dispatch({ type: 'toast/push', kind: 'success', message: 'Cut to camera angle' });
    } else {
      dispatch({ type: 'toast/push', kind: 'info', message: 'No active clip on timeline to switch.' });
    }
  };

  // Keyboard shortcut listener (keys 1-9 to switch angles)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= videoMedia.length) {
        const mediaId = videoMedia[num - 1].id;
        handleAngleClick(mediaId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, videoMedia]);

  const handleSyncAll = () => {
    dispatch({ type: 'toast/push', kind: 'info', message: `Aligning angles by: ${syncMethod}...` });
    const alignedClips = alignClips(state.clips.filter(c => c.kind === 'video'), syncMethod);
    const otherClips = state.clips.filter(c => c.kind !== 'video');
    dispatch({ type: 'clip/updateAll', clips: [...otherClips, ...alignedClips] });
    dispatch({ type: 'toast/push', kind: 'success', message: 'Camera angles aligned!' });
  };

  return (
    <div className="cc-multicam-viewer cc-panel-premium">
      <header className="cc-multicam-header">
        <div className="cc-multicam-title">
          🎬 Multicam Grid ({videoMedia.length} Angles)
        </div>
        <div className="cc-multicam-sync-controls">
          <select 
            className="cc-select cc-select--xs" 
            value={syncMethod} 
            onChange={e => setSyncMethod(e.target.value)}
          >
            <option value="start">Sync by Clip Start</option>
            <option value="inPoint">Sync by In-Point</option>
            <option value="audio">Sync by Waveform</option>
          </select>
          <button className="cc-pill" onClick={handleSyncAll}>
            Align Angles
          </button>
        </div>
        <button 
          className="cc-icon-btn cc-multicam-close" 
          onClick={() => dispatch({ type: 'ui/set', key: 'multicamOpen', value: false })}
          title="Close multicam viewer"
        >
          ✕
        </button>
      </header>

      {videoMedia.length === 0 ? (
        <div className="cc-multicam-empty">
          <p>Please import multiple video clips to utilize the Multicam Grid.</p>
        </div>
      ) : (
        <div 
          className="cc-multicam-grid" 
          style={{ gridTemplateColumns: videoMedia.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}
        >
          {videoMedia.map((m, index) => {
            const isActiveAngle = state.clips.some(c => 
              c.mediaId === m.id && c.start <= state.playhead && c.end > state.playhead
            );

            return (
              <div 
                key={m.id} 
                className={`cc-multicam-angle ${isActiveAngle ? 'is-active' : ''}`}
                onClick={() => handleAngleClick(m.id)}
                title={`Click to cut to camera angle ${index + 1}`}
              >
                <div className="cc-multicam-video-wrapper">
                  <video 
                    ref={el => {
                      if (el) videoRefs.current.set(m.id, el);
                      else videoRefs.current.delete(m.id);
                    }}
                    src={m.src}
                    muted
                    playsInline
                  />
                  <div className="cc-multicam-angle-badge">{index + 1}</div>
                </div>
                <div className="cc-multicam-angle-meta">
                  <span className="cc-multicam-angle-name">{m.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="cc-multicam-tip">
        💡 Pro-Tip: Press hotkeys <strong>1-{videoMedia.length}</strong> to cut between angles in real-time during playback.
      </div>
    </div>
  );
}
