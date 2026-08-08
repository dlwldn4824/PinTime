import {
  buildInviteUrl,
  buildShareUrl,
  buildSyncUrl,
  decodeRoomData,
  decodeRoomDataAsync,
  loadMyRooms,
  loadRoom,
  loadUserId,
  saveRoom,
  trackMyRoom,
  type ShareLinkOptions,
} from './storage'
import {
  type Participant,
  type ShareRoom,
  type SlotKey,
  createId,
  createRoomId,
  normalizeRoom,
} from '../types'

export type CreateRoomInput = {
  title: string
  mode: ShareRoom['mode']
  dates: string[]
  weekdays: ShareRoom['weekdays']
  startHour: number
  endHour: number
}

export function createRoom(input: CreateRoomInput): ShareRoom {
  const sorted = [...input.dates].sort()
  const room: ShareRoom = normalizeRoom({
    id: createRoomId(),
    title: input.title.trim() || '일정 조율 방',
    createdAt: Date.now(),
    mode: input.mode,
    dates: sorted,
    weekdays: input.weekdays,
    startDate: sorted[0],
    endDate: sorted[sorted.length - 1],
    startHour: input.startHour,
    endHour: input.endHour,
    participants: [],
  })
  saveRoom(room)
  trackMyRoom({
    id: room.id,
    title: room.title,
    role: 'host',
    updatedAt: Date.now(),
  })
  return room
}

export type UpsertResult =
  | { ok: true; room: ShareRoom; participant: Participant }
  | { ok: false; error: string }

/** 이름+비번으로 로그인/등록. 같은 이름+맞는 비번이면 수정, 새 이름이면 추가 */
export function upsertParticipant(
  room: ShareRoom,
  participant: Participant,
): UpsertResult {
  const name = participant.name.trim()
  if (!name) return { ok: false, error: '이름을 입력해 주세요' }
  if (!participant.password) return { ok: false, error: '비밀번호를 입력해 주세요' }

  const byName = room.participants.find((p) => p.name === name)
  if (byName && byName.password !== participant.password) {
    return {
      ok: false,
      error: '같은 이름이 이미 있어요. 비밀번호가 맞지 않아요',
    }
  }

  const nextParticipant: Participant = {
    ...participant,
    name,
    id: byName?.id ?? participant.id,
    password: participant.password,
  }

  const participants = byName
    ? room.participants.map((p) => (p.id === byName.id ? nextParticipant : p))
    : [...room.participants, nextParticipant]

  const next = normalizeRoom({ ...room, participants })
  saveRoom(next)
  // createRoom만 host로 기록. 초대 링크 첫 등록자가 host로 승격되면 안 됨
  const prevRole = loadMyRooms().find((r) => r.id === next.id)?.role
  const role = prevRole === 'host' ? 'host' : 'guest'
  trackMyRoom({
    id: next.id,
    title: next.title,
    role,
    updatedAt: Date.now(),
  })
  return { ok: true, room: next, participant: nextParticipant }
}

export function makeParticipant(
  name: string,
  password: string,
  availableSlots: SlotKey[],
  opts?: { id?: string; source?: Participant['source'] },
): Participant {
  return {
    id: opts?.id ?? createId(),
    name: name.trim(),
    password,
    availableSlots: [...new Set(availableSlots)],
    joinedAt: Date.now(),
    source: opts?.source,
  }
}

export function findParticipant(
  room: ShareRoom,
  name: string,
  password: string,
): Participant | null {
  const p = room.participants.find((x) => x.name === name.trim())
  if (!p) return null
  if (p.password !== password) return null
  return p
}

function applyResolved(
  roomId: string,
  fromUrl: ShareRoom,
): ShareRoom {
  const existing = loadRoom(roomId)
  if (!existing) {
    saveRoom(fromUrl)
    return fromUrl
  }

  // 방 설정은 URL(초대) 기준으로 맞추고, 참가자는 최신 슬롯 우선으로 합침
  const merged = mergeParticipantsPreferNewer(
    {
      ...fromUrl,
      // URL에 참가자가 없으면(짧은 초대) 로컬 참가자를 유지
      participants:
        fromUrl.participants.length > 0
          ? fromUrl.participants
          : existing.participants,
    },
    existing,
  )
  // URL이 골격만일 때도 로컬 confirmed 유지
  if (!fromUrl.confirmed && existing.confirmed) {
    merged.confirmed = existing.confirmed
  }
  saveRoom(merged)
  return merged
}

export function resolveRoom(
  roomId: string,
  encoded?: string | null,
): ShareRoom | null {
  if (encoded) {
    const fromUrl = decodeRoomData(encoded, roomId)
    if (fromUrl && fromUrl.id === roomId) {
      return applyResolved(roomId, fromUrl)
    }
  }
  return loadRoom(roomId)
}

export async function resolveRoomAsync(
  roomId: string,
  encoded?: string | null,
): Promise<ShareRoom | null> {
  if (encoded) {
    const fromUrl =
      (await decodeRoomDataAsync(encoded, roomId)) ??
      decodeRoomData(encoded, roomId)
    if (fromUrl && fromUrl.id === roomId) {
      return applyResolved(roomId, fromUrl)
    }
  }
  return loadRoom(roomId)
}

/** 같은 이름은 joinedAt·슬롯 수가 더 최신인 쪽을 채택. 비밀번호는 비어 있지 않은 쪽 유지 */
function mergeParticipantsPreferNewer(
  primary: ShareRoom,
  secondary: ShareRoom,
): ShareRoom {
  const map = new Map<string, Participant>()

  const consider = (p: Participant) => {
    const prev = map.get(p.name)
    if (!prev) {
      map.set(p.name, p)
      return
    }
    const prevScore = (prev.joinedAt || 0) + prev.availableSlots.length
    const nextScore = (p.joinedAt || 0) + p.availableSlots.length
    const newer =
      (p.joinedAt || 0) !== (prev.joinedAt || 0)
        ? (p.joinedAt || 0) > (prev.joinedAt || 0)
        : nextScore >= prevScore
    const chosen = newer ? p : prev
    map.set(p.name, {
      ...chosen,
      // URL 동기화본에 비밀번호가 없으면 로컬 비밀번호 유지
      password: chosen.password || prev.password || p.password || '',
      id: prev.id || p.id,
    })
  }

  for (const p of secondary.participants) consider(p)
  for (const p of primary.participants) consider(p)

  return normalizeRoom({
    ...primary,
    participants: [...map.values()],
  })
}

/** 기본: 짧은 초대 링크(방 설정만). sync면 참가자 포함 */
export function shareLinkFor(
  room: ShareRoom,
  opts?: ShareLinkOptions,
): string {
  return buildShareUrl(room, opts)
}

/**
 * 친구 초대: 짧은 방 설정 링크 + g=1 (배포 웹 URL).
 * 가능시간은 친구가 등록 후 sync 링크로 호스트에게 전달.
 */
export async function inviteLinkFor(room: ShareRoom): Promise<string> {
  return buildInviteUrl(room)
}

/** 호스트가 자기 방으로 다시 들어갈 때 (짧은 링크, 세션 유지) */
export function hostLinkFor(room: ShareRoom): string {
  return buildShareUrl(room, {
    includeParticipants: false,
    guest: false,
  })
}

/** 친구 등록 후 호스트에게 가능시간을 넘길 때 (압축, 비밀번호 제외) */
export async function syncLinkFor(room: ShareRoom): Promise<string> {
  return buildSyncUrl(room)
}

/** 로컬에 방이 있으면 id만으로도 열 수 있는 짧은 경로 */
export function localRoomPath(roomId: string): string {
  return `/join/${roomId}`
}

export function isLikelyHost(room: ShareRoom): boolean {
  if (room.participants.length === 0) return true
  const uid = loadUserId()
  return room.participants.some((p) => p.password === uid)
}

export function slotAvailability(room: ShareRoom): Map<
  string,
  { count: number; names: string[] }
> {
  const map = new Map<string, { count: number; names: string[] }>()
  for (const p of room.participants) {
    for (const slot of p.availableSlots) {
      const cur = map.get(slot) ?? { count: 0, names: [] }
      cur.count += 1
      cur.names.push(p.name)
      map.set(slot, cur)
    }
  }
  return map
}

/** 겹치는 사람이 많은 순 · 전원 가능 우선 */
export function rankedCommonSlots(room: ShareRoom): Array<{
  slot: SlotKey
  count: number
  names: string[]
  everyone: boolean
}> {
  const map = slotAvailability(room)
  const total = room.participants.length
  return [...map.entries()]
    .map(([slot, info]) => ({
      slot: slot as SlotKey,
      count: info.count,
      names: info.names,
      everyone: total > 0 && info.count === total,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => {
      if (a.everyone !== b.everyone) return a.everyone ? -1 : 1
      if (b.count !== a.count) return b.count - a.count
      return a.slot.localeCompare(b.slot)
    })
}

export function updateRoomTitle(room: ShareRoom, title: string): ShareRoom {
  const nextTitle = title.trim() || '일정 조율 방'
  const next = normalizeRoom({ ...room, title: nextTitle })
  saveRoom(next)
  trackMyRoom({
    id: next.id,
    title: next.title,
    role: 'host',
    updatedAt: Date.now(),
  })
  return next
}

export function confirmRoomSlot(
  room: ShareRoom,
  slot: SlotKey,
  opts?: { durationMin?: number; confirmedBy?: string },
): ShareRoom {
  const next = normalizeRoom({
    ...room,
    confirmed: {
      slot,
      durationMin: opts?.durationMin ?? 60,
      confirmedAt: Date.now(),
      confirmedBy: opts?.confirmedBy,
    },
  })
  saveRoom(next)
  trackMyRoom({
    id: next.id,
    title: next.title,
    role: 'host',
    updatedAt: Date.now(),
  })
  return next
}
