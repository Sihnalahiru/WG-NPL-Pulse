import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

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
    this.setState({
      componentStack: info?.componentStack || '',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '760px', margin: '30px auto' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>WG Pulse Runtime Error</h2>
          <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '13px', color: '#991b1b', fontWeight: 'bold' }}>
            {this.state.errorMessage}
          </pre>
          {this.state.componentStack && (
            <pre style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '12px', color: '#92400e', marginTop: '12px', maxHeight: '220px', overflow: 'auto' }}>
              Component Tree:{this.state.componentStack}
            </pre>
          )}
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#475569', marginTop: '12px', maxHeight: '180px', overflow: 'auto' }}>
            {this.state.errorStack}
          </pre>
          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: '16px', padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear LocalStorage &amp; Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
