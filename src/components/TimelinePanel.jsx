import React, { useContext, useRef, useState, useEffect } from 'react';
import { EditorContext } from '../context/EditorContext';

export default function TimelinePanel() {
  const {
    tracks, setTrackProperty,
    clips, setClips, addClip, addTextClip, moveClip, trimClip, splitClip, deleteClip, duplicateClip,
    selectedClipId, setSelectedClipId,
    selectedTrackId, setSelectedTrackId,
    playhead, setPlayhead,
    playing, setPlaying,
    zoom, setZoom,
    snapping, setSnapping,
    tool, setTool,
    timelineDuration,
    looping, loopStart, loopEnd,
    rippleTrim, rollEdit, slipClip, slideClip, addSubtitleClip,
    // Cut Page features
    smartInsert, appendAtEnd, placeOnTop, rippleOverwrite, sourceOverwrite, closeUpEdit,
    transitions, addTransition,
    analysisHighlights, analyzeBoringShots, clearAnalysis,
    boringThreshold, setBoringThreshold, jumpCutThreshold, setJumpCutThreshold,
    boringDetectorOpen, setBoringDetectorOpen,
    abTrimEditorOpen, setAbTrimEditorOpen, abTrimEditPoint, setAbTrimEditPoint,
    fps
  } = useContext(EditorContext);

  const scrollContainerRef = useRef(null);
  const trackBodyRef = useRef(null);

  // Drag states
  const [dragState, setDragState] = useState(null); // { type: 'move'|'trim-left'|'trim-right', clipId, startX, startPos, startTrackId, startDuration, startSrcIn }

  // Convert timeline seconds to pixels
  const secToPx = (sec) => sec * zoom;
  // Convert pixels to timeline seconds
  const pxToSec = (px) => px / zoom;

  // Handle ruler scrubbing drag state
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleRulerMouseDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    setPlaying(false); // Pause playback on manual drag scrub
    updatePlayheadFromX(e.clientX);
  };

  const updatePlayheadFromX = (clientX) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const relativeX = clientX - rect.left + scrollLeft - 140; // subtract track header width
    const targetTime = Math.max(0, pxToSec(relativeX));
    setPlayhead(Math.min(timelineDuration, targetTime));
  };

  const updatePlayheadFromOverviewX = (clientX) => {
    const bodyEl = document.querySelector('.timeline-overview-body');
    if (!bodyEl) return;
    const bodyRect = bodyEl.getBoundingClientRect();
    const clickX = clientX - bodyRect.left;
    const percentage = Math.max(0, Math.min(1, clickX / (bodyRect.width || 1)));
    const newPlayhead = percentage * timelineDuration;
    setPlayhead(newPlayhead);
    
    // Auto-scroll the main timeline container to keep playhead visible/centered
    if (scrollContainerRef.current) {
      const scrollPos = secToPx(newPlayhead) + 140 - scrollContainerRef.current.clientWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  };

  const handleOverviewMouseDown = (e) => {
    e.preventDefault();
    updatePlayheadFromOverviewX(e.clientX);
    
    const handleMouseMove = (moveEvent) => {
      updatePlayheadFromOverviewX(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      updatePlayheadFromX(e.clientX);
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
  }, [isScrubbing, zoom, timelineDuration]);

  // Generate ticks for Ruler (every 1s, major tick every 5s)
  const renderRulerTicks = () => {
    const ticks = [];
    const ticksCount = Math.ceil(timelineDuration) + 5;
    for (let i = 0; i <= ticksCount; i++) {
      const x = secToPx(i);
      const isMajor = i % 5 === 0;
      ticks.push(
        <div 
          key={i} 
          className={`timeline-ruler-tick ${isMajor ? 'major' : ''}`}
          style={{ left: `${x}px` }}
        >
          {isMajor && (
            <span className="timeline-ruler-timecode">
              {i}s
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  // Handle Drag Start
  const handleClipMouseDown = (e, clip, actionType) => {
    e.stopPropagation();
    if (tool === 'blade') {
      // Split clip immediately
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const splitTime = clip.timelinePos + pxToSec(clickX);
      splitClip(clip.id, splitTime);
      return;
    }

    setSelectedClipId(clip.id);
    setSelectedTrackId(clip.trackId);

    // Context-sensitive Smart Trim tool logic
    if (tool === 'trim') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      
      const isLeftEdge = pct < 0.15;
      const isRightEdge = pct > 0.85;

      if (isLeftEdge) {
        // Roll edit check (preceding clip adjacent)
        const preceding = clips.find(c => c.trackId === clip.trackId && Math.abs((c.timelinePos + c.duration) - clip.timelinePos) < 0.15);
        if (preceding) {
          setDragState({
            type: 'roll',
            clipIdA: preceding.id,
            clipIdB: clip.id,
            startX: e.clientX,
            startPos: clip.timelinePos
          });
        } else {
          // Ripple Trim Left
          setDragState({
            type: 'ripple-trim-left',
            clipId: clip.id,
            startX: e.clientX,
            startPos: clip.timelinePos,
            startDuration: clip.duration,
            startSrcIn: clip.srcIn
          });
        }
      } else if (isRightEdge) {
        // Roll edit check (succeeding clip adjacent)
        const succeeding = clips.find(c => c.trackId === clip.trackId && Math.abs(c.timelinePos - (clip.timelinePos + clip.duration)) < 0.15);
        if (succeeding) {
          setDragState({
            type: 'roll',
            clipIdA: clip.id,
            clipIdB: succeeding.id,
            startX: e.clientX,
            startPos: clip.timelinePos + clip.duration
          });
        } else {
          // Ripple Trim Right
          setDragState({
            type: 'ripple-trim-right',
            clipId: clip.id,
            startX: e.clientX,
            startPos: clip.timelinePos,
            startDuration: clip.duration,
            startSrcIn: clip.srcIn
          });
        }
      } else {
        // Drag center body: Alt=Slide, default=Slip
        if (e.altKey) {
          setDragState({
            type: 'slide',
            clipId: clip.id,
            startX: e.clientX,
            startPos: clip.timelinePos
          });
        } else {
          setDragState({
            type: 'slip',
            clipId: clip.id,
            startX: e.clientX,
            startPos: clip.timelinePos,
            startSrcIn: clip.srcIn
          });
        }
      }
      return;
    }

    setDragState({
      type: actionType, // 'move' | 'trim-left' | 'trim-right'
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      startPos: clip.timelinePos,
      startTrackId: clip.trackId,
      startDuration: clip.duration,
      startSrcIn: clip.srcIn
    });
  };

  // Handle Drag Move & End
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaSec = pxToSec(deltaX);

      if (dragState.type === 'move') {
        const newPos = Math.max(0, dragState.startPos + deltaSec);
        
        // Vertical track detection based on mouse Y coordinates
        let targetTrackId = dragState.startTrackId;
        const timelineTracksEl = document.querySelectorAll('.timeline-track');
        timelineTracksEl.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const trackId = el.getAttribute('data-track-id');
            const activeClip = clips.find(c => c.id === dragState.clipId);
            const targetTrack = tracks.find(t => t.id === trackId);
            if (activeClip && targetTrack) {
              if (activeClip.mediaType === 'audio' && targetTrack.type === 'audio') {
                targetTrackId = trackId;
              } else if (activeClip.mediaType !== 'audio' && targetTrack.type !== 'audio') {
                targetTrackId = trackId;
              }
            }
          }
        });

        moveClip(dragState.clipId, newPos, targetTrackId);
      } else if (dragState.type === 'trim-left') {
        const newTime = dragState.startPos + deltaSec;
        trimClip(dragState.clipId, 'left', newTime);
      } else if (dragState.type === 'trim-right') {
        const newTime = dragState.startPos + dragState.startDuration + deltaSec;
        trimClip(dragState.clipId, 'right', newTime);
      } else if (dragState.type === 'ripple-trim-left') {
        const newTime = dragState.startPos + deltaSec;
        rippleTrim(dragState.clipId, 'left', newTime);
      } else if (dragState.type === 'ripple-trim-right') {
        const newTime = dragState.startPos + dragState.startDuration + deltaSec;
        rippleTrim(dragState.clipId, 'right', newTime);
      } else if (dragState.type === 'roll') {
        const newTime = dragState.startPos + deltaSec;
        rollEdit(dragState.clipIdA, dragState.clipIdB, newTime);
      } else if (dragState.type === 'slip') {
        slipClip(dragState.clipId, deltaSec);
      } else if (dragState.type === 'slide') {
        slideClip(dragState.clipId, deltaSec);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, clips, tracks, zoom, moveClip, trimClip, rippleTrim, rollEdit, slipClip, slideClip]);

  // Drop from Media Library to Timeline Track
  const handleTimelineDrop = (e, trackId) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      
      const asset = JSON.parse(dataStr);
      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const scrollLeft = scrollContainerRef.current ? scrollContainerRef.current.scrollLeft : 0;
      const timelineX = dropX + scrollLeft - 140; // subtract track header width
      
      const dropTime = Math.max(0, pxToSec(timelineX));
      addClip(trackId, asset, dropTime);
    } catch (err) {
      console.error("Failed to parse drop clip", err);
    }
  };

  const handleClearTimeline = () => {
    if (window.confirm("Clear all clips on the timeline?")) {
      setClips([]);
      setSelectedClipId(null);
    }
  };

  return (
    <div className="timeline-container">
      {/* Toolbar */}
      <div className="timeline-toolbar">
        <div className="timeline-tools">
          <button 
            className={`btn-icon ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            title="Select Tool (V)"
          >
            🖱️
          </button>
          <button 
            className={`btn-icon ${tool === 'blade' ? 'active' : ''}`}
            onClick={() => setTool('blade')}
            title="Blade Split Tool (B)"
          >
            ✂️
          </button>
          <button 
            className={`btn-icon ${tool === 'trim' ? 'active' : ''}`}
            onClick={() => setTool('trim')}
            title="Smart Trim Tool (T) - Drag edge for Ripple Trim, boundary for Roll Edit, body to Slip (Alt: Slide)"
          >
            📐
          </button>
          <button 
            className={`btn-icon ${snapping ? 'active snapping-active' : ''}`}
            onClick={() => setSnapping(!snapping)}
            title="Toggle Magnetic Snap (S)"
          >
            🧲
          </button>
          
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

          <button 
            className="btn-icon" 
            onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            style={{ opacity: selectedClipId ? 1 : 0.4 }}
            title="Duplicate Clip (Ctrl+D)"
          >
            📋
          </button>
          <button 
            className="btn-icon" 
            onClick={() => selectedClipId && deleteClip(selectedClipId)}
            disabled={!selectedClipId}
            style={{ opacity: selectedClipId ? 1 : 0.4 }}
            title="Delete Selected Clip (Del)"
          >
            🗑️
          </button>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />
          
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--primary)', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.1)' }} 
            onClick={() => addTextClip(playhead)}
            title="Add Title Text Overlay at Playhead"
          >
            ➕ Add Title
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--primary)', color: '#fed7aa', background: 'rgba(249, 115, 22, 0.1)', marginLeft: '6px' }} 
            onClick={() => addSubtitleClip(playhead)}
            title="Add Subtitle Caption at Playhead"
          >
            💬 Add Subtitle
          </button>

          <button 
            className="btn-danger btn" 
            style={{ padding: '4px 10px', fontSize: '0.75rem', marginLeft: '6px' }} 
            onClick={handleClearTimeline}
          >
            Clear Timeline
          </button>
        </div>

        {/* Smart Edit Toolbar - Cut Page */}
        <div className="smart-edit-toolbar">
          <span className="smart-edit-label">CUT</span>
          <button className="smart-edit-btn" onClick={smartInsert} title="Smart Insert (W) — Insert at nearest edit point, ripple">
            <span className="btn-icon">⤵</span>Smart Insert
          </button>
          <button className="smart-edit-btn" onClick={appendAtEnd} title="Append at End (E) — Add to timeline tail">
            <span className="btn-icon">⏭</span>Append
          </button>
          <button className="smart-edit-btn" onClick={placeOnTop} title="Place on Top (Q) — Drop on upper track at playhead">
            <span className="btn-icon">⬆</span>On Top
          </button>
          <button className="smart-edit-btn" onClick={rippleOverwrite} title="Ripple Overwrite — Replace clip, ripple if duration differs">
            <span className="btn-icon">🔄</span>Ripple OW
          </button>
          <button className="smart-edit-btn" onClick={sourceOverwrite} title="Source Overwrite — Sync cutaway on track above">
            <span className="btn-icon">🎬</span>Src OW
          </button>
          <button className="smart-edit-btn" onClick={closeUpEdit} title="Close Up — 2× zoom crop on selected clip">
            <span className="btn-icon">🔍</span>Close Up
          </button>
          <div className="smart-edit-separator" />
          <button 
            className={`smart-edit-btn detector-btn ${boringDetectorOpen ? 'active' : ''}`}
            onClick={() => setBoringDetectorOpen(!boringDetectorOpen)} 
            title="Boring Shot / Jump Cut Detector"
          >
            <span className="btn-icon">📊</span>Detect
          </button>
        </div>

        {/* Boring Detector Modal */}
        {boringDetectorOpen && (
          <div className="boring-detector-modal">
            <div className="boring-detector-header">
              <span>🔍 Shot Analyzer</span>
              <button className="boring-detector-close" onClick={() => setBoringDetectorOpen(false)}>✕</button>
            </div>
            <div className="boring-detector-row">
              <label>Max duration (boring): <strong>{boringThreshold}s</strong></label>
              <input type="range" min={2} max={30} value={boringThreshold} onChange={e => setBoringThreshold(Number(e.target.value))} />
            </div>
            <div className="boring-detector-row">
              <label>Min frames (jump cut): <strong>{jumpCutThreshold}</strong></label>
              <input type="range" min={1} max={30} value={jumpCutThreshold} onChange={e => setJumpCutThreshold(Number(e.target.value))} />
            </div>
            <div className="boring-detector-actions">
              <button className="btn btn-primary" onClick={analyzeBoringShots}>Analyze</button>
              <button className="btn btn-secondary" onClick={clearAnalysis}>Clear</button>
            </div>
          </div>
        )}

        {/* Zoom slider */}
        <div className="timeline-scale-slider">
          <span>Zoom:</span>
          <input 
            type="range" 
            min={10} 
            max={150} 
            value={zoom} 
            onChange={(e) => setZoom(parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* === DUAL TIMELINE: Upper Overview Minimap === */}
      <div className="timeline-overview">
        <div className="timeline-overview-label">OVERVIEW</div>
        <div 
          className="timeline-overview-body"
          onMouseDown={handleOverviewMouseDown}
        >
          {/* Render all clips as proportional rectangles */}
          {clips.map(clip => {
            const totalDur = Math.max(timelineDuration, 1);
            const trackIdx = tracks.findIndex(t => t.id === clip.trackId);
            const leftPct = (clip.timelinePos / totalDur) * 100;
            const widthPct = (clip.duration / totalDur) * 100;
            const topPx = trackIdx * 6;
            const highlight = analysisHighlights.find(h => h.clipId === clip.id);
            let overviewClass = `overview-clip ${clip.mediaType}`;
            if (highlight) overviewClass += highlight.type === 'boring' ? ' boring-highlight' : ' jumpcut-highlight';
            return (
              <div
                key={clip.id}
                className={overviewClass}
                style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.3)}%`, top: `${topPx}px` }}
                onClick={() => {
                  setPlayhead(clip.timelinePos);
                  setSelectedClipId(clip.id);
                }}
              />
            );
          })}
          {/* Playhead indicator */}
          <div className="overview-playhead" style={{ left: `${(playhead / Math.max(timelineDuration, 1)) * 100}%` }} />
          {/* Viewport window showing visible range */}
          {scrollContainerRef.current && (
            <div className="overview-viewport" style={{
              left: `${((scrollContainerRef.current.scrollLeft / (secToPx(timelineDuration) + 140)) * 100)}%`,
              width: `${((scrollContainerRef.current.clientWidth / (secToPx(timelineDuration) + 140)) * 100)}%`
            }} />
          )}
        </div>
      </div>

      {/* Main Scroll Window */}
      <div className="timeline-scroll-area" ref={scrollContainerRef}>
        {/* Ruler */}
        <div 
          className="timeline-ruler" 
          onMouseDown={handleRulerMouseDown}
          style={{ width: `${secToPx(timelineDuration) + 140}px`, paddingLeft: '140px' }}
        >
          <div style={{ position: 'relative', height: '100%' }}>
            {renderRulerTicks()}
          </div>
        </div>

        {/* Tracks Body */}
        <div 
          className="timeline-tracks" 
          ref={trackBodyRef}
          style={{ width: `${secToPx(timelineDuration) + 140}px` }}
        >
          {/* Playhead line */}
          <div 
            className="timeline-playhead" 
            style={{ left: `${secToPx(playhead) + 140}px` }}
          >
            <div className="timeline-playhead-cap" />
          </div>

          {/* Loop Region */}
          {looping && (
            <div 
              className="timeline-loop-region"
              style={{ 
                left: `${secToPx(loopStart) + 140}px`, 
                width: `${secToPx(loopEnd - loopStart)}px` 
              }}
            />
          )}

          {/* Tracks list */}
          {tracks.map(track => {
            const trackClips = clips.filter(c => c.trackId === track.id);
            return (
              <div 
                key={track.id} 
                className="timeline-track"
                data-track-id={track.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleTimelineDrop(e, track.id)}
              >
                {/* Track header */}
                <div className="timeline-track-header">
                  <div className="track-name-row">
                    <span className="track-title">{track.name}</span>
                  </div>
                  <div className="track-controls">
                    <button 
                      className={`track-btn muted ${track.muted ? 'active' : ''}`}
                      onClick={() => setTrackProperty(track.id, 'muted', !track.muted)}
                      title="Mute Track"
                    >
                      M
                    </button>
                    <button 
                      className={`track-btn solo ${track.solo ? 'active' : ''}`}
                      onClick={() => setTrackProperty(track.id, 'solo', !track.solo)}
                      title="Solo Track"
                    >
                      S
                    </button>
                    <button 
                      className={`track-btn lock ${track.locked ? 'active' : ''}`}
                      onClick={() => setTrackProperty(track.id, 'locked', !track.locked)}
                      title="Lock Track"
                    >
                      L
                    </button>
                  </div>
                </div>

                {/* Track Clips Body */}
                <div className="timeline-track-body">
                  {trackClips.map(clip => {
                    const left = secToPx(clip.timelinePos);
                    const width = secToPx(clip.duration);
                    const isSelected = selectedClipId === clip.id;
                    const highlight = analysisHighlights.find(h => h.clipId === clip.id);
                    const transitionAtEnd = transitions.find(t => t.clipAId === clip.id);

                    // Gather unique keyframe times to render them as diamonds
                    const kfTimes = [];
                    if (clip.keyframes) {
                      Object.keys(clip.keyframes).forEach(prop => {
                        const curve = clip.keyframes[prop] || [];
                        curve.forEach(kf => {
                          if (!kfTimes.includes(kf.time)) {
                            kfTimes.push(kf.time);
                          }
                        });
                      });
                    }

                    return (
                      <div
                        key={clip.id}
                        className={`timeline-clip ${clip.mediaType} ${isSelected ? 'selected' : ''} ${highlight ? (highlight.type === 'boring' ? 'clip-boring-highlight' : 'clip-jumpcut-highlight') : ''}`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, 'move')}
                        onDoubleClick={() => {
                          // Double-click on edit point opens A/B trim editor
                          const succeeding = clips.find(c => c.trackId === clip.trackId && Math.abs(c.timelinePos - (clip.timelinePos + clip.duration)) < 0.15);
                          if (succeeding) {
                            setAbTrimEditPoint({ clipAId: clip.id, clipBId: succeeding.id });
                            setAbTrimEditorOpen(true);
                          }
                        }}
                        onMouseMove={(e) => {
                          if (tool !== 'trim') return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const pct = clickX / rect.width;
                          const isLeftEdge = pct < 0.15;
                          const isRightEdge = pct > 0.85;
                          
                          if (isLeftEdge) {
                            const preceding = clips.find(c => c.trackId === clip.trackId && Math.abs((c.timelinePos + c.duration) - clip.timelinePos) < 0.15);
                            e.currentTarget.style.cursor = preceding ? 'col-resize' : 'w-resize';
                          } else if (isRightEdge) {
                            const succeeding = clips.find(c => c.trackId === clip.trackId && Math.abs(clip.timelinePos - (clip.timelinePos + clip.duration)) < 0.15);
                            e.currentTarget.style.cursor = succeeding ? 'col-resize' : 'e-resize';
                          } else {
                            e.currentTarget.style.cursor = e.altKey ? 'alias' : 'grab';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.cursor = '';
                        }}
                      >
                        {/* Trim handles */}
                        {!track.locked && tool === 'select' && (
                          <>
                            <div 
                              className="clip-resize-handle left" 
                              onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-left')}
                            />
                            <div 
                              className="clip-resize-handle right" 
                              onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-right')}
                            />
                          </>
                        )}

                        {/* Transition indicator at clip end */}
                        {transitionAtEnd && (
                          <div className="clip-transition-indicator" title={`${transitionAtEnd.type} (${transitionAtEnd.duration.toFixed(1)}s)`}>
                            <span>⟡</span>
                          </div>
                        )}

                        <div className="clip-label-container">
                          <span className="clip-title">{clip.name}</span>
                          <span className="clip-sub">
                            {clip.duration.toFixed(1)}s (x{clip.speed})
                          </span>
                        </div>

                        {/* Keyframe diamonds overlay */}
                        {kfTimes.map((kfTime, kfIdx) => {
                          const kfLeftPct = (kfTime / clip.duration) * 100;
                          const kfGlobalTime = clip.timelinePos + kfTime;
                          const isActive = Math.abs(playhead - kfGlobalTime) < 0.08;
                          return (
                            <div
                              key={kfIdx}
                              className={`keyframe-point-diamond ${isActive ? 'active' : ''}`}
                              style={{ 
                                left: `${kfLeftPct}%`, 
                                bottom: '4px', 
                                position: 'absolute',
                                transform: 'translateX(-50%) rotate(45deg)',
                                zIndex: 10
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setPlayhead(kfGlobalTime);
                              }}
                              title={`Keyframe at ${kfTime.toFixed(2)}s. Click to seek.`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
