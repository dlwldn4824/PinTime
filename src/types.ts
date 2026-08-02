export const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
export type Day = (typeof DAYS)[number]

export const START_HOUR = 9
export const END_HOUR = 22
export const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i,
)

export type Schedule = {
  id: string
  day: Day
  start: string
  end: string
  title: string
  /** Month에서 등록한 경우 특정 날짜 (YYYY-MM-DD) */
  date?: string
  /** eventColors EventColorId */
  color?: string
  /** 단일 시간 일정 부가 정보 */
  repeat?: string
  location?: string
  link?: string
  memo?: string
  /** 전날 알림 (에이전트 확정 등) */
  remind?: boolean
}

const JS_WEEKDAY: Day[] = ['일', '월', '화', '수', '목', '금', '토']

export function weekdayOfDateKey(dateKey: string): Day {
  return JS_WEEKDAY[parseDateKey(dateKey).getDay()]
}

/** 월간 종일 일정 (여행 등). endDate inclusive. */
export type AllDayEvent = {
  id: string
  title: string
  startDate: string
  endDate: string
  /** eventColors EventColorId */
  color?: string
}

export type PinTimePayload = {
  source: 'PinTime'
  name?: string
  /** 가능한 슬롯 키: "월-14" */
  availableSlots?: string[]
  schedules?: Array<{
    day: Day
    start: string
    end: string
    title: string
  }>
  allDay?: Array<{
    title: string
    startDate: string
    endDate: string
  }>
}

export type MaskedSlot = {
  day: Day
  hour: number
}

export type Participant = {
  id: string
  name: string
  /** 타임픽식 이름+비번 식별 (데모용) */
  password: string
  /** 가능한 시간 슬롯: "YYYY-MM-DD@HH" */
  availableSlots: string[]
  joinedAt: number
  source?: 'app' | 'manual' | 'paste'
}

export type DateSelectMode = 'dates' | 'weekdays'

export type RoomConfirmedSlot = {
  slot: SlotKey
  /** 확정 길이(분). 기본 60 */
  durationMin: number
  confirmedAt: number
  confirmedBy?: string
}

export type ShareRoom = {
  id: string
  title: string
  createdAt: number
  /** 후보 선택 방식: 개별 날짜 / 요일 */
  mode: DateSelectMode
  /** 날짜 모드: 비연속 포함 선택 날짜들 (YYYY-MM-DD) */
  dates: string[]
  /** 요일 모드: 선택 요일 */
  weekdays: Day[]
  /** 레거시 기간 필드 (구 링크 호환) */
  startDate?: string
  endDate?: string
  /** 시작 시각 (시, inclusive) */
  startHour: number
  /** 종료 시각 (시, exclusive) */
  endHour: number
  participants: Participant[]
  /** 모임 확정 시간 (조율 완료) */
  confirmed?: RoomConfirmedSlot
}

export type SlotKey = string // `YYYY-MM-DD@HH:MM` or weekday `@HH:MM`

/** 시(소수 허용, 10.5 = 10:30) → "HH:MM" */
export function hourToLabel(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" → 시 단위 소수 (14:30 → 14.5) */
export function parseHour(label: string): number {
  const [h, m = '0'] = label.split(':')
  return Number(h) + Number(m) / 60
}

/** "HH:MM" → 자정 기준 분 */
export function parseTimeToMinutes(label: string): number {
  const [h, m = '0'] = label.split(':')
  return Number(h) * 60 + Number(m)
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 레거시 `@14` → `@14:00`/`@14:30`. HH:MM은 유지 */
function expandLegacyHourSlots(slots: SlotKey[]): SlotKey[] {
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
    out.add(`${column}@${minutesToLabel(base)}`)
    out.add(`${column}@${minutesToLabel(base + 30)}`)
  }
  return [...out]
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createRoomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** 주간 캘린더용 요일 슬롯 */
export function slotKey(day: Day, hour: number): string {
  return `${day}-${hour}`
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function dayDiffInclusive(start: string, end: string): number {
  const a = parseDateKey(start).getTime()
  const b = parseDateKey(end).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

export function schedulesToPayload(
  schedules: Schedule[],
  allDay: AllDayEvent[] = [],
  availableSlots?: SlotKey[],
  name?: string,
): PinTimePayload {
  return {
    source: 'PinTime',
    name,
    availableSlots,
    schedules: schedules.map(({ day, start, end, title }) => ({
      day,
      start,
      end,
      title,
    })),
    allDay: allDay.map(({ title, startDate, endDate }) => ({
      title,
      startDate,
      endDate,
    })),
  }
}

export function payloadToAvailableSlots(payload: PinTimePayload): SlotKey[] {
  if (payload.availableSlots?.length) {
    return payload.availableSlots.filter(
      (k) => typeof k === 'string' && k.includes('@'),
    )
  }
  return []
}

export function payloadToSchedules(payload: PinTimePayload): {
  schedules: Schedule[]
  allDay: AllDayEvent[]
} {
  const schedules: Schedule[] = (payload.schedules ?? [])
    .filter((s) => DAYS.includes(s.day as Day))
    .map((s) => ({
      id: createId(),
      day: s.day as Day,
      start: s.start,
      end: s.end,
      title: s.title,
    }))

  const allDay: AllDayEvent[] = (payload.allDay ?? []).map((e) => ({
    id: createId(),
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
  }))

  return { schedules, allDay }
}

export function payloadToMaskedSlots(payload: PinTimePayload): MaskedSlot[] {
  const slots: MaskedSlot[] = []
  for (const item of payload.schedules ?? []) {
    if (!DAYS.includes(item.day as Day)) continue
    const start = parseHour(item.start)
    const end = parseHour(item.end)
    for (let h = start; h < end; h += 1) {
      slots.push({ day: item.day as Day, hour: h })
    }
  }
  return slots
}

/** 레거시 참가자(schedules 보유) → availableSlots 정규화 */
export function normalizeParticipant(raw: Record<string, unknown>): Participant {
  const name = String(raw.name ?? '익명')
  const id = String(raw.id ?? createId())
  const password = String(raw.password ?? '')
  const joinedAt = Number(raw.joinedAt ?? Date.now())
  const source = raw.source as Participant['source']

  if (Array.isArray(raw.availableSlots)) {
    const slots = raw.availableSlots.filter(
      (k): k is string => typeof k === 'string',
    )
    return {
      id,
      name,
      password,
      availableSlots: expandLegacyHourSlots(slots),
      joinedAt,
      source,
    }
  }

  return {
    id,
    name,
    password,
    availableSlots: [],
    joinedAt,
    source,
  }
}

function expandDateRange(startDate: string, endDate: string): string[] {
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

function defaultSelectedDates(): string[] {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return expandDateRange(toDateKey(start), toDateKey(end))
}

export function normalizeRoom(raw: ShareRoom | Record<string, unknown>): ShareRoom {
  const room = raw as Partial<ShareRoom> & Record<string, unknown>
  const startHour = Number(room.startHour ?? 10)
  const endHour = Number(room.endHour ?? 22)
  const mode: DateSelectMode =
    room.mode === 'weekdays' || room.mode === 'dates'
      ? room.mode
      : Array.isArray(room.weekdays) && (room.weekdays as string[]).length > 0
        ? 'weekdays'
        : 'dates'

  let dates = Array.isArray(room.dates)
    ? (room.dates as string[]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    : []
  if (dates.length === 0 && room.startDate && room.endDate) {
    dates = expandDateRange(String(room.startDate), String(room.endDate))
  }
  if (dates.length === 0 && mode === 'dates') {
    dates = defaultSelectedDates()
  }

  const weekdays = (
    Array.isArray(room.weekdays) ? (room.weekdays as string[]) : []
  ).filter((d): d is Day => DAYS.includes(d as Day))

  const sortedDates = [...dates].sort()

  const confirmedRaw = room.confirmed as RoomConfirmedSlot | undefined
  const confirmed =
    confirmedRaw &&
    typeof confirmedRaw.slot === 'string' &&
    confirmedRaw.slot.includes('@')
      ? {
          slot: confirmedRaw.slot,
          durationMin: Number(confirmedRaw.durationMin) || 60,
          confirmedAt: Number(confirmedRaw.confirmedAt ?? Date.now()),
          confirmedBy:
            typeof confirmedRaw.confirmedBy === 'string'
              ? confirmedRaw.confirmedBy
              : undefined,
        }
      : undefined

  return {
    id: String(room.id),
    title: String(room.title ?? '일정 조율 방'),
    createdAt: Number(room.createdAt ?? Date.now()),
    mode,
    dates: sortedDates,
    weekdays,
    startDate: sortedDates[0],
    endDate: sortedDates[sortedDates.length - 1],
    startHour: Number.isFinite(startHour) ? startHour : 10,
    endHour: Number.isFinite(endHour) && endHour > startHour ? endHour : 22,
    participants: (Array.isArray(room.participants) ? room.participants : []).map(
      (p) => normalizeParticipant(p as unknown as Record<string, unknown>),
    ),
    confirmed,
  }
}
