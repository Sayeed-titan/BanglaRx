import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPrefs } from './design-system'
import { installAuthFetch } from './auth/session'
import { AuthGate } from './auth/AuthGate'

// Restore the saved theme and text size before the first paint.
initPrefs()
// Every call to the BanglaRx API carries the signed-in user's token
installAuthFetch()

// Installable app: the service worker keeps only the app's own files (never /api data). Off in development so edits show at once.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Open the app with ?ds to browse the design system. Loaded lazily so the product bundle is unchanged.
const DesignSystemPreview = lazy(() => import('./design-system/Preview'))
const showPreview = new URLSearchParams(window.location.search).has('ds')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showPreview ? (
      <Suspense fallback={null}>
        <DesignSystemPreview />
      </Suspense>
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </StrictMode>,
)
