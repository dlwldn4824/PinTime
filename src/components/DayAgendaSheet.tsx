import { Check, GripVertical, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applyCustomOrder,
  orderIdsForDate,
  saveDayAgendaOrder,
} from '../lib/dayAgendaOrder'
import { toneOf } from '../lib/eventColors'
import {
  expandSchedulesInRange,
  type ScheduleOccurrence,
} from '../lib/recurrence'
import {
  createTodo,
  loadTodos,
  saveTodos,
  toggleTodoDone,
  type TodoItem,
} from '../lib/todos'
import {
  type AllDayEvent,
  type Schedule,
  parseDateKey,
  weekdayOfDateKey,
} from '../types'

type DayAgendaSheetProps = {
  open: boolean
  date: string
  schedules: Schedule[]
  allDay: AllDayEvent[]
  onClose: () => void
  onAdd: () => void
  onSelectSchedule: (schedule: Schedule) => void
  onSelectAllDay: (event: AllDayEvent) => void
}

type AgendaRow =
  | { kind: 'allday'; key: string; event: AllDayEvent }
  | { kind: 'timed'; key: string; occurrence: ScheduleOccurrence }

function formatDateKo(dateKey: string) {
  const d = parseDateKey(dateKey)
  const day = weekdayOfDateKey(dateKey)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`
}

function timeSortRows(a: AgendaRow, b: AgendaRow) {
  if (a.kind !== b.kind) return a.kind === 'allday' ? -1 : 1
  if (a.kind === 'allday' && b.kind === 'allday') {
    return a.event.title.localeCompare(b.event.title)
  }
  if (a.kind === 'timed' && b.kind === 'timed') {
    return a.occurrence.start.localeCompare(b.occurrence.start)
  }
  return 0
}

export function DayAgendaSheet({
  open,
  date,
  schedules,
  allDay,
  onClose,
  onAdd,
  onSelectSchedule,
  onSelectAllDay,
}: DayAgendaSheetProps) {
  const [todos, setTodos] = useState<TodoItem[]>(() => loadTodos().items)
  const [todoDraft, setTodoDraft] = useState('')
  const [orderTick, setOrderTick] = useState(0)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTodos(loadTodos().items)
    setTodoDraft('')
    setDragKey(null)
    setOverKey(null)
  }, [open, date])

  useEffect(() => {
    const refresh = () => setTodos(loadTodos().items)
    window.addEventListener('pintime:todos', refresh)
    return () => window.removeEventListener('pintime:todos', refresh)
  }, [])

  const agendaRows = useMemo(() => {
    const timed = expandSchedulesInRange(schedules, date, date)
    const dayEvents = allDay.filter(
      (e) => e.startDate <= date && e.endDate >= date,
    )
    const base: AgendaRow[] = [
      ...dayEvents.map(
        (event): AgendaRow => ({
          kind: 'allday',
          key: `allday:${event.id}`,
          event,
        }),
      ),
      ...timed.map(
        (occurrence): AgendaRow => ({
          kind: 'timed',
          key: `timed:${occurrence.occurrenceId}`,
          occurrence,
        }),
      ),
    ].sort(timeSortRows)

    void orderTick
    const custom = orderIdsForDate(date)
    return applyCustomOrder(base, (row) => row.key, custom)
  }, [schedules, allDay, date, orderTick])

  if (!open) return null

  const scheduleEmpty = agendaRows.length === 0

  const addDayTodo = () => {
    const text = todoDraft.trim()
    if (!text) return
    const next = {
      items: [...loadTodos().items, createTodo({ text, kind: 'daily', date })],
    }
    saveTodos(next)
    setTodos(next.items)
    setTodoDraft('')
  }

  const dayTodos = (() => {
    const daily = todos.filter((t) => t.kind === 'daily' && t.date === date)
    const standing = todos.filter((t) => t.kind === 'standing')
    return [...daily, ...standing].sort(
      (a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt,
    )
  })()

  const moveRow = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    const ids = agendaRows.map((r) => r.key)
    const from = ids.indexOf(fromKey)
    const to = ids.indexOf(toKey)
    if (from < 0 || to < 0) return
    const next = [...ids]
    const [picked] = next.splice(from, 1)
    next.splice(to, 0, picked)
    saveDayAgendaOrder(date, next)
    setOrderTick((n) => n + 1)
  }

  const resetTimeOrder = () => {
    saveDayAgendaOrder(date, [])
    setOrderTick((n) => n + 1)
  }

  const hasCustomOrder = (orderIdsForDate(date)?.length ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 px-3 pb-3 backdrop-blur-[2px] sm:items-center sm:pb-0"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[min(82dvh,620px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl shadow-slate-900/15"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
              이날의 일정 · 할 일
            </p>
            <h2 className="mt-0.5 text-base font-bold text-[var(--ink)]">
              {formatDateKo(date)}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--tomato)] px-3 py-2 text-xs font-bold text-white transition hover:bg-[var(--tomato-deep)]"
            >
              <Plus size={14} strokeWidth={2.5} />
              일정
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="pt-scroll min-h-0 flex-1 overflow-auto px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
              일정
            </p>
            {hasCustomOrder ? (
              <button
                type="button"
                onClick={resetTimeOrder}
                className="text-[10px] font-semibold text-[var(--tomato)] hover:underline"
              >
                시간순으로
              </button>
            ) : (
              <span className="text-[10px] text-slate-400">
                ⋮⋮ 잡고 순서 변경
              </span>
            )}
          </div>

          {scheduleEmpty ? (
            <div className="mb-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-600">
                등록된 일정이 없어요
              </p>
              <button
                type="button"
                onClick={onAdd}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--tomato)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--tomato-deep)]"
              >
                <Plus size={14} />
                일정 추가
              </button>
            </div>
          ) : (
            <ul className="mb-4 space-y-2">
              {agendaRows.map((row) => {
                const tone =
                  row.kind === 'allday'
                    ? toneOf(row.event.color)
                    : toneOf(row.occurrence.color)
                const isOver = overKey === row.key && dragKey !== row.key
                return (
                  <li
                    key={row.key}
                    draggable
                    onDragStart={(e) => {
                      setDragKey(row.key)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', row.key)
                    }}
                    onDragEnd={() => {
                      setDragKey(null)
                      setOverKey(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (overKey !== row.key) setOverKey(row.key)
                    }}
                    onDragLeave={() => {
                      if (overKey === row.key) setOverKey(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from =
                        e.dataTransfer.getData('text/plain') || dragKey
                      if (from) moveRow(from, row.key)
                      setDragKey(null)
                      setOverKey(null)
                    }}
                    className={`rounded-xl transition ${
                      dragKey === row.key ? 'opacity-50' : ''
                    } ${isOver ? 'ring-2 ring-[var(--tomato)]/40' : ''}`}
                  >
                    <div
                      className="flex w-full items-start gap-1.5 rounded-xl px-2 py-2.5 text-left"
                      style={{ background: `${tone.solid}18` }}
                    >
                      <button
                        type="button"
                        className="mt-1 shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 active:cursor-grabbing"
                        aria-label="순서 바꾸기"
                        title="드래그해서 순서 바꾸기"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (row.kind === 'allday') {
                            onSelectAllDay(row.event)
                            return
                          }
                          const master =
                            schedules.find((x) => x.id === row.occurrence.id) ??
                            (row.occurrence as Schedule)
                          onSelectSchedule(master)
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left transition hover:brightness-[0.98]"
                      >
                        <span
                          className="mt-1 h-8 w-1 shrink-0 rounded-full"
                          style={{ background: tone.solid }}
                        />
                        <div className="min-w-0 flex-1">
                          {row.kind === 'allday' ? (
                            <>
                              <p className="text-[10px] font-semibold text-slate-500">
                                하루 종일
                                {row.event.startDate !== row.event.endDate
                                  ? ` · ${row.event.startDate} – ${row.event.endDate}`
                                  : ''}
                              </p>
                              <p
                                className="truncate text-sm font-bold"
                                style={{ color: tone.text }}
                              >
                                {row.event.title}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[10px] font-semibold text-slate-500">
                                {row.occurrence.start} – {row.occurrence.end}
                              </p>
                              <p
                                className="truncate text-sm font-bold"
                                style={{ color: tone.text }}
                              >
                                {row.occurrence.title}
                              </p>
                              {row.occurrence.location && (
                                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                  {row.occurrence.location}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
              할 일
            </p>
            <Link
              to="/todo"
              onClick={onClose}
              className="text-[10px] font-semibold text-[var(--tomato)] hover:underline"
            >
              전체 보기
            </Link>
          </div>

          <form
            className="mb-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addDayTodo()
            }}
          >
            <input
              value={todoDraft}
              onChange={(e) => setTodoDraft(e.target.value)}
              placeholder="이 날 할 일 추가"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[var(--tomato)] focus:bg-white focus:ring-2 focus:ring-[var(--tomato-soft)]"
            />
            <button
              type="submit"
              disabled={!todoDraft.trim()}
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              추가
            </button>
          </form>

          <ul className="space-y-1.5">
            {dayTodos.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => setTodos(toggleTodoDone(item.id).items)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    item.done
                      ? 'border-[var(--tomato)] bg-[var(--tomato)] text-white'
                      : 'border-slate-300 hover:border-[var(--tomato)]'
                  }`}
                  aria-label={item.done ? '완료 취소' : '완료'}
                >
                  {item.done && <Check size={12} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold tracking-wide text-slate-400 uppercase">
                    {item.kind === 'standing' ? '상시' : '이날'}
                  </p>
                  <p
                    className={`text-sm leading-snug ${
                      item.done
                        ? 'text-slate-400 line-through'
                        : 'font-medium text-[var(--ink)]'
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
