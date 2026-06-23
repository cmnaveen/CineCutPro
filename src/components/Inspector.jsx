import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { TITLE_PRESETS } from '../engine/titleCompositor.js';
import { audioEngine } from '../engine/audioEngine.js';
import { TEXT_MOTIONS } from '../engine/textMotion.js';

const TABS = [
  { id: 'transform', label: 'Transform' },
  { id: 'filters',   label: 'Filters' },
  { id: 'audio',     label: 'Audio' },
  { id: 'keyframes', label: 'Keyframes' },
  { id: 'title',     label: 'Text' }
];

export function Inspector() {
  const { state, dispatch, selectedClips } = useEditor();
  const clip = selectedClips[0] ?? null;
  const tab = state.inspectorTab;

  return (
    <aside className="cc-panel cc-inspector">
      <header className="cc-panel__header">
        <div className="cc-panel__title">
          <Icon.Settings size={16} /> Inspector
        </div>
      </header>

      <nav className="cc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`cc-tab ${tab === t.id ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'select/inspectorTab', tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!clip && (
        <div className="cc-inspector__empty">
          <div className="cc-inspector__empty-icon">
            <Icon.Wand size={28} />
          </div>
          <div>Select a clip on the timeline to inspect it.</div>
        </div>
      )}

      {clip && (
        <div className="cc-inspector__body">
          <div className="cc-inspector__head">
            <div className="cc-inspector__head-name">{clipName(clip, state)}</div>
            <div className="cc-inspector__head-sub">
              {clip.kind} · {(clip.end - clip.start).toFixed(2)}s
            </div>
          </div>

          {tab === 'transform' && <TransformPanel clip={clip} dispatch={dispatch} />}
          {tab === 'filters' && <FiltersPanel clip={clip} dispatch={dispatch} />}
          {tab === 'audio' && <AudioPanel clip={clip} dispatch={dispatch} />}
          {tab === 'keyframes' && <KeyframesPanel clip={clip} dispatch={dispatch} playhead={state.playhead} />}
          {tab === 'title' && <TitlePanel clip={clip} dispatch={dispatch} />}
        </div>
      )}

      <section className="cc-inspector__mixer">
        <header className="cc-panel__title">
          <Icon.Wave size={14} /> Track Mixer
        </header>
        <div className="cc-mixer">
          {state.tracks
            .filter((t) => t.kind === 'audio')
            .map((t) => (
              <MixerStrip key={t.id} track={t} dispatch={dispatch} />
            ))}
        </div>
      </section>
    </aside>
  );
}

function clipName(clip, state) {
  if (clip.kind === 'title') return clip.title?.text || 'Title';
  const m = state.media.find((x) => x.id === clip.mediaId);
  return m?.name ?? 'Clip';
}

/* ─────────────────────────── Tabs ─────────────────────────── */

function Slider({ label, min, max, step, value, suffix = '', onChange, format }) {
  return (
    <label className="cc-field">
      <span className="cc-field__label">
        {label}
        <strong>{format ? format(value) : `${value}${suffix}`}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function TransformPanel({ clip, dispatch }) {
  const t = clip.transform;
  const upd = (patch) => dispatch({ type: 'clip/updateTransform', id: clip.id, patch });
  const updCrop = (patch) => upd({ crop: { ...t.crop, ...patch } });
  return (
    <div className="cc-section">
      <h4>Position & scale</h4>
      <Slider label="X" min={-960} max={960} step={1} value={t.x} suffix="px" onChange={(v) => upd({ x: v })} />
      <Slider label="Y" min={-540} max={540} step={1} value={t.y} suffix="px" onChange={(v) => upd({ y: v })} />
      <Slider label="Scale" min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => upd({ scale: v })} format={(v) => `${(v * 100).toFixed(0)}%`} />
      <Slider label="Rotation" min={-180} max={180} step={1} value={t.rotation} suffix="°" onChange={(v) => upd({ rotation: v })} />
      <Slider label="Opacity" min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => upd({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <h4 className="cc-section__h4--gap">PiP / position presets</h4>
      <PipPresetGrid clip={clip} dispatch={dispatch} />
      <h4 className="cc-section__h4--gap">
        <Icon.Crop size={13} /> Crop
      </h4>
      <Slider label="Top" min={0} max={0.45} step={0.005} value={t.crop.top} onChange={(v) => updCrop({ top: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Right" min={0} max={0.45} step={0.005} value={t.crop.right} onChange={(v) => updCrop({ right: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Bottom" min={0} max={0.45} step={0.005} value={t.crop.bottom} onChange={(v) => updCrop({ bottom: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Left" min={0} max={0.45} step={0.005} value={t.crop.left} onChange={(v) => updCrop({ left: v })} format={(v) => `${Math.round(v * 100)}%`} />
    </div>
  );
}

function FiltersPanel({ clip, dispatch }) {
  const f = clip.filters;
  const upd = (patch) => dispatch({ type: 'clip/updateFilters', id: clip.id, patch });
  const updChroma = (patch) => upd({ chromaKey: { ...f.chromaKey, ...patch } });
  return (
    <div className="cc-section">
      <h4>Color grading</h4>
      <Slider label="Brightness" min={0.2} max={2} step={0.01} value={f.brightness} onChange={(v) => upd({ brightness: v })} />
      <Slider label="Contrast"   min={0.2} max={2} step={0.01} value={f.contrast}   onChange={(v) => upd({ contrast: v })} />
      <Slider label="Saturation" min={0}   max={2} step={0.01} value={f.saturation} onChange={(v) => upd({ saturation: v })} />
      <Slider label="Hue"        min={-180} max={180} step={1} value={f.hueRotate} suffix="°" onChange={(v) => upd({ hueRotate: v })} />
      <h4 className="cc-section__h4--gap">Vignette</h4>
      <Slider label="Strength" min={0} max={1} step={0.01} value={f.vignette} onChange={(v) => upd({ vignette: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <h4 className="cc-section__h4--gap">Chroma key</h4>
      <label className="cc-field cc-field--row">
        <input
          type="checkbox"
          checked={f.chromaKey?.enabled ?? false}
          onChange={(e) => updChroma({ enabled: e.target.checked })}
        />
        <span>Enable greenscreen key</span>
      </label>
      <label className="cc-field cc-field--row">
        <span>Color</span>
        <input
          type="color"
          value={f.chromaKey?.color ?? '#00ff00'}
          onChange={(e) => updChroma({ color: e.target.value })}
        />
      </label>
      <Slider label="Tolerance" min={0.05} max={0.9} step={0.01} value={f.chromaKey?.tolerance ?? 0.35} onChange={(v) => updChroma({ tolerance: v })} />
      <Slider label="Softness"  min={0} max={0.5} step={0.01} value={f.chromaKey?.softness ?? 0.1} onChange={(v) => updChroma({ softness: v })} />
    </div>
  );
}

function AudioPanel({ clip, dispatch }) {
  const a = clip.audio;
  const upd = (patch) => dispatch({ type: 'clip/updateAudio', id: clip.id, patch });
  return (
    <div className="cc-section">
      <h4>Clip audio</h4>
      <Slider label="Volume" min={0} max={2} step={0.01} value={a.volume} onChange={(v) => upd({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Pan"    min={-1} max={1} step={0.01} value={a.pan} onChange={(v) => upd({ pan: v })} format={(v) => (v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} />
      <label className="cc-field cc-field--row">
        <input type="checkbox" checked={a.muted} onChange={(e) => upd({ muted: e.target.checked })} />
        <span>Mute clip</span>
      </label>
      <label className="cc-field cc-field--row">
        <input type="checkbox" checked={a.solo} onChange={(e) => upd({ solo: e.target.checked })} />
        <span>Solo clip</span>
      </label>
    </div>
  );
}

function KeyframesPanel({ clip, dispatch, playhead }) {
  const local = Math.max(0, playhead - clip.start);
  const add = (channel, value) =>
    dispatch({ type: 'clip/addKeyframe', id: clip.id, channel, time: local, value });
  return (
    <div className="cc-section">
      <h4>Add keyframe @ {local.toFixed(2)}s (local)</h4>
      <div className="cc-keys">
        <button className="cc-btn cc-btn--ghost" onClick={() => add('opacity', clip.transform.opacity)}>
          + Opacity
        </button>
        <button className="cc-btn cc-btn--ghost" onClick={() => add('scale', clip.transform.scale)}>
          + Scale
        </button>
        <button className="cc-btn cc-btn--ghost" onClick={() => add('rotation', clip.transform.rotation)}>
          + Rotation
        </button>
        <button className="cc-btn cc-btn--ghost" onClick={() => add('x', clip.transform.x)}>
          + X
        </button>
        <button className="cc-btn cc-btn--ghost" onClick={() => add('y', clip.transform.y)}>
          + Y
        </button>
      </div>
      <div className="cc-keys__list">
        {(clip.keyframes ?? []).length === 0 && <em>No keyframes.</em>}
        {(clip.keyframes ?? []).map((k, i) => (
          <div key={i} className="cc-keys__row">
            <span className="cc-keys__channel">{k.channel}</span>
            <span className="cc-keys__time">{k.time.toFixed(2)}s</span>
            <span className="cc-keys__value">
              {typeof k.value === 'number' ? k.value.toFixed(2) : String(k.value)}
            </span>
          </div>
        ))}
      </div>
      {(clip.keyframes ?? []).length > 0 && (
        <button
          className="cc-btn cc-btn--ghost cc-btn--danger"
          onClick={() => dispatch({ type: 'clip/clearKeyframes', id: clip.id })}
        >
          Clear all keyframes
        </button>
      )}
    </div>
  );
}

function TitlePanel({ clip, dispatch }) {
  const t = clip.title ?? null;
  const isText = clip.kind === 'title' || clip.kind === 'subtitle';
  if (!isText || !t) {
    return <div className="cc-section"><em>This clip has no text layer.</em></div>;
  }
  const upd = (patch) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch });
  const staticPresets = TITLE_PRESETS.filter((p) => p.kind !== 'kinetic');
  const kineticPresets = TITLE_PRESETS.filter((p) => p.kind === 'kinetic');

  return (
    <div className="cc-section">
      <h4>Text</h4>
      <textarea
        className="cc-textarea"
        rows={2}
        value={t.text}
        onChange={(e) => upd({ text: e.target.value })}
      />

      <h4 className="cc-section__h4--gap">Preset — Static</h4>
      <div className="cc-preset-grid">
        {staticPresets.map((p) => (
          <button
            key={p.id}
            className={`cc-preset ${t.preset === p.id ? 'is-on' : ''} cc-preset--${p.id}`}
            onClick={() => upd({ preset: p.id })}
          >
            <span className="cc-preset__name">{p.label}</span>
            <span className="cc-preset__sub">{p.sub}</span>
          </button>
        ))}
      </div>

      <h4 className="cc-section__h4--gap">Preset — Kinetic / Elemental</h4>
      <div className="cc-preset-grid">
        {kineticPresets.map((p) => (
          <button
            key={p.id}
            className={`cc-preset cc-preset--kinetic ${t.preset === p.id ? 'is-on' : ''} cc-preset--${p.id}`}
            onClick={() => upd({ preset: p.id })}
          >
            <span className="cc-preset__name">{p.label}</span>
            <span className="cc-preset__sub">{p.sub}</span>
            <span className="cc-preset__badge">live</span>
          </button>
        ))}
      </div>

      <h4 className="cc-section__h4--gap">Typography</h4>
      <Slider label="Font size" min={24} max={240} step={1} value={t.size} suffix="px" onChange={(v) => upd({ size: v })} />
      <label className="cc-field cc-field--row">
        <span>Weight</span>
        <select value={t.weight} onChange={(e) => upd({ weight: parseInt(e.target.value, 10) })}>
          {[300, 400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>

      <h4 className="cc-section__h4--gap">Alignment</h4>
      <label className="cc-field cc-field--row">
        <span>Horizontal</span>
        <select value={t.align ?? 'center'} onChange={(e) => upd({ align: e.target.value })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="cc-field cc-field--row">
        <span>Vertical</span>
        <select
          value={t.valign ?? (clip.kind === 'subtitle' ? 'bottom' : 'middle')}
          onChange={(e) => upd({ valign: e.target.value })}
        >
          <option value="top">Top</option>
          <option value="middle">Middle</option>
          <option value="bottom">Bottom</option>
        </select>
      </label>

      <h4 className="cc-section__h4--gap">Motion</h4>
      <MotionPicker
        label="Entry"
        valueId={t.motion?.in ?? 'none'}
        valueDur={t.motion?.inDuration ?? 0.6}
        onPreset={(id) => upd({ motion: { ...(t.motion ?? {}), in: id } })}
        onDuration={(v) => upd({ motion: { ...(t.motion ?? {}), inDuration: v } })}
      />
      <MotionPicker
        label="Exit"
        valueId={t.motion?.out ?? 'none'}
        valueDur={t.motion?.outDuration ?? 0.6}
        onPreset={(id) => upd({ motion: { ...(t.motion ?? {}), out: id } })}
        onDuration={(v) => upd({ motion: { ...(t.motion ?? {}), outDuration: v } })}
      />
    </div>
  );
}

/* ─────────────────── PiP corner preset grid ─────────────────── */

const PIP_PRESETS = [
  { id: 'tl', label: 'TL' }, { id: 'tc', label: 'TC' }, { id: 'tr', label: 'TR' },
  { id: 'ml', label: 'ML' }, { id: 'mc', label: 'Fit' }, { id: 'mr', label: 'MR' },
  { id: 'bl', label: 'BL' }, { id: 'bc', label: 'BC' }, { id: 'br', label: 'BR' }
];

/** Compute (x, y, scale) for a PiP preset.  Scale 0.3 with 40px margin. */
function pipPosition(id, scale = 0.3, margin = 40) {
  if (id === 'mc') return { x: 0, y: 0, scale: 1 };
  const W = 1920, H = 1080;
  const w = W * scale, h = H * scale;
  const xL = -W / 2 + w / 2 + margin;
  const xR =  W / 2 - w / 2 - margin;
  const xC = 0;
  const yT = -H / 2 + h / 2 + margin;
  const yB =  H / 2 - h / 2 - margin;
  const yM = 0;
  const map = {
    tl: { x: xL, y: yT }, tc: { x: xC, y: yT }, tr: { x: xR, y: yT },
    ml: { x: xL, y: yM },                        mr: { x: xR, y: yM },
    bl: { x: xL, y: yB }, bc: { x: xC, y: yB }, br: { x: xR, y: yB }
  };
  const p = map[id];
  return { x: Math.round(p.x), y: Math.round(p.y), scale };
}

function PipPresetGrid({ clip, dispatch }) {
  const apply = (id) => {
    const patch = pipPosition(id);
    dispatch({ type: 'clip/updateTransform', id: clip.id, patch });
  };
  return (
    <div className="cc-pip-grid">
      {PIP_PRESETS.map((p) => (
        <button
          key={p.id}
          className={`cc-pip-cell cc-pip-cell--${p.id}`}
          onClick={() => apply(p.id)}
          title={`Position: ${p.label}`}
        >
          <span className="cc-pip-dot" />
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Mixer strip with live meter ───────────────────────── */

function MixerStrip({ track, dispatch }) {
  const [meter, setMeter] = useState(0);
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    let raf;
    const tick = () => {
      setMeter(audioEngine.getMeter(track.id));
      setPeak(audioEngine.getPeak(track.id));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track.id]);

  const onWheel = (e) => {
    e.preventDefault();
    const next = Math.max(0, Math.min(1.5, track.volume + (e.deltaY < 0 ? 0.04 : -0.04)));
    dispatch({ type: 'track/update', id: track.id, patch: { volume: next } });
  };

  // dB conversion for label
  const dbLabel = (v) => (v <= 0.001 ? '−∞' : (20 * Math.log10(v)).toFixed(1));

  return (
    <div className="cc-mixer__strip" onWheel={onWheel}>
      <div className="cc-mixer__name">{track.name}</div>
      <div className="cc-mixer__faderwrap">
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.01}
          value={track.volume}
          orient="vertical"
          onChange={(e) =>
            dispatch({ type: 'track/update', id: track.id, patch: { volume: parseFloat(e.target.value) } })
          }
          className="cc-mixer__fader"
        />
        <div className="cc-mixer__meter">
          <span className="cc-mixer__meter-fill" style={{ height: `${Math.min(100, meter * 80)}%` }} />
          <span className="cc-mixer__meter-peak" style={{ bottom: `${Math.min(100, peak * 80)}%` }} />
          <span className="cc-mixer__meter-tick" style={{ bottom: '53.3%' }} />{/* -6dB */}
          <span className="cc-mixer__meter-tick" style={{ bottom: '33.3%' }} />{/* -12dB */}
        </div>
      </div>
      <div className="cc-mixer__db">{dbLabel(track.volume)} dB</div>
      <div className="cc-mixer__toggles">
        <button
          className={`cc-pill ${track.muted ? 'is-on cc-pill--danger' : ''}`}
          onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { muted: !track.muted } })}
        >
          M
        </button>
        <button
          className={`cc-pill ${track.solo ? 'is-on cc-pill--accent' : ''}`}
          onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { solo: !track.solo } })}
        >
          S
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Motion (entry / exit) picker ─────────────────── */

function MotionPicker({ label, valueId, valueDur, onPreset, onDuration }) {
  return (
    <div className="cc-motion">
      <div className="cc-motion__head">
        <span className="cc-motion__label">{label}</span>
        <span className="cc-motion__dur">
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.05}
            value={valueDur}
            onChange={(e) => onDuration(parseFloat(e.target.value))}
            disabled={valueId === 'none'}
          />
          <strong>{valueDur.toFixed(2)}s</strong>
        </span>
      </div>
      <div className="cc-motion__grid">
        {TEXT_MOTIONS.map((m) => (
          <button
            key={m.id}
            className={`cc-motion__btn ${valueId === m.id ? 'is-on' : ''} cc-motion__btn--${m.id}`}
            onClick={() => onPreset(m.id)}
            title={m.sub}
          >
            <span className="cc-motion__name">{m.label}</span>
            <span className="cc-motion__sub">{m.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
