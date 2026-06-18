import React, { useState, useContext, useRef, useEffect } from 'react';
import { EditorContext } from '../context/EditorContext';

export default function Header({ onOpenExport, onOpenHelp }) {
  const { 
    undo, redo, undoStack, redoStack, 
    clips, setClips, tracks, setTracks, setSelectedClipId, setSelectedTrackId, setPlayhead,
    transitionsPanelOpen, setTransitionsPanelOpen
  } = useContext(EditorContext);
  
  const [activeMenu, setActiveMenu] = useState(null);
  const headerRef = useRef(null);

  const toggleMenu = (menu) => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewProject = () => {
    if (window.confirm("Are you sure you want to create a new project? All current timeline edits will be lost.")) {
      setClips([]);
      setSelectedClipId(null);
      setSelectedTrackId(null);
      setPlayhead(0);
      setActiveMenu(null);
    }
  };

  const handleSave = () => {
    const projectData = {
      version: "0.1",
      timeline: {
        tracks,
        clips
      }
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project.vxp';
    link.click();
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const handleImportProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.timeline && data.timeline.clips) {
          setClips(data.timeline.clips);
          if (data.timeline.tracks) setTracks(data.timeline.tracks);
          alert("Project imported successfully!");
        } else {
          alert("Invalid project file structure.");
        }
      } catch (err) {
        alert("Failed to parse project file: " + err.message);
      }
    };
    reader.readAsText(file);
    setActiveMenu(null);
  };

  return (
    <header className="header-bar glass-panel" ref={headerRef}>
      <div className="logo-section">
        <h1>CINECUT PRO</h1>
        <span className="logo-tag">nle</span>
      </div>

      <nav className="menu-items">
        {/* File Menu */}
        <div className="menu-item">
          <button 
            className={`menu-button ${activeMenu === 'file' ? 'active' : ''}`}
            onClick={() => toggleMenu('file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={handleNewProject}>
                New Project
                <span className="dropdown-shortcut">Ctrl+N</span>
              </button>
              <button className="dropdown-item" onClick={handleSave}>
                Save Project (.vxp)
                <span className="dropdown-shortcut">Ctrl+S</span>
              </button>
              <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                Import Project (.vxp)
                <input 
                  type="file" 
                  accept=".vxp" 
                  onChange={handleImportProject} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="menu-item">
          <button 
            className={`menu-button ${activeMenu === 'edit' ? 'active' : ''}`}
            onClick={() => toggleMenu('edit')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="dropdown-menu">
              <button 
                className="dropdown-item" 
                onClick={() => { undo(); setActiveMenu(null); }}
                disabled={undoStack.length === 0}
                style={{ opacity: undoStack.length === 0 ? 0.5 : 1 }}
              >
                Undo
                <span className="dropdown-shortcut">Ctrl+Z</span>
              </button>
              <button 
                className="dropdown-item" 
                onClick={() => { redo(); setActiveMenu(null); }}
                disabled={redoStack.length === 0}
                style={{ opacity: redoStack.length === 0 ? 0.5 : 1 }}
              >
                Redo
                <span className="dropdown-shortcut">Ctrl+Y</span>
              </button>
            </div>
          )}
        </div>

        {/* Transitions Menu Toggle */}
        <div className="menu-item">
          <button 
            className={`menu-button ${transitionsPanelOpen ? 'active' : ''}`}
            onClick={() => { setTransitionsPanelOpen(!transitionsPanelOpen); setActiveMenu(null); }}
          >
            Transitions
          </button>
        </div>

        {/* Export Menu */}
        <div className="menu-item">
          <button 
            className="menu-button"
            onClick={() => { onOpenExport(); setActiveMenu(null); }}
          >
            Export
          </button>
        </div>

        {/* Help Menu */}
        <div className="menu-item">
          <button 
            className="menu-button"
            onClick={() => { onOpenHelp(); setActiveMenu(null); }}
          >
            Help
          </button>
        </div>
      </nav>

      <div className="header-controls">
        <button className="btn btn-primary" onClick={onOpenExport}>
          Export Render
        </button>
      </div>
    </header>
  );
}
