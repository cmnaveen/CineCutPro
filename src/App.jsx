import React from 'react';
import { useEditor } from './state/EditorContext.jsx';
import { Header } from './components/Header.jsx';
import { MediaLibrary } from './components/MediaLibrary.jsx';
import { SourceMonitor } from './components/SourceMonitor.jsx';
import { ProgramMonitor } from './components/ProgramMonitor.jsx';
import { Inspector } from './components/Inspector.jsx';
import { Timeline } from './components/Timeline.jsx';
import { TrimEditor } from './components/TrimEditor.jsx';
import { AnalyzerSlideout } from './components/AnalyzerSlideout.jsx';
import { ExportDialog } from './components/ExportDialog.jsx';
import { ShortcutsModal } from './components/ShortcutsModal.jsx';
import { TransitionsRail } from './components/TransitionsRail.jsx';
import { Toasts } from './components/Toast.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { ContextMenu } from './components/ContextMenu.jsx';
import { WelcomeModal } from './components/WelcomeModal.jsx';
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

export default function App() {
  useKeyboard();
  const { state } = useEditor();
  const single = state.ui.monitorMode === 'single';

  return (
    <div className="cc-app">
      <Header />
      <main className="cc-workspace">
        <MediaLibrary />
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
      <TrimEditor />
      <ShortcutsModal />
      <ExportDialog />
      <WelcomeModal />
      <ContextMenu />
      <Toasts />

      <div className="cc-grain" aria-hidden />
    </div>
  );
}
