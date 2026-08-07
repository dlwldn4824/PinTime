import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  Plus,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCalendar } from '../context/CalendarContext'
import { expandSchedulesInRange } from '../lib/recurrence'
import { parseHour, toDateKey } from '../types'
import { MainNav } from './MainNav'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const EVENT_TONES = [
  { bar: '#3b82f6', soft: 'rgba(59,130,246,0.18)' },
  { bar: '#0ea5e9', soft: 'rgba(14,165,233,0.18)' },
  { bar: '#14b8a6', soft: 'rgba(20,184,166,0.18)' },
  { bar: '#f59e0b', soft: 'rgba(245,158,11,0.2)' },
]

function toneFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i)) % EVENT_TONES.length
  return EVENT_TONES[h]
}

function buildMiniCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number; inMonth: boolean }> = []
  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, 1 - (startPad - i))
    cells.push({ key: toDateKey(d), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: toDateKey(new Date(year, month, day)), day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(year, month, daysInMonth + (cells.length - startPad - daysInMonth + 1))
    cells.push({ key: toDateKey(last), day: last.getDate(), inMonth: false })
  }
  return cells
}

export function AppSidebar({
  onCollapse,
}: {
  onCollapse?: () => void
}) {
  const { schedules, allDay, selectedDate, goToDate, monthCursor } =
    useCalendar()
  const navigate = useNavigate()
  const now = new Date()
  const [cursor, setCursor] = useState({
    year: monthCursor.year,
    month: monthCursor.month,
  })

  useEffect(() => {
    setCursor({ year: monthCursor.year, month: monthCursor.month })
  }, [monthCursor.year, monthCursor.month])

  const todayKey = toDateKey(now)
  const cells = useMemo(
    () => buildMiniCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  const openDate = (dateKey: string) => {
    goToDate(dateKey)
    try {
      sessionStorage.setItem('pintime:openDay', dateKey)
    } catch {
      /* ignore */
    }
    navigate('/calendar')
  }

  const agenda = useMemo(() => {
    const now = new Date()
    const js = now.getDay()
    const monday = new Date(now)
    monday.setHours(12, 0, 0, 0)
    monday.setDate(now.getDate() + (js === 0 ? -6 : 1 - js))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const weekStart = toDateKey(monday)
    const weekEnd = toDateKey(sunday)

    const weekItems = expandSchedulesInRange(schedules, weekStart, weekEnd)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        return parseHour(a.start) - parseHour(b.start)
      })
      .slice(0, 8)

    const trips = [...allDay]
      .filter((e) => e.endDate >= weekStart && e.startDate <= weekEnd)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
      .slice(0, 4)

    return { weekItems, trips, weekStart, weekEnd }
  }, [schedules, allDay])

  const monthLabel = `${cursor.year}년 ${cursor.month + 1}월`

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col bg-[var(--sidebar)] text-white">
      <div className="flex items-start gap-2 px-3 pt-4 pb-3">
        <Link
          to="/"
          className="flex min-w-0 flex-1 items-center gap-3 px-2 transition hover:opacity-90"
          aria-label="홈으로 이동"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--main)] text-sm font-bold text-[var(--pin-text)] shadow-lg shadow-[var(--main)]/30">
            P
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight">PinTime</p>
            <p className="text-[11px] text-[var(--sidebar-muted)]">핀타임</p>
          </div>
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="mt-0.5 rounded-xl p-2 text-[var(--sidebar-muted)] transition hover:bg-white/10 hover:text-white"
            title="사이드바 닫기"
            aria-label="사이드바 닫기"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <MainNav variant="sidebar" className="mx-3 mb-3" />

      <Link
        to="/me"
        className="mx-3 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold text-[var(--sidebar-muted)] transition hover:bg-white/10 hover:text-white"
      >
        <UserRound size={13} />
        마이페이지 · 테마
      </Link>

      <div className="mx-3 rounded-2xl bg-[var(--sidebar-elevated)] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-white/90">{monthLabel}</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const d = new Date(cursor.year, cursor.month - 1, 1)
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
              className="rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(cursor.year, cursor.month + 1, 1)
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
              className="rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-white"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => openDate(toDateKey(now))}
              className="ml-0.5 rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-white"
              title="오늘로 이동"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-medium text-[var(--sidebar-muted)]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const isToday = cell.key === todayKey
            const isSelected = cell.key === selectedDate
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => openDate(cell.key)}
                className="flex h-8 items-center justify-center rounded-lg hover:bg-white/5"
                title={`${cell.key}로 이동`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition ${
                    isSelected
                      ? 'bg-[var(--tomato)] text-white'
                      : isToday
                        ? 'bg-white/15 text-white ring-1 ring-[var(--main)]'
                        : cell.inMonth
                          ? 'text-white/85'
                          : 'text-white/25'
                  }`}
                >
                  {cell.day}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-scroll-dark pt-scroll mt-4 min-h-0 flex-1 overflow-auto px-4 pb-4">
        <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-[var(--sidebar-muted)] uppercase">
          This week
        </p>
        <ul className="space-y-2">
          {agenda.weekItems.length === 0 && (
            <li className="text-xs text-[var(--sidebar-muted)]">등록된 일정이 없어요</li>
          )}
          {agenda.weekItems.map((s) => {
            const tone = toneFor(s.id)
            return (
              <li
                key={s.occurrenceId}
                className="rounded-xl bg-[var(--sidebar-elevated)] px-3 py-2.5"
              >
                <div className="flex gap-2.5">
                  <span
                    className="mt-0.5 w-1 shrink-0 rounded-full"
                    style={{ background: tone.bar }}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-[var(--sidebar-muted)]">
                      {s.date
                        ? `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8, 10))} (${s.day}) · ${s.start}–${s.end}`
                        : `${s.day} · ${s.start}–${s.end}`}
                    </p>
                    <p className="truncate text-xs font-semibold text-white/95">
                      {s.title}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {agenda.trips.length > 0 && (
          <>
            <p className="mt-5 mb-2 text-[10px] font-bold tracking-[0.14em] text-[var(--sidebar-muted)] uppercase">
              All-day
            </p>
            <ul className="space-y-2">
              {agenda.trips.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl bg-[var(--pin)]/20 px-3 py-2.5 ring-1 ring-[var(--pin)]/30"
                >
                  <p className="text-xs font-semibold text-sky-100">{e.title}</p>
                  <p className="mt-0.5 text-[10px] text-sky-200/70">
                    {e.startDate} – {e.endDate}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}
