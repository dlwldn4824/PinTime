import {
  Check,
  ChartColumn,
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
  loadAnalyticsConsent,
  saveAnalyticsConsent,
  track,
} from '../lib/analytics'
import {
  getDesktopApi,
  isElectronApp,
  loadWidgetView,
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
  const [analyticsOn, setAnalyticsOn] = useState(() => loadAnalyticsConsent())
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
    if (open) await api.setDesktopPinView(loadWidgetView())
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
              테마 · 앱 설정
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
                  onClick={() => {
                    setTheme(item.id)
                    track('theme_change', { theme: item.id })
                  }}
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

        {!electron && (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ChartColumn size={16} className="text-[var(--tomato)]" />
              <h2 className="text-sm font-bold text-[var(--ink)]">사용 통계</h2>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              일정·할일 내용은 보내지 않고, 화면 이름만 익명으로 보냅니다.
              기본은 꺼져 있어요.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  익명 사용 통계 허용
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  일정 내용은 보내지 않아요
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsOn}
                onClick={() => {
                  const next = !analyticsOn
                  if (next) {
                    saveAnalyticsConsent(true)
                    setAnalyticsOn(true)
                    track('analytics_opt_in')
                  } else {
                    track('analytics_opt_out')
                    saveAnalyticsConsent(false)
                    setAnalyticsOn(false)
                  }
                }}
                className={`relative h-7 w-12 rounded-full transition ${
                  analyticsOn ? 'bg-[var(--tomato)]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    analyticsOn ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-[var(--tomato)]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">
              노트북 · 배경 고정
            </h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            데스크톱에 달력을 고정해 둡니다. 창을 드래그해도 움직이지 않습니다.
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
              노트북 앱(Windows · macOS)은{' '}
              <a
                className="font-semibold text-[var(--tomato)] underline-offset-2 hover:underline"
                href="https://github.com/dlwldn4824/PinTime/releases"
                target="_blank"
                rel="noreferrer"
              >
                여기에서 받기
              </a>
            </div>
          )}
        </section>

        {!electron && (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-[var(--tomato)]" />
              <h2 className="text-sm font-bold text-[var(--ink)]">
                휴대폰 · 홈 화면
              </h2>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              홈 화면에 추가해 앱처럼 쓸 수 있어요.
            </p>

            <div className="mt-4 space-y-2">
              {installed ? (
                <p className="rounded-xl bg-[var(--main-soft)] px-3.5 py-2.5 text-[11px] font-semibold text-[var(--pin-text)]">
                  홈 화면에 설치되어 있습니다
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
                  브라우저 메뉴에서 <strong>홈 화면에 추가</strong>를 선택하세요.
                </p>
              )}
            </div>
          </section>
        )}

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
      </div>
    </div>
  )
}
