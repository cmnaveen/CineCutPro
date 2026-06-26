import { useEffect, useRef } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';

/**
 * Right-click context menu for clip blocks.
 *
 * Positions itself at the cursor; clamps to viewport so it doesn't clip on a
 * side. A document-level click handler closes it.
 */
export function ContextMenu() {
  const { state, dispatch } = useEditor();
  const menu = state.ui.contextMenu;
  const ref = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => dispatch({ type: 'ui/closeContextMenu' });
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) close();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [menu, dispatch]);

  if (!menu) return null;
  const clip = state.clips.find((c) => c.id === menu.clipId);
  if (!clip) return null;

  const close = () => dispatch({ type: 'ui/closeContextMenu' });
  const run = (fn) => () => { fn(); close(); };

  const handleDetectScenes = async (targetClip) => {
    const media = state.media.find((m) => m.id === targetClip.mediaId);
    if (!media) {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Media source not found for clip' });
      return;
    }
    const video = document.createElement('video');
    video.src = media.src;
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      try {
        dispatch({ type: 'toast/push', kind: 'info', message: 'Analyzing scenes in background...' });
        const { detectScenes } = await import('../engine/sceneDetector.js');
        const cuts = await detectScenes(video, {
          startTime: targetClip.srcIn ?? 0,
          endTime: targetClip.srcOut ?? video.duration ?? 60,
          sensitivity: 0.5
        });

        if (!cuts || !cuts.length) {
          dispatch({ type: 'toast/push', kind: 'info', message: 'No scene cuts detected.' });
          return;
        }

        const speed = targetClip.speed ?? 1;
        const timelineCutTimes = cuts.map(c => targetClip.start + (c.time - targetClip.srcIn) / speed);

        dispatch({
          type: 'clip/multiBlade',
          clipId: targetClip.id,
          times: timelineCutTimes
        });

        dispatch({
          type: 'toast/push',
          kind: 'success',
          message: `Scene detection complete! Split clip into ${cuts.length + 1} parts.`
        });
      } catch (err) {
        console.error(err);
        dispatch({ type: 'toast/push', kind: 'error', message: 'Scene detection failed: ' + err.message });
      } finally {
        video.remove();
      }
    };

    video.onerror = () => {
      dispatch({ type: 'toast/push', kind: 'error', message: 'Failed to load video source.' });
      video.remove();
    };
  };

  // Clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(menu.x, vw - 230);
  const top = Math.min(menu.y, vh - 350);

  return (
    <div ref={ref} className="cc-ctxmenu" style={{ left, top }} role="menu">
      <div className="cc-ctxmenu__title">
        {clip.kind === 'title' ? clip.title?.text : (state.media.find((m) => m.id === clip.mediaId)?.name ?? clip.kind)}
      </div>
      <button onClick={run(() => dispatch({ type: 'clip/blade', t: state.playhead, ids: [clip.id] }))}>
        <Icon.Blade size={13} /> Blade at playhead <kbd>B</kbd>
      </button>
      {clip.kind === 'video' && (
        <button onClick={run(() => handleDetectScenes(clip))}>
          🎬 Split at Scene Changes
        </button>
      )}
      <button onClick={run(() => dispatch({ type: 'clip/duplicate', ids: [clip.id] }))}>
        <Icon.Plus size={13} /> Duplicate <kbd>⌘D</kbd>
      </button>
      <button onClick={run(() => dispatch({ type: 'ui/openTrimEditor', id: clip.id }))}>
        ⇆ Open A/B trim
      </button>
      <div className="cc-ctxmenu__sep" />
      <button onClick={run(() => dispatch({ type: 'clip/updateTransform', id: clip.id, patch: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } }))}>
        ↺ Reset transform
      </button>
      <button onClick={run(() => dispatch({ type: 'clip/clearKeyframes', id: clip.id }))}>
        ⌫ Clear keyframes
      </button>
      <button onClick={run(() => dispatch({ type: 'transition/clear', clipId: clip.id, side: 'in' }))}>
        ⏪ Remove in-transition
      </button>
      <button onClick={run(() => dispatch({ type: 'transition/clear', clipId: clip.id, side: 'out' }))}>
        ⏩ Remove out-transition
      </button>
      <div className="cc-ctxmenu__sep" />
      <button
        className="cc-ctxmenu__danger"
        onClick={run(() => dispatch({ type: 'clip/delete', ids: [clip.id] }))}
      >
        <Icon.Trash size={13} /> Delete <kbd>Del</kbd>
      </button>
      <button
        className="cc-ctxmenu__danger"
        onClick={run(() => dispatch({ type: 'clip/delete', ids: [clip.id], ripple: true }))}
      >
        <Icon.Trash size={13} /> Ripple delete <kbd>⇧Del</kbd>
      </button>
    </div>
  );
}
