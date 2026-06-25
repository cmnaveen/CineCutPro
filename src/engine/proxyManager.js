/**
 * CineCutPro — Proxy Clip Manager.
 *
 * Automatically generates low-resolution proxy files (e.g., 480x270 WebM) for
 * high-resolution video assets. This allows smooth scrub and playback during editing
 * while preserving high-resolution originals for the final export.
 */

import { putMedia } from './mediaStore.js';

/**
 * Check if the browser supports canvas stream capture and MediaRecorder.
 */
export function isProxySupported() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Generate a low-resolution proxy for a video media item.
 *
 * @param {object} mediaItem - The original media item from editor state
 * @param {function} onProgress - Callback for progress updates: (progress: 0..1)
 * @returns {Promise<string>} - Resolves with the generated proxy Blob URL
 */
export function generateProxy(mediaItem, onProgress = null) {
  return new Promise((resolve, reject) => {
    if (mediaItem.kind !== 'video') {
      return reject(new Error('Only video items can have proxies generated.'));
    }

    if (!isProxySupported()) {
      return reject(new Error('MediaRecorder or Canvas Capture is not supported in this browser.'));
    }

    const video = document.createElement('video');
    video.src = mediaItem.src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      // Calculate target downscaled dimensions (max width 480, preserving aspect ratio)
      const maxW = 480;
      const srcW = video.videoWidth || 1920;
      const srcH = video.videoHeight || 1080;
      const scale = Math.min(1, maxW / srcW);
      const targetW = Math.round(srcW * scale);
      const targetH = Math.round(srcH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Setup recorder stream at 24fps
      let stream;
      try {
        stream = canvas.captureStream(24);
      } catch (e) {
        video.remove();
        return reject(new Error('Failed to capture canvas stream: ' + e.message));
      }

      // Check supported WebM codecs
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      }

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 400000 }); // 400 kbps (low quality/fast)
      } catch (e) {
        video.remove();
        return reject(new Error('Failed to create MediaRecorder: ' + e.message));
      }

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        video.remove();
        try {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const proxyId = `proxy_${mediaItem.id}`;
          // Store proxy in IndexedDB
          await putMedia(proxyId, blob);
          const proxyUrl = URL.createObjectURL(blob);
          resolve(proxyUrl);
        } catch (err) {
          reject(err);
        }
      };

      // Set playbackRate higher to speed up proxy generation
      video.playbackRate = 2.0;

      let animFrameId = null;
      
      const drawFrame = () => {
        if (video.ended || video.paused) return;
        ctx.drawImage(video, 0, 0, targetW, targetH);
        
        if (onProgress && video.duration) {
          onProgress(Math.min(0.99, video.currentTime / video.duration));
        }

        animFrameId = requestAnimationFrame(drawFrame);
      };

      recorder.start();
      video.play()
        .then(() => {
          drawFrame();
        })
        .catch((err) => {
          if (animFrameId) cancelAnimationFrame(animFrameId);
          recorder.stop();
          video.remove();
          reject(new Error('Failed to play video for proxy generation: ' + err.message));
        });

      video.onended = () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        recorder.stop();
        if (onProgress) onProgress(1.0);
      };

      video.onerror = () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (recorder.state !== 'inactive') recorder.stop();
        video.remove();
        reject(new Error('Error during video playback for proxy generation.'));
      };
    };

    video.onerror = () => {
      video.remove();
      reject(new Error('Failed to load original video metadata.'));
    };
  });
}
