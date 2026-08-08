import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MonthlyCalendar } from '../components/MonthlyCalendar'
import { WeeklyCalendar } from '../components/WeeklyCalendar'
import { useCalendar } from '../context/CalendarContext'
import {
  getDesktopApi,
  loadWidgetView,
  type CalendarWidgetView,
} from '../lib/platform'
import { toDateKey } from '../types'

/**
 * Electron 데스크톱 달력 창 — 본 앱 캘린더와 같은 톤.
 * 타이틀바 드래그로 이동 · 창 모서리로 크기 조절.
 */
export function DesktopPinPage() {
  const {
    schedules,
    allDay,
    selectedDate,
    setSelectedDate,
    monthCursor,
    setMonthCursor,
  } = useCalendar()
  const [view, setView] = useState<CalendarWidgetView>(() => loadWidgetView())

  useEffect(() => {
    document.documentElement.classList.add('pt-desktop-pin')
    document.body.classList.add('pt-desktop-pin')
    return () => {
      document.documentElement.classList.remove('pt-desktop-pin')
      document.body.classList.remove('pt-desktop-pin')
    }
  }, [])

  useEffect(() => {
    const api = window.pintimeDesktop
    if (!api?.onDesktopPinView) return
    return api.onDesktopPinView((next) => setView(next))
  }, [])

  const closePin = () => {
    void getDesktopApi()?.closeDesktopPin()
  }

  const weekAnchor = selectedDate || toDateKey(new Date())

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[var(--bg)]">
      <div className="pt-pin-drag flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-[var(--ink)]">
            내 캘린더
          </h2>
          <p className="text-[10px] text-[var(--muted)]">
            위쪽을 드래그해 이동 · 모서리로 크기 조절
          </p>
        </div>
        <div className="pt-pin-no-drag flex shrink-0 items-center gap-1.5">
          <div className="inline-flex rounded-full bg-slate-100 p-0.5">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                  view === mode
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)]'
                }`}
              >
                {mode === 'week' ? '주간' : '월간'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={closePin}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="데스크톱 달력 닫기"
            title="닫기"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_8px_30px_rgba(21,24,31,0.06)]">
          {view === 'week' ? (
            <WeeklyCalendar
              schedules={schedules}
              allDayEvents={allDay}
              weekAnchor={weekAnchor}
              maskedSlots={[]}
              onWeekChange={setSelectedDate}
              onCreateRange={() => undefined}
              onSelectSchedule={() => undefined}
              onSelectAllDay={() => undefined}
              onDayClick={setSelectedDate}
            />
          ) : (
            <MonthlyCalendar
              year={monthCursor.year}
              month={monthCursor.month}
              events={allDay}
              schedules={schedules}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onDayClick={setSelectedDate}
              onCreateAllDayRange={() => undefined}
              onSelectEvent={() => undefined}
              onSelectSchedule={() => undefined}
              onMonthChange={(y, m) => setMonthCursor({ year: y, month: m })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
