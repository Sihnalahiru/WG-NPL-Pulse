import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[WG Pulse PWA] Service worker registration skipped:', error);
      },
    });
  } catch {
    // Ignore in restricted iframe origins
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
  componentStack: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
      componentStack: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || '',
    };
  }

  componentDidCatch(_error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info?.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '760px', margin: '30px auto' }}>
          <h1 style={{ color: '#dc2626', marginBottom: '8px' }}>WG Pulse could not load</h1>
          <p style={{ color: '#475569' }}>
            The app encountered a problem while starting. Reload the page first. Your saved data has not been deleted.
          </p>
          <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '13px', color: '#991b1b', fontWeight: 'bold' }}>
            {this.state.errorMessage}
          </pre>
          {this.state.componentStack && (
            <pre style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '12px', color: '#92400e', marginTop: '12px', maxHeight: '240px', overflow: 'auto' }}>
              Component Tree:{this.state.componentStack}
            </pre>
          )}
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#475569', marginTop: '12px', maxHeight: '240px', overflow: 'auto' }}>
            {this.state.errorStack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload App (keep saved data)
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function AppRoot() {
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.dataset.appReady = 'true';
  }, []);

  return <App />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('WG Pulse startup failed: the #root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <AppRoot />
    </RootErrorBoundary>
  </StrictMode>,
);
