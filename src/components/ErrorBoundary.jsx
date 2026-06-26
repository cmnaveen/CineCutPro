import React from 'react';

/**
 * App-level error boundary.
 *
 * Without this, any uncaught render error unmounts the whole React tree and
 * leaves a blank page (the exact failure mode of past bugs). Here we catch it,
 * show a recoverable panel, and offer "Try again" (re-render with current state)
 * or "Reload".
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CineCutPro render error:', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stack = String(error.stack || '').split('\n').slice(0, 6).join('\n');
    return (
      <div className="cc-errboundary" role="alert">
        <div className="cc-errboundary__card">
          <div className="cc-errboundary__badge">!</div>
          <h1>Something broke.</h1>
          <p className="cc-errboundary__msg">{String(error.message || error)}</p>
          {stack && <pre className="cc-errboundary__stack">{stack}</pre>}
          <div className="cc-errboundary__actions">
            <button className="cc-btn cc-btn--primary" onClick={this.reset}>Try again</button>
            <button className="cc-btn cc-btn--ghost" onClick={() => window.location.reload()}>Reload</button>
          </div>
          <p className="cc-errboundary__hint">Your work is autosaved — a reload restores the last session.</p>
        </div>
      </div>
    );
  }
}
