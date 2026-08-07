import { Check, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toneOf } from '../lib/eventColors'
import { expandSchedulesInRange } from '../lib/recurrence'
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

function formatDateKo(dateKey: string) {
  const d = parseDateKey(dateKey)
  const day = weekdayOfDateKey(dateKey)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`
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

  useEffect(() => {
    if (!open) return
    setTodos(loadTodos().items)
    setTodoDraft('')
  }, [open, date])

  useEffect(() => {
    const refresh = () => setTodos(loadTodos().items)
    window.addEventListener('pintime:todos', refresh)
    return () => window.removeEventListener('pintime:todos', refresh)
  }, [])

  const timed = useMemo(
    () =>
      expandSchedulesInRange(schedules, date, date).sort(
        (a, b) => a.start.localeCompare(b.start),
      ),
    [schedules, date],
  )

  const days = useMemo(
    () =>
      allDay
        .filter((e) => e.startDate <= date && e.endDate >= date)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [allDay, date],
  )

  const dayTodos = useMemo(() => {
    const daily = todos.filter((t) => t.kind === 'daily' && t.date === date)
    const standing = todos.filter((t) => t.kind === 'standing')
    return [...daily, ...standing].sort(
      (a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt,
    )
  }, [todos, date])

  if (!open) return null

  const scheduleEmpty = timed.length === 0 && days.length === 0

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
          {/* 일정 */}
          <p className="mb-2 px-0.5 text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
            일정
          </p>
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
              {days.map((e) => {
                const tone = toneOf(e.color)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelectAllDay(e)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-[0.98]"
                      style={{ background: `${tone.solid}18` }}
                    >
                      <span
                        className="mt-1 h-8 w-1 shrink-0 rounded-full"
                        style={{ background: tone.solid }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          하루 종일
                          {e.startDate !== e.endDate
                            ? ` · ${e.startDate} – ${e.endDate}`
                            : ''}
                        </p>
                        <p
                          className="truncate text-sm font-bold"
                          style={{ color: tone.text }}
                        >
                          {e.title}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
              {timed.map((s) => {
                const tone = toneOf(s.color)
                const master =
                  schedules.find((x) => x.id === s.id) ?? (s as Schedule)
                return (
                  <li key={s.occurrenceId}>
                    <button
                      type="button"
                      onClick={() => onSelectSchedule(master)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-[0.98]"
                      style={{ background: `${tone.solid}18` }}
                    >
                      <span
                        className="mt-1 h-8 w-1 shrink-0 rounded-full"
                        style={{ background: tone.solid }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          {s.start} – {s.end}
                        </p>
                        <p
                          className="truncate text-sm font-bold"
                          style={{ color: tone.text }}
                        >
                          {s.title}
                        </p>
                        {s.location && (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {s.location}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* 할 일 */}
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
            {dayTodos.length === 0 && (
              <li className="rounded-xl bg-[var(--bg)] px-3 py-3 text-center text-[11px] text-[var(--muted)]">
                이 날 할 일과 상시 할 일이 없어요
              </li>
            )}
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
