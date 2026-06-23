import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatHMS } from '../engine/timecode.js';

const kindFromFile = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  return 'video';
};

/** Probe a file to learn its duration and a thumbnail without blocking the UI. */
function probe(file, src, kind) {
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
        // Try to snap a thumbnail at 0.5s
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
}

export function MediaLibrary() {
  const { state, dispatch } = useEditor();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState('');
  const [hoverId, setHoverId] = useState(null);

  const ingest = useCallback(
    async (files) => {
      const items = await Promise.all(
        Array.from(files).map(async (file) => {
          const src = URL.createObjectURL(file);
          const kind = kindFromFile(file);
          const meta = await probe(file, src, kind);
          return {
            name: file.name,
            kind,
            src,
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
    },
    [dispatch]
  );

  const onFiles = useCallback(
    (e) => {
      if (e.target.files?.length) ingest(e.target.files);
      e.target.value = '';
    },
    [ingest]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
    },
    [ingest]
  );

  const onDoubleClick = useCallback(
    (id) => {
      dispatch({ type: 'source/load', id });
    },
    [dispatch]
  );

  const onDragMediaStart = useCallback((id) => (e) => {
    e.dataTransfer.setData('application/x-cinecut-media', id);
    e.dataTransfer.effectAllowed = 'copyMove';
  }, []);

  const filtered = useMemo(
    () =>
      state.media.filter((m) =>
        filter ? m.name.toLowerCase().includes(filter.toLowerCase()) : true
      ),
    [state.media, filter]
  );

  return (
    <aside className="cc-panel cc-media">
      <header className="cc-panel__header">
        <div className="cc-panel__title">
          <Icon.Layers size={16} /> Media Library
          <span className="cc-panel__count">{state.media.length}</span>
        </div>
        <div className="cc-panel__actions">
          <button
            className="cc-icon-btn"
            onClick={() => inputRef.current?.click()}
            title="Import media"
          >
            <Icon.Upload size={15} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            hidden
            onChange={onFiles}
          />
        </div>
      </header>

      <div className="cc-media__search">
        <Icon.Search size={14} />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter clips…"
        />
      </div>

      <div
        className={`cc-media__list ${dragOver ? 'is-drop' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {filtered.length === 0 && (
          <div className="cc-media__empty">
            <div className="cc-media__empty-icon">
              <Icon.Upload size={28} />
            </div>
            <div className="cc-media__empty-title">Drop media here</div>
            <div className="cc-media__empty-sub">
              video, audio, or images — or click <span className="cc-kbd">import</span>
            </div>
          </div>
        )}
        {filtered.map((m) => (
          <article
            key={m.id}
            className="cc-clip-card"
            draggable
            onDragStart={onDragMediaStart(m.id)}
            onDoubleClick={() => onDoubleClick(m.id)}
            onMouseEnter={() => setHoverId(m.id)}
            onMouseLeave={() => setHoverId((c) => (c === m.id ? null : c))}
            title="Double-click to load in Source Monitor — drag onto timeline to insert"
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
                  title="Make subclip from current source in/out"
                  onClick={(e) => {
                    e.stopPropagation();
                    const src = state.source;
                    if (src.mediaId !== m.id) {
                      dispatch({ type: 'source/load', id: m.id });
                      return;
                    }
                    const i = src.inPoint ?? 0;
                    const o = src.outPoint ?? m.duration;
                    if (o > i) {
                      dispatch({ type: 'media/addSubclip', id: m.id, inPoint: i, outPoint: o });
                    }
                  }}
                >
                  <Icon.Plus size={13} />
                </button>
                <button
                  className="cc-icon-btn cc-icon-btn--xs cc-icon-btn--danger"
                  title="Remove from library"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'media/remove', id: m.id });
                  }}
                >
                  <Icon.Trash size={13} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
