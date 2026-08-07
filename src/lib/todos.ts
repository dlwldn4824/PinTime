import { createId } from '../types'

const TODO_KEY = 'pintime:todos:v1'

export type TodoKind = 'daily' | 'standing'

export type TodoItem = {
  id: string
  text: string
  done: boolean
  kind: TodoKind
  /** daily만 — YYYY-MM-DD */
  date?: string
  createdAt: number
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
}): TodoItem {
  return {
    id: createId(),
    text: input.text.trim(),
    done: false,
    kind: input.kind,
    date: input.kind === 'daily' ? input.date : undefined,
    createdAt: Date.now(),
  }
}
