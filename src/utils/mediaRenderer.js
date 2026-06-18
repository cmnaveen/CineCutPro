/**
 * EditFree Web Video Editor — Canvas Rendering & Web Audio Mixing Pipeline
 * Composites multiple video tracks, applies transforms, crops, CSS GPU filters,
 * vignettes, and renders text layers. Integrates Web Audio API.
 */

// Cache offscreen canvases by layer ID to prevent layer drawing overrides
const offscreenCanvasCache = {};

const getOffscreenCanvas = (id, width, height) => {
  if (!offscreenCanvasCache[id]) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    offscreenCanvasCache[id] = { canvas, ctx };
  }
  const cache = offscreenCanvasCache[id];
  if (cache.canvas.width !== width || cache.canvas.height !== height) {
    cache.canvas.width = width;
    cache.canvas.height = height;
  }
  return cache;
};

/**
 * Main Video Compositor
 * Draws all active tracks at the current playhead time onto the display canvas.
 */
export const compositeTimelineFrame = ({
  displayCanvas,
  playheadTime,
  clips,
  tracks,
  mediaLibrary,
  getInterpolatedValue
}) => {
  if (!displayCanvas) return;
  const ctx = displayCanvas.getContext('2d');
  const width = displayCanvas.width;
  const height = displayCanvas.height;

  // 1. Clear display canvas with neutral dark background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  // 2. Identify active, unmuted tracks (sorted by Z-index: V1 first, then V2, then Text T1, then Subtitles)
  const trackOrder = ['v1', 'v2', 't1', 'sub1']; 
  const activeTracks = tracks
    .filter(t => !t.muted)
    .sort((a, b) => trackOrder.indexOf(a.id) - trackOrder.indexOf(b.id));

  // Determine if any track has 'solo' active; if so, only render solo tracks
  const soloActive = tracks.some(t => t.solo);
  const renderableTracks = soloActive ? activeTracks.filter(t => t.solo) : activeTracks;

  // 3. Process each track
  renderableTracks.forEach(track => {
    // Find active clips on this track
    const activeClips = clips.filter(c => 
      c.trackId === track.id && 
      playheadTime >= c.timelinePos && 
      playheadTime < c.timelinePos + c.duration
    );

    activeClips.forEach(clip => {
      // Adjustment Clip Downward compositing
      if (clip.mediaType === 'adjustment') {
        ctx.save();
        const { canvas: adjTempCanvas, ctx: adjTempCtx } = getOffscreenCanvas('adjustment_temp', width, height);
        adjTempCtx.clearRect(0, 0, width, height);
        adjTempCtx.drawImage(displayCanvas, 0, 0);

        let filterString = '';
        const opacity = getInterpolatedValue(clip, 'opacity', playheadTime, clip.opacity);

        clip.effects.forEach(eff => {
          if (!eff.enabled) return;

          if (eff.type === 'ColorGrade') {
            const brightness = getInterpolatedValue(clip, 'brightness', playheadTime, eff.params.brightness || 0);
            const contrast = getInterpolatedValue(clip, 'contrast', playheadTime, eff.params.contrast || 1.0);
            const saturation = getInterpolatedValue(clip, 'saturation', playheadTime, eff.params.saturation || 1.0);
            const hue = getInterpolatedValue(clip, 'hue', playheadTime, eff.params.hue || 0);

            const bPct = Math.round(100 + brightness * 100);
            const cPct = Math.round(contrast * 100);
            const sPct = Math.round(saturation * 100);
            
            filterString += ` brightness(${bPct}%) contrast(${cPct}%) saturate(${sPct}%) hue-rotate(${hue}deg)`;
          } else if (eff.type === 'Blur') {
            const radius = getInterpolatedValue(clip, 'blur', playheadTime, eff.params.radius || 0);
            filterString += ` blur(${radius}px)`;
          }
        });

        if (filterString.trim()) {
          ctx.filter = filterString.trim();
        }
        ctx.globalAlpha = opacity;
        ctx.drawImage(adjTempCanvas, 0, 0);
        ctx.restore();
        return;
      }

      // Subtitle Clip rendering (gorgeous closed caption overlay plate)
      if (clip.mediaType === 'subtitle') {
        ctx.save();
        const text = clip.name || 'Subtitle text';
        const fontSizeVal = clip.fontSize || 28;
        const fontFamily = clip.fontFamily || 'Inter';
        const textColor = clip.textColor || '#ffffff';
        const bgOpacity = clip.textBgOpacity !== undefined ? clip.textBgOpacity : 0.65;

        ctx.font = `500 ${fontSizeVal}px '${fontFamily}', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSizeVal;

        const paddingX = 20;
        const paddingY = 10;
        const pillWidth = textWidth + paddingX * 2;
        const pillHeight = textHeight + paddingY * 2;
        const pillX = width / 2 - pillWidth / 2;
        const pillY = height * 0.86 - pillHeight / 2;

        // Draw translucent dark container
        ctx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 8);
        ctx.fill();

        // Draw subtitle text
        ctx.fillStyle = textColor;
        ctx.fillText(text, width / 2, pillY + pillHeight / 2 + 1);
        ctx.restore();
        return;
      }

      // Find asset
      const asset = mediaLibrary.find(m => m.id === clip.mediaId);
      
      // Calculate relative play time within source clip
      const elapsed = playheadTime - clip.timelinePos;
      const clipTime = (elapsed * clip.speed) + clip.srcIn;

      // Get interpolated/animated property values
      const opacity = getInterpolatedValue(clip, 'opacity', playheadTime, clip.opacity);
      const scale = getInterpolatedValue(clip, 'scale', playheadTime, clip.transform.scale);
      const rotation = getInterpolatedValue(clip, 'rotation', playheadTime, clip.transform.rotation);
      const posX = getInterpolatedValue(clip, 'posX', playheadTime, clip.transform.x);
      const posY = getInterpolatedValue(clip, 'posY', playheadTime, clip.transform.y);

      // Create/Get offscreen canvas for rendering the clip source
      const { canvas: clipCanvas, ctx: clipCtx } = getOffscreenCanvas(clip.id, width, height);
      clipCtx.clearRect(0, 0, width, height);

      // Draw original source frame onto offscreen canvas
      if (clip.mediaType === 'text') {
        // Text rendering using custom style parameters
        const textColor = clip.textColor || '#ffffff';
        const fontSizeVal = clip.fontSize || 80;
        const fontFamily = clip.fontFamily || 'Outfit';
        
        clipCtx.fillStyle = textColor;
        clipCtx.font = `bold ${fontSizeVal}px '${fontFamily}', sans-serif`;
        clipCtx.textAlign = 'center';
        clipCtx.textBaseline = 'middle';
        // Add subtle shadow text
        clipCtx.shadowColor = 'rgba(0,0,0,0.8)';
        clipCtx.shadowBlur = 10;
        clipCtx.fillText(clip.name || 'Text Overlay', width/2, height/2);
        clipCtx.shadowBlur = 0; // reset
      } else if (asset && asset.draw) {
        // Procedural mock video or image
        asset.draw(clipCtx, clipTime);
      } else if (asset && asset.element) {
        // Real HTML5 Video/Image loaded
        try {
          if (clip.mediaType === 'video') {
            // Set HTMLVideoElement time if not playing (only scrub) or let it play
            const videoEl = asset.element;
            // Draw HTML5 Video
            clipCtx.drawImage(videoEl, 0, 0, width, height);
          } else if (clip.mediaType === 'image') {
            clipCtx.drawImage(asset.element, 0, 0, width, height);
          }
        } catch (e) {
          // Fallback if media loading failed
          clipCtx.fillStyle = '#ef4444';
          clipCtx.font = '24px sans-serif';
          clipCtx.fillText(`Error drawing: ${clip.name}`, 50, 100);
        }
      }

      // Apply crop to the offscreen canvas (if cropped)
      const hasCrop = clip.crop.left > 0 || clip.crop.top > 0 || clip.crop.right > 0 || clip.crop.bottom > 0;
      let renderSource = clipCanvas;

      if (hasCrop) {
        // Perform sub-cropping to a second offscreen canvas or clip inside drawing
        const cropL = clip.crop.left * width;
        const cropT = clip.crop.top * height;
        const cropW = (1 - clip.crop.left - clip.crop.right) * width;
        const cropH = (1 - clip.crop.top - clip.crop.bottom) * height;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = width;
        cropCanvas.height = height;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(clipCanvas, cropL, cropT, cropW, cropH, 0, 0, width, height);
        renderSource = cropCanvas;
      }

      // 4. Save display canvas context state before applying filters and transforms
      ctx.save();

      // Assemble CSS filter string
      let filterString = '';
      
      // Interpolate filter parameters from effect stack
      clip.effects.forEach(eff => {
        if (!eff.enabled) return;

        if (eff.type === 'ColorGrade') {
          const brightness = getInterpolatedValue(clip, 'brightness', playheadTime, eff.params.brightness || 0);
          const contrast = getInterpolatedValue(clip, 'contrast', playheadTime, eff.params.contrast || 1.0);
          const saturation = getInterpolatedValue(clip, 'saturation', playheadTime, eff.params.saturation || 1.0);
          const hue = getInterpolatedValue(clip, 'hue', playheadTime, eff.params.hue || 0);

          // Map values (brightness: -1 to 1 -> -100% to 100%, contrast: 0 to 3 -> 0% to 300%)
          const bPct = Math.round(100 + brightness * 100);
          const cPct = Math.round(contrast * 100);
          const sPct = Math.round(saturation * 100);
          
          filterString += ` brightness(${bPct}%) contrast(${cPct}%) saturate(${sPct}%) hue-rotate(${hue}deg)`;
        } else if (eff.type === 'Blur') {
          const radius = getInterpolatedValue(clip, 'blur', playheadTime, eff.params.radius || 0);
          filterString += ` blur(${radius}px)`;
        }
      });

      if (filterString.trim()) {
        ctx.filter = filterString.trim();
      }

      // Apply opacity
      ctx.globalAlpha = opacity;

      // Apply transforms (scale, rotate, translate) relative to center
      ctx.translate(width / 2 + posX, height / 2 + posY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      // Draw the processed source frame onto the screen
      ctx.drawImage(renderSource, -width / 2, -height / 2, width, height);

      // Restore filters/alpha for drawing additional clip effects (Vignette)
      ctx.restore();

      // Check for Vignette effect (must be drawn overlay style)
      const vignette = clip.effects.find(e => e.type === 'Vignette' && e.enabled);
      if (vignette) {
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Translate similar to clip
        ctx.translate(width / 2 + posX, height / 2 + posY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);

        const strength = vignette.params.strength || 0.5;
        const radiusVal = vignette.params.radius || 0.5;
        const softness = vignette.params.softness || 0.5;

        const innerRadius = Math.max(0, width * 0.5 * radiusVal * (1 - softness));
        const outerRadius = Math.max(innerRadius + 10, width * 0.5 * radiusVal * (1 + strength));

        const vigGrad = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
        vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vigGrad.addColorStop(1, `rgba(0, 0, 0, ${strength * 0.95})`);

        ctx.fillStyle = vigGrad;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      }
    });
  });
};

/**
 * Web Audio Synthesizer Beat Controller
 * Triggers oscillator tones for active audio tracks when playing
 */
let audioCtx = null;

export const triggerAudioTimelineTick = (playheadTime, clips, tracks, mediaLibrary) => {
  // Lazily initialize Web Audio context
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Find active audio tracks
  const activeAudioTracks = tracks.filter(t => t.type === 'audio' && !t.muted);
  const soloActive = tracks.some(t => t.solo);
  const renderableTracks = soloActive ? activeAudioTracks.filter(t => t.solo) : activeAudioTracks;

  renderableTracks.forEach(track => {
    // Find clips active on this track
    const activeClips = clips.filter(c => 
      c.trackId === track.id && 
      playheadTime >= c.timelinePos && 
      playheadTime < c.timelinePos + c.duration
    );

    activeClips.forEach(clip => {
      const asset = mediaLibrary.find(m => m.id === clip.mediaId);
      if (asset && asset.audioSynth) {
        const elapsed = playheadTime - clip.timelinePos;
        const clipTime = (elapsed * clip.speed) + clip.srcIn;
        
        // Pass the AudioContext to let it schedule synth nodes
        try {
          asset.audioSynth(audioCtx, clipTime);
        } catch (e) {
          console.error("Audio synth error", e);
        }
      }
    });
  });
};
