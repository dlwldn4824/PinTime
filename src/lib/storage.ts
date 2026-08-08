import type { AllDayEvent, Schedule, ShareRoom } from '../types'
import { createId, normalizeRoom } from '../types'
import { getPublicWebOrigin } from './publicUrl'
import {
  decodeRoomAsync,
  decodeRoomSync,
  encodeRoomAsync,
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
  void import('./cloudSync').then((m) => {
    if (m.isApplyingRemoteCalendar()) return
    m.schedulePushCalendar(state)
  })
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
  const trimmed = name.trim()
  if (!trimmed) {
    localStorage.removeItem(MY_NAME_KEY)
    return
  }
  localStorage.setItem(MY_NAME_KEY, trimmed)
}

/** 표시 이름 입력 placeholder — 마이페이지 저장 이름 우선, 없으면 임의 예시 */
const EXAMPLE_NAMES = ['민수', '하늘', '서연', '도윤', '하은'] as const

export function nameExamplePlaceholder(): string {
  const saved = loadMyName().trim()
  if (saved) return `예: ${saved}`
  const i = Math.floor(Math.random() * EXAMPLE_NAMES.length)
  return `예: ${EXAMPLE_NAMES[i]}`
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

export function decodeRoomData(
  encoded: string,
  fallbackId?: string,
): ShareRoom | null {
  return decodeRoomSync(encoded, fallbackId)
}

export async function decodeRoomDataAsync(
  encoded: string,
  fallbackId?: string,
): Promise<ShareRoom | null> {
  return decodeRoomAsync(encoded, fallbackId)
}

export type ShareLinkOptions = {
  /**
   * true면 참가자 가능시간 포함 (동기화용).
   * 초대 링크는 false(When2Meet식 짧은 링크)가 기본.
   */
  includeParticipants?: boolean
  /** true면 타임픽식 새 참가 링크 (기존 로그인 무시) */
  guest?: boolean
}

/** 공유 경로 — 짧은 `/j/:id` (레거시 `/join/:id` 도 열림) */
const SHARE_PATH = '/j'

function roomTitleParam(title: string): string {
  const t = title.trim() || '일정 조율'
  // 카톡 OG용 · URL이 너무 길어지지 않게 제한
  return t.length > 40 ? `${t.slice(0, 39)}…` : t
}

/** 동기 공유 링크 (압축 없음). 호스트 재진입 등 — 항상 배포 도메인 */
export function buildShareUrl(
  room: ShareRoom,
  opts?: ShareLinkOptions,
): string {
  const url = new URL(`${getPublicWebOrigin()}${SHARE_PATH}/${room.id}`)
  url.searchParams.set(
    'd',
    encodeRoomData(room, {
      includeParticipants: opts?.includeParticipants ?? false,
    }),
  )
  if (opts?.guest) url.searchParams.set('g', '1')
  url.searchParams.set('n', roomTitleParam(room.title))
  return url.toString()
}

/**
 * 친구 초대: 방 설정만 압축(짧음) + g=1.
 * 가능시간은 친구가 등록 후 「호스트에게 전달」 sync 링크로 넘김.
 */
export async function buildInviteUrl(room: ShareRoom): Promise<string> {
  const url = new URL(`${getPublicWebOrigin()}${SHARE_PATH}/${room.id}`)
  const encoded = await encodeRoomAsync(room, { includeParticipants: false })
  url.searchParams.set('d', encoded)
  url.searchParams.set('g', '1')
  url.searchParams.set('n', roomTitleParam(room.title))
  return url.toString()
}

/**
 * 친구 → 호스트 동기화용.
 * 참가자 가능시간만 압축해 넣고, 비밀번호는 넣지 않음.
 */
export async function buildSyncUrl(room: ShareRoom): Promise<string> {
  const url = new URL(`${getPublicWebOrigin()}${SHARE_PATH}/${room.id}`)
  const encoded = await encodeRoomAsync(room, { includeParticipants: true })
  url.searchParams.set('d', encoded)
  url.searchParams.set('s', '1')
  url.searchParams.set('n', roomTitleParam(room.title))
  return url.toString()
}
