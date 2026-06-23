import React, { useEffect, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { formatTC } from '../engine/timecode.js';
import { mediaRenderer } from '../engine/mediaRenderer.js';

/**
 * Bottom status bar — project mode, selection summary, live FPS, total
 * duration, draw-call count, and a render indicator.
 */
export function StatusBar() {
  const { state, duration, selectedClips, historyDepth } = useEditor();
  const [fps, setFps] = useState(0);
  const [drawCalls, setDrawCalls] = useState(0);
  const [activeClips, setActiveClips] = useState(0);

  useEffect(() => {
    let raf;
    const tick = () => {
      setFps(mediaRenderer.lastFrameStats.fps);
      setDrawCalls(mediaRenderer.lastFrameStats.drawCalls);
      setActiveClips(mediaRenderer.lastFrameStats.activeClips);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const totalClips = state.clips.length;
  const totalMedia = state.media.length;

  return (
    <footer className="cc-statusbar">
      <div className="cc-statusbar__left">
        <span className={`cc-statusbar__indicator ${state.playing ? 'is-on' : ''}`}>●</span>
        <span className="cc-statusbar__mode">{state.playing ? 'PLAYING' : 'IDLE'}</span>
        <span className="cc-statusbar__divider" />
        <span>
          {selectedClips.length > 0
            ? `${selectedClips.length} clip${selectedClips.length > 1 ? 's' : ''} selected`
            : 'No selection'}
        </span>
        <span className="cc-statusbar__divider" />
        <span>{totalClips} clip{totalClips !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{totalMedia} media item{totalMedia !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{state.tracks.length} tracks</span>
      </div>
      <div className="cc-statusbar__center">
        <span className="cc-statusbar__tc-label">TIMELINE</span>
        <span className="cc-statusbar__tc">{formatTC(state.playhead)}</span>
        <span>/</span>
        <span className="cc-statusbar__tc cc-statusbar__tc--dim">{formatTC(duration)}</span>
        {state.inPoint != null && state.outPoint != null && (
          <>
            <span className="cc-statusbar__divider" />
            <span>I/O</span>
            <span className="cc-statusbar__tc cc-statusbar__tc--dim">
              {formatTC(state.outPoint - state.inPoint)}
            </span>
          </>
        )}
      </div>
      <div className="cc-statusbar__right">
        <span title="Active clips this frame">{activeClips} active</span>
        <span>·</span>
        <span title="Draw calls per frame">{drawCalls} draws</span>
        <span className="cc-statusbar__divider" />
        <span className={`cc-statusbar__fps ${fps >= 50 ? 'is-good' : fps >= 25 ? 'is-mid' : 'is-bad'}`}>
          {fps || '—'} FPS
        </span>
        <span className="cc-statusbar__divider" />
        <span title="Undo history depth">↶ {historyDepth}/50</span>
        <span className="cc-statusbar__divider" />
        <span className="cc-statusbar__build">CineCutPro · build 1.0</span>
      </div>
    </footer>
  );
}
