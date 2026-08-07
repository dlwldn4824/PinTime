import {
  Check,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  Plus,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCalendar } from '../context/CalendarContext'
import {
  loadTodos,
  toggleTodoDone,
  type TodoItem,
} from '../lib/todos'
import { toDateKey } from '../types'
import { MainNav } from './MainNav'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
    cells.push({
      key: toDateKey(new Date(year, month, day)),
      day,
      inMonth: true,
    })
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(
      year,
      month,
      daysInMonth + (cells.length - startPad - daysInMonth + 1),
    )
    cells.push({ key: toDateKey(last), day: last.getDate(), inMonth: false })
  }
  return cells
}

function SidebarTodoRow({
  item,
  onToggle,
}: {
  item: TodoItem
  onToggle: () => void
}) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-[var(--sidebar-elevated)] px-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
          item.done
            ? 'border-[var(--tomato)] bg-[var(--tomato)] text-white'
            : 'border-white/25 hover:border-white/50'
        }`}
        aria-label={item.done ? '완료 취소' : '완료'}
      >
        {item.done && <Check size={10} strokeWidth={3} />}
      </button>
      <p
        className={`min-w-0 flex-1 truncate text-xs font-semibold ${
          item.done ? 'text-white/35 line-through' : 'text-white/95'
        }`}
      >
        {item.text}
      </p>
    </li>
  )
}

export function AppSidebar({
  onCollapse,
}: {
  onCollapse?: () => void
}) {
  const { selectedDate, goToDate, monthCursor } = useCalendar()
  const navigate = useNavigate()
  const now = new Date()
  const [cursor, setCursor] = useState({
    year: monthCursor.year,
    month: monthCursor.month,
  })
  const [todos, setTodos] = useState<TodoItem[]>(() => loadTodos().items)

  useEffect(() => {
    setCursor({ year: monthCursor.year, month: monthCursor.month })
  }, [monthCursor.year, monthCursor.month])

  useEffect(() => {
    const refresh = () => setTodos(loadTodos().items)
    window.addEventListener('pintime:todos', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('pintime:todos', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

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

  const standingOpen = useMemo(
    () =>
      todos
        .filter((t) => t.kind === 'standing' && !t.done)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 6),
    [todos],
  )
  const dailyOpen = useMemo(
    () =>
      todos
        .filter((t) => t.kind === 'daily' && t.date === todayKey && !t.done)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 8),
    [todos, todayKey],
  )
  const empty = standingOpen.length === 0 && dailyOpen.length === 0

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
              className="rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white"
              aria-label="이전 달"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => openDate(todayKey)}
              className="rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white"
              title="오늘로 이동"
              aria-label="오늘로 이동"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(cursor.year, cursor.month + 1, 1)
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
              className="rounded-lg p-1 text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white"
              aria-label="다음 달"
            >
              <ChevronRight size={14} />
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--sidebar-muted)] uppercase">
            할 일
          </p>
          <Link
            to="/todo"
            className="text-[10px] font-semibold text-[var(--main)] hover:underline"
          >
            전체 보기
          </Link>
        </div>

        <p className="mb-1.5 text-[10px] font-bold text-[var(--sidebar-muted)]">
          오늘 할 일
        </p>
        <ul className="mb-4 space-y-1.5">
          {dailyOpen.length === 0 && (
            <li className="rounded-xl bg-[var(--sidebar-elevated)] px-3 py-2.5 text-[11px] text-[var(--sidebar-muted)]">
              오늘 할 일이 없어요
            </li>
          )}
          {dailyOpen.map((t) => (
            <SidebarTodoRow
              key={t.id}
              item={t}
              onToggle={() => setTodos(toggleTodoDone(t.id).items)}
            />
          ))}
        </ul>

        <p className="mb-1.5 text-[10px] font-bold text-[var(--sidebar-muted)]">
          상시 할 일
        </p>
        <ul className="space-y-1.5">
          {standingOpen.length === 0 && (
            <li className="rounded-xl bg-[var(--sidebar-elevated)] px-3 py-2.5 text-[11px] text-[var(--sidebar-muted)]">
              상시 할 일이 없어요
            </li>
          )}
          {standingOpen.map((t) => (
            <SidebarTodoRow
              key={t.id}
              item={t}
              onToggle={() => setTodos(toggleTodoDone(t.id).items)}
            />
          ))}
        </ul>

        {empty && (
          <Link
            to="/todo"
            className="mt-3 block text-center text-[11px] font-semibold text-[var(--main)] hover:underline"
          >
            할 일 추가하기
          </Link>
        )}
      </div>
    </aside>
  )
}
