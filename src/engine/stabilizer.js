/**
 * CineCutPro — Video Stabilizer Engine.
 *
 * Estimates camera shake by tracking center-frame features from frame to frame,
 * smooths the motion path using a moving average, and applies counter-translations
 * via timeline keyframes with auto-zoom scaling to mask edge offsets.
 */

/**
 * Compare a central patch in frame A with search window in frame B to find delta movement.
 */
function findFrameOffset(dataA, dataB, width, height, patchW, patchH, searchRadius) {
  const cx = Math.round((width - patchW) / 2);
  const cy = Math.round((height - patchH) / 2);

  let bestSad = Infinity;
  let bestDx = 0;
  let bestDy = 0;

  // Search local window
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      let sad = 0;
      let count = 0;

      for (let py = 0; py < patchH; py++) {
        const ay = cy + py;
        const by = cy + py + dy;
        if (ay < 0 || ay >= height || by < 0 || by >= height) continue;

        for (let px = 0; px < patchW; px += 2) { // Sample every 2nd pixel for speed
          const ax = cx + px;
          const bx = cx + px + dx;
          if (ax < 0 || ax >= width || bx < 0 || bx >= width) continue;

          const idxA = (ay * width + ax) * 4;
          const idxB = (by * width + bx) * 4;

          const lumA = dataA[idxA] * 0.299 + dataA[idxA + 1] * 0.587 + dataA[idxA + 2] * 0.114;
          const lumB = dataB[idxB] * 0.299 + dataB[idxB + 1] * 0.587 + dataB[idxB + 2] * 0.114;

          sad += Math.abs(lumA - lumB);
          count++;
        }
      }

      if (count > 0) {
        const normSad = sad / count;
        if (normSad < bestSad) {
          bestSad = normSad;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

/**
 * Analyze a video file and return stabilization transform offsets.
 *
 * @param {HTMLVideoElement} videoElement - The video asset to stabilize
 * @param {object} options
 *   @param {number} options.startTime - Start of range in seconds
 *   @param {number} options.endTime - End of range in seconds
 *   @param {number} options.fps - Analysis frame rate (default 12)
 *   @param {number} options.smoothing - Smoothing window size in frames (default 15)
 * @returns {Promise<object[]>} - Array of { time, dx, dy, zoom } adjustments
 */
export async function analyzeStabilization(videoElement, options = {}) {
  const {
    startTime = 0,
    endTime = videoElement.duration || 10,
    fps = 12,
    smoothing = 15
  } = options;

  const sampleW = 240; // Low-res downsample for fast optical flow estimation
  const sampleH = 135;

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(sampleW, sampleH)
    : Object.assign(document.createElement('canvas'), { width: sampleW, height: sampleH });
  const ctx = canvas.getContext('2d');

  const interval = 1 / fps;
  const rawDeltas = [];

  let prevData = null;

  // 1. Estimate frame-to-frame offsets
  for (let t = startTime; t <= endTime; t += interval) {
    await seekTo(videoElement, t);
    ctx.drawImage(videoElement, 0, 0, sampleW, sampleH);
    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
    } catch (_) {
      throw new Error('Canvas tainted: cannot stabilize cross-origin video.');
    }

    if (prevData) {
      const offset = findFrameOffset(prevData, imgData, sampleW, sampleH, 40, 40, 16);
      rawDeltas.push({ time: t, dx: offset.dx, dy: offset.dy });
    } else {
      rawDeltas.push({ time: t, dx: 0, dy: 0 });
    }

    prevData = imgData;
  }

  // 2. Accumulate delta movement to build camera path
  const pathX = [0];
  const pathY = [0];
  for (let i = 1; i < rawDeltas.length; i++) {
    pathX.push(pathX[i - 1] + rawDeltas[i].dx);
    pathY.push(pathY[i - 1] + rawDeltas[i].dy);
  }

  // 3. Smooth path using a moving average window
  const smoothX = [];
  const smoothY = [];
  const halfWindow = Math.floor(smoothing / 2);

  for (let i = 0; i < rawDeltas.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let w = -halfWindow; w <= halfWindow; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < rawDeltas.length) {
        sumX += pathX[idx];
        sumY += pathY[idx];
        count++;
      }
    }

    smoothX.push(sumX / count);
    smoothY.push(sumY / count);
  }

  // 4. Calculate compensation deltas (smooth - raw) & normalize
  const results = [];
  let maxCompensation = 0;

  for (let i = 0; i < rawDeltas.length; i++) {
    // Relative correction offsets
    const cx = smoothX[i] - pathX[i];
    const cy = smoothY[i] - pathY[i];

    results.push({
      time: rawDeltas[i].time,
      dx: cx,
      dy: cy
    });

    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist > maxCompensation) maxCompensation = dist;
  }

  // Calculate required scale zoom (so black boundaries aren't exposed)
  // Max pixel offset is normalized to the sample resolution.
  const normOffset = maxCompensation / Math.min(sampleW, sampleH);
  const zoom = 1.0 + Math.max(0.04, normOffset * 2.2); // scale factor

  return results.map(r => ({
    ...r,
    zoom
  }));
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
    setTimeout(resolve, 350);
  });
}

/**
 * Generate keyframes to stabilize a timeline clip.
 *
 * @param {object[]} stabData - Array of { time, dx, dy, zoom } adjustments
 * @param {object} clip - The timeline clip object
 * @param {number} scaleW - Conversion multiplier for width (to map sample to clip space)
 * @param {number} scaleH - Conversion multiplier for height
 * @returns {object} - Object containing keyframes array and default zoom scale
 */
export function generateStabilizationKeyframes(stabData, clip, scaleW = 8.0, scaleH = 8.0) {
  const keyframes = [];
  const zoom = stabData.length > 0 ? stabData[0].zoom : 1.05;

  for (const pt of stabData) {
    const clipLocalT = pt.time - clip.start;

    keyframes.push({
      id: `kf_stb_x_${Math.random().toString(36).slice(2, 6)}`,
      time: clipLocalT,
      channel: 'x',
      value: pt.dx * scaleW,
      easing: 'linear'
    });

    keyframes.push({
      id: `kf_stb_y_${Math.random().toString(36).slice(2, 6)}`,
      time: clipLocalT,
      channel: 'y',
      value: pt.dy * scaleH,
      easing: 'linear'
    });
  }

  return {
    keyframes,
    zoom
  };
}
