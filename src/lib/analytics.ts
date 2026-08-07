/**
 * 웹 전용 익명 사용 로그.
 * - Electron 앱에서는 no-op (다운로드 수는 GitHub Releases로 확인)
 * - 일정/할일/공유 본문은 절대 전송하지 않음
 * - VITE_ANALYTICS_URL 이 있을 때만 네트워크 전송
 */

const CONSENT_KEY = 'pintime:analyticsConsent'
const ANON_KEY = 'pintime:analyticsAnonId'
const DEBUG_KEY = 'pintime:analyticsDebug'
const DEBUG_MAX = 40

export type AnalyticsProps = Record<string, string | number | boolean | undefined>

function isBrowserWeb() {
  if (typeof window === 'undefined') return false
  // Electron preload 가 있으면 앱 → 웹 로깅 안 함
  return !window.pintimeDesktop?.isElectron
}

export function loadAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function saveAnalyticsConsent(on: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return 'anon_ephemeral'
  }
}

function analyticsEndpoint(): string | null {
  const url = import.meta.env.VITE_ANALYTICS_URL
  if (typeof url === 'string' && url.trim()) return url.trim()
  return null
}

function pushDebug(entry: unknown) {
  try {
    const raw = localStorage.getItem(DEBUG_KEY)
    const list: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : []
    list.unshift(entry)
    localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(0, DEBUG_MAX)))
  } catch {
    /* ignore */
  }
}

export function loadAnalyticsDebug(): Array<{
  t: number
  name: string
  props?: AnalyticsProps
}> {
  try {
    const raw = localStorage.getItem(DEBUG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Array<{ t: number; name: string; props?: AnalyticsProps }>
  } catch {
    return []
  }
}

export function clearAnalyticsDebug() {
  try {
    localStorage.removeItem(DEBUG_KEY)
  } catch {
    /* ignore */
  }
}

/** 익명 이벤트. 동의 OFF / Electron / 웹 아니면 무시 */
export function track(name: string, props?: AnalyticsProps) {
  if (!isBrowserWeb()) return
  if (!loadAnalyticsConsent()) return

  const payload = {
    name,
    props: props ?? {},
    anonId: getAnonId(),
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    ts: Date.now(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : '',
    app: 'pintime-web',
    v: '0.1.0',
  }

  pushDebug({ t: payload.ts, name, props })

  const endpoint = analyticsEndpoint()
  if (!endpoint) return

  const body = JSON.stringify(payload)
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      if (ok) return
    }
  } catch {
    /* fall through */
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    mode: 'cors',
  }).catch(() => undefined)
}

export function trackPageView(path: string) {
  track('page_view', { path })
}
