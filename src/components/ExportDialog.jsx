import React, { useContext, useState, useRef } from 'react';
import { EditorContext } from '../context/EditorContext';
import { compositeTimelineFrame, triggerAudioTimelineTick } from '../utils/mediaRenderer';

export default function ExportDialog({ isOpen, onClose }) {
  const { clips, transitions, tracks, mediaLibrary, getInterpolatedValue, timelineDuration, fps: defaultFps } = useContext(EditorContext);
  
  const [resolution, setResolution] = useState('1920x1080');
  const [format, setFormat] = useState('video/webm');
  const [fps, setFps] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const cancelRef = useRef(false);

  if (!isOpen) return null;

  const triggerPreset = (res, fmt, rate) => {
    setResolution(res);
    setFormat(fmt);
    setFps(rate);
    handleExport({ resolution: res, format: fmt, fps: rate });
  };

  const handleExport = async (overrideSettings = null) => {
    setExporting(true);
    setProgress(0);
    setStatusText('Preparing renderer streams...');
    cancelRef.current = false;

    const exportRes = overrideSettings?.resolution || resolution;
    const exportFormat = overrideSettings?.format || format;
    const exportFps = overrideSettings?.fps || fps;

    try {
      const [widthStr, heightStr] = exportRes.split('x');
      const w = parseInt(widthStr);
      const h = parseInt(heightStr);

      // Create export canvas in DOM
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;

      // Set up Canvas Capture Stream
      const canvasStream = exportCanvas.captureStream(exportFps);
      
      // Setup audio capture via Web Audio (if supported)
      let combinedStream = canvasStream;
      let audioDestination = null;
      let originalAudioContext = null;

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        originalAudioContext = new AudioContextClass();
        audioDestination = originalAudioContext.createMediaStreamDestination();
        
        // Combine audio and video tracks
        const videoTracks = canvasStream.getVideoTracks();
        const audioTracks = audioDestination.stream.getAudioTracks();
        
        if (videoTracks.length > 0 && audioTracks.length > 0) {
          combinedStream = new MediaStream([videoTracks[0], audioTracks[0]]);
        }
      } catch (e) {
        console.warn("Web Audio capture stream failed, exporting silent video: ", e);
      }

      // Determine mimeType compatibility
      let mimeType = exportFormat;
      if (exportFormat === 'video/webm' && !MediaRecorder.isTypeSupported(exportFormat)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (exportFormat === 'video/mp4' && !MediaRecorder.isTypeSupported(exportFormat)) {
        // Fallback to webm if MP4 isn't supported natively by MediaRecorder (common in Chrome/Firefox)
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (cancelRef.current) {
          setStatusText('Export cancelled.');
          setExporting(false);
          return;
        }

        setStatusText('Saving exported clip...');
        const blob = new Blob(chunks, { type: exportFormat === 'video/mp4' ? 'video/mp4' : 'video/webm' });
        const downloadUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = exportFormat === 'video/mp4' ? 'editfree_render.mp4' : 'editfree_render.webm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        setStatusText('Export complete!');
        setProgress(1);
        setTimeout(() => {
          setExporting(false);
          onClose();
        }, 1500);
      };

      // Start recording
      recorder.start();

      // Render loop frame-by-frame
      const frameDuration = 1 / exportFps;
      let currentTime = 0;
      
      const renderFrame = () => {
        if (cancelRef.current) {
          recorder.stop();
          return;
        }

        if (currentTime >= timelineDuration) {
          setStatusText('Finalizing video codec data...');
          recorder.stop();
          return;
        }

        // 1. Composite timeline frame to exporting canvas
        compositeTimelineFrame({
          displayCanvas: exportCanvas,
          playheadTime: currentTime,
          clips,
          transitions,
          tracks,
          mediaLibrary,
          getInterpolatedValue
        });

        // 2. Play synthesized sounds at this timestep (if audio node destination available)
        if (originalAudioContext && audioDestination) {
          // Temporarily route procedural sounds to audio destination for recording
          try {
            const activeAudioTracks = tracks.filter(t => t.type === 'audio' && !t.muted);
            activeAudioTracks.forEach(track => {
              const activeClips = clips.filter(c => 
                c.trackId === track.id && 
                currentTime >= c.timelinePos && 
                currentTime < c.timelinePos + c.duration
              );
              activeClips.forEach(clip => {
                const asset = mediaLibrary.find(m => m.id === clip.mediaId);
                if (asset && asset.audioSynth) {
                  const elapsed = currentTime - clip.timelinePos;
                  const clipTime = (elapsed * clip.speed) + clip.srcIn;
                  
                  // Trigger synth oscillators directly routed to recorder
                  const osc = originalAudioContext.createOscillator();
                  const gainNode = originalAudioContext.createGain();
                  osc.connect(gainNode);
                  gainNode.connect(audioDestination);

                  // Setup simple synth beat patterns for recording
                  if (asset.id === 'mock_audio_beat') {
                    const beatInterval = 0.5; // 120 BPM
                    const rel = clipTime % beatInterval;
                    if (rel < 0.04) {
                      osc.frequency.setValueAtTime(150, originalAudioContext.currentTime);
                      osc.frequency.exponentialRampToValueAtTime(0.01, originalAudioContext.currentTime + 0.15);
                      gainNode.gain.setValueAtTime(0.18, originalAudioContext.currentTime);
                      gainNode.gain.exponentialRampToValueAtTime(0.001, originalAudioContext.currentTime + 0.2);
                      osc.start();
                      osc.stop(originalAudioContext.currentTime + 0.22);
                    }
                  } else if (asset.audioSynth) {
                    // Quick default tone sweep to keep it simple and avoid clipping
                    const secondFraction = clipTime % 1.0;
                    if (secondFraction < 0.08) {
                      osc.frequency.setValueAtTime(800, originalAudioContext.currentTime);
                      gainNode.gain.setValueAtTime(0.08, originalAudioContext.currentTime);
                      gainNode.gain.exponentialRampToValueAtTime(0.001, originalAudioContext.currentTime + 0.08);
                      osc.start();
                      osc.stop(originalAudioContext.currentTime + 0.10);
                    }
                  }
                }
              });
            });
          } catch (e) {
            console.error("Audio recording routing error: ", e);
          }
        }

        // 3. Advance progress
        currentTime += frameDuration;
        const currentProgress = Math.min(1, currentTime / timelineDuration);
        setProgress(currentProgress);
        setStatusText(`Encoding frames... ${(currentProgress * 100).toFixed(0)}% (${currentTime.toFixed(1)}s / ${timelineDuration.toFixed(1)}s)`);

        // Use short delay to let browser process encoding chunks
        setTimeout(renderFrame, 1000 / fps);
      };

      // Launch render queue
      renderFrame();

    } catch (err) {
      alert("Export failed: " + err.message);
      setExporting(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Export Video Setting</h2>
          {!exporting && <button className="btn-icon" onClick={onClose}>✖</button>}
        </div>

        {!exporting ? (
          <div className="modal-body">
            {/* Quick Export Presets Section */}
            <div className="quick-export-presets">
              <span className="form-label" style={{ marginBottom: '10px', display: 'block', fontWeight: 'bold', color: 'var(--text-light)' }}>Quick Export Presets:</span>
              <div className="preset-buttons-grid">
                <button className="preset-btn" onClick={() => triggerPreset('1920x1080', 'video/mp4', 30)}>
                  <span className="preset-icon">📺</span>
                  <div className="preset-details">
                    <span className="preset-name">YouTube 1080p</span>
                    <span className="preset-meta">MP4 • 30fps</span>
                  </div>
                </button>
                <button className="preset-btn" onClick={() => triggerPreset('1280x720', 'video/mp4', 30)}>
                  <span className="preset-icon">🐦</span>
                  <div className="preset-details">
                    <span className="preset-name">Twitter / X</span>
                    <span className="preset-meta">MP4 • 30fps</span>
                  </div>
                </button>
                <button className="preset-btn" onClick={() => triggerPreset('720x1280', 'video/mp4', 30)}>
                  <span className="preset-icon">📱</span>
                  <div className="preset-details">
                    <span className="preset-name">Instagram Reels</span>
                    <span className="preset-meta">MP4 • 30fps</span>
                  </div>
                </button>
                <button className="preset-btn" onClick={() => triggerPreset('1920x1080', 'video/webm', 60)}>
                  <span className="preset-icon">⭐</span>
                  <div className="preset-details">
                    <span className="preset-name">ProRes Master</span>
                    <span className="preset-meta">WebM • 60fps</span>
                  </div>
                </button>
              </div>
            </div>
            <hr className="presets-separator" />
            {/* Presets */}
            <div className="form-group">
              <span className="form-label">Resolution Preset:</span>
              <select 
                className="form-input-text" 
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="1920x1080">YouTube Full HD (1080p, 16:9)</option>
                <option value="1280x720">YouTube HD (720p, 16:9)</option>
                <option value="1080x1080">Instagram Square (1:1)</option>
                <option value="720x1280">TikTok / Reels Vertical (9:16)</option>
              </select>
            </div>

            {/* Formats */}
            <div className="form-group">
              <span className="form-label">Output Format:</span>
              <select 
                className="form-input-text" 
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="video/webm">WebM (VP9/VP8, offline compression)</option>
                <option value="video/mp4">MP4 (H.264, standard download)</option>
              </select>
            </div>

            {/* FPS */}
            <div className="form-group">
              <span className="form-label">Frame Rate (FPS):</span>
              <select 
                className="form-input-text" 
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
              >
                <option value={24}>24 FPS (Cinematic)</option>
                <option value={30}>30 FPS (Standard)</option>
                <option value={60}>60 FPS (High Performance)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
              ℹ️ Exporting runs client-side frame-by-frame and triggers a local file download. Keep this tab open during rendering.
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="export-progress-container">
              <div className="progress-info">
                <span>{statusText}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {exporting ? (
            <button className="btn btn-danger" onClick={handleCancel}>Cancel Export</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={handleExport}>Render & Download</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
