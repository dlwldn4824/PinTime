import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { startDateIconUpdates } from './lib/dateIcon'
import { clearAllPinTimeData } from './lib/storage'
import {
  isDesktopPinMode,
  isElectronApp,
  stripDesktopPinQueryIfBrowser,
} from './lib/platform'

// http://localhost:5173/?reset=1 → 로컬 테스트 저장 초기화
if (typeof window !== 'undefined') {
  stripDesktopPinQueryIfBrowser()
  const params = new URLSearchParams(window.location.search)
  if (params.get('reset') === '1') {
    const removed = clearAllPinTimeData()
    params.delete('reset')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
    console.info('[PinTime] local data cleared', removed)
  }
  startDateIconUpdates()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (!(isDesktopPinMode() && isElectronApp())) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    })
  }
}
