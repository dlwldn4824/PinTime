import {
  buildShareUrl,
  decodeRoomData,
  decodeRoomDataAsync,
  loadRoom,
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
  trackMyRoom({
    id: next.id,
    title: next.title,
    role: room.participants.length === 0 ? 'host' : 'guest',
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
  if (
    existing &&
    existing.participants.length > fromUrl.participants.length
  ) {
    return existing
  }
  if (existing && existing.participants.length > 0) {
    const merged = mergeParticipants(fromUrl, existing)
    saveRoom(merged)
    return merged
  }
  saveRoom(fromUrl)
  return fromUrl
}

export function resolveRoom(
  roomId: string,
  encoded?: string | null,
): ShareRoom | null {
  if (encoded) {
    const fromUrl = decodeRoomData(encoded)
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
      (await decodeRoomDataAsync(encoded)) ?? decodeRoomData(encoded)
    if (fromUrl && fromUrl.id === roomId) {
      return applyResolved(roomId, fromUrl)
    }
  }
  return loadRoom(roomId)
}

function mergeParticipants(primary: ShareRoom, secondary: ShareRoom): ShareRoom {
  const map = new Map<string, Participant>()
  for (const p of primary.participants) map.set(p.name, p)
  for (const p of secondary.participants) {
    if (!map.has(p.name)) map.set(p.name, p)
  }
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

/** 친구 초대용: 참가자 일정 포함 + guest=1 (새 이름으로 참여) */
export function inviteLinkFor(room: ShareRoom): string {
  return buildShareUrl(room, {
    includeParticipants: room.participants.length > 0,
    guest: true,
  })
}

/** 호스트가 자기 방으로 다시 들어갈 때 (세션 유지) */
export function hostLinkFor(room: ShareRoom): string {
  return buildShareUrl(room, {
    includeParticipants: room.participants.length > 0,
    guest: false,
  })
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
