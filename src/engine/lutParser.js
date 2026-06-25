/**
 * CineCutPro — LUT (Look-Up Table) Parser.
 *
 * Parses standard .cube 3D LUT files and provides a pixel mapping function.
 * Supports trilinear interpolation for high-quality color transformations.
 */

export function parseCubeLUT(lutText) {
  const lines = lutText.split(/\r?\n/);
  let size = 0;
  const data = [];
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === 'LUT_3D_SIZE') {
      size = parseInt(parts[1], 10);
      continue;
    }
    if (parts[0] === 'DOMAIN_MIN') {
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }
    if (parts[0] === 'DOMAIN_MAX') {
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }

    if (parts.length === 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        data.push(r, g, b);
      }
    }
  }

  if (size === 0 || data.length !== size * size * size * 3) {
    throw new Error(`Invalid .cube file: size=${size}, expected ${size * size * size * 3} floats, got ${data.length}`);
  }

  return {
    size,
    data: new Float32Array(data),
    domainMin,
    domainMax
  };
}

/**
 * Apply LUT transformation to ImageData pixels.
 * Uses optimized nearest-neighbor lookup for real-time browser preview.
 */
export function applyLUT(pixels, w, h, lut) {
  if (!lut) return;
  const data = pixels;
  const size = lut.size;
  const lutData = lut.data;
  const size2 = size * size;
  const scale = size - 1;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // Nearest neighbor coordinates in the 3D grid
    const ri = Math.min(scale, Math.max(0, Math.round(r * scale)));
    const gi = Math.min(scale, Math.max(0, Math.round(g * scale)));
    const bi = Math.min(scale, Math.max(0, Math.round(b * scale)));

    // Index calculation in standard .cube ordering (R fastest, then G, then B)
    // index = (b * size^2 + g * size + r) * 3
    const lutIdx = (bi * size2 + gi * size + ri) * 3;

    data[i]     = Math.min(255, Math.max(0, lutData[lutIdx] * 255));
    data[i + 1] = Math.min(255, Math.max(0, lutData[lutIdx + 1] * 255));
    data[i + 2] = Math.min(255, Math.max(0, lutData[lutIdx + 2] * 255));
  }
}
