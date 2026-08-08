import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  confirmOverwriteManualRooms,
  syncMyAvailabilityAcrossRooms,
} from '../lib/calendarRoomSync'
import { onCalendarRemote } from '../lib/cloudSync'
import { syncCalendarTodos } from '../lib/scheduleTodos'
import { loadCalendar, saveCalendar } from '../lib/storage'
import {
  type AllDayEvent,
  type Schedule,
  createId,
  toDateKey,
} from '../types'

export type CalendarViewMode = 'week' | 'month'

type CalendarContextValue = {
  schedules: Schedule[]
  allDay: AllDayEvent[]
  setSchedules: Dispatch<SetStateAction<Schedule[]>>
  setAllDay: Dispatch<SetStateAction<AllDayEvent[]>>
  addSchedule: (s: Omit<Schedule, 'id'>) => string
  updateSchedule: (id: string, s: Omit<Schedule, 'id'>) => void
  removeSchedule: (id: string) => void
  addAllDay: (e: Omit<AllDayEvent, 'id'>) => void
  updateAllDay: (id: string, e: Omit<AllDayEvent, 'id'>) => void
  removeAllDay: (id: string) => void
  /** 캘린더 일정 전부 삭제 */
  clearCalendar: () => void
  /** 메인 캘린더 뷰 / 미니캘린더 연동 */
  view: CalendarViewMode
  setView: Dispatch<SetStateAction<CalendarViewMode>>
  selectedDate: string
  setSelectedDate: (dateKey: string) => void
  /** 사이드바 미니캘린더: 해당 날짜로 이동 + Month 뷰 */
  goToDate: (dateKey: string) => void
  monthCursor: { year: number; month: number }
  setMonthCursor: Dispatch<SetStateAction<{ year: number; month: number }>>
}

const CalendarContext = createContext<CalendarContextValue | null>(null)


export function CalendarProvider({ children }: { children: ReactNode }) {
  const initial = loadCalendar()
  const now = new Date()
  // 저장된 일정만 사용. 샘플(PT/해커톤 등)은 자동으로 넣지 않음.
  const [schedules, setSchedules] = useState<Schedule[]>(
    () => initial?.schedules ?? [],
  )
  const [allDay, setAllDay] = useState<AllDayEvent[]>(
    () => initial?.allDay ?? [],
  )
  const [view, setView] = useState<CalendarViewMode>('week')
  const [selectedDate, setSelectedDateState] = useState(toDateKey(now))
  const [monthCursor, setMonthCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })

  useEffect(() => {
    saveCalendar({ schedules, allDay })
  }, [schedules, allDay])

  useEffect(() => {
    return onCalendarRemote((state) => {
      setSchedules(state.schedules)
      setAllDay(state.allDay)
    })
  }, [])

  // 캘린더 ↔ 공유 링크 가능시간 동기화 (앱 반영 방은 자동, 수동 수정 방은 확인)
  const lastCalendarSyncKey = useRef<string | null>(null)
  useEffect(() => {
    const key = JSON.stringify({ schedules, allDay })
    if (lastCalendarSyncKey.current === null) {
      lastCalendarSyncKey.current = key
      // 첫 로드에서도 일정 → 할 일 미러링
      syncCalendarTodos(schedules, allDay)
      return
    }
    if (lastCalendarSyncKey.current === key) return
    lastCalendarSyncKey.current = key
    syncMyAvailabilityAcrossRooms(schedules, allDay, {
      confirmManual: confirmOverwriteManualRooms,
    })
    syncCalendarTodos(schedules, allDay)
  }, [schedules, allDay])

  const setSelectedDate = useCallback((dateKey: string) => {
    const [y, m] = dateKey.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return
    setSelectedDateState(dateKey)
    setMonthCursor({ year: y, month: m - 1 })
  }, [])

  const goToDate = useCallback((dateKey: string) => {
    const [y, m] = dateKey.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return
    setSelectedDateState(dateKey)
    setMonthCursor({ year: y, month: m - 1 })
    setView('month')
  }, [])

  const addSchedule = useCallback((s: Omit<Schedule, 'id'>) => {
    const id = createId()
    setSchedules((prev) => [...prev, { ...s, id }])
    return id
  }, [])

  const updateSchedule = useCallback((id: string, s: Omit<Schedule, 'id'>) => {
    setSchedules((prev) =>
      prev.map((item) => (item.id === id ? { ...s, id } : item)),
    )
  }, [])

  const removeSchedule = useCallback((id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const addAllDay = useCallback((e: Omit<AllDayEvent, 'id'>) => {
    setAllDay((prev) => [...prev, { ...e, id: createId() }])
  }, [])

  const updateAllDay = useCallback((id: string, e: Omit<AllDayEvent, 'id'>) => {
    setAllDay((prev) =>
      prev.map((item) => (item.id === id ? { ...e, id } : item)),
    )
  }, [])

  const removeAllDay = useCallback((id: string) => {
    setAllDay((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const clearCalendar = useCallback(() => {
    setSchedules([])
    setAllDay([])
  }, [])

  const value = useMemo(
    () => ({
      schedules,
      allDay,
      setSchedules,
      setAllDay,
      addSchedule,
      updateSchedule,
      removeSchedule,
      addAllDay,
      updateAllDay,
      removeAllDay,
      clearCalendar,
      view,
      setView,
      selectedDate,
      setSelectedDate,
      goToDate,
      monthCursor,
      setMonthCursor,
    }),
    [
      schedules,
      allDay,
      addSchedule,
      updateSchedule,
      removeSchedule,
      addAllDay,
      updateAllDay,
      removeAllDay,
      clearCalendar,
      view,
      selectedDate,
      setSelectedDate,
      goToDate,
      monthCursor,
    ],
  )

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  )
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}
