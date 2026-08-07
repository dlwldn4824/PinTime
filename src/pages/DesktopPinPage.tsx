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
 * Electron 배경 고정 창 — 캘린더만 표시.
 * 창은 OS에서 movable:false 로 고정되어 드래그로 이동하지 않음.
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
    <div className="flex h-svh flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/92 shadow-2xl shadow-black/20 backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100/80 px-3 py-2">
        <p className="text-xs font-bold tracking-tight text-slate-800">
          PinTime
        </p>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-slate-100 p-0.5">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  view === mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
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
            aria-label="배경 달력 닫기"
            title="닫기"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
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
  )
}
