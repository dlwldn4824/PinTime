import {
  DAYS,
  type Day,
  type Participant,
  type ShareRoom,
  type SlotKey,
  normalizeRoom,
} from '../types'
import { allSlotKeysForRoom } from './slots'

/** 공유용 짧은 페이로드 (긴 필드명·빈 배열 제거) */
type CompactRoom = {
  i: string
  t: string
  c?: number
  m: 'd' | 'w'
  /** 연속 날짜: 시작(YYYYMMDD) + 일수 */
  a?: string
  n?: number
  /** 비연속 날짜 YYYYMMDD[] */
  D?: string[]
  W?: string[]
  s: number
  e: number
  p?: CompactParticipant[]
}

type CompactParticipant = {
  i?: string
  n: string
  w: string
  /** allSlotKeys 인덱스 */
  a?: number[]
  o?: 'a' | 'm' | 'p'
}

function dateToCompact(date: string): string {
  return date.replace(/-/g, '')
}

function compactToDate(raw: string): string {
  if (raw.includes('-')) return raw
  if (raw.length !== 8) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function expandConsecutive(startCompact: string, count: number): string[] {
  const start = compactToDate(startCompact)
  const out: string[] = []
  const d = new Date(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  )
  for (let i = 0; i < count; i += 1) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

function isConsecutive(dates: string[]): boolean {
  if (dates.length <= 1) return true
  const sorted = [...dates].sort()
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00')
    const cur = new Date(sorted[i] + 'T12:00:00')
    if ((cur.getTime() - prev.getTime()) / 86400000 !== 1) return false
  }
  return true
}

export function packRoom(
  room: ShareRoom,
  opts?: { includeParticipants?: boolean },
): CompactRoom {
  const includeParticipants = opts?.includeParticipants ?? false
  const sorted = [...(room.dates ?? [])].sort()
  const packed: CompactRoom = {
    i: room.id,
    t: room.title,
    m: room.mode === 'weekdays' ? 'w' : 'd',
    s: room.startHour,
    e: room.endHour,
  }
  if (room.createdAt) packed.c = room.createdAt

  if (room.mode === 'weekdays') {
    packed.W = DAYS.filter((d) => room.weekdays.includes(d))
  } else if (sorted.length > 0) {
    if (isConsecutive(sorted)) {
      packed.a = dateToCompact(sorted[0])
      packed.n = sorted.length
    } else {
      packed.D = sorted.map(dateToCompact)
    }
  }

  if (includeParticipants && room.participants.length > 0) {
    const keys = allSlotKeysForRoom(room)
    const indexOf = new Map(keys.map((k, i) => [k, i]))
    packed.p = room.participants.map((p) => {
      const indices = p.availableSlots
        .map((k) => indexOf.get(k))
        .filter((i): i is number => i !== undefined)
      const row: CompactParticipant = {
        n: p.name,
        w: p.password,
        a: indices,
      }
      if (p.id) row.i = p.id
      if (p.source === 'app') row.o = 'a'
      else if (p.source === 'paste') row.o = 'p'
      else if (p.source === 'manual') row.o = 'm'
      return row
    })
  }

  return packed
}

export function unpackRoom(raw: unknown): ShareRoom | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as CompactRoom & Record<string, unknown>

  // 레거시 풀 JSON
  if ('id' in c && ('participants' in c || 'startHour' in c)) {
    return normalizeRoom(c as unknown as ShareRoom)
  }

  if (typeof c.i !== 'string' || typeof c.t !== 'string') return null

  let dates: string[] = []
  let weekdays: Day[] = []
  const mode = c.m === 'w' ? 'weekdays' : 'dates'

  if (mode === 'weekdays') {
    weekdays = (c.W ?? []).filter((d): d is Day =>
      DAYS.includes(d as Day),
    )
  } else if (typeof c.a === 'string' && typeof c.n === 'number') {
    dates = expandConsecutive(c.a, c.n)
  } else if (Array.isArray(c.D)) {
    dates = c.D.map(compactToDate)
  }

  const base = normalizeRoom({
    id: c.i,
    title: c.t,
    createdAt: typeof c.c === 'number' ? c.c : Date.now(),
    mode,
    dates,
    weekdays,
    startHour: Number(c.s ?? 10),
    endHour: Number(c.e ?? 22),
    participants: [],
  })

  if (!Array.isArray(c.p) || c.p.length === 0) return base

  const keys = allSlotKeysForRoom(base)
  const participants: Participant[] = c.p.map((p) => {
    const slots: SlotKey[] = (p.a ?? [])
      .map((idx) => keys[idx])
      .filter((k): k is SlotKey => typeof k === 'string')
    const source =
      p.o === 'a' ? 'app' : p.o === 'p' ? 'paste' : p.o === 'm' ? 'manual' : undefined
    return {
      id: p.i ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: p.n,
      password: p.w,
      availableSlots: slots,
      joinedAt: Date.now(),
      source,
    }
  })

  return normalizeRoom({ ...base, participants })
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return bytes
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') return bytes
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** 동기 인코딩 (압축 없이 compact JSON). 초대 링크용으로 충분히 짧음 */
export function encodeRoomSync(
  room: ShareRoom,
  opts?: { includeParticipants?: boolean },
): string {
  const json = JSON.stringify(packRoom(room, opts))
  const bytes = new TextEncoder().encode(json)
  return `c.${bytesToBase64Url(bytes)}`
}

export async function encodeRoomAsync(
  room: ShareRoom,
  opts?: { includeParticipants?: boolean },
): Promise<string> {
  const json = JSON.stringify(packRoom(room, opts))
  const raw = new TextEncoder().encode(json)
  try {
    const compressed = await deflate(raw)
    if (compressed.length < raw.length) {
      return `z.${bytesToBase64Url(compressed)}`
    }
  } catch {
    // fall through
  }
  return `c.${bytesToBase64Url(raw)}`
}

export async function decodeRoomAsync(
  encoded: string,
): Promise<ShareRoom | null> {
  try {
    if (encoded.startsWith('z.')) {
      const inflated = await inflate(base64UrlToBytes(encoded.slice(2)))
      const json = new TextDecoder().decode(inflated)
      return unpackRoom(JSON.parse(json))
    }
    if (encoded.startsWith('c.')) {
      const bytes = base64UrlToBytes(encoded.slice(2))
      const json = new TextDecoder().decode(bytes)
      return unpackRoom(JSON.parse(json))
    }
    // 레거시: 풀 JSON base64url
    const bytes = base64UrlToBytes(encoded)
    const json = new TextDecoder().decode(bytes)
    return unpackRoom(JSON.parse(json))
  } catch {
    return null
  }
}

export function decodeRoomSync(encoded: string): ShareRoom | null {
  try {
    if (encoded.startsWith('z.')) {
      // 동기 경로에서는 압축본을 못 풂 → null (async 사용)
      return null
    }
    if (encoded.startsWith('c.')) {
      const bytes = base64UrlToBytes(encoded.slice(2))
      const json = new TextDecoder().decode(bytes)
      return unpackRoom(JSON.parse(json))
    }
    const bytes = base64UrlToBytes(encoded)
    const json = new TextDecoder().decode(bytes)
    return unpackRoom(JSON.parse(json))
  } catch {
    return null
  }
}
