import React from 'react';

/**
 * Animated empty-state shown over the Program monitor when no clips exist.
 * Pure CSS; no canvas involvement so it doesn't fight the renderer.
 */
export function EmptyHero({ visible }) {
  if (!visible) return null;
  return (
    <div className="cc-empty-hero">
      <div className="cc-empty-hero__orb">
        <span className="cc-empty-hero__ring cc-empty-hero__ring--1" />
        <span className="cc-empty-hero__ring cc-empty-hero__ring--2" />
        <span className="cc-empty-hero__ring cc-empty-hero__ring--3" />
        <span className="cc-empty-hero__core" />
      </div>
      <div className="cc-empty-hero__copy">
        <h2>Ready when you are.</h2>
        <p>Drop media into the library on the left, or press <kbd>Ctrl</kbd>+<kbd>O</kbd> to open a project.</p>
      </div>
      <div className="cc-empty-hero__hints">
        <span><kbd>Space</kbd> play</span>
        <span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> transport</span>
        <span><kbd>B</kbd> blade</span>
        <span><kbd>?</kbd> shortcuts</span>
      </div>
    </div>
  );
}
