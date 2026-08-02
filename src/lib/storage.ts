import type { AllDayEvent, Schedule, ShareRoom } from '../types'
import { createId, normalizeRoom } from '../types'
import {
  decodeRoomAsync,
  decodeRoomSync,
  encodeRoomSync,
} from './shareCodec'

const CAL_KEY = 'pintime:calendar:v2'
const ROOM_PREFIX = 'pintime:room:'
const MY_NAME_KEY = 'pintime:myName'
const MY_USER_ID_KEY = 'pintime:userId'
const MY_ROOMS_KEY = 'pintime:myRooms'

export type CalendarState = {
  schedules: Schedule[]
  allDay: AllDayEvent[]
}

export type MyRoomRef = {
  id: string
  title: string
  role: 'host' | 'guest'
  updatedAt: number
}

export function loadCalendar(): CalendarState | null {
  try {
    const raw = localStorage.getItem(CAL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CalendarState
  } catch {
    return null
  }
}

export function saveCalendar(state: CalendarState) {
  localStorage.setItem(CAL_KEY, JSON.stringify(state))
}

export function loadRoom(id: string): ShareRoom | null {
  try {
    const raw = localStorage.getItem(ROOM_PREFIX + id)
    if (!raw) return null
    return normalizeRoom(JSON.parse(raw) as ShareRoom)
  } catch {
    return null
  }
}

export function saveRoom(room: ShareRoom) {
  const normalized = normalizeRoom(room)
  localStorage.setItem(ROOM_PREFIX + normalized.id, JSON.stringify(normalized))
  window.dispatchEvent(
    new CustomEvent('pintime:room', { detail: { id: normalized.id } }),
  )
}

export function loadMyName(): string {
  return localStorage.getItem(MY_NAME_KEY) ?? ''
}

export function saveMyName(name: string) {
  localStorage.setItem(MY_NAME_KEY, name)
}

export function loadUserId(): string {
  let id = localStorage.getItem(MY_USER_ID_KEY)
  if (!id) {
    id = `pt_${createId().slice(0, 10)}`
    localStorage.setItem(MY_USER_ID_KEY, id)
  }
  return id
}

export function loadMyRooms(): MyRoomRef[] {
  try {
    const raw = localStorage.getItem(MY_ROOMS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MyRoomRef[]
  } catch {
    return []
  }
}

export function trackMyRoom(ref: MyRoomRef) {
  const list = loadMyRooms().filter((r) => r.id !== ref.id)
  list.unshift(ref)
  localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(list.slice(0, 30)))
}

export function removeMyRoom(id: string) {
  const list = loadMyRooms().filter((r) => r.id !== id)
  localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(list))
  localStorage.removeItem(ROOM_PREFIX + id)
}

/** 로컬 테스트 데이터 전부 삭제 (캘린더·방·세션·이름) */
export function clearAllPinTimeData(): string[] {
  const removed: string[] = []
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (!key?.startsWith('pintime:')) continue
    localStorage.removeItem(key)
    removed.push(key)
  }
  // 빈 캘린더로 남겨 두어 샘플 일정이 다시 안 뜨게 함
  localStorage.setItem(
    CAL_KEY,
    JSON.stringify({ schedules: [], allDay: [] } satisfies CalendarState),
  )
  removed.push(`${CAL_KEY}:empty`)
  return removed
}

/** 초대용: 참가자 제외한 짧은 링크 데이터 */
export function encodeRoomData(
  room: ShareRoom,
  opts?: { includeParticipants?: boolean },
): string {
  return encodeRoomSync(room, {
    includeParticipants: opts?.includeParticipants ?? false,
  })
}

export function decodeRoomData(encoded: string): ShareRoom | null {
  return decodeRoomSync(encoded)
}

export async function decodeRoomDataAsync(
  encoded: string,
): Promise<ShareRoom | null> {
  return decodeRoomAsync(encoded)
}

export type ShareLinkOptions = {
  /** true면 참가자 일정까지 포함 (길어질 수 있음) */
  includeParticipants?: boolean
  /** true면 타임픽식 새 참가 링크 (기존 로그인 무시) */
  guest?: boolean
}

export function buildShareUrl(
  room: ShareRoom,
  opts?: ShareLinkOptions,
): string {
  const url = new URL(`${window.location.origin}/join/${room.id}`)
  url.searchParams.set(
    'd',
    encodeRoomData(room, {
      includeParticipants: opts?.includeParticipants ?? false,
    }),
  )
  if (opts?.guest) url.searchParams.set('guest', '1')
  return url.toString()
}
