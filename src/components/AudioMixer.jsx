import { useEffect, useState } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import '../styles/audio-mixer.css';

export function AudioMixer() {
  const { state, dispatch } = useEditor();
  const tracks = state.tracks;

  // Bouncing VU meters levels
  const [levels, setLevels] = useState({});

  useEffect(() => {
    let active = true;
    const interval = setInterval(() => {
      if (!active) return;

      setLevels((prev) => {
        const next = { ...prev };
        let masterAccL = 0;
        let masterAccR = 0;
        let activeTracksCount = 0;

        for (const t of tracks) {
          const key = t.id;
          const current = prev[key] ?? { l: 0, r: 0 };
          
          if (state.playing && !t.muted) {
            // Simulate audio signal with noise
            const noise = 0.4 + 0.6 * Math.random();
            const trackVol = t.volume;
            
            // Apply panning to left/right levels
            // pan ∈ [-1, 1], where -1 is full left, 1 is full right
            const pan = t.pan ?? 0;
            const leftPan = pan < 0 ? 1 : 1 - pan;
            const rightPan = pan > 0 ? 1 : 1 + pan;

            // Simple peak calculation
            const targetL = trackVol * noise * leftPan;
            const targetR = trackVol * noise * rightPan;

            // Attack/Decay smoothing
            next[key] = {
              l: current.l * 0.3 + targetL * 0.7,
              r: current.r * 0.3 + targetR * 0.7
            };

            masterAccL += next[key].l;
            masterAccR += next[key].r;
            activeTracksCount++;
          } else {
            // Decay to zero when paused/muted
            next[key] = {
              l: current.l * 0.5,
              r: current.r * 0.5
            };
          }
        }

        // Master levels
        const masterL = prev.master?.l ?? 0;
        const masterR = prev.master?.r ?? 0;
        
        if (state.playing && activeTracksCount > 0) {
          // Average and scale
          const mTargetL = Math.min(1.0, (masterAccL / Math.sqrt(activeTracksCount)) * state.master.volume);
          const mTargetR = Math.min(1.0, (masterAccR / Math.sqrt(activeTracksCount)) * state.master.volume);
          next.master = {
            l: masterL * 0.2 + mTargetL * 0.8,
            r: masterR * 0.2 + mTargetR * 0.8
          };
        } else {
          next.master = {
            l: masterL * 0.5,
            r: masterR * 0.5
          };
        }

        return next;
      });
    }, 60);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tracks, state.playing, state.master.volume]);

  const dbLabel = (val) => {
    if (val <= 0.001) return '-∞';
    const db = 20 * Math.log10(val);
    return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
  };

  const handleTrackVolume = (id, vol) => {
    dispatch({ type: 'track/update', id, patch: { volume: vol } });
  };

  const handleTrackPan = (id, pan) => {
    dispatch({ type: 'track/update', id, patch: { pan } });
  };

  const handleMasterVolume = (vol) => {
    dispatch({ type: 'project/update', patch: { master: { ...state.master, volume: vol } } });
  };

  return (
    <aside className="cc-audio-mixer">
      <header className="cc-audio-mixer__header">
        <div className="cc-audio-mixer__title">
          🔊 Audio Mixer
        </div>
      </header>

      <div className="cc-audio-mixer__content">
        {/* Render Tracks strips */}
        {tracks.map((t) => {
          const lVal = levels[t.id]?.l ?? 0;
          const rVal = levels[t.id]?.r ?? 0;
          const panLabel = t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan) * 10)}` : `R${Math.round(t.pan * 10)}`;

          return (
            <div key={t.id} className="cc-mixer-strip">
              {/* Track Name */}
              <div className="cc-mixer-strip__name" title={t.name}>{t.name}</div>

              {/* Pan Slider */}
              <div className="cc-mixer-strip__pan">
                <span>PAN {panLabel}</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={t.pan ?? 0}
                  onChange={(e) => handleTrackPan(t.id, parseFloat(e.target.value))}
                  className="cc-mixer-strip__pan-slider"
                  title="Track pan"
                />
              </div>

              {/* Fader & Meters */}
              <div className="cc-mixer-strip__fader-area">
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.02}
                  value={t.volume}
                  onChange={(e) => handleTrackVolume(t.id, parseFloat(e.target.value))}
                  className="cc-mixer-strip__fader-input"
                  title="Track volume fader"
                />
                
                <div className="cc-mixer-strip__meters">
                  <div className="cc-mixer-strip__meter-bar">
                    <div 
                      className="cc-mixer-strip__meter-fill" 
                      style={{ height: `${lVal * 100}%` }}
                    />
                  </div>
                  <div className="cc-mixer-strip__meter-bar">
                    <div 
                      className="cc-mixer-strip__meter-fill" 
                      style={{ height: `${rVal * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tonal dB */}
              <div className="cc-mixer-strip__db">{dbLabel(t.volume)} dB</div>

              {/* Mute / Solo buttons */}
              <div className="cc-mixer-strip__toggles">
                <button
                  className={`cc-pill ${t.muted ? 'is-on cc-pill--danger' : ''}`}
                  onClick={() => dispatch({ type: 'track/update', id: t.id, patch: { muted: !t.muted } })}
                  style={{ padding: '2px 4px', fontSize: '9px' }}
                  title="Mute"
                >
                  M
                </button>
                <button
                  className={`cc-pill ${t.solo ? 'is-on cc-pill--accent' : ''}`}
                  onClick={() => dispatch({ type: 'track/update', id: t.id, patch: { solo: !t.solo } })}
                  style={{ padding: '2px 4px', fontSize: '9px' }}
                  title="Solo"
                >
                  S
                </button>
              </div>
            </div>
          );
        })}

        {/* Master Bus Strip */}
        <div className="cc-mixer-strip cc-mixer-strip--master">
          <div className="cc-mixer-strip__name" style={{ color: '#fb7185' }}>MASTER BUS</div>

          <div className="cc-mixer-strip__pan">
            <span style={{ color: '#f43f5e' }}>STEREO</span>
            <div style={{ height: '3px', background: '#f43f5e', width: '80%', borderRadius: '2px' }} />
          </div>

          <div className="cc-mixer-strip__fader-area">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.02}
              value={state.master.volume}
              onChange={(e) => handleMasterVolume(parseFloat(e.target.value))}
              className="cc-mixer-strip__fader-input"
              title="Master volume fader"
            />
            
            <div className="cc-mixer-strip__meters" style={{ width: '18px' }}>
              <div className="cc-mixer-strip__meter-bar">
                <div 
                  className="cc-mixer-strip__meter-fill" 
                  style={{ height: `${(levels.master?.l ?? 0) * 100}%` }}
                />
              </div>
              <div className="cc-mixer-strip__meter-bar">
                <div 
                  className="cc-mixer-strip__meter-fill" 
                  style={{ height: `${(levels.master?.r ?? 0) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="cc-mixer-strip__db" style={{ color: '#f43f5e' }}>
            {dbLabel(state.master.volume)} dB
          </div>

          <div className="cc-mixer-strip__toggles">
            <button
              className={`cc-pill ${state.master.volume === 0 ? 'is-on' : ''}`}
              onClick={() => handleMasterVolume(state.master.volume === 0 ? 0.8 : 0)}
              style={{ padding: '2px 6px', fontSize: '9px' }}
              title="Mute Master"
            >
              MUTE
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
