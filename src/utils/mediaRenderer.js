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
/**
 * Helper to render a single clip's frame onto any target canvas context
 */
const renderClipToCanvas = (clip, playheadTime, targetCanvas, targetCtx, width, height, mediaLibrary, getInterpolatedValue) => {
  // Adjustment Clip Downward compositing
  if (clip.mediaType === 'adjustment') {
    targetCtx.save();
    const { canvas: adjTempCanvas, ctx: adjTempCtx } = getOffscreenCanvas('adjustment_temp_' + clip.id, width, height);
    adjTempCtx.clearRect(0, 0, width, height);
    adjTempCtx.drawImage(targetCanvas, 0, 0);

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
      targetCtx.filter = filterString.trim();
    }
    targetCtx.globalAlpha = opacity;
    targetCtx.drawImage(adjTempCanvas, 0, 0);
    targetCtx.restore();
    return;
  }

  // Subtitle Clip rendering (gorgeous closed caption overlay plate)
  if (clip.mediaType === 'subtitle') {
    targetCtx.save();
    const text = clip.name || 'Subtitle text';
    const fontSizeVal = clip.fontSize || 28;
    const fontFamily = clip.fontFamily || 'Inter';
    const textColor = clip.textColor || '#ffffff';
    const bgOpacity = clip.textBgOpacity !== undefined ? clip.textBgOpacity : 0.65;

    targetCtx.font = `500 ${fontSizeVal}px '${fontFamily}', sans-serif`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    const textMetrics = targetCtx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSizeVal;

    const paddingX = 20;
    const paddingY = 10;
    const pillWidth = textWidth + paddingX * 2;
    const pillHeight = textHeight + paddingY * 2;
    const pillX = width / 2 - pillWidth / 2;
    const pillY = height * 0.86 - pillHeight / 2;

    // Draw translucent dark container
    targetCtx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;
    targetCtx.beginPath();
    targetCtx.roundRect(pillX, pillY, pillWidth, pillHeight, 8);
    targetCtx.fill();

    // Draw subtitle text
    targetCtx.fillStyle = textColor;
    targetCtx.fillText(text, width / 2, pillY + pillHeight / 2 + 1);
    targetCtx.restore();
    return;
  }

  // Find asset
  const asset = mediaLibrary.find(m => m.id === clip.mediaId);
  
  // Calculate relative play time within source clip, clamp to handle transition overlaps
  const elapsed = playheadTime - clip.timelinePos;
  const rawClipTime = (elapsed * clip.speed) + clip.srcIn;
  const clipTime = Math.max(clip.srcIn, Math.min(clip.srcOut, rawClipTime));

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
    const textEffect = clip.textEffect || 'default';
    const textStr = clip.name || 'Text Overlay';
    const textX = width / 2;
    const textY = height / 2;
    
    clipCtx.font = `bold ${fontSizeVal}px '${fontFamily}', sans-serif`;
    clipCtx.textAlign = 'center';
    clipCtx.textBaseline = 'middle';

    if (textEffect === 'neon') {
      // 1. NEON GLOW EFFECT (Vibrant glow, multi-layered shadows)
      clipCtx.save();
      const neonColor = textColor === '#ffffff' ? '#ec4899' : textColor;
      clipCtx.lineJoin = 'round';
      
      // Step 1: Thick deep outer glow
      clipCtx.shadowColor = neonColor;
      clipCtx.shadowBlur = Math.max(20, fontSizeVal * 0.3);
      clipCtx.strokeStyle = neonColor;
      clipCtx.lineWidth = Math.max(5, fontSizeVal * 0.09);
      clipCtx.strokeText(textStr, textX, textY);
      
      // Step 2: Medium glowing stroke
      clipCtx.shadowBlur = Math.max(10, fontSizeVal * 0.15);
      clipCtx.lineWidth = Math.max(2.5, fontSizeVal * 0.05);
      clipCtx.strokeText(textStr, textX, textY);

      // Step 3: Inner white tube core with tight glow
      clipCtx.strokeStyle = '#ffffff';
      clipCtx.lineWidth = Math.max(1.2, fontSizeVal * 0.025);
      clipCtx.shadowBlur = Math.max(3, fontSizeVal * 0.05);
      clipCtx.strokeText(textStr, textX, textY);

      // Step 4: Solid white core text
      clipCtx.fillStyle = '#ffffff';
      clipCtx.shadowBlur = 0;
      clipCtx.fillText(textStr, textX, textY);
      clipCtx.restore();

    } else if (textEffect === 'chrome') {
      // 2. SILVER CHROME EFFECT (Metallic liquid reflection, dark outline)
      clipCtx.save();
      const gradient = clipCtx.createLinearGradient(0, textY - fontSizeVal/2, 0, textY + fontSizeVal/2);
      gradient.addColorStop(0.0, '#3b82f6'); // sky blue
      gradient.addColorStop(0.3, '#eff6ff');  // sky cloud
      gradient.addColorStop(0.48, '#ffffff'); // horizon flash
      gradient.addColorStop(0.50, '#1e293b'); // dark horizon cut
      gradient.addColorStop(0.52, '#0f172a'); // ground base
      gradient.addColorStop(0.75, '#94a3b8'); // silver ground reflection
      gradient.addColorStop(1.0, '#f8fafc');  // bottom highlight

      // Thick slate outline framing
      clipCtx.strokeStyle = '#020617';
      clipCtx.lineWidth = Math.max(7, fontSizeVal * 0.1);
      clipCtx.lineJoin = 'round';
      clipCtx.strokeText(textStr, textX, textY);

      // Metallic liquid gradient fill
      clipCtx.fillStyle = gradient;
      clipCtx.fillText(textStr, textX, textY);
      
      // Fine bevel specular reflection stroke
      clipCtx.strokeStyle = 'rgba(255,255,255,0.7)';
      clipCtx.lineWidth = 1.2;
      clipCtx.strokeText(textStr, textX, textY);
      clipCtx.restore();

    } else if (textEffect === 'retro3d') {
      // 3. RETRO 3D EXTRUDED EFFECT (Block depth layers, retro synth sunset face)
      clipCtx.save();
      const depth = Math.max(6, Math.floor(fontSizeVal * 0.11));
      const frontColor = textColor === '#ffffff' ? '#f59e0b' : textColor; // user color or amber
      const backColor = '#4c0519'; // dark ruby extrusion
      const strokeColor = '#000000';
      
      clipCtx.lineJoin = 'round';
      clipCtx.lineWidth = Math.max(3.5, fontSizeVal * 0.055);

      // Draw the block extrusion depth (back to front)
      for (let i = depth; i > 0; i--) {
        clipCtx.strokeStyle = strokeColor;
        clipCtx.strokeText(textStr, textX - i, textY + i);
        clipCtx.fillStyle = backColor;
        clipCtx.fillText(textStr, textX - i, textY + i);
      }

      // Draw front face border
      clipCtx.strokeStyle = strokeColor;
      clipCtx.strokeText(textStr, textX, textY);

      // Draw synthwave sunset face gradient fill
      const faceGrad = clipCtx.createLinearGradient(0, textY - fontSizeVal/2, 0, textY + fontSizeVal/2);
      faceGrad.addColorStop(0, '#fef08a'); // yellow top
      faceGrad.addColorStop(0.5, '#fb923c'); // orange mid
      faceGrad.addColorStop(1, frontColor);  // crimson/user bottom
      clipCtx.fillStyle = faceGrad;
      clipCtx.fillText(textStr, textX, textY);
      clipCtx.restore();

    } else if (textEffect === 'glitch') {
      // 4. CYBERPUNK GLITCH EFFECT (Aberration shifts, scanlines, digital cut overlays)
      clipCtx.save();
      const offset = Math.max(3, fontSizeVal * 0.035);
      
      // Draw cyan shadow offset
      clipCtx.fillStyle = '#00f0ff';
      clipCtx.fillText(textStr, textX - offset, textY + 1.5);
      
      // Draw magenta shadow offset
      clipCtx.fillStyle = '#ff003c';
      clipCtx.fillText(textStr, textX + offset, textY - 1.5);

      // Draw main text (white or custom text color)
      clipCtx.fillStyle = textColor === '#ffffff' ? '#ffffff' : textColor;
      clipCtx.fillText(textStr, textX, textY);

      // Clip scanline patterns atop the text bounds
      clipCtx.globalCompositeOperation = 'source-atop';
      clipCtx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      clipCtx.lineWidth = 1;
      for (let y = textY - fontSizeVal; y < textY + fontSizeVal; y += 3) {
        clipCtx.beginPath();
        clipCtx.moveTo(textX - fontSizeVal * 2, y);
        clipCtx.lineTo(textX + fontSizeVal * 2, y);
        clipCtx.stroke();
      }
      clipCtx.restore();
      
      // Render horizontal cyan/magenta glitch displacement bars on top
      clipCtx.save();
      clipCtx.fillStyle = '#00f0ff';
      clipCtx.fillRect(textX - fontSizeVal * 1.1 + Math.random() * 20, textY - fontSizeVal * 0.25, fontSizeVal * 0.45, 3.5);
      clipCtx.fillStyle = '#ff003c';
      clipCtx.fillRect(textX + fontSizeVal * 0.3 - Math.random() * 20, textY + fontSizeVal * 0.18, fontSizeVal * 0.38, 3);
      clipCtx.restore();

    } else if (textEffect === 'gold') {
      // 5. GOLDEN LUXURY EFFECT (Metallic multi-stop gradient, outer gold halo, double highlights)
      clipCtx.save();
      const goldGrad = clipCtx.createLinearGradient(0, textY - fontSizeVal/2, 0, textY + fontSizeVal/2);
      goldGrad.addColorStop(0.0, '#b58c16'); // bronze
      goldGrad.addColorStop(0.18, '#cfac62'); // classic gold
      goldGrad.addColorStop(0.38, '#fcf6ba'); // bright gold highlight
      goldGrad.addColorStop(0.58, '#b38728'); // medium gold
      goldGrad.addColorStop(0.82, '#edd69a'); // light gold
      goldGrad.addColorStop(1.0, '#664608'); // dark gold shadow

      // Frame border
      clipCtx.strokeStyle = '#251a02';
      clipCtx.lineWidth = Math.max(5, fontSizeVal * 0.08);
      clipCtx.lineJoin = 'round';
      clipCtx.strokeText(textStr, textX, textY);

      // Gold text fill
      clipCtx.fillStyle = goldGrad;
      clipCtx.fillText(textStr, textX, textY);

      // Specification fine highlight
      clipCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      clipCtx.lineWidth = 1;
      clipCtx.strokeText(textStr, textX, textY);

      // Outer gold glowing halo (shadow text draw behind)
      clipCtx.shadowColor = '#cfac62';
      clipCtx.shadowBlur = Math.max(12, fontSizeVal * 0.15);
      clipCtx.strokeStyle = '#b58c16';
      clipCtx.lineWidth = 1.5;
      clipCtx.strokeText(textStr, textX, textY);
      clipCtx.restore();

    } else if (textEffect === 'grunge') {
      // 6. DISTRESSED GRUNGE EFFECT (Spray stencil dash outline, weathering scratches & pitted noise)
      clipCtx.save();
      const baseColor = textColor === '#ffffff' ? '#e2e8f0' : textColor;
      
      clipCtx.fillStyle = baseColor;
      clipCtx.fillText(textStr, textX, textY);
      
      // Weathered border overlay
      clipCtx.strokeStyle = 'rgba(0,0,0,0.5)';
      clipCtx.lineWidth = 2;
      clipCtx.setLineDash([4, 4]);
      clipCtx.strokeText(textStr, textX, textY);

      // Apply weathered noise masks over drawing using destination-out
      clipCtx.globalCompositeOperation = 'destination-out';
      
      // Draw irregular scratches
      clipCtx.strokeStyle = '#000000';
      clipCtx.lineWidth = Math.max(1, fontSizeVal * 0.015);
      for (let j = 0; j < 6; j++) {
        const startX = textX - fontSizeVal * 1.5 + Math.random() * fontSizeVal * 3;
        const startY = textY - fontSizeVal * 0.6;
        clipCtx.beginPath();
        clipCtx.moveTo(startX, startY);
        clipCtx.lineTo(startX + (Math.random() - 0.5) * 20, startY + fontSizeVal * 0.4);
        clipCtx.lineTo(startX + (Math.random() - 0.5) * 35, startY + fontSizeVal * 1.2);
        clipCtx.stroke();
      }

      // Draw pitted sandblasted splatter dots
      const splatterCount = Math.floor(fontSizeVal * 0.65);
      for (let s = 0; s < splatterCount; s++) {
        const pX = textX - fontSizeVal * 1.5 + Math.random() * fontSizeVal * 3;
        const pY = textY - fontSizeVal * 0.6 + Math.random() * fontSizeVal * 1.2;
        const radius = Math.random() * 2.2 + 0.5;
        clipCtx.beginPath();
        clipCtx.arc(pX, pY, radius, 0, Math.PI * 2);
        clipCtx.fill();
      }

      clipCtx.restore();

    } else if (textEffect === 'glass') {
      // 7. PREMIUM CRYSTAL GLASS EFFECT (Apple-style PBR-inspired transparent glass)
      // Letters are modelled as thick crystal that refracts the LIVE background
      // through their shape, with polished beveled edges, Fresnel rim light,
      // chromatic dispersion, multi-directional studio speculars, ambient-occlusion
      // contact shadow and internal caustic shimmer. Every optical cue is faked with
      // layered canvas compositing (no per-pixel raytrace) so playback stays real-time
      // while the result reads as a ray-traced glass advertising render.
      const cx = textX;
      const cy = textY;
      const fs = fontSizeVal;
      const tw = clipCtx.measureText(textStr).width;
      const halfW = Math.min(width * 0.46, tw / 2 + fs * 0.18);

      // --- Build a crisp, slightly fattened & rounded letter-shape mask ---
      // Round line joins give the chunky cast-glass corners; this mask clips
      // every optical layer so the glass silhouette stays sharp.
      const { canvas: maskCanvas, ctx: maskCtx } = getOffscreenCanvas('glassMask_' + clip.id, width, height);
      maskCtx.clearRect(0, 0, width, height);
      maskCtx.font = clipCtx.font;
      maskCtx.textAlign = 'center';
      maskCtx.textBaseline = 'middle';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = Math.max(2, fs * 0.04);
      maskCtx.strokeStyle = '#fff';
      maskCtx.fillStyle = '#fff';
      maskCtx.strokeText(textStr, cx, cy);
      maskCtx.fillText(textStr, cx, cy);

      // ===== 1. AMBIENT OCCLUSION / CONTACT SHADOW =====
      // Soft dark halo grounding the glass onto the scene. Drawn first; its solid
      // body is later covered by the refraction, leaving only the soft edge halo.
      clipCtx.save();
      clipCtx.shadowColor = 'rgba(4, 9, 18, 0.55)';
      clipCtx.shadowBlur = Math.max(12, fs * 0.22);
      clipCtx.shadowOffsetX = fs * 0.045;
      clipCtx.shadowOffsetY = fs * 0.075;
      clipCtx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      clipCtx.fillText(textStr, cx, cy);
      clipCtx.restore();

      // ===== 2. REFRACTED BACKGROUND (the core see-through optics) =====
      // The already-composited scene behind the text is magnified like a thick
      // lens and rolled downward, then clipped to the letters so the background
      // stays fully visible but is clearly bent and displaced by the glass body.
      const { canvas: refrCanvas, ctx: refrCtx } = getOffscreenCanvas('glassRefr_' + clip.id, width, height);
      refrCtx.clearRect(0, 0, width, height);
      const mag = 1.3; // thick-glass magnification
      refrCtx.save();
      refrCtx.translate(cx, cy);
      refrCtx.scale(mag, mag);
      refrCtx.translate(-cx, -cy);
      refrCtx.drawImage(targetCanvas, fs * 0.03, -fs * 0.18); // visible refractive roll
      refrCtx.restore();
      // Faint inverted sliver near the lower thickness edge sells the glass depth.
      refrCtx.save();
      refrCtx.globalAlpha = 0.20;
      refrCtx.translate(cx, cy);
      refrCtx.scale(mag * 1.08, -(mag * 1.08)); // vertical flip
      refrCtx.translate(-cx, -cy);
      refrCtx.drawImage(targetCanvas, 0, fs * 0.55);
      refrCtx.restore();
      // Clip the whole refraction to the letter shape and lay it into the glass.
      refrCtx.globalCompositeOperation = 'destination-in';
      refrCtx.drawImage(maskCanvas, 0, 0);
      refrCtx.globalCompositeOperation = 'source-over';
      clipCtx.drawImage(refrCanvas, 0, 0);

      // ===== 2b. EDGE LENSING (total-internal-reflection rim of thick glass) =====
      // Near a thick chamfer the scene is bent far harder and brightens. We sample
      // a strongly-magnified, offset copy of the background and confine it to a thin
      // band hugging the inner contour — the signature glossy bent edge of cast glass.
      const { canvas: bandMask, ctx: bandCtx } = getOffscreenCanvas('glassBand_' + clip.id, width, height);
      bandCtx.clearRect(0, 0, width, height);
      bandCtx.font = clipCtx.font;
      bandCtx.textAlign = 'center';
      bandCtx.textBaseline = 'middle';
      bandCtx.lineJoin = 'round';
      bandCtx.strokeStyle = '#fff';
      bandCtx.lineWidth = Math.max(3, fs * 0.13); // band straddling the outline
      bandCtx.strokeText(textStr, cx, cy);
      bandCtx.globalCompositeOperation = 'destination-in'; // keep only the inner half
      bandCtx.drawImage(maskCanvas, 0, 0);

      const { canvas: edgeCanvas, ctx: edgeCtx } = getOffscreenCanvas('glassEdge_' + clip.id, width, height);
      edgeCtx.clearRect(0, 0, width, height);
      const emag = mag * 1.55;
      edgeCtx.save();
      edgeCtx.translate(cx, cy);
      edgeCtx.scale(emag, emag);
      edgeCtx.translate(-cx, -cy);
      edgeCtx.drawImage(targetCanvas, fs * 0.05, -fs * 0.2); // hard, offset bend
      edgeCtx.restore();
      edgeCtx.globalCompositeOperation = 'destination-in';
      edgeCtx.drawImage(bandMask, 0, 0);
      edgeCtx.globalCompositeOperation = 'source-over';
      clipCtx.save();
      clipCtx.globalAlpha = 0.85;
      clipCtx.drawImage(edgeCanvas, 0, 0);
      clipCtx.restore();

      // ===== 3. SURFACE TREATMENT BUFFER =====
      // Body tint, bevels, Fresnel rim, dispersion, speculars and caustics are
      // built on a dedicated buffer, masked to the letters, then laid over the
      // refraction. This keeps the contact shadow pristine and the glass crisp.
      const { canvas: glassCanvas, ctx: gctx } = getOffscreenCanvas('glassSurf_' + clip.id, width, height);
      gctx.clearRect(0, 0, width, height);
      gctx.font = clipCtx.font;
      gctx.textAlign = 'center';
      gctx.textBaseline = 'middle';
      gctx.lineJoin = 'round';

      // 3a. Glass body — a whisper of cool crystal tint + brightness lift so the
      //     material has body without ever looking like flat plastic.
      const bodyGrad = gctx.createLinearGradient(0, cy - fs * 0.62, 0, cy + fs * 0.62);
      bodyGrad.addColorStop(0.00, 'rgba(214, 240, 255, 0.12)'); // cool sky pickup top
      bodyGrad.addColorStop(0.46, 'rgba(255, 255, 255, 0.03)');
      bodyGrad.addColorStop(0.54, 'rgba(120, 150, 175, 0.03)');
      bodyGrad.addColorStop(1.00, 'rgba(182, 208, 228, 0.10)'); // cool floor pickup bottom
      gctx.fillStyle = bodyGrad;
      gctx.fillText(textStr, cx, cy);
      if (textColor && textColor !== '#ffffff') {
        // Honour a user-chosen tint as faintly coloured crystal.
        gctx.save();
        gctx.globalAlpha = 0.11;
        gctx.fillStyle = textColor;
        gctx.fillText(textStr, cx, cy);
        gctx.restore();
      }

      // 3b. Polished inner bevel — light from the top-left, shadow to the
      //     bottom-right, built from inset strokes for a smooth chamfer & thickness.
      const bevelSteps = 5;
      for (let i = bevelSteps; i >= 1; i--) {
        const t = i / bevelSteps;
        gctx.lineWidth = Math.max(1, fs * 0.05 * t);
        gctx.globalCompositeOperation = 'lighter';
        gctx.strokeStyle = `rgba(255, 255, 255, ${0.10 * (1 - t) + 0.04})`;
        gctx.strokeText(textStr, cx - fs * 0.013, cy - fs * 0.013);
        gctx.globalCompositeOperation = 'source-over';
        gctx.strokeStyle = `rgba(9, 18, 30, ${0.10 * (1 - t) + 0.05})`;
        gctx.strokeText(textStr, cx + fs * 0.013, cy + fs * 0.013);
      }

      // 3c. Chromatic dispersion — R/G/B fringes split at the glass edges.
      gctx.globalCompositeOperation = 'lighter';
      const disp = Math.max(1, fs * 0.014);
      gctx.lineWidth = Math.max(1, fs * 0.012);
      gctx.strokeStyle = 'rgba(255, 45, 45, 0.50)'; // red, one side
      gctx.strokeText(textStr, cx + disp, cy + disp * 0.4);
      gctx.strokeStyle = 'rgba(45, 140, 255, 0.50)'; // blue, opposite side
      gctx.strokeText(textStr, cx - disp, cy - disp * 0.4);
      gctx.strokeStyle = 'rgba(60, 255, 120, 0.26)'; // green to complete the spectrum
      gctx.strokeText(textStr, cx, cy + disp);

      // 3d. Fresnel edge brightening — a crisp rim hugging the contour, stronger
      //     at the top where the key light grazes the glass.
      const rimGrad = gctx.createLinearGradient(0, cy - fs * 0.6, 0, cy + fs * 0.6);
      rimGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
      rimGrad.addColorStop(0.5, 'rgba(208, 234, 255, 0.50)');
      rimGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.82)');
      gctx.strokeStyle = rimGrad;
      gctx.lineWidth = Math.max(1.5, fs * 0.022);
      gctx.strokeText(textStr, cx, cy);

      // 3e. Soft studio speculars — a broad key-light gloss sweep across the
      //     upper body plus a few crisp hotspots from multiple light directions.
      const sweep = gctx.createLinearGradient(0, cy - fs * 0.58, 0, cy - fs * 0.04);
      sweep.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
      gctx.fillStyle = sweep;
      gctx.fillRect(cx - halfW, cy - fs * 0.6, halfW * 2, fs * 0.58);
      const spots = [
        [cx - halfW * 0.55, cy - fs * 0.34, fs * 0.11, 0.90],
        [cx + halfW * 0.22, cy - fs * 0.30, fs * 0.075, 0.80],
        [cx + halfW * 0.60, cy + fs * 0.12, fs * 0.055, 0.60],
        [cx - halfW * 0.15, cy + fs * 0.26, fs * 0.045, 0.45],
      ];
      spots.forEach(([sx, sy, r, a]) => {
        const g = gctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        gctx.fillStyle = g;
        gctx.beginPath();
        gctx.arc(sx, sy, r, 0, Math.PI * 2);
        gctx.fill();
      });

      // 3f. Internal reflections / caustic shimmer — faint light caustics curving
      //     through the glass body.
      gctx.strokeStyle = 'rgba(190, 225, 255, 0.16)';
      gctx.lineWidth = Math.max(1, fs * 0.012);
      for (let k = 0; k < 3; k++) {
        const yy = cy - fs * 0.18 + k * fs * 0.17;
        gctx.beginPath();
        gctx.moveTo(cx - halfW, yy);
        gctx.bezierCurveTo(cx - halfW * 0.3, yy - fs * 0.08, cx + halfW * 0.3, yy + fs * 0.08, cx + halfW, yy);
        gctx.stroke();
      }
      gctx.globalCompositeOperation = 'source-over';

      // Mask all surface treatment to the letter shape and lay it over the glass.
      gctx.globalCompositeOperation = 'destination-in';
      gctx.drawImage(maskCanvas, 0, 0);
      gctx.globalCompositeOperation = 'source-over';
      clipCtx.drawImage(glassCanvas, 0, 0);

      // ===== 4. OUTER FRESNEL HALO — subtle edge light catch (no exaggerated glow) =====
      clipCtx.save();
      clipCtx.globalCompositeOperation = 'lighter';
      clipCtx.shadowColor = 'rgba(180, 220, 255, 0.5)';
      clipCtx.shadowBlur = Math.max(4, fs * 0.06);
      clipCtx.strokeStyle = 'rgba(220, 240, 255, 0.35)';
      clipCtx.lineWidth = Math.max(1, fs * 0.012);
      clipCtx.strokeText(textStr, cx, cy);
      clipCtx.restore();

    } else {
      // DEFAULT STYLE (Subtle shadow, solid color fill)
      clipCtx.fillStyle = textColor;
      clipCtx.shadowColor = 'rgba(0,0,0,0.8)';
      clipCtx.shadowBlur = 10;
      clipCtx.fillText(textStr, textX, textY);
      clipCtx.shadowBlur = 0;
    }
  } else if (asset && asset.draw) {
    // Procedural mock video or image
    asset.draw(clipCtx, clipTime);
  } else if (asset && asset.element) {
    // Real HTML5 Video/Image loaded
    try {
      if (clip.mediaType === 'video') {
        const videoEl = asset.element;
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

    const { canvas: cropCanvas, ctx: cropCtx } = getOffscreenCanvas('crop_' + clip.id, width, height);
    cropCtx.clearRect(0, 0, width, height);
    cropCtx.drawImage(clipCanvas, cropL, cropT, cropW, cropH, 0, 0, width, height);
    renderSource = cropCanvas;
  }

  // Save target canvas context state before applying filters and transforms
  targetCtx.save();

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
    targetCtx.filter = filterString.trim();
  }

  // Apply opacity
  targetCtx.globalAlpha = opacity;

  // Apply transforms (scale, rotate, translate) relative to center
  targetCtx.translate(width / 2 + posX, height / 2 + posY);
  targetCtx.rotate((rotation * Math.PI) / 180);
  targetCtx.scale(scale, scale);

  // Draw the processed source frame onto the screen
  targetCtx.drawImage(renderSource, -width / 2, -height / 2, width, height);

  // Restore targetCtx state
  targetCtx.restore();

  // Vignette effect overlay
  const vignette = clip.effects.find(e => e.type === 'Vignette' && e.enabled);
  if (vignette) {
    targetCtx.save();
    targetCtx.globalAlpha = opacity;
    
    targetCtx.translate(width / 2 + posX, height / 2 + posY);
    targetCtx.rotate((rotation * Math.PI) / 180);
    targetCtx.scale(scale, scale);

    const strength = vignette.params.strength || 0.5;
    const radiusVal = vignette.params.radius || 0.5;
    const softness = vignette.params.softness || 0.5;

    const innerRadius = Math.max(0, width * 0.5 * radiusVal * (1 - softness));
    const outerRadius = Math.max(innerRadius + 10, width * 0.5 * radiusVal * (1 + strength));

    const vigGrad = targetCtx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, `rgba(0, 0, 0, ${strength * 0.95})`);

    targetCtx.fillStyle = vigGrad;
    targetCtx.fillRect(-width / 2, -height / 2, width, height);
    targetCtx.restore();
  }
};

/**
 * Main Video Compositor
 * Draws all active tracks at the current playhead time onto the display canvas.
 */
export const compositeTimelineFrame = ({
  displayCanvas,
  playheadTime,
  clips,
  transitions = [],
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

  const renderedClipIds = new Set();

  // 3. Process each track
  renderableTracks.forEach(track => {
    // Find if there is an active transition on this track
    const activeTransition = (transitions || []).find(t => {
      const clipA = clips.find(c => c.id === t.clipAId);
      const clipB = clips.find(c => c.id === t.clipBId);
      if (!clipA || !clipB) return false;
      if (clipA.trackId !== track.id || clipB.trackId !== track.id) return false;
      
      const editPoint = clipB.timelinePos;
      return playheadTime >= editPoint - t.duration / 2 && playheadTime <= editPoint + t.duration / 2;
    });

    if (activeTransition) {
      const clipA = clips.find(c => c.id === activeTransition.clipAId);
      const clipB = clips.find(c => c.id === activeTransition.clipBId);

      if (clipA && clipB) {
        // Mark these clips as handled so they are not rendered again as normal clips
        renderedClipIds.add(clipA.id);
        renderedClipIds.add(clipB.id);

        const editPoint = clipB.timelinePos;
        const duration = activeTransition.duration;
        const p = Math.max(0, Math.min(1, (playheadTime - (editPoint - duration / 2)) / duration));

        // Get offscreen canvases for compositing transition frames
        const { canvas: tempCanvasA, ctx: tempCtxA } = getOffscreenCanvas('trans_temp_A', width, height);
        const { canvas: tempCanvasB, ctx: tempCtxB } = getOffscreenCanvas('trans_temp_B', width, height);

        tempCtxA.clearRect(0, 0, width, height);
        tempCtxB.clearRect(0, 0, width, height);

        // Render both clips into transition buffers
        renderClipToCanvas(clipA, playheadTime, tempCanvasA, tempCtxA, width, height, mediaLibrary, getInterpolatedValue);
        renderClipToCanvas(clipB, playheadTime, tempCanvasB, tempCtxB, width, height, mediaLibrary, getInterpolatedValue);

        const transType = activeTransition.type;

        // Perform composite transitions
        if (transType === 'crossDissolve') {
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.globalAlpha = p;
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'dipToBlack') {
          if (p < 0.5) {
            ctx.drawImage(tempCanvasA, 0, 0);
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = p * 2;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          } else {
            ctx.drawImage(tempCanvasB, 0, 0);
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = (1 - p) * 2;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          }
        } else if (transType === 'dipToWhite') {
          if (p < 0.5) {
            ctx.drawImage(tempCanvasA, 0, 0);
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = p * 2;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          } else {
            ctx.drawImage(tempCanvasB, 0, 0);
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = (1 - p) * 2;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          }
        } else if (transType === 'additiveDissolve' || transType === 'additiveDissove') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = p;
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'wipeLeft') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(width * (1 - p), 0, width * p, height);
          ctx.clip();
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'wipeRight') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width * p, height);
          ctx.clip();
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'wipeUp') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, height * (1 - p), width, height * p);
          ctx.clip();
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'wipeDown') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, height * p);
          ctx.clip();
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'clockWipe') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(width / 2, height / 2);
          ctx.arc(width / 2, height / 2, Math.sqrt(width * width + height * height), -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * p);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        } else if (transType === 'pushLeft') {
          ctx.drawImage(tempCanvasA, -width * p, 0);
          ctx.drawImage(tempCanvasB, width * (1 - p), 0);
        } else if (transType === 'pushRight') {
          ctx.drawImage(tempCanvasA, width * p, 0);
          ctx.drawImage(tempCanvasB, -width * (1 - p), 0);
        } else if (transType === 'slideIn') {
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.drawImage(tempCanvasB, width * (1 - p), 0);
        } else if (transType === 'zoomIn' || transType === 'zoom') {
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.translate(width / 2, height / 2);
          ctx.scale(1 + p, 1 + p);
          ctx.drawImage(tempCanvasA, -width / 2, -height / 2);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = p;
          ctx.translate(width / 2, height / 2);
          ctx.scale(p, p);
          ctx.drawImage(tempCanvasB, -width / 2, -height / 2);
          ctx.restore();
        } else {
          // Default: Cross Dissolve
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.drawImage(tempCanvasA, 0, 0);
          ctx.globalAlpha = p;
          ctx.drawImage(tempCanvasB, 0, 0);
          ctx.restore();
        }
      }
    }

    // Find active clips on this track
    const activeClips = clips.filter(c => 
      c.trackId === track.id && 
      playheadTime >= c.timelinePos && 
      playheadTime < c.timelinePos + c.duration
    );

    activeClips.forEach(clip => {
      // If the clip is already processed inside an active transition, skip it
      if (renderedClipIds.has(clip.id)) return;

      renderClipToCanvas(clip, playheadTime, displayCanvas, ctx, width, height, mediaLibrary, getInterpolatedValue);
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
