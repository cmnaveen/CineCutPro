import React, { useContext, useState, useEffect } from 'react';
import { EditorContext } from '../context/EditorContext';
import { generateMockAssets, getThumbnailDataUri } from '../utils/mockAssets';

export default function MediaBrowser() {
  const { 
    mediaLibrary, 
    addMediaAsset, 
    removeMediaAsset, 
    addClip, 
    tracks,
    setSourceAsset,
    setSourcePlayhead,
    setSourceIn,
    setSourceOut,
    setSourcePlaying,
    sourceTapeMode,
    setSourceTapeMode
  } = useContext(EditorContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState('input');

  const handleCreateAdjustmentAsset = () => {
    const id = `asset_adjustment_${Date.now()}`;
    const name = `Adjustment Clip ${mediaLibrary.filter(a => a.type === 'adjustment').length + 1}`;
    const asset = {
      id,
      name,
      type: 'adjustment',
      url: '',
      size: '0 KB',
      duration: 5.0,
      width: 1920,
      height: 1080,
      element: null,
      thumbnailData: getThumbnailDataUri('adjustment')
    };
    addMediaAsset(asset);
  };
  
  // Pre-load mock assets on first render if library is empty
  useEffect(() => {
    if (mediaLibrary.length === 0) {
      const mocks = generateMockAssets();
      mocks.forEach(m => {
        // Generate pre-drawn static canvas thumbnails
        m.thumbnailData = getThumbnailDataUri(m.thumbnail);
        addMediaAsset(m);
      });
    }
  }, []);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      processImportedFile(file);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      processImportedFile(file);
    });
  };

  const processImportedFile = (file) => {
    const url = URL.createObjectURL(file);
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const name = file.name;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    // Determine type by mimetype
    let type = 'video';
    if (file.type.startsWith('image/')) type = 'image';
    if (file.type.startsWith('audio/')) type = 'audio';

    const asset = {
      id,
      name,
      type,
      url,
      size: `${sizeMB} MB`,
      duration: 5, // default fallback
      width: 1920,
      height: 1080,
      element: null,
      thumbnailData: null
    };

    if (type === 'image') {
      const img = new Image();
      img.onload = () => {
        asset.width = img.naturalWidth;
        asset.height = img.naturalHeight;
        asset.element = img;
        // Generate thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 160, 90);
        asset.thumbnailData = canvas.toDataURL();
        addMediaAsset(asset);
      };
      img.src = url;
    } else if (type === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadedmetadata = () => {
        asset.width = video.videoWidth;
        asset.height = video.videoHeight;
        asset.duration = video.duration || 5;
        asset.element = video;

        // Generate thumbnail by seeking to 0.1s
        video.currentTime = 0.1;
      };

      video.onseeked = () => {
        if (asset.thumbnailData) return; // avoid multiple triggers
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 160, 90);
        asset.thumbnailData = canvas.toDataURL();
        addMediaAsset(asset);
      };
      video.src = url;
    } else if (type === 'audio') {
      const audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.onloadedmetadata = () => {
        asset.duration = audio.duration || 5;
        asset.element = audio;
        // Generate generic audio visualizer thumbnail
        asset.thumbnailData = getThumbnailDataUri('audio');
        addMediaAsset(asset);
      };
      audio.src = url;
    }
  };

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      url: asset.url,
      duration: asset.duration
    }));
  };

  const handleAddToTimeline = (asset) => {
    // Pick the first matching track type
    const matchingTrack = tracks.find(t => {
      if (asset.type === 'video' || asset.type === 'image') return t.type === 'video';
      if (asset.type === 'audio') return t.type === 'audio';
      return false;
    });

    if (matchingTrack) {
      addClip(matchingTrack.id, asset, 0);
    } else {
      alert("No compatible track found. Create or unmute a track first.");
    }
  };

  const filteredAssets = mediaLibrary.filter(asset => 
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sidebar glass-panel">
      <div className="panel-tabs">
        <button className="panel-tab active">Media Browser</button>
      </div>

      <div className="panel-content">
        {/* Upload area */}
        <label 
          className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="import-icon-container">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="import-svg-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 13 7 8" />
              <line x1="12" y1="13" x2="12" y2="1" />
            </svg>
          </div>
          <span className="import-title">Import Media</span>
          <p className="import-subtitle">Drag files here or <strong>browse</strong></p>
          <span className="import-formats">MP4, WebM, WAV, MP3, JPG, PNG</span>
          <button 
            type="button"
            className="import-spec-link" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSpecModalOpen(true);
            }}
          >
            📋 Technical Specifications
          </button>
          <input 
            type="file" 
            multiple 
            accept="video/*,audio/*,image/*" 
            onChange={handleFileUpload} 
          />
        </label>

        {/* Action Toolbar */}
        <div className="media-actions-row" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleCreateAdjustmentAsset}
            title="Create a new adjustment layer to apply filters downwards"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.72rem', padding: '6px' }}
          >
            ⚡ Adjustment
          </button>

          <button 
            className={`btn ${sourceTapeMode ? 'btn-primary active' : 'btn-secondary'}`}
            onClick={() => setSourceTapeMode(!sourceTapeMode)}
            title="Toggle Source Tape Mode — scrub all assets concatenated as one tape"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.72rem', padding: '6px' }}
          >
            📼 Source Tape
          </button>
        </div>

        {/* Search Bar */}
        <input 
          type="text" 
          placeholder="Search assets..." 
          className="form-input-text" 
          style={{ width: '100%', marginBottom: '14px', padding: '6px 12px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Media Grid */}
        {filteredAssets.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">📁</span>
            <p>No media files found. Try dragging in some files or using the search bar.</p>
          </div>
        ) : (
          <div className="media-grid">
            {filteredAssets.map(asset => (
              <div 
                key={asset.id} 
                className="media-card"
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                onDoubleClick={() => {
                  setSourceAsset(asset);
                  setSourceIn(0);
                  setSourceOut(asset.duration || 5);
                  setSourcePlayhead(0);
                  setSourcePlaying(false);
                }}
                title="Double-click to load in Source Monitor, drag to timeline"
              >
                <div className="media-thumbnail-container">
                  {asset.thumbnailData ? (
                    <img 
                      src={asset.thumbnailData} 
                      alt={asset.name} 
                      className="media-thumbnail-canvas"
                    />
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Loading...</div>
                  )}
                  <span className="media-type-badge">{asset.type}</span>
                  <span className="media-duration-badge">
                    {asset.duration.toFixed(1)}s
                  </span>
                </div>
                <div className="media-info">
                  <span className="media-title" title={asset.name}>{asset.name}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span className="media-meta">{asset.size || 'MOCK'}</span>
                    <button 
                      className="track-btn" 
                      onClick={() => handleAddToTimeline(asset)}
                      title="Add to timeline start"
                      style={{ width: '18px', height: '18px', padding: 0 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSpecModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSpecModalOpen(false)}>
          <div 
            className="modal-content tech-specs-modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ width: '650px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <div>
                <h2>Technical Specifications</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Supported formats, codecs, and system requirements
                </p>
              </div>
              <button 
                className="close-btn" 
                onClick={() => setIsSpecModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="tech-spec-tab-bar">
              <button 
                className={`tech-spec-tab ${activeSpecTab === 'input' ? 'active' : ''}`}
                onClick={() => setActiveSpecTab('input')}
              >
                📥 Input Formats
              </button>
              <button 
                className={`tech-spec-tab ${activeSpecTab === 'output' ? 'active' : ''}`}
                onClick={() => setActiveSpecTab('output')}
              >
                📤 Output & Export
              </button>
              <button 
                className={`tech-spec-tab ${activeSpecTab === 'system' ? 'active' : ''}`}
                onClick={() => setActiveSpecTab('system')}
              >
                💻 System Specs
              </button>
            </div>

            <div className="modal-body tech-spec-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeSpecTab === 'input' && (
                <>
                  <div>
                    <h3 className="tech-spec-section-title">Input Video Formats & Codecs</h3>
                    <table className="tech-spec-table">
                      <thead>
                        <tr>
                          <th>Format</th>
                          <th>File Extension</th>
                          <th>Supported Codecs</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>MPEG-4 Video</strong></td>
                          <td><code>.mp4, .m4v, .3gp</code></td>
                          <td>H.264, MPEG-4, H.263</td>
                        </tr>
                        <tr>
                          <td><strong>QuickTime Movie</strong></td>
                          <td><code>.mov</code></td>
                          <td>H.264, ProRes, MPEG-4</td>
                        </tr>
                        <tr>
                          <td><strong>WebM Video</strong></td>
                          <td><code>.webm</code></td>
                          <td>VP8, VP9, AV1</td>
                        </tr>
                        <tr>
                          <td><strong>Ogg Video</strong></td>
                          <td><code>.ogv</code></td>
                          <td>Theora</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="tech-spec-section-title">Input Audio Formats</h3>
                    <table className="tech-spec-table">
                      <thead>
                        <tr>
                          <th>Format</th>
                          <th>Extensions</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Audio Tracks</strong></td>
                          <td><code>.mp3, .wav, .m4a, .ogg, .flac, .aac, .aif, .aiff</code></td>
                          <td>Digital audio containers and codecs</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="tech-spec-section-title">Input Image Formats</h3>
                    <table className="tech-spec-table">
                      <thead>
                        <tr>
                          <th>Format</th>
                          <th>Extensions</th>
                          <th>Feature Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Still Images</strong></td>
                          <td><code>.png, .jpg, .jpeg, .webp, .svg, .gif</code></td>
                          <td>Vector assets, alpha transparency, and animations</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {activeSpecTab === 'output' && (
                <>
                  <div>
                    <h3 className="tech-spec-section-title">Output/Export Support</h3>
                    <table className="tech-spec-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Export Formats</th>
                          <th>Presets & Targets</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Master Video</strong></td>
                          <td><code>.mp4</code> (H.264 / AAC)</td>
                          <td>ProRes Master, Custom Bitrate, 1080p, 4K</td>
                        </tr>
                        <tr>
                          <td><strong>Web Video</strong></td>
                          <td><code>.webm</code> (VP8/VP9)</td>
                          <td>HTML5 Video player compatibility</td>
                        </tr>
                        <tr>
                          <td><strong>Audio Only</strong></td>
                          <td><code>.wav</code> (PCM)</td>
                          <td>Lossless stereo audio mixdowns</td>
                        </tr>
                        <tr>
                          <td><strong>Image Sequence</strong></td>
                          <td><code>.gif</code></td>
                          <td>Short animated web clips</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="spec-info-card" style={{ marginTop: '10px' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--primary-light)' }}>💡 Platform Native Rendering</h4>
                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      CineCut Pro utilizes your browser's native hardware-accelerated MediaRecorder API and Canvas compositing to output frame-accurate exports directly client-side.
                    </p>
                  </div>
                </>
              )}

              {activeSpecTab === 'system' && (
                <div>
                  <h3 className="tech-spec-section-title">Recommended System Specifications</h3>
                  <ul className="system-spec-list">
                    <li>
                      <strong>Operating System:</strong> 
                      <span>Windows 10/11 (64-bit), macOS 10.15+, Ubuntu Linux or equivalent (64-bit)</span>
                    </li>
                    <li>
                      <strong>Processor (CPU):</strong> 
                      <span>Intel Core i5/i7 (4 cores minimum), AMD Ryzen 5/7, or Apple Silicon (M1/M2/M3)</span>
                    </li>
                    <li>
                      <strong>Graphics Card (GPU):</strong> 
                      <span>Intel HD Graphics 5000, NVIDIA GeForce GTX 700 series, AMD Radeon R5 or higher. Must support WebGL 2.0.</span>
                    </li>
                    <li>
                      <strong>System Memory:</strong> 
                      <span>8 GB RAM minimum; 16 GB or higher recommended for high-resolution HD / 4K composite editing.</span>
                    </li>
                    <li>
                      <strong>Browser Engine:</strong> 
                      <span>Google Chrome 90+, Microsoft Edge 90+, Safari 14.1+, or Firefox 88+ (with WebGL and Hardware Acceleration enabled).</span>
                    </li>
                    <li>
                      <strong>Hardware Acceleration:</strong> 
                      <span>Ensure "Use hardware acceleration when available" is enabled in browser system settings for GPU compositing performance.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', margin: 0 }}>
              <button className="btn btn-secondary" onClick={() => setIsSpecModalOpen(false)}>
                Close Specifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
