import { useCallback, useMemo, useRef, useState } from 'react'
import { solidAlpha, toneOf } from '../lib/eventColors'
import {
  expandSchedulesInRange,
  type ScheduleOccurrence,
} from '../lib/recurrence'
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

const ROW_H = 56
const ALLDAY_BAR_H = 22
const ALLDAY_GAP = 3
const COL =
  'grid-cols-[56px_repeat(7,minmax(0,1fr))] sm:grid-cols-[64px_repeat(7,minmax(0,1fr))]'

type WeekCol = { date: string; day: Day; label: string }

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
}: WeeklyCalendarProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragging = useRef(false)

  const cols = useMemo(() => weekColumns(weekAnchor), [weekAnchor])
  const todayKey = toDateKey(new Date())
  const weekLabel =
    cols.length > 0 ? weekRangeLabel(cols[0].date, cols[6].date) : ''

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

      {/* 요일 헤더 */}
      <div
        className={`grid shrink-0 border-b border-[var(--line)] ${COL}`}
      >
        <div />
        {cols.map((col) => {
          const isToday = col.date === todayKey
          return (
            <div key={col.date} className="px-1 py-2.5 text-center sm:px-2">
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
                  isToday
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--muted)]'
                }`}
              >
                {col.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* 하루 종일 레이어 */}
      <div
        className={`grid shrink-0 border-b border-[var(--line)] bg-slate-50/40 ${COL}`}
        style={{ minHeight: allDayHeight }}
      >
        <div className="flex items-start justify-end border-r border-[var(--line)] pr-2 pt-2">
          <span className="text-[10px] font-semibold whitespace-nowrap text-[var(--muted)] sm:text-[11px]">
            하루 종일
          </span>
        </div>
        <div
          className="relative col-span-7"
          style={{ minHeight: allDayHeight }}
        >
          {/* 세로 구분선 */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
            {cols.map((col) => (
              <div
                key={`line-${col.date}`}
                className="border-r border-[var(--line)] last:border-r-0"
              />
            ))}
          </div>

          {segments.map((seg) => {
            const tone = toneOf(seg.color)
            const left = (seg.startCol / 7) * 100
            const width = ((seg.endCol - seg.startCol + 1) / 7) * 100
            const radius = [
              seg.isStart ? '6px' : '0',
              seg.isEnd ? '6px' : '0',
              seg.isEnd ? '6px' : '0',
              seg.isStart ? '6px' : '0',
            ].join(' ')

            return (
              <div
                key={`${seg.id}-${seg.startCol}`}
                className="absolute px-0.5"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: 6 + seg.lane * (ALLDAY_BAR_H + ALLDAY_GAP),
                  height: ALLDAY_BAR_H,
                }}
              >
                <button
                  type="button"
                  title="클릭하여 수정"
                  onClick={() => {
                    const ev = eventById.get(seg.id)
                    if (ev) onSelectAllDay(ev)
                  }}
                  className="flex h-full w-full items-center truncate px-2 text-left text-[11px] font-semibold text-white transition hover:brightness-110"
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

          {segments.length === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center px-3 text-[10px] text-slate-300">
              종일 일정이 없어요
            </p>
          )}
        </div>
      </div>

      {/* 시간 그리드 */}
      <div className="pt-scroll min-h-0 flex-1 overflow-auto">
        <div
          className={`relative grid ${COL}`}
          style={{ height: HOURS.length * ROW_H }}
        >
          {HOURS.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              <div
                className="relative border-r border-[var(--line)] pr-2 text-right sm:pr-3"
                style={{ height: ROW_H }}
              >
                <span className="absolute top-[-0.55rem] right-2 text-[10px] font-medium text-[var(--muted)] sm:right-3 sm:text-[11px]">
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

                return (
                  <div
                    key={`${col.date}-${hour}`}
                    className={`relative border-b border-r border-[var(--line)] last:border-r-0 ${
                      masked
                        ? 'cursor-not-allowed bg-slate-100'
                        : inDrag
                          ? 'cursor-ns-resize bg-sky-50'
                          : 'cursor-ns-resize bg-white hover:bg-slate-50/70'
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
                  />
                )
              })}
            </div>
          ))}

          <div
            className={`pointer-events-none absolute inset-0 grid ${COL}`}
          >
            <div />
            {cols.map((col) => {
              const daySchedules = timedForDay(col.date)
              const { laneOf, overlaps } = overlapLayout(daySchedules)

              return (
                <div key={`events-${col.date}`} className="relative">
                  {daySchedules.map((schedule) => {
                    const start = parseHour(schedule.start)
                    const end = parseHour(schedule.end)
                    const top = (start - HOURS[0]) * ROW_H + 3
                    const height = (end - start) * ROW_H - 6
                    const tone = toneOf(schedule.color)
                    const lane = laneOf.get(schedule.occurrenceId) ?? 0
                    const isOverlap =
                      overlaps.get(schedule.occurrenceId) ?? false
                    const inset = isOverlap ? Math.min(lane, 3) * 10 : 0

                    return (
                      <button
                        key={schedule.occurrenceId}
                        type="button"
                        title="클릭하여 수정"
                        onClick={() => onSelectSchedule(schedule)}
                        className="pointer-events-auto absolute overflow-hidden rounded-lg px-2 py-1.5 text-left backdrop-blur-[1px] transition hover:brightness-[0.98] sm:px-2.5"
                        style={{
                          top,
                          height: Math.max(height, 32),
                          left: 4 + inset,
                          right: 4,
                          zIndex: 10 + lane,
                          background: isOverlap
                            ? solidAlpha(tone.solid, 0.38)
                            : solidAlpha(tone.solid, 0.18),
                          boxShadow: `inset 3px 0 0 ${tone.solid}`,
                          color: tone.text,
                        }}
                      >
                        <p className="truncate text-[11px] font-bold">
                          {schedule.start}
                          {schedule.repeat &&
                          schedule.repeat !== '안 함' &&
                          schedule.repeat !== 'none'
                            ? ' · ↻'
                            : ''}
                        </p>
                        <p className="truncate text-xs font-semibold">
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
