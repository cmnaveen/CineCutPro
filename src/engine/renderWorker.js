/**
 * CineCutPro — Background Render Orchestrator.
 *
 * Coordinates non-blocking frame-by-frame offline rendering. Programmatically steps the
 * playhead frame-by-frame, drives the visual mediaRenderer directly, captures the canvas
 * output, and processes frames for export.
 */

export class RenderOrchestrator {
  /**
   * Create a RenderOrchestrator instance.
   *
   * @param {object} options
   *   @param {number} options.fps - Render target frame rate (default 30)
   *   @param {function} options.onProgress - Progress callback: (progress: 0..1)
   *   @param {number} options.width - Output width
   *   @param {number} options.height - Output height
   */
  constructor(options = {}) {
    this.fps = options.fps ?? 30;
    this.onProgress = options.onProgress ?? null;
    this.width = options.width ?? 1920;
    this.height = options.height ?? 1080;
    this.aborted = false;
  }

  /**
   * Cancel the render process.
   */
  abort() {
    this.aborted = true;
  }

  /**
   * Run background frame-by-frame rendering.
   *
   * @param {object} state - Editor state snapshot
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @param {object} mediaRenderer - Reference to the mediaRenderer singleton
   * @param {function} onFrame - Callback to capture/record the rendered frame
   */
  async render(state, startTime, endTime, mediaRenderer, onFrame) {
    this.aborted = false;
    const duration = endTime - startTime;
    const frameInterval = 1 / this.fps;
    const totalFrames = Math.ceil(duration / frameInterval);

    // Pause real-time rendering loop to prevent overlapping ticks
    mediaRenderer.stop();

    let frameIndex = 0;

    for (let t = startTime; t < endTime; t += frameInterval) {
      if (this.aborted) {
        break;
      }

      // 1. Update playhead & state in compositor
      mediaRenderer.localPlayhead = t;
      const frameState = {
        ...state,
        playhead: t,
        playing: false,
        seekId: `export_${Date.now()}` // Simulate seek
      };
      mediaRenderer.setState(frameState);

      // 2. Force synchronous render call (using 0 elapsed dt so playback doesn't tick)
      mediaRenderer._tick(0);

      // 3. Callback to let consumer copy canvas frame or feed WebCodecs encoder
      if (onFrame) {
        onFrame(t);
      }

      // 4. Report progress
      frameIndex++;
      if (this.onProgress) {
        this.onProgress(Math.min(0.99, frameIndex / totalFrames));
      }

      // 5. Yield control back to browser so rendering runs asynchronously & UI remains responsive
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (this.onProgress && !this.aborted) {
      this.onProgress(1.0);
    }

    // Re-start rendering loop when finished
    mediaRenderer.start();
  }
}
