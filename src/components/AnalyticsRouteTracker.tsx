import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isElectronApp } from '../lib/platform'
import { trackPageView } from '../lib/analytics'

/** 웹만 — 라우트 변경 시 page_view */
export function AnalyticsRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    if (isElectronApp()) return
    trackPageView(location.pathname)
  }, [location.pathname])

  return null
}
