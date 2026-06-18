import React, { useContext, useRef, useEffect, useState } from 'react';
import { EditorContext } from '../context/EditorContext';
import { compositeTimelineFrame, triggerAudioTimelineTick } from '../utils/mediaRenderer';

const getActiveTapeAsset = (mediaLibrary, tapePlayhead) => {
  const tapeAssets = (mediaLibrary || []).filter(asset => asset.type === 'video' || asset.type === 'image' || asset.type === 'audio');
  const totalTapeDuration = tapeAssets.reduce((acc, asset) => acc + asset.duration, 0);
  
  let activeAsset = null;
  let relativeTime = 0;
  let accumulated = 0;
  for (const asset of tapeAssets) {
    if (tapePlayhead >= accumulated && tapePlayhead < accumulated + asset.duration) {
      activeAsset = asset;
      relativeTime = tapePlayhead - accumulated;
      break;
    }
    accumulated += asset.duration;
  }
  if (!activeAsset && tapeAssets.length > 0) {
    activeAsset = tapeAssets[tapeAssets.length - 1];
    relativeTime = activeAsset.duration;
  }
  return { activeAsset, relativeTime, totalTapeDuration, tapeAssets };
};

export default function PreviewPanel() {
  const {
    clips, clipsRef, transitionsRef, tracks, mediaLibrary,
    playhead, setPlayhead,
    playing, setPlaying,
    fps, timelineDuration,
    looping, setLooping, loopStart, loopEnd,
    getInterpolatedValue,
    
    // Source Monitor context
    sourceAsset, setSourceAsset,
    sourcePlayhead, setSourcePlayhead,
    sourceIn, setSourceIn,
    sourceOut, setSourceOut,
    sourcePlaying, setSourcePlaying,
    playbackSpeed, setPlaybackSpeed,
    insertClip, overwriteClip,

    // Cut Page: Source Tape
    sourceTapeMode, setSourceTapeMode,
    sourceTapePlayhead, setSourceTapePlayhead,

    // Cut Page: A/B Trim Editor
    abTrimEditorOpen, setAbTrimEditorOpen,
    abTrimEditPoint, setAbTrimEditPoint,
    rollEdit
  } = useContext(EditorContext);

  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const playheadRef = useRef(playhead);
  const playingRef = useRef(playing);
  const lastTimeRef = useRef(0);
  const lastTimeSourceRef = useRef(0);
  const requestRef = useRef(null);

  // Overlays
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSourceScrubbing, setIsSourceScrubbing] = useState(false);
  const scrubBarRef = useRef(null);
  const sourceScrubBarRef = useRef(null);

  const sourcePlayheadRef = useRef(sourcePlayhead);
  const sourcePlayingRef = useRef(sourcePlaying);
  const sourceAssetRef = useRef(sourceAsset);

  // Synchronize refs to avoid closure stale issues in animation loop
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    sourcePlayheadRef.current = sourcePlayhead;
  }, [sourcePlayhead]);

  useEffect(() => {
    sourcePlayingRef.current = sourcePlaying;
  }, [sourcePlaying]);

  useEffect(() => {
    sourceAssetRef.current = sourceAsset;
  }, [sourceAsset]);

  const sourceTapeModeRef = useRef(sourceTapeMode);
  const sourceTapePlayheadRef = useRef(sourceTapePlayhead);
  const mediaLibraryRef = useRef(mediaLibrary);

  useEffect(() => {
    sourceTapeModeRef.current = sourceTapeMode;
  }, [sourceTapeMode]);

  useEffect(() => {
    sourceTapePlayheadRef.current = sourceTapePlayhead;
  }, [sourceTapePlayhead]);

  useEffect(() => {
    mediaLibraryRef.current = mediaLibrary;
  }, [mediaLibrary]);

  // Main rendering & tick loop
  useEffect(() => {
    const tick = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // 1. Source Monitor Playback update
      if (sourceTapeModeRef.current) {
        const { totalTapeDuration } = getActiveTapeAsset(mediaLibraryRef.current, sourceTapePlayheadRef.current);
        let currentTapePlayhead = sourceTapePlayheadRef.current;
        if (sourcePlayingRef.current && totalTapeDuration > 0) {
          currentTapePlayhead += delta;
          if (currentTapePlayhead >= totalTapeDuration) {
            currentTapePlayhead = 0;
          }
          setSourceTapePlayhead(currentTapePlayhead);
        }

        const { activeAsset, relativeTime } = getActiveTapeAsset(mediaLibraryRef.current, currentTapePlayhead);

        // Keep normal source states synchronized behind the scenes so F9/F10 edit actions work seamlessly!
        if (activeAsset) {
          if (!sourceAssetRef.current || sourceAssetRef.current.id !== activeAsset.id) {
            setSourceAsset(activeAsset);
            setSourceIn(0);
            setSourceOut(activeAsset.duration || 5);
          }
          setSourcePlayhead(relativeTime);
        }

        // Render the active source tape asset onto the sourceCanvas
        if (sourceCanvasRef.current && totalTapeDuration > 0 && activeAsset) {
          const sCanvas = sourceCanvasRef.current;
          const sCtx = sCanvas.getContext('2d');
          const sW = sCanvas.width;
          const sH = sCanvas.height;
          sCtx.fillStyle = '#090d16';
          sCtx.fillRect(0, 0, sW, sH);

          if (activeAsset.draw) {
            activeAsset.draw(sCtx, relativeTime);
          } else if (activeAsset.element) {
            try {
              if (activeAsset.type === 'video') {
                const videoEl = activeAsset.element;
                if (sourcePlayingRef.current) {
                  if (videoEl.paused) {
                    videoEl.currentTime = relativeTime;
                    videoEl.play().catch(() => {});
                  }
                  if (Math.abs(videoEl.currentTime - relativeTime) > 0.4) {
                    videoEl.currentTime = relativeTime;
                  }
                } else {
                  if (!videoEl.paused) videoEl.pause();
                  if (Math.abs(videoEl.currentTime - relativeTime) > 0.04) {
                    videoEl.currentTime = relativeTime;
                  }
                }
                sCtx.drawImage(videoEl, 0, 0, sW, sH);
              } else if (activeAsset.type === 'image') {
                sCtx.drawImage(activeAsset.element, 0, 0, sW, sH);
              }
            } catch (err) {
              sCtx.fillStyle = '#ef4444';
              sCtx.font = '24px sans-serif';
              sCtx.fillText(`Loading: ${activeAsset.name}`, 50, sH / 2);
            }
          }
        }
      } else {
        // Normal Source Monitor Playback update
        let currentSourcePlayhead = sourcePlayheadRef.current;
        if (sourcePlayingRef.current && sourceAssetRef.current) {
          currentSourcePlayhead += delta;
          if (currentSourcePlayhead >= sourceAssetRef.current.duration) {
            currentSourcePlayhead = 0;
          }
          setSourcePlayhead(currentSourcePlayhead);
        }

        // Render the source asset onto the sourceCanvas
        if (sourceCanvasRef.current && sourceAssetRef.current) {
          const sCanvas = sourceCanvasRef.current;
          const sCtx = sCanvas.getContext('2d');
          const sW = sCanvas.width;
          const sH = sCanvas.height;
          sCtx.fillStyle = '#090d16';
          sCtx.fillRect(0, 0, sW, sH);

          const asset = sourceAssetRef.current;
          if (asset.draw) {
            asset.draw(sCtx, currentSourcePlayhead);
          } else if (asset.element) {
            try {
              if (asset.type === 'video') {
                const videoEl = asset.element;
                if (sourcePlayingRef.current) {
                  if (videoEl.paused) {
                    videoEl.currentTime = currentSourcePlayhead;
                    videoEl.play().catch(() => {});
                  }
                  if (Math.abs(videoEl.currentTime - currentSourcePlayhead) > 0.4) {
                    videoEl.currentTime = currentSourcePlayhead;
                  }
                } else {
                  if (!videoEl.paused) videoEl.pause();
                  if (Math.abs(videoEl.currentTime - currentSourcePlayhead) > 0.04) {
                    videoEl.currentTime = currentSourcePlayhead;
                  }
                }
                sCtx.drawImage(videoEl, 0, 0, sW, sH);
              } else if (asset.type === 'image') {
                sCtx.drawImage(asset.element, 0, 0, sW, sH);
              }
            } catch (err) {
              sCtx.fillStyle = '#ef4444';
              sCtx.font = '24px sans-serif';
              sCtx.fillText(`Loading: ${asset.name}`, 50, sH / 2);
            }
          }
        }
      }

      // 2. Program/Timeline playback speed support (JKL backward/forward play)
      let currentPlayhead = playheadRef.current;

      if (playingRef.current) {
        currentPlayhead += delta * playbackSpeed;

        // Loop / Bounds check
        if (playbackSpeed >= 0) {
          if (looping) {
            if (currentPlayhead >= loopEnd) {
              currentPlayhead = loopStart;
            }
          } else {
            if (currentPlayhead >= timelineDuration) {
              currentPlayhead = timelineDuration;
              setPlaying(false);
            }
          }
        } else {
          // Negative playback speed (J key reverse)
          if (currentPlayhead <= 0) {
            if (looping) {
              currentPlayhead = loopEnd;
            } else {
              currentPlayhead = 0;
              setPlaying(false);
            }
          }
        }

        setPlayhead(currentPlayhead);
        
        // Trigger synthesizers/audios on play (only if playing forward for simplicity)
        if (playbackSpeed > 0) {
          triggerAudioTimelineTick(currentPlayhead, clipsRef.current, tracks, mediaLibrary);
        }
      }

      // Sync active HTML5 videos to playhead (if any are playing on timeline)
      clipsRef.current.forEach(clip => {
        if (clip.mediaType === 'video') {
          const asset = mediaLibrary.find(m => m.id === clip.mediaId);
          if (asset && asset.element) {
            const videoEl = asset.element;
            const clipTime = (currentPlayhead - clip.timelinePos) * clip.speed + clip.srcIn;
            const isInside = currentPlayhead >= clip.timelinePos && currentPlayhead < clip.timelinePos + clip.duration;

            if (isInside) {
              if (playingRef.current) {
                if (playbackSpeed > 0) {
                  if (videoEl.paused) {
                    videoEl.currentTime = clipTime;
                    videoEl.play().catch(() => {});
                  }
                  videoEl.playbackRate = playbackSpeed; // speed multiplier
                  if (Math.abs(videoEl.currentTime - clipTime) > 0.4) {
                    videoEl.currentTime = clipTime;
                  }
                } else {
                  // Reverse scrubbing/playback
                  if (!videoEl.paused) videoEl.pause();
                  videoEl.currentTime = clipTime;
                }
              } else {
                if (!videoEl.paused) videoEl.pause();
                videoEl.playbackRate = 1.0;
                if (Math.abs(videoEl.currentTime - clipTime) > 0.04) {
                  videoEl.currentTime = clipTime;
                }
              }
            } else {
              if (!videoEl.paused) videoEl.pause();
            }
          }
        }
      });

      // Composite current frame to Canvas
      if (canvasRef.current) {
        compositeTimelineFrame({
          displayCanvas: canvasRef.current,
          playheadTime: currentPlayhead,
          clips: clipsRef.current,
          transitions: transitionsRef.current,
          tracks,
          mediaLibrary,
          getInterpolatedValue
        });
      }

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [tracks, mediaLibrary, looping, loopStart, loopEnd, timelineDuration, playbackSpeed]);

  // Formatter for timecode: HH:MM:SS:FF
  const formatTimecode = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * fps);

    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
      frames.toString().padStart(2, '0')
    ].join(':');
  };

  const handleScrubMouseDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    setPlaying(false); // Pause playing on manual drag scrub
    updateScrubFromX(e.clientX);
  };

  const updateScrubFromX = (clientX) => {
    if (!scrubBarRef.current) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    setPlayhead(percentage * timelineDuration);
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      updateScrubFromX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, timelineDuration]);

  // Source Monitor mouse handlers
  const handleSourceScrubMouseDown = (e) => {
    e.preventDefault();
    setIsSourceScrubbing(true);
    setSourcePlaying(false);
    updateSourceScrubFromX(e.clientX);
  };

  const updateSourceScrubFromX = (clientX) => {
    if (!sourceScrubBarRef.current) return;
    if (sourceTapeMode) {
      const tapeAssets = mediaLibrary.filter(asset => asset.type === 'video' || asset.type === 'image' || asset.type === 'audio');
      const totalTapeDuration = tapeAssets.reduce((acc, asset) => acc + asset.duration, 0);
      if (totalTapeDuration <= 0) return;
      const rect = sourceScrubBarRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      setSourceTapePlayhead(percentage * totalTapeDuration);
    } else {
      if (!sourceAsset) return;
      const rect = sourceScrubBarRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      setSourcePlayhead(percentage * sourceAsset.duration);
    }
  };

  useEffect(() => {
    if (!isSourceScrubbing) return;

    const handleMouseMove = (e) => {
      updateSourceScrubFromX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsSourceScrubbing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSourceScrubbing, sourceAsset, sourceTapeMode, mediaLibrary]);

  const handleStepFrame = (dir) => {
    setPlaying(false); // Pause play when stepping frame
    const frameTime = 1 / fps;
    if (dir === 'next') {
      setPlayhead(Math.min(timelineDuration, playhead + frameTime));
    } else {
      setPlayhead(Math.max(0, playhead - frameTime));
    }
  };

  // Source Tape Mode Calculations
  const tapeAssets = (mediaLibrary || []).filter(asset => asset.type === 'video' || asset.type === 'image' || asset.type === 'audio');
  const totalTapeDuration = tapeAssets.reduce((acc, asset) => acc + asset.duration, 0);

  const { activeAsset } = getActiveTapeAsset(mediaLibrary, sourceTapePlayhead);
  const activeAssetIndex = activeAsset ? tapeAssets.indexOf(activeAsset) : -1;
  const activeAssetOffset = activeAssetIndex >= 0
    ? tapeAssets.slice(0, activeAssetIndex).reduce((acc, a) => acc + a.duration, 0)
    : 0;

  const currentSourceAsset = sourceTapeMode ? activeAsset : sourceAsset;
  const currentSourceDur = sourceTapeMode ? totalTapeDuration : (sourceAsset?.duration || 5);
  const currentSourcePos = sourceTapeMode ? sourceTapePlayhead : sourcePlayhead;

  const inPercent = sourceTapeMode 
    ? ((activeAssetOffset + sourceIn) / (totalTapeDuration || 1)) * 100 
    : (sourceIn / (sourceAsset?.duration || 5)) * 100;
  const outPercent = sourceTapeMode
    ? ((activeAssetOffset + sourceOut) / (totalTapeDuration || 1)) * 100
    : (sourceOut / (sourceAsset?.duration || 5)) * 100;
  const highlightWidth = outPercent - inPercent;

  return (
    <div className="main-content" ref={containerRef}>
      <div className={`preview-panel-container ${(sourceAsset || sourceTapeMode) ? 'dual' : ''}`}>
        
        {/* Source Monitor (Left side, only renders when an asset is loaded or source tape mode is active) */}
        {(sourceAsset || sourceTapeMode) && (
          <div className="monitor-pane source">
            <div className="monitor-titlebar">
              <span className="monitor-title">🎬 Source Monitor &mdash; {sourceTapeMode ? 'Concatenated Source Tape' : (sourceAsset?.name || '')}</span>
              <button 
                className="close-monitor-btn" 
                onClick={() => { setSourceAsset(null); setSourceTapeMode(false); }}
                title="Close Source Monitor"
              >
                ✖
              </button>
            </div>
            
            <div className="viewport-container">
              <canvas 
                ref={sourceCanvasRef} 
                className="viewport-canvas" 
                width={1920} 
                height={1080}
              />
            </div>

            <div className="player-controls">
              {/* Source scrub bar with Mark In/Out overlays */}
              <div className="playback-scrub-container">
                <span className="playback-time">{formatTimecode(currentSourcePos)}</span>
                <div 
                  className="scrub-bar" 
                  ref={sourceScrubBarRef} 
                  onMouseDown={handleSourceScrubMouseDown}
                >
                  {/* Highlighted In/Out segment */}
                  {currentSourceAsset && (
                    <div 
                      className="source-inout-highlight"
                      style={{
                        left: `${inPercent}%`,
                        width: `${highlightWidth}%`
                      }}
                    />
                  )}
                  <div 
                    className="scrub-progress source-color" 
                    style={{ width: `${(currentSourcePos / (currentSourceDur || 1)) * 100}%` }}
                  >
                    <div className="scrub-handle" />
                  </div>
                </div>
                <span className="playback-time">{formatTimecode(currentSourceDur)}</span>
              </div>

              {/* Source controls button row */}
              <div className="player-buttons-row">
                <div className="player-buttons">
                  <button 
                    className="btn btn-secondary btn-sm text-btn" 
                    onClick={() => setSourceIn(sourcePlayhead)}
                    title="Mark In Point ([)"
                  >
                    [ Mark In
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
                    onClick={() => setSourcePlaying(!sourcePlaying)}
                    title="Source Play/Pause"
                  >
                    {sourcePlaying ? '⏸️' : '▶️'}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm text-btn" 
                    onClick={() => setSourceOut(Math.max(sourcePlayhead, sourceIn + 0.1))}
                    title="Mark Out Point (])"
                  >
                    Mark Out ]
                  </button>
                </div>
                <div className="source-inout-readout">
                  {currentSourceAsset ? (
                    <>Active: {currentSourceAsset.name} | In: {sourceIn.toFixed(1)}s | Out: {sourceOut.toFixed(1)}s</>
                  ) : (
                    <>No active source media</>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3-Point Edit Button overlay divider if source monitor is active */}
        {(sourceAsset || (sourceTapeMode && currentSourceAsset)) && (
          <div className="monitor-divider-tools">
            <button 
              className="btn btn-primary edit-action-btn ripple" 
              onClick={insertClip} 
              title="Insert Subclip into active track with Ripple (F9)"
            >
              📥 Insert (F9)
            </button>
            <button 
              className="btn btn-secondary edit-action-btn overwrite" 
              onClick={overwriteClip} 
              title="Overwrite Subclip onto active track (F10)"
            >
              ✍️ Overwrite (F10)
            </button>
          </div>
        )}

        {/* Program Monitor (Right side in dual view, full screen in single view) */}
        <div className="monitor-pane program">
          {sourceAsset && (
            <div className="monitor-titlebar">
              <span className="monitor-title">📺 Program Monitor &mdash; Timeline</span>
            </div>
          )}
          
          <div className="viewport-container">
            <canvas 
              ref={canvasRef} 
              className="viewport-canvas" 
              width={1920} 
              height={1080}
            />
            {showSafeZones && <div className="safe-zone-overlay" />}

            {/* A/B Trim Editor Overlay */}
            {abTrimEditorOpen && abTrimEditPoint && (() => {
              const clipA = clips.find(c => c.id === abTrimEditPoint.clipAId);
              const clipB = clips.find(c => c.id === abTrimEditPoint.clipBId);
              if (!clipA || !clipB) return null;

              const editBoundary = clipA.timelinePos + clipA.duration;
              const nudge = (frames) => {
                const delta = frames / fps;
                const newBoundary = editBoundary + delta;
                rollEdit(clipA.id, clipB.id, newBoundary);
              };

              // Generate filmstrip frames (simulate 5 frames around the edit point)
              const generateFrameLabels = (clip, side) => {
                const frames = [];
                const edgeTime = side === 'A' ? clip.srcOut : clip.srcIn;
                for (let i = -2; i <= 2; i++) {
                  const frameTime = edgeTime + (i / fps);
                  frames.push({
                    label: `${(frameTime * fps).toFixed(0)}f`,
                    offset: i,
                    isEdge: i === 0
                  });
                }
                return frames;
              };

              return (
                <div className="ab-trim-editor">
                  <div className="ab-trim-header">
                    <span>A/B Trim Editor</span>
                    <button className="ab-trim-close" onClick={() => setAbTrimEditorOpen(false)}>✕</button>
                  </div>
                  <div className="ab-trim-body">
                    {/* Clip A (outgoing) filmstrip */}
                    <div className="filmstrip-row clip-a">
                      <span className="filmstrip-label">A: {clipA.name}</span>
                      <div className="filmstrip-frames">
                        {generateFrameLabels(clipA, 'A').map((f, i) => (
                          <div key={i} className={`filmstrip-frame ${f.isEdge ? 'edge' : ''}`}>
                            <div className="frame-thumb" />
                            <span className="frame-label">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Edit point indicator */}
                    <div className="ab-trim-divider">
                      <div className="trim-point-line" />
                      <span className="trim-point-time">{editBoundary.toFixed(2)}s</span>
                    </div>
                    {/* Clip B (incoming) filmstrip */}
                    <div className="filmstrip-row clip-b">
                      <span className="filmstrip-label">B: {clipB.name}</span>
                      <div className="filmstrip-frames">
                        {generateFrameLabels(clipB, 'B').map((f, i) => (
                          <div key={i} className={`filmstrip-frame ${f.isEdge ? 'edge' : ''}`}>
                            <div className="frame-thumb" />
                            <span className="frame-label">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Nudge controls */}
                  <div className="ab-trim-nudge">
                    <button className="nudge-btn" onClick={() => nudge(-5)} title="-5 frames">◀◀ -5</button>
                    <button className="nudge-btn" onClick={() => nudge(-1)} title="-1 frame">◀ -1</button>
                    <span className="nudge-label">Nudge</span>
                    <button className="nudge-btn" onClick={() => nudge(1)} title="+1 frame">+1 ▶</button>
                    <button className="nudge-btn" onClick={() => nudge(5)} title="+5 frames">+5 ▶▶</button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="player-controls">
            {/* Timeline scrub bar */}
            <div className="playback-scrub-container">
              <span className="playback-time">{formatTimecode(playhead)}</span>
              <div className="scrub-bar" ref={scrubBarRef} onMouseDown={handleScrubMouseDown}>
                <div 
                  className="scrub-progress" 
                  style={{ width: `${(playhead / timelineDuration) * 100}%` }}
                >
                  <div className="scrub-handle" />
                </div>
              </div>
              <span className="playback-time">{formatTimecode(timelineDuration)}</span>
            </div>

            {/* Button Row */}
            <div className="player-buttons-row">
              <div className="player-buttons">
                <button 
                  className={`btn-icon ${looping ? 'active' : ''}`}
                  onClick={() => setLooping(!looping)}
                  title="Toggle Loop"
                >
                  🔁
                </button>
                <button 
                  className="btn-icon" 
                  onClick={() => { setPlaying(false); setPlayhead(0); setPlaybackSpeed(1.0); }}
                  title="Jump to Start (Home)"
                >
                  ⏮️
                </button>
                <button 
                  className="btn-icon" 
                  onClick={() => handleStepFrame('prev')}
                  title="Previous Frame (Left Arrow)"
                >
                  ◀️
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0 }}
                  onClick={() => {
                    setPlaying(!playing);
                    setPlaybackSpeed(1.0);
                  }}
                  title="Play/Pause (Space)"
                >
                  {playing ? '⏸️' : '▶️'}
                </button>
                <button 
                  className="btn-icon" 
                  onClick={() => handleStepFrame('next')}
                  title="Next Frame (Right Arrow)"
                >
                  ▶️
                </button>
                <button 
                  className="btn-icon" 
                  onClick={() => { setPlaying(false); setPlayhead(timelineDuration); setPlaybackSpeed(1.0); }}
                  title="Jump to End (End)"
                >
                  ⏭️
                </button>
              </div>

              <div className="timecode-display">
                {formatTimecode(playhead)}
                {playbackSpeed !== 1.0 && playing && (
                  <span className="playback-speed-badge">
                    {playbackSpeed > 0 ? `${playbackSpeed}x` : `${playbackSpeed}x`}
                  </span>
                )}
              </div>

              <div className="volume-controls">
                <button 
                  className="btn-icon" 
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? '🔇' : '🔊'}
                </button>
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.05} 
                  className="volume-slider"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                />
                <button 
                  className={`btn-icon ${showSafeZones ? 'active' : ''}`}
                  onClick={() => setShowSafeZones(!showSafeZones)}
                  title="Toggle Safe Zone Guide"
                >
                  🎯
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
