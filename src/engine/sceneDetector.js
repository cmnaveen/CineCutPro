/**
 * CineCutPro — Scene / Cut Detector.
 *
 * Analyzes video frames for significant visual changes to detect scene boundaries.
 * Runs comparison between consecutive frames using pixel difference metrics.
 *
 * Usage:
 *   import { detectScenes } from './sceneDetector.js';
 *   const cuts = await detectScenes(videoElement, { sensitivity: 0.5 });
 */

/**
 * Compute a compact luminance histogram from an ImageData's pixel array.
 * Returns a 16-bin histogram (normalized 0..1).
 */
function luminanceHistogram(data, length) {
  const bins = new Float64Array(16);
  let total = 0;
  for (let i = 0; i < length; i += 16) { // sample every 4th pixel for speed
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const bin = Math.min(15, (lum / 255) * 16 | 0);
    bins[bin]++;
    total++;
  }
  if (total > 0) {
    for (let i = 0; i < 16; i++) bins[i] /= total;
  }
  return bins;
}

/**
 * Compare two histograms via chi-squared distance.
 * Returns a value ≥ 0; larger values indicate bigger differences.
 */
function histogramDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const sum = a[i] + b[i];
    if (sum > 0) {
      dist += ((a[i] - b[i]) ** 2) / sum;
    }
  }
  return dist;
}

/**
 * Compute mean absolute pixel difference between two frames.
 * Operates on raw RGBA data arrays. Samples every Nth pixel for performance.
 */
function pixelDifference(dataA, dataB, length) {
  let diff = 0;
  let count = 0;
  const step = 16; // sample every 4th pixel (16 bytes = 4 RGBA channels × 4 pixels)
  for (let i = 0; i < length; i += step) {
    diff += Math.abs(dataA[i] - dataB[i]) +
            Math.abs(dataA[i + 1] - dataB[i + 1]) +
            Math.abs(dataA[i + 2] - dataB[i + 2]);
    count++;
  }
  return count > 0 ? diff / (count * 765) : 0; // normalize to 0..1 (max diff per pixel = 255*3)
}

/**
 * Detect scene changes in a video element.
 *
 * @param {HTMLVideoElement} videoElement — the video to analyze
 * @param {object} options
 *   @param {number} options.sensitivity — 0 (least sensitive) to 1 (most sensitive), default 0.5
 *   @param {number} options.sampleRate — frames to sample per second, default 5
 *   @param {number} options.startTime — start time in seconds, default 0
 *   @param {number} options.endTime — end time in seconds, default video duration
 *   @param {function} options.onProgress — callback(progress: 0..1) for progress reporting
 *   @param {AbortSignal} options.signal — AbortSignal for cancellation
 * @returns {Promise<object[]>} — array of { time, confidence, type }
 */
export async function detectScenes(videoElement, options = {}) {
  const {
    sensitivity = 0.5,
    sampleRate = 5,
    startTime = 0,
    endTime = videoElement.duration || 60,
    onProgress = null,
    signal = null
  } = options;

  // Threshold: lower sensitivity → higher threshold → fewer detected cuts
  const histThreshold = 0.3 + (1 - sensitivity) * 0.7; // 0.3 (very sensitive) to 1.0 (very insensitive)
  const pixThreshold = 0.15 + (1 - sensitivity) * 0.35;

  const sampleW = 160; // downscale for speed
  const sampleH = 90;
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(sampleW, sampleH)
    : Object.assign(document.createElement('canvas'), { width: sampleW, height: sampleH });
  const ctx = canvas.getContext('2d');

  const results = [];
  const interval = 1 / sampleRate;
  const totalFrames = Math.ceil((endTime - startTime) / interval);
  let prevHistogram = null;
  let prevPixels = null;
  let frameIndex = 0;

  for (let t = startTime; t < endTime; t += interval) {
    if (signal?.aborted) break;

    // Seek video to time t
    await seekTo(videoElement, t);

    // Capture frame
    ctx.drawImage(videoElement, 0, 0, sampleW, sampleH);
    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    } catch (_) {
      break; // tainted canvas, can't analyze
    }

    const currentHistogram = luminanceHistogram(imgData.data, imgData.data.length);
    const currentPixels = new Uint8ClampedArray(imgData.data);

    if (prevHistogram) {
      const histDist = histogramDistance(prevHistogram, currentHistogram);
      const pixDiff = pixelDifference(prevPixels, currentPixels, currentPixels.length);

      // Combined metric: both histogram and pixel differences must indicate a cut
      const isHistCut = histDist > histThreshold;
      const isPixCut = pixDiff > pixThreshold;

      if (isHistCut || isPixCut) {
        const confidence = Math.min(1, (histDist / 2 + pixDiff) / 2);
        results.push({
          time: t,
          confidence,
          type: isHistCut && isPixCut ? 'hard_cut' : isHistCut ? 'dissolve' : 'flash',
          histDist,
          pixDiff
        });
      }
    }

    prevHistogram = currentHistogram;
    prevPixels = currentPixels;
    frameIndex++;

    if (onProgress && frameIndex % 10 === 0) {
      onProgress(frameIndex / totalFrames);
    }
  }

  if (onProgress) onProgress(1);
  return results;
}

/**
 * Seek a video element to a specific time and wait for the frame to be ready.
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
    // Timeout fallback in case seeked doesn't fire
    setTimeout(resolve, 500);
  });
}

/**
 * Apply detected scene cuts to the timeline — split a clip at each detected scene boundary.
 *
 * @param {object} clip — the clip to split
 * @param {object[]} scenes — detected scene boundaries
 * @returns {object[]} — array of { time } objects suitable for blade operations
 */
export function scenesToBladePoints(clip, scenes) {
  return scenes
    .filter((s) => s.time > clip.start && s.time < clip.end)
    .map((s) => ({
      time: s.time,
      confidence: s.confidence,
      type: s.type
    }));
}
