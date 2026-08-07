import {
  DAYS,
  type Day,
  type Schedule,
  addDays,
  parseDateKey,
  toDateKey,
  weekdayOfDateKey,
} from '../types'

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export type ScheduleOccurrence = Schedule & {
  /** 이 발생분의 날짜 */
  date: string
  /** 리스트/키용 */
  occurrenceId: string
}

export function parseRepeatKind(repeat?: string): RepeatKind {
  if (!repeat?.trim() || repeat === '안 함' || repeat === 'none') return 'none'
  if (repeat === '매일' || repeat === 'daily') return 'daily'
  if (repeat === '매주' || repeat === 'weekly') return 'weekly'
  if (repeat === '매월' || repeat === 'monthly') return 'monthly'
  if (repeat === '매년' || repeat === 'yearly') return 'yearly'
  return 'custom'
}

/** selectedDate가 속한 주(월~일)에서 해당 요일의 날짜 */
export function dateForWeekdayInWeek(weekAnchor: string, day: Day): string {
  const d = parseDateKey(weekAnchor)
  const js = d.getDay()
  const toMonday = js === 0 ? -6 : 1 - js
  const monday = new Date(d)
  monday.setDate(d.getDate() + toMonday)
  const idx = DAYS.indexOf(day)
  monday.setDate(monday.getDate() + (idx < 0 ? 0 : idx))
  return toDateKey(monday)
}

function anchorDateOf(schedule: Schedule): string | null {
  if (schedule.date) return schedule.date
  return null
}

/**
 * rangeStart~rangeEnd(포함)에 보이는 반복/단일 일정 발생분.
 * 반복 없음이면 앵커 날짜(또는 요일 매칭)만.
 */
export function expandSchedulesInRange(
  schedules: Schedule[],
  rangeStart: string,
  rangeEnd: string,
): ScheduleOccurrence[] {
  if (rangeStart > rangeEnd) return []
  const out: ScheduleOccurrence[] = []

  for (const schedule of schedules) {
    const kind = parseRepeatKind(schedule.repeat)
    const anchor = anchorDateOf(schedule)

    if (kind === 'none' || kind === 'custom') {
      if (anchor) {
        if (anchor >= rangeStart && anchor <= rangeEnd) {
          out.push({
            ...schedule,
            date: anchor,
            occurrenceId: `${schedule.id}@${anchor}`,
          })
        }
      } else {
        // 날짜 없는 레거시: 범위 안 같은 요일마다 1회씩 (반복 아님)
        let cur = rangeStart
        while (cur <= rangeEnd) {
          if (weekdayOfDateKey(cur) === schedule.day) {
            out.push({
              ...schedule,
              date: cur,
              occurrenceId: `${schedule.id}@${cur}`,
            })
          }
          cur = addDays(cur, 1)
        }
      }
      continue
    }

    // 반복: 앵커 필수. 없으면 범위 시작 주의 해당 요일을 앵커로 사용
    const startAnchor =
      anchor ?? dateForWeekdayInWeek(rangeStart, schedule.day)
    const until = schedule.repeatUntil?.trim() || null
    // 조회 상한: 달력 범위와 반복 종료일 중 더 이른 쪽
    const cappedEnd =
      until && until < rangeEnd ? until : rangeEnd
    if (until && startAnchor > until) continue
    if (cappedEnd < rangeStart) continue

    if (kind === 'daily') {
      let cur = startAnchor < rangeStart ? rangeStart : startAnchor
      if (cur < startAnchor) cur = startAnchor
      while (cur <= cappedEnd) {
        if (cur >= startAnchor && (!until || cur <= until)) {
          out.push({
            ...schedule,
            date: cur,
            day: weekdayOfDateKey(cur),
            occurrenceId: `${schedule.id}@${cur}`,
          })
        }
        cur = addDays(cur, 1)
      }
      continue
    }

    if (kind === 'weekly') {
      const targetDay = schedule.day
      let cur = rangeStart
      while (cur <= cappedEnd) {
        if (
          cur >= startAnchor &&
          (!until || cur <= until) &&
          weekdayOfDateKey(cur) === targetDay
        ) {
          out.push({
            ...schedule,
            date: cur,
            day: targetDay,
            occurrenceId: `${schedule.id}@${cur}`,
          })
        }
        cur = addDays(cur, 1)
      }
      continue
    }

    if (kind === 'monthly') {
      const dayNum = parseDateKey(startAnchor).getDate()
      let cur = rangeStart
      while (cur <= cappedEnd) {
        if (cur >= startAnchor && (!until || cur <= until)) {
          const d = parseDateKey(cur)
          const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          if (d.getDate() === Math.min(dayNum, last)) {
            out.push({
              ...schedule,
              date: cur,
              day: weekdayOfDateKey(cur),
              occurrenceId: `${schedule.id}@${cur}`,
            })
          }
        }
        cur = addDays(cur, 1)
      }
      continue
    }

    if (kind === 'yearly') {
      const a = parseDateKey(startAnchor)
      const mm = a.getMonth()
      const dd = a.getDate()
      let cur = rangeStart
      while (cur <= cappedEnd) {
        if (cur >= startAnchor && (!until || cur <= until)) {
          const d = parseDateKey(cur)
          if (d.getMonth() === mm && d.getDate() === dd) {
            out.push({
              ...schedule,
              date: cur,
              day: weekdayOfDateKey(cur),
              occurrenceId: `${schedule.id}@${cur}`,
            })
          }
        }
        cur = addDays(cur, 1)
      }
    }
  }

  return out
}

export function schedulesOnDate(
  schedules: Schedule[],
  dateKey: string,
): ScheduleOccurrence[] {
  return expandSchedulesInRange(schedules, dateKey, dateKey)
}
