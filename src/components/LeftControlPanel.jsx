import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatHMS } from '../engine/timecode.js';
import { putMedia } from '../engine/mediaStore.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { getAllEffects, createEffectInstance } from '../engine/effectsRegistry.js';

// Custom icons that are not in IconSet
const CustomIcons = {
  Templates: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Elements: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Captions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  ),
  Transcript: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  ),
  Filters: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  ),
  BrandKit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
};

export function LeftControlPanel() {
  const { state, dispatch } = useEditor();
  const [activeTab, setActiveTab] = useState('media'); // media, templates, elements, audio, text, captions, transcript, effects, transitions, filters, brandkit
  const [searchQuery, setSearchQuery] = useState('');

  const TABS = [
    { id: 'media', label: 'Media', icon: <Icon.Layers size={18} /> },
    { id: 'templates', label: 'Templates', icon: <CustomIcons.Templates /> },
    { id: 'elements', label: 'Elements', icon: <CustomIcons.Elements /> },
    { id: 'audio', label: 'Audio', icon: <Icon.Wave size={18} /> },
    { id: 'text', label: 'Text', icon: <Icon.T size={18} /> },
    { id: 'captions', label: 'Captions', icon: <CustomIcons.Captions /> },
    { id: 'transcript', label: 'Transcript', icon: <CustomIcons.Transcript /> },
    { id: 'effects', label: 'Effects', icon: <Icon.Wand size={18} /> },
    { id: 'transitions', label: 'Transitions', icon: <Icon.Sparkles size={18} /> },
    { id: 'filters', label: 'Filters', icon: <CustomIcons.Filters /> },
    { id: 'brandkit', label: 'Brand kit', icon: <CustomIcons.BrandKit /> }
  ];

  return (
    <aside className="cc-left-control-panel">
      {/* 1. Slim Navigation Sidebar */}
      <nav className="cc-left-sidebar">
        {/* CapCut Logo */}
        <div className="cc-left-sidebar__logo" onClick={() => setActiveTab('media')}>
          <div className="cc-left-sidebar__logo-icon">C</div>
        </div>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`cc-sidebar-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchQuery('');
            }}
            title={tab.label}
          >
            <span className="cc-sidebar-tab__icon">{tab.icon}</span>
            <span className="cc-sidebar-tab__label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 2. Scrollable Detail Panel */}
      <div className="cc-library-panel">
        <div className="cc-library-panel__header">
          <div className="cc-library-panel__title-bar">
            <span className="cc-library-panel__title">
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
          </div>
          {activeTab !== 'captions' && activeTab !== 'brandkit' && (
            <div className="cc-library-panel__search-bar">
              <Icon.Search size={14} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="cc-library-panel__scroll-content">
          {activeTab === 'media' && <MediaTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'templates' && <TemplatesTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'elements' && <ElementsTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'audio' && <AudioTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'text' && <TextTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'captions' && <CaptionsTabContent state={state} dispatch={dispatch} />}
          {activeTab === 'transcript' && <TranscriptTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'effects' && <EffectsTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'transitions' && <TransitionsTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'filters' && <FiltersTabContent state={state} dispatch={dispatch} query={searchQuery} />}
          {activeTab === 'brandkit' && <BrandKitTabContent state={state} dispatch={dispatch} />}
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────── TAB COMPONENTS ─────────────────────────── */

/* ===== 1. MEDIA TAB ===== */
function MediaTabContent({ state, dispatch, query }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [hoverId, setHoverId] = useState(null);

  const kindFromFile = (file) => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    return 'video';
  };

  const probe = (file, src, kind) => {
    return new Promise((resolve) => {
      if (kind === 'image') {
        const img = new Image();
        img.onload = () => resolve({ duration: 5, thumb: src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        img.onerror = () => resolve({ duration: 5, thumb: null });
        img.src = src;
        return;
      }
      if (kind === 'video') {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.src = src;
        v.onloadedmetadata = () => {
          v.currentTime = Math.min(0.5, (v.duration || 1) * 0.1);
          v.onseeked = () => {
            try {
              const c = document.createElement('canvas');
              c.width = 160;
              c.height = Math.round(160 * (v.videoHeight / v.videoWidth || 0.5625));
              const ctx = c.getContext('2d');
              ctx.drawImage(v, 0, 0, c.width, c.height);
              resolve({ duration: v.duration || 5, thumb: c.toDataURL('image/jpeg', 0.6), naturalWidth: v.videoWidth, naturalHeight: v.videoHeight });
            } catch (_) {
              resolve({ duration: v.duration || 5, thumb: null, naturalWidth: v.videoWidth, naturalHeight: v.videoHeight });
            }
          };
        };
        v.onerror = () => resolve({ duration: 5, thumb: null });
        return;
      }
      if (kind === 'audio') {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.src = src;
        a.onloadedmetadata = () => resolve({ duration: a.duration || 5, thumb: null });
        a.onerror = () => resolve({ duration: 5, thumb: null });
      }
    });
  };

  const ingest = useCallback(async (files) => {
    const items = await Promise.all(
      Array.from(files).map(async (file) => {
        const id = `med_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const src = URL.createObjectURL(file);
        const kind = kindFromFile(file);
        const meta = await probe(file, src, kind);
        putMedia(id, file);
        return {
          id,
          name: file.name,
          kind,
          src,
          persistent: true,
          duration: meta.duration,
          thumb: meta.thumb,
          meta: {
            size: file.size,
            type: file.type,
            naturalWidth: meta.naturalWidth,
            naturalHeight: meta.naturalHeight
          }
        };
      })
    );
    dispatch({ type: 'media/add', items });
  }, [dispatch]);

  const onFiles = (e) => {
    if (e.target.files?.length) ingest(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  };

  const onDragMediaStart = (id) => (e) => {
    e.dataTransfer.setData('application/x-cinecut-media', id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const filtered = useMemo(() => {
    return state.media.filter(m => query ? m.name.toLowerCase().includes(query.toLowerCase()) : true);
  }, [state.media, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Upload buttons & phone sync styling like CapCut screen 4 */}
      <div className="cc-media-upload-area">
        <button className="cc-media-upload-btn" onClick={() => inputRef.current?.click()}>
          <Icon.Upload size={22} />
          Upload
          <span>Drag, drop or select files</span>
        </button>
        <input ref={inputRef} type="file" accept="video/*,audio/*,image/*" multiple hidden onChange={onFiles} />
        
        <div className="cc-media-import-types">
          <button className="cc-media-import-btn" onClick={() => dispatch({ type: 'toast/push', kind: 'info', message: 'Local mobile link simulated' })}>
            📱 Mobile
          </button>
          <button className="cc-media-import-btn" onClick={() => dispatch({ type: 'toast/push', kind: 'info', message: 'Ready to sync with cloud' })}>
            ☁️ Cloud Space
          </button>
        </div>
      </div>

      <div className="cc-seedance-banner" onClick={() => dispatch({ type: 'toast/push', kind: 'success', message: 'Seedance 2.0 AI synthesis activated!' })}>
        <div className="cc-seedance-info">
          <h5>Seedance 2.0</h5>
          <p>Pro benefit, free for limited time</p>
        </div>
        <span className="cc-seedance-arrow">→</span>
      </div>

      <div
        className={`cc-media__list ${dragOver ? 'is-drop' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{ minHeight: '150px' }}
      >
        {filtered.length === 0 && (
          <div className="cc-media__empty">
            <div className="cc-media__empty-icon"><Icon.Upload size={24} /></div>
            <div className="cc-media__empty-title">Imported Media Bin</div>
            <div className="cc-media__empty-sub">Your imported clips appear here</div>
          </div>
        )}
        {filtered.map((m) => (
          <article
            key={m.id}
            className="cc-clip-card"
            draggable
            onDragStart={onDragMediaStart(m.id)}
            onDoubleClick={() => dispatch({ type: 'source/load', id: m.id })}
            onMouseEnter={() => setHoverId(m.id)}
            onMouseLeave={() => setHoverId(null)}
            title="Double-click to load in monitor — Drag to timeline"
          >
            <div className={`cc-clip-card__thumb cc-clip-card__thumb--${m.kind}`}>
              {m.thumb ? <img src={m.thumb} alt="" /> : <span>{m.kind}</span>}
              <span className="cc-clip-card__dur">{formatHMS(m.duration)}</span>
              {m.isSubclip && <span className="cc-clip-card__sub">SUB</span>}
            </div>
            <div className="cc-clip-card__body">
              <div className="cc-clip-card__name">{m.name}</div>
              <div className="cc-clip-card__meta">
                {m.meta?.naturalWidth ? `${m.meta.naturalWidth}×${m.meta.naturalHeight}` : m.kind}
                {m.meta?.size ? ` · ${(m.meta.size / 1024 / 1024).toFixed(1)} MB` : ''}
              </div>
            </div>
            {hoverId === m.id && (
              <div className="cc-clip-card__hover">
                <button
                  className="cc-icon-btn cc-icon-btn--xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetTrack = state.tracks.find(t => t.kind === 'video') || state.tracks[0];
                    dispatch({
                      type: 'clip/insertFromMedia',
                      mediaId: m.id,
                      trackId: targetTrack.id,
                      start: state.playhead
                    });
                    dispatch({ type: 'toast/push', kind: 'success', message: 'Added to timeline' });
                  }}
                  title="Insert at playhead"
                >
                  <Icon.Plus size={12} />
                </button>
                <button
                  className="cc-icon-btn cc-icon-btn--xs cc-icon-btn--danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'media/remove', id: m.id });
                  }}
                  title="Remove"
                >
                  <Icon.Trash size={12} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

/* ===== 2. TEMPLATES TAB ===== */
function TemplatesTabContent({ state, dispatch, query }) {
  const categories = [
    {
      title: 'For You',
      layout: 'portrait',
      items: [
        { id: 'fy1', dur: '00:09', name: 'Lofi Glow' },
        { id: 'fy2', dur: '00:10', name: 'Summer Cut' },
        { id: 'fy3', dur: '00:12', name: 'Grid Slide' },
        { id: 'fy4', dur: '00:13', name: 'Aesthetic Day' }
      ]
    },
    {
      title: "Editor's Picks",
      layout: 'landscape',
      items: [
        { id: 'ep1', dur: '00:06', name: 'Brand Intro' },
        { id: 'ep2', dur: '00:11', name: 'Kinetic Text Reveal' },
        { id: 'ep3', dur: '00:13', name: 'Splice Collage' },
        { id: 'ep4', dur: '00:06', name: 'Minimal outro' }
      ]
    },
    {
      title: 'New Year 2026',
      layout: 'landscape',
      items: [
        { id: 'ny1', dur: '00:16', name: 'New Year Recap' },
        { id: 'ny2', dur: '00:16', name: 'Celebration Beat' },
        { id: 'ny3', dur: '00:15', name: 'Golden Confetti' },
        { id: 'ny4', dur: '00:17', name: 'Countdown Spark' }
      ]
    },
    {
      title: 'Logo reveal',
      layout: 'landscape',
      items: [
        { id: 'logo1', dur: '00:08', name: 'Clean Hex' },
        { id: 'logo2', dur: '00:07', name: 'Neon Glitch Logo' },
        { id: 'logo3', dur: '00:07', name: 'Smoke Burst' },
        { id: 'logo4', dur: '00:10', name: 'Abstract Sphere' }
      ]
    }
  ];

  // Helper to load templates into project
  const loadTemplate = (name) => {
    dispatch({ type: 'toast/push', kind: 'info', message: `Loading Template: ${name}...` });
    // Simulate template injection by placing standard media/titles
    const trackVideo = state.tracks.find(t => t.kind === 'video')?.id || 'trk_4';
    const trackTitle = state.tracks.find(t => t.kind === 'title')?.id || 'trk_1';
    const trackAudio = state.tracks.find(t => t.kind === 'audio')?.id || 'trk_5';

    // Clear existing clips if any, then insert mock template content
    dispatch({ type: 'select/clips', ids: [] });

    // 1. Title at start
    dispatch({
      type: 'clip/insertTitle',
      trackId: trackTitle,
      start: 0,
      duration: 3.5,
      title: {
        text: name.toUpperCase(),
        preset: 'vaporwave',
        font: 'Space Grotesk',
        weight: 800,
        size: 82,
        align: 'center',
        color: '#ff007f'
      }
    });

    // 2. Primary video if available
    const svadMedia = state.media.find(m => m.name.includes('Svadotsava'));
    if (svadMedia) {
      dispatch({
        type: 'clip/insertFromMedia',
        mediaId: svadMedia.id,
        trackId: trackVideo,
        start: 0,
        srcIn: 0,
        srcOut: 12
      });
    }

    dispatch({ type: 'toast/push', kind: 'success', message: `Successfully loaded "${name}" template!` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {categories.map((cat, index) => {
        const filteredItems = cat.items.filter(item => query ? item.name.toLowerCase().includes(query.toLowerCase()) : true);
        if (filteredItems.length === 0) return null;
        return (
          <div key={index} className="cc-template-row">
            <div className="cc-template-row__header">
              <span className="cc-template-row__title">{cat.title}</span>
              <span className="cc-template-row__viewall" onClick={() => dispatch({ type: 'toast/push', kind: 'info', message: 'Showing all templates' })}>View all</span>
            </div>
            <div className="cc-template-row__cards">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className={`cc-template-card cc-template-card--${cat.layout}`}
                  onClick={() => loadTemplate(item.name)}
                  title={`Apply template: ${item.name}`}
                >
                  <div className="cc-template-card__play">
                    <div className="cc-template-card__play-btn">▶</div>
                  </div>
                  {/* Generated placeholders */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(135deg, hsl(${(parseInt(item.id, 36) * 15) % 360} 70% 30%) 0%, #1e1e24 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: '#e4e4e7',
                    textAlign: 'center',
                    padding: '8px'
                  }}>
                    {item.name}
                  </div>
                  <span className="cc-template-card__dur">{cat.layout === 'portrait' ? item.dur : item.dur}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== 3. ELEMENTS TAB ===== */
function ElementsTabContent({ state, dispatch, query }) {
  const stockVideos = [
    { name: 'Film Countdown', dur: '5.0s', color: '#ff5e3a', type: 'countdown' },
    { name: 'SMPTE Color Bars', dur: '10.0s', color: '#007aff', type: 'colorbars' },
    { name: 'Slow Bokeh Lights', dur: '8.0s', color: '#ffcc00', type: 'bokeh' }
  ];
  
  const photos = [
    { name: 'Dark Marble texture', color: '#3a3a3c' },
    { name: 'Warm Studio Grid', color: '#e5e5ea' },
    { name: 'Cyberpunk Neon', color: '#af52de' }
  ];

  const avatars = [
    { name: 'Presenter Anna', role: 'Presenter' },
    { name: 'Presenter James', role: 'Guide' }
  ];

  const stickers = [
    { label: '👍 Like', symbol: '👍' },
    { label: '❤️ Love', symbol: '❤️' },
    { label: '🔥 Hot', symbol: '🔥' },
    { label: '🚨 Alert', symbol: '🚨' },
    { label: '🎯 Target', symbol: '🎯' },
    { label: '🚀 Launch', symbol: '🚀' }
  ];

  const addStockVideo = (item) => {
    // Inject mock stock video into Library and Timeline
    const id = `med_stock_${Date.now()}`;
    const name = `${item.name}.mp4`;
    dispatch({
      type: 'media/add',
      items: [{
        id,
        name,
        kind: 'video',
        src: '', // empty to trigger mock playback
        duration: parseFloat(item.dur),
        thumb: null,
        meta: { size: 1048576, type: 'video/mp4', naturalWidth: 1920, naturalHeight: 1080 }
      }]
    });

    const track = state.tracks.find(t => t.kind === 'video')?.id || 'trk_4';
    dispatch({
      type: 'clip/insertFromMedia',
      mediaId: id,
      trackId: track,
      start: state.playhead,
      srcIn: 0,
      srcOut: parseFloat(item.dur)
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Added stock video: ${name}` });
  };

  const addSticker = (sticker) => {
    // Insert sticker as a subtitle or title block with custom text
    const track = state.tracks.find(t => t.kind === 'title')?.id || 'trk_1';
    dispatch({
      type: 'clip/insertTitle',
      trackId: track,
      start: state.playhead,
      duration: 3,
      title: {
        text: sticker.symbol,
        preset: 'cyber',
        font: 'Inter',
        weight: 800,
        size: 140,
        align: 'center',
        color: '#ffffff'
      }
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Inserted sticker: ${sticker.label}` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Stock Videos */}
      <div className="cc-template-row">
        <div className="cc-template-row__header">
          <span className="cc-template-row__title">Stock videos</span>
        </div>
        <div className="cc-elements-grid cc-elements-grid--2col">
          {stockVideos.filter(v => query ? v.name.toLowerCase().includes(query.toLowerCase()) : true).map((item, idx) => (
            <div key={idx} className="cc-element-card" onClick={() => addStockVideo(item)}>
              <div className="cc-element-card__img-container" style={{ background: item.color, height: '64px' }}>
                <span style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>{item.name}</span>
                <span className="cc-element-card__dur">{item.dur}</span>
              </div>
              <div className="cc-element-card__info">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Photos */}
      <div className="cc-template-row">
        <div className="cc-template-row__header">
          <span className="cc-template-row__title">Photos</span>
        </div>
        <div className="cc-elements-grid cc-elements-grid--2col">
          {photos.filter(p => query ? p.name.toLowerCase().includes(query.toLowerCase()) : true).map((item, idx) => (
            <div key={idx} className="cc-element-card" onClick={() => {
              dispatch({ type: 'toast/push', kind: 'info', message: `Applied background photo: ${item.name}` });
            }}>
              <div className="cc-element-card__img-container" style={{ background: item.color, height: '64px' }}>
                <span style={{ fontSize: '10px', color: '#fff' }}>Photo</span>
              </div>
              <div className="cc-element-card__info">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. AI Avatars */}
      <div className="cc-template-row">
        <div className="cc-template-row__header">
          <span className="cc-template-row__title">AI avatars</span>
        </div>
        <div className="cc-elements-grid cc-elements-grid--2col">
          {avatars.filter(a => query ? a.name.toLowerCase().includes(query.toLowerCase()) : true).map((item, idx) => (
            <div key={idx} className="cc-element-card" onClick={() => dispatch({ type: 'toast/push', kind: 'success', message: `AI voiceover generated for ${item.name}` })}>
              <div className="cc-element-card__img-container" style={{ background: '#27272a', height: '64px' }}>
                <span style={{ fontSize: '24px' }}>👤</span>
              </div>
              <div className="cc-element-card__info">{item.name} ({item.role})</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Stickers */}
      <div className="cc-template-row">
        <div className="cc-template-row__header">
          <span className="cc-template-row__title">Stickers</span>
        </div>
        <div className="cc-elements-grid">
          {stickers.filter(s => query ? s.label.toLowerCase().includes(query.toLowerCase()) : true).map((item, idx) => (
            <div key={idx} className="cc-element-card" onClick={() => addSticker(item)} style={{ padding: '8px' }}>
              <div style={{ fontSize: '28px', textAlign: 'center', cursor: 'pointer' }}>
                {item.symbol}
              </div>
              <div className="cc-element-card__info" style={{ border: 'none', background: 'transparent', padding: '2px 0 0' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== 4. AUDIO TAB ===== */
function AudioTabContent({ state, dispatch, query }) {
  const tracks = [
    { name: 'Upbeat Electro Vibe', genre: 'Electronic', dur: '00:30', url: '/UpbeatElectro.mp3' },
    { name: 'Chill Lofi Beats', genre: 'Lofi HipHop', dur: '00:45', url: '/LofiRelax.mp3' },
    { name: 'Epic Cinematic Theme', genre: 'Orchestral', dur: '00:35', url: '/EpicTheme.mp3' },
    { name: 'Tech Presentation', genre: 'Corporate', dur: '00:24', url: '/TechCorporate.mp3' }
  ];

  const [playingId, setPlayingId] = useState(null);

  const togglePlay = (idx) => {
    if (playingId === idx) {
      setPlayingId(null);
      dispatch({ type: 'toast/push', kind: 'info', message: 'Audio preview paused' });
    } else {
      setPlayingId(idx);
      dispatch({ type: 'toast/push', kind: 'info', message: `Previewing soundtrack: ${tracks[idx].name}` });
    }
  };

  const addAudioTrack = (track) => {
    // Create audio media item
    const mediaId = `med_audio_${Date.now()}`;
    dispatch({
      type: 'media/add',
      items: [{
        id: mediaId,
        name: `${track.name}.mp3`,
        kind: 'audio',
        src: track.url,
        duration: 30, // simulated
        thumb: null,
        meta: { size: 5242880, type: 'audio/mpeg' }
      }]
    });

    // Find first audio track
    const audioTrack = state.tracks.find(t => t.kind === 'audio')?.id || 'trk_5';
    dispatch({
      type: 'clip/insertFromMedia',
      mediaId,
      trackId: audioTrack,
      start: state.playhead,
      srcIn: 0,
      srcOut: 30
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Successfully inserted audio track: ${track.name}` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {tracks.filter(t => query ? t.name.toLowerCase().includes(query.toLowerCase()) : true).map((track, idx) => (
        <div key={idx} className="cc-audio-item">
          <button className="cc-audio-item__play" onClick={() => togglePlay(idx)}>
            {playingId === idx ? '⏸' : '▶'}
          </button>
          <div className="cc-audio-item__info">
            <div className="cc-audio-item__name">{track.name}</div>
            <div className="cc-audio-item__meta">{track.genre} · {track.dur}</div>
          </div>
          <button className="cc-audio-item__add" onClick={() => addAudioTrack(track)} title="Add to timeline">
            ＋
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===== 5. TEXT TAB ===== */
function TextTabContent({ state, dispatch, query }) {
  const presets = [
    { id: 'plain', name: 'Standard Text', color: '#1c1c21', border: '1px dashed #3f3f46', textStyle: { color: '#ffffff' } },
    { id: 'glass', name: 'Glassmorphism', color: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', textStyle: { textShadow: '0 4px 10px rgba(0,0,0,0.3)', color: '#fff' } },
    { id: 'neon', name: 'Cyber Neon Glow', color: '#09090b', border: '1px solid #a21caf', textStyle: { color: '#f43f5e', textShadow: '0 0 10px #f43f5e, 0 0 20px #e11d48' } },
    { id: 'gold', name: 'Golden Premium', color: '#18181b', border: '1px solid #ca8a04', textStyle: { color: '#facc15', textShadow: '0 2px 4px rgba(0,0,0,0.5)' } }
  ];

  const addText = (preset) => {
    const track = state.tracks.find(t => t.kind === 'title')?.id || 'trk_1';
    dispatch({
      type: 'clip/insertTitle',
      trackId: track,
      start: state.playhead,
      duration: 4,
      title: {
        text: 'CineCutPro',
        preset: preset.id,
        font: 'Inter',
        weight: 800,
        size: 96,
        align: 'center',
        color: preset.textStyle.color
      }
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Added text clip with "${preset.name}" style` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {presets.filter(p => query ? p.name.toLowerCase().includes(query.toLowerCase()) : true).map((preset) => (
        <div key={preset.id} className="cc-text-preset">
          <div className="cc-text-preset__preview" style={{ background: preset.color, border: preset.border }}>
            <span style={preset.textStyle}>Text Layer</span>
          </div>
          <div className="cc-text-preset__action">
            <span className="cc-text-preset__name">{preset.name}</span>
            <button className="cc-icon-btn cc-icon-btn--xs" onClick={() => addText(preset)}>
              ＋ Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===== 6. CAPTIONS TAB ===== */
function CaptionsTabContent({ state, dispatch }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startAutoCaptions = () => {
    setLoading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setLoading(false);
          injectSubtitles();
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const injectSubtitles = () => {
    const subtitleTrack = state.tracks.find(t => t.kind === 'subtitle')?.id || 'trk_2';

    const subs = [
      { tStart: 0.5, tEnd: 3.5, text: 'Welcome to CineCutPro!' },
      { tStart: 4.0, tEnd: 7.5, text: 'The best browser-based video editor.' },
      { tStart: 8.0, tEnd: 11.5, text: "Let's create something amazing!" }
    ];

    subs.forEach(s => {
      dispatch({
        type: 'clip/insertTitle',
        trackId: subtitleTrack,
        start: s.tStart,
        duration: s.tEnd - s.tStart,
        title: {
          text: s.text,
          preset: 'glass',
          font: 'Inter',
          weight: 600,
          size: 64,
          align: 'center',
          color: '#ffffff',
          isSubtitle: true
        }
      });
    });

    dispatch({ type: 'toast/push', kind: 'success', message: 'Auto captions successfully generated!' });
  };

  return (
    <div className="cc-captions-container">
      {loading && (
        <div className="cc-captions-progress-overlay">
          <div className="cc-progress-spinner" />
          <div className="cc-progress-text">Transcribing audio frequencies ({progress}%)</div>
          <div className="cc-progress-bar-container">
            <div className="cc-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="cc-auto-captions-box">
        <div className="cc-auto-captions-icon">🎙️</div>
        <h4>Auto Captions</h4>
        <p>Analyze audio tracks in the timeline and automatically generate text subtitles synced with dialogue.</p>
        <button className="cc-btn cc-btn--primary cc-auto-captions-btn" onClick={startAutoCaptions}>
          Generate Captions
        </button>
      </div>

      <div className="cc-auto-captions-box" style={{ opacity: 0.7 }}>
        <div className="cc-auto-captions-icon" style={{ background: '#27272a', color: '#a1a1aa' }}>✏️</div>
        <h4>Manual Subtitles</h4>
        <p>Type out captions line by line and place them on the subtitle track manually.</p>
        <button className="cc-btn cc-btn--ghost cc-auto-captions-btn" onClick={() => {
          const subTrack = state.tracks.find(t => t.kind === 'subtitle')?.id || 'trk_2';
          dispatch({
            type: 'clip/insertTitle',
            trackId: subTrack,
            start: state.playhead,
            duration: 3,
            title: {
              text: 'Double click to edit subtitle',
              preset: 'glass',
              font: 'Inter',
              weight: 600,
              size: 54,
              align: 'center',
              color: '#ffffff',
              isSubtitle: true
            }
          });
        }}>
          Add Subtitle Line
        </button>
      </div>
    </div>
  );
}

/* ===== 7. TRANSCRIPT TAB ===== */
function TranscriptTabContent({ state, dispatch, query }) {
  const lines = [
    { start: 0.5, end: 3.5, speaker: 'Speaker 1', text: 'Welcome to CineCutPro!' },
    { start: 4.0, end: 7.5, speaker: 'Speaker 1', text: 'The best browser-based video editor.' },
    { start: 8.0, end: 11.5, speaker: 'Speaker 1', text: "Let's create something amazing!" }
  ];

  const handleLineClick = (start) => {
    dispatch({ type: 'playback/setPlayhead', t: start });
  };

  const deleteTranscriptSection = (line) => {
    // Delete clips in the interval [line.start, line.end]
    dispatch({ type: 'toast/push', kind: 'warn', message: `Slicing and rippling out timecode ${line.start}s - ${line.end}s` });
    
    // Blade clip(s) at start and end times
    dispatch({ type: 'clip/blade', t: line.start });
    dispatch({ type: 'clip/blade', t: line.end });

    // Identify clips that lie within the interval and delete them
    setTimeout(() => {
      const clipsToDelete = state.clips.filter(c => c.start >= line.start - 0.05 && c.end <= line.end + 0.05);
      if (clipsToDelete.length > 0) {
        dispatch({ type: 'clip/delete', ids: clipsToDelete.map(c => c.id), ripple: true });
        dispatch({ type: 'toast/push', kind: 'success', message: 'Rippled out transcript segment from timeline!' });
      }
    }, 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="cc-transcript-header">Dialogue Transcription</div>
      <div className="cc-transcript-box">
        {lines.filter(l => query ? l.text.toLowerCase().includes(query.toLowerCase()) : true).map((line, idx) => (
          <div key={idx} className="cc-transcript-line">
            <span className="cc-transcript-time" onClick={() => handleLineClick(line.start)}>
              [{line.start.toFixed(1)}s]
            </span>
            <span className="cc-transcript-text">
              <strong>{line.speaker}:</strong> {line.text}
            </span>
            <span className="cc-transcript-del" onClick={() => deleteTranscriptSection(line)} title="Delete dialogue segment & ripple timeline">
              🗑️
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#71717a', fontStyle: 'italic', padding: '0 4px' }}>
        * Clicking the timestamp seeks playhead. Clicking trash edits audio transcript.
      </div>
    </div>
  );
}

/* ===== 8. EFFECTS TAB ===== */
function EffectsTabContent({ state, dispatch, query }) {
  const allRegistryEffects = useMemo(() => getAllEffects(), []);

  const applyEffect = (effectId) => {
    const activeId = state.selectedClipIds[0];
    if (!activeId) {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Please select a clip on the timeline first!' });
      return;
    }
    const inst = createEffectInstance(effectId);
    if (!inst) return;
    dispatch({
      type: 'clip/addEffect',
      id: activeId,
      effect: inst
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Added effect: ${effectId}` });
  };

  const filteredEffects = useMemo(() => {
    if (!query) return allRegistryEffects;
    const q = query.toLowerCase();
    return allRegistryEffects.filter(
      (e) => e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q)
    );
  }, [allRegistryEffects, query]);

  // Group by group name
  const grouped = useMemo(() => {
    const groups = {};
    for (const e of filteredEffects) {
      groups[e.group] = groups[e.group] ?? [];
      groups[e.group].push(e);
    }
    return groups;
  }, [filteredEffects]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Object.entries(grouped).map(([groupName, list]) => (
        <div key={groupName} className="cc-template-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="cc-template-row__header" style={{ margin: 0 }}>
            <span className="cc-template-row__title" style={{ fontSize: '12px', opacity: 0.8 }}>
              {groupName}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {list.map((eff) => (
              <div
                key={eff.id}
                className="cc-element-card"
                onClick={() => applyEffect(eff.id)}
                style={{ cursor: 'pointer', padding: '8px' }}
              >
                <div style={{
                  height: '42px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 'bold',
                  fontSize: '10px',
                  color: '#e0aaff',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  ✨ {eff.label.slice(0, 12)}
                </div>
                <div className="cc-element-card__info" style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 0 0' }}>
                  {eff.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {filteredEffects.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
          No matching effects found.
        </div>
      )}
    </div>
  );
}

/* ===== 9. TRANSITIONS TAB ===== */
function TransitionsTabContent({ state, dispatch, query }) {
  const applyTransition = (kind) => {
    const activeId = state.selectedClipIds[0];
    if (!activeId) {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Select a clip to apply transition!' });
      return;
    }
    dispatch({
      type: 'transition/apply',
      clipId: activeId,
      side: 'in',
      kind,
      duration: 0.6
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Applied ${kind} transition to selected clip` });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {TRANSITIONS.filter(t => query ? t.label.toLowerCase().includes(query.toLowerCase()) : true).map((t) => (
        <div
          key={t.id}
          className="cc-element-card"
          onClick={() => applyTransition(t.id)}
          style={{ padding: '8px' }}
        >
          <div style={{
            height: '42px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #27272a 0%, #1e1b4b 100%)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            ⚡ {t.label}
          </div>
          <div className="cc-element-card__info" style={{ fontSize: '11px' }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ===== 10. FILTERS TAB ===== */
function FiltersTabContent({ state, dispatch, query }) {
  const filters = [
    { name: 'Warm Summer', values: { brightness: 1.05, contrast: 1.1, saturation: 1.25, hueRotate: 5 } },
    { name: 'Cool Nordic', values: { brightness: 0.95, contrast: 1.05, saturation: 0.75, hueRotate: -10 } },
    { name: 'Teal & Orange', values: { brightness: 1.0, contrast: 1.15, saturation: 1.35, hueRotate: -5 } },
    { name: 'Golden Glow', values: { brightness: 1.1, contrast: 1.0, saturation: 1.2, hueRotate: 15 } },
    { name: 'Noir Classic', values: { brightness: 1.05, contrast: 1.4, saturation: 0, hueRotate: 0 } },
    { name: 'Acid Punch', values: { brightness: 1.2, contrast: 1.3, saturation: 1.6, hueRotate: 45 } }
  ];

  const applyFilter = (f) => {
    const activeId = state.selectedClipIds[0];
    if (!activeId) {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Select a clip to apply filter!' });
      return;
    }
    dispatch({
      type: 'clip/updateFilters',
      id: activeId,
      patch: f.values
    });
    dispatch({ type: 'toast/push', kind: 'success', message: `Applied filter: ${f.name}` });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {filters.filter(f => query ? f.name.toLowerCase().includes(query.toLowerCase()) : true).map((f, idx) => (
        <div
          key={idx}
          className="cc-element-card"
          onClick={() => applyFilter(f)}
          style={{ padding: '8px' }}
        >
          <div style={{
            height: '42px',
            borderRadius: '4px',
            background: `linear-gradient(135deg, hsl(${(idx * 60) % 360} 40% 20%) 0%, #18181c 100%)`,
            display: 'grid',
            placeItems: 'center',
            fontSize: '10px',
            color: '#fff',
            fontWeight: 'bold'
          }}>
            🎨 {f.name}
          </div>
          <div className="cc-element-card__info" style={{ fontSize: '11px' }}>{f.name}</div>
        </div>
      ))}
    </div>
  );
}

/* ===== 11. BRAND KIT TAB ===== */
function BrandKitTabContent({ state, dispatch }) {
  const brandColors = ['#ff007f', '#00ffcc', '#ffd700', '#7b2cbf', '#ffffff', '#000000'];
  const [activeColor, setActiveColor] = useState('#ff007f');

  const brandFonts = ['Inter', 'Space Grotesk', 'JetBrains Mono', 'Roboto'];
  const [activeFont, setActiveFont] = useState('Space Grotesk');

  const addBrandLogo = () => {
    // Insert CineCutPro brand title logo
    const track = state.tracks.find(t => t.kind === 'title')?.id || 'trk_1';
    dispatch({
      type: 'clip/insertTitle',
      trackId: track,
      start: state.playhead,
      duration: 5,
      title: {
        text: 'CINECUTPRO',
        preset: 'glass',
        font: activeFont,
        weight: 800,
        size: 72,
        align: 'center',
        color: activeColor
      }
    });
    dispatch({ type: 'toast/push', kind: 'success', message: 'Inserted brand title asset at playhead' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Brand colors */}
      <div className="cc-brand-section">
        <h5>Brand Colors</h5>
        <div className="cc-brand-colors">
          {brandColors.map(c => (
            <div
              key={c}
              className={`cc-brand-color-dot ${activeColor === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setActiveColor(c);
                dispatch({ type: 'toast/push', kind: 'info', message: `Brand color set to: ${c}` });
              }}
            />
          ))}
        </div>
      </div>

      {/* Brand fonts */}
      <div className="cc-brand-section">
        <h5>Brand Fonts</h5>
        <div className="cc-brand-fonts">
          {brandFonts.map(f => (
            <div
              key={f}
              className={`cc-brand-font-card ${activeFont === f ? 'is-active' : ''}`}
              onClick={() => {
                setActiveFont(f);
                dispatch({ type: 'toast/push', kind: 'info', message: `Brand font set to: ${f}` });
              }}
            >
              <div className="cc-brand-font-name" style={{ fontFamily: f }}>{f}</div>
              <div className="cc-brand-font-preview">AaBbCc123</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand logos */}
      <div className="cc-brand-section">
        <h5>Brand Assets</h5>
        <div className="cc-brand-logo-card" onClick={addBrandLogo}>
          <div className="cc-brand-logo-thumb">CCP</div>
          <div>
            <div className="cc-brand-logo-name">Watermark Logo</div>
            <div style={{ fontSize: '10px', color: '#71717a', marginTop: '2px' }}>Click to insert brand title overlay</div>
          </div>
        </div>
      </div>
    </div>
  );
}
