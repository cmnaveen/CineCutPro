import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { formatTC, FPS } from '../engine/timecode.js';

/**
 * A/B Trim Editor — side-by-side filmstrips around the cut point so the editor
 * can nudge the boundary frame by frame.
 */
export function TrimEditor() {
  const { state, dispatch } = useEditor();
  if (!state.ui.trimEditorOpen) return null;
  const clip = state.clips.find((c) => c.id === state.ui.trimClipId);
  if (!clip) return null;

  const close = () => dispatch({ type: 'ui/set', key: 'trimEditorOpen', value: false });

  const peers = state.clips.filter((c) => c.trackId === clip.trackId).sort((a, b) => a.start - b.start);
  const idx = peers.indexOf(clip);
  const prev = peers[idx - 1] ?? null;
  const next = peers[idx + 1] ?? null;

  const nudgeIn = (frames) => {
    const t = clip.start + frames / FPS;
    dispatch({ type: 'clip/trim', id: clip.id, side: 'in', t });
  };
  const nudgeOut = (frames) => {
    const t = clip.end + frames / FPS;
    dispatch({ type: 'clip/trim', id: clip.id, side: 'out', t });
  };

  return (
    <div className="cc-modal-root" onClick={close}>
      <div className="cc-modal cc-trim" onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal__header">
          <div className="cc-modal__title">A/B Trim Editor</div>
          <button className="cc-icon-btn" onClick={close} title="Close">✕</button>
        </header>

        <div className="cc-trim__body">
          <FilmstripPair
            label="Outgoing"
            clip={prev}
            anchorTime={prev ? prev.end : null}
            state={state}
          />
          <div className="cc-trim__handles">
            <div className="cc-trim__row">
              <span>IN</span>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeIn(-5)}>−5</button>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeIn(-1)}>−1</button>
              <strong>{formatTC(clip.start)}</strong>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeIn(1)}>+1</button>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeIn(5)}>+5</button>
            </div>
            <div className="cc-trim__row">
              <span>OUT</span>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeOut(-5)}>−5</button>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeOut(-1)}>−1</button>
              <strong>{formatTC(clip.end)}</strong>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeOut(1)}>+1</button>
              <button className="cc-btn cc-btn--ghost" onClick={() => nudgeOut(5)}>+5</button>
            </div>
            <div className="cc-trim__meta">
              <span>Duration: <strong>{formatTC(clip.end - clip.start)}</strong></span>
              <span>Source In: <strong>{formatTC(clip.srcIn)}</strong></span>
              <span>Source Out: <strong>{formatTC(clip.srcOut)}</strong></span>
            </div>
          </div>
          <FilmstripPair
            label="Incoming"
            clip={next}
            anchorTime={next ? next.start : null}
            state={state}
          />
        </div>
      </div>
    </div>
  );
}

/** Builds a small horizontal filmstrip from a clip's media around an anchor time. */
function FilmstripPair({ label, clip, anchorTime, state }) {
  const canvasRef = useRef(null);
  const media = useMemo(() => (clip ? state.media.find((m) => m.id === clip.mediaId) : null), [clip, state.media]);

  useEffect(() => {
    if (!clip || !media || media.kind !== 'video') return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = media.src;
    const FRAMES = 8;
    const cellW = c.width / FRAMES;
    let i = 0;
    const baseLocal = clip.srcIn + (anchorTime - clip.start);
    const drawNext = () => {
      if (i >= FRAMES) return;
      const t = baseLocal + (i - FRAMES / 2) / FPS;
      v.currentTime = Math.max(0, t);
    };
    v.onseeked = () => {
      try {
        ctx.drawImage(v, i * cellW, 0, cellW, c.height);
      } catch (_) {}
      i++;
      drawNext();
    };
    v.onloadedmetadata = drawNext;
    return () => {
      v.src = '';
    };
  }, [clip, media, anchorTime]);

  if (!clip) {
    return (
      <div className="cc-trim__strip cc-trim__strip--empty">
        <div className="cc-trim__strip-label">{label}</div>
        <em>— no adjacent clip —</em>
      </div>
    );
  }

  return (
    <div className="cc-trim__strip">
      <div className="cc-trim__strip-label">
        {label} — {media?.name ?? clip.kind}
      </div>
      <canvas ref={canvasRef} width={640} height={80} />
    </div>
  );
}
