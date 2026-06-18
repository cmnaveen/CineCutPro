import React, { useContext, useState } from 'react';
import { EditorContext } from '../context/EditorContext';

export default function InspectorPanel() {
  const {
    clips, updateClipProperties,
    selectedClipId,
    addEffect, deleteEffect, updateEffectParam, toggleEffectEnabled,
    toggleKeyframe, playhead, undoStack, splitClip
  } = useContext(EditorContext);

  const [activeTab, setActiveTab] = useState('properties'); // 'properties' | 'history'
  const [openEffects, setOpenEffects] = useState({});

  // Find selected clip
  const clip = clips.find(c => c.id === selectedClipId);

  const toggleEffectOpen = (id) => {
    setOpenEffects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePropertyChange = (property, subProperty, value) => {
    if (subProperty) {
      updateClipProperties(selectedClipId, {
        [property]: { [subProperty]: parseFloat(value) }
      });
    } else {
      updateClipProperties(selectedClipId, {
        [property]: parseFloat(value)
      });
    }
  };

  const handleTextChange = (e) => {
    updateClipProperties(selectedClipId, {
      name: e.target.value
    });
  };

  const handleAddEffect = (type) => {
    if (clip) {
      addEffect(clip.id, type);
    }
  };

  const applyLayoutPreset = (preset) => {
    if (!clip) return;
    
    let transform = { ...clip.transform };
    let crop = { ...clip.crop };
    
    if (preset === 'full') {
      transform = { x: 0, y: 0, scale: 1.0, rotation: 0 };
      crop = { left: 0, top: 0, right: 0, bottom: 0 };
    } else if (preset === 'pip-tr') {
      transform = { x: 550, y: -300, scale: 0.35, rotation: 0 };
    } else if (preset === 'pip-tl') {
      transform = { x: -550, y: -300, scale: 0.35, rotation: 0 };
    } else if (preset === 'pip-br') {
      transform = { x: 550, y: 300, scale: 0.35, rotation: 0 };
    } else if (preset === 'pip-bl') {
      transform = { x: -550, y: 300, scale: 0.35, rotation: 0 };
    } else if (preset === 'overlay-center') {
      transform = { x: 0, y: 0, scale: 0.5, rotation: 0 };
    } else if (preset === 'split-left') {
      transform = { x: -480, y: 0, scale: 0.5, rotation: 0 };
    } else if (preset === 'split-right') {
      transform = { x: 480, y: 0, scale: 0.5, rotation: 0 };
    }
    
    updateClipProperties(clip.id, { transform, crop });
  };

  // Helper: Checks if a property has a keyframe at the exact current relative playhead time
  const isKeyframeActive = (property) => {
    if (!clip) return false;
    const curve = clip.keyframes[property] || [];
    const relativeTime = playhead - clip.timelinePos;
    return curve.some(k => Math.abs(k.time - relativeTime) < 0.08);
  };

  const handleToggleKeyframe = (property, currentValue) => {
    if (!clip) return;
    const relativeTime = playhead - clip.timelinePos;
    // Don't allow keyframing outside clip bounds
    if (relativeTime < 0 || relativeTime > clip.duration) {
      alert("Move the playhead inside the selected clip to add keyframes.");
      return;
    }
    toggleKeyframe(clip.id, property, relativeTime, currentValue);
  };

  return (
    <aside className="inspector glass-panel">
      <div className="panel-tabs">
        <button 
          className={`panel-tab ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Inspector
        </button>
        <button 
          className={`panel-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'properties' ? (
          !clip ? (
            <div className="empty-state">
              <span className="empty-state-icon">⚙️</span>
              <p>Select a clip on the timeline to inspect and edit its properties.</p>
            </div>
          ) : (
            <div>
              {/* Clip Title */}
              <div className="inspector-section" style={{ paddingTop: 0 }}>
                <div className="form-group">
                  <span className="form-label" style={{ fontWeight: 600 }}>Clip Name:</span>
                  {clip.mediaType === 'text' ? (
                    <input 
                      type="text" 
                      className="form-input-text" 
                      value={clip.name} 
                      onChange={handleTextChange} 
                    />
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{clip.name}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Type: {clip.mediaType.toUpperCase()} | Position: {clip.timelinePos.toFixed(2)}s
                </div>
              </div>

              {/* Text Styling Options (Text only) */}
              {clip.mediaType === 'text' && (
                <div className="inspector-section">
                  <span className="inspector-title">Text Options</span>
                  
                  {/* Edit Text Field */}
                  <div className="form-group">
                    <span className="form-label">Title Text</span>
                    <input 
                      type="text" 
                      className="form-input-text"
                      value={clip.name}
                      onChange={handleTextChange}
                      placeholder="Enter overlay text..."
                    />
                  </div>

                  {/* Font Size */}
                  <div className="form-group">
                    <span className="form-label">Font Size</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={10} 
                        max={300} 
                        step={5} 
                        value={clip.fontSize || 80} 
                        onChange={(e) => updateClipProperties(clip.id, { fontSize: parseInt(e.target.value) })}
                      />
                      <span>{clip.fontSize || 80}px</span>
                    </div>
                  </div>

                  {/* Text Color */}
                  <div className="form-group">
                    <span className="form-label">Text Color</span>
                    <div className="color-picker-wrapper">
                      <input 
                        type="color" 
                        value={clip.textColor || '#ffffff'} 
                        onChange={(e) => updateClipProperties(clip.id, { textColor: e.target.value })}
                      />
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{clip.textColor || '#ffffff'}</span>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="form-group">
                    <span className="form-label">Font Family</span>
                    <select 
                      className="form-input-text"
                      value={clip.fontFamily || 'Outfit'}
                      onChange={(e) => updateClipProperties(clip.id, { fontFamily: e.target.value })}
                    >
                      <option value="Outfit">Outfit</option>
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Courier New">Courier New</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Subtitle Options (Subtitle only) */}
              {clip.mediaType === 'subtitle' && (
                <div className="inspector-section">
                  <span className="inspector-title">Subtitle Options</span>
                  
                  {/* Edit Caption Text */}
                  <div className="form-group">
                    <span className="form-label">Caption Text</span>
                    <input 
                      type="text" 
                      className="form-input-text"
                      value={clip.name}
                      onChange={handleTextChange}
                      placeholder="Enter subtitle caption..."
                    />
                  </div>

                  {/* Font Size */}
                  <div className="form-group">
                    <span className="form-label">Font Size</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={10} 
                        max={100} 
                        step={1} 
                        value={clip.fontSize || 28} 
                        onChange={(e) => updateClipProperties(clip.id, { fontSize: parseInt(e.target.value) })}
                      />
                      <span>{clip.fontSize || 28}px</span>
                    </div>
                  </div>

                  {/* Text Color */}
                  <div className="form-group">
                    <span className="form-label">Text Color</span>
                    <div className="color-picker-wrapper">
                      <input 
                        type="color" 
                        value={clip.textColor || '#ffffff'} 
                        onChange={(e) => updateClipProperties(clip.id, { textColor: e.target.value })}
                      />
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{clip.textColor || '#ffffff'}</span>
                    </div>
                  </div>

                  {/* Background Opacity */}
                  <div className="form-group">
                    <span className="form-label">Background Opacity</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.05} 
                        value={clip.textBgOpacity !== undefined ? clip.textBgOpacity : 0.65} 
                        onChange={(e) => updateClipProperties(clip.id, { textBgOpacity: parseFloat(e.target.value) })}
                      />
                      <span>{Math.round((clip.textBgOpacity !== undefined ? clip.textBgOpacity : 0.65) * 100)}%</span>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="form-group">
                    <span className="form-label">Font Family</span>
                    <select 
                      className="form-input-text"
                      value={clip.fontFamily || 'Inter'}
                      onChange={(e) => updateClipProperties(clip.id, { fontFamily: e.target.value })}
                    >
                      <option value="Inter">Inter</option>
                      <option value="Outfit">Outfit</option>
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Adjustment Clip Note */}
              {clip.mediaType === 'adjustment' && (
                <div className="inspector-section" style={{ borderLeft: '3px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '4px', padding: '10px' }}>
                  <span className="inspector-title" style={{ color: 'var(--primary)' }}>⚡ Adjustment Layer</span>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    This layer applies all of its Color Grade and Blur effects to every track underneath it on the timeline. Adjust settings in the Effects tab below.
                  </p>
                </div>
              )}

              {/* Basic Properties */}
              <div className="inspector-section">
                <span className="inspector-title">Basic Adjustments</span>
                
                {/* Opacity (Video only) */}
                {clip.mediaType !== 'audio' && (
                  <div className="form-group">
                    <span className="form-label">Opacity</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={clip.opacity} 
                        onChange={(e) => handlePropertyChange('opacity', null, e.target.value)}
                      />
                      <span>{Math.round(clip.opacity * 100)}%</span>
                      <button 
                        className={`keyframe-indicator-btn ${isKeyframeActive('opacity') ? 'active' : ''}`}
                        onClick={() => handleToggleKeyframe('opacity', clip.opacity)}
                        title="Toggle Keyframe"
                      >
                        ◆
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio Volume (Audio & Video only) */}
                {(clip.mediaType === 'audio' || clip.mediaType === 'video') && (
                  <div className="form-group">
                    <span className="form-label">Volume</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={2.0} 
                        step={0.05} 
                        value={clip.volume} 
                        onChange={(e) => handlePropertyChange('volume', null, e.target.value)}
                      />
                      <span>{Math.round(clip.volume * 100)}%</span>
                      <button 
                        className={`keyframe-indicator-btn ${isKeyframeActive('volume') ? 'active' : ''}`}
                        onClick={() => handleToggleKeyframe('volume', clip.volume)}
                        title="Toggle Keyframe"
                      >
                        ◆
                      </button>
                    </div>
                  </div>
                )}

                {/* Speed Multiplier */}
                <div className="form-group">
                  <span className="form-label">Speed</span>
                  <div className="form-control-slider">
                    <input 
                      type="range" 
                      min={0.25} 
                      max={4.0} 
                      step={0.25} 
                      value={clip.speed} 
                      onChange={(e) => handlePropertyChange('speed', null, e.target.value)}
                    />
                    <span>{clip.speed.toFixed(2)}x</span>
                  </div>
                </div>
              </div>

              {/* Timing & Precision Trim Controls */}
              <div className="inspector-section">
                <span className="inspector-title">Timing & Trim</span>
                
                {/* Timeline Position */}
                <div className="form-group">
                  <span className="form-label">Timeline Start (s)</span>
                  <input 
                    type="number" 
                    className="form-input-text" 
                    style={{ width: '80px', padding: '3px' }}
                    step={0.1}
                    min={0}
                    value={clip.timelinePos}
                    onChange={(e) => handlePropertyChange('timelinePos', null, e.target.value)}
                  />
                </div>

                {/* In Point */}
                <div className="form-group">
                  <span className="form-label">In Point (s)</span>
                  <input 
                    type="number" 
                    className="form-input-text" 
                    style={{ width: '80px', padding: '3px' }}
                    step={0.1}
                    min={0}
                    value={clip.srcIn}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateClipProperties(clip.id, { 
                        srcIn: val, 
                        srcOut: val + clip.duration 
                      });
                    }}
                  />
                </div>

                {/* Duration */}
                <div className="form-group">
                  <span className="form-label">Duration (s)</span>
                  <input 
                    type="number" 
                    className="form-input-text" 
                    style={{ width: '80px', padding: '3px' }}
                    step={0.1}
                    min={0.1}
                    value={clip.duration}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateClipProperties(clip.id, { 
                        duration: val, 
                        srcOut: clip.srcIn + val 
                      });
                    }}
                  />
                </div>

                {/* Playhead Trim Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '5px 2px', fontSize: '0.65rem' }}
                    onClick={() => {
                      const relativeTime = playhead - clip.timelinePos;
                      if (relativeTime > 0 && relativeTime < clip.duration) {
                        const newSrcIn = clip.srcIn + relativeTime;
                        updateClipProperties(clip.id, {
                          timelinePos: playhead,
                          srcIn: newSrcIn,
                          duration: clip.duration - relativeTime,
                          srcOut: newSrcIn + (clip.duration - relativeTime)
                        });
                      } else {
                        alert("Playhead must be inside the selected clip to trim.");
                      }
                    }}
                    title="Trim left edge to playhead"
                  >
                    Trim In at Playhead
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '5px 2px', fontSize: '0.65rem' }}
                    onClick={() => {
                      const relativeTime = playhead - clip.timelinePos;
                      if (relativeTime > 0 && relativeTime < clip.duration) {
                        updateClipProperties(clip.id, {
                          duration: relativeTime,
                          srcOut: clip.srcIn + relativeTime
                        });
                      } else {
                        alert("Playhead must be inside the selected clip to trim.");
                      }
                    }}
                    title="Trim right edge to playhead"
                  >
                    Trim Out at Playhead
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', padding: '5px', fontSize: '0.7rem', borderColor: 'var(--primary)', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.05)' }}
                    onClick={() => {
                      const relativeTime = playhead - clip.timelinePos;
                      if (relativeTime > 0.1 && relativeTime < clip.duration - 0.1) {
                        splitClip(clip.id, playhead);
                      } else {
                        alert("Playhead must be inside the clip and away from boundaries to split.");
                      }
                    }}
                  >
                    ✂️ Split Clip at Playhead
                  </button>
                </div>
              </div>

              {/* Transform Adjustments (Video and Text only) */}
              {clip.mediaType !== 'audio' && (
                <div className="inspector-section">
                  <span className="inspector-title">Transforms</span>
                  
                  {/* Position X */}
                  <div className="form-group">
                    <span className="form-label">Offset X</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={-960} 
                        max={960} 
                        step={10} 
                        value={clip.transform.x} 
                        onChange={(e) => handlePropertyChange('transform', 'x', e.target.value)}
                      />
                      <span>{clip.transform.x}px</span>
                    </div>
                  </div>

                  {/* Position Y */}
                  <div className="form-group">
                    <span className="form-label">Offset Y</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={-540} 
                        max={540} 
                        step={10} 
                        value={clip.transform.y} 
                        onChange={(e) => handlePropertyChange('transform', 'y', e.target.value)}
                      />
                      <span>{clip.transform.y}px</span>
                    </div>
                  </div>

                  {/* Scale */}
                  <div className="form-group">
                    <span className="form-label">Scale</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0.1} 
                        max={4.0} 
                        step={0.05} 
                        value={clip.transform.scale} 
                        onChange={(e) => handlePropertyChange('transform', 'scale', e.target.value)}
                      />
                      <span>{Math.round(clip.transform.scale * 100)}%</span>
                      <button 
                        className={`keyframe-indicator-btn ${isKeyframeActive('scale') ? 'active' : ''}`}
                        onClick={() => handleToggleKeyframe('scale', clip.transform.scale)}
                        title="Toggle Keyframe"
                      >
                        ◆
                      </button>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="form-group">
                    <span className="form-label">Rotation</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={-180} 
                        max={180} 
                        step={5} 
                        value={clip.transform.rotation} 
                        onChange={(e) => handlePropertyChange('transform', 'rotation', e.target.value)}
                      />
                      <span>{clip.transform.rotation}°</span>
                      <button 
                        className={`keyframe-indicator-btn ${isKeyframeActive('rotation') ? 'active' : ''}`}
                        onClick={() => handleToggleKeyframe('rotation', clip.transform.rotation)}
                        title="Toggle Keyframe"
                      >
                        ◆
                      </button>
                    </div>
                  </div>

                  {/* Layout Presets for Overlay/PiP */}
                  <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    <span className="form-label" style={{ fontSize: '0.7rem', display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Overlay / PiP Presets</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('full')}>Full Screen</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('pip-tr')}>PiP Top-R</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('pip-tl')}>PiP Top-L</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('pip-br')}>PiP Btm-R</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('pip-bl')}>PiP Btm-L</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('overlay-center')}>Center Overlay</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem' }} onClick={() => applyLayoutPreset('split-left')}>Split L</button>
                      <button className="btn btn-secondary" style={{ padding: '3px', fontSize: '0.62rem', gridColumn: 'span 2' }} onClick={() => applyLayoutPreset('split-right')}>Split R</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Crop Adjustments (Video and Image only) */}
              {(clip.mediaType === 'video' || clip.mediaType === 'image') && (
                <div className="inspector-section">
                  <span className="inspector-title">Crop Borders</span>
                  
                  {/* Left Crop */}
                  <div className="form-group">
                    <span className="form-label">Crop Left</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={0.45} 
                        step={0.01} 
                        value={clip.crop.left} 
                        onChange={(e) => handlePropertyChange('crop', 'left', e.target.value)}
                      />
                      <span>{Math.round(clip.crop.left * 100)}%</span>
                    </div>
                  </div>

                  {/* Top Crop */}
                  <div className="form-group">
                    <span className="form-label">Crop Top</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={0.45} 
                        step={0.01} 
                        value={clip.crop.top} 
                        onChange={(e) => handlePropertyChange('crop', 'top', e.target.value)}
                      />
                      <span>{Math.round(clip.crop.top * 100)}%</span>
                    </div>
                  </div>

                  {/* Right Crop */}
                  <div className="form-group">
                    <span className="form-label">Crop Right</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={0.45} 
                        step={0.01} 
                        value={clip.crop.right} 
                        onChange={(e) => handlePropertyChange('crop', 'right', e.target.value)}
                      />
                      <span>{Math.round(clip.crop.right * 100)}%</span>
                    </div>
                  </div>

                  {/* Bottom Crop */}
                  <div className="form-group">
                    <span className="form-label">Crop Bottom</span>
                    <div className="form-control-slider">
                      <input 
                        type="range" 
                        min={0} 
                        max={0.45} 
                        step={0.01} 
                        value={clip.crop.bottom} 
                        onChange={(e) => handlePropertyChange('crop', 'bottom', e.target.value)}
                      />
                      <span>{Math.round(clip.crop.bottom * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Effects Stack */}
              {clip.mediaType !== 'audio' && (
                <div className="inspector-section" style={{ borderBottom: 'none' }}>
                  <div className="inspector-title">
                    <span>Effects Stack</span>
                    <div className="effect-action-buttons">
                      <button 
                        className="track-btn" 
                        onClick={() => handleAddEffect('ColorGrade')}
                        title="Add Color Grade Effect"
                      >
                        🎨
                      </button>
                      <button 
                        className="track-btn" 
                        onClick={() => handleAddEffect('Blur')}
                        title="Add Gaussian Blur Effect"
                      >
                        🌫️
                      </button>
                      <button 
                        className="track-btn" 
                        onClick={() => handleAddEffect('Vignette')}
                        title="Add Vignette Effect"
                      >
                        ⭕
                      </button>
                    </div>
                  </div>

                  <div className="effects-list">
                    {clip.effects.length === 0 ? (
                      <div style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                        No filters applied. Click icons above to add.
                      </div>
                    ) : (
                      clip.effects.map(eff => {
                        const isOpen = !!openEffects[eff.id];
                        return (
                          <div key={eff.id} className="effect-item">
                            <div 
                              className={`effect-header ${isOpen ? 'open' : ''}`}
                              onClick={() => toggleEffectOpen(eff.id)}
                            >
                              <span>{eff.type === 'ColorGrade' ? '🎨 Color Grade' : eff.type === 'Blur' ? '🌫️ Gaussian Blur' : '⭕ Vignette'}</span>
                              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                <button 
                                  className="track-btn"
                                  onClick={() => toggleEffectEnabled(clip.id, eff.id)}
                                  title="Toggle effect visibility"
                                  style={{ opacity: eff.enabled ? 1 : 0.4 }}
                                >
                                  👁️
                                </button>
                                <button 
                                  className="track-btn"
                                  onClick={() => deleteEffect(clip.id, eff.id)}
                                  title="Delete effect"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {isOpen && (
                              <div className="effect-controls-grid">
                                {eff.type === 'ColorGrade' && (
                                  <>
                                    {/* Brightness */}
                                    <div className="form-group">
                                      <span className="form-label">Brightness</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={-1.0} 
                                          max={1.0} 
                                          step={0.05} 
                                          value={eff.params.brightness} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'brightness', parseFloat(e.target.value))}
                                        />
                                        <span>{eff.params.brightness > 0 ? '+' : ''}{Math.round(eff.params.brightness * 100)}</span>
                                      </div>
                                    </div>
                                    {/* Contrast */}
                                    <div className="form-group">
                                      <span className="form-label">Contrast</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={0.1} 
                                          max={3.0} 
                                          step={0.05} 
                                          value={eff.params.contrast} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'contrast', parseFloat(e.target.value))}
                                        />
                                        <span>{Math.round(eff.params.contrast * 100)}%</span>
                                      </div>
                                    </div>
                                    {/* Saturation */}
                                    <div className="form-group">
                                      <span className="form-label">Saturation</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={0.0} 
                                          max={3.0} 
                                          step={0.05} 
                                          value={eff.params.saturation} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'saturation', parseFloat(e.target.value))}
                                        />
                                        <span>{Math.round(eff.params.saturation * 100)}%</span>
                                      </div>
                                    </div>
                                    {/* Hue rotate */}
                                    <div className="form-group">
                                      <span className="form-label">Hue Shift</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={-180} 
                                          max={180} 
                                          step={5} 
                                          value={eff.params.hue} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'hue', parseFloat(e.target.value))}
                                        />
                                        <span>{eff.params.hue}°</span>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {eff.type === 'Blur' && (
                                  <div className="form-group">
                                    <span className="form-label">Radius</span>
                                    <div className="form-control-slider">
                                      <input 
                                        type="range" 
                                        min={0} 
                                        max={50} 
                                        step={1} 
                                        value={eff.params.radius} 
                                        onChange={(e) => updateEffectParam(clip.id, eff.id, 'radius', parseInt(e.target.value))}
                                      />
                                      <span>{eff.params.radius}px</span>
                                    </div>
                                  </div>
                                )}

                                {eff.type === 'Vignette' && (
                                  <>
                                    <div className="form-group">
                                      <span className="form-label">Strength</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={0} 
                                          max={1} 
                                          step={0.05} 
                                          value={eff.params.strength} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'strength', parseFloat(e.target.value))}
                                        />
                                        <span>{Math.round(eff.params.strength * 100)}%</span>
                                      </div>
                                    </div>
                                    <div className="form-group">
                                      <span className="form-label">Radius</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={0.1} 
                                          max={1.0} 
                                          step={0.05} 
                                          value={eff.params.radius} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'radius', parseFloat(e.target.value))}
                                        />
                                        <span>{Math.round(eff.params.radius * 100)}%</span>
                                      </div>
                                    </div>
                                    <div className="form-group">
                                      <span className="form-label">Softness</span>
                                      <div className="form-control-slider">
                                        <input 
                                          type="range" 
                                          min={0.1} 
                                          max={1.0} 
                                          step={0.05} 
                                          value={eff.params.softness} 
                                          onChange={(e) => updateEffectParam(clip.id, eff.id, 'softness', parseFloat(e.target.value))}
                                        />
                                        <span>{Math.round(eff.params.softness * 100)}%</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* History tab */
          <div>
            <span className="inspector-title" style={{ fontSize: '0.85rem' }}>Undo History (Max 50)</span>
            {undoStack.length === 0 ? (
              <div style={{ padding: '20px 10px', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                No actions performed yet. Your history is empty.
              </div>
            ) : (
              <div className="history-list">
                {undoStack.map((snapshot, index) => {
                  const clipCount = snapshot.clips.length;
                  return (
                    <div 
                      key={index} 
                      className={`history-item ${index === undoStack.length - 1 ? 'active' : ''}`}
                    >
                      <span>⚡ Snapshot #{index + 1}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        ({clipCount} clip{clipCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
