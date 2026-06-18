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
    getInterpolatedValue
  } = useContext(EditorContext);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const playheadRef = useRef(playhead);
  const playingRef = useRef(playing);
  const lastTimeRef = useRef(0);
  const requestRef = useRef(null);

  // Overlays
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubBarRef = useRef(null);

  // Synchronize refs to avoid closure stale issues in animation loop
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Main rendering & tick loop
  useEffect(() => {
    const tick = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      let currentPlayhead = playheadRef.current;

      if (playingRef.current) {
        currentPlayhead += delta;

        // Loop check
        if (looping) {
          if (currentPlayhead >= loopEnd) {
            currentPlayhead = loopStart;
          }
        } else {
          // Standard end check
          if (currentPlayhead >= timelineDuration) {
            currentPlayhead = timelineDuration;
            setPlaying(false);
          }
        }

        setPlayhead(currentPlayhead);
        
        // Trigger synthesizers/audios on play
        triggerAudioTimelineTick(currentPlayhead, clipsRef.current, tracks, mediaLibrary);
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
                if (videoEl.paused) {
                  videoEl.currentTime = clipTime;
                  videoEl.play().catch(() => {});
                }
                // Check drift during playback with a wider threshold to prevent seeking stutter
                if (Math.abs(videoEl.currentTime - clipTime) > 0.4) {
                  videoEl.currentTime = clipTime;
                }
              } else {
                if (!videoEl.paused) videoEl.pause();
                // Pause scrub: only update if time changes by more than 1 frame (0.04s)
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
  }, [tracks, mediaLibrary, looping, loopStart, loopEnd, timelineDuration]);

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

  const handleStepFrame = (dir) => {
    setPlaying(false); // Pause play when stepping frame
    const step = dir === 'prev' ? -1 : 1;
    setPlayhead(prev => Math.max(0, Math.min(timelineDuration, prev + step / fps)));
  };

  return (
    <div className="main-content" ref={containerRef}>
      <div className="preview-panel" tabIndex={0}>
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
                onClick={() => { setPlaying(false); setPlayhead(0); }}
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
                onClick={() => setPlaying(!playing)}
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
                onClick={() => { setPlaying(false); setPlayhead(timelineDuration); }}
                title="Jump to End (End)"
              >
                ⏭️
              </button>
            </div>

            <div className="timecode-display">
              {formatTimecode(playhead)}
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
  );
}
