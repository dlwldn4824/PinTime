import {
  msUntilNextSeoulMidnight,
  seoulDayOfMonth,
} from './seoulTime'
import { fitDayFontSize } from './dateIconLayout'

export { fitDayFontSize } from './dateIconLayout'

/** 핀과 동일한 밝은 파란색 (베이스 아이콘 샘플) */
export const DATE_ICON_PIN_BLUE = '#0086FF'

/** 수정하지 않는 원본 베이스 아이콘 */
export const DATE_ICON_BASE_URL = '/icon-base.png'

/** 1024×1024 기준 — 하단 흰색 달력 본문 영역 */
const BODY_RECT_1024 = {
  left: 250,
  top: 390,
  right: 774,
  bottom: 810,
} as const

export type DateIconRenderOptions = {
  /** 캔버스 한 변(px). favicon용 기본 128 */
  size?: number
  /** 기본: 핀 블루 */
  color?: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load icon base: ${src}`))
    img.src = src
  })
}

/**
 * 베이스 아이콘 위에 일(day) 숫자만 그려 Blob 반환.
 * 베이스 파일은 수정하지 않음.
 */
export async function renderDateIconBlob(
  day: number,
  opts?: DateIconRenderOptions,
): Promise<Blob> {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`day must be 1–31, got ${day}`)
  }

  const size = opts?.size ?? 128
  const color = opts?.color ?? DATE_ICON_PIN_BLUE
  const scale = size / 1024
  const left = BODY_RECT_1024.left * scale
  const top = BODY_RECT_1024.top * scale
  const right = BODY_RECT_1024.right * scale
  const bottom = BODY_RECT_1024.bottom * scale
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const maxW = (right - left) * 0.88
  const maxH = (bottom - top) * 0.72

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  const base = await loadImage(DATE_ICON_BASE_URL)
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(base, 0, 0, size, size)

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
  }

  const text = String(day)
  const fontFamily =
    '"Manrope", "Nunito", "Segoe UI", "Helvetica Neue", system-ui, sans-serif'

  const fontSize = fitDayFontSize(text, maxW, maxH, (fs, t) => {
    ctx.font = `700 ${fs}px ${fontFamily}`
    return ctx.measureText(t).width
  })

  ctx.font = `700 ${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 그림자·배지·원 없음
  ctx.fillText(text, cx, cy)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
  if (!blob) throw new Error('toBlob failed')
  return blob
}

let currentObjectUrl: string | null = null
let appliedDay: number | null = null
let midnightTimer: number | null = null
let started = false

const DATE_ICON_EVENT = 'pintime:date-icon'

function notifyDateIconListeners() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(DATE_ICON_EVENT, {
      detail: { url: currentObjectUrl, day: appliedDay },
    }),
  )
}

/** 현재 동적 로고 Blob URL (없으면 null → 베이스 정적 아이콘 사용) */
export function getDateIconUrl(): string | null {
  return currentObjectUrl
}

export function getDateIconDay(): number | null {
  return appliedDay
}

export function subscribeDateIcon(listener: () => void): () => void {
  const handler = () => listener()
  window.addEventListener(DATE_ICON_EVENT, handler)
  return () => window.removeEventListener(DATE_ICON_EVENT, handler)
}

function revokeCurrentUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

function setFaviconHref(href: string) {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]',
  )
  if (links.length === 0) {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    link.href = href
    link.dataset.pintimeDateIcon = '1'
    document.head.appendChild(link)
    return
  }
  for (const link of links) {
    link.type = 'image/png'
    link.href = href
    link.dataset.pintimeDateIcon = '1'
  }
}

async function applyDayIcon(day: number, force = false): Promise<void> {
  if (!force && appliedDay === day && currentObjectUrl) return
  try {
    const blob = await renderDateIconBlob(day)
    const url = URL.createObjectURL(blob)
    revokeCurrentUrl()
    currentObjectUrl = url
    setFaviconHref(url)
    appliedDay = day
    notifyDateIconListeners()
  } catch (err) {
    // 로딩 실패 시 정적 favicon 유지
    console.warn('[PinTime] date favicon skipped', err)
  }
}

function clearMidnightTimer() {
  if (midnightTimer !== null) {
    window.clearTimeout(midnightTimer)
    midnightTimer = null
  }
}

function scheduleMidnightRefresh() {
  clearMidnightTimer()
  const delay = msUntilNextSeoulMidnight() + 80
  midnightTimer = window.setTimeout(() => {
    midnightTimer = null
    void refreshDateIcon(true).then(() => {
      scheduleMidnightRefresh()
    })
  }, delay)
}

async function refreshDateIcon(force = false): Promise<void> {
  const day = seoulDayOfMonth()
  await applyDayIcon(day, force)
}

function onVisibilityOrFocus() {
  if (document.visibilityState === 'hidden') return
  void refreshDateIcon(false)
}

/**
 * 동적 favicon 시작.
 * - Seoul 일 기준 숫자
 * - 다음 자정에 한 번만 타이머
 * - visibilitychange / focus 시 재확인
 */
export function startDateIconUpdates(): () => void {
  if (typeof window === 'undefined' || started) {
    return () => undefined
  }
  started = true

  void refreshDateIcon(true).then(() => {
    scheduleMidnightRefresh()
  })

  document.addEventListener('visibilitychange', onVisibilityOrFocus)
  window.addEventListener('focus', onVisibilityOrFocus)

  return () => {
    started = false
    clearMidnightTimer()
    document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    window.removeEventListener('focus', onVisibilityOrFocus)
    revokeCurrentUrl()
    appliedDay = null
  }
}

/** 테스트·미리보기용: 특정 일로 아이콘 Blob URL 생성 (호출측에서 revoke) */
export async function createDateIconObjectUrl(
  day: number,
  opts?: DateIconRenderOptions,
): Promise<string> {
  const blob = await renderDateIconBlob(day, opts)
  return URL.createObjectURL(blob)
}
