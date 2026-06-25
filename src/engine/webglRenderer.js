/**
 * CineCutPro — WebGL Rendering & Acceleration Pipeline.
 *
 * Runs video frame processing (color grading, chroma key, vignette, basic adjustments)
 * on the GPU using WebGL shaders. This replaces slow per-pixel CPU loops and builds a
 * high-performance hybrid rendering pipeline.
 */

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    // Map from 2D coordinates [-1, 1] to clipping space
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  
  // Basic Adjustments
  uniform float u_exposure;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_vignette;
  
  // Lift, Gamma, Gain (3-Way Color Wheels)
  uniform vec3 u_lift;
  uniform vec3 u_gamma;
  uniform vec3 u_gain;
  
  // Chroma Key
  uniform vec4 u_chromaKey; // rgb color + float enabled
  uniform float u_chromaSimilarity;
  uniform float u_chromaSmoothness;

  // Temperature / Tint
  uniform float u_temperature;
  uniform float u_tint;

  // Simple Color Temperature Adjustment
  vec3 adjustColorTemp(vec3 color, float temp, float tintVal) {
    // Temperature: shift towards blue (negative) or yellow (positive)
    color.r += temp * 0.12;
    color.b -= temp * 0.12;
    
    // Tint: shift towards green (negative) or magenta (positive)
    color.g -= tintVal * 0.08;
    color.r += tintVal * 0.04;
    color.b += tintVal * 0.04;
    return clamp(color, 0.0, 1.0);
  }

  void main() {
    // Flip Y tex-coord because WebGL coordinate space starts bottom-left
    vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
    vec4 color = texture2D(u_image, uv);
    
    if (color.a == 0.0) {
      gl_FragColor = color;
      return;
    }

    // 1. Chroma Key
    if (u_chromaKey.w > 0.5) {
      vec3 keyColor = u_chromaKey.xyz;
      float dist = distance(color.rgb, keyColor);
      if (dist < u_chromaSimilarity) {
        float edge = (u_chromaSimilarity - dist) / max(u_chromaSmoothness, 0.001);
        color.a = 1.0 - clamp(edge, 0.0, 1.0);
      }
    }

    if (color.a > 0.0) {
      // 2. Exposure (stop adjustments)
      color.rgb *= pow(2.0, u_exposure);

      // 3. Brightness & Contrast
      color.rgb *= u_brightness;
      color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

      // 4. Color Temperature and Tint
      color.rgb = adjustColorTemp(color.rgb, u_temperature, u_tint);

      // 5. Lift, Gamma, Gain (Color Wheels)
      // Lift: shift black point
      color.rgb = color.rgb + u_lift * (1.0 - color.rgb);
      // Gain: scale highlight/white point
      color.rgb = color.rgb * u_gain;
      // Gamma: midtone power curve
      color.rgb = pow(clamp(color.rgb, 0.0, 1.0), vec3(1.0) / max(u_gamma, vec3(0.01)));

      // 6. Saturation
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, u_saturation);

      // 7. Vignette (radial darkness at edges)
      if (u_vignette > 0.0) {
        float dist = distance(v_texCoord, vec2(0.5, 0.5));
        float vignette = smoothstep(0.8, 0.8 - u_vignette * 0.45, dist);
        color.rgb *= vignette;
      }
    }

    gl_FragColor = color;
  }
`;

class WebGLRenderer {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.buffer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return true;
    try {
      this.canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(640, 360)
        : document.createElement('canvas');
      this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
                this.canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
      
      if (!this.gl) {
        console.warn('WebGL context creation failed.');
        return false;
      }

      const gl = this.gl;

      // Create shaders
      const vs = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
      if (!vs || !fs) return false;

      // Create program
      this.program = gl.createProgram();
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error('WebGL program link failed:', gl.getProgramInfoLog(this.program));
        return false;
      }

      gl.useProgram(this.program);

      // Setup coordinates (full quad)
      const vertices = new Float32Array([
        -1.0, -1.0,   0.0, 0.0,
         1.0, -1.0,   1.0, 0.0,
        -1.0,  1.0,   0.0, 1.0,
        -1.0,  1.0,   0.0, 1.0,
         1.0, -1.0,   1.0, 0.0,
         1.0,  1.0,   1.0, 1.0,
      ]);

      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const a_position = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(a_position);
      gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);

      const a_texCoord = gl.getAttribLocation(this.program, 'a_texCoord');
      gl.enableVertexAttribArray(a_texCoord);
      gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);

      // Create texture
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.defineProperty = (obj, prop, desc) => Object.defineProperty(obj, prop, desc);
      
      // Default parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      this.initialized = true;
      return true;
    } catch (e) {
      console.error('Failed to initialize WebGLRenderer:', e);
      return false;
    }
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Process a frame (video element, canvas, or image) through the WebGL pipeline.
   *
   * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source - the visual source
   * @param {number} width - target render width
   * @param {number} height - target render height
   * @param {object} params - grading and keying parameters
   * @returns {HTMLCanvasElement|OffscreenCanvas} - the WebGL canvas containing processed frame
   */
  process(source, width, height, params = {}) {
    if (!this.init()) return source; // fallback to raw source if WebGL initialization failed

    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(this.program);

    // Bind and upload texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    // Set uniforms
    this._setUniform1f('u_exposure', params.exposure ?? 0);
    this._setUniform1f('u_brightness', params.brightness ?? 1);
    this._setUniform1f('u_contrast', params.contrast ?? 1);
    this._setUniform1f('u_saturation', params.saturation ?? 1);
    this._setUniform1f('u_vignette', params.vignette ?? 0);
    
    this._setUniform1f('u_temperature', params.temperature ?? 0);
    this._setUniform1f('u_tint', params.tint ?? 0);

    // Lift/Gamma/Gain color wheels
    const lift = params.lift ?? { r: 0, g: 0, b: 0 };
    const gamma = params.gamma ?? { r: 1, g: 1, b: 1 };
    const gain = params.gain ?? { r: 1, g: 1, b: 1 };
    this._setUniform3f('u_lift', lift.r, lift.g, lift.b);
    this._setUniform3f('u_gamma', gamma.r, gamma.g, gamma.b);
    this._setUniform3f('u_gain', gain.r, gain.g, gain.b);

    // Chroma key
    const ck = params.chromaKey ?? {};
    if (ck.enabled && ck.color) {
      // Normalize key color from #hex or rgb
      const rgb = this._hexToRgb(ck.color);
      this._setUniform4f('u_chromaKey', rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0);
      this._setUniform1f('u_chromaSimilarity', ck.similarity ?? 0.15);
      this._setUniform1f('u_chromaSmoothness', ck.smoothness ?? 0.05);
    } else {
      this._setUniform4f('u_chromaKey', 0, 0, 0, 0);
      this._setUniform1f('u_chromaSimilarity', 0);
      this._setUniform1f('u_chromaSmoothness', 0);
    }

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return this.canvas;
  }

  _setUniform1f(name, val) {
    const loc = this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform1f(loc, val);
  }

  _setUniform3f(name, x, y, z) {
    const loc = this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform3f(loc, x, y, z);
  }

  _setUniform4f(name, x, y, z, w) {
    const loc = this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform4f(loc, x, y, z, w);
  }

  _hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    let c = hex.trim();
    if (c.startsWith('#')) c = c.slice(1);
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const val = parseInt(c, 16);
    return {
      r: (val >> 16) & 255,
      g: (val >> 8) & 255,
      b: val & 255
    };
  }

  destroy() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
    this.canvas = null;
    this.initialized = false;
  }
}

export const webglRenderer = new WebGLRenderer();
