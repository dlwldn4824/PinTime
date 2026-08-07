export type CalendarWidgetView = 'week' | 'month'

export type PinTimeDesktopApi = {
  isElectron: true
  getPlatform: () => Promise<{
    isElectron: boolean
    platform: string
    desktopPinOpen: boolean
  }>
  openDesktopPin: () => Promise<boolean>
  closeDesktopPin: () => Promise<boolean>
  toggleDesktopPin: () => Promise<boolean>
  isDesktopPinOpen: () => Promise<boolean>
  setDesktopPinView: (view: CalendarWidgetView) => Promise<boolean>
  onDesktopPinChanged: (cb: (open: boolean) => void) => () => void
  onDesktopPinView: (cb: (view: CalendarWidgetView) => void) => () => void
}

declare global {
  interface Window {
    pintimeDesktop?: PinTimeDesktopApi
  }
}

const WIDGET_VIEW_KEY = 'pintime:widgetView'
const WIDGET_ENABLED_KEY = 'pintime:widgetEnabled'

export function isElectronApp() {
  return typeof window !== 'undefined' && !!window.pintimeDesktop?.isElectron
}

export function getDesktopApi(): PinTimeDesktopApi | null {
  return window.pintimeDesktop ?? null
}

export function isDesktopPinMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mode') === 'desktop-pin'
}

export function loadWidgetView(): CalendarWidgetView {
  try {
    const raw = localStorage.getItem(WIDGET_VIEW_KEY)
    if (raw === 'week' || raw === 'month') return raw
  } catch {
    /* ignore */
  }
  return 'month'
}

export function saveWidgetView(view: CalendarWidgetView) {
  try {
    localStorage.setItem(WIDGET_VIEW_KEY, view)
  } catch {
    /* ignore */
  }
}

export function loadWidgetEnabled(): boolean {
  try {
    return localStorage.getItem(WIDGET_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveWidgetEnabled(enabled: boolean) {
  try {
    localStorage.setItem(WIDGET_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** PWA / 홈 화면 설치 가능 여부 */
export function canInstallPwa() {
  return typeof window !== 'undefined' && 'BeforeInstallPromptEvent' in window
}
