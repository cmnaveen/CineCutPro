import React, { useState } from 'react';
import { EditorProvider } from './context/EditorContext';
import Header from './components/Header';
import MediaBrowser from './components/MediaBrowser';
import PreviewPanel from './components/PreviewPanel';
import InspectorPanel from './components/InspectorPanel';
import TimelinePanel from './components/TimelinePanel';
import ExportDialog from './components/ExportDialog';

function App() {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <EditorProvider>
      <div className="app-container">
        {/* Top Header menu */}
        <Header 
          onOpenExport={() => setIsExportOpen(true)} 
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {/* Central Workspace Layout */}
        <div className="workspace-layout">
          {/* Left panel: Library assets */}
          <MediaBrowser />

          {/* Center panel: Canvas Viewport player */}
          <PreviewPanel />

          {/* Right panel: Sliders & Effects stack */}
          <InspectorPanel />
        </div>

        {/* Bottom panel: Tracks timeline ruler */}
        <TimelinePanel />

        {/* Export settings dialog */}
        <ExportDialog 
          isOpen={isExportOpen} 
          onClose={() => setIsExportOpen(false)} 
        />

        {/* Help Keyboard Shortcuts Modal */}
        {isHelpOpen && (
          <div className="modal-overlay" onClick={() => setIsHelpOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
              <div className="modal-header">
                <h2>Keyboard Shortcuts Guide</h2>
                <button className="btn-icon" onClick={() => setIsHelpOpen(false)}>✖</button>
              </div>
              <div className="modal-body" style={{ gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  <strong>Space</strong> <span>Play / Pause</span>
                  <strong>J / K / L</strong> <span>Reverse / Pause / Fast Forward playback</span>
                  <strong>← / →</strong> <span>Step 1 frame (Shift: 10 frames)</span>
                  <strong>Home / End</strong> <span>Jump to timeline start / end</span>
                  <strong>[ / ]</strong> <span>Mark Source In / Out points</span>
                  <strong>F9 / F10</strong> <span>Insert Edit / Overwrite Edit</span>
                  <strong>I / O</strong> <span>Mark loop region start / end</span>
                  <strong>Del / Backspace</strong><span>Delete selected clip</span>
                  <strong>Ctrl+Z / Y</strong> <span>Undo / Redo (50 levels)</span>
                  <strong>Ctrl+D</strong> <span>Duplicate active clip</span>
                  <strong>V / B / T</strong> <span>Select (V) / Blade (B) / Smart Trim (T)</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  💡 <strong>DaVinci Resolve Editing Tips:</strong>
                  <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                    <li>Double-click assets in the Media Browser to load them in the **Source Monitor** (Dual View).</li>
                    <li>Mark In/Out bounds on the source, then press **F9** (Insert) or **F10** (Overwrite) to load onto the active track.</li>
                    <li>In **Smart Trim Mode (T)**, click-and-drag different zones of a clip: left/right edges for **Ripple Trim** / **Roll Edit**, center area for **Slip** / **Slide**.</li>
                    <li>Create and place a **⚡ Adjustment Clip** to apply filters (Color Grade, Blur) to all video tracks underneath.</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => setIsHelpOpen(false)}>Got it</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorProvider>
  );
}

export default App;
