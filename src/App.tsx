import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AnalyticsRouteTracker } from './components/AnalyticsRouteTracker'
import { AppSidebar } from './components/AppSidebar'
import { BottomNav } from './components/BottomNav'
import { CalendarProvider } from './context/CalendarContext'
import { ThemeProvider } from './context/ThemeContext'
import { isDesktopPinMode, shouldRenderDesktopPin } from './lib/platform'
import { AgentPage } from './pages/AgentPage'
import { CalendarPage } from './pages/CalendarPage'
import { DesktopPinPage } from './pages/DesktopPinPage'
import { JoinPage } from './pages/JoinPage'
import { MyPage } from './pages/MyPage'
import { SharePage } from './pages/SharePage'
import { TodoPage } from './pages/TodoPage'

const SIDEBAR_KEY = 'pintime:sidebarOpen'

function useSidebarOpen() {
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_KEY)
      if (raw === null) return true
      return raw === '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [open])

  return [open, setOpen] as const
}

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen()

  return (
    <div className="flex h-svh min-h-svh bg-[var(--bg)]">
      <div
        className={`hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out lg:block ${
          sidebarOpen ? 'w-[280px]' : 'w-0'
        }`}
      >
        <div className="h-full w-[280px]">
          <AppSidebar onCollapse={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 사이드바 닫힘 · 데스크탑: 열기 버튼만 (네비는 폰과 같은 하단바) */}
        {!sidebarOpen && (
          <header className="relative z-30 hidden shrink-0 items-center border-b border-[var(--line)] bg-white/90 px-4 py-2.5 backdrop-blur-md lg:flex">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--main-soft)]"
              title="사이드바 열기"
              aria-label="사이드바 열기"
            >
              <PanelLeft size={15} />
              사이드바
            </button>
          </header>
        )}

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        {/* 모바일 항상 · lg에서는 사이드바 접었을 때만 */}
        <div className={sidebarOpen ? 'lg:hidden' : undefined}>
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg)]">
      <header className="shrink-0 border-b border-[var(--line)] bg-white px-3 py-2.5 sm:px-5 sm:py-3">
        <Link
          to="/"
          className="flex items-center gap-2.5 sm:gap-3 transition hover:opacity-90"
          aria-label="홈으로 이동"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--main)] text-sm font-bold text-[var(--pin-text)] sm:h-9 sm:w-9">
            P
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-[var(--ink)]">
              PinTime
            </h1>
            <p className="truncate text-[11px] text-[var(--muted)]">
              공유 참여 · TimePick
            </p>
          </div>
        </Link>
      </header>
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}

export default function App() {
  if (shouldRenderDesktopPin()) {
    return (
      <ThemeProvider>
        <CalendarProvider>
          <DesktopPinPage />
        </CalendarProvider>
      </ThemeProvider>
    )
  }

  // 브라우저에서 ?mode=desktop-pin 잠금 방지
  if (isDesktopPinMode()) {
    return <Navigate to="/calendar" replace />
  }

  return (
    <ThemeProvider>
      <CalendarProvider>
        <AnalyticsRouteTracker />
        {/* 선택 원 가장자리 텍스처 필터 */}
        <svg
          aria-hidden
          width="0"
          height="0"
          className="pointer-events-none absolute"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        >
          <defs>
            <filter
              id="pt-tomato-edge"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="3"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="2"
                xChannelSelector="R"
                yChannelSelector="G"
              />
              <feGaussianBlur stdDeviation="0.25" />
            </filter>
          </defs>
        </svg>
        <Routes>
          <Route
            path="/"
            element={
              <Shell>
                <AgentPage />
              </Shell>
            }
          />
          <Route
            path="/calendar"
            element={
              <Shell>
                <CalendarPage />
              </Shell>
            }
          />
          <Route
            path="/share"
            element={
              <Shell>
                <SharePage />
              </Shell>
            }
          />
          <Route
            path="/todo"
            element={
              <Shell>
                <TodoPage />
              </Shell>
            }
          />
          <Route
            path="/me"
            element={
              <Shell>
                <MyPage />
              </Shell>
            }
          />
          <Route
            path="/join/:roomId"
            element={
              <JoinShell>
                <JoinPage />
              </JoinShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CalendarProvider>
    </ThemeProvider>
  )
}
