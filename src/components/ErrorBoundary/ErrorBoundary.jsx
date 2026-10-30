import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Machii Storefront Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0A0A0C',
          color: '#F8FAFC',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '2rem',
            backdropFilter: 'blur(20px)',
          }}>
            <h1 style={{ color: '#EF4444', fontSize: '1.4rem', marginBottom: '0.8rem' }}>
              ⚠️ Interface Rendering Notice
            </h1>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            {this.state.error?.stack && (
              <pre style={{
                textAlign: 'left',
                background: '#040508',
                color: '#38BDF8',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                overflowX: 'auto',
                maxHeight: '180px',
              }}>
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => {
                window.location.reload();
              }}
              style={{
                marginTop: '1.4rem',
                padding: '0.65rem 1.6rem',
                backgroundColor: '#38BDF8',
                color: '#0A0A0C',
                border: 'none',
                borderRadius: '999px',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Reload Storefront
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

