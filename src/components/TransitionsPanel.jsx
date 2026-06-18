import React, { useContext, useState } from 'react';
import { EditorContext } from '../context/EditorContext';

const TRANSITION_CATEGORIES = [
  {
    name: 'Dissolves',
    icon: '🌅',
    items: [
      { type: 'crossDissolve', name: 'Cross Dissolve', icon: '◐', desc: 'Smooth alpha blend between clips' },
      { type: 'dipToBlack', name: 'Dip to Black', icon: '◼', desc: 'Fade through black' },
      { type: 'dipToWhite', name: 'Dip to White', icon: '◻', desc: 'Fade through white' },
      { type: 'additiveDissove', name: 'Additive Dissolve', icon: '✦', desc: 'Bright additive blend' },
    ]
  },
  {
    name: 'Wipes',
    icon: '➡',
    items: [
      { type: 'wipeLeft', name: 'Wipe Left', icon: '◀', desc: 'Reveal from left to right' },
      { type: 'wipeRight', name: 'Wipe Right', icon: '▶', desc: 'Reveal from right to left' },
      { type: 'wipeUp', name: 'Wipe Up', icon: '▲', desc: 'Reveal from bottom to top' },
      { type: 'wipeDown', name: 'Wipe Down', icon: '▼', desc: 'Reveal from top to bottom' },
      { type: 'clockWipe', name: 'Clock Wipe', icon: '⏱', desc: 'Radial clock sweep' },
    ]
  },
  {
    name: 'Motion',
    icon: '🎬',
    items: [
      { type: 'pushLeft', name: 'Push Left', icon: '⟵', desc: 'Push incoming clip from right' },
      { type: 'pushRight', name: 'Push Right', icon: '⟶', desc: 'Push incoming clip from left' },
      { type: 'slideIn', name: 'Slide In', icon: '↗', desc: 'Slide new clip over old' },
      { type: 'zoomIn', name: 'Zoom', icon: '🔎', desc: 'Zoom transition between clips' },
    ]
  }
];

export default function TransitionsPanel() {
  const {
    transitionsPanelOpen, setTransitionsPanelOpen,
    clips, selectedClipId,
    addTransition
  } = useContext(EditorContext);

  const [activeCategory, setActiveCategory] = useState(0);
  const [draggedTransition, setDraggedTransition] = useState(null);

  if (!transitionsPanelOpen) return null;

  const handleApplyTransition = (transType) => {
    // Find the selected clip and its succeeding clip to create the transition
    const selectedClip = clips.find(c => c.id === selectedClipId);
    if (!selectedClip) return;

    const succeeding = clips.find(c =>
      c.trackId === selectedClip.trackId &&
      Math.abs(c.timelinePos - (selectedClip.timelinePos + selectedClip.duration)) < 0.2
    );

    if (succeeding) {
      addTransition(selectedClip.id, succeeding.id, transType, 1.0);
    }
  };

  const handleDragStart = (e, transType) => {
    setDraggedTransition(transType);
    e.dataTransfer.setData('transition-type', transType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const category = TRANSITION_CATEGORIES[activeCategory];

  return (
    <div className="transitions-panel">
      <div className="transitions-panel-header">
        <h3>Transitions & Effects</h3>
        <button className="transitions-panel-close" onClick={() => setTransitionsPanelOpen(false)}>✕</button>
      </div>

      {/* Category tabs */}
      <div className="transitions-categories">
        {TRANSITION_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            className={`transition-category-tab ${idx === activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(idx)}
          >
            <span className="tab-icon">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Transition cards */}
      <div className="transitions-grid">
        {category.items.map(item => (
          <div
            key={item.type}
            className="transition-card"
            draggable
            onDragStart={(e) => handleDragStart(e, item.type)}
            onClick={() => handleApplyTransition(item.type)}
            title={item.desc}
          >
            <div className="transition-card-preview">
              <span className="transition-card-icon">{item.icon}</span>
            </div>
            <div className="transition-card-name">{item.name}</div>
          </div>
        ))}
      </div>

      <div className="transitions-help">
        <p>Click to apply to selected edit point, or drag onto timeline.</p>
      </div>
    </div>
  );
}
