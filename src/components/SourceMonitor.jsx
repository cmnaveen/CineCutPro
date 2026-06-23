import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';

/**
 * Source Monitor — preview raw media before it lands on the timeline.
 */
export function SourceMonitor() {
  const { state, dispatch } = useEditor();
  const media = state.media.find((m) => m.id === state.source.mediaId) ?? null;
  const videoRef = useRef(null);
  const rafRef = useRef(null);

  // Sync DOM video to state on changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !media || media.kind !== 'video') return;
    if (state.source.playing) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [state.source.playing, media]);

  // While playing, broadcast the playhead from the underlying video each frame.
  useEffect(() => {
    if (!state.source.playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        dispatch({ type: 'source/setPlayhead', t: v.currentTime });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.source.playing, dispatch]);

  // External scrubs (from the source ruler) should also reflect on the video.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - state.source.playhead) > 0.15) {
      try {
        v.currentTime = state.source.playhead;
      } catch (_) {}
    }
  }, [state.source.playhead]);

  const insert = useCallback(
    (ripple) => {
      if (!media) return;
      const srcIn = state.source.inPoint ?? 0;
      const srcOut = state.source.outPoint ?? media.duration;
      const targetTrack =
        state.tracks.find((t) => t.kind === (media.kind === 'audio' ? 'audio' : 'video')) ??
        state.tracks[0];
      dispatch({
        type: 'clip/insertFromMedia',
        mediaId: media.id,
        trackId: targetTrack.id,
        start: state.playhead,
        srcIn,
        srcOut,
        ripple
      });
    },
    [media, state.source, state.playhead, state.tracks, dispatch]
  );

  const tape = useTapeScrub({
    duration: media?.duration ?? 0,
    playhead: state.source.playhead,
    onScrub: (t) => dispatch({ type: 'source/setPlayhead', t })
  });

  const markerStyle = useMemo(() => {
    if (!media) return null;
    const i = state.source.inPoint;
    const o = state.source.outPoint;
    if (i == null && o == null) return null;
    const start = (i ?? 0) / media.duration;
    const end = (o ?? media.duration) / media.duration;
    return { left: `${start * 100}%`, width: `${(end - start) * 100}%` };
  }, [media, state.source.inPoint, state.source.outPoint]);

  return (
    <section className="cc-monitor cc-monitor--source">
      <header className="cc-monitor__header">
        <span className="cc-monitor__label">Source</span>
        <span className="cc-monitor__name">{media?.name ?? '— no media loaded —'}</span>
        <span className="cc-monitor__tc">{formatTC(state.source.playhead)}</span>
      </header>

      <div className="cc-monitor__stage">
        {!media && (
          <div className="cc-monitor__placeholder">
            Double-click a clip in the Media Library to load it here.
          </div>
        )}
        {media?.kind === 'video' && (
          <video
            ref={videoRef}
            src={media.src}
            playsInline
            preload="auto"
            className="cc-monitor__video"
          />
        )}
        {media?.kind === 'image' && (
          <img src={media.src} alt="" className="cc-monitor__image" />
        )}
        {media?.kind === 'audio' && (
          <div className="cc-monitor__audio">
            <Icon.Wave size={56} />
            <div>Audio clip</div>
          </div>
        )}
      </div>

      <footer className="cc-monitor__controls">
        <div className="cc-monitor__buttons">
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'source/markIn' })}
            title="Mark In (I)"
          >
            <Icon.In size={15} />
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'source/markOut' })}
            title="Mark Out (O)"
          >
            <Icon.Out size={15} />
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'source/clearMarks' })}
            title="Clear marks"
          >
            ✕
          </button>
          <span className="cc-transport__divider" />
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'source/setPlayhead', t: Math.max(0, state.source.playhead - 1 / 30) })}
          >
            ‹
          </button>
          <button
            className="cc-icon-btn cc-icon-btn--primary"
            onClick={() => dispatch({ type: 'source/togglePlay' })}
            title="Play / Pause"
          >
            {state.source.playing ? <Icon.Pause /> : <Icon.Play />}
          </button>
          <button
            className="cc-icon-btn"
            onClick={() =>
              dispatch({
                type: 'source/setPlayhead',
                t: Math.min(media?.duration ?? 0, state.source.playhead + 1 / 30)
              })
            }
          >
            ›
          </button>
          <span className="cc-transport__divider" />
          <button
            className="cc-btn cc-btn--ghost"
            onClick={() => insert(true)}
            title="F9 — Insert (ripple)"
          >
            F9 Insert
          </button>
          <button
            className="cc-btn cc-btn--ghost"
            onClick={() => insert(false)}
            title="F10 — Overwrite"
          >
            F10 Overwrite
          </button>
        </div>

        <div className="cc-monitor__tape" ref={tape.containerRef} onMouseDown={tape.onMouseDown}>
          {media && (
            <>
              {markerStyle && <div className="cc-monitor__range" style={markerStyle} />}
              <div
                className="cc-monitor__playhead"
                style={{
                  left: `${((state.source.playhead || 0) / Math.max(0.001, media.duration)) * 100}%`
                }}
              />
              <div className="cc-monitor__ticks">
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} style={{ left: `${i * 10}%` }} />
                ))}
              </div>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

function useTapeScrub({ duration, playhead, onScrub }) {
  const containerRef = useRef(null);

  const onMouseDown = useCallback(
    (e) => {
      if (!containerRef.current || !duration) return;
      const rect = containerRef.current.getBoundingClientRect();
      const move = (ev) => {
        const x = Math.min(rect.width, Math.max(0, ev.clientX - rect.left));
        onScrub((x / rect.width) * duration);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      move(e);
    },
    [duration, onScrub]
  );

  return { containerRef, onMouseDown };
}
