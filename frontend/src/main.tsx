import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPrefs } from './design-system'

// Restore the saved theme and text size before the first paint.
initPrefs()

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
      <App />
    )}
  </StrictMode>,
)
