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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '450px' }}>
              <div className="modal-header">
                <h2>Keyboard Shortcuts Guide</h2>
                <button className="btn-icon" onClick={() => setIsHelpOpen(false)}>✖</button>
              </div>
              <div className="modal-body" style={{ gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <strong>Space</strong> <span>Play / Pause</span>
                  <strong>← / →</strong> <span>Step 1 frame (Shift: 10 frames)</span>
                  <strong>Home / End</strong> <span>Jump to timeline start / end</span>
                  <strong>I / O</strong> <span>Mark loop region start / end</span>
                  <strong>Del / Backspace</strong><span>Delete selected clip</span>
                  <strong>Ctrl+Z / Y</strong> <span>Undo / Redo (50 levels)</span>
                  <strong>Ctrl+D</strong> <span>Duplicate active clip</span>
                  <strong>V / B</strong> <span>Select Tool (V) / Blade Tool (B)</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  💡 <strong>Timeline Editing Tips:</strong>
                  <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                    <li>Drag assets from the Media Browser onto the Video/Audio tracks to place clips.</li>
                    <li>Click on clips to highlight. Drag center to slide, or drag left/right edges to trim.</li>
                    <li>Toggle the 🧲 snap tool to align clips directly with boundaries.</li>
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
