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

  const handleDrop = (e) => {
    e.preventDefault();
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
          className="upload-dropzone" 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📥</div>
          <p>Drag files here or <strong>browse</strong></p>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>MP4, WebM, WAV, MP3, JPG, PNG</span>
          <input 
            type="file" 
            multiple 
            accept="video/*,audio/*,image/*" 
            onChange={handleFileUpload} 
          />
        </label>

        {/* Adjustment Clip Generator */}
        <button 
          className="btn btn-primary" 
          onClick={handleCreateAdjustmentAsset}
          style={{ width: '100%', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px' }}
        >
          ⚡ New Adjustment Clip
        </button>

        {/* Source Tape Mode Toggle */}
        <button 
          className={`btn ${sourceTapeMode ? 'btn-primary active' : 'btn-secondary'}`}
          onClick={() => setSourceTapeMode(!sourceTapeMode)}
          style={{ width: '100%', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px' }}
        >
          📼 {sourceTapeMode ? 'Source Tape: Active' : 'Source Tape Mode'}
        </button>

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
    </div>
  );
}
