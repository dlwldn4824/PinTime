import {
  Check,
  Monitor,
  Palette,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCalendar } from '../context/CalendarContext'
import { useTheme, type AppTheme } from '../context/ThemeContext'
import {
  getDesktopApi,
  isElectronApp,
  loadWidgetEnabled,
  loadWidgetView,
  saveWidgetEnabled,
  saveWidgetView,
  type CalendarWidgetView,
} from '../lib/platform'

const themes: Array<{
  id: AppTheme
  label: string
  desc: string
  swatches: [string, string, string]
}> = [
  {
    id: 'tomato',
    label: '토마토',
    desc: '민트 배경 + 토마토 포인트',
    swatches: ['#ABE2C4', '#FE6653', '#1a2e24'],
  },
  {
    id: 'blue',
    label: '파랑',
    desc: '기존 블루 포인트 테마',
    swatches: ['#dbeafe', '#3b82f6', '#15181f'],
  },
]

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function MyPage() {
  const { theme, setTheme } = useTheme()
  const { schedules, allDay, clearCalendar } = useCalendar()
  const electron = isElectronApp()
  const [pinOpen, setPinOpen] = useState(false)
  const [clearedMsg, setClearedMsg] = useState<string | null>(null)
  const [widgetView, setWidgetView] = useState<CalendarWidgetView>(() =>
    loadWidgetView(),
  )
  const [widgetEnabled, setWidgetEnabled] = useState(() => loadWidgetEnabled())
  const [installEvt, setInstallEvt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const api = getDesktopApi()
    if (!api) return
    void api.isDesktopPinOpen().then(setPinOpen)
    return api.onDesktopPinChanged(setPinOpen)
  }, [])

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvt(null)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const togglePin = async () => {
    const api = getDesktopApi()
    if (!api) return
    const open = await api.toggleDesktopPin()
    setPinOpen(open)
    if (open) await api.setDesktopPinView(widgetView)
  }

  const toggleWidget = (on: boolean) => {
    setWidgetEnabled(on)
    saveWidgetEnabled(on)
    void import('../lib/widgetBridge').then((m) => m.syncWidgetBridge())
  }

  const changeWidgetView = async (view: CalendarWidgetView) => {
    setWidgetView(view)
    saveWidgetView(view)
    void import('../lib/widgetBridge').then((m) => m.syncWidgetBridge())
    const api = getDesktopApi()
    if (api && pinOpen) await api.setDesktopPinView(view)
  }

  const installPwa = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] pt-scroll">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5 pb-8">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--main)] text-[var(--pin-text)]">
            <UserRound size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--ink)]">마이페이지</h1>
            <p className="text-xs text-[var(--muted)]">
              프로필 · 테마 · 로컬 앱
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[var(--tomato)]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">테마</h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            선택하면 바로 적용되고, 다음에 열어도 유지됩니다.
          </p>

          <div className="mt-4 grid gap-3">
            {themes.map((item) => {
              const active = theme === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                    active
                      ? 'border-[var(--tomato)] bg-[var(--tomato-soft)]/50 ring-2 ring-[var(--tomato)]/30'
                      : 'border-[var(--line)] bg-[var(--bg)]/60 hover:border-[var(--tomato)]/40'
                  }`}
                >
                  <div className="flex shrink-0 gap-1">
                    {item.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-8 w-5 rounded-md ring-1 ring-black/5"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--ink)]">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">{item.desc}</p>
                  </div>
                  {active ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tomato)] text-white">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span className="h-7 w-7 shrink-0 rounded-full border border-[var(--line)] bg-white" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* 노트북 — 배경 고정 달력 */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-[var(--tomato)]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">
              노트북 · 배경 고정
            </h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            데스크톱에 달력을 고정해 둡니다. 창을 드래그해도 움직이지 않습니다.
            GitHub Releases의 Windows 설치 파일(.exe)로 실행하세요.
          </p>

          {electron ? (
            <button
              type="button"
              onClick={() => void togglePin()}
              className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                pinOpen
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-[var(--tomato)] hover:bg-[var(--tomato-deep)]'
              }`}
            >
              {pinOpen ? '배경 달력 끄기' : '배경에 달력 고정하기'}
            </button>
          ) : (
            <div className="mt-4 rounded-xl bg-[var(--bg)] px-3.5 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
              지금 브라우저입니다. 노트북 앱은{' '}
              <a
                className="font-semibold text-[var(--tomato)] underline-offset-2 hover:underline"
                href="https://github.com/dlwldn4824/PinTime/releases"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Releases
              </a>
              에서 받으세요.
            </div>
          )}
        </section>

        {/* 휴대폰 — 위젯 · 홈 화면 */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-[var(--tomato)]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">
              휴대폰 · 위젯
            </h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            홈 화면에 앱을 설치한 뒤, 위젯에 쓸 달력(주간/월간)을 고릅니다.
            네이티브 홈 위젯은 Capacitor 빌드 단계에서 OS 위젯으로 연결됩니다.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">
                위젯 사용
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                설정값을 기기에 저장합니다
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={widgetEnabled}
              onClick={() => toggleWidget(!widgetEnabled)}
              className={`relative h-7 w-12 rounded-full transition ${
                widgetEnabled ? 'bg-[var(--tomato)]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  widgetEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <p className="mt-3 text-[11px] font-semibold text-[var(--muted)]">
            위젯 달력 종류
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { id: 'week', label: '주간 (일력)', desc: '타임테이블형' },
                { id: 'month', label: '월간 (달력)', desc: '한 달 그리드' },
              ] as const
            ).map((opt) => {
              const active = widgetView === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!widgetEnabled}
                  onClick={() => void changeWidgetView(opt.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-40 ${
                    active
                      ? 'border-[var(--tomato)] bg-[var(--tomato-soft)]/50'
                      : 'border-[var(--line)] bg-white'
                  }`}
                >
                  <p className="text-sm font-bold text-[var(--ink)]">
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">{opt.desc}</p>
                </button>
              )
            })}
          </div>

          {!electron && (
            <div className="mt-4 space-y-2">
              {installed ? (
                <p className="rounded-xl bg-[var(--main-soft)] px-3.5 py-2.5 text-[11px] font-semibold text-[var(--pin-text)]">
                  홈 화면에 설치되어 있습니다 (PWA)
                </p>
              ) : installEvt ? (
                <button
                  type="button"
                  onClick={() => void installPwa()}
                  className="w-full rounded-xl bg-[var(--tomato)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--tomato-deep)]"
                >
                  홈 화면에 PinTime 설치
                </button>
              ) : (
                <p className="rounded-xl bg-[var(--bg)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
                  Safari/Chrome 공유 → <strong>홈 화면에 추가</strong>로 설치할
                  수 있습니다. Android Chrome에서는 설치 버튼이 나타날 수
                  있습니다.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-rose-600" />
            <h2 className="text-sm font-bold text-rose-800">위험 구역</h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-rose-700/80">
            캘린더에 저장된 일정을 모두 지웁니다. 되돌릴 수 없습니다.
          </p>
          <button
            type="button"
            disabled={schedules.length === 0 && allDay.length === 0}
            onClick={() => {
              if (
                !window.confirm(
                  '캘린더에 있는 일정을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
                )
              ) {
                return
              }
              clearCalendar()
              setClearedMsg('캘린더 일정을 모두 삭제했어요')
              window.setTimeout(() => setClearedMsg(null), 2500)
            }}
            className="mt-4 w-full rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            일정 전체 삭제
            {(schedules.length > 0 || allDay.length > 0) && (
              <span className="ml-1 font-medium text-rose-400">
                ({schedules.length + allDay.length})
              </span>
            )}
          </button>
          {clearedMsg && (
            <p className="mt-2 text-center text-[11px] font-semibold text-rose-600">
              {clearedMsg}
            </p>
          )}
        </section>

        <p className="text-center text-[11px] text-[var(--muted)]">
          PinTime · 로컬 앱 프로토타입
        </p>
      </div>
    </div>
  )
}
