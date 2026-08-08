import { createId } from '../types'

const TODO_KEY = 'pintime:todos:v1'

export type TodoKind = 'daily' | 'standing'

/** 캘린더에서 자동 등록된 할 일 */
export type TodoSource = 'schedule' | 'allDay'

export type TodoItem = {
  id: string
  text: string
  done: boolean
  kind: TodoKind
  /** daily만 — YYYY-MM-DD */
  date?: string
  createdAt: number
  /** 없으면 수동 추가 */
  source?: TodoSource
  /** schedule:occurrenceId | allDay:id@date */
  sourceKey?: string
}

export type TodoState = {
  items: TodoItem[]
}

export function loadTodos(): TodoState {
  try {
    const raw = localStorage.getItem(TODO_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw) as TodoState
    if (!Array.isArray(parsed.items)) return { items: [] }
    return {
      items: parsed.items.filter(
        (t) =>
          t &&
          typeof t.id === 'string' &&
          typeof t.text === 'string' &&
          (t.kind === 'daily' || t.kind === 'standing'),
      ),
    }
  } catch {
    return { items: [] }
  }
}

export function saveTodos(state: TodoState) {
  localStorage.setItem(TODO_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('pintime:todos'))
  void import('./cloudSync').then((m) => {
    if (m.isApplyingRemoteTodos()) return
    m.schedulePushTodos(state)
  })
}

export function toggleTodoDone(id: string): TodoState {
  const state = loadTodos()
  const next = {
    items: state.items.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t,
    ),
  }
  saveTodos(next)
  return next
}

export function createTodo(input: {
  text: string
  kind: TodoKind
  date?: string
  source?: TodoSource
  sourceKey?: string
}): TodoItem {
  return {
    id: createId(),
    text: input.text.trim(),
    done: false,
    kind: input.kind,
    date: input.kind === 'daily' ? input.date : undefined,
    createdAt: Date.now(),
    source: input.source,
    sourceKey: input.sourceKey,
  }
}

export function isCalendarTodo(item: TodoItem): boolean {
  return item.source === 'schedule' || item.source === 'allDay'
}
