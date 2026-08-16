import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Last-resort net: catches anything that slips past component-level
// try/catch and the React error boundary (e.g. a rejected promise nobody
// awaited). This only logs — it's a diagnostic backstop, not a replacement
// for the specific handling already in place around grammar loading, token
// inspection, and VSIX export.
window.addEventListener('error', (e) => {
  console.error('Unhandled error:', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
