import { Check, ListTodo, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createTodo,
  loadTodos,
  saveTodos,
  type TodoItem,
  type TodoKind,
} from '../lib/todos'
import { addDays, toDateKey } from '../types'

function formatDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const today = toDateKey(new Date())
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)
  if (dateKey === today) return '오늘'
  if (dateKey === tomorrow) return '내일'
  if (dateKey === yesterday) return '어제'
  return `${y}년 ${m}월 ${d}일`
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
  return (
    <li className="group flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5">
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
      <p
        className={`min-w-0 flex-1 text-sm leading-snug ${
          item.done
            ? 'text-slate-400 line-through'
            : 'font-medium text-[var(--ink)]'
        }`}
      >
        {item.text}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-70 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
        aria-label="삭제"
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}

function TodoSection({
  title,
  hint,
  items,
  draft,
  onDraft,
  onAdd,
  onToggle,
  onRemove,
  placeholder,
}: {
  title: string
  hint: string
  items: TodoItem[]
  draft: string
  onDraft: (v: string) => void
  onAdd: () => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  placeholder: string
}) {
  const open = items.filter((t) => !t.done)
  const done = items.filter((t) => t.done)

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[var(--ink)]">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
            {hint}
          </p>
        </div>
        {(open.length > 0 || done.length > 0) && (
          <span className="shrink-0 rounded-full bg-[var(--main-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--pin-text)]">
            {open.length}남음
            {done.length > 0 ? ` · ${done.length}완료` : ''}
          </span>
        )}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
      >
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--tomato)] focus:bg-white focus:ring-2 focus:ring-[var(--tomato-soft)]"
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

      <ul className="mt-3 space-y-2">
        {items.length === 0 && (
          <li className="rounded-xl bg-[var(--bg)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
            아직 없어요. 위에서 추가해 보세요.
          </li>
        )}
        {open.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
        {done.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </ul>
    </section>
  )
}

export function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>(() => loadTodos().items)
  const [dayKey, setDayKey] = useState(() => toDateKey(new Date()))
  const [dailyDraft, setDailyDraft] = useState('')
  const [standingDraft, setStandingDraft] = useState('')

  useEffect(() => {
    saveTodos({ items })
  }, [items])

  const standing = useMemo(
    () =>
      items
        .filter((t) => t.kind === 'standing')
        .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt),
    [items],
  )

  const daily = useMemo(
    () =>
      items
        .filter((t) => t.kind === 'daily' && t.date === dayKey)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt),
    [items, dayKey],
  )

  const add = (kind: TodoKind) => {
    const text = kind === 'daily' ? dailyDraft : standingDraft
    if (!text.trim()) return
    setItems((prev) => [
      ...prev,
      createTodo({
        text,
        kind,
        date: kind === 'daily' ? dayKey : undefined,
      }),
    ])
    if (kind === 'daily') setDailyDraft('')
    else setStandingDraft('')
  }

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }

  const remove = (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] pt-scroll">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5 pb-8">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--main)] text-[var(--pin-text)]">
            <ListTodo size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--ink)]">할 일</h1>
            <p className="text-xs text-[var(--muted)]">
              오늘 할 일 · 계속 보이는 상시 할 일
            </p>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setDayKey(addDays(dayKey, -1))}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--ink)]">
              {formatDayLabel(dayKey)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">{dayKey}</p>
          </div>
          <button
            type="button"
            onClick={() => setDayKey(addDays(dayKey, 1))}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            ›
          </button>
        </div>

        <TodoSection
          title="일간 할 일"
          hint="선택한 날짜에만 보이는 목록입니다."
          items={daily}
          draft={dailyDraft}
          onDraft={setDailyDraft}
          onAdd={() => add('daily')}
          onToggle={toggle}
          onRemove={remove}
          placeholder="오늘 할 일 입력"
        />

        <TodoSection
          title="상시 할 일"
          hint="날짜와 상관없이 항상 위에 같이 보여 둡니다. (월간 할 일 아님)"
          items={standing}
          draft={standingDraft}
          onDraft={setStandingDraft}
          onAdd={() => add('standing')}
          onToggle={toggle}
          onRemove={remove}
          placeholder="계속 챙길 일 입력"
        />
      </div>
    </div>
  )
}
