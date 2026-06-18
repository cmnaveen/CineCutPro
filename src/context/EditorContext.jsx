import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';

export const EditorContext = createContext();

const DEFAULT_TRACKS = [
  { id: 'sub1', name: 'Subtitles', type: 'subtitle', muted: false, solo: false, locked: false },
  { id: 'v2', name: 'Video 2 (Overlay)', type: 'video', muted: false, solo: false, locked: false },
  { id: 'v1', name: 'Video 1 (Primary)', type: 'video', muted: false, solo: false, locked: false },
  { id: 'a1', name: 'Audio 1', type: 'audio', muted: false, solo: false, locked: false, volume: 1.0 },
  { id: 'a2', name: 'Audio 2', type: 'audio', muted: false, solo: false, locked: false, volume: 1.0 },
  { id: 't1', name: 'Text Track', type: 'text', muted: false, solo: false, locked: false },
];

export const EditorProvider = ({ children }) => {
  // Core State
  const [tracks, setTracks] = useState(DEFAULT_TRACKS);
  const [clips, setClips] = useState([]);
  const [mediaLibrary, setMediaLibrary] = useState([]);

  // Source Monitor State (Dual Viewers)
  const [sourceAsset, setSourceAsset] = useState(null);
  const [sourcePlayhead, setSourcePlayhead] = useState(0);
  const [sourceIn, setSourceIn] = useState(0);
  const [sourceOut, setSourceOut] = useState(0);
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Variable playback speed (1x, 2x, 4x, etc.)
  
  // Selection and Navigation
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [playhead, setPlayhead] = useState(0); // in seconds
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [zoom, setZoom] = useState(30); // pixels per second
  const [snapping, setSnapping] = useState(true);
  const [tool, setTool] = useState('select'); // 'select' | 'blade'

  // Looping Region
  const [looping, setLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(10);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Calculate dynamic duration
  const timelineDuration = Math.max(
    10,
    ...clips.map(c => c.timelinePos + c.duration),
    loopEnd
  );

  // Keep a ref to clips for frame-ticks (to avoid closure stale issues in render loops)
  const clipsRef = useRef(clips);
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  // History Helper: Push current state to undo stack
  const saveHistory = useCallback((currentTracks = tracks, currentClips = clips, currentMedia = mediaLibrary) => {
    const snapshot = {
      tracks: JSON.parse(JSON.stringify(currentTracks)),
      clips: JSON.parse(JSON.stringify(currentClips)),
      mediaLibrary: currentMedia.map(m => ({ ...m })), // media urls cannot easily be deep cloned if DOM references are inside, but metadata is fine
    };
    setUndoStack(prev => [...prev.slice(-49), snapshot]); // max 50 levels
    setRedoStack([]);
  }, [tracks, clips, mediaLibrary]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    // Save current to redo stack
    const currentSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      mediaLibrary: mediaLibrary.map(m => ({ ...m })),
    };
    
    setRedoStack(prev => [...prev, currentSnapshot]);
    setUndoStack(newUndoStack);

    // Apply previous
    setTracks(previous.tracks);
    setClips(previous.clips);
    setMediaLibrary(previous.mediaLibrary);
    
    // Reset selection if active clip is removed in undo
    if (selectedClipId && !previous.clips.find(c => c.id === selectedClipId)) {
      setSelectedClipId(null);
    }
  }, [undoStack, tracks, clips, mediaLibrary, selectedClipId]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    // Save current to undo stack
    const currentSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      mediaLibrary: mediaLibrary.map(m => ({ ...m })),
    };

    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack(newRedoStack);

    // Apply next
    setTracks(next.tracks);
    setClips(next.clips);
    setMediaLibrary(next.mediaLibrary);
  }, [redoStack, tracks, clips, mediaLibrary]);

  // Media Library Operations
  const addMediaAsset = useCallback((asset) => {
    setMediaLibrary(prev => {
      const updated = [...prev, asset];
      saveHistory(tracks, clips, updated);
      return updated;
    });
  }, [tracks, clips, saveHistory]);

  const removeMediaAsset = useCallback((assetId) => {
    setMediaLibrary(prev => {
      const updated = prev.filter(a => a.id !== assetId);
      // Also clean up any clips referencing this media
      const updatedClips = clips.filter(c => c.mediaId !== assetId);
      setClips(updatedClips);
      saveHistory(tracks, updatedClips, updated);
      return updated;
    });
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip && clip.mediaId === assetId) {
        setSelectedClipId(null);
      }
    }
  }, [clips, tracks, selectedClipId, saveHistory]);

  // Timeline Clip Operations
  const addClip = useCallback((trackId, asset, timelinePos = 0) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    // Check overlaps
    const clipDuration = asset.duration || 5; // default 5s
    const proposedEnd = timelinePos + clipDuration;

    // Optional overlap prevention: slide position to fit
    let adjustedPos = timelinePos;
    let overlapping = true;
    let attempts = 0;
    while (overlapping && attempts < 100) {
      const hasOverlap = clips.some(c => 
        c.trackId === trackId && 
        ((adjustedPos >= c.timelinePos && adjustedPos < c.timelinePos + c.duration) ||
         (adjustedPos + clipDuration > c.timelinePos && adjustedPos + clipDuration <= c.timelinePos + c.duration) ||
         (adjustedPos <= c.timelinePos && adjustedPos + clipDuration >= c.timelinePos + c.duration))
      );
      if (hasOverlap) {
        adjustedPos += 0.5; // shift forward
        attempts++;
      } else {
        overlapping = false;
      }
    }

    const newClip = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      trackId,
      name: asset.name,
      mediaType: asset.type,
      mediaId: asset.id,
      sourceUrl: asset.url,
      srcIn: 0,
      srcOut: clipDuration,
      timelinePos: adjustedPos,
      duration: clipDuration,
      speed: 1.0,
      volume: 1.0,
      opacity: 1.0,
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      effects: [],
      keyframes: {
        opacity: [],
        volume: [],
        scale: [],
        rotation: [],
        brightness: [],
        contrast: [],
        saturation: [],
        blur: [],
      }
    };

    saveHistory(tracks, [...clips, newClip]);
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setSelectedTrackId(trackId);
  }, [clips, tracks, saveHistory]);

  const addTextClip = useCallback((timelinePos = 0) => {
    const textTrack = tracks.find(t => t.type === 'text') || tracks[tracks.length - 1];
    const clipDuration = 5.0; // default 5 seconds
    
    // Simple overlap prevention: slide position to fit
    let adjustedPos = timelinePos;
    let overlapping = true;
    let attempts = 0;
    while (overlapping && attempts < 100) {
      const hasOverlap = clips.some(c => 
        c.trackId === textTrack.id && 
        ((adjustedPos >= c.timelinePos && adjustedPos < c.timelinePos + c.duration) ||
         (adjustedPos + clipDuration > c.timelinePos && adjustedPos + clipDuration <= c.timelinePos + c.duration) ||
         (adjustedPos <= c.timelinePos && adjustedPos + clipDuration >= c.timelinePos + c.duration))
      );
      if (hasOverlap) {
        adjustedPos += 0.5; // shift forward
        attempts++;
      } else {
        overlapping = false;
      }
    }

    const newClip = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      trackId: textTrack.id,
      name: 'Text Title Overlay',
      mediaType: 'text',
      mediaId: 'text_asset',
      sourceUrl: '',
      srcIn: 0,
      srcOut: clipDuration,
      timelinePos: adjustedPos,
      duration: clipDuration,
      speed: 1.0,
      volume: 1.0,
      opacity: 1.0,
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      effects: [],
      textColor: '#ffffff',
      fontSize: 80,
      fontFamily: 'Outfit',
      keyframes: {
        opacity: [],
        volume: [],
        scale: [],
        rotation: [],
        brightness: [],
        contrast: [],
        saturation: [],
        blur: [],
      }
    };

    saveHistory(tracks, [...clips, newClip]);
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setSelectedTrackId(textTrack.id);
  }, [clips, tracks, saveHistory]);

  const moveClip = useCallback((clipId, newTimelinePos, newTrackId = null) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const targetTrackId = newTrackId || c.trackId;
      
      // Snapping logic if enabled
      let snapPos = newTimelinePos;
      if (snapping) {
        const snapThreshold = 0.2; // snap within 0.2s
        const snapTargets = [0, playhead, loopStart, loopEnd];
        
        // Add other clip boundary targets
        prev.forEach(other => {
          if (other.id !== clipId) {
            snapTargets.push(other.timelinePos);
            snapTargets.push(other.timelinePos + other.duration);
          }
        });

        for (const target of snapTargets) {
          // Snap left edge
          if (Math.abs(snapPos - target) < snapThreshold) {
            snapPos = target;
            break;
          }
          // Snap right edge
          if (Math.abs((snapPos + c.duration) - target) < snapThreshold) {
            snapPos = target - c.duration;
            break;
          }
        }
      }

      // Overlap checks within the same track
      const hasOverlap = prev.some(other => 
        other.id !== clipId && 
        other.trackId === targetTrackId && 
        ((snapPos >= other.timelinePos && snapPos < other.timelinePos + other.duration) ||
         (snapPos + c.duration > other.timelinePos && snapPos + c.duration <= other.timelinePos + other.duration) ||
         (snapPos <= other.timelinePos && snapPos + c.duration >= other.timelinePos + other.duration))
      );

      // Only apply track shift if no overlap, else only allow timeline shift on original track
      if (hasOverlap) {
        // Fallback to original track and try to place without overlap
        const originalTrackOverlap = prev.some(other => 
          other.id !== clipId && 
          other.trackId === c.trackId && 
          ((snapPos >= other.timelinePos && snapPos < other.timelinePos + other.duration) ||
           (snapPos + c.duration > other.timelinePos && snapPos + c.duration <= other.timelinePos + other.duration))
        );
        if (originalTrackOverlap) {
          return c; // block movement if overlaps everywhere
        }
        return { ...c, timelinePos: snapPos };
      }

      return { ...c, timelinePos: Math.max(0, snapPos), trackId: targetTrackId };
    }));
  }, [snapping, playhead, loopStart, loopEnd, saveHistory]);

  const trimClip = useCallback((clipId, edge, newTime) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      
      const asset = mediaLibrary.find(m => m.id === c.mediaId) || { duration: 9999 };
      const maxDuration = asset.duration || 9999;

      if (edge === 'left') {
        // Trimming left changes: timelinePos, srcIn, and duration
        const delta = newTime - c.timelinePos;
        const newSrcIn = Math.max(0, c.srcIn + delta);
        const actualDelta = newSrcIn - c.srcIn;
        const newTimelinePos = c.timelinePos + actualDelta;
        const newDuration = Math.max(0.1, c.duration - actualDelta);

        // Check left-side overlap boundary
        const leftOverlap = prev.find(other => 
          other.id !== clipId && 
          other.trackId === c.trackId && 
          other.timelinePos + other.duration > newTimelinePos && 
          other.timelinePos < newTimelinePos
        );
        if (leftOverlap) return c;

        return {
          ...c,
          timelinePos: newTimelinePos,
          srcIn: newSrcIn,
          duration: newDuration,
          srcOut: c.srcIn + newDuration,
        };
      } else {
        // Trimming right changes: srcOut, and duration
        const newDuration = Math.max(0.1, Math.min(maxDuration - c.srcIn, newTime - c.timelinePos));
        
        // Check right-side overlap boundary
        const rightOverlap = prev.find(other => 
          other.id !== clipId && 
          other.trackId === c.trackId && 
          other.timelinePos < c.timelinePos + newDuration && 
          other.timelinePos > c.timelinePos
        );
        if (rightOverlap) return c;

        return {
          ...c,
          duration: newDuration,
          srcOut: c.srcIn + newDuration,
        };
      }
    }));
  }, [mediaLibrary, saveHistory]);

  const splitClip = useCallback((clipId, splitTime) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const relativeSplit = splitTime - clip.timelinePos;
    if (relativeSplit <= 0.1 || relativeSplit >= clip.duration - 0.1) return; // ignore edge splits

    saveHistory();

    const leftClip = {
      ...clip,
      duration: relativeSplit,
      srcOut: clip.srcIn + relativeSplit,
    };

    const rightClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timelinePos: splitTime,
      duration: clip.duration - relativeSplit,
      srcIn: clip.srcIn + relativeSplit,
      effects: JSON.parse(JSON.stringify(clip.effects)),
    };

    setClips(prev => {
      const filtered = prev.filter(c => c.id !== clipId);
      return [...filtered, leftClip, rightClip];
    });
    setSelectedClipId(rightClip.id);
  }, [clips, saveHistory]);

  const deleteClip = useCallback((clipId) => {
    saveHistory();
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  }, [selectedClipId, saveHistory]);

  const duplicateClip = useCallback((clipId) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    saveHistory();
    // Place it directly after the original clip if no overlap, or find next free space
    const targetPos = clip.timelinePos + clip.duration;
    
    const duplicate = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timelinePos: targetPos,
    };

    // Simple auto-adjust duplicate position if overlaps
    let adjustedPos = targetPos;
    let overlapping = true;
    while (overlapping) {
      const hasOverlap = clips.some(c => 
        c.trackId === clip.trackId && 
        ((adjustedPos >= c.timelinePos && adjustedPos < c.timelinePos + c.duration) ||
         (adjustedPos + clip.duration > c.timelinePos && adjustedPos + clip.duration <= c.timelinePos + c.duration))
      );
      if (hasOverlap) {
        adjustedPos += 0.5;
      } else {
        overlapping = false;
      }
    }
    duplicate.timelinePos = adjustedPos;

    setClips(prev => [...prev, duplicate]);
    setSelectedClipId(duplicate.id);
  }, [clips, saveHistory]);

  const updateClipProperties = useCallback((clipId, properties) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      
      const updated = { ...c };
      if (properties.transform) {
        updated.transform = { ...c.transform, ...properties.transform };
      }
      if (properties.crop) {
        updated.crop = { ...c.crop, ...properties.crop };
      }
      if (properties.opacity !== undefined) {
        updated.opacity = parseFloat(properties.opacity);
      }
      if (properties.volume !== undefined) {
        updated.volume = parseFloat(properties.volume);
      }
      if (properties.speed !== undefined) {
        updated.speed = parseFloat(properties.speed);
      }
      if (properties.name !== undefined) {
        updated.name = properties.name;
      }
      if (properties.textColor !== undefined) {
        updated.textColor = properties.textColor;
      }
      if (properties.fontSize !== undefined) {
        updated.fontSize = parseInt(properties.fontSize);
      }
      if (properties.fontFamily !== undefined) {
        updated.fontFamily = properties.fontFamily;
      }
      return updated;
    }));
  }, [saveHistory]);

  // Effects operations
  const addEffect = useCallback((clipId, effectType) => {
    saveHistory();
    
    let defaultParams = {};
    if (effectType === 'ColorGrade') {
      defaultParams = { brightness: 0, contrast: 1.0, saturation: 1.0, hue: 0, temperature: 0 };
    } else if (effectType === 'Blur') {
      defaultParams = { radius: 0 };
    } else if (effectType === 'Vignette') {
      defaultParams = { strength: 0.5, radius: 0.5, softness: 0.5 };
    } else if (effectType === 'ChromaKey') {
      defaultParams = { keyColor: '#00ff00', threshold: 0.2, feather: 0.1 };
    }

    const newEffect = {
      id: `eff_${Date.now()}`,
      type: effectType,
      enabled: true,
      params: defaultParams,
    };

    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      return { ...c, effects: [...c.effects, newEffect] };
    }));
  }, [saveHistory]);

  const updateEffectParam = useCallback((clipId, effectId, paramName, val) => {
    // Note: To make slider scrubbing smooth and avoid polluting history with 100 snapshots,
    // we can either throttle saveHistory or save only on slider release. For simplicity,
    // we save history but update state immediately.
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      return {
        ...c,
        effects: c.effects.map(eff => {
          if (eff.id !== effectId) return eff;
          return {
            ...eff,
            params: { ...eff.params, [paramName]: val }
          };
        })
      };
    }));
  }, []);

  const toggleEffectEnabled = useCallback((clipId, effectId) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      return {
        ...c,
        effects: c.effects.map(eff => {
          if (eff.id !== effectId) return eff;
          return { ...eff, enabled: !eff.enabled };
        })
      };
    }));
  }, [saveHistory]);

  const deleteEffect = useCallback((clipId, effectId) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      return {
        ...c,
        effects: c.effects.filter(eff => eff.id !== effectId)
      };
    }));
  }, [saveHistory]);

  // Keyframes operations
  const toggleKeyframe = useCallback((clipId, property, time, value) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      
      const curve = c.keyframes[property] || [];
      const exists = curve.find(k => Math.abs(k.time - time) < 0.05);

      let updatedCurve;
      if (exists) {
        // Remove keyframe
        updatedCurve = curve.filter(k => Math.abs(k.time - time) >= 0.05);
      } else {
        // Add keyframe
        const newKey = {
          time: parseFloat(time.toFixed(3)),
          value: parseFloat(value),
          interp: 'linear'
        };
        updatedCurve = [...curve, newKey].sort((a, b) => a.time - b.time);
      }

      return {
        ...c,
        keyframes: {
          ...c.keyframes,
          [property]: updatedCurve
        }
      };
    }));
  }, [saveHistory]);

  const updateKeyframeValue = useCallback((clipId, property, keyframeTime, newValue) => {
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const curve = c.keyframes[property] || [];
      return {
        ...c,
        keyframes: {
          ...c.keyframes,
          [property]: curve.map(k => {
            if (Math.abs(k.time - keyframeTime) < 0.05) {
              return { ...k, value: parseFloat(newValue) };
            }
            return k;
          })
        }
      };
    }));
  }, []);

  // Track settings (volume, mute, solo, lock)
  const setTrackProperty = useCallback((trackId, prop, value) => {
    saveHistory();
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, [prop]: value };
    }));
  }, [saveHistory]);

  // Three-point Editing: Insert Clip with Ripple
  const insertClip = useCallback(() => {
    if (!sourceAsset) return;
    saveHistory();

    // Determine target track
    let targetTrackId = selectedTrackId;
    let targetTrack = tracks.find(t => t.id === targetTrackId);
    const isCompatible = targetTrack && (
      (sourceAsset.type === 'audio' && targetTrack.type === 'audio') ||
      (sourceAsset.type !== 'audio' && targetTrack.type !== 'audio')
    );

    if (!isCompatible) {
      const firstComp = tracks.find(t => 
        sourceAsset.type === 'audio' ? t.type === 'audio' : t.type !== 'audio'
      );
      if (!firstComp) return;
      targetTrackId = firstComp.id;
    }

    const clipDuration = sourceOut - sourceIn;
    if (clipDuration <= 0) return;

    setClips(prev => {
      let updatedClips = [...prev];

      // A. Check for spanning clips to split
      const spanningClip = updatedClips.find(c => 
        c.trackId === targetTrackId && 
        playhead > c.timelinePos && 
        playhead < c.timelinePos + c.duration
      );

      if (spanningClip) {
        const relativeSplit = playhead - spanningClip.timelinePos;
        const leftClip = {
          ...spanningClip,
          duration: relativeSplit,
          srcOut: spanningClip.srcIn + relativeSplit,
        };
        const rightClip = {
          ...JSON.parse(JSON.stringify(spanningClip)),
          id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timelinePos: playhead,
          duration: spanningClip.duration - relativeSplit,
          srcIn: spanningClip.srcIn + relativeSplit,
        };

        updatedClips = updatedClips.filter(c => c.id !== spanningClip.id);
        updatedClips.push(leftClip, rightClip);
      }

      // B. Ripple/Shift all subsequent clips forward on target track
      updatedClips = updatedClips.map(c => {
        if (c.trackId === targetTrackId && c.timelinePos >= playhead - 0.001) {
          return { ...c, timelinePos: c.timelinePos + clipDuration };
        }
        return c;
      });

      // C. Append the new clip
      const newClip = {
        id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        trackId: targetTrackId,
        name: sourceAsset.name + " (Subclip)",
        mediaType: sourceAsset.type,
        mediaId: sourceAsset.id,
        sourceUrl: sourceAsset.url,
        srcIn: sourceIn,
        srcOut: sourceOut,
        timelinePos: playhead,
        duration: clipDuration,
        speed: 1.0,
        volume: 1.0,
        opacity: 1.0,
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
        transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
        effects: [],
        keyframes: {
          opacity: [], volume: [], scale: [], rotation: [],
          brightness: [], contrast: [], saturation: [], blur: []
        }
      };
      updatedClips.push(newClip);
      return updatedClips;
    });

    setPlayhead(prev => prev + clipDuration);
  }, [sourceAsset, sourceIn, sourceOut, playhead, selectedTrackId, tracks, saveHistory]);

  // Three-point Editing: Overwrite Clip
  const overwriteClip = useCallback(() => {
    if (!sourceAsset) return;
    saveHistory();

    let targetTrackId = selectedTrackId;
    let targetTrack = tracks.find(t => t.id === targetTrackId);
    const isCompatible = targetTrack && (
      (sourceAsset.type === 'audio' && targetTrack.type === 'audio') ||
      (sourceAsset.type !== 'audio' && targetTrack.type !== 'audio')
    );

    if (!isCompatible) {
      const firstComp = tracks.find(t => 
        sourceAsset.type === 'audio' ? t.type === 'audio' : t.type !== 'audio'
      );
      if (!firstComp) return;
      targetTrackId = firstComp.id;
    }

    const clipDuration = sourceOut - sourceIn;
    if (clipDuration <= 0) return;
    const endPos = playhead + clipDuration;

    setClips(prev => {
      let updatedClips = [];

      prev.forEach(c => {
        if (c.trackId !== targetTrackId) {
          updatedClips.push(c);
          return;
        }

        const cStart = c.timelinePos;
        const cEnd = c.timelinePos + c.duration;

        // Case 1: Engulfed -> delete
        if (cStart >= playhead && cEnd <= endPos) return;

        // Case 2: Spans across overwritten area -> split
        if (cStart < playhead && cEnd > endPos) {
          const leftDuration = playhead - cStart;
          const leftClip = {
            ...c,
            duration: leftDuration,
            srcOut: c.srcIn + leftDuration
          };
          const rightShift = endPos - cStart;
          const rightClip = {
            ...JSON.parse(JSON.stringify(c)),
            id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timelinePos: endPos,
            duration: c.duration - rightShift,
            srcIn: c.srcIn + rightShift
          };
          updatedClips.push(leftClip, rightClip);
          return;
        }

        // Case 3: Left overlap -> truncate
        if (cStart < playhead && cEnd > playhead && cEnd <= endPos) {
          const newDur = playhead - cStart;
          updatedClips.push({
            ...c,
            duration: newDur,
            srcOut: c.srcIn + newDur
          });
          return;
        }

        // Case 4: Right overlap -> shift and trim start
        if (cStart >= playhead && cStart < endPos && cEnd > endPos) {
          const rightCut = endPos - cStart;
          updatedClips.push({
            ...c,
            timelinePos: endPos,
            duration: c.duration - rightCut,
            srcIn: c.srcIn + rightCut
          });
          return;
        }

        updatedClips.push(c);
      });

      // Append overwritten clip
      const newClip = {
        id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        trackId: targetTrackId,
        name: sourceAsset.name + " (Overwrite)",
        mediaType: sourceAsset.type,
        mediaId: sourceAsset.id,
        sourceUrl: sourceAsset.url,
        srcIn: sourceIn,
        srcOut: sourceOut,
        timelinePos: playhead,
        duration: clipDuration,
        speed: 1.0,
        volume: 1.0,
        opacity: 1.0,
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
        transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
        effects: [],
        keyframes: {
          opacity: [], volume: [], scale: [], rotation: [],
          brightness: [], contrast: [], saturation: [], blur: []
        }
      };
      updatedClips.push(newClip);
      return updatedClips;
    });

    setPlayhead(endPos);
  }, [sourceAsset, sourceIn, sourceOut, playhead, selectedTrackId, tracks, saveHistory]);

  // Professional Smart Trimming: Ripple Trim
  const rippleTrim = useCallback((clipId, edge, newTime) => {
    saveHistory();
    setClips(prev => {
      const targetClip = prev.find(c => c.id === clipId);
      if (!targetClip) return prev;

      const asset = mediaLibrary.find(m => m.id === targetClip.mediaId) || { duration: 9999 };
      const maxDuration = asset.duration || 9999;
      const trackId = targetClip.trackId;

      let delta = 0;

      return prev.map(c => {
        if (c.trackId !== trackId) return c;

        if (c.id === clipId) {
          if (edge === 'left') {
            const proposedTimelinePos = Math.max(0, newTime);
            delta = proposedTimelinePos - c.timelinePos;
            
            const newSrcIn = Math.max(0, c.srcIn + delta);
            const actualDelta = newSrcIn - c.srcIn;
            const finalTimelinePos = c.timelinePos + actualDelta;
            const finalDuration = Math.max(0.1, c.duration - actualDelta);
            delta = actualDelta;

            return {
              ...c,
              timelinePos: finalTimelinePos,
              srcIn: newSrcIn,
              duration: finalDuration,
              srcOut: newSrcIn + finalDuration,
            };
          } else {
            const newDuration = Math.max(0.1, Math.min(maxDuration - c.srcIn, newTime - c.timelinePos));
            delta = newDuration - c.duration;

            return {
              ...c,
              duration: newDuration,
              srcOut: c.srcIn + newDuration,
            };
          }
        } else if (c.timelinePos > targetClip.timelinePos) {
          return {
            ...c,
            timelinePos: Math.max(0, c.timelinePos + delta)
          };
        }
        return c;
      });
    });
  }, [mediaLibrary, saveHistory]);

  // Professional Smart Trimming: Roll Edit
  const rollEdit = useCallback((clipAId, clipBId, newBoundaryTime) => {
    saveHistory();
    setClips(prev => {
      const clipA = prev.find(c => c.id === clipAId);
      const clipB = prev.find(c => c.id === clipBId);
      if (!clipA || !clipB) return prev;

      const assetA = mediaLibrary.find(m => m.id === clipA.mediaId) || { duration: 9999 };

      const newDurationA = Math.max(0.1, Math.min(assetA.duration - clipA.srcIn, newBoundaryTime - clipA.timelinePos));
      const actualBoundary = clipA.timelinePos + newDurationA;

      const deltaB = actualBoundary - clipB.timelinePos;
      const newSrcInB = Math.max(0, clipB.srcIn + deltaB);
      const actualDeltaB = newSrcInB - clipB.srcIn;
      const finalTimelinePosB = clipB.timelinePos + actualDeltaB;
      const finalDurationB = Math.max(0.1, clipB.duration - actualDeltaB);

      return prev.map(c => {
        if (c.id === clipAId) {
          return {
            ...c,
            duration: newDurationA,
            srcOut: c.srcIn + newDurationA,
          };
        }
        if (c.id === clipBId) {
          return {
            ...c,
            timelinePos: finalTimelinePosB,
            srcIn: newSrcInB,
            duration: finalDurationB,
            srcOut: newSrcInB + finalDurationB,
          };
        }
        return c;
      });
    });
  }, [mediaLibrary, saveHistory]);

  // Professional Smart Trimming: Slip Tool
  const slipClip = useCallback((clipId, deltaSec) => {
    saveHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const asset = mediaLibrary.find(m => m.id === c.mediaId) || { duration: 9999 };
      const maxDuration = asset.duration || 9999;
      
      let newSrcIn = c.srcIn + deltaSec;
      let newSrcOut = c.srcOut + deltaSec;

      if (newSrcIn < 0) {
        const shift = -newSrcIn;
        newSrcIn = 0;
        newSrcOut += shift;
      }
      if (newSrcOut > maxDuration) {
        const shift = newSrcOut - maxDuration;
        newSrcOut = maxDuration;
        newSrcIn = Math.max(0, newSrcIn - shift);
      }

      return {
        ...c,
        srcIn: newSrcIn,
        srcOut: newSrcOut,
        duration: newSrcOut - newSrcIn
      };
    }));
  }, [mediaLibrary, saveHistory]);

  // Professional Smart Trimming: Slide Tool
  const slideClip = useCallback((clipId, deltaSec) => {
    saveHistory();
    setClips(prev => {
      const target = prev.find(c => c.id === clipId);
      if (!target) return prev;

      const newPos = Math.max(0, target.timelinePos + deltaSec);
      const actualDelta = newPos - target.timelinePos;
      const trackId = target.trackId;

      const preceding = prev.find(c => c.trackId === trackId && Math.abs((c.timelinePos + c.duration) - target.timelinePos) < 0.1);
      const succeeding = prev.find(c => c.trackId === trackId && Math.abs(c.timelinePos - (target.timelinePos + target.duration)) < 0.1);

      return prev.map(c => {
        if (c.id === clipId) {
          return { ...c, timelinePos: newPos };
        }
        if (preceding && c.id === preceding.id) {
          const newDuration = Math.max(0.1, preceding.duration + actualDelta);
          return {
            ...c,
            duration: newDuration,
            srcOut: c.srcIn + newDuration
          };
        }
        if (succeeding && c.id === succeeding.id) {
          const newStart = Math.max(0, succeeding.timelinePos + actualDelta);
          const newDuration = Math.max(0.1, succeeding.duration - actualDelta);
          return {
            ...c,
            timelinePos: newStart,
            duration: newDuration,
            srcIn: Math.max(0, succeeding.srcIn + actualDelta),
            srcOut: Math.max(0.1, succeeding.srcOut)
          };
        }
        return c;
      });
    });
  }, [saveHistory]);

  // Add Subtitle Clip
  const addSubtitleClip = useCallback((timelinePos = 0) => {
    const subTrack = tracks.find(t => t.type === 'subtitle') || tracks[0];
    const clipDuration = 3.0; // default 3s
    
    let adjustedPos = timelinePos;
    let overlapping = true;
    let attempts = 0;
    while (overlapping && attempts < 100) {
      const hasOverlap = clips.some(c => 
        c.trackId === subTrack.id && 
        ((adjustedPos >= c.timelinePos && adjustedPos < c.timelinePos + c.duration) ||
         (adjustedPos + clipDuration > c.timelinePos && adjustedPos + clipDuration <= c.timelinePos + c.duration))
      );
      if (hasOverlap) {
        adjustedPos += 0.5;
        attempts++;
      } else {
        overlapping = false;
      }
    }

    const newClip = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      trackId: subTrack.id,
      name: 'New Subtitle Caption',
      mediaType: 'subtitle',
      mediaId: 'subtitle_asset',
      sourceUrl: '',
      srcIn: 0,
      srcOut: clipDuration,
      timelinePos: adjustedPos,
      duration: clipDuration,
      speed: 1.0,
      volume: 1.0,
      opacity: 1.0,
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      effects: [],
      textColor: '#ffffff',
      fontSize: 28,
      fontFamily: 'Inter',
      textBgOpacity: 0.65, // black box background
      keyframes: {
        opacity: [], volume: [], scale: [], rotation: [],
        brightness: [], contrast: [], saturation: [], blur: []
      }
    };

    saveHistory(tracks, [...clips, newClip]);
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setSelectedTrackId(subTrack.id);
  }, [clips, tracks, saveHistory]);

  // Interpolation helper to retrieve current animated property values
  const getInterpolatedValue = useCallback((clip, property, timelineTime, defaultValue) => {
    const curves = clip.keyframes;
    const curve = curves[property];
    if (!curve || curve.length === 0) {
      // Return static value if not keyframed
      if (property === 'opacity') return clip.opacity;
      if (property === 'volume') return clip.volume;
      if (property === 'scale') return clip.transform.scale;
      if (property === 'rotation') return clip.transform.rotation;
      
      // Check effects parameters
      for (const eff of clip.effects) {
        if (eff.enabled && eff.params[property] !== undefined) {
          return eff.params[property];
        }
      }
      return defaultValue;
    }

    const clipTime = timelineTime - clip.timelinePos;

    // Boundary checks
    if (clipTime <= curve[0].time) return curve[0].value;
    if (clipTime >= curve[curve.length - 1].time) return curve[curve.length - 1].value;

    // Find interpolation segment
    for (let i = 0; i < curve.length - 1; i++) {
      const k1 = curve[i];
      const k2 = curve[i + 1];
      if (clipTime >= k1.time && clipTime <= k2.time) {
        const t = (clipTime - k1.time) / (k2.time - k1.time);
        
        if (k1.interp === 'linear') {
          return k1.value + (k2.value - k1.value) * t;
        } else if (k1.interp === 'ease-in') {
          const easedT = t * t;
          return k1.value + (k2.value - k1.value) * easedT;
        } else if (k1.interp === 'ease-out') {
          const easedT = t * (2 - t);
          return k1.value + (k2.value - k1.value) * easedT;
        }
        return k1.value; // Hold fallback
      }
    }

    return defaultValue;
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Exclude shortcut execution if inside an input box
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Space -> Toggle Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(prev => !prev);
        setPlaybackSpeed(1.0);
      }
      
      // JKL Playback Controls
      if (e.code === 'KeyL') {
        e.preventDefault();
        setPlaying(true);
        setPlaybackSpeed(prev => {
          if (prev <= 0) return 1.0;
          if (prev === 1.0) return 2.0;
          if (prev === 2.0) return 4.0;
          return 4.0;
        });
      }
      if (e.code === 'KeyK') {
        e.preventDefault();
        setPlaying(false);
        setPlaybackSpeed(1.0);
      }
      if (e.code === 'KeyJ') {
        e.preventDefault();
        setPlaying(true);
        setPlaybackSpeed(prev => {
          if (prev >= 0) return -1.0;
          if (prev === -1.0) return -2.0;
          if (prev === -2.0) return -4.0;
          return -4.0;
        });
      }

      // ArrowLeft / ArrowRight -> Step 1 frame
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        setPlayhead(prev => Math.max(0, prev - step / fps));
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        setPlayhead(prev => Math.min(timelineDuration, prev + step / fps));
      }

      // Home / End -> Jump to start/end
      if (e.code === 'Home') {
        e.preventDefault();
        setPlayhead(0);
      }
      if (e.code === 'End') {
        e.preventDefault();
        setPlayhead(timelineDuration);
      }

      // Delete -> Delete active selection
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          deleteClip(selectedClipId);
        }
      }

      // BracketLeft / BracketRight -> Set Source In/Out
      if (e.code === 'BracketLeft') {
        e.preventDefault();
        setSourceIn(sourcePlayhead);
      }
      if (e.code === 'BracketRight') {
        e.preventDefault();
        setSourceOut(Math.max(sourcePlayhead, sourceIn + 0.1));
      }

      // F9 / F10 -> Insert / Overwrite
      if (e.code === 'F9') {
        e.preventDefault();
        insertClip();
      }
      if (e.code === 'F10') {
        e.preventDefault();
        overwriteClip();
      }

      // I / O -> Set Loop bounds
      if (e.code === 'KeyI') {
        e.preventDefault();
        setLoopStart(playhead);
        setLooping(true);
      }
      if (e.code === 'KeyO') {
        e.preventDefault();
        setLoopEnd(Math.max(playhead, loopStart + 0.1));
        setLooping(true);
      }

      // Ctrl + Z -> Undo, Ctrl + Y -> Redo
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        redo();
      }

      // Ctrl + D -> Duplicate clip
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        if (selectedClipId) {
          e.preventDefault();
          duplicateClip(selectedClipId);
        }
      }

      // B -> Blade tool, V -> Select tool, T -> Trim
      if (e.code === 'KeyB') {
        setTool('blade');
      }
      if (e.code === 'KeyV') {
        setTool('select');
      }
      if (e.code === 'KeyT') {
        setTool('trim');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playhead, selectedClipId, loopStart, loopEnd, fps, timelineDuration, undo, redo, deleteClip, duplicateClip, sourcePlayhead, sourceIn, sourceAsset, insertClip, overwriteClip]);

  return (
    <EditorContext.Provider value={{
      tracks, setTracks, setTrackProperty,
      clips, clipsRef, setClips, addClip, addTextClip, moveClip, trimClip, splitClip, deleteClip, duplicateClip, updateClipProperties,
      selectedClipId, setSelectedClipId,
      selectedTrackId, setSelectedTrackId,
      playhead, setPlayhead,
      playing, setPlaying,
      fps, setFps,
      zoom, setZoom,
      snapping, setSnapping,
      tool, setTool,
      looping, setLooping, loopStart, setLoopStart, loopEnd, setLoopEnd,
      mediaLibrary, setMediaLibrary, addMediaAsset, removeMediaAsset,
      undoStack, redoStack, undo, redo, saveHistory,
      timelineDuration,
      getInterpolatedValue,
      toggleKeyframe, updateKeyframeValue,
      
      // Source Monitor / JKL State
      sourceAsset, setSourceAsset,
      sourcePlayhead, setSourcePlayhead,
      sourceIn, setSourceIn,
      sourceOut, setSourceOut,
      sourcePlaying, setSourcePlaying,
      playbackSpeed, setPlaybackSpeed,
      
      // Editing operations
      insertClip, overwriteClip,
      rippleTrim, rollEdit, slipClip, slideClip,
      addSubtitleClip
    }}>
      {children}
    </EditorContext.Provider>
  );
};
