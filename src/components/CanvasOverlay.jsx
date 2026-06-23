import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { titleBounds } from '../engine/titleCompositor.js';
import { PROGRAM_W, PROGRAM_H } from '../engine/mediaRenderer.js';

/**
 * Direct-manipulation overlay sat on top of the Program canvas.
 *
 * Shows a bounding box + drag handles for the currently-selected active clip.
 *   - Body drag             → updates transform.x / transform.y
 *   - Corner handle drag    → uniform transform.scale (anchored at clip center)
 *   - Rotation handle drag  → transform.rotation
 *
 * Coordinate frames:
 *   - canvas: 1920 × 1080, origin top-left.
 *   - dom:    the on-screen letterbox-fit rectangle of the canvas (canvasContentRect).
 *
 * `transformPoint` mirrors the renderer's compositing transform so the box on
 * screen lines up with the actual rendered glyphs.
 */
export function CanvasOverlay() {
  const { state, dispatch, selectedClips } = useEditor();
  const [contentRect, setContentRect] = useState(null);
  const [dragHint, setDragHint] = useState(null); // small live readout during drag

  // Observe the canvas + its container so we always know the displayed rect.
  useEffect(() => {
    const update = () => {
      const canvas = document.querySelector('canvas.cc-program-canvas');
      const stage = canvas?.parentElement;
      if (!canvas || !stage) return;
      setContentRect(canvasContentRect(canvas, stage));
    };
    update();
    const ro = new ResizeObserver(update);
    const canvas = document.querySelector('canvas.cc-program-canvas');
    const stage = canvas?.parentElement;
    if (canvas) ro.observe(canvas);
    if (stage) ro.observe(stage);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // The clip we draw handles for: first selected clip that's active at playhead.
  const active = useMemo(() => {
    return selectedClips.find((c) => c.start <= state.playhead && c.end > state.playhead) ?? null;
  }, [selectedClips, state.playhead]);

  /* ── Drag handlers ───────────────────────────────────────────── */
  const startBodyDrag = useCallback(
    (e) => {
      if (!active || !contentRect) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startTx = active.transform.x ?? 0;
      const startTy = active.transform.y ?? 0;
      const move = (ev) => {
        const dx = (ev.clientX - startX) / contentRect.scale;
        const dy = (ev.clientY - startY) / contentRect.scale;
        dispatch({
          type: 'clip/updateTransform',
          id: active.id,
          patch: { x: Math.round(startTx + dx), y: Math.round(startTy + dy) }
        });
        setDragHint(`x ${Math.round(startTx + dx)}  ·  y ${Math.round(startTy + dy)}`);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setDragHint(null);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [active, contentRect, dispatch]
  );

  const startScaleDrag = useCallback(
    (e, anchor) => {
      if (!active || !contentRect) return;
      e.preventDefault();
      e.stopPropagation();
      const tx = active.transform.x ?? 0;
      const ty = active.transform.y ?? 0;
      const startScale = active.transform.scale ?? 1;
      const centerCanvasX = PROGRAM_W / 2 + tx;
      const centerCanvasY = PROGRAM_H / 2 + ty;
      const center = canvasToDom(centerCanvasX, centerCanvasY, contentRect);
      const startDist = Math.hypot(e.clientX - center.x, e.clientY - center.y);
      const move = (ev) => {
        const d = Math.hypot(ev.clientX - center.x, ev.clientY - center.y);
        const next = Math.max(0.1, Math.min(5, startScale * (d / Math.max(1, startDist))));
        dispatch({
          type: 'clip/updateTransform',
          id: active.id,
          patch: { scale: Math.round(next * 100) / 100 }
        });
        setDragHint(`scale ${(next * 100).toFixed(0)}%`);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setDragHint(null);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [active, contentRect, dispatch]
  );

  const startRotateDrag = useCallback(
    (e) => {
      if (!active || !contentRect) return;
      e.preventDefault();
      e.stopPropagation();
      const tx = active.transform.x ?? 0;
      const ty = active.transform.y ?? 0;
      const startRot = active.transform.rotation ?? 0;
      const center = canvasToDom(PROGRAM_W / 2 + tx, PROGRAM_H / 2 + ty, contentRect);
      const startAng = Math.atan2(e.clientY - center.y, e.clientX - center.x);
      const move = (ev) => {
        const a = Math.atan2(ev.clientY - center.y, ev.clientX - center.x);
        const next = (startRot + ((a - startAng) * 180) / Math.PI + 540) % 360 - 180;
        dispatch({
          type: 'clip/updateTransform',
          id: active.id,
          patch: { rotation: Math.round(next) }
        });
        setDragHint(`rot ${Math.round(next)}°`);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setDragHint(null);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [active, contentRect, dispatch]
  );

  if (!contentRect || !active) return null;

  // Natural bbox (in canvas coords) before clip transform.
  const nat = naturalBoundsFor(active);
  const tx = active.transform.x ?? 0;
  const ty = active.transform.y ?? 0;
  const ts = active.transform.scale ?? 1;
  const trot = active.transform.rotation ?? 0;

  const corners = [
    [nat.x,           nat.y],
    [nat.x + nat.w,   nat.y],
    [nat.x + nat.w,   nat.y + nat.h],
    [nat.x,           nat.y + nat.h]
  ].map(([px, py]) => transformPoint(px, py, tx, ty, ts, trot));

  const center = transformPoint(nat.x + nat.w / 2, nat.y + nat.h / 2, tx, ty, ts, trot);

  // Rotation handle 60 canvas-units above the top edge midpoint, in rotated space.
  const topMid = transformPoint(nat.x + nat.w / 2, nat.y - 60 / ts, tx, ty, ts, trot);

  const labelText =
    active.kind === 'title' ? `TITLE · ${active.title?.preset ?? ''}` :
    active.kind === 'subtitle' ? `SUBTITLE` :
    active.kind?.toUpperCase();

  return (
    <svg
      className="cc-overlay"
      style={{
        position: 'absolute',
        left: contentRect.left,
        top: contentRect.top,
        width: contentRect.width,
        height: contentRect.height,
        pointerEvents: 'none'
      }}
      viewBox={`0 0 ${PROGRAM_W} ${PROGRAM_H}`}
      preserveAspectRatio="none"
    >
      {/* Body: draggable, semi-transparent fill so the user can click anywhere inside. */}
      <polygon
        className="cc-overlay__body"
        points={corners.map((p) => p.join(',')).join(' ')}
        onMouseDown={startBodyDrag}
      />
      {/* Outline */}
      <polygon
        className="cc-overlay__box"
        points={corners.map((p) => p.join(',')).join(' ')}
      />
      {/* Crosshair at center */}
      <line
        className="cc-overlay__cross"
        x1={center[0] - 14} y1={center[1]} x2={center[0] + 14} y2={center[1]}
      />
      <line
        className="cc-overlay__cross"
        x1={center[0]} y1={center[1] - 14} x2={center[0]} y2={center[1] + 14}
      />
      {/* Rotation rod + knob */}
      <line
        className="cc-overlay__rot-line"
        x1={(corners[0][0] + corners[1][0]) / 2}
        y1={(corners[0][1] + corners[1][1]) / 2}
        x2={topMid[0]}
        y2={topMid[1]}
      />
      <circle
        className="cc-overlay__knob cc-overlay__knob--rotate"
        cx={topMid[0]} cy={topMid[1]} r={18}
        onMouseDown={startRotateDrag}
      />
      {/* Corner scale handles */}
      {corners.map((p, i) => (
        <rect
          key={i}
          className="cc-overlay__knob cc-overlay__knob--scale"
          x={p[0] - 14} y={p[1] - 14} width={28} height={28}
          onMouseDown={(e) => startScaleDrag(e, i)}
        />
      ))}
      {/* Label above the box */}
      <g transform={`translate(${corners[0][0]}, ${corners[0][1] - 36})`}>
        <rect className="cc-overlay__label-bg" x={0} y={0} width={labelText.length * 18 + 80} height={28} rx={6} />
        <text className="cc-overlay__label" x={14} y={19}>{labelText}</text>
        {dragHint && (
          <text className="cc-overlay__label cc-overlay__label--hint"
                x={labelText.length * 18 + 22} y={19}>
            {dragHint}
          </text>
        )}
      </g>
    </svg>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/** Resolve where 1920×1080 content actually lives inside the canvas element. */
function canvasContentRect(canvasEl, stageEl) {
  if (!canvasEl || !stageEl) return null;
  const r = canvasEl.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  const elW = r.width;
  const elH = r.height;
  const srcAR = PROGRAM_W / PROGRAM_H;
  const elAR = elW / elH;
  let cw, ch;
  if (elAR > srcAR) { ch = elH; cw = ch * srcAR; }
  else              { cw = elW; ch = cw / srcAR; }
  return {
    left: (r.left - s.left) + (elW - cw) / 2,
    top:  (r.top  - s.top)  + (elH - ch) / 2,
    width: cw,
    height: ch,
    scale: cw / PROGRAM_W
  };
}

function canvasToDom(cx, cy, contentRect) {
  return {
    x: contentRect.left + cx * contentRect.scale,
    y: contentRect.top  + cy * contentRect.scale
  };
}

/** Apply the same compositing transform the renderer uses, to a point. */
function transformPoint(px, py, tx, ty, scale, rotDeg) {
  let x = px - PROGRAM_W / 2;
  let y = py - PROGRAM_H / 2;
  x *= scale; y *= scale;
  const a = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  return [PROGRAM_W / 2 + tx + rx, PROGRAM_H / 2 + ty + ry];
}

function naturalBoundsFor(clip) {
  if (clip.kind === 'title' && clip.title) {
    const b = titleBounds(clip.title);
    const pad = (clip.title.size ?? 96) * 0.12;
    return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  }
  if (clip.kind === 'subtitle') {
    return { x: PROGRAM_W * 0.1, y: PROGRAM_H * 0.72, w: PROGRAM_W * 0.8, h: PROGRAM_H * 0.22 };
  }
  // Video / image — full frame
  return { x: 0, y: 0, w: PROGRAM_W, h: PROGRAM_H };
}
