import { expandSchedulesInRange } from './recurrence'
import {
  createTodo,
  loadTodos,
  saveTodos,
  type TodoItem,
  type TodoState,
} from './todos'
import {
  addDays,
  type AllDayEvent,
  type Schedule,
  toDateKey,
} from '../types'

export type CalendarTodoSource = 'schedule' | 'allDay'

/** 동기화 윈도우: 과거 60일 ~ 미래 120일 */
export function defaultTodoSyncRange(now: Date = new Date()): {
  start: string
  end: string
} {
  const today = toDateKey(now)
  return { start: addDays(today, -60), end: addDays(today, 120) }
}

function scheduleTodoText(title: string, start: string, end: string): string {
  const t = title.trim() || '일정'
  return `${start}–${end} ${t}`
}

function allDayTodoText(title: string): string {
  return title.trim() || '하루 종일'
}

type Desired = {
  sourceKey: string
  source: CalendarTodoSource
  date: string
  text: string
}

function collectDesired(
  schedules: Schedule[],
  allDay: AllDayEvent[],
  rangeStart: string,
  rangeEnd: string,
): Desired[] {
  const out: Desired[] = []

  for (const occ of expandSchedulesInRange(schedules, rangeStart, rangeEnd)) {
    out.push({
      sourceKey: `schedule:${occ.occurrenceId}`,
      source: 'schedule',
      date: occ.date,
      text: scheduleTodoText(occ.title, occ.start, occ.end),
    })
  }

  for (const event of allDay) {
    if (event.endDate < rangeStart || event.startDate > rangeEnd) continue
    let cur = event.startDate < rangeStart ? rangeStart : event.startDate
    const last = event.endDate > rangeEnd ? rangeEnd : event.endDate
    while (cur <= last) {
      out.push({
        sourceKey: `allDay:${event.id}@${cur}`,
        source: 'allDay',
        date: cur,
        text: allDayTodoText(event.title),
      })
      cur = addDays(cur, 1)
    }
  }

  return out
}

function isCalendarSourced(t: TodoItem): t is TodoItem & {
  source: CalendarTodoSource
  sourceKey: string
} {
  return (
    (t.source === 'schedule' || t.source === 'allDay') &&
    typeof t.sourceKey === 'string' &&
    t.sourceKey.length > 0
  )
}

/**
 * 캘린더 일정·종일 이벤트를 일간 할 일로 upsert.
 * - 완료 상태는 유지
 * - 윈도우 안 고아(삭제된 일정) 소스 투두는 제거
 * - 수동 투두는 건드리지 않음
 */
export function syncCalendarTodos(
  schedules: Schedule[],
  allDay: AllDayEvent[],
  range?: { start: string; end: string },
): TodoState {
  const { start, end } = range ?? defaultTodoSyncRange()
  const desired = collectDesired(schedules, allDay, start, end)
  const byKey = new Map(desired.map((d) => [d.sourceKey, d]))
  const state = loadTodos()

  const next: TodoItem[] = []
  const seen = new Set<string>()

  for (const item of state.items) {
    if (!isCalendarSourced(item)) {
      next.push(item)
      continue
    }
    const want = byKey.get(item.sourceKey)
    if (want) {
      seen.add(item.sourceKey)
      next.push({
        ...item,
        kind: 'daily',
        date: want.date,
        text: want.text,
        source: want.source,
        sourceKey: want.sourceKey,
      })
      continue
    }
    // 윈도우 밖이면 유지, 안이면 고아로 삭제
    if (item.date && (item.date < start || item.date > end)) {
      next.push(item)
    }
  }

  for (const d of desired) {
    if (seen.has(d.sourceKey)) continue
    next.push({
      ...createTodo({
        text: d.text,
        kind: 'daily',
        date: d.date,
      }),
      source: d.source,
      sourceKey: d.sourceKey,
    })
  }

  const nextState = { items: next }
  // 내용이 같으면 저장 스킵 (루프·클라우드 푸시 방지)
  if (JSON.stringify(state.items) === JSON.stringify(nextState.items)) {
    return state
  }
  saveTodos(nextState)
  return nextState
}
