import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import {
  loadCalendar,
  saveCalendar,
  type CalendarState,
} from './storage'
import { loadTodos, saveTodos, type TodoState } from './todos'

const CAL_EVENT = 'pintime:calendar'
const APPLYING_REMOTE = { calendar: false, todos: false }

export type CloudDocMeta = { updatedAt: number }

export type CloudCalendarDoc = CalendarState & CloudDocMeta
export type CloudTodosDoc = TodoState & CloudDocMeta

function calendarRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid, 'data', 'calendar')
}

function todosRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid, 'data', 'todos')
}

function profileRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid)
}

function hasCalendarData(state: CalendarState | null | undefined) {
  return Boolean(state && (state.schedules.length > 0 || state.allDay.length > 0))
}

function hasTodoData(state: TodoState | null | undefined) {
  return Boolean(state && state.items.length > 0)
}

export function isApplyingRemoteCalendar() {
  return APPLYING_REMOTE.calendar
}

export function isApplyingRemoteTodos() {
  return APPLYING_REMOTE.todos
}

export async function pushCalendar(uid: string, state: CalendarState) {
  const ref = calendarRef(uid)
  if (!ref) return
  await setDoc(ref, { ...state, updatedAt: Date.now() })
}

export async function pushTodos(uid: string, state: TodoState) {
  const ref = todosRef(uid)
  if (!ref) return
  await setDoc(ref, { ...state, updatedAt: Date.now() })
}

export async function pushProfile(
  uid: string,
  data: {
    displayName?: string
    email?: string | null
    createdAt?: number
  },
) {
  const ref = profileRef(uid)
  if (!ref) return
  const payload: Record<string, string | number | null> = {
    displayName: data.displayName ?? '',
    email: data.email ?? null,
    updatedAt: Date.now(),
  }
  if (typeof data.createdAt === 'number') {
    payload.createdAt = data.createdAt
  }
  await setDoc(ref, payload, { merge: true })
}

let calTimer: ReturnType<typeof setTimeout> | null = null
let todoTimer: ReturnType<typeof setTimeout> | null = null
let activeUid: string | null = null

export function setCloudSyncUid(uid: string | null) {
  activeUid = uid
}

export function schedulePushCalendar(state: CalendarState) {
  if (!activeUid || !isFirebaseConfigured()) return
  if (APPLYING_REMOTE.calendar) return
  if (calTimer) clearTimeout(calTimer)
  const uid = activeUid
  calTimer = setTimeout(() => {
    void pushCalendar(uid, state).catch(() => undefined)
  }, 500)
}

export function schedulePushTodos(state: TodoState) {
  if (!activeUid || !isFirebaseConfigured()) return
  if (APPLYING_REMOTE.todos) return
  if (todoTimer) clearTimeout(todoTimer)
  const uid = activeUid
  todoTimer = setTimeout(() => {
    void pushTodos(uid, state).catch(() => undefined)
  }, 500)
}

function applyCalendarLocal(state: CalendarState) {
  APPLYING_REMOTE.calendar = true
  try {
    saveCalendar(state)
    window.dispatchEvent(new CustomEvent(CAL_EVENT, { detail: state }))
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.calendar = false
    }, 800)
  }
}

function applyTodosLocal(state: TodoState) {
  APPLYING_REMOTE.todos = true
  try {
    saveTodos(state)
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.todos = false
    }, 800)
  }
}

/** 로그인 직후: 클라우드 ↔ 로컬 이관 후 구독 시작 */
export async function bootstrapCloudSync(uid: string): Promise<{
  unsub: () => void
}> {
  if (!isFirebaseConfigured()) {
    return { unsub: () => undefined }
  }

  setCloudSyncUid(uid)

  const cRef = calendarRef(uid)
  const tRef = todosRef(uid)
  if (!cRef || !tRef) {
    return { unsub: () => undefined }
  }

  const localCal = loadCalendar() ?? { schedules: [], allDay: [] }
  const localTodos = loadTodos()

  const [remoteCalSnap, remoteTodoSnap] = await Promise.all([
    getDoc(cRef),
    getDoc(tRef),
  ])

  const remoteCal = remoteCalSnap.exists()
    ? (remoteCalSnap.data() as CloudCalendarDoc)
    : null
  const remoteTodos = remoteTodoSnap.exists()
    ? (remoteTodoSnap.data() as CloudTodosDoc)
    : null

  const remoteCalHas = hasCalendarData(remoteCal ?? undefined)
  const localCalHas = hasCalendarData(localCal)
  const remoteTodoHas = hasTodoData(remoteTodos ?? undefined)
  const localTodoHas = hasTodoData(localTodos)

  if (!remoteCalHas && localCalHas) {
    await pushCalendar(uid, localCal)
  } else if (remoteCalHas && remoteCal) {
    applyCalendarLocal({
      schedules: Array.isArray(remoteCal.schedules) ? remoteCal.schedules : [],
      allDay: Array.isArray(remoteCal.allDay) ? remoteCal.allDay : [],
    })
  }

  if (!remoteTodoHas && localTodoHas) {
    await pushTodos(uid, localTodos)
  } else if (remoteTodoHas && remoteTodos) {
    applyTodosLocal({
      items: Array.isArray(remoteTodos.items) ? remoteTodos.items : [],
    })
  }

  const unsubs: Unsubscribe[] = []

  unsubs.push(
    onSnapshot(cRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as CloudCalendarDoc
      const next: CalendarState = {
        schedules: Array.isArray(data.schedules) ? data.schedules : [],
        allDay: Array.isArray(data.allDay) ? data.allDay : [],
      }
      const local = loadCalendar() ?? { schedules: [], allDay: [] }
      if (
        JSON.stringify(local.schedules) === JSON.stringify(next.schedules) &&
        JSON.stringify(local.allDay) === JSON.stringify(next.allDay)
      ) {
        return
      }
      applyCalendarLocal(next)
    }),
  )

  unsubs.push(
    onSnapshot(tRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as CloudTodosDoc
      const next: TodoState = {
        items: Array.isArray(data.items) ? data.items : [],
      }
      const local = loadTodos()
      if (JSON.stringify(local.items) === JSON.stringify(next.items)) return
      applyTodosLocal(next)
    }),
  )

  return {
    unsub: () => {
      for (const u of unsubs) u()
      setCloudSyncUid(null)
      if (calTimer) clearTimeout(calTimer)
      if (todoTimer) clearTimeout(todoTimer)
    },
  }
}

export function onCalendarRemote(
  cb: (state: CalendarState) => void,
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<CalendarState>).detail
    if (detail) cb(detail)
  }
  window.addEventListener(CAL_EVENT, handler)
  return () => window.removeEventListener(CAL_EVENT, handler)
}
