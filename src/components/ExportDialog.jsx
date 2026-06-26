import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { mediaRenderer } from '../engine/mediaRenderer.js';
import { audioEngine } from '../engine/audioEngine.js';
import { formatTC } from '../engine/timecode.js';
import { exportAndDownload } from '../engine/subtitleExporter.js';

const FORMAT_OPTIONS = [
  { id: 'webm-vp9',  label: 'WebM · VP9',   mime: 'video/webm;codecs=vp9,opus' },
  { id: 'webm-vp8',  label: 'WebM · VP8',   mime: 'video/webm;codecs=vp8,opus' },
  { id: 'mp4-h264',  label: 'MP4 · H.264',  mime: 'video/mp4;codecs=h264' }
];

export function ExportDialog() {
  const { state, dispatch, duration } = useEditor();
  const open = state.ui.exportOpen;

  const p = state.project;
  const currentRatio = p.width / p.height;
  const isVertical = p.height > p.width;

  const dynamicResolutions = [
    { id: '720p', label: `${isVertical ? 720 : Math.round(720 * currentRatio)} × ${isVertical ? Math.round(720 / currentRatio) : 720}`, w: isVertical ? 720 : Math.round(720 * currentRatio), h: isVertical ? Math.round(720 / currentRatio) : 720 },
    { id: '1080p', label: `${isVertical ? 1080 : Math.round(1080 * currentRatio)} × ${isVertical ? Math.round(1080 / currentRatio) : 1080}`, w: isVertical ? 1080 : Math.round(1080 * currentRatio), h: isVertical ? Math.round(1080 / currentRatio) : 1080 },
    { id: '4k', label: `${isVertical ? 2160 : Math.round(2160 * currentRatio)} × ${isVertical ? Math.round(2160 / currentRatio) : 2160}`, w: isVertical ? 2160 : Math.round(2160 * currentRatio), h: isVertical ? Math.round(2160 / currentRatio) : 2160 }
  ];

  const [format, setFormat] = useState(FORMAT_OPTIONS[0]);
  const [selectedResId, setSelectedResId] = useState('1080p');
  const res = dynamicResolutions.find((r) => r.id === selectedResId) || dynamicResolutions[1];
  const [bitrate, setBitrate] = useState(12); // Mbps
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const orchestratorRef = useRef(null);

  const close = useCallback(() => {
    if (recording) return;
    dispatch({ type: 'ui/set', key: 'exportOpen', value: false });
  }, [recording, dispatch]);

  // Reset state when re-opened
  useEffect(() => {
    if (open) {
      setProgress(0);
      setResultUrl(null);
    }
  }, [open]);

  const start = useCallback(async () => {
    if (!('MediaRecorder' in window)) {
      alert('MediaRecorder is unavailable in this browser.');
      return;
    }
    const program = document.querySelector('canvas.cc-program-canvas');
    if (!program) return;

    // Composite the program canvas into a target-resolution export canvas,
    // fit-scaled (letterboxed) so any chosen resolution looks correct.
    const out = document.createElement('canvas');
    out.width = res.w;
    out.height = res.h;
    const octx = out.getContext('2d', { alpha: false });
    const drawFrame = () => {
      octx.fillStyle = '#000';
      octx.fillRect(0, 0, out.width, out.height);
      const pw = program.width || 1920;
      const ph = program.height || 1080;
      const s = Math.min(out.width / pw, out.height / ph);
      const dw = pw * s;
      const dh = ph * s;
      octx.drawImage(program, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh);
    };

    const fps = state.project.fps || 30;
    const stream = out.captureStream(fps);
    // Mux the live master audio mix in alongside the video track.
    const audioStream = audioEngine.getExportStream();
    if (audioStream) for (const tr of audioStream.getAudioTracks()) stream.addTrack(tr);

    let mime = format.mime;
    if (!MediaRecorder.isTypeSupported(mime)) {
      const fallback = FORMAT_OPTIONS.find((f) => MediaRecorder.isTypeSupported(f.mime));
      if (!fallback) {
        alert('No supported MediaRecorder mime types in this browser.');
        return;
      }
      mime = fallback.mime;
    }
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: bitrate * 1_000_000
    });
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      setResultUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    recorderRef.current = rec;

    const inAt = state.inPoint ?? 0;
    const endAt = state.outPoint ?? duration;

    setRecording(true);
    setProgress(0);
    rec.start();

    try {
      const { RenderOrchestrator } = await import('../engine/renderWorker.js');
      const orchestrator = new RenderOrchestrator({
        fps,
        width: res.w,
        height: res.h,
        onProgress: (p) => setProgress(p)
      });
      orchestratorRef.current = orchestrator;

      await orchestrator.render(
        state,
        inAt,
        endAt,
        mediaRenderer,
        (_t) => {
          drawFrame();
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      if (rec.state === 'recording') {
        rec.stop();
      }
      setRecording(false);
      dispatch({ type: 'playback/setPlayhead', t: inAt });
    }
  }, [state, format, bitrate, dispatch, duration, res]);

  const cancel = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.abort();
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    dispatch({ type: 'playback/pause' });
  }, [dispatch]);

  if (!open) return null;
  return (
    <div className="cc-modal-root" onClick={close}>
      <div className="cc-modal cc-export" onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal__header">
          <div className="cc-modal__title">
            <Icon.Export size={16} /> Export composition
          </div>
          <button className="cc-icon-btn" onClick={close} disabled={recording}>✕</button>
        </header>

        <div className="cc-export__body">
          <div className="cc-export__col">
            <h4>Format</h4>
            <div className="cc-export__grid">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  className={`cc-export__option ${format.id === f.id ? 'is-on' : ''}`}
                  onClick={() => setFormat(f)}
                  disabled={recording}
                >
                  {f.label}
                  {typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported?.(f.mime) && <em>· unsupported</em>}
                </button>
              ))}
            </div>

            <h4>Resolution</h4>
            <div className="cc-export__grid">
              {dynamicResolutions.map((r) => (
                <button
                  key={r.id}
                  className={`cc-export__option ${res.id === r.id ? 'is-on' : ''}`}
                  onClick={() => setSelectedResId(r.id)}
                  disabled={recording}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <label className="cc-field">
              <span className="cc-field__label">Bitrate <strong>{bitrate} Mbps</strong></span>
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={bitrate}
                onChange={(e) => setBitrate(parseInt(e.target.value, 10))}
                disabled={recording}
              />
            </label>

            <div style={{ marginTop: '20px', borderTop: '1px solid var(--line-2)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Export Subtitles</h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="cc-pill"
                  onClick={() => exportAndDownload(state.clips, 'srt', state.project.name)}
                  title="Download SRT captions"
                >
                  SRT
                </button>
                <button
                  className="cc-pill"
                  onClick={() => exportAndDownload(state.clips, 'vtt', state.project.name)}
                  title="Download WebVTT captions"
                >
                  WebVTT
                </button>
                <button
                  className="cc-pill"
                  onClick={() => exportAndDownload(state.clips, 'ass', state.project.name, { width: state.project.width, height: state.project.height })}
                  title="Download ASS styled captions"
                >
                  ASS (Styled)
                </button>
              </div>
            </div>
          </div>

          <div className="cc-export__col cc-export__col--summary">
            <h4>Summary</h4>
            <div className="cc-export__kv"><span>Duration</span><strong>{formatTC((state.outPoint ?? duration) - (state.inPoint ?? 0))}</strong></div>
            <div className="cc-export__kv"><span>Frame rate</span><strong>{state.project.fps} fps</strong></div>
            <div className="cc-export__kv"><span>Frames</span><strong>{Math.round(((state.outPoint ?? duration) - (state.inPoint ?? 0)) * state.project.fps)}</strong></div>
            <div className="cc-export__kv"><span>Format</span><strong>{format.label}</strong></div>
            <div className="cc-export__kv"><span>Bitrate</span><strong>{bitrate} Mbps</strong></div>

            <div className="cc-export__progress">
              <div className="cc-export__bar"><div style={{ width: `${progress * 100}%` }} /></div>
              <div className="cc-export__pct">{Math.round(progress * 100)}%</div>
            </div>

            {!recording && !resultUrl && (
              <button className="cc-btn cc-btn--primary cc-btn--lg" onClick={start}>
                <Icon.Export /> Begin export
              </button>
            )}
            {recording && (
              <button className="cc-btn cc-btn--ghost cc-btn--lg" onClick={cancel}>
                Cancel
              </button>
            )}
            {resultUrl && (
              <div className="cc-export__done">
                <video src={resultUrl} controls />
                <a className="cc-btn cc-btn--primary" href={resultUrl} download={`${state.project.name.replace(/\s+/g, '_')}.${format.id.startsWith('mp4') ? 'mp4' : 'webm'}`}>
                  Download
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
