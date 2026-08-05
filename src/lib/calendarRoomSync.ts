import { loadRoomSession } from './session'
import { busyToAvailableSlotsForRoom } from './slots'
import {
  findParticipant,
  makeParticipant,
  upsertParticipant,
} from './room'
import { loadMyRooms, loadRoom, loadUserId } from './storage'
import type { AllDayEvent, Participant, Schedule, ShareRoom, SlotKey } from '../types'

export type SyncRoomsResult = {
  updated: string[]
  skippedManual: string[]
  unchanged: string[]
}

/** 사용자가 직접 칠거나 붙여넣은 가능시간 → 캘린더 자동 반영 전 확인 대상 */
export function isHandEditedSource(source?: Participant['source']): boolean {
  return source === 'manual' || source === 'paste'
}

function sameSlotSet(a: SlotKey[], b: SlotKey[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((k) => set.has(k))
}

function resolveMyIdentity(room: ShareRoom): {
  name: string
  password: string
  participant: Participant
} | null {
  const session = loadRoomSession(room.id)
  if (session?.name && session.password) {
    const p = findParticipant(room, session.name, session.password)
    if (p) {
      return { name: p.name, password: session.password, participant: p }
    }
  }

  const uid = loadUserId()
  const byUid = room.participants.find((p) => p.password === uid)
  if (byUid) {
    return { name: byUid.name, password: uid, participant: byUid }
  }
  return null
}

export type PendingManualRoom = {
  id: string
  title: string
  room: ShareRoom
  nextSlots: SlotKey[]
  name: string
  password: string
  participant: Participant
}

/**
 * 캘린더 busy → 내 참여 중인 공유 방 가능시간 반영.
 * source가 manual/paste인 방은 confirmManual이 true일 때만 덮어씀.
 */
export function syncMyAvailabilityAcrossRooms(
  schedules: Schedule[],
  allDay: AllDayEvent[],
  opts?: {
    /** true면 수동 수정 방도 확인 없이 덮어씀 */
    forceManual?: boolean
    /** 수동 수정 방이 있을 때 한 번 물어봄. false면 해당 방은 건너뜀 */
    confirmManual?: (rooms: PendingManualRoom[]) => boolean
    excludeRoomId?: string
  },
): SyncRoomsResult {
  const result: SyncRoomsResult = {
    updated: [],
    skippedManual: [],
    unchanged: [],
  }

  const refs = loadMyRooms()
  const pendingManual: PendingManualRoom[] = []
  const autoApply: Array<{
    room: ShareRoom
    nextSlots: SlotKey[]
    name: string
    password: string
    participant: Participant
  }> = []

  for (const ref of refs) {
    if (opts?.excludeRoomId && ref.id === opts.excludeRoomId) continue
    const room = loadRoom(ref.id)
    if (!room) continue

    const identity = resolveMyIdentity(room)
    if (!identity) continue

    const nextSlots = busyToAvailableSlotsForRoom(schedules, allDay, room)
    if (sameSlotSet(identity.participant.availableSlots, nextSlots)) {
      result.unchanged.push(room.id)
      continue
    }

    const entry = {
      room,
      nextSlots,
      name: identity.name,
      password: identity.password,
      participant: identity.participant,
    }

    if (isHandEditedSource(identity.participant.source) && !opts?.forceManual) {
      pendingManual.push({
        id: room.id,
        title: room.title,
        room,
        nextSlots,
        name: identity.name,
        password: identity.password,
        participant: identity.participant,
      })
    } else {
      autoApply.push(entry)
    }
  }

  let applyManual = false
  if (pendingManual.length > 0) {
    if (opts?.forceManual) {
      applyManual = true
    } else if (opts?.confirmManual) {
      applyManual = opts.confirmManual(pendingManual)
    } else {
      applyManual = false
    }
  }

  const toApply = [
    ...autoApply,
    ...(applyManual
      ? pendingManual.map((p) => ({
          room: p.room,
          nextSlots: p.nextSlots,
          name: p.name,
          password: p.password,
          participant: p.participant,
        }))
      : []),
  ]

  for (const item of toApply) {
    const next = makeParticipant(item.name, item.password, item.nextSlots, {
      id: item.participant.id,
      source: 'app',
    })
    const upserted = upsertParticipant(item.room, next)
    if (upserted.ok) result.updated.push(item.room.id)
  }

  if (!applyManual) {
    for (const p of pendingManual) result.skippedManual.push(p.id)
  }

  return result
}

/** 확인 대화상자 문구 */
export function confirmOverwriteManualRooms(
  rooms: PendingManualRoom[],
): boolean {
  if (rooms.length === 0) return true
  const list = rooms.map((r) => `· ${r.title}`).join('\n')
  return window.confirm(
    `다음 공유 링크에 직접 수정한 가능 시간이 있어요.\n\n${list}\n\n캘린더 일정 기준으로 덮어쓸까요?\n(취소를 누르면 해당 링크만 그대로 둡니다)`,
  )
}
