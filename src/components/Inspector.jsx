import { useEffect, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { TITLE_PRESETS } from '../engine/titleCompositor.js';
import { audioEngine } from '../engine/audioEngine.js';
import { TEXT_MOTIONS } from '../engine/textMotion.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { getEffect } from '../engine/effectsRegistry.js';

const TABS = [
  { id: 'basic',      label: 'Basic' },
  { id: 'background', label: 'Background' },
  { id: 'smart',      label: 'Smart tools' },
  { id: 'effects',    label: 'Effects' },
  { id: 'audio',      label: 'Audio' },
  { id: 'animation',  label: 'Animation' },
  { id: 'speed',      label: 'Speed' }
];

export function Inspector() {
  const { state, dispatch, selectedClips } = useEditor();
  const clip = selectedClips[0] ?? null;
  const [activeTab, setActiveTab] = useState('basic');

  // Fallback to basic tab if activeTab is not relevant
  useEffect(() => {
    if (clip && clip.kind === 'audio' && (activeTab === 'basic' || activeTab === 'background' || activeTab === 'smart' || activeTab === 'effects')) {
      setActiveTab('audio');
    } else if (clip && clip.kind === 'title' && (activeTab === 'background' || activeTab === 'smart')) {
      setActiveTab('basic');
    }
  }, [clip, activeTab]);

  return (
    <aside className="cc-panel cc-inspector" style={{ background: '#121215', borderLeft: '1px solid #1c1c21' }}>
      <header className="cc-panel__header" style={{ padding: '14px 16px' }}>
        <div className="cc-panel__title" style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5' }}>
          <Icon.Settings size={15} /> Inspector
        </div>
      </header>

      {clip && (
        <nav className="cc-tabs" style={{ background: '#09090b', padding: '4px' }}>
          {TABS.map((t) => {
            // Disable tabs that do not apply to specific clip types
            const disabled = 
              (clip.kind === 'audio' && (t.id === 'basic' || t.id === 'background' || t.id === 'smart' || t.id === 'effects')) ||
              (clip.kind === 'title' && (t.id === 'background' || t.id === 'smart'));
            
            if (disabled) return null;

            return (
              <button
                key={t.id}
                className={`cc-tab ${activeTab === t.id ? 'is-on' : ''}`}
                onClick={() => setActiveTab(t.id)}
                style={{ fontSize: '11px', padding: '6px 4px', textTransform: 'none', letterSpacing: 0 }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      {!clip && (
        <div className="cc-inspector__empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#71717a' }}>
          <div className="cc-inspector__empty-icon">
            <Icon.Wand size={28} />
          </div>
          <div style={{ fontSize: '12px' }}>Select a clip on the timeline to edit</div>
        </div>
      )}

      {clip && (
        <div className="cc-inspector__body" style={{ padding: '16px', overflowY: 'auto' }}>
          <div className="cc-inspector__head" style={{ borderBottom: '1px solid #27272a', paddingBottom: '12px', marginBottom: '14px' }}>
            <div className="cc-inspector__head-name" style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{clipName(clip, state)}</div>
            <div className="cc-inspector__head-sub" style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
              {clip.kind.toUpperCase()} · {(clip.end - clip.start).toFixed(2)}s
            </div>
          </div>

          {activeTab === 'basic' && (
            <BasicPanel clip={clip} state={state} dispatch={dispatch} />
          )}

          {activeTab === 'background' && (
            <BackgroundPanel clip={clip} dispatch={dispatch} state={state} />
          )}

          {activeTab === 'smart' && (
            <SmartToolsPanel clip={clip} state={state} dispatch={dispatch} />
          )}

          {activeTab === 'effects' && (
            <EffectsPanel clip={clip} state={state} dispatch={dispatch} />
          )}

          {activeTab === 'audio' && (
            <AudioPanel clip={clip} state={state} dispatch={dispatch} />
          )}

          {activeTab === 'animation' && (
            <AnimationPanel clip={clip} dispatch={dispatch} />
          )}

          {activeTab === 'speed' && (
            <SpeedPanel clip={clip} dispatch={dispatch} />
          )}
        </div>
      )}
    </aside>
  );
}

function clipName(clip, state) {
  if (clip.kind === 'title') return clip.title?.text || 'Title';
  const m = state.media.find((x) => x.id === clip.mediaId);
  return m?.name ?? 'Clip';
}

/* ─────────────────────────── Panels ─────────────────────────── */

function Slider({ label, min, max, step, value, suffix = '', onChange, format }) {
  return (
    <label className="cc-field" style={{ margin: '10px 0' }}>
      <span className="cc-field__label" style={{ fontSize: '11px', color: '#a1a1aa' }}>
        {label}
        <strong style={{ color: '#fff' }}>{format ? format(value) : `${value}${suffix}`}</strong>
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

// 1. BASIC PANEL (Transform, Text editing, Color Filters)
function BasicPanel({ clip, _state, dispatch }) {
  const isText = clip.kind === 'title' || clip.kind === 'subtitle';
  const t = clip.transform;
  const updTransform = (patch) => dispatch({ type: 'clip/updateTransform', id: clip.id, patch });
  const updCrop = (patch) => updTransform({ crop: { ...t.crop, ...patch } });

  const f = clip.filters;
  const updFilters = (patch) => dispatch({ type: 'clip/updateFilters', id: clip.id, patch });

  const title = clip.title || {};
  const updTitle = (patch) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch });

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* If it's a Text Clip, render Text options directly under Basic */}
      {isText && (
        <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Text Properties</h4>
          <textarea
            className="cc-textarea"
            rows={2}
            value={title.text || ''}
            onChange={(e) => updTitle({ text: e.target.value })}
            style={{ width: '100%', background: '#1c1c21', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', padding: '6px', resize: 'vertical' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            <label className="cc-field" style={{ margin: 0 }}>
              <span className="cc-field__label">Font family</span>
              <select 
                value={title.font || 'Inter'} 
                onChange={(e) => updTitle({ font: e.target.value })}
                style={{ background: '#1c1c21', color: '#fff' }}
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Oswald">Oswald</option>
                <option value="Outfit">Outfit</option>
                <option value="Pacifico">Pacifico</option>
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
              </select>
            </label>
            <label className="cc-field" style={{ margin: 0 }}>
              <span className="cc-field__label">Font weight</span>
              <select 
                value={title.weight || 600} 
                onChange={(e) => updTitle({ weight: parseInt(e.target.value, 10) })}
                style={{ background: '#1c1c21', color: '#fff' }}
              >
                {[300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            <label className="cc-field" style={{ margin: 0 }}>
              <span className="cc-field__label">Style Preset</span>
              <select 
                value={title.preset || 'plain'} 
                onChange={(e) => updTitle({ preset: e.target.value })}
                style={{ background: '#1c1c21', color: '#fff' }}
              >
                <option value="plain">Standard Text</option>
                {TITLE_PRESETS.filter(tp => tp.id !== 'plain').map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.label}</option>
                ))}
              </select>
            </label>
            <label className="cc-field" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <span className="cc-field__label">Text Color</span>
              <input 
                type="color" 
                value={title.color || '#ffffff'} 
                onChange={(e) => updTitle({ color: e.target.value })}
                style={{ background: 'none', border: 'none', width: '100%', height: '28px', cursor: 'pointer', padding: 0 }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            <div>
              <span className="cc-field__label" style={{ fontSize: '11px', color: '#a1a1aa' }}>H Align</span>
              <div style={{ display: 'flex', background: '#1c1c21', borderRadius: '4px', padding: '2px', marginTop: '4px' }}>
                {['left', 'center', 'right'].map(align => (
                  <button
                    key={align}
                    onClick={() => updTitle({ align })}
                    style={{
                      flex: 1,
                      padding: '4px',
                      fontSize: '10px',
                      background: title.align === align ? '#2563eb' : 'transparent',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    {align.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="cc-field__label" style={{ fontSize: '11px', color: '#a1a1aa' }}>V Align</span>
              <div style={{ display: 'flex', background: '#1c1c21', borderRadius: '4px', padding: '2px', marginTop: '4px' }}>
                {['top', 'middle', 'bottom'].map(valign => (
                  <button
                    key={valign}
                    onClick={() => updTitle({ valign })}
                    style={{
                      flex: 1,
                      padding: '4px',
                      fontSize: '10px',
                      background: title.valign === valign ? '#2563eb' : 'transparent',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    {valign.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Slider 
            label="Font Size" 
            min={24} 
            max={240} 
            step={1} 
            value={title.size || 64} 
            suffix="px" 
            onChange={(v) => updTitle({ size: v })} 
          />

          <Slider 
            label="Letter Spacing" 
            min={-10} 
            max={50} 
            step={1} 
            value={title.letterSpacing || 0} 
            suffix="px" 
            onChange={(v) => updTitle({ letterSpacing: v })} 
          />

          {/* Stroke / Outline */}
          <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={title.strokeWidth > 0} 
                onChange={(e) => updTitle({ strokeWidth: e.target.checked ? 4 : 0, strokeColor: title.strokeColor || '#000000' })}
              />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Text Outline</span>
            </label>
            {title.strokeWidth > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
                <label className="cc-field cc-field--row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Outline Color</span>
                  <input 
                    type="color" 
                    value={title.strokeColor || '#000000'} 
                    onChange={(e) => updTitle({ strokeColor: e.target.value })}
                  />
                </label>
                <Slider 
                  label="Outline Width" 
                  min={1} 
                  max={15} 
                  step={1} 
                  value={title.strokeWidth} 
                  suffix="px" 
                  onChange={(v) => updTitle({ strokeWidth: v })} 
                />
              </div>
            )}
          </div>

          {/* Shadow */}
          <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={title.shadowEnable ?? false} 
                onChange={(e) => updTitle({ shadowEnable: e.target.checked, shadowColor: title.shadowColor || 'rgba(0,0,0,0.5)' })}
              />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Drop Shadow</span>
            </label>
            {title.shadowEnable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
                <label className="cc-field cc-field--row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Shadow Color</span>
                  <input 
                    type="color" 
                    value={title.shadowColor?.startsWith('rgba') ? '#000000' : (title.shadowColor || '#000000')} 
                    onChange={(e) => updTitle({ shadowColor: e.target.value })}
                  />
                </label>
                <Slider 
                  label="Blur" 
                  min={0} 
                  max={30} 
                  step={1} 
                  value={title.shadowBlur ?? 6} 
                  suffix="px" 
                  onChange={(v) => updTitle({ shadowBlur: v })} 
                />
                <Slider 
                  label="Offset X" 
                  min={-20} 
                  max={20} 
                  step={1} 
                  value={title.shadowOffsetX ?? 3} 
                  suffix="px" 
                  onChange={(v) => updTitle({ shadowOffsetX: v })} 
                />
                <Slider 
                  label="Offset Y" 
                  min={-20} 
                  max={20} 
                  step={1} 
                  value={title.shadowOffsetY ?? 3} 
                  suffix="px" 
                  onChange={(v) => updTitle({ shadowOffsetY: v })} 
                />
              </div>
            )}
          </div>

          {/* Background Scrim */}
          <div style={{ paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={title.bgEnable ?? false} 
                onChange={(e) => updTitle({ bgEnable: e.target.checked, bgColor: title.bgColor || 'rgba(0,0,0,0.5)' })}
              />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Background Box</span>
            </label>
            {title.bgEnable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
                <label className="cc-field cc-field--row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Box Color</span>
                  <input 
                    type="color" 
                    value={title.bgColor?.startsWith('rgba') ? '#000000' : (title.bgColor || '#000000')} 
                    onChange={(e) => updTitle({ bgColor: e.target.value })}
                  />
                </label>
                <Slider 
                  label="Padding" 
                  min={0} 
                  max={50} 
                  step={1} 
                  value={title.bgPadding ?? 15} 
                  suffix="px" 
                  onChange={(v) => updTitle({ bgPadding: v })} 
                />
                <Slider 
                  label="Corner Roundness" 
                  min={0} 
                  max={30} 
                  step={1} 
                  value={title.bgBorderRadius ?? 6} 
                  suffix="px" 
                  onChange={(v) => updTitle({ bgBorderRadius: v })} 
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transform Settings */}
      <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Transform</h4>
        <Slider label="Scale" min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => updTransform({ scale: v })} format={(v) => `${(v * 100).toFixed(0)}%`} />
        <Slider label="Opacity" min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => updTransform({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Rotation" min={-180} max={180} step={1} value={t.rotation} suffix="°" onChange={(v) => updTransform({ rotation: v })} />
        <Slider label="Position X" min={-960} max={960} step={1} value={t.x} suffix="px" onChange={(v) => updTransform({ x: v })} />
        <Slider label="Position Y" min={-540} max={540} step={1} value={t.y} suffix="px" onChange={(v) => updTransform({ y: v })} />
      </div>

      {/* Color Grading Filters */}
      {!isText && (
        <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Color adjustments</h4>
          <Slider label="Brightness" min={0.2} max={2} step={0.01} value={f.brightness} onChange={(v) => updFilters({ brightness: v })} />
          <Slider label="Contrast"   min={0.2} max={2} step={0.01} value={f.contrast}   onChange={(v) => updFilters({ contrast: v })} />
          <Slider label="Saturation" min={0}   max={2} step={0.01} value={f.saturation} onChange={(v) => updFilters({ saturation: v })} />
          <Slider label="Hue Rotate" min={-180} max={180} step={1} value={f.hueRotate} suffix="°" onChange={(v) => updFilters({ hueRotate: v })} />
        </div>
      )}

      {/* Crop settings */}
      {!isText && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Crop & Canvas</h4>
          <Slider label="Crop Top" min={0} max={0.45} step={0.005} value={t.crop.top} onChange={(v) => updCrop({ top: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Crop Bottom" min={0} max={0.45} step={0.005} value={t.crop.bottom} onChange={(v) => updCrop({ bottom: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Crop Left" min={0} max={0.45} step={0.005} value={t.crop.left} onChange={(v) => updCrop({ left: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Crop Right" min={0} max={0.45} step={0.005} value={t.crop.right} onChange={(v) => updCrop({ right: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      )}
    </div>
  );
}

// 2. BACKGROUND PANEL
function BackgroundPanel({ _clip, dispatch, state }) {
  const p = state.project;
  const bg = p.background ?? { type: 'color', color: '#05080f', blur: 15 };

  const updBg = (patch) => {
    dispatch({ type: 'project/update', patch: { background: { ...bg, ...patch } } });
  };

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Canvas Background</h4>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          className={`cc-pill ${bg.type === 'color' ? 'is-on cc-pill--accent' : ''}`}
          onClick={() => updBg({ type: 'color' })}
        >
          Solid Color
        </button>
        <button 
          className={`cc-pill ${bg.type === 'checkerboard' ? 'is-on cc-pill--accent' : ''}`}
          onClick={() => updBg({ type: 'checkerboard' })}
        >
          Checkerboard
        </button>
        <button 
          className={`cc-pill ${bg.type === 'blur' ? 'is-on cc-pill--accent' : ''}`}
          onClick={() => updBg({ type: 'blur' })}
        >
          Blur Background
        </button>
      </div>

      {bg.type === 'color' && (
        <label className="cc-field cc-field--row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Pick Color</span>
          <input 
            type="color" 
            value={bg.color || '#05080f'} 
            onChange={(e) => updBg({ color: e.target.value })}
          />
        </label>
      )}

      {bg.type === 'blur' && (
        <Slider 
          label="Blur Intensity" 
          min={0} 
          max={30} 
          step={1} 
          value={bg.blur ?? 15} 
          suffix="px" 
          onChange={(v) => updBg({ blur: v })} 
        />
      )}
    </div>
  );
}

// 3. SMART TOOLS PANEL (Chroma key / Greenscreen / Stabilizer / Motion Tracker)
function SmartToolsPanel({ clip, state, dispatch }) {
  const f = clip.filters;
  const updFilters = (patch) => dispatch({ type: 'clip/updateFilters', id: clip.id, patch });
  const updChroma = (patch) => updFilters({ chromaKey: { ...f.chromaKey, ...patch } });

  const overlayClips = state.clips.filter(c => c.id !== clip.id && (c.kind === 'title' || c.kind === 'image'));
  const [selectedOverlayId, setSelectedOverlayId] = useState('');
  const [stabilizing, setStabilizing] = useState(false);
  const [tracking, setTracking] = useState(false);

  // Set default selected overlay if list changes
  useEffect(() => {
    if (overlayClips.length && !selectedOverlayId) {
      setSelectedOverlayId(overlayClips[0].id);
    }
  }, [overlayClips, selectedOverlayId]);

  const handleStabilize = async () => {
    const media = state.media.find(m => m.id === clip.mediaId);
    if (!media) return;
    setStabilizing(true);
    dispatch({ type: 'toast/push', kind: 'info', message: 'Analyzing camera shake on GPU/CPU...' });

    const video = document.createElement('video');
    video.src = media.src;
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      try {
        const { analyzeStabilization, generateStabilizationKeyframes } = await import('../engine/stabilizer.js');
        const stabData = await analyzeStabilization(video, {
          startTime: clip.srcIn ?? 0,
          endTime: clip.srcOut ?? video.duration ?? 10,
          fps: 12
        });

        if (!stabData || !stabData.length) {
          dispatch({ type: 'toast/push', kind: 'info', message: 'No camera shake detected.' });
          return;
        }

        const { keyframes, zoom } = generateStabilizationKeyframes(stabData, clip);

        // Update clip with auto zoom and stabilization keyframes
        dispatch({
          type: 'clip/updateTransform',
          id: clip.id,
          patch: {
            scale: zoom,
            keyframes: (clip.keyframes ?? []).concat(keyframes)
          }
        });

        dispatch({ type: 'toast/push', kind: 'success', message: 'Stabilization complete! Auto-zoom applied.' });
      } catch (err) {
        console.error(err);
        dispatch({ type: 'toast/push', kind: 'error', message: 'Stabilization failed: ' + err.message });
      } finally {
        video.remove();
        setStabilizing(false);
      }
    };
    video.onerror = () => {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Failed to load video source.' });
      video.remove();
      setStabilizing(false);
    };
  };

  const handleTrackMotion = async () => {
    if (!selectedOverlayId) {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Please select a target overlay to bind motion to.' });
      return;
    }
    const media = state.media.find(m => m.id === clip.mediaId);
    if (!media) return;
    setTracking(true);
    dispatch({ type: 'toast/push', kind: 'info', message: 'Tracking visual feature in background...' });

    const video = document.createElement('video');
    video.src = media.src;
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      try {
        const { trackFeature, convertTrackingToKeyframes } = await import('../engine/motionTracker.js');
        const initialBox = { x: 0.45, y: 0.45, w: 0.1, h: 0.1 };
        const trackData = await trackFeature(video, initialBox, {
          startTime: clip.srcIn ?? 0,
          endTime: clip.srcOut ?? video.duration ?? 10,
          fps: 10
        });

        const targetOverlay = state.clips.find(c => c.id === selectedOverlayId);
        if (!targetOverlay) {
          dispatch({ type: 'toast/push', kind: 'error', message: 'Target overlay clip not found.' });
          return;
        }

        const keyframes = convertTrackingToKeyframes(trackData, clip, targetOverlay);

        dispatch({
          type: 'clip/updateTransform',
          id: targetOverlay.id,
          patch: {
            keyframes: (targetOverlay.keyframes ?? []).concat(keyframes)
          }
        });

        dispatch({ type: 'toast/push', kind: 'success', message: `Motion tracked successfully! Keyframes applied to "${targetOverlay.kind}".` });
      } catch (err) {
        console.error(err);
        dispatch({ type: 'toast/push', kind: 'error', message: 'Tracking failed: ' + err.message });
      } finally {
        video.remove();
        setTracking(false);
      }
    };
    video.onerror = () => {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Failed to load video source.' });
      video.remove();
      setTracking(false);
    };
  };

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Greenscreen / Chroma Key</h4>
        
        <label className="cc-field cc-field--row">
          <input
            type="checkbox"
            checked={f.chromaKey?.enabled ?? false}
            onChange={(e) => updChroma({ enabled: e.target.checked })}
          />
          <span style={{ color: '#d4d4d8' }}>Enable chroma key</span>
        </label>

        {f.chromaKey?.enabled && (
          <>
            <label className="cc-field cc-field--row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Key Color</span>
              <input
                type="color"
                value={f.chromaKey?.color ?? '#00ff00'}
                onChange={(e) => updChroma({ color: e.target.value })}
              />
            </label>
            <Slider label="Color Tolerance" min={0.05} max={0.9} step={0.01} value={f.chromaKey?.tolerance ?? 0.35} onChange={(v) => updChroma({ tolerance: v })} />
            <Slider label="Edge Softness"  min={0} max={0.5} step={0.01} value={f.chromaKey?.softness ?? 0.1} onChange={(v) => updChroma({ softness: v })} />
          </>
        )}
      </div>

      {clip.kind === 'video' && (
        <>
          <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>AI Video Stabilizer</h4>
            <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 10px' }}>Smooths shaky camera movements and applies auto-zoom to prevent cropped borders.</p>
            <button 
              className="cc-btn cc-btn--ghost cc-btn--sm" 
              onClick={handleStabilize} 
              disabled={stabilizing}
              style={{ width: '100%' }}
            >
              {stabilizing ? 'Stabilizing...' : '🎬 Stabilize Video'}
            </button>
          </div>

          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>AI Motion Tracker</h4>
            <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 10px' }}>Tracks a visual feature in the video and binds its path coordinates to an overlay clip (like titles/stickers).</p>
            
            <label className="cc-field" style={{ marginBottom: '10px' }}>
              <span className="cc-field__label">Target Overlay Clip</span>
              <select 
                value={selectedOverlayId} 
                onChange={(e) => setSelectedOverlayId(e.target.value)}
                style={{ background: '#1c1c21', color: '#fff', width: '100%', border: '1px solid #3f3f46', borderRadius: '4px', padding: '4px' }}
                disabled={tracking}
              >
                <option value="">Select target overlay...</option>
                {overlayClips.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.kind.toUpperCase()} : {c.title?.text ? `"${c.title.text.slice(0, 15)}..."` : c.id}
                  </option>
                ))}
              </select>
            </label>

            <button 
              className="cc-btn cc-btn--primary cc-btn--sm" 
              onClick={handleTrackMotion} 
              disabled={tracking || !selectedOverlayId}
              style={{ width: '100%' }}
            >
              {tracking ? 'Tracking...' : '🎯 Track & Bind Motion'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// 4. AUDIO PANEL (Clip volume/pan + Track Mixer)
function AudioPanel({ clip, state, dispatch }) {
  const isAudioEnabled = clip.kind === 'video' || clip.kind === 'audio';
  const a = clip.audio;
  const updAudio = (patch) => dispatch({ type: 'clip/updateAudio', id: clip.id, patch });

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {isAudioEnabled && (
        <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Clip Audio</h4>
          <Slider label="Volume" min={0} max={2} step={0.01} value={a.volume} onChange={(v) => updAudio({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Panning" min={-1} max={1} step={0.01} value={a.pan} onChange={(v) => updAudio({ pan: v })} format={(v) => (v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} />
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <label className="cc-field cc-field--row">
              <input type="checkbox" checked={a.muted} onChange={(e) => updAudio({ muted: e.target.checked })} />
              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Mute clip</span>
            </label>
            <label className="cc-field cc-field--row">
              <input type="checkbox" checked={a.solo} onChange={(e) => updAudio({ solo: e.target.checked })} />
              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Solo clip</span>
            </label>
          </div>
        </div>
      )}

      {/* Unified Track Mixer */}
      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Track mixer</h4>
        <div className="cc-mixer" style={{ display: 'flex', gap: '10px' }}>
          {state.tracks
            .filter((t) => t.kind === 'audio')
            .map((t) => (
              <MixerStrip key={t.id} track={t} dispatch={dispatch} />
            ))}
        </div>
      </div>
    </div>
  );
}

// 5. ANIMATION PANEL (Transitions & Text Motions)
function AnimationPanel({ clip, dispatch }) {
  const isText = clip.kind === 'title' || clip.kind === 'subtitle';

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* If text clip, show Text entry/exit motions */}
      {isText && (
        <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Text Motions</h4>
          <MotionPicker
            label="In Animation"
            valueId={clip.title?.motion?.in ?? 'none'}
            valueDur={clip.title?.motion?.inDuration ?? 0.6}
            onPreset={(id) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch: { motion: { ...(clip.title?.motion ?? {}), in: id } } })}
            onDuration={(v) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch: { motion: { ...(clip.title?.motion ?? {}), inDuration: v } } })}
          />
          <div style={{ height: '8px' }} />
          <MotionPicker
            label="Out Animation"
            valueId={clip.title?.motion?.out ?? 'none'}
            valueDur={clip.title?.motion?.outDuration ?? 0.6}
            onPreset={(id) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch: { motion: { ...(clip.title?.motion ?? {}), out: id } } })}
            onDuration={(v) => dispatch({ type: 'clip/updateTitle', id: clip.id, patch: { motion: { ...(clip.title?.motion ?? {}), outDuration: v } } })}
          />
        </div>
      )}

      {/* Video Transitions */}
      {!isText && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Transitions</h4>
          <TransitionEdit side="in" clip={clip} dispatch={dispatch} />
          <div style={{ height: '8px' }} />
          <TransitionEdit side="out" clip={clip} dispatch={dispatch} />
        </div>
      )}
    </div>
  );
}

// 6. RETIME / SPEED PANEL
function SpeedPanel({ clip, dispatch }) {
  const isVideoOrAudio = clip.kind === 'video' || clip.kind === 'audio';

  if (!isVideoOrAudio) {
    return (
      <div className="cc-section">
        <em style={{ fontSize: '11px', color: '#71717a' }}>Speed controls not available for text elements.</em>
      </div>
    );
  }

  return (
    <div className="cc-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Clip Speed</h4>
      <Slider
        label="Playback Speed multiplier"
        min={0.25}
        max={4}
        step={0.05}
        value={clip.speed ?? 1}
        onChange={(v) => dispatch({ type: 'clip/setSpeed', id: clip.id, speed: v })}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#1c1c21', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
        <span style={{ color: '#71717a' }}>• 1.00× represents real-time speed</span>
        <span style={{ color: '#71717a' }}>• Speeds &gt; 1.00× compress duration</span>
        <span style={{ color: '#71717a' }}>• Speeds &lt; 1.00× extend clip duration</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── INNER SUB-COMPONENTS ─────────────────────────── */

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

  const dbLabel = (v) => (v <= 0.001 ? '−∞' : (20 * Math.log10(v)).toFixed(1));

  return (
    <div className="cc-mixer__strip" onWheel={onWheel} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="cc-mixer__name" style={{ fontSize: '10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>{track.name}</div>
      <div className="cc-mixer__faderwrap" style={{ height: '90px', margin: '4px 0' }}>
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
        <div className="cc-mixer__meter" style={{ height: '100%' }}>
          <span className="cc-mixer__meter-fill" style={{ height: `${Math.min(100, meter * 80)}%` }} />
          <span className="cc-mixer__meter-peak" style={{ bottom: `${Math.min(100, peak * 80)}%` }} />
        </div>
      </div>
      <div className="cc-mixer__db" style={{ fontSize: '9px' }}>{dbLabel(track.volume)} dB</div>
      <div className="cc-mixer__toggles" style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
        <button
          className={`cc-pill ${track.muted ? 'is-on cc-pill--danger' : ''}`}
          onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { muted: !track.muted } })}
          style={{ padding: '2px 5px', fontSize: '9px' }}
        >
          M
        </button>
        <button
          className={`cc-pill ${track.solo ? 'is-on cc-pill--accent' : ''}`}
          onClick={() => dispatch({ type: 'track/update', id: track.id, patch: { solo: !track.solo } })}
          style={{ padding: '2px 5px', fontSize: '9px' }}
        >
          S
        </button>
      </div>
    </div>
  );
}

function MotionPicker({ label, valueId, valueDur, onPreset, onDuration }) {
  return (
    <div className="cc-motion" style={{ border: '1px solid #27272a', padding: '10px', borderRadius: '6px' }}>
      <div className="cc-motion__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className="cc-motion__label" style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{label}</span>
        <span className="cc-motion__dur">
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.05}
            value={valueDur}
            onChange={(e) => onDuration(parseFloat(e.target.value))}
            disabled={valueId === 'none'}
            style={{ width: '60px', marginRight: '4px' }}
          />
          <strong style={{ fontSize: '10px' }}>{valueDur.toFixed(2)}s</strong>
        </span>
      </div>
      <div className="cc-motion__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {TEXT_MOTIONS.map((m) => (
          <button
            key={m.id}
            className={`cc-motion__btn ${valueId === m.id ? 'is-on' : ''}`}
            onClick={() => onPreset(m.id)}
            title={m.sub}
            style={{ padding: '4px 6px', fontSize: '10px', textAlign: 'left', border: '1px solid #3f3f46', borderRadius: '4px' }}
          >
            <div className="cc-motion__name" style={{ fontWeight: 'bold' }}>{m.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransitionEdit({ side, clip, dispatch }) {
  const tr = clip.transitions?.[side] ?? null;
  const kind = tr?.kind ?? '';
  const dur = tr?.duration ?? 0.6;
  const setKind = (k) => {
    if (!k) dispatch({ type: 'transition/clear', clipId: clip.id, side });
    else dispatch({ type: 'transition/apply', clipId: clip.id, side, kind: k, duration: dur });
  };
  const setDur = (d) =>
    kind && dispatch({ type: 'transition/apply', clipId: clip.id, side, kind, duration: d });
  return (
    <div className="cc-transition-edit" style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #27272a', padding: '10px', borderRadius: '6px' }}>
      <label className="cc-field cc-field--row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{side === 'in' ? 'In Transition' : 'Out Transition'}</span>
        <select 
          value={kind} 
          onChange={(e) => setKind(e.target.value)}
          style={{ background: '#1c1c21', color: '#fff', fontSize: '11px' }}
        >
          <option value="">None</option>
          {TRANSITIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
      {kind && (
        <Slider label="Duration" min={0.1} max={2} step={0.05} value={dur} suffix="s" onChange={setDur} />
      )}
    </div>
  );
}

function EffectsPanel({ clip, _state, dispatch }) {
  const effects = clip.effects ?? [];

  const handleToggle = (fxId, val) => {
    dispatch({ type: 'clip/updateEffect', id: clip.id, effectId: fxId, patch: { enabled: val } });
  };

  const handleParamChange = (fxId, paramName, value) => {
    const fx = effects.find(e => e.id === fxId);
    if (!fx) return;
    const nextParams = { ...(fx.params ?? {}), [paramName]: value };
    dispatch({ type: 'clip/updateEffect', id: clip.id, effectId: fxId, patch: { params: nextParams } });
  };

  const handleRemove = (fxId) => {
    dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: fxId });
  };

  const handleMove = (index, dir) => {
    const toIndex = index + dir;
    if (toIndex < 0 || toIndex >= effects.length) return;
    dispatch({ type: 'clip/reorderEffects', id: clip.id, fromIndex: index, toIndex });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Effects Stack</h4>
      </div>
      
      {effects.length === 0 ? (
        <div style={{ padding: '24px 12px', border: '1px dashed #27272a', borderRadius: '6px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
          No custom effects applied. Drag/click effects from Left Control Panel to apply.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {effects.map((fx, idx) => {
            const def = getEffect(fx.effectId);
            if (!def) return null;
            return (
              <div 
                key={fx.id} 
                style={{ 
                  background: '#18181b', 
                  border: '1px solid #27272a', 
                  borderRadius: '6px', 
                  overflow: 'hidden' 
                }}
              >
                {/* Header */}
                <header style={{ 
                  padding: '8px 12px', 
                  background: '#09090b', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderBottom: '1px solid #27272a'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={fx.enabled !== false} 
                      onChange={(e) => handleToggle(fx.id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <strong style={{ fontSize: '12px', color: fx.enabled !== false ? '#fff' : '#71717a' }}>
                      {def.label}
                    </strong>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                      className="cc-pill"
                      onClick={() => handleMove(idx, -1)}
                      disabled={idx === 0}
                      title="Move Up"
                      style={{ padding: '2px 4px', fontSize: '9px', opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      ▲
                    </button>
                    <button 
                      className="cc-pill"
                      onClick={() => handleMove(idx, 1)}
                      disabled={idx === effects.length - 1}
                      title="Move Down"
                      style={{ padding: '2px 4px', fontSize: '9px', opacity: idx === effects.length - 1 ? 0.3 : 1 }}
                    >
                      ▼
                    </button>
                    <button 
                      className="cc-pill cc-pill--danger"
                      onClick={() => handleRemove(fx.id)}
                      title="Remove"
                      style={{ padding: '2px 4px', fontSize: '9px' }}
                    >
                      ✕
                    </button>
                  </div>
                </header>

                {/* Parameters */}
                {fx.enabled !== false && (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(def.params ?? []).map((p) => {
                      const val = fx.params?.[p.name] ?? p.default;
                      return (
                        <div key={p.name} className="cc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="cc-field__label" style={{ fontSize: '11px', color: '#a1a1aa' }}>
                              {p.label}
                            </span>
                            {(p.type === 'number' || p.type === 'range') && (
                              <strong style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                                {val.toFixed(p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0)}
                              </strong>
                            )}
                          </div>
                          
                          {(p.type === 'number' || p.type === 'range') && (
                            <input
                              type="range"
                              min={p.min ?? 0}
                              max={p.max ?? 1}
                              step={p.step ?? 0.01}
                              value={val}
                              onChange={(e) => handleParamChange(fx.id, p.name, parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                          )}

                          {p.type === 'color' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="color"
                                value={val}
                                onChange={(e) => handleParamChange(fx.id, p.name, e.target.value)}
                                style={{ width: '28px', height: '20px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#a1a1aa' }}>{val}</span>
                            </div>
                          )}

                          {p.type === 'boolean' && (
                            <input
                              type="checkbox"
                              checked={!!val}
                              onChange={(e) => handleParamChange(fx.id, p.name, e.target.checked)}
                              style={{ alignSelf: 'flex-start', cursor: 'pointer' }}
                            />
                          )}

                          {p.type === 'select' && (
                            <select
                              value={val}
                              onChange={(e) => handleParamChange(fx.id, p.name, e.target.value)}
                              style={{
                                width: '100%',
                                background: '#121217',
                                border: '1px solid #27272a',
                                color: '#fff',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}
                            >
                              {(p.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
