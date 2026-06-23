import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { EditorProvider } from './state/EditorContext.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </React.StrictMode>
);
