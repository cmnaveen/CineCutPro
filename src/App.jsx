import { useEffect } from 'react';
import { useEditor } from './state/EditorContext.jsx';
import { Header } from './components/Header.jsx';
import { LeftControlPanel } from './components/LeftControlPanel.jsx';
import { SourceMonitor } from './components/SourceMonitor.jsx';
import { ProgramMonitor } from './components/ProgramMonitor.jsx';
import { Inspector } from './components/Inspector.jsx';
import { Timeline } from './components/Timeline.jsx';
import { TrimEditor } from './components/TrimEditor.jsx';
import { AnalyzerSlideout } from './components/AnalyzerSlideout.jsx';
import { TimelineMarkers } from './components/TimelineMarkers.jsx';
import { ExportDialog } from './components/ExportDialog.jsx';
import { ShortcutsModal } from './components/ShortcutsModal.jsx';
import { TransitionsRail } from './components/TransitionsRail.jsx';
import { Toasts } from './components/Toast.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { ContextMenu } from './components/ContextMenu.jsx';
import { WelcomeModal } from './components/WelcomeModal.jsx';
import { ProjectSettings } from './components/ProjectSettings.jsx';
import { ColorGrading } from './components/ColorGrading.jsx';
import { AudioMixer } from './components/AudioMixer.jsx';
import { MulticamViewer } from './components/MulticamViewer.jsx';
import { useKeyboard } from './hooks/useKeyboard.js';
import './styles/app.css';
import './styles/header.css';
import './styles/media-library.css';
import './styles/monitors.css';
import './styles/inspector.css';
import './styles/timeline.css';
import './styles/modals.css';
import './styles/premium.css';
import './styles/animations.css';
import './styles/pro.css';
import './styles/left-panel.css';
import './styles/color-grading.css';
import './styles/audio-mixer.css';
import './styles/multicam-viewer.css';

export default function App() {
  useKeyboard();
  const { state, dispatch } = useEditor();
  const single = state.ui.monitorMode === 'single';

  // Automatically load default media files on startup if none exist
  useEffect(() => {
    if (state.media.length > 0) return;

    const filesToLoad = [
      { name: 'Svadotsava_Podi.mp4', url: '/Svadotsava_Podi.mp4', size: 9454796 },
      { name: 'Svadotsava_Mindful_Dining.mp4', url: '/Svadotsava_Mindful_Dining.mp4', size: 2000000 }
    ];

    filesToLoad.forEach(({ name, url, size }) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.onloadedmetadata = () => {
        const duration = v.duration || 10;
        const naturalWidth = v.videoWidth || 1920;
        const naturalHeight = v.videoHeight || 1080;
        
        v.currentTime = Math.min(0.5, duration * 0.1);
        v.onseeked = () => {
          let thumb = null;
          try {
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = Math.round(160 * (naturalHeight / naturalWidth || 0.5625));
            const ctx = c.getContext('2d');
            ctx.drawImage(v, 0, 0, c.width, c.height);
            thumb = c.toDataURL('image/jpeg', 0.6);
          } catch (_) {}

          dispatch({
            type: 'media/add',
            items: [{
              name,
              kind: 'video',
              src: url,
              duration,
              thumb,
              meta: {
                size,
                type: 'video/mp4',
                naturalWidth,
                naturalHeight
              }
            }]
          });
        };
      };
    });
  }, [state.media.length, dispatch]);

  // Auto-insert Svadotsava_Podi.mp4 onto the timeline when loaded
  useEffect(() => {
    const targetMedia = state.media.find(m => m.name === 'Svadotsava_Podi.mp4');
    if (targetMedia && state.clips.length === 0) {
      dispatch({
        type: 'clip/insertFromMedia',
        mediaId: targetMedia.id,
        trackId: 'trk_4', // Video 1 — Primary
        start: 0,
        srcIn: 0,
        srcOut: targetMedia.duration
      });
      dispatch({
        type: 'toast/push',
        kind: 'success',
        message: 'Successfully loaded Svadotsava_Podi.mp4 onto timeline!',
        ttl: 4000
      });
    }
  }, [state.media, state.clips.length, dispatch]);

  return (
    <div className="cc-app">
      <Header />
      <main className="cc-workspace">
        {(state.ui.panelLayout ?? 'default') === 'default' && <LeftControlPanel />}
        {state.ui.panelLayout === 'color' && <ColorGrading />}
        {state.ui.panelLayout === 'audio' && <AudioMixer />}
        <section className={`cc-monitors ${single ? 'cc-monitors--single' : ''}`}>
          {!single && <SourceMonitor />}
          <ProgramMonitor />
        </section>
        <Inspector />
      </main>
      <Timeline />
      <StatusBar />

      <TransitionsRail />
      <AnalyzerSlideout />
      <TimelineMarkers />
      <TrimEditor />
      <ShortcutsModal />
      <ExportDialog />
      <WelcomeModal />
      <ProjectSettings />
      <MulticamViewer />
      <ContextMenu />
      <Toasts />

      <div className="cc-grain" aria-hidden />
    </div>
  );
}
