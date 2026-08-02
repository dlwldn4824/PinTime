import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppSidebar } from './components/AppSidebar'
import { BottomNav } from './components/BottomNav'
import { CalendarProvider } from './context/CalendarContext'
import { AgentPage } from './pages/AgentPage'
import { CalendarPage } from './pages/CalendarPage'
import { JoinPage } from './pages/JoinPage'
import { SharePage } from './pages/SharePage'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh min-h-svh bg-[var(--bg)]">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        <div className="lg:hidden">
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--pin)] text-sm font-bold text-white sm:h-9 sm:w-9">
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
  return (
    <CalendarProvider>
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
  )
}
