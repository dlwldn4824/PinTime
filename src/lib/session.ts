export type RoomSession = {
  name: string
  password: string
}

const key = (roomId: string) => `pintime:session:${roomId}`

export function loadRoomSession(roomId: string): RoomSession | null {
  try {
    const raw = localStorage.getItem(key(roomId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RoomSession
    if (!parsed.name) return null
    return { name: parsed.name, password: parsed.password ?? '' }
  } catch {
    return null
  }
}

export function saveRoomSession(roomId: string, session: RoomSession) {
  localStorage.setItem(key(roomId), JSON.stringify(session))
}

export function clearRoomSession(roomId: string) {
  localStorage.removeItem(key(roomId))
}
