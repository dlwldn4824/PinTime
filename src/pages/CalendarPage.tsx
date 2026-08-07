import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DayAgendaSheet } from '../components/DayAgendaSheet'
import { EventFormModal } from '../components/EventFormModal'
import { MonthlyCalendar } from '../components/MonthlyCalendar'
import { TitleModal } from '../components/TitleModal'
import { Toast } from '../components/Toast'
import { WeeklyCalendar } from '../components/WeeklyCalendar'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../hooks/useToast'
import { dateForWeekdayInWeek } from '../lib/recurrence'
import {
  type AllDayEvent,
  type Day,
  type Schedule,
  hourToLabel,
  parseHour,
  weekdayOfDateKey,
} from '../types'

type PendingWeek = {
  kind: 'week'
  day: Day
  startHour: number
  endHour: number
}

type PendingMonth = {
  kind: 'month'
  startDate: string
  endDate: string
  defaultAllDay: boolean
}

type Editing =
  | { kind: 'week-schedule'; schedule: Schedule }
  | { kind: 'month-schedule'; schedule: Schedule }
  | { kind: 'allday'; event: AllDayEvent }

export function CalendarPage() {
  const {
    schedules,
    allDay,
    addSchedule,
    updateSchedule,
    removeSchedule,
    addAllDay,
    updateAllDay,
    removeAllDay,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    monthCursor,
    setMonthCursor,
  } = useCalendar()
  const { toast, showToast } = useToast()
  const [pending, setPending] = useState<PendingWeek | PendingMonth | null>(
    null,
  )
  const [editing, setEditing] = useState<Editing | null>(null)
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null)
  const [returnToDay, setReturnToDay] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const openDaySheet = (date: string) => {
    setSelectedDate(date)
    setDaySheetDate(date)
  }

  const reopenDayIfNeeded = () => {
    if (!returnToDay) return
    setDaySheetDate(returnToDay)
    setReturnToDay(null)
  }

  const closeEditing = () => {
    setEditing(null)
    reopenDayIfNeeded()
  }

  const startAddForDay = (date: string) => {
    setSelectedDate(date)
    setReturnToDay(date)
    setDaySheetDate(null)
    setPending({
      kind: 'month',
      startDate: date,
      endDate: date,
      defaultAllDay: false,
    })
  }

  useEffect(() => {
    try {
      const d = sessionStorage.getItem('pintime:openDay')
      if (!d) return
      sessionStorage.removeItem('pintime:openDay')
      setDaySheetDate(d)
      setSelectedDate(d)
    } catch {
      /* ignore */
    }
  }, [setSelectedDate])

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as Array<
      | { kind: 'schedule'; item: Schedule }
      | { kind: 'allday'; item: AllDayEvent }
    >

    const timed = schedules
      .filter((s) => {
        const blob = [
          s.title,
          s.location,
          s.memo,
          s.link,
          s.repeat,
          s.date,
          s.day,
          s.start,
          s.end,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(q)
      })
      .map((item) => ({ kind: 'schedule' as const, item }))

    const days = allDay
      .filter((e) => {
        const blob = [e.title, e.startDate, e.endDate].join(' ').toLowerCase()
        return blob.includes(q)
      })
      .map((item) => ({ kind: 'allday' as const, item }))

    return [...timed, ...days].slice(0, 8)
  }, [query, schedules, allDay])

  const weekCreateLabel =
    pending?.kind === 'week'
      ? `${pending.day}요일 ${hourToLabel(pending.startHour)} – ${hourToLabel(pending.endHour)}`
      : ''

  const weekEditLabel =
    editing?.kind === 'week-schedule'
      ? `${editing.schedule.day}요일`
      : ''

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-5 py-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">
            내 캘린더
          </h2>
          {view === 'week' && (
            <p className="text-xs text-[var(--muted)]">
              날짜를 눌러 일정을 보고 · 빈 칸을 드래그해 추가하세요
            </p>
          )}
          {view === 'month' && (
            <p className="text-xs text-[var(--muted)]">
              날짜를 누르면 그날 일정이 열려요 · +로 추가 · 일정을 눌러 수정
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-100 p-0.5">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  view === mode
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)]'
                }`}
              >
                {mode === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <div ref={searchRef} className="relative w-full max-w-[220px] sm:w-auto">
            <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--muted)] focus-within:border-[var(--tomato)] focus-within:ring-2 focus-within:ring-[var(--tomato-soft)]">
              <Search size={13} className="shrink-0" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchOpen(false), 150)
                }}
                placeholder="일정 검색"
                className="min-w-0 flex-1 bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:w-36"
              />
              {query && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('')
                    setSearchOpen(false)
                  }}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="검색어 지우기"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {searchOpen && query.trim() && (
              <ul className="absolute top-full right-0 z-30 mt-1.5 max-h-64 w-[min(100vw-2rem,280px)] overflow-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg shadow-slate-900/10">
                {searchHits.length === 0 ? (
                  <li className="px-3 py-2.5 text-xs text-slate-400">
                    검색 결과가 없어요
                  </li>
                ) : (
                  searchHits.map((hit) =>
                    hit.kind === 'schedule' ? (
                      <li key={`s-${hit.item.id}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (hit.item.date) {
                              setSelectedDate(hit.item.date)
                              setView('week')
                            }
                            setEditing(
                              hit.item.date
                                ? { kind: 'month-schedule', schedule: hit.item }
                                : { kind: 'week-schedule', schedule: hit.item },
                            )
                            setSearchOpen(false)
                            setQuery('')
                          }}
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="truncate text-xs font-semibold text-slate-800">
                            {hit.item.title}
                          </span>
                          <span className="truncate text-[10px] text-slate-400">
                            {hit.item.date
                              ? `${hit.item.date} · ${hit.item.start}–${hit.item.end}`
                              : `${hit.item.day} · ${hit.item.start}–${hit.item.end}`}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={`a-${hit.item.id}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedDate(hit.item.startDate)
                            setView('month')
                            setEditing({ kind: 'allday', event: hit.item })
                            setSearchOpen(false)
                            setQuery('')
                          }}
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="truncate text-xs font-semibold text-slate-800">
                            {hit.item.title}
                          </span>
                          <span className="truncate text-[10px] text-slate-400">
                            종일 · {hit.item.startDate} – {hit.item.endDate}
                          </span>
                        </button>
                      </li>
                    ),
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_8px_30px_rgba(21,24,31,0.06)]">
          {view === 'week' ? (
            <WeeklyCalendar
              schedules={schedules}
              allDayEvents={allDay}
              weekAnchor={selectedDate}
              maskedSlots={[]}
              onWeekChange={setSelectedDate}
              onCreateRange={(day, startHour, endHour) =>
                setPending({ kind: 'week', day, startHour, endHour })
              }
              onSelectSchedule={(schedule) => {
                const master =
                  schedules.find((s) => s.id === schedule.id) ?? schedule
                setEditing({ kind: 'week-schedule', schedule: master })
              }}
              onSelectAllDay={(event) =>
                setEditing({ kind: 'allday', event })
              }
              onDayClick={openDaySheet}
            />
          ) : (
            <MonthlyCalendar
              year={monthCursor.year}
              month={monthCursor.month}
              events={allDay}
              schedules={schedules}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onMonthChange={(year, month) => setMonthCursor({ year, month })}
              onDayClick={openDaySheet}
              onCreateAllDayRange={(startDate, endDate) =>
                setPending({
                  kind: 'month',
                  startDate,
                  endDate,
                  defaultAllDay: true,
                })
              }
              onSelectEvent={(event) => setEditing({ kind: 'allday', event })}
              onSelectSchedule={(schedule) => {
                const master =
                  schedules.find((s) => s.id === schedule.id) ?? schedule
                setEditing({ kind: 'month-schedule', schedule: master })
              }}
            />
          )}
        </div>
      </div>

      <DayAgendaSheet
        open={!!daySheetDate}
        date={daySheetDate ?? selectedDate}
        schedules={schedules}
        allDay={allDay}
        onClose={() => setDaySheetDate(null)}
        onAdd={() => {
          if (daySheetDate) startAddForDay(daySheetDate)
        }}
        onSelectSchedule={(schedule) => {
          setReturnToDay(daySheetDate)
          setDaySheetDate(null)
          setEditing({
            kind: view === 'week' ? 'week-schedule' : 'month-schedule',
            schedule,
          })
        }}
        onSelectAllDay={(event) => {
          setReturnToDay(daySheetDate)
          setDaySheetDate(null)
          setEditing({ kind: 'allday', event })
        }}
      />

      {/* Week 새 일정 */}
      <TitleModal
        open={pending?.kind === 'week'}
        mode="create"
        rangeLabel={weekCreateLabel}
        repeatAnchorDate={
          pending?.kind === 'week'
            ? dateForWeekdayInWeek(selectedDate, pending.day)
            : undefined
        }
        initialStartHour={
          pending?.kind === 'week' ? pending.startHour : 10
        }
        initialEndHour={pending?.kind === 'week' ? pending.endHour : 11}
        onCancel={() => setPending(null)}
        onConfirm={({ title, color, startHour, endHour, extras }) => {
          if (pending?.kind !== 'week') return
          addSchedule({
            day: pending.day,
            date: dateForWeekdayInWeek(selectedDate, pending.day),
            start: hourToLabel(startHour || pending.startHour),
            end: hourToLabel(endHour || pending.endHour),
            title,
            color,
            ...extras,
          })
          showToast('시간 일정을 등록했어요')
          setPending(null)
        }}
      />

      {/* Week 수정 */}
      <TitleModal
        open={editing?.kind === 'week-schedule'}
        mode="edit"
        rangeLabel={weekEditLabel}
        editableHours
        repeatAnchorDate={
          editing?.kind === 'week-schedule'
            ? editing.schedule.date ??
              dateForWeekdayInWeek(selectedDate, editing.schedule.day)
            : undefined
        }
        initialTitle={
          editing?.kind === 'week-schedule' ? editing.schedule.title : ''
        }
        initialColor={
          editing?.kind === 'week-schedule'
            ? editing.schedule.color
            : undefined
        }
        initialExtras={
          editing?.kind === 'week-schedule'
            ? {
                repeat: editing.schedule.repeat,
                repeatUntil: editing.schedule.repeatUntil,
                location: editing.schedule.location,
                link: editing.schedule.link,
                memo: editing.schedule.memo,
              }
            : undefined
        }
        initialStartHour={
          editing?.kind === 'week-schedule'
            ? Math.floor(parseHour(editing.schedule.start))
            : 10
        }
        initialEndHour={
          editing?.kind === 'week-schedule'
            ? Math.ceil(parseHour(editing.schedule.end))
            : 11
        }
        onCancel={closeEditing}
        onConfirm={({ title, color, startHour, endHour, extras }) => {
          if (editing?.kind !== 'week-schedule') return
          updateSchedule(editing.schedule.id, {
            day: editing.schedule.day,
            date:
              editing.schedule.date ??
              dateForWeekdayInWeek(selectedDate, editing.schedule.day),
            start: hourToLabel(startHour),
            end: hourToLabel(endHour),
            title,
            color,
            ...extras,
          })
          showToast('일정을 수정했어요')
          closeEditing()
        }}
        onDelete={() => {
          if (editing?.kind !== 'week-schedule') return
          removeSchedule(editing.schedule.id)
          showToast('일정을 삭제했어요')
          closeEditing()
        }}
      />

      {/* Month 새 일정 */}
      <EventFormModal
        open={pending?.kind === 'month'}
        mode="create"
        defaultAllDay={
          pending?.kind === 'month' ? pending.defaultAllDay : true
        }
        initialStartDate={
          pending?.kind === 'month' ? pending.startDate : selectedDate
        }
        initialEndDate={
          pending?.kind === 'month' ? pending.endDate : selectedDate
        }
        onCancel={() => {
          setPending(null)
          reopenDayIfNeeded()
        }}
        onConfirm={({
          title,
          color,
          allDay: isAllDay,
          startDate,
          endDate,
          startHour,
          endHour,
          extras,
        }) => {
          if (isAllDay || startDate !== endDate) {
            addAllDay({
              title,
              startDate,
              endDate,
              color,
            })
            showToast(
              isAllDay ? '종일 일정을 등록했어요' : '일정을 등록했어요',
            )
          } else {
            addSchedule({
              day: weekdayOfDateKey(startDate),
              date: startDate,
              start: hourToLabel(startHour),
              end: hourToLabel(endHour),
              title,
              color,
              ...extras,
            })
            showToast('시간 일정을 등록했어요')
          }
          setPending(null)
          setDaySheetDate(startDate)
          setReturnToDay(null)
        }}
      />

      {/* Month 종일 수정 */}
      <EventFormModal
        open={editing?.kind === 'allday'}
        mode="edit"
        defaultAllDay
        initialTitle={editing?.kind === 'allday' ? editing.event.title : ''}
        initialColor={
          editing?.kind === 'allday' ? editing.event.color : undefined
        }
        initialStartDate={
          editing?.kind === 'allday' ? editing.event.startDate : selectedDate
        }
        initialEndDate={
          editing?.kind === 'allday' ? editing.event.endDate : selectedDate
        }
        onCancel={closeEditing}
        onConfirm={({
          title,
          color,
          allDay: isAllDay,
          startDate,
          endDate,
          startHour,
          endHour,
          extras,
        }) => {
          if (editing?.kind !== 'allday') return
          if (isAllDay || startDate !== endDate) {
            updateAllDay(editing.event.id, {
              title,
              startDate,
              endDate,
              color,
            })
          } else {
            removeAllDay(editing.event.id)
            addSchedule({
              day: weekdayOfDateKey(startDate),
              date: startDate,
              start: hourToLabel(startHour),
              end: hourToLabel(endHour),
              title,
              color,
              ...extras,
            })
          }
          showToast('일정을 수정했어요')
          closeEditing()
        }}
        onDelete={() => {
          if (editing?.kind !== 'allday') return
          removeAllDay(editing.event.id)
          showToast('일정을 삭제했어요')
          closeEditing()
        }}
      />

      {/* Month 시간 일정 수정 */}
      <EventFormModal
        open={editing?.kind === 'month-schedule'}
        mode="edit"
        defaultAllDay={false}
        initialTitle={
          editing?.kind === 'month-schedule' ? editing.schedule.title : ''
        }
        initialColor={
          editing?.kind === 'month-schedule'
            ? editing.schedule.color
            : undefined
        }
        initialExtras={
          editing?.kind === 'month-schedule'
            ? {
                repeat: editing.schedule.repeat,
                repeatUntil: editing.schedule.repeatUntil,
                location: editing.schedule.location,
                link: editing.schedule.link,
                memo: editing.schedule.memo,
              }
            : undefined
        }
        initialStartDate={
          editing?.kind === 'month-schedule'
            ? editing.schedule.date ?? selectedDate
            : selectedDate
        }
        initialEndDate={
          editing?.kind === 'month-schedule'
            ? editing.schedule.date ?? selectedDate
            : selectedDate
        }
        initialStartHour={
          editing?.kind === 'month-schedule'
            ? Math.floor(parseHour(editing.schedule.start))
            : 10
        }
        initialEndHour={
          editing?.kind === 'month-schedule'
            ? Math.ceil(parseHour(editing.schedule.end))
            : 11
        }
        onCancel={closeEditing}
        onConfirm={({
          title,
          color,
          allDay: isAllDay,
          startDate,
          endDate,
          startHour,
          endHour,
          extras,
        }) => {
          if (editing?.kind !== 'month-schedule') return
          if (isAllDay || startDate !== endDate) {
            removeSchedule(editing.schedule.id)
            addAllDay({ title, startDate, endDate, color })
          } else {
            updateSchedule(editing.schedule.id, {
              day: weekdayOfDateKey(startDate),
              date: startDate,
              start: hourToLabel(startHour),
              end: hourToLabel(endHour),
              title,
              color,
              ...extras,
            })
          }
          showToast('일정을 수정했어요')
          closeEditing()
        }}
        onDelete={() => {
          if (editing?.kind !== 'month-schedule') return
          removeSchedule(editing.schedule.id)
          showToast('일정을 삭제했어요')
          closeEditing()
        }}
      />

      <Toast message={toast} />
    </div>
  )
}
