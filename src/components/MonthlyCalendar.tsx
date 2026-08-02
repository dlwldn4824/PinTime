import { useEffect, useMemo, useRef, useState } from 'react'
import { toneOf } from '../lib/eventColors'
import { schedulesOnDate } from '../lib/recurrence'
import {
  type AllDayEvent,
  type Schedule,
  dayDiffInclusive,
  parseDateKey,
  toDateKey,
} from '../types'

type MonthlyCalendarProps = {
  year: number
  month: number
  events: AllDayEvent[]
  schedules?: Schedule[]
  selectedDate?: string
  onSelectDate?: (dateKey: string) => void
  onDayClick: (dateKey: string) => void
  onCreateAllDayRange: (startDate: string, endDate: string) => void
  onSelectEvent: (event: AllDayEvent) => void
  onSelectSchedule?: (schedule: Schedule) => void
  onMonthChange: (year: number, month: number) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const BAR_H = 18
const BAR_GAP = 2
const MAX_LANES = 3

type Cell = { key: string; inMonth: boolean }

type WeekSegment = {
  id: string
  title: string
  color?: string
  startCol: number
  endCol: number
  lane: number
  isStart: boolean
  isEnd: boolean
  ghost?: boolean
}

function buildCells(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Cell[] = []

  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, 1 - (startPad - i))
    cells.push({ key: toDateKey(d), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: toDateKey(new Date(year, month, day)), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = parseDateKey(cells[cells.length - 1].key)
    last.setDate(last.getDate() + 1)
    cells.push({ key: toDateKey(last), inMonth: false })
  }
  return cells
}

function assignLanes(
  items: Array<Omit<WeekSegment, 'lane'>>,
): WeekSegment[] {
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

function segmentsForWeek(
  weekKeys: string[],
  events: AllDayEvent[],
  draft: { start: string; end: string } | null,
): WeekSegment[] {
  const weekStart = weekKeys[0]
  const weekEnd = weekKeys[6]
  const raw: Array<Omit<WeekSegment, 'lane'>> = []

  for (const event of events) {
    if (event.endDate < weekStart || event.startDate > weekEnd) continue
    const startCol = Math.max(
      0,
      weekKeys.findIndex((k) => k >= event.startDate),
    )
    let endCol = -1
    for (let i = 6; i >= 0; i -= 1) {
      if (weekKeys[i] <= event.endDate) {
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

  if (draft) {
    if (!(draft.end < weekStart || draft.start > weekEnd)) {
      const startCol = Math.max(
        0,
        weekKeys.findIndex((k) => k >= draft.start),
      )
      let endCol = -1
      for (let i = 6; i >= 0; i -= 1) {
        if (weekKeys[i] <= draft.end) {
          endCol = i
          break
        }
      }
      if (endCol >= 0 && startCol <= endCol) {
        raw.push({
          id: '__draft__',
          title: '새 종일 일정',
          color: 'peacock',
          startCol,
          endCol,
          isStart: draft.start >= weekStart,
          isEnd: draft.end <= weekEnd,
          ghost: true,
        })
      }
    }
  }

  return assignLanes(raw)
}

export function MonthlyCalendar({
  year,
  month,
  events,
  schedules = [],
  selectedDate,
  onSelectDate,
  onDayClick,
  onCreateAllDayRange,
  onSelectEvent,
  onSelectSchedule,
  onMonthChange,
}: MonthlyCalendarProps) {
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const [rangeDragging, setRangeDragging] = useState(false)
  const dragging = useRef(false)
  const crossedCells = useRef(false)
  const dragStartRef = useRef<string | null>(null)
  const dragEndRef = useRef<string | null>(null)
  const onDayClickRef = useRef(onDayClick)
  const onCreateAllDayRef = useRef(onCreateAllDayRange)
  onDayClickRef.current = onDayClick
  onCreateAllDayRef.current = onCreateAllDayRange

  const cells = useMemo(() => buildCells(year, month), [year, month])
  const weeks = useMemo(() => {
    const rows: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cells])
  const todayKey = toDateKey(new Date())

  const selection =
    dragStart && dragEnd
      ? {
          start: dragStart < dragEnd ? dragStart : dragEnd,
          end: dragStart < dragEnd ? dragEnd : dragStart,
        }
      : null

  const finish = () => {
    const startKey = dragStartRef.current
    const endKey = dragEndRef.current
    if (!startKey || !endKey) {
      setDragStart(null)
      setDragEnd(null)
      setRangeDragging(false)
      dragging.current = false
      crossedCells.current = false
      dragStartRef.current = null
      dragEndRef.current = null
      return
    }

    const start = startKey < endKey ? startKey : endKey
    const end = startKey < endKey ? endKey : startKey
    const wasCross = crossedCells.current

    setDragStart(null)
    setDragEnd(null)
    setRangeDragging(false)
    dragging.current = false
    crossedCells.current = false
    dragStartRef.current = null
    dragEndRef.current = null

    if (!wasCross && start === end) {
      onDayClickRef.current(start)
      return
    }
    onCreateAllDayRef.current(start, end)
  }

  useEffect(() => {
    const onUp = () => {
      if (dragging.current) finish()
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const label = `${year}년 ${month + 1}월`

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white select-none">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            const d = new Date(year, month - 1, 1)
            onMonthChange(d.getFullYear(), d.getMonth())
          }}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <button
          type="button"
          onClick={() => {
            const d = new Date(year, month + 1, 1)
            onMonthChange(d.getFullYear(), d.getMonth())
          }}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-[11px] font-semibold ${
              i === 0 ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {weeks.map((week, wi) => {
          const weekKeys = week.map((c) => c.key)
          const segments = segmentsForWeek(
            weekKeys,
            events,
            selection && rangeDragging ? selection : null,
          )
          const laneCount = Math.min(
            MAX_LANES,
            segments.reduce((m, s) => Math.max(m, s.lane + 1), 0),
          )
          const hiddenByDay = weekKeys.map((key) => {
            const daySegs = segments.filter(
              (s) =>
                !s.ghost &&
                s.lane >= MAX_LANES &&
                key >= weekKeys[s.startCol] &&
                key <= weekKeys[s.endCol],
            )
            return daySegs.length
          })

          return (
            <div
              key={wi}
              className="relative min-h-0 flex-1 border-b border-slate-100 last:border-b-0"
            >
              {/* hit targets */}
              <div className="absolute inset-0 z-0 grid grid-cols-7">
                {week.map((cell) => {
                  const inSel =
                    !!selection &&
                    rangeDragging &&
                    cell.key >= selection.start &&
                    cell.key <= selection.end
                  return (
                    <div
                      key={cell.key}
                      data-date={cell.key}
                      className={`border-r border-slate-100 last:border-r-0 ${
                        cell.inMonth ? 'bg-white' : 'bg-slate-50/50'
                      } ${inSel ? 'bg-sky-100/70' : ''} cursor-pointer`}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return
                        e.preventDefault()
                        onSelectDate?.(cell.key)
                        dragging.current = true
                        crossedCells.current = false
                        dragStartRef.current = cell.key
                        dragEndRef.current = cell.key
                        setRangeDragging(false)
                        setDragStart(cell.key)
                        setDragEnd(cell.key)
                      }}
                      onMouseEnter={() => {
                        if (!dragging.current || !dragStartRef.current) return
                        if (cell.key !== dragStartRef.current) {
                          crossedCells.current = true
                          setRangeDragging(true)
                        }
                        dragEndRef.current = cell.key
                        setDragEnd(cell.key)
                      }}
                    />
                  )
                })}
              </div>

              {/* date numbers */}
              <div className="pointer-events-none relative z-10 grid grid-cols-7 px-0.5 pt-1">
                {week.map((cell) => {
                  const dayNum = Number(cell.key.slice(8))
                  const isSun =
                    weekKeys.indexOf(cell.key) === 0
                  return (
                    <div key={cell.key} className="flex justify-start px-1">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          cell.key === todayKey
                            ? 'bg-blue-500 text-white'
                            : selectedDate === cell.key && cell.inMonth
                              ? 'bg-slate-900 text-white'
                              : !cell.inMonth
                                ? 'text-slate-300'
                                : isSun
                                  ? 'text-rose-500'
                                  : 'text-slate-700'
                        }`}
                      >
                        {dayNum}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* continuous bars */}
              <div
                className="pointer-events-none relative z-10 mx-0.5 mt-0.5"
                style={{
                  height: Math.max(laneCount, 1) * (BAR_H + BAR_GAP),
                }}
              >
                {segments
                  .filter((s) => s.lane < MAX_LANES)
                  .map((seg) => {
                    const tone = toneOf(seg.color)
                    const left = (seg.startCol / 7) * 100
                    const width = ((seg.endCol - seg.startCol + 1) / 7) * 100
                    const radius = [
                      seg.isStart ? '6px' : '0',
                      seg.isEnd ? '6px' : '0',
                      seg.isEnd ? '6px' : '0',
                      seg.isStart ? '6px' : '0',
                    ].join(' ')

                    if (seg.ghost) {
                      return (
                        <div
                          key={`${seg.id}-${seg.startCol}`}
                          className="pointer-events-none absolute px-0.5"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: seg.lane * (BAR_H + BAR_GAP),
                            height: BAR_H,
                          }}
                        >
                          <div
                            className="flex h-full items-center truncate px-1.5 text-[10px] font-semibold text-white shadow-sm"
                            style={{
                              background: tone.solid,
                              borderRadius: radius,
                              opacity: 0.85,
                            }}
                          >
                            {seg.title}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={`${seg.id}-${seg.startCol}`}
                        className="absolute px-0.5"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: seg.lane * (BAR_H + BAR_GAP),
                          height: BAR_H,
                        }}
                      >
                        <button
                          type="button"
                          title="클릭하여 수정"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            const event = events.find((ev) => ev.id === seg.id)
                            if (event) onSelectEvent(event)
                          }}
                          className="pointer-events-auto flex h-full w-full items-center truncate px-1.5 text-left text-[10px] font-semibold text-white transition hover:brightness-110"
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

              {/* timed events + more */}
              <div className="pointer-events-none relative z-10 grid min-h-0 flex-1 grid-cols-7 px-0.5 pb-1">
                {week.map((cell, di) => {
                  const daySchedules = cell.inMonth
                    ? schedulesOnDate(schedules, cell.key)
                    : []
                  const more = hiddenByDay[di]
                  return (
                    <div
                      key={cell.key}
                      className="min-h-0 space-y-0.5 overflow-hidden px-0.5"
                    >
                      {daySchedules.slice(0, 2).map((schedule) => {
                        const tone = toneOf(schedule.color)
                        return (
                          <button
                            key={`${schedule.id}-${cell.key}`}
                            type="button"
                            title="클릭하여 수정"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectSchedule?.(schedule)
                            }}
                            className="pointer-events-auto flex w-full items-center gap-1 truncate text-left text-[10px] font-semibold"
                            style={{ color: tone.text }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: tone.solid }}
                            />
                            <span className="truncate">
                              {schedule.start} {schedule.title}
                            </span>
                          </button>
                        )
                      })}
                      {(more > 0 || daySchedules.length > 2) && (
                        <p className="px-0.5 text-[10px] font-medium text-slate-400">
                          +{more + Math.max(0, daySchedules.length - 2)} more
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {selection && rangeDragging && (
        <p className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-400">
          {selection.start} ~ {selection.end} (
          {dayDiffInclusive(selection.start, selection.end)}일)
        </p>
      )}
    </div>
  )
}
