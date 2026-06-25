/**
 * CineCutPro — Color Scopes Engine.
 *
 * Real-time waveform, vectorscope, histogram, and RGB parade rendering.
 * Reads pixel data from the program canvas and renders to scope canvases.
 *
 * Usage:
 *   import { renderWaveform, renderVectorscope, renderHistogram, renderParade } from './colorScopes.js';
 *   renderWaveform(programCanvas, scopeCanvas);
 */

const SCOPE_BG = '#0a0c10';
const SCOPE_GRID = 'rgba(255,255,255,0.08)';

/**
 * Sample pixels from a source canvas at reduced resolution for performance.
 * Returns { data, width, height } of the sampled ImageData.
 */
function samplePixels(sourceCanvas, maxW = 320, maxH = 180) {
  const sw = Math.min(maxW, sourceCanvas.width);
  const sh = Math.min(maxH, sourceCanvas.height);
  const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(sw, sh)
    : Object.assign(document.createElement('canvas'), { width: sw, height: sh });
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(sourceCanvas, 0, 0, sw, sh);
  let imgData;
  try {
    imgData = tmpCtx.getImageData(0, 0, sw, sh);
  } catch (_) {
    return null; // tainted canvas
  }
  return { data: imgData.data, width: sw, height: sh };
}

/**
 * Render a luminance waveform to a scope canvas.
 * X-axis = horizontal position in frame, Y-axis = luminance (0 bottom, 255 top).
 *
 * @param {HTMLCanvasElement} sourceCanvas — program output canvas
 * @param {HTMLCanvasElement} scopeCanvas — canvas to render the waveform onto
 */
export function renderWaveform(sourceCanvas, scopeCanvas) {
  const ctx = scopeCanvas.getContext('2d');
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;

  // Background
  ctx.fillStyle = SCOPE_BG;
  ctx.fillRect(0, 0, w, h);

  // Grid lines at 0%, 25%, 50%, 75%, 100% IRE
  ctx.strokeStyle = SCOPE_GRID;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const sample = samplePixels(sourceCanvas);
  if (!sample) return;

  const { data, width, height } = sample;
  ctx.fillStyle = 'rgba(0,220,120,0.12)';

  for (let col = 0; col < width; col++) {
    const x = (col / width) * w;
    for (let row = 0; row < height; row++) {
      const i = (row * width + col) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const y = h - (lum / 255) * h;
      ctx.fillRect(x, y, Math.max(1, w / width), 1);
    }
  }
}

/**
 * Render an RGB waveform (RGB overlay mode).
 */
export function renderWaveformRGB(sourceCanvas, scopeCanvas) {
  const ctx = scopeCanvas.getContext('2d');
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;

  ctx.fillStyle = SCOPE_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = SCOPE_GRID;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const sample = samplePixels(sourceCanvas);
  if (!sample) return;
  const { data, width, height } = sample;

  const colors = ['rgba(255,50,50,0.1)', 'rgba(50,255,50,0.1)', 'rgba(50,100,255,0.1)'];

  for (let ch = 0; ch < 3; ch++) {
    ctx.fillStyle = colors[ch];
    for (let col = 0; col < width; col++) {
      const x = (col / width) * w;
      for (let row = 0; row < height; row++) {
        const i = (row * width + col) * 4 + ch;
        const val = data[i];
        const y = h - (val / 255) * h;
        ctx.fillRect(x, y, Math.max(1, w / width), 1);
      }
    }
  }
}

/**
 * Render a vectorscope to a scope canvas.
 * Plots chrominance (Cb vs Cr) as a circular scatter plot.
 *
 * @param {HTMLCanvasElement} sourceCanvas — program output canvas
 * @param {HTMLCanvasElement} scopeCanvas — canvas to render the vectorscope onto
 */
export function renderVectorscope(sourceCanvas, scopeCanvas) {
  const ctx = scopeCanvas.getContext('2d');
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 10;

  // Background
  ctx.fillStyle = SCOPE_BG;
  ctx.fillRect(0, 0, w, h);

  // Circular grid
  ctx.strokeStyle = SCOPE_GRID;
  ctx.lineWidth = 1;
  for (let r = 0.25; r <= 1; r += 0.25) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Cross
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Skin tone line (approximately at 123° from Cb axis)
  ctx.strokeStyle = 'rgba(255,180,100,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const skinAngle = (123 * Math.PI) / 180;
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(skinAngle) * radius, cy - Math.sin(skinAngle) * radius);
  ctx.stroke();

  // Color target marks (R, G, B, Cy, Mg, Yl in standard vectorscope positions)
  const targets = [
    { angle: 103, label: 'R', color: '#ff4444' },
    { angle: 241, label: 'G', color: '#44ff44' },
    { angle: 347, label: 'B', color: '#4488ff' },
    { angle: 283, label: 'Cy', color: '#44ffff' },
    { angle: 61, label: 'Mg', color: '#ff44ff' },
    { angle: 167, label: 'Yl', color: '#ffff44' }
  ];
  ctx.font = '10px monospace';
  for (const t of targets) {
    const rad = (t.angle * Math.PI) / 180;
    const tx = cx + Math.cos(rad) * radius * 0.75;
    const ty = cy - Math.sin(rad) * radius * 0.75;
    ctx.fillStyle = t.color;
    ctx.fillRect(tx - 3, ty - 3, 6, 6);
    ctx.fillText(t.label, tx + 5, ty + 3);
  }

  const sample = samplePixels(sourceCanvas, 200, 120);
  if (!sample) return;
  const { data } = sample;

  ctx.fillStyle = 'rgba(0,200,255,0.08)';

  for (let i = 0; i < data.length; i += 8) { // sample every 2nd pixel
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const px = cx + (cb / 128) * radius;
    const py = cy - (cr / 128) * radius;
    ctx.fillRect(px, py, 2, 2);
  }
}

/**
 * Render a histogram to a scope canvas.
 * Shows tonal distribution (R, G, B, and luminance).
 *
 * @param {HTMLCanvasElement} sourceCanvas — program output canvas
 * @param {HTMLCanvasElement} scopeCanvas — canvas to render the histogram onto
 */
export function renderHistogram(sourceCanvas, scopeCanvas) {
  const ctx = scopeCanvas.getContext('2d');
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;

  ctx.fillStyle = SCOPE_BG;
  ctx.fillRect(0, 0, w, h);

  const sample = samplePixels(sourceCanvas);
  if (!sample) return;
  const { data } = sample;

  // Build histograms
  const bins = 256;
  const rHist = new Float64Array(bins);
  const gHist = new Float64Array(bins);
  const bHist = new Float64Array(bins);
  const lHist = new Float64Array(bins);

  for (let i = 0; i < data.length; i += 4) {
    rHist[data[i]]++;
    gHist[data[i + 1]]++;
    bHist[data[i + 2]]++;
    const lum = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    lHist[Math.min(255, lum)]++;
  }

  // Find max for normalization
  let maxVal = 0;
  for (let i = 0; i < bins; i++) {
    maxVal = Math.max(maxVal, rHist[i], gHist[i], bHist[i], lHist[i]);
  }
  if (maxVal === 0) return;

  const drawChannel = (hist, color) => {
    ctx.fillStyle = color;
    const barW = w / bins;
    for (let i = 0; i < bins; i++) {
      const barH = (hist[i] / maxVal) * h * 0.9;
      ctx.fillRect(i * barW, h - barH, barW, barH);
    }
  };

  // Draw channels (luminance on bottom, RGB overlaid)
  ctx.globalAlpha = 0.3;
  drawChannel(lHist, 'rgba(200,200,200,1)');
  ctx.globalCompositeOperation = 'screen';
  drawChannel(rHist, 'rgba(255,60,60,1)');
  drawChannel(gHist, 'rgba(60,255,60,1)');
  drawChannel(bHist, 'rgba(60,100,255,1)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/**
 * Render an RGB Parade (separated channel waveforms side by side).
 *
 * @param {HTMLCanvasElement} sourceCanvas — program output canvas
 * @param {HTMLCanvasElement} scopeCanvas — canvas to render the parade onto
 */
export function renderParade(sourceCanvas, scopeCanvas) {
  const ctx = scopeCanvas.getContext('2d');
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;

  ctx.fillStyle = SCOPE_BG;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = SCOPE_GRID;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Dividers between channels
  const thirdW = w / 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(thirdW, 0);
  ctx.lineTo(thirdW, h);
  ctx.moveTo(thirdW * 2, 0);
  ctx.lineTo(thirdW * 2, h);
  ctx.stroke();

  // Channel labels
  ctx.font = '11px monospace';
  ctx.fillStyle = '#ff6666';
  ctx.fillText('R', 5, 14);
  ctx.fillStyle = '#66ff66';
  ctx.fillText('G', thirdW + 5, 14);
  ctx.fillStyle = '#6688ff';
  ctx.fillText('B', thirdW * 2 + 5, 14);

  const sample = samplePixels(sourceCanvas, 240, 135);
  if (!sample) return;
  const { data, width, height } = sample;

  const colors = [
    'rgba(255,80,80,0.12)',
    'rgba(80,255,80,0.12)',
    'rgba(80,120,255,0.12)'
  ];

  for (let ch = 0; ch < 3; ch++) {
    ctx.fillStyle = colors[ch];
    const xOffset = ch * thirdW;
    for (let col = 0; col < width; col++) {
      const x = xOffset + (col / width) * thirdW;
      for (let row = 0; row < height; row++) {
        const i = (row * width + col) * 4 + ch;
        const val = data[i];
        const y = h - (val / 255) * h;
        ctx.fillRect(x, y, Math.max(1, thirdW / width), 1);
      }
    }
  }
}
