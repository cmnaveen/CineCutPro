/**
 * CineCutPro — Motion Tracker Engine.
 *
 * Tracks a visual feature in a video frame sequence over time. Uses a Sum of Absolute
 * Differences (SAD) template matching algorithm inside a local search window.
 */

/**
 * Compute the Sum of Absolute Differences (SAD) between a template patch and an image region.
 */
function computeSAD(imgData, imgW, imgH, template, tempW, tempH, startX, startY) {
  let sad = 0;
  for (let ty = 0; ty < tempH; ty++) {
    const iy = startY + ty;
    if (iy < 0 || iy >= imgH) return Infinity; // Out of bounds
    
    for (let tx = 0; tx < tempW; tx++) {
      const ix = startX + tx;
      if (ix < 0 || ix >= imgW) return Infinity;

      const iIdx = (iy * imgW + ix) * 4;
      const tIdx = (ty * tempW + tx) * 4;

      // Use luminance for match computation
      const lumI = imgData[iIdx] * 0.299 + imgData[iIdx + 1] * 0.587 + imgData[iIdx + 2] * 0.114;
      const lumT = template[tIdx] * 0.299 + template[tIdx + 1] * 0.587 + template[tIdx + 2] * 0.114;

      sad += Math.abs(lumI - lumT);
    }
  }
  return sad;
}

/**
 * Track a visual template in a video element.
 *
 * @param {HTMLVideoElement} videoElement - The video element to track
 * @param {object} initialBox - Initial bounding box in normalized coordinates { x: 0..1, y: 0..1, w: 0..1, h: 0..1 }
 * @param {object} options
 *   @param {number} options.startTime - Start time in seconds
 *   @param {number} options.endTime - End time in seconds
 *   @param {number} options.fps - Sample frame rate (default 10)
 * @returns {Promise<object[]>} - Array of { time, x, y } tracked points (normalized coordinates)
 */
export async function trackFeature(videoElement, initialBox, options = {}) {
  const {
    startTime = 0,
    endTime = videoElement.duration || 10,
    fps = 10
  } = options;

  const sampleW = 320; // Downscale video frames for faster tracking
  const sampleH = 180;
  
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(sampleW, sampleH)
    : Object.assign(document.createElement('canvas'), { width: sampleW, height: sampleH });
  const ctx = canvas.getContext('2d');

  const results = [];
  const interval = 1 / fps;

  // 1. Capture initial template frame
  await seekTo(videoElement, startTime);
  ctx.drawImage(videoElement, 0, 0, sampleW, sampleH);
  
  try {
    ctx.getImageData(0, 0, sampleW, sampleH);
  } catch (_) {
    throw new Error('Tainted canvas: cannot track motion on cross-origin video.');
  }

  // Calculate pixel bounds of initial template box
  const tx = Math.round(initialBox.x * sampleW);
  const ty = Math.round(initialBox.y * sampleH);
  const tw = Math.max(8, Math.round(initialBox.w * sampleW));
  const th = Math.max(8, Math.round(initialBox.h * sampleH));

  // Extract template pixel patch
  const tempCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(tw, th)
    : Object.assign(document.createElement('canvas'), { width: tw, height: th });
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, tx, ty, tw, th, 0, 0, tw, th);
  const templateData = tempCtx.getImageData(0, 0, tw, th).data;

  // Track state
  let lastX = tx;
  let lastY = ty;
  const searchRadius = 24; // Search window bounds (+/- 24 pixels)

  results.push({
    time: startTime,
    x: (lastX + tw / 2) / sampleW,
    y: (lastY + th / 2) / sampleH
  });

  // 2. Iterate through frames
  for (let t = startTime + interval; t <= endTime; t += interval) {
    await seekTo(videoElement, t);
    ctx.drawImage(videoElement, 0, 0, sampleW, sampleH);
    const currentFrame = ctx.getImageData(0, 0, sampleW, sampleH).data;

    let bestSad = Infinity;
    let bestX = lastX;
    let bestY = lastY;

    // Search neighborhood around last known location
    for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
        const sx = lastX + dx;
        const sy = lastY + dy;
        
        const sad = computeSAD(currentFrame, sampleW, sampleH, templateData, tw, th, sx, sy);
        if (sad < bestSad) {
          bestSad = sad;
          bestX = sx;
          bestY = sy;
        }
      }
    }

    lastX = bestX;
    lastY = bestY;

    results.push({
      time: t,
      x: (lastX + tw / 2) / sampleW,
      y: (lastY + th / 2) / sampleH
    });
  }

  return results;
}

/**
 * Seek utility.
 */
function seekTo(video, time) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
    setTimeout(resolve, 350); // Safe fallback timeout
  });
}

/**
 * Convert normalized track data into transform keyframes for a target clip.
 *
 * @param {object[]} trackData - Array of { time, x, y } normalized coordinates
 * @param {object} videoClip - The source clip that was tracked
 * @param {object} targetClip - The clip receiving the keyframes (e.g. a title overlay)
 * @param {number} canvasW - Target width of composition
 * @param {number} canvasH - Target height of composition
 * @returns {object[]} - Array of keyframe objects for the target clip
 */
export function convertTrackingToKeyframes(trackData, videoClip, targetClip, canvasW = 1920, canvasH = 1080) {
  const keyframes = [];

  const startX = trackData[0].x;
  const startY = trackData[0].y;

  for (const pt of trackData) {
    // Calculate relative offset in pixels from starting position
    const dx = (pt.x - startX) * canvasW;
    const dy = (pt.y - startY) * canvasH;

    // The keyframe timeline time must map to the target clip space
    const targetLocalT = pt.time - targetClip.start;

    keyframes.push({
      id: `kf_${Math.random().toString(36).slice(2, 6)}`,
      time: targetLocalT,
      channel: 'x',
      value: dx,
      easing: 'linear'
    });

    keyframes.push({
      id: `kf_${Math.random().toString(36).slice(2, 6)}`,
      time: targetLocalT,
      channel: 'y',
      value: dy,
      easing: 'linear'
    });
  }

  return keyframes;
}
