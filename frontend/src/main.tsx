import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Purge any Supabase session that was previously stored in localStorage.
// We now use sessionStorage (see supabase.ts), so old localStorage entries
// would cause users to be auto-logged in as whoever last used the browser.
const SUPABASE_STORAGE_KEY = `sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`;
try {
  if (localStorage.getItem(SUPABASE_STORAGE_KEY)) {
    localStorage.removeItem(SUPABASE_STORAGE_KEY);
  }
  // Also clear legacy keys the app stored directly
  localStorage.removeItem('token');
  localStorage.removeItem('user');
} catch {
  // localStorage may be blocked in some browsers — safe to ignore
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
