import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { solidAlpha, toneOf } from '../lib/eventColors'
import {
  expandSchedulesInRange,
  type ScheduleOccurrence,
} from '../lib/recurrence'
import {
  loadTodos,
  toggleTodoDone,
  type TodoItem,
} from '../lib/todos'
import {
  DAYS,
  HOURS,
  type AllDayEvent,
  type Day,
  type MaskedSlot,
  type Schedule,
  addDays,
  hourToLabel,
  parseDateKey,
  parseHour,
  toDateKey,
} from '../types'

const ROW_H = 52
const ALLDAY_BAR_H = 20
const ALLDAY_GAP = 2
/** 첫 열 고정 + 요일 7열 동일 분배 */
const COL =
  'grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]'
const GRID_LINE = 'border-[var(--line)]'

type WeekCol = { date: string; day: Day; label: string; dayNum: number }

type WeeklyCalendarProps = {
  schedules: Schedule[]
  allDayEvents: AllDayEvent[]
  /** 이 날짜가 속한 주를 표시 */
  weekAnchor: string
  maskedSlots: MaskedSlot[]
  onWeekChange: (dateKey: string) => void
  onCreateRange: (day: Day, startHour: number, endHour: number) => void
  onSelectSchedule: (schedule: Schedule) => void
  onSelectAllDay: (event: AllDayEvent) => void
  /** 요일 헤더 클릭 → 그날 일정 보기 */
  onDayClick?: (dateKey: string) => void
}

function weekRangeLabel(monday: string, sunday: string): string {
  const a = parseDateKey(monday)
  const b = parseDateKey(sunday)
  const sameMonth = a.getMonth() === b.getMonth()
  if (sameMonth) {
    return `${a.getFullYear()}년 ${a.getMonth() + 1}월 ${a.getDate()}일 – ${b.getDate()}일`
  }
  return `${a.getMonth() + 1}월 ${a.getDate()}일 – ${b.getMonth() + 1}월 ${b.getDate()}일`
}

type DragState = {
  day: Day
  startHour: number
  endHour: number
}

type AllDaySegment = {
  id: string
  title: string
  color?: string
  startCol: number
  endCol: number
  lane: number
  isStart: boolean
  isEnd: boolean
}

function weekColumns(anchor: string): WeekCol[] {
  const d = parseDateKey(anchor)
  const js = d.getDay()
  const toMonday = js === 0 ? -6 : 1 - js
  const monday = new Date(d)
  monday.setDate(d.getDate() + toMonday)

  return DAYS.map((day, i) => {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const date = toDateKey(cur)
    return {
      date,
      day,
      label: `${cur.getDate()}일 (${day})`,
      dayNum: cur.getDate(),
    }
  })
}

function assignLanes(
  items: Array<Omit<AllDaySegment, 'lane'>>,
): AllDaySegment[] {
  const sorted = [...items].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.endCol - b.startCol - (a.endCol - a.startCol)
  })
  const laneEnds: number[] = []
  return sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.startCol)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.endCol)
    } else {
      laneEnds[lane] = item.endCol
    }
    return { ...item, lane }
  })
}

function allDaySegmentsForWeek(
  cols: WeekCol[],
  events: AllDayEvent[],
): AllDaySegment[] {
  const weekStart = cols[0].date
  const weekEnd = cols[6].date
  const raw: Array<Omit<AllDaySegment, 'lane'>> = []

  for (const event of events) {
    if (event.endDate < weekStart || event.startDate > weekEnd) continue
    const startCol = Math.max(
      0,
      cols.findIndex((c) => c.date >= event.startDate),
    )
    let endCol = -1
    for (let i = 6; i >= 0; i -= 1) {
      if (cols[i].date <= event.endDate) {
        endCol = i
        break
      }
    }
    if (endCol < 0 || startCol > endCol) continue
    raw.push({
      id: event.id,
      title: event.title,
      color: event.color,
      startCol,
      endCol,
      isStart: event.startDate >= weekStart,
      isEnd: event.endDate <= weekEnd,
    })
  }
  return assignLanes(raw)
}

export function WeeklyCalendar({
  schedules,
  allDayEvents,
  weekAnchor,
  maskedSlots,
  onWeekChange,
  onCreateRange,
  onSelectSchedule,
  onSelectAllDay,
  onDayClick,
}: WeeklyCalendarProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragging = useRef(false)
  const [todos, setTodos] = useState<TodoItem[]>(() => loadTodos().items)

  useEffect(() => {
    const refresh = () => setTodos(loadTodos().items)
    window.addEventListener('pintime:todos', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('pintime:todos', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const cols = useMemo(() => weekColumns(weekAnchor), [weekAnchor])
  const todayKey = toDateKey(new Date())
  const weekLabel =
    cols.length > 0 ? weekRangeLabel(cols[0].date, cols[6].date) : ''

  const standingOpen = useMemo(
    () =>
      todos
        .filter((t) => t.kind === 'standing' && !t.done)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 4),
    [todos],
  )

  const dailyByDate = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of todos) {
      if (t.kind !== 'daily' || !t.date || t.done) continue
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt)
    }
    return map
  }, [todos])

  const weekTodoStrip = useMemo(() => {
    const todayDaily = (dailyByDate.get(todayKey) ?? []).slice(0, 4)
    return [...standingOpen, ...todayDaily]
  }, [standingOpen, dailyByDate, todayKey])

  const toggleTodo = (id: string) => {
    setTodos(toggleTodoDone(id).items)
  }

  const segments = useMemo(
    () => allDaySegmentsForWeek(cols, allDayEvents),
    [cols, allDayEvents],
  )
  const laneCount = Math.max(
    1,
    segments.reduce((m, s) => Math.max(m, s.lane + 1), 0),
  )
  const allDayHeight = laneCount * (ALLDAY_BAR_H + ALLDAY_GAP) + 8

  const maskSet = useMemo(() => {
    const set = new Set<string>()
    for (const s of maskedSlots) set.add(`${s.day}-${s.hour}`)
    return set
  }, [maskedSlots])

  const weekOccurrences = useMemo(
    () =>
      cols.length
        ? expandSchedulesInRange(schedules, cols[0].date, cols[6].date)
        : [],
    [schedules, cols],
  )

  const timedForDay = useCallback(
    (date: string) => weekOccurrences.filter((s) => s.date === date),
    [weekOccurrences],
  )

  /** 겹치는 일정에 레이어 인덱스 부여 (투명 겹침용) */
  const overlapLayout = useCallback((daySchedules: ScheduleOccurrence[]) => {
    const items = daySchedules
      .map((s) => ({
        s,
        start: parseHour(s.start),
        end: parseHour(s.end),
      }))
      .sort((a, b) => a.start - b.start || b.end - a.end)

    type Active = { end: number; lane: number }
    const active: Active[] = []
    const laneOf = new Map<string, number>()

    for (const item of items) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].end <= item.start) active.splice(i, 1)
      }
      const used = new Set(active.map((a) => a.lane))
      let lane = 0
      while (used.has(lane)) lane += 1
      active.push({ end: item.end, lane })
      laneOf.set(item.s.occurrenceId, lane)
    }

    const overlaps = new Map<string, boolean>()
    for (const item of items) {
      const hit = items.some(
        (o) =>
          o.s.occurrenceId !== item.s.occurrenceId &&
          o.start < item.end &&
          o.end > item.start,
      )
      overlaps.set(item.s.occurrenceId, hit)
    }

    return { laneOf, overlaps }
  }, [])

  const finishDrag = useCallback(() => {
    if (!drag) return
    const from = Math.min(drag.startHour, drag.endHour)
    const to = Math.max(drag.startHour, drag.endHour) + 1
    const blocked = HOURS.some(
      (h) => h >= from && h < to && maskSet.has(`${drag.day}-${h}`),
    )
    setDrag(null)
    dragging.current = false
    if (!blocked && to > from) onCreateRange(drag.day, from, to)
  }, [drag, maskSet, onCreateRange])

  const onMouseUp = useCallback(() => {
    if (dragging.current) finishDrag()
  }, [finishDrag])

  const eventById = useMemo(() => {
    const map = new Map(allDayEvents.map((e) => [e.id, e]))
    return map
  }, [allDayEvents])

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-white"
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        if (dragging.current) finishDrag()
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={() => onWeekChange(addDays(cols[0].date, -7))}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-50"
          aria-label="이전 주"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-slate-900">{weekLabel}</h3>
        <button
          type="button"
          onClick={() => onWeekChange(addDays(cols[0].date, 7))}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-50"
          aria-label="다음 주"
        >
          ›
        </button>
      </div>

      {weekTodoStrip.length > 0 && (
        <div className="shrink-0 border-b border-slate-100 bg-[var(--bg)]/80 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
            할 일 · 상시 · 오늘
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {weekTodoStrip.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => toggleTodo(t.id)}
                  className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-left text-[11px] font-medium text-[var(--ink)] shadow-sm transition hover:border-[var(--tomato)]/40"
                >
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-slate-300" />
                  <span className="truncate">
                    {t.kind === 'standing' ? (
                      <span className="mr-1 text-[9px] font-bold text-slate-400">
                        상시
                      </span>
                    ) : null}
                    {t.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 요일 · 종일 · 시간 — TimeTree식 단일 스크롤 그리드 */}
      <div className="pt-scroll min-h-0 flex-1 overflow-auto">
        {/* 요일 헤더: 위 요일 / 아래 날짜 숫자 */}
        <div
          className={`sticky top-0 z-20 grid border-b ${GRID_LINE} bg-white ${COL}`}
        >
          <div className="min-w-0" />
          {cols.map((col) => {
            const isToday = col.date === todayKey
            const isSun = col.day === '일'
            const isSat = col.day === '토'
            const dayTodos = dailyByDate.get(col.date) ?? []
            return (
              <button
                key={col.date}
                type="button"
                onClick={() => onDayClick?.(col.date)}
                className={`flex min-w-0 flex-col items-center gap-0.5 py-2 transition hover:bg-slate-50 ${
                  isToday ? 'bg-[var(--tomato-soft)]/35' : ''
                }`}
              >
                <span
                  className={`text-[10px] font-medium ${
                    isSun
                      ? 'text-rose-400'
                      : isSat
                        ? 'text-sky-500'
                        : 'text-slate-400'
                  }`}
                >
                  {col.day}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                    isToday
                      ? 'bg-[var(--tomato)] text-white'
                      : isSun
                        ? 'text-rose-500'
                        : isSat
                          ? 'text-sky-600'
                          : 'text-slate-800'
                  }`}
                >
                  {col.dayNum}
                </span>
                {dayTodos.length > 0 && (
                  <span className="mt-0.5 flex h-1 gap-0.5">
                    {dayTodos.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="h-1 w-1 rounded-full bg-[var(--tomato)]"
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 요일별 할 일 */}
        <div
          className={`sticky z-20 border-b ${GRID_LINE} bg-white`}
          style={{ top: '3.35rem' }}
        >
          <div className={`grid ${COL}`}>
            <div
              className={`flex min-w-0 items-start justify-end border-r ${GRID_LINE} py-1.5 pr-1.5`}
            >
              <span className="text-[10px] font-medium text-slate-400">
                할일
              </span>
            </div>
            {cols.map((col) => {
              const dayTodos = (dailyByDate.get(col.date) ?? []).slice(0, 3)
              return (
                <div
                  key={`todo-${col.date}`}
                  className={`min-w-0 space-y-0.5 border-r ${GRID_LINE} px-0.5 py-1 last:border-r-0 ${
                    col.date === todayKey ? 'bg-[var(--tomato-soft)]/15' : ''
                  }`}
                >
                  {dayTodos.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTodo(t.id)}
                      className="flex w-full items-start gap-0.5 rounded px-0.5 py-0.5 text-left hover:bg-slate-50"
                      title={t.text}
                    >
                      <span className="mt-0.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm border border-slate-300">
                        {t.done && (
                          <Check
                            size={7}
                            strokeWidth={3}
                            className="text-[var(--tomato)]"
                          />
                        )}
                      </span>
                      <span className="min-w-0 truncate text-[9px] leading-tight font-medium text-slate-700">
                        {t.text}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* 종일 */}
        <div
          className={`sticky z-20 border-b ${GRID_LINE} bg-white`}
          style={{
            top: 'calc(3.35rem + 2.75rem)',
            minHeight: allDayHeight,
          }}
        >
          <div className={`relative grid ${COL}`} style={{ minHeight: allDayHeight }}>
            <div
              className={`flex min-w-0 items-center justify-end border-r ${GRID_LINE} pr-1.5`}
            >
              <span className="text-[10px] font-medium text-slate-400">
                종일
              </span>
            </div>
            {cols.map((col) => (
              <div
                key={`allday-cell-${col.date}`}
                className={`min-w-0 border-r ${GRID_LINE} last:border-r-0 ${
                  col.date === todayKey ? 'bg-[var(--tomato-soft)]/20' : ''
                }`}
              />
            ))}

            <div className={`pointer-events-none absolute inset-0 grid ${COL}`}>
              <div className="min-w-0" />
              <div
                className="relative col-span-7 min-w-0"
                style={{ minHeight: allDayHeight }}
              >
                {segments.map((seg) => {
                  const tone = toneOf(seg.color)
                  const left = (seg.startCol / 7) * 100
                  const width = ((seg.endCol - seg.startCol + 1) / 7) * 100
                  const radius = [
                    seg.isStart ? '4px' : '0',
                    seg.isEnd ? '4px' : '0',
                    seg.isEnd ? '4px' : '0',
                    seg.isStart ? '4px' : '0',
                  ].join(' ')

                  return (
                    <div
                      key={`${seg.id}-${seg.startCol}`}
                      className="absolute px-px"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 4 + seg.lane * (ALLDAY_BAR_H + ALLDAY_GAP),
                        height: ALLDAY_BAR_H,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const ev = eventById.get(seg.id)
                          if (ev) onSelectAllDay(ev)
                        }}
                        className="pointer-events-auto flex h-full w-full items-center truncate px-1.5 text-left text-[11px] font-semibold text-white"
                        style={{
                          background: tone.solid,
                          borderRadius: radius,
                        }}
                      >
                        {seg.isStart ? seg.title : '\u00a0'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 시간 그리드 */}
        <div
          className={`relative grid ${COL}`}
          style={{ height: HOURS.length * ROW_H }}
        >
          {HOURS.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              <div
                className={`relative min-w-0 border-r ${GRID_LINE} pr-1 text-right sm:pr-1.5`}
                style={{ height: ROW_H }}
              >
                <span className="absolute top-[-0.45rem] right-1 text-[10px] font-medium tabular-nums text-slate-400 sm:right-1.5">
                  {hourToLabel(hour)}
                </span>
              </div>
              {cols.map((col) => {
                const masked = maskSet.has(`${col.day}-${hour}`)
                const inDrag =
                  !!drag &&
                  drag.day === col.day &&
                  hour >= Math.min(drag.startHour, drag.endHour) &&
                  hour <= Math.max(drag.startHour, drag.endHour)
                const isTodayCol = col.date === todayKey

                return (
                  <div
                    key={`${col.date}-${hour}`}
                    className={`relative min-w-0 border-b border-r ${GRID_LINE} last:border-r-0 ${
                      masked
                        ? 'cursor-not-allowed bg-slate-100'
                        : inDrag
                          ? 'cursor-ns-resize bg-[var(--tomato-soft)]'
                          : isTodayCol
                            ? 'cursor-ns-resize bg-[var(--tomato-soft)]/15 hover:bg-[var(--tomato-soft)]/35'
                            : 'cursor-ns-resize bg-white hover:bg-slate-50'
                    }`}
                    style={{ height: ROW_H }}
                    onMouseDown={(e) => {
                      if (e.button !== 0 || masked) return
                      e.preventDefault()
                      dragging.current = true
                      setDrag({
                        day: col.day,
                        startHour: hour,
                        endHour: hour,
                      })
                    }}
                    onMouseEnter={() => {
                      if (
                        !dragging.current ||
                        !drag ||
                        drag.day !== col.day
                      )
                        return
                      if (masked) return
                      setDrag((prev) =>
                        prev ? { ...prev, endHour: hour } : prev,
                      )
                    }}
                  >
                    {/* 30분 보조선 */}
                    {!masked && (
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <div className={`pointer-events-none absolute inset-0 grid ${COL}`}>
            <div className="min-w-0" />
            {cols.map((col) => {
              const daySchedules = timedForDay(col.date)
              const { laneOf, overlaps } = overlapLayout(daySchedules)

              return (
                <div key={`events-${col.date}`} className="relative min-w-0">
                  {daySchedules.map((schedule) => {
                    const start = parseHour(schedule.start)
                    const end = parseHour(schedule.end)
                    const top = (start - HOURS[0]) * ROW_H + 1
                    const height = (end - start) * ROW_H - 2
                    const tone = toneOf(schedule.color)
                    const lane = laneOf.get(schedule.occurrenceId) ?? 0
                    const isOverlap =
                      overlaps.get(schedule.occurrenceId) ?? false
                    const inset = isOverlap ? Math.min(lane, 3) * 8 : 0

                    return (
                      <button
                        key={schedule.occurrenceId}
                        type="button"
                        onClick={() => onSelectSchedule(schedule)}
                        className="pointer-events-auto absolute overflow-hidden rounded px-1.5 py-1 text-left transition hover:brightness-[0.97]"
                        style={{
                          top,
                          height: Math.max(height, 28),
                          left: 1 + inset,
                          right: 1,
                          zIndex: 10 + lane,
                          background: isOverlap
                            ? solidAlpha(tone.solid, 0.42)
                            : solidAlpha(tone.solid, 0.22),
                          boxShadow: `inset 3px 0 0 ${tone.solid}`,
                          color: tone.text,
                        }}
                      >
                        <p className="truncate text-[10px] font-bold leading-tight">
                          {schedule.start}
                          {schedule.repeat &&
                          schedule.repeat !== '안 함' &&
                          schedule.repeat !== 'none'
                            ? ' · ↻'
                            : ''}
                        </p>
                        <p className="truncate text-[11px] font-semibold leading-snug">
                          {schedule.title}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
