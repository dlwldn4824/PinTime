import {
  DAYS,
  type AllDayEvent,
  type Day,
  type Schedule,
  type ShareRoom,
  type SlotKey,
  hourToLabel,
  minutesToLabel,
  parseDateKey,
  parseTimeToMinutes,
  toDateKey,
  weekdayOfDateKey,
} from '../types'
import { dateForWeekdayInWeek } from './recurrence'

const JS_WEEKDAY: Day[] = ['일', '월', '화', '수', '목', '금', '토']
export const SLOT_STEP_MIN = 30

export type RoomColumn = {
  key: string
  md: string
  wd: string
}

/** 컬럼 키 + 분 → 슬롯 (예: 2026-07-20@10:30 / 월@14:00) */
export function columnSlotKey(columnKey: string, minutes: number): SlotKey {
  return `${columnKey}@${minutesToLabel(minutes)}`
}

export function dateSlotKey(date: string, minutes: number): SlotKey {
  return columnSlotKey(date, minutes)
}

export function parseColumnSlotKey(
  key: SlotKey,
): { column: string; minutes: number } | null {
  const at = key.lastIndexOf('@')
  if (at < 0) return null
  const column = key.slice(0, at)
  const time = key.slice(at + 1)
  if (!column) return null

  if (time.includes(':')) {
    const minutes = parseTimeToMinutes(time)
    if (!Number.isFinite(minutes)) return null
    return { column, minutes }
  }

  // 레거시: @14 (시 단위)
  const hour = Number(time)
  if (!Number.isFinite(hour)) return null
  return { column, minutes: Math.round(hour * 60) }
}

export function isValidRoomSlot(key: SlotKey): boolean {
  return !!parseColumnSlotKey(key)
}

/** 레거시 `@14` → `@14:00` / `@14:30` 로 확장. 이미 HH:MM이면 그대로 */
export function expandLegacySlotKeys(slots: SlotKey[]): SlotKey[] {
  const out = new Set<SlotKey>()
  for (const key of slots) {
    const at = key.lastIndexOf('@')
    if (at < 0) continue
    const column = key.slice(0, at)
    const time = key.slice(at + 1)
    if (time.includes(':')) {
      out.add(key)
      continue
    }
    const hour = Number(time)
    if (!Number.isFinite(hour)) continue
    const base = Math.round(hour) * 60
    out.add(columnSlotKey(column, base))
    out.add(columnSlotKey(column, base + SLOT_STEP_MIN))
  }
  return [...out]
}

export function roomColumnKeys(room: ShareRoom): RoomColumn[] {
  if (room.mode === 'weekdays') {
    const selected = room.weekdays?.length
      ? DAYS.filter((d) => room.weekdays.includes(d))
      : []
    return selected.map((d) => ({ key: d, md: d, wd: '요일' }))
  }

  const dates =
    room.dates?.length > 0
      ? [...room.dates].sort()
      : room.startDate && room.endDate
        ? expandRange(room.startDate, room.endDate)
        : []

  return dates.map((date) => {
    const col = formatDateCol(date)
    return { key: date, md: col.md, wd: col.wd }
  })
}

export function roomDateKeys(room: ShareRoom): string[] {
  return roomColumnKeys(room).map((c) => c.key)
}

function expandRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return []
  const keys: string[] = []
  let cur = startDate
  let guard = 0
  while (cur <= endDate && guard < 60) {
    keys.push(cur)
    const d = parseDateKey(cur)
    d.setDate(d.getDate() + 1)
    cur = toDateKey(d)
    guard += 1
  }
  return keys
}

/** 방의 30분 단위 슬롯 (자정 기준 분, end 미만) */
export function roomSlots(
  room: Pick<ShareRoom, 'startHour' | 'endHour'>,
): number[] {
  const start = Math.round((room.startHour ?? 9) * 60)
  const end = Math.round((room.endHour ?? 22) * 60)
  if (end <= start) return []
  const slots: number[] = []
  for (let m = start; m < end; m += SLOT_STEP_MIN) slots.push(m)
  return slots
}

/** @deprecated use roomSlots */
export function roomHours(
  room: Pick<ShareRoom, 'startHour' | 'endHour'>,
): number[] {
  return roomSlots(room)
}

export function allSlotKeysForRoom(room: ShareRoom): SlotKey[] {
  return roomColumnKeys(room).flatMap((col) =>
    roomSlots(room).map((minutes) => columnSlotKey(col.key, minutes)),
  )
}

export function weekdayOfDate(dateKey: string): Day {
  return JS_WEEKDAY[parseDateKey(dateKey).getDay()]
}

export function formatDateCol(dateKey: string): { md: string; wd: string } {
  if (DAYS.includes(dateKey as Day)) {
    return { md: dateKey, wd: '요일' }
  }
  const d = parseDateKey(dateKey)
  return {
    md: `${d.getMonth() + 1}/${d.getDate()}`,
    wd: weekdayOfDate(dateKey),
  }
}

export function formatMinuteKorean(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = m === 0 ? '시' : `시 ${String(m).padStart(2, '0')}분`
  if (h === 0) return `오전 12${suffix === '시' ? '시' : suffix}`
  if (h === 12) return m === 0 ? '오후 12시' : `오후 12시 ${String(m).padStart(2, '0')}분`
  if (h < 12) return `오전 ${h}${m === 0 ? '시' : `시 ${String(m).padStart(2, '0')}분`}`
  return `오후 ${h - 12}${m === 0 ? '시' : `시 ${String(m).padStart(2, '0')}분`}`
}

/** 조율 그리드용 짧은 시각 (모바일 대응) */
export function formatMinuteShort(minutes: number): string {
  return minutesToLabel(minutes)
}

/** 조율 그리드 컬럼: 좁은 화면에서도 깨지지 않게 */
export function joinGridTemplate(columnCount: number): string {
  const n = Math.max(columnCount, 1)
  return `44px repeat(${n}, minmax(40px, 1fr))`
}

export function joinGridMinWidth(columnCount: number): number {
  return 44 + Math.max(columnCount, 1) * 40
}

/** @deprecated use formatMinuteKorean */
export function formatHourKorean(hour: number): string {
  return formatMinuteKorean(Math.round(hour * 60))
}

export function formatRoomRangeLabel(room: ShareRoom): string {
  const time = `${hourToLabel(room.startHour)}–${hourToLabel(room.endHour)} · 30분`
  if (room.mode === 'weekdays') {
    const days = room.weekdays?.length
      ? DAYS.filter((d) => room.weekdays.includes(d)).join('')
      : ''
    return days ? `${days} · ${time}` : time
  }
  const cols = roomColumnKeys(room)
  if (cols.length === 0) return time
  if (cols.length === 1) return `${cols[0].md} · ${time}`
  return `${cols.length}일 선택 · ${time}`
}

export function defaultRoomRange(): {
  dates: string[]
  startHour: number
  endHour: number
} {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return {
    dates: expandRange(toDateKey(start), toDateKey(end)),
    startHour: 10,
    endHour: 22,
  }
}

function markBusyRange(
  busy: Set<string>,
  columnKey: string,
  startMin: number,
  endMin: number,
  slotSet: Set<number>,
) {
  for (let m = startMin; m < endMin; m += SLOT_STEP_MIN) {
    if (slotSet.has(m)) busy.add(columnSlotKey(columnKey, m))
  }
}

export function busyToAvailableSlotsForRoom(
  schedules: Schedule[],
  allDay: AllDayEvent[],
  room: ShareRoom,
): SlotKey[] {
  const busy = new Set<string>()
  const columns = roomColumnKeys(room)
  const slots = roomSlots(room)
  const slotSet = new Set(slots)

  for (const col of columns) {
    if (room.mode === 'weekdays') {
      const day = col.key as Day
      for (const s of schedules) {
        if (s.day !== day) continue
        markBusyRange(
          busy,
          col.key,
          parseTimeToMinutes(s.start),
          parseTimeToMinutes(s.end),
          slotSet,
        )
      }
    } else {
      const date = col.key
      const wd = weekdayOfDate(date)
      for (const s of schedules) {
        // 특정 날짜 일정은 그 날짜만, 없으면 요일 반복으로 취급
        if (s.date ? s.date !== date : s.day !== wd) continue
        markBusyRange(
          busy,
          date,
          parseTimeToMinutes(s.start),
          parseTimeToMinutes(s.end),
          slotSet,
        )
      }
      for (const e of allDay) {
        if (date >= e.startDate && date <= e.endDate) {
          for (const m of slots) busy.add(columnSlotKey(date, m))
        }
      }
    }
  }

  return allSlotKeysForRoom(room).filter((k) => !busy.has(k))
}

export function filterSlotsToRoom(
  slots: SlotKey[],
  room: ShareRoom,
): SlotKey[] {
  const valid = new Set(allSlotKeysForRoom(room))
  return slots.filter((k) => valid.has(k))
}

function upcomingDateForWeekday(day: Day): string {
  const today = toDateKey(new Date())
  let date = dateForWeekdayInWeek(today, day)
  if (date < today) {
    const d = parseDateKey(date)
    d.setDate(d.getDate() + 7)
    date = toDateKey(d)
  }
  return date
}

export type SlotAppointment = {
  day: Day
  date: string
  start: string
  end: string
  label: string
}

/** 시작 슬롯 + 길이 → 포함되는 슬롯 키들 */
export function rangeSlotKeys(
  startSlot: SlotKey,
  durationMin: number,
): SlotKey[] {
  const parsed = parseColumnSlotKey(startSlot)
  if (!parsed) return []
  const len = Math.max(durationMin, SLOT_STEP_MIN)
  const keys: SlotKey[] = []
  for (let m = parsed.minutes; m < parsed.minutes + len; m += SLOT_STEP_MIN) {
    keys.push(columnSlotKey(parsed.column, m))
  }
  return keys
}

export type ConfirmRange = {
  startSlot: SlotKey
  durationMin: number
}

/** 같은 열에서 시작·끝 분 → 확정 구간 */
export function minutesToConfirmRange(
  columnKey: string,
  startMin: number,
  endMin: number,
): ConfirmRange {
  const lo = Math.min(startMin, endMin)
  const hi = Math.max(startMin, endMin)
  return {
    startSlot: columnSlotKey(columnKey, lo),
    durationMin: hi - lo + SLOT_STEP_MIN,
  }
}

/** 조율 슬롯 → 캘린더 일정 필드 (기본 30분 = 한 칸) */
export function slotKeyToAppointment(
  room: ShareRoom,
  slot: SlotKey,
  durationMin = SLOT_STEP_MIN,
): SlotAppointment | null {
  const parsed = parseColumnSlotKey(slot)
  if (!parsed) return null

  const { column, minutes } = parsed
  const start = minutesToLabel(minutes)
  const end = minutesToLabel(minutes + Math.max(durationMin, SLOT_STEP_MIN))

  let date: string
  let day: Day
  if (/^\d{4}-\d{2}-\d{2}$/.test(column)) {
    date = column
    day = weekdayOfDateKey(date)
  } else if (DAYS.includes(column as Day)) {
    day = column as Day
    date = upcomingDateForWeekday(day)
  } else {
    return null
  }

  const colLabel =
    room.mode === 'weekdays'
      ? day
      : `${parseDateKey(date).getMonth() + 1}/${parseDateKey(date).getDate()}(${day})`

  return {
    day,
    date,
    start,
    end,
    label: `${colLabel} ${start}–${end}`,
  }
}

/** 시작/종료 시각 선택 (30분 단위, 시 소수) */
export const HOUR_OPTIONS = Array.from(
  { length: 48 },
  (_, i) => i * 0.5,
) // 0, 0.5, ..., 23.5

export const END_HOUR_OPTIONS = [...HOUR_OPTIONS, 24]
