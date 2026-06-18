/**
 * EditFree Web Video Editor — Procedural Mock Assets
 * Generates custom videos, audios, and images drawn directly on Canvas
 * or synthesized via Web Audio API. Enables offline immediate testing.
 */

export const generateMockAssets = () => {
  return [
    {
      id: 'mock_vid_countdown',
      name: 'Retro Countdown (Video)',
      type: 'video',
      duration: 10,
      width: 1920,
      height: 1080,
      thumbnail: 'countdown',
      draw: (ctx, time) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Background - Dark radial gradient
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width*0.6);
        bgGrad.addColorStop(0, '#111827');
        bgGrad.addColorStop(1, '#030712');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Circular sweep radar lines
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width/2, height/2, height*0.35, 0, Math.PI*2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(width/2, height/2, height*0.2, 0, Math.PI*2);
        ctx.stroke();

        // Crosshairs
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.beginPath();
        ctx.moveTo(width/2 - height*0.4, height/2);
        ctx.lineTo(width/2 + height*0.4, height/2);
        ctx.moveTo(width/2, height/2 - height*0.4);
        ctx.lineTo(width/2, height/2 + height*0.4);
        ctx.stroke();

        // Calculate sweep angle (rotates once per second)
        const currentSecond = Math.floor(time);
        const secondFraction = time - currentSecond;
        const angle = -Math.PI/2 + (secondFraction * Math.PI * 2);

        // Sweeper sector
        ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.beginPath();
        ctx.moveTo(width/2, height/2);
        ctx.arc(width/2, height/2, height*0.35, -Math.PI/2, angle, false);
        ctx.closePath();
        ctx.fill();

        // Sweeper line
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(width/2, height/2);
        ctx.lineTo(width/2 + Math.cos(angle) * height*0.35, height/2 + Math.sin(angle) * height*0.35);
        ctx.stroke();

        // Center Countdown Number (Counts down from 10 to 1)
        const count = Math.ceil(10 - time);
        const displayCount = count > 0 ? count : 'START';

        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#f3f4f6';
        ctx.font = `bold ${height*0.25}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayCount, width/2, height/2);
        
        ctx.shadowBlur = 0; // reset

        // Bottom status info
        ctx.fillStyle = '#9ca3af';
        ctx.font = `${height*0.04}px 'JetBrains Mono', monospace`;
        ctx.fillText(`MOCK DECODER SMPTE: ${formatTime(time)}`, width/2, height*0.9);
      },
      audioSynth: (audioCtx, time) => {
        // Blip at each second mark
        const secondFraction = time % 1.0;
        if (secondFraction < 0.08) {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          // Higher beep on the final second
          const isFinal = time >= 9.0;
          osc.frequency.setValueAtTime(isFinal ? 1200 : 800, audioCtx.currentTime);
          osc.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
          
          osc.start();
          osc.stop(audioCtx.currentTime + 0.1);
        }
      }
    },
    {
      id: 'mock_vid_gradient',
      name: 'Gradient Waves (Video)',
      type: 'video',
      duration: 15,
      width: 1920,
      height: 1080,
      thumbnail: 'gradient',
      draw: (ctx, time) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Morphing background color based on time
        const hue1 = (time * 12) % 360;
        const hue2 = (hue1 + 120) % 360;
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, `hsl(${hue1}, 70%, 15%)`);
        bgGrad.addColorStop(1, `hsl(${hue2}, 70%, 8%)`);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Multiple floating light circles
        const circles = [
          { x: width * 0.3 + Math.sin(time * 0.8) * width * 0.1, y: height * 0.4 + Math.cos(time * 1.1) * height * 0.1, r: height * 0.35, c: '#8b5cf6' },
          { x: width * 0.7 + Math.cos(time * 0.9) * width * 0.1, y: height * 0.6 + Math.sin(time * 1.3) * height * 0.1, r: height * 0.3, c: '#06b6d4' }
        ];

        ctx.globalCompositeOperation = 'screen';
        circles.forEach(c => {
          const radial = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
          radial.addColorStop(0, c.c + '44'); // semi transparent
          radial.addColorStop(1, c.c + '00'); // fully transparent
          ctx.fillStyle = radial;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';

        // Draw sine wave curves overlay
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height * 0.5 + Math.sin(x * 0.003 + time * 2) * height * 0.15 + Math.cos(x * 0.008 - time) * 30;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Text overlay
        ctx.fillStyle = 'white';
        ctx.font = `bold ${height*0.06}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('DYNAMIC SHADER ENGINE', width/2, height*0.15);
      },
      audioSynth: (audioCtx, time) => {
        // Generates ambient low frequency sweeps
        const secondFraction = time % 1.0;
        // sweep tone every 2 seconds
        if (Math.floor(time) % 2 === 0 && secondFraction < 0.02) {
          const osc = audioCtx.createOscillator();
          const filter = audioCtx.createBiquadFilter();
          const gainNode = audioCtx.createGain();

          osc.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 1.2);

          filter.type = 'lowpass';
          filter.Q.setValueAtTime(10, audioCtx.currentTime);
          filter.frequency.setValueAtTime(200, audioCtx.currentTime);
          filter.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.8);

          gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.8);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

          osc.start();
          osc.stop(audioCtx.currentTime + 1.6);
        }
      }
    },
    {
      id: 'mock_vid_bouncing',
      name: 'Bouncing Orb (Video)',
      type: 'video',
      duration: 20,
      width: 1920,
      height: 1080,
      thumbnail: 'bouncing',
      draw: (ctx, time) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, width, height);

        // Grid lines background
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridSize = 80;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Bouncing logic based on time
        // Bound sizes
        const radius = 90;
        const fieldW = width - radius * 2;
        const fieldH = height - radius * 2;
        
        // Velocities
        const vx = 400; // px/sec
        const vy = 300;

        let xVal = (vx * time) % (fieldW * 2);
        if (xVal > fieldW) xVal = fieldW * 2 - xVal;
        xVal += radius;

        let yVal = (vy * time) % (fieldH * 2);
        if (yVal > fieldH) yVal = fieldH * 2 - yVal;
        yVal += radius;

        // Draw shadow/glow first
        const orbGlow = ctx.createRadialGradient(xVal, yVal, 0, xVal, yVal, radius * 2);
        orbGlow.addColorStop(0, 'rgba(6, 182, 212, 0.6)');
        orbGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
        orbGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = orbGlow;
        ctx.beginPath();
        ctx.arc(xVal, yVal, radius * 2, 0, Math.PI*2);
        ctx.fill();

        // Draw sphere core
        const orbCore = ctx.createRadialGradient(xVal - radius*0.3, yVal - radius*0.3, 5, xVal, yVal, radius);
        orbCore.addColorStop(0, '#ffffff');
        orbCore.addColorStop(0.2, '#e0f7fa');
        orbCore.addColorStop(0.8, '#06b6d4');
        orbCore.addColorStop(1, '#0891b2');
        ctx.fillStyle = orbCore;
        ctx.beginPath();
        ctx.arc(xVal, yVal, radius, 0, Math.PI*2);
        ctx.fill();

        // Draw speed indicators
        ctx.fillStyle = '#6b7280';
        ctx.font = `14px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`ORB X: ${xVal.toFixed(1)} PX`, 40, 50);
        ctx.fillText(`ORB Y: ${yVal.toFixed(1)} PX`, 40, 75);
        ctx.fillText(`FPS FRAME: ${Math.round(time * 30)}`, 40, 100);
      },
      audioSynth: (audioCtx, time) => {
        // High beep oscillation triggers on speed change or just simple note loops
        const noteIndex = Math.floor(time * 2) % 8;
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C major
        const fraction = (time * 2) % 1.0;

        if (fraction < 0.05) {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(notes[noteIndex], audioCtx.currentTime);
          
          gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
          
          osc.start();
          osc.stop(audioCtx.currentTime + 0.18);
        }
      }
    },
    {
      id: 'mock_img_sunset',
      name: 'Retro Sunset (Image)',
      type: 'image',
      duration: 10,
      width: 1920,
      height: 1080,
      thumbnail: 'sunset',
      draw: (ctx, time) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Space purple sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        skyGrad.addColorStop(0, '#0a051d');
        skyGrad.addColorStop(0.5, '#1e0b36');
        skyGrad.addColorStop(1, '#ff007f');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height * 0.6);

        // Synthwave Sunset Sun
        const sunY = height * 0.55;
        const sunR = height * 0.25;
        const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY);
        sunGrad.addColorStop(0, '#ffe600');
        sunGrad.addColorStop(0.5, '#ff5100');
        sunGrad.addColorStop(1, '#ff007f');
        
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(width/2, sunY, sunR, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();

        // Draw horizontal split lines in sun (retro lines)
        ctx.fillStyle = '#1e0b36';
        const lineCount = 8;
        for (let i = 1; i <= lineCount; i++) {
          const lineY = sunY - (sunR * (i / (lineCount + 1)));
          const thickness = (i / lineCount) * 12;
          ctx.fillRect(width/2 - sunR - 10, lineY, sunR * 2 + 20, thickness);
        }

        // Perspective grid lines (bottom 40% of canvas)
        ctx.fillStyle = '#05030a';
        ctx.fillRect(0, height * 0.6, width, height * 0.4);

        // Horizon line glow
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.6);
        ctx.lineTo(width, height * 0.6);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Perspective lines radiating outward
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
        ctx.lineWidth = 2;
        const perspectives = 24;
        for (let i = 0; i <= perspectives; i++) {
          const startX = width * 0.5;
          const startY = height * 0.6;
          const endX = (width / perspectives) * i;
          const endY = height;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

        // Horizontal grid lines moving down (simulated scrolling via time)
        const scrollOffset = (time * 50) % 60;
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
        ctx.lineWidth = 2;
        
        const gridLines = 10;
        for (let i = 0; i < gridLines; i++) {
          // Perspective spacing (lines get further apart closer to the bottom)
          const baseIndex = i + (scrollOffset / 60);
          const ratio = Math.pow(baseIndex / gridLines, 2);
          const lineY = (height * 0.6) + (height * 0.4 * ratio);
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(width, lineY);
          ctx.stroke();
        }
      }
    },
    {
      id: 'mock_audio_beat',
      name: 'Cybernetic Beat (Audio)',
      type: 'audio',
      duration: 30,
      thumbnail: 'audio_beat',
      draw: (ctx, time) => {
        // Draw visual waveform or audio graphic
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);

        // Draw audio visualization bars
        ctx.fillStyle = '#06b6d4';
        const barCount = 30;
        const barW = width / barCount - 4;
        const step = Math.floor(time * 8);

        for (let i = 0; i < barCount; i++) {
          const noise = Math.sin(i * 0.3 + time * 10) * Math.cos(i * 0.7 - time * 5);
          const h = (0.2 + Math.abs(noise) * 0.6) * height * 0.5;
          ctx.fillRect(i * (barW + 4) + 2, height/2 - h/2, barW, h);
        }

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold ${height*0.06}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('CYBER AUDIO MIX', width/2, height*0.15);
      },
      audioSynth: (audioCtx, time) => {
        // Beat generator: Kick beat on every quarter second, snare on every second, high-hats on 8ths
        const tempo = 120; // BPM
        const beatInterval = 60 / tempo; // 0.5s per beat
        const relativeTime = time % beatInterval;
        
        // 1. Kick: trigger on exact beatInterval
        if (relativeTime < 0.04) {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          osc.frequency.setValueAtTime(150, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          osc.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
          
          osc.start();
          osc.stop(audioCtx.currentTime + 0.22);
        }

        // 2. High-hat: trigger on eighth notes (half of beatInterval)
        const subFraction = time % (beatInterval / 2);
        if (subFraction < 0.02 && relativeTime >= 0.04) {
          // White noise synth
          const bufferSize = audioCtx.sampleRate * 0.04;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(7000, audioCtx.currentTime);

          const gainNode = audioCtx.createGain();
          
          noise.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.035);

          noise.start();
          noise.stop(audioCtx.currentTime + 0.04);
        }
      }
    }
  ];
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

// Generates dynamic thumbnail data URI based on type
export const getThumbnailDataUri = (type) => {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext('2d');
  
  if (type === 'countdown') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0,0,160,90);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(80,45,30,0,Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = '#f3f4f6';
    ctx.font = "bold 20px Outfit";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("5", 80, 45);
  } else if (type === 'gradient') {
    const gradient = ctx.createLinearGradient(0,0,160,90);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#06b6d4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,160,90);
  } else if (type === 'bouncing') {
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0,0,160,90);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(45,30,12,0,Math.PI*2);
    ctx.fill();
  } else if (type === 'sunset') {
    ctx.fillStyle = '#1e0b36';
    ctx.fillRect(0,0,160,90);
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(80,55,20,Math.PI,0);
    ctx.fill();
  } else if (type === 'adjustment') {
    const gradient = ctx.createLinearGradient(0,0,160,90);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#a855f7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,160,90);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px Outfit";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("⚡ Adjustment Clip", 80, 45);
  } else {
    // Audio / default
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0,0,160,90);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 45);
    for (let i = 10; i < 150; i += 10) {
      ctx.lineTo(i, 45 + Math.sin(i * 0.1) * 20);
    }
    ctx.stroke();
  }
  
  return canvas.toDataURL();
};
