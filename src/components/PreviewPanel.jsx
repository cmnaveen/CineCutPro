import React, { useContext, useRef, useEffect, useState } from 'react';
import { EditorContext } from '../context/EditorContext';
import { compositeTimelineFrame, triggerAudioTimelineTick } from '../utils/mediaRenderer';

export default function PreviewPanel() {
  const {
    clips, clipsRef, tracks, mediaLibrary,
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
    insertClip, overwriteClip
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

  // Main rendering & tick loop
  useEffect(() => {
    const tick = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // 1. Source Monitor Playback update
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
    if (!sourceScrubBarRef.current || !sourceAsset) return;
    const rect = sourceScrubBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    setSourcePlayhead(percentage * sourceAsset.duration);
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
  }, [isSourceScrubbing, sourceAsset]);

  const handleStepFrame = (dir) => {
    setPlaying(false); // Pause play when stepping frame
    const step = dir === 'prev' ? -1 : 1;
    setPlayhead(prev => Math.max(0, Math.min(timelineDuration, prev + step / fps)));
  };

  return (
    <div className="main-content" ref={containerRef}>
      <div className={`preview-panel-container ${sourceAsset ? 'dual' : ''}`}>
        
        {/* Source Monitor (Left side, only renders when an asset is loaded) */}
        {sourceAsset && (
          <div className="monitor-pane source">
            <div className="monitor-titlebar">
              <span className="monitor-title">🎬 Source Monitor &mdash; {sourceAsset.name}</span>
              <button 
                className="close-monitor-btn" 
                onClick={() => setSourceAsset(null)}
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
                <span className="playback-time">{formatTimecode(sourcePlayhead)}</span>
                <div 
                  className="scrub-bar" 
                  ref={sourceScrubBarRef} 
                  onMouseDown={handleSourceScrubMouseDown}
                >
                  {/* Highlighted In/Out segment */}
                  <div 
                    className="source-inout-highlight"
                    style={{
                      left: `${(sourceIn / sourceAsset.duration) * 100}%`,
                      width: `${((sourceOut - sourceIn) / sourceAsset.duration) * 100}%`
                    }}
                  />
                  <div 
                    className="scrub-progress source-color" 
                    style={{ width: `${(sourcePlayhead / sourceAsset.duration) * 100}%` }}
                  >
                    <div className="scrub-handle" />
                  </div>
                </div>
                <span className="playback-time">{formatTimecode(sourceAsset.duration)}</span>
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
                  In: {sourceIn.toFixed(1)}s | Out: {sourceOut.toFixed(1)}s
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3-Point Edit Button overlay divider if sourceAsset is open */}
        {sourceAsset && (
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
