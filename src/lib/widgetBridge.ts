/**
 * 휴대폰 홈 화면 위젯 브릿지 (다음 단계: Capacitor + 네이티브 위젯)
 *
 * - Android: App Widget + Glance / RemoteViews
 * - iOS: WidgetKit + App Group 공유 저장소
 *
 * 현재는 웹/Electron에서 고른 위젯 설정(주간·월간)을 localStorage에 두고,
 * 네이티브 레이어가 같은 키를 읽도록 맞춰 둔다.
 */
import {
  loadWidgetEnabled,
  loadWidgetView,
  type CalendarWidgetView,
} from './platform'

export type WidgetBridgePayload = {
  enabled: boolean
  view: CalendarWidgetView
  updatedAt: string
}

const BRIDGE_KEY = 'pintime:widgetBridge'

export function readWidgetBridge(): WidgetBridgePayload {
  return {
    enabled: loadWidgetEnabled(),
    view: loadWidgetView(),
    updatedAt: new Date().toISOString(),
  }
}

export function syncWidgetBridge() {
  const payload = readWidgetBridge()
  try {
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }

  // Capacitor 플러그인이 붙으면 여기서 Native 호출
  const native = (
    window as Window & {
      PinTimeWidget?: { update: (p: WidgetBridgePayload) => Promise<void> }
    }
  ).PinTimeWidget
  if (native?.update) {
    void native.update(payload)
  }

  return payload
}
