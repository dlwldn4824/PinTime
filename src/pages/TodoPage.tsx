import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCalendar } from '../context/CalendarContext'
import { syncCalendarTodos } from '../lib/scheduleTodos'
import {
  createTodo,
  isCalendarTodo,
  loadTodos,
  saveTodos,
  type TodoItem,
} from '../lib/todos'
import { addDays, parseDateKey, toDateKey } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDayLabel(dateKey: string) {
  const [, m, d] = dateKey.split('-').map(Number)
  const today = toDateKey(new Date())
  if (dateKey === today) return '오늘'
  if (dateKey === addDays(today, 1)) return '내일'
  if (dateKey === addDays(today, -1)) return '어제'
  return `${m}월 ${d}일`
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number; inMonth: boolean; wd: number }> =
    []
  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, 1 - (startPad - i))
    cells.push({
      key: toDateKey(d),
      day: d.getDate(),
      inMonth: false,
      wd: d.getDay(),
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day)
    cells.push({ key: toDateKey(d), day, inMonth: true, wd: d.getDay() })
  }
  while (cells.length % 7 !== 0) {
    const last = parseDateKey(cells[cells.length - 1].key)
    last.setDate(last.getDate() + 1)
    cells.push({
      key: toDateKey(last),
      day: last.getDate(),
      inMonth: false,
      wd: last.getDay(),
    })
  }
  return cells
}

function displayText(item: TodoItem): { title: string; meta?: string } {
  if (!isCalendarTodo(item)) return { title: item.text }
  const m = item.text.match(/^(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})\s+(.+)$/)
  if (m) return { title: m[3], meta: `${m[1]}–${m[2]}` }
  if (item.source === 'allDay') return { title: item.text, meta: '종일' }
  return { title: item.text }
}

function TodoRow({
  item,
  onToggle,
  onRemove,
}: {
  item: TodoItem
  onToggle: () => void
  onRemove: () => void
}) {
  const fromCal = isCalendarTodo(item)
  const { title, meta } = displayText(item)

  return (
    <li className="group flex items-start gap-2.5 rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          item.done
            ? 'border-[var(--tomato)] bg-[var(--tomato)] text-white'
            : 'border-slate-300 bg-white hover:border-[var(--tomato)]'
        }`}
        aria-label={item.done ? '완료 취소' : '완료'}
      >
        {item.done && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {fromCal && (
            <span className="rounded-md bg-[var(--main-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--pin-text)]">
              일정
            </span>
          )}
          {meta && (
            <span className="text-[10px] font-semibold tabular-nums text-[var(--muted)]">
              {meta}
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 text-sm leading-snug ${
            item.done
              ? 'text-slate-400 line-through'
              : 'font-medium text-[var(--ink)]'
          }`}
        >
          {title}
        </p>
      </div>
      {!fromCal && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          aria-label="삭제"
        >
          <Trash2 size={14} />
        </button>
      )}
    </li>
  )
}

export function TodoPage() {
  const { schedules, allDay } = useCalendar()
  const [items, setItems] = useState<TodoItem[]>(() => loadTodos().items)
  const [dayKey, setDayKey] = useState(() => toDateKey(new Date()))
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [draft, setDraft] = useState('')
  const [standingDraft, setStandingDraft] = useState('')

  useEffect(() => {
    syncCalendarTodos(schedules, allDay)
    setItems(loadTodos().items)
  }, [schedules, allDay])

  useEffect(() => {
    const refresh = () => setItems(loadTodos().items)
    window.addEventListener('pintime:todos', refresh)
    return () => window.removeEventListener('pintime:todos', refresh)
  }, [])

  const persist = (next: TodoItem[]) => {
    setItems(next)
    saveTodos({ items: next })
  }

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )
  const todayKey = toDateKey(new Date())

  const statsByDate = useMemo(() => {
    const map = new Map<string, { open: number; done: number }>()
    for (const t of items) {
      if (t.kind !== 'daily' || !t.date) continue
      const cur = map.get(t.date) ?? { open: 0, done: 0 }
      if (t.done) cur.done += 1
      else cur.open += 1
      map.set(t.date, cur)
    }
    return map
  }, [items])

  const dayItems = useMemo(
    () =>
      items
        .filter((t) => t.kind === 'daily' && t.date === dayKey)
        .sort((a, b) => {
          const ad = Number(a.done) - Number(b.done)
          if (ad !== 0) return ad
          const ac = isCalendarTodo(a) ? 0 : 1
          const bc = isCalendarTodo(b) ? 0 : 1
          if (ac !== bc) return ac - bc
          return a.text.localeCompare(b.text, 'ko')
        }),
    [items, dayKey],
  )

  const standing = useMemo(
    () =>
      items
        .filter((t) => t.kind === 'standing')
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) || a.createdAt - b.createdAt,
        ),
    [items],
  )

  const openCount = dayItems.filter((t) => !t.done).length
  const doneCount = dayItems.filter((t) => t.done).length

  const selectDay = (key: string) => {
    setDayKey(key)
    const [y, m] = key.split('-').map(Number)
    if (Number.isFinite(y) && Number.isFinite(m)) {
      setCursor({ year: y, month: m - 1 })
    }
  }

  const toggle = (id: string) => {
    persist(items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const remove = (id: string) => {
    const t = items.find((x) => x.id === id)
    if (t && isCalendarTodo(t)) return
    persist(items.filter((x) => x.id !== id))
  }

  const addDaily = () => {
    if (!draft.trim()) return
    persist([
      ...items,
      createTodo({ text: draft, kind: 'daily', date: dayKey }),
    ])
    setDraft('')
  }

  const addStanding = () => {
    if (!standingDraft.trim()) return
    persist([
      ...items,
      createTodo({ text: standingDraft, kind: 'standing' }),
    ])
    setStandingDraft('')
  }

  const monthLabel = `${cursor.year}년 ${cursor.month + 1}월`

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] pt-scroll">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 pb-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--main)] text-[var(--pin-text)]">
              <CalendarDays size={20} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[var(--ink)]">할 일</h1>
              <p className="text-xs text-[var(--muted)]">
                날짜에 할 일을 두고, 캘린더 일정도 함께 보여요
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--main-soft)]"
          >
            캘린더
          </Link>
        </header>

        {/* 큰 화면: 달력 | 할 일 · 작은 화면: 달력 → 할 일 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(cursor.year, cursor.month - 1, 1)
                  setCursor({ year: d.getFullYear(), month: d.getMonth() })
                }}
                className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--bg)]"
                aria-label="이전 달"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--ink)]">
                  {monthLabel}
                </p>
                <button
                  type="button"
                  onClick={() => selectDay(todayKey)}
                  className="mt-0.5 text-[10px] font-semibold text-[var(--tomato)] hover:underline"
                >
                  오늘
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(cursor.year, cursor.month + 1, 1)
                  setCursor({ year: d.getFullYear(), month: d.getMonth() })
                }}
                className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--bg)]"
                aria-label="다음 달"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-[var(--muted)]">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`py-1 ${
                    i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-500' : ''
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const stats = statsByDate.get(cell.key)
                const selected = cell.key === dayKey
                const isToday = cell.key === todayKey
                const open = stats?.open ?? 0
                const done = stats?.done ?? 0
                const has = open + done > 0

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => selectDay(cell.key)}
                    className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl px-0.5 py-1 transition lg:min-h-[52px] ${
                      selected
                        ? 'bg-[var(--tomato)] text-white shadow-sm'
                        : 'hover:bg-[var(--bg)]'
                    } ${!cell.inMonth ? 'opacity-30' : ''}`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        selected
                          ? 'text-white'
                          : isToday
                            ? 'text-[var(--tomato)]'
                            : cell.wd === 0
                              ? 'text-rose-500'
                              : cell.wd === 6
                                ? 'text-sky-500'
                                : 'text-[var(--ink)]'
                      }`}
                    >
                      {cell.day}
                    </span>
                    {has && (
                      <span className="mt-0.5 flex items-center gap-0.5">
                        {open > 0 && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              selected ? 'bg-white' : 'bg-[var(--tomato)]'
                            }`}
                          />
                        )}
                        {open === 0 && done > 0 && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              selected
                                ? 'bg-white/80'
                                : 'bg-[var(--main-deep)]'
                            }`}
                          />
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink)]">
                    {formatDayLabel(dayKey)}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {dayKey}
                  </p>
                </div>
                {(openCount > 0 || doneCount > 0) && (
                  <span className="shrink-0 rounded-full bg-[var(--main-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--pin-text)]">
                    {openCount}남음
                    {doneCount > 0 ? ` · ${doneCount}완료` : ''}
                  </span>
                )}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  addDaily()
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="이 날짜에 할 일 추가"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--tomato)] focus:bg-white focus:ring-2 focus:ring-[var(--tomato-soft)]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--tomato)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--tomato-deep)] disabled:opacity-40"
                >
                  <Plus size={16} />
                  추가
                </button>
              </form>

              <ul className="mt-3 max-h-[min(52vh,420px)] space-y-2 overflow-y-auto lg:max-h-[min(60vh,520px)]">
                {dayItems.length === 0 && (
                  <li className="rounded-xl bg-[var(--bg)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
                    비어 있어요. 할 일을 추가하거나{' '}
                    <Link
                      to="/"
                      className="font-semibold text-[var(--tomato)]"
                    >
                      캘린더
                    </Link>
                    에 일정을 넣어 보세요.
                  </li>
                )}
                {dayItems.map((item) => (
                  <TodoRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggle(item.id)}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--ink)]">상시</h2>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                날짜와 관계없이 항상 보이는 목록
              </p>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  addStanding()
                }}
              >
                <input
                  value={standingDraft}
                  onChange={(e) => setStandingDraft(e.target.value)}
                  placeholder="상시 할 일"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--tomato)] focus:bg-white focus:ring-2 focus:ring-[var(--tomato-soft)]"
                />
                <button
                  type="submit"
                  disabled={!standingDraft.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-40"
                >
                  <Plus size={16} />
                  추가
                </button>
              </form>

              <ul className="mt-3 space-y-2">
                {standing.length === 0 && (
                  <li className="rounded-xl bg-[var(--bg)] px-3 py-3 text-center text-[11px] text-[var(--muted)]">
                    상시 항목 없음
                  </li>
                )}
                {standing.map((item) => (
                  <TodoRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggle(item.id)}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
