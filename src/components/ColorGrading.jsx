import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { mediaRenderer } from '../engine/mediaRenderer.js';
import { createEffectInstance } from '../engine/effectsRegistry.js';
import {
  renderWaveform,
  renderVectorscope,
  renderHistogram,
  renderParade
} from '../engine/colorScopes.js';
import '../styles/color-grading.css';

export function ColorGrading() {
  const { state, dispatch, selectedClips } = useEditor();
  const clip = selectedClips[0] ?? null;

  const [activeScope, setActiveScope] = useState('waveform'); // waveform, vectorscope, histogram, parade
  const scopeCanvasRef = useRef(null);
  const animationRef = useRef(null);

  // Active effect parameters
  const exposureVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'exposure');
    return fx?.params?.exposure ?? 0;
  }, [clip]);

  const tempVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'temperature');
    return fx?.params?.temperature ?? 0;
  }, [clip]);

  const tintVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'temperature');
    return fx?.params?.tint ?? 0;
  }, [clip]);

  const vibranceVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'vibrance');
    return fx?.params?.vibrance ?? 0;
  }, [clip]);

  const lutPresetVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'lut');
    return fx?.params?.lutPreset ?? 'none';
  }, [clip]);

  const balanceVal = useMemo(() => {
    const fx = clip?.effects?.find((e) => e.effectId === 'colorBalance');
    return fx?.params ?? { redShift: 0, greenShift: 0, blueShift: 0 };
  }, [clip]);

  // Set parameter helper
  const setEffectParam = useCallback((effectId, paramName, value) => {
    if (!clip) return;
    const existing = (clip.effects ?? []).find((e) => e.effectId === effectId);
    if (!existing) {
      const inst = createEffectInstance(effectId, { [paramName]: value });
      if (inst) {
        dispatch({ type: 'clip/addEffect', id: clip.id, effect: inst });
      }
    } else {
      const nextParams = { ...(existing.params ?? {}), [paramName]: value };
      dispatch({
        type: 'clip/updateEffect',
        id: clip.id,
        effectId: existing.id,
        patch: { params: nextParams }
      });
    }
  }, [clip, dispatch]);

  // Draw scopes on tick
  useEffect(() => {
    const canvas = scopeCanvasRef.current;
    if (!canvas) return;

    let active = true;
    const draw = () => {
      if (!active) return;
      const src = mediaRenderer.programCanvas;
      if (src && canvas) {
        try {
          if (activeScope === 'waveform') renderWaveform(src, canvas);
          else if (activeScope === 'vectorscope') renderVectorscope(src, canvas);
          else if (activeScope === 'histogram') renderHistogram(src, canvas);
          else if (activeScope === 'parade') renderParade(src, canvas);
        } catch (_) {}
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    // Draw immediately
    draw();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [activeScope, state.playhead]);

  // Handle color wheels dragging
  const handleWheelDrag = useCallback((wheelName, e) => {
    if (!clip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const move = (ev) => {
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      const maxRadius = 50;
      const r = Math.min(maxRadius, Math.sqrt(dx * dx + dy * dy));
      const angle = Math.atan2(dy, dx);
      
      const px = r * Math.cos(angle);
      const py = r * Math.sin(angle);
      
      // Map coordinates to color shifts:
      // X-axis maps to Red/Cyan shift. Y-axis maps to Green/Blue shift.
      const factor = 1.6; // multiplier
      const redVal = Math.round((px / maxRadius) * 50 * factor);
      const greenVal = Math.round((-py / maxRadius) * 50 * factor);
      const blueVal = Math.round((-px / maxRadius) * 30 * factor); // cyan/blue opposite

      if (wheelName === 'lift') {
        // Map Lift wheel to colorBalance
        setEffectParam('colorBalance', 'redShift', redVal);
        setEffectParam('colorBalance', 'greenShift', greenVal);
        setEffectParam('colorBalance', 'blueShift', blueVal);
      } else if (wheelName === 'gamma') {
        setEffectParam('temperature', 'temperature', Math.round((px / maxRadius) * 80));
        setEffectParam('temperature', 'tint', Math.round((py / maxRadius) * 80));
      } else if (wheelName === 'gain') {
        setEffectParam('exposure', 'exposure', (py / maxRadius) * 2);
        setEffectParam('vibrance', 'vibrance', Math.round((px / maxRadius) * 100));
      }
    };

    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    move(e);
  }, [clip, setEffectParam]);

  // Calculate handle position on trackpad
  const getHandleStyle = (wheelName) => {
    if (wheelName === 'lift') {
      const rx = (balanceVal.redShift / 80) * 50;
      const ry = (-balanceVal.greenShift / 80) * 50;
      return { left: `${50 + rx}px`, top: `${50 + ry}px` };
    }
    if (wheelName === 'gamma') {
      const rx = (tempVal / 80) * 50;
      const ry = (tintVal / 80) * 50;
      return { left: `${50 + rx}px`, top: `${50 + ry}px` };
    }
    if (wheelName === 'gain') {
      const rx = (vibranceVal / 100) * 50;
      const ry = (exposureVal / 2) * 50;
      return { left: `${50 + rx}px`, top: `${50 + ry}px` };
    }
    return { left: '50px', top: '50px' };
  };

  return (
    <aside className="cc-color-grading">
      <header className="cc-color-grading__header">
        <div className="cc-color-grading__title">
          🎨 Color Suite
        </div>
      </header>

      <div className="cc-color-grading__content">
        {/* Scopes Section */}
        <div className="cc-scopes">
          <div className="cc-scopes__header">
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa' }}>MONITOR SCOPE</span>
            <select
              className="cc-scopes__select"
              value={activeScope}
              onChange={(e) => setActiveScope(e.target.value)}
            >
              <option value="waveform">Waveform (Luma)</option>
              <option value="vectorscope">Vectorscope</option>
              <option value="histogram">Histogram</option>
              <option value="parade">RGB Parade</option>
            </select>
          </div>
          <div className="cc-scopes__canvas-container">
            <canvas
              ref={scopeCanvasRef}
              width={380}
              height={160}
              className="cc-scopes__canvas"
            />
          </div>
        </div>

        {!clip ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
            Select a video/image clip on the timeline to perform color grading.
          </div>
        ) : (
          <>
            {/* LUT Dropdown */}
            <div className="cc-grading-sliders" style={{ padding: '12px' }}>
              <label className="cc-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="cc-field__label" style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 'bold' }}>3D LUT PROFILE</span>
                <select
                  value={lutPresetVal}
                  onChange={(e) => setEffectParam('lut', 'lutPreset', e.target.value)}
                  style={{
                    background: '#121215',
                    color: '#fff',
                    border: '1px solid #27272a',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    width: '100%',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="none">None (Rec.709 Pass)</option>
                  <option value="cinematic">Cinematic Orange-Teal LUT</option>
                  <option value="vintage">Vintage Warm Glow LUT</option>
                  <option value="teal-orange">Aggressive Teal & Orange LUT</option>
                </select>
              </label>
            </div>

            {/* 3-Way Wheels Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa' }}>3-WAY COLOR WHEELS</span>
              <div className="cc-wheels">
                <div className="cc-wheel-item">
                  <div className="cc-wheel-item__label">Lift (Shadows)</div>
                  <div 
                    className="cc-wheel-item__trackpad"
                    onMouseDown={(e) => handleWheelDrag('lift', e)}
                  >
                    <div className="cc-wheel-item__handle" style={getHandleStyle('lift')} />
                  </div>
                </div>

                <div className="cc-wheel-item">
                  <div className="cc-wheel-item__label">Gamma (Mids)</div>
                  <div 
                    className="cc-wheel-item__trackpad"
                    onMouseDown={(e) => handleWheelDrag('gamma', e)}
                  >
                    <div className="cc-wheel-item__handle" style={getHandleStyle('gamma')} />
                  </div>
                </div>

                <div className="cc-wheel-item">
                  <div className="cc-wheel-item__label">Gain (Highlights)</div>
                  <div 
                    className="cc-wheel-item__trackpad"
                    onMouseDown={(e) => handleWheelDrag('gain', e)}
                  >
                    <div className="cc-wheel-item__handle" style={getHandleStyle('gain')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Precision Grading Sliders */}
            <div className="cc-grading-sliders">
              <span className="cc-grading-sliders__title">Precision Color Sliders</span>

              {/* Exposure */}
              <label className="cc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                  <span>Exposure</span>
                  <strong style={{ color: '#fff' }}>{exposureVal.toFixed(2)} EV</strong>
                </div>
                <input
                  type="range"
                  min={-2.0}
                  max={2.0}
                  step={0.05}
                  value={exposureVal}
                  onChange={(e) => setEffectParam('exposure', 'exposure', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </label>

              {/* Temperature */}
              <label className="cc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                  <span>Temperature (Cool ↔ Warm)</span>
                  <strong style={{ color: '#fff' }}>{tempVal > 0 ? `+${tempVal}` : tempVal}</strong>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  step={1}
                  value={tempVal}
                  onChange={(e) => setEffectParam('temperature', 'temperature', parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </label>

              {/* Tint */}
              <label className="cc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                  <span>Tint (Green ↔ Magenta)</span>
                  <strong style={{ color: '#fff' }}>{tintVal > 0 ? `+${tintVal}` : tintVal}</strong>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  step={1}
                  value={tintVal}
                  onChange={(e) => setEffectParam('temperature', 'tint', parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </label>

              {/* Vibrance */}
              <label className="cc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                  <span>Vibrance</span>
                  <strong style={{ color: '#fff' }}>{vibranceVal > 0 ? `+${vibranceVal}` : vibranceVal}%</strong>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={vibranceVal}
                  onChange={(e) => setEffectParam('vibrance', 'vibrance', parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </label>

              {/* Reset button */}
              <button
                className="cc-btn cc-btn--sm"
                onClick={() => {
                  // Remove all color effects
                  dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: 'exposure' });
                  dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: 'temperature' });
                  dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: 'vibrance' });
                  dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: 'colorBalance' });
                  dispatch({ type: 'clip/removeEffect', id: clip.id, effectId: 'lut' });
                  dispatch({ type: 'toast/push', kind: 'info', message: 'Color grading parameters reset' });
                }}
                style={{ width: '100%', marginTop: '6px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff' }}
              >
                Reset Color Grade
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
