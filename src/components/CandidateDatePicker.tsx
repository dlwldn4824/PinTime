import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DAYS, type DateSelectMode, type Day, toDateKey } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

type CandidateDatePickerProps = {
  mode: DateSelectMode
  onModeChange: (mode: DateSelectMode) => void
  selectedDates: string[]
  onDatesChange: (dates: string[]) => void
  selectedWeekdays: Day[]
  onWeekdaysChange: (days: Day[]) => void
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number; inMonth: boolean }> = []

  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, 1 - (startPad - i))
    cells.push({ key: toDateKey(d), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: toDateKey(new Date(year, month, day)),
      day,
      inMonth: true,
    })
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(
      year,
      month,
      daysInMonth + (cells.length - startPad - daysInMonth + 1),
    )
    cells.push({ key: toDateKey(last), day: last.getDate(), inMonth: false })
  }
  return cells
}

export function CandidateDatePicker({
  mode,
  onModeChange,
  selectedDates,
  onDatesChange,
  selectedWeekdays,
  onWeekdaysChange,
}: CandidateDatePickerProps) {
  const now = new Date()
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])
  const dragMode = useRef<'add' | 'remove'>('add')
  const dragging = useRef(false)
  const [draft, setDraft] = useState<Set<string> | null>(null)

  const cells = useMemo(
    () => buildCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )
  const view = draft ?? selectedSet
  const todayKey = toDateKey(now)

  const applyDate = (key: string, m: 'add' | 'remove', base: Set<string>) => {
    const next = new Set(base)
    if (m === 'add') next.add(key)
    else next.delete(key)
    return next
  }

  const finishDrag = () => {
    if (!dragging.current || !draft) {
      dragging.current = false
      setDraft(null)
      return
    }
    dragging.current = false
    onDatesChange([...draft].sort())
    setDraft(null)
  }

  const toggleWeekday = (day: Day) => {
    if (selectedWeekdays.includes(day)) {
      onWeekdaysChange(selectedWeekdays.filter((d) => d !== day))
    } else {
      onWeekdaysChange(DAYS.filter((d) => [...selectedWeekdays, day].includes(d)))
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-800">후보 날짜 선택</p>

      <div className="mt-2 inline-flex w-full rounded-full bg-slate-100 p-0.5">
        <button
          type="button"
          onClick={() => onModeChange('dates')}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
            mode === 'dates'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400'
          }`}
        >
          날짜
        </button>
        <button
          type="button"
          onClick={() => onModeChange('weekdays')}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
            mode === 'weekdays'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400'
          }`}
        >
          요일
        </button>
      </div>

      {mode === 'dates' ? (
        <div
          className="mt-3 rounded-2xl border border-slate-100 bg-white p-3"
          onMouseUp={finishDrag}
          onMouseLeave={() => {
            if (dragging.current) finishDrag()
          }}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(cursor.year, cursor.month - 1, 1)
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-slate-800">
              {cursor.year}년 {cursor.month + 1}월
            </p>
            <button
              type="button"
              onClick={() => {
                const d = new Date(cursor.year, cursor.month + 1, 1)
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-medium text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const selected = view.has(cell.key)
              const isToday = cell.key === todayKey
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!cell.inMonth}
                  className={`flex h-9 items-center justify-center ${
                    cell.inMonth ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onMouseDown={(e) => {
                    if (!cell.inMonth || e.button !== 0) return
                    e.preventDefault()
                    dragging.current = true
                    dragMode.current = selected ? 'remove' : 'add'
                    setDraft(applyDate(cell.key, dragMode.current, selectedSet))
                  }}
                  onMouseEnter={() => {
                    if (!dragging.current || !cell.inMonth) return
                    setDraft((prev) =>
                      applyDate(
                        cell.key,
                        dragMode.current,
                        prev ?? selectedSet,
                      ),
                    )
                  }}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition ${
                      selected
                        ? 'bg-blue-500 text-white'
                        : isToday
                          ? 'bg-blue-50 text-blue-600'
                          : cell.inMonth
                            ? 'text-slate-700 hover:bg-slate-50'
                            : 'text-slate-300'
                    }`}
                  >
                    {cell.day}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            드래그로 여러 날짜를 고르세요 · 다시 드래그하면 해제 · 선택{' '}
            <span className="font-semibold text-slate-700">
              {view.size}일
            </span>
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3">
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const on = selectedWeekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  className={`rounded-xl py-3 text-sm font-bold transition ${
                    on
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            매주 반복되는 요일을 고르세요 · 선택{' '}
            <span className="font-semibold text-slate-700">
              {selectedWeekdays.length}요일
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
