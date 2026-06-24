import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';
import { TRACK_KINDS, FPS } from '../state/initialState.js';
import { TITLE_PRESETS } from '../engine/titleCompositor.js';

const SNAP_PX = 8;       // proximity for magnetic snap (in pixels)
const TRACK_HEAD_W = 180; // MUST stay in sync with `.cc-track grid-template-columns` in timeline.css

export function Timeline() {
  const { state, dispatch, duration } = useEditor();
  const pps = state.pixelsPerSecond;
  const scrollRef = useRef(null);
  const innerRef = useRef(null);
  const width = TRACK_HEAD_W + Math.max(1200, duration * pps);
  const [dragMode, setDragMode] = useState(null);

  /* ── Zoom on Ctrl+wheel (manual zoom disables Fit) ─────── */
  const onWheel = useCallback(
    (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (state.ui.fitToWindow) {
        dispatch({ type: 'ui/set', key: 'fitToWindow', value: false });
      }
      const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      dispatch({ type: 'playback/setZoom', pps: Math.max(6, Math.min(600, pps * delta)) });
    },
    [pps, dispatch, state.ui.fitToWindow]
  );

  /* ── Fit mode: recompute pps so content fits the visible viewport ── */
  useEffect(() => {
    if (!state.ui.fitToWindow) return;
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () => {
      const visible = el.clientWidth - TRACK_HEAD_W - 24; // a little right gutter
      if (visible <= 0 || duration <= 0) return;
      const next = Math.max(6, Math.min(600, visible / duration));
      if (Math.abs(next - pps) > 0.5) {
        dispatch({ type: 'playback/setZoom', pps: next });
      }
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.ui.fitToWindow, duration, pps, dispatch]);

  /* ── Auto-scroll: keep playhead in view during playback ── */
  useEffect(() => {
    if (!state.playing || !scrollRef.current) return;
    const el = scrollRef.current;
    const playX = TRACK_HEAD_W + state.playhead * pps;
    const left = el.scrollLeft;
    const right = left + el.clientWidth;
    if (playX > right - 120) el.scrollLeft = Math.max(0, playX - el.clientWidth * 0.7);
    if (playX < left + TRACK_HEAD_W + 40) el.scrollLeft = Math.max(0, playX - TRACK_HEAD_W - 40);
  }, [state.playhead, state.playing, pps]);

  /* ── Ruler click → seek (account for the head column gutter) ── */
  const seek = useCallback(
    (clientX) => {
      const el = innerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left - TRACK_HEAD_W;
      dispatch({ type: 'playback/setPlayhead', t: Math.max(0, x / pps) });
    },
    [pps, dispatch]
  );

  return (
    <section className="cc-timeline">
      <TimelineToolbar state={state} dispatch={dispatch} pps={pps} />
      <div className="cc-timeline__scroll" ref={scrollRef} onWheel={onWheel}>
        <div className="cc-timeline__inner" ref={innerRef} style={{ width }}>
          <Ruler width={width} pps={pps} duration={duration} onSeek={seek} state={state} />
          <Playhead pps={pps} playhead={state.playhead} />
          {state.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              pps={pps}
              width={width}
              state={state}
              dispatch={dispatch}
              dragMode={dragMode}
              setDragMode={setDragMode}
              innerRef={innerRef}
            />
          ))}
          <RubberBand state={state} />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Toolbar ─────────────────────────── */

function TimelineToolbar({ state, dispatch, pps }) {
  return (
    <header className="cc-timeline__toolbar">
      <button
        className={`cc-icon-btn ${state.snap ? 'is-on' : ''}`}
        onClick={() => dispatch({ type: 'playback/toggleSnap' })}
        title="Snap (S)"
      >
        <Icon.Snap size={14} /> Snap
      </button>
      <button className="cc-icon-btn" onClick={() => dispatch({ type: 'clip/blade' })} title="Blade at playhead (B)">
        <Icon.Blade size={14} /> Blade
      </button>
      <button className="cc-icon-btn" onClick={() => dispatch({ type: 'clip/duplicate' })} title="Duplicate selection (Ctrl+D)">
        <Icon.Plus size={14} /> Duplicate
      </button>
      <button className="cc-icon-btn cc-icon-btn--danger" onClick={() => dispatch({ type: 'clip/delete' })} title="Delete selection (Del)">
        <Icon.Trash size={14} /> Delete
      </button>
      <button className="cc-icon-btn cc-icon-btn--danger" onClick={() => dispatch({ type: 'clip/delete', ripple: true })} title="Ripple delete (Shift+Del)">
        Ripple Del
      </button>
      <span className="cc-transport__divider" />
      <button
        className="cc-icon-btn"
        onClick={() => dispatch({ type: 'clip/insertTitle', trackId: titleTrackId(state), start: state.playhead })}
        title="Insert title at playhead"
      >
        <Icon.T size={14} /> + Title
      </button>
      <button
        className="cc-icon-btn"
        onClick={() =>
          dispatch({
            type: 'clip/insertTitle',
            trackId: subtitleTrackId(state),
            start: state.playhead,
            duration: 3,
            title: {
              text: 'Subtitle text here',
              preset: 'glass',
              font: 'Inter',
              weight: 600,
              size: 64,
              align: 'center',
              color: '#ffffff',
              isSubtitle: true
            }
          })
        }
        title="Insert subtitle caption"
      >
        <Icon.T size={14} /> + Subtitle
      </button>
      <span className="cc-transport__divider" />
      <div className="cc-zoomctl">
        <button
          className="cc-icon-btn cc-icon-btn--xs"
          onClick={() => {
            dispatch({ type: 'ui/set', key: 'fitToWindow', value: false });
            dispatch({ type: 'playback/setZoom', pps: Math.max(6, pps / 1.25) });
          }}
          title="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={6}
          max={600}
          step={1}
          value={Math.round(pps)}
          onChange={(e) => {
            dispatch({ type: 'ui/set', key: 'fitToWindow', value: false });
            dispatch({ type: 'playback/setZoom', pps: parseInt(e.target.value, 10) });
          }}
          className="cc-zoomctl__slider"
          title="Timeline zoom (px/sec)"
        />
        <button
          className="cc-icon-btn cc-icon-btn--xs"
          onClick={() => {
            dispatch({ type: 'ui/set', key: 'fitToWindow', value: false });
            dispatch({ type: 'playback/setZoom', pps: Math.min(600, pps * 1.25) });
          }}
          title="Zoom in"
        >
          +
        </button>
        <div className="cc-timeline__zoom" title="Pixels per second">{Math.round(pps)} px/s</div>
        <button
          className={`cc-icon-btn ${state.ui.fitToWindow ? 'is-on' : ''}`}
          onClick={() => dispatch({ type: 'ui/set', key: 'fitToWindow', value: !state.ui.fitToWindow })}
          title="Fit timeline content to viewport"
        >
          ⇿ Fit
        </button>
      </div>
      <span className="cc-transport__divider" />
      <button
        className="cc-icon-btn"
        onClick={() => {
          const id = state.selectedClipIds[0];
          if (id) dispatch({ type: 'ui/openTrimEditor', id });
        }}
        disabled={!state.selectedClipIds.length}
        title="Open A/B trim editor for selected clip"
      >
        A/B Trim
      </button>
    </header>
  );
}

function titleTrackId(state) {
  return state.tracks.find((t) => t.kind === TRACK_KINDS.TITLE)?.id ?? state.tracks[0]?.id ?? null;
}
function subtitleTrackId(state) {
  return state.tracks.find((t) => t.kind === TRACK_KINDS.SUBTITLE)?.id ?? titleTrackId(state);
}

/* ─────────────────────────── Ruler ─────────────────────────── */

function Ruler({ width, pps, duration, onSeek, state }) {
  const secPerMajor =
    pps >= 200 ? 1 :
    pps >= 100 ? 2 :
    pps >= 50  ? 5 :
    pps >= 25  ? 10 :
    pps >= 12  ? 20 :
    30;
  const majors = [];
  for (let s = 0; s <= duration; s += secPerMajor) majors.push(s);

  return (
    <div
      className="cc-ruler"
      style={{ width }}
      onMouseDown={(e) => {
        const move = (ev) => onSeek(ev.clientX);
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        onSeek(e.clientX);
      }}
    >
      {majors.map((s) => (
        <div key={s} className="cc-ruler__major" style={{ left: TRACK_HEAD_W + s * pps }}>
          <span>{formatTC(s)}</span>
        </div>
      ))}
      {state.inPoint != null && (
        <div className="cc-ruler__mark cc-ruler__mark--in" style={{ left: TRACK_HEAD_W + state.inPoint * pps }}>I</div>
      )}
      {state.outPoint != null && (
        <div className="cc-ruler__mark cc-ruler__mark--out" style={{ left: TRACK_HEAD_W + state.outPoint * pps }}>O</div>
      )}
    </div>
  );
}

function Playhead({ pps, playhead }) {
  return (
    <div className="cc-playhead" style={{ left: TRACK_HEAD_W + playhead * pps }}>
      <div className="cc-playhead__cap" />
      <div className="cc-playhead__line" />
    </div>
  );
}

/* ─────────────────────────── Track row ─────────────────────────── */

function TrackRow({ track, pps, width, state, dispatch, dragMode, setDragMode, innerRef }) {
  const clips = state.clips.filter((c) => c.trackId === track.id);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const mediaId = e.dataTransfer.getData('application/x-cinecut-media');
      const tranKind = e.dataTransfer.getData('application/x-cinecut-transition');
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const at = Math.max(0, x / pps);
      if (mediaId) {
        dispatch({ type: 'clip/insertFromMedia', mediaId, trackId: track.id, start: at });
        dispatch({ type: 'toast/push', kind: 'success', message: 'Clip inserted' });
        return;
      }
      if (tranKind) {
        const candidates = clips
          .flatMap((c) => [
            { id: c.id, side: 'out', dist: Math.abs(c.end - at) },
            { id: c.id, side: 'in',  dist: Math.abs(c.start - at) }
          ])
          .sort((a, b) => a.dist - b.dist);
        if (candidates[0]?.dist * pps < 50) {
          dispatch({ type: 'transition/apply', clipId: candidates[0].id, side: candidates[0].side, kind: tranKind, duration: 0.7 });
          dispatch({ type: 'toast/push', kind: 'info', message: `Applied transition: ${tranKind}` });
        }
      }
    },
    [clips, dispatch, pps, track.id]
  );

  /* Rubber-band: empty-lane mousedown begins a selection rect. */
  const onLaneMouseDown = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.button !== 0) return;
      const inner = innerRef.current;
      if (!inner) return;
      const innerRect = inner.getBoundingClientRect();
      const startX = e.clientX - innerRect.left;
      const startY = e.clientY - innerRect.top;
      dispatch({ type: 'select/clips', ids: [] });
      dispatch({ type: 'ui/rubberBand', payload: { x0: startX, y0: startY, x1: startX, y1: startY } });

      const move = (ev) => {
        const x1 = ev.clientX - innerRect.left;
        const y1 = ev.clientY - innerRect.top;
        dispatch({ type: 'ui/rubberBand', payload: { x0: startX, y0: startY, x1, y1 } });
      };
      const up = (ev) => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        const x1 = ev.clientX - innerRect.left;
        const a = Math.min(startX, x1) / pps;
        const b = Math.max(startX, x1) / pps;
        const hit = clips.filter((c) => c.end > a && c.start < b).map((c) => c.id);
        if (hit.length) dispatch({ type: 'select/clips', ids: hit });
        dispatch({ type: 'ui/rubberBand', payload: null });
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [clips, dispatch, pps, innerRef]
  );

  /* Track-height drag handle. */
  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startH = track.height;
      const move = (ev) => {
        dispatch({ type: 'track/setHeight', id: track.id, height: startH + (ev.clientY - startY) });
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [track.id, track.height, dispatch]
  );

  return (
    <div className={`cc-track cc-track--${track.kind}`} style={{ height: track.height, width }}>
      <header className="cc-track__head" style={{ '--track-color': track.color }}>
        <div className="cc-track__name">
          <span className="cc-track__dot" />
          {track.name}
        </div>
        <div className="cc-track__toggles">
          <button
            className={`cc-pill ${track.muted ? 'is-on cc-pill--danger' : ''}`}
            onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { muted: !track.muted } })}
            title="Mute"
          >
            M
          </button>
          <button
            className={`cc-pill ${track.solo ? 'is-on cc-pill--accent' : ''}`}
            onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { solo: !track.solo } })}
            title="Solo"
          >
            S
          </button>
          <button
            className={`cc-pill ${track.locked ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { locked: !track.locked } })}
            title="Lock"
          >
            <Icon.Lock size={11} />
          </button>
          <button
            className={`cc-pill ${!track.visible ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { visible: !track.visible } })}
            title="Visibility"
          >
            {track.visible ? <Icon.Eye size={11} /> : <Icon.EyeOff size={11} />}
          </button>
        </div>
      </header>
      <div
        className="cc-track__lane"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onDrop}
        onMouseDown={onLaneMouseDown}
        onContextMenu={(e) => {
          // Allow lane-level menu only if the click hit the lane (not a clip).
          if (e.target !== e.currentTarget) e.preventDefault();
        }}
      >
        {clips.map((c) => (
          <ClipBlock
            key={c.id}
            clip={c}
            track={track}
            state={state}
            dispatch={dispatch}
            pps={pps}
            dragMode={dragMode}
            setDragMode={setDragMode}
          />
        ))}
      </div>
      <div className="cc-track__resize" onMouseDown={onResizeStart} title="Drag to resize track" />
    </div>
  );
}

/* ─────────────────────────── Clip block ─────────────────────────── */

function ClipBlock({ clip, track, state, dispatch, pps, dragMode, setDragMode }) {
  const selected = state.selectedClipIds.includes(clip.id);
  const media = state.media.find((m) => m.id === clip.mediaId);

  const snapTargets = useMemo(() => {
    const t = [];
    for (const c of state.clips) {
      if (c.id === clip.id) continue;
      t.push(c.start, c.end);
    }
    t.push(state.playhead);
    if (state.inPoint != null) t.push(state.inPoint);
    if (state.outPoint != null) t.push(state.outPoint);
    t.push(0);
    return t;
  }, [state.clips, state.playhead, state.inPoint, state.outPoint, clip.id]);

  const snap = useCallback(
    (proposedT) => {
      if (!state.snap) return proposedT;
      let best = proposedT;
      let bestDist = SNAP_PX / pps;
      for (const tgt of snapTargets) {
        const d = Math.abs(tgt - proposedT);
        if (d < bestDist) {
          bestDist = d;
          best = tgt;
        }
      }
      return best;
    },
    [state.snap, snapTargets, pps]
  );

  const onMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const ids = additive
        ? Array.from(new Set(state.selectedClipIds.concat([clip.id])))
        : (selected ? state.selectedClipIds : [clip.id]);
      dispatch({ type: 'select/clips', ids });
      if (track.locked) return;
      const startPx = e.clientX;
      const originStart = clip.start;
      setDragMode({ kind: 'move', id: clip.id });
      const movingSel = ids.length > 1 && ids.includes(clip.id);
      const onMove = (ev) => {
        const dx = ev.clientX - startPx;
        const proposed = snap(originStart + dx / pps);
        if (movingSel) {
          dispatch({ type: 'clip/moveSelection', ids, anchorId: clip.id, start: proposed });
        } else {
          dispatch({ type: 'clip/move', id: clip.id, start: proposed });
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDragMode(null);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [clip, dispatch, pps, selected, state.selectedClipIds, track.locked, setDragMode, snap]
  );

  const onTrim = useCallback(
    (side) => (e) => {
      e.stopPropagation();
      if (track.locked) return;
      const startPx = e.clientX;
      const originStart = clip.start;
      const originEnd = clip.end;
      const onMove = (ev) => {
        const dx = (ev.clientX - startPx) / pps;
        const raw = side === 'in' ? originStart + dx : originEnd + dx;
        const t = snap(raw);
        dispatch({ type: 'clip/trim', id: clip.id, side, t });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [clip, dispatch, pps, track.locked, snap]
  );

  const onContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ids = state.selectedClipIds.includes(clip.id) ? state.selectedClipIds : [clip.id];
      dispatch({ type: 'select/clips', ids });
      dispatch({ type: 'ui/openContextMenu', payload: { x: e.clientX, y: e.clientY, clipId: clip.id } });
    },
    [clip.id, dispatch, state.selectedClipIds]
  );

  const left = clip.start * pps;
  const w = Math.max(8, (clip.end - clip.start) * pps);

  const label = useMemo(() => {
    if (clip.kind === 'title')    return clip.title?.text || 'Title';
    if (clip.kind === 'subtitle') return clip.title?.text || 'Subtitle';
    return media?.name ?? clip.kind;
  }, [clip, media]);

  return (
    <div
      className={`cc-clip cc-clip--${clip.kind} ${selected ? 'is-selected' : ''}`}
      style={{ left, width: w, '--track-color': track.color }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onDoubleClick={() => dispatch({ type: 'ui/openTrimEditor', id: clip.id })}
      title={`${label} · ${(clip.end - clip.start).toFixed(2)}s`}
    >
      {clip.transitions?.in && (
        <div className="cc-clip__transition cc-clip__transition--in" title={`Transition in · ${clip.transitions.in.kind}`}>◀</div>
      )}
      {clip.transitions?.out && (
        <div className="cc-clip__transition cc-clip__transition--out" title={`Transition out · ${clip.transitions.out.kind}`}>▶</div>
      )}
      <div className="cc-clip__handle cc-clip__handle--in" onMouseDown={onTrim('in')} />
      <div className="cc-clip__body">
        <div className="cc-clip__name">{label}</div>
        {media?.thumb && clip.kind === 'video' && (
          <div className="cc-clip__thumbstrip" style={{ backgroundImage: `url(${media.thumb})` }} />
        )}
        {clip.kind === 'audio' && <ClipWaveform clip={clip} media={media} width={w} />}
        {(clip.kind === 'title' || clip.kind === 'subtitle') && (
          <TitleStripBadge preset={clip.title?.preset} subtitle={clip.kind === 'subtitle'} />
        )}
        <ClipKeyframeMarks clip={clip} />
      </div>
      <div className="cc-clip__handle cc-clip__handle--out" onMouseDown={onTrim('out')} />
    </div>
  );
}

function ClipKeyframeMarks({ clip }) {
  if (!clip.keyframes?.length) return null;
  const dur = Math.max(0.0001, clip.end - clip.start);
  return (
    <div className="cc-clip__kfs">
      {clip.keyframes.map((k, i) => (
        <span
          key={i}
          className={`cc-clip__kf cc-clip__kf--${k.channel}`}
          style={{ left: `${(Math.min(dur, Math.max(0, k.time)) / dur) * 100}%` }}
          title={`${k.channel} @ ${k.time.toFixed(2)}s = ${typeof k.value === 'number' ? k.value.toFixed(2) : k.value}`}
        />
      ))}
    </div>
  );
}

function ClipWaveform({ clip, media, width }) {
  const [peaks, setPeaks] = useState(null);
  useEffect(() => {
    if (!media?.src) return;
    let cancelled = false;
    import('../engine/waveform.js').then(({ extractPeaks }) => {
      extractPeaks(media.src, 200).then((p) => {
        if (!cancelled) setPeaks(p);
      });
    });
    return () => { cancelled = true; };
  }, [media?.src]);

  if (!peaks || peaks.length === 0) return <PseudoWave clipId={clip.id} width={width} />;
  const bars = peaks.length;
  return (
    <svg className="cc-wave" viewBox={`0 0 ${bars} 20`} preserveAspectRatio="none">
      {Array.from(peaks).map((v, i) => (
        <rect key={i} x={i + 0.1} y={10 - v * 9.5} width={0.8} height={Math.max(0.5, v * 19)} />
      ))}
    </svg>
  );
}

function PseudoWave({ clipId, width }) {
  let h = 0;
  for (let i = 0; i < clipId.length; i++) h = (h * 33 + clipId.charCodeAt(i)) >>> 0;
  const bars = Math.max(8, Math.min(140, Math.round(width / 4)));
  const data = Array.from({ length: bars }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.15 + ((h >>> 8) & 0xff) / 255 * 0.85;
  });
  return (
    <svg className="cc-wave" viewBox={`0 0 ${bars} 20`} preserveAspectRatio="none">
      {data.map((v, i) => (
        <rect key={i} x={i + 0.1} y={10 - v * 9} width={0.8} height={v * 18} />
      ))}
    </svg>
  );
}

function TitleStripBadge({ preset, subtitle }) {
  const meta = TITLE_PRESETS.find((p) => p.id === preset) ?? TITLE_PRESETS[0];
  return (
    <div className={`cc-title-strip cc-title-strip--${meta.id}`}>
      <span>{subtitle ? `CC · ${meta.label}` : meta.label}</span>
    </div>
  );
}

/* ─────────────────────────── Rubber-band ─────────────────────────── */

function RubberBand({ state }) {
  const rb = state.ui.rubberBand;
  if (!rb) return null;
  const left = Math.min(rb.x0, rb.x1);
  const top = Math.min(rb.y0, rb.y1);
  const w = Math.abs(rb.x1 - rb.x0);
  const h = Math.abs(rb.y1 - rb.y0);
  if (w < 2 && h < 2) return null;
  return <div className="cc-rubberband" style={{ left, top, width: w, height: h }} />;
}
