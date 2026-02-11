import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Error Boundary minimaliste pour le debug
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL UI CRASH:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#050505', color: '#ff003c', height: '100vh', padding: '20px', fontFamily: 'monospace' }}>
          <h1 style={{ borderBottom: '1px solid #333' }}>SYSTEM FAILURE // KERNEL PANIC</h1>
          <p>L'application a crashé. Voici l'erreur :</p>
          <pre style={{ color: 'white', marginTop: '20px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px', background: '#333', color: 'white', border: 'none' }}
          >
            FORCE RESTART
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // Pas de StrictMode ici, car il complique le debug des WebSockets
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)