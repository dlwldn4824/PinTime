import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { EventExtrasBar, type EventExtras } from './EventExtrasBar'
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_IDS,
  type EventColorId,
} from '../lib/eventColors'
import {
  addDays,
  parseDateKey,
  weekdayOfDateKey,
} from '../types'

export type EventFormValues = {
  title: string
  color: EventColorId
  allDay: boolean
  startDate: string
  endDate: string
  startHour: number
  endHour: number
  extras: EventExtras
}

type EventFormModalProps = {
  open: boolean
  mode?: 'create' | 'edit'
  /** 드래그 → true, 하루 클릭 → false */
  defaultAllDay: boolean
  initialStartDate: string
  initialEndDate: string
  initialTitle?: string
  initialColor?: string
  initialStartHour?: number
  initialEndHour?: number
  initialExtras?: EventExtras
  onCancel: () => void
  onConfirm: (payload: EventFormValues) => void
  onDelete?: () => void
}

const TIME_HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatDateKorean(dateKey: string): string {
  const d = parseDateKey(dateKey)
  const wd = weekdayOfDateKey(dateKey)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`
}

function formatHourKorean(hour: number): string {
  if (hour === 0) return '오전 12:00'
  if (hour === 12) return '오후 12:00'
  if (hour < 12) return `오전 ${hour}:00`
  return `오후 ${hour - 12}:00`
}

function asColorId(color?: string): EventColorId {
  if (color && (EVENT_COLOR_IDS as readonly string[]).includes(color)) {
    return color as EventColorId
  }
  return DEFAULT_EVENT_COLOR
}

export function EventFormModal({
  open,
  mode = 'create',
  defaultAllDay,
  initialStartDate,
  initialEndDate,
  initialTitle = '',
  initialColor,
  initialStartHour = 10,
  initialEndHour = 11,
  initialExtras,
  onCancel,
  onConfirm,
  onDelete,
}: EventFormModalProps) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<EventColorId>(DEFAULT_EVENT_COLOR)
  const [allDay, setAllDay] = useState(true)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [startHour, setStartHour] = useState(10)
  const [endHour, setEndHour] = useState(11)
  const [extras, setExtras] = useState<EventExtras>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const showExtras = !allDay && startDate === endDate

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setColor(asColorId(initialColor))
    setAllDay(defaultAllDay)
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
    setStartHour(initialStartHour)
    setEndHour(initialEndHour)
    setExtras(initialExtras ?? {})
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [
    open,
    mode,
    defaultAllDay,
    initialStartDate,
    initialEndDate,
    initialTitle,
    initialColor,
    initialStartHour,
    initialEndHour,
    initialExtras,
  ])

  // 종일·여러 날이면 반복/장소 등 extras 제거 (조용한 소실 방지)
  useEffect(() => {
    if (!open || showExtras) return
    setExtras((prev) => {
      if (
        !prev.repeat &&
        !prev.repeatUntil &&
        !prev.location &&
        !prev.link &&
        !prev.memo
      ) {
        return prev
      }
      return {}
    })
  }, [open, showExtras])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (endDate < startDate) return false
    if (allDay) return true
    if (startDate < endDate) return true
    return endHour > startHour
  }, [title, allDay, startDate, endDate, startHour, endHour])

  if (!open) return null

  const submit = () => {
    if (!canSubmit) return
    let nextEnd = endDate < startDate ? startDate : endDate
    let nextEndHour = endHour
    if (!allDay && startDate === nextEnd && nextEndHour <= startHour) {
      nextEnd = addDays(startDate, 1)
      nextEndHour = startHour === 23 ? 0 : nextEndHour
    }
    onConfirm({
      title: title.trim(),
      color,
      allDay,
      startDate,
      endDate: nextEnd,
      startHour,
      endHour: nextEndHour,
      extras: showExtras ? extras : {},
    })
  }

  const endHourOptions =
    startDate === endDate
      ? TIME_HOURS.filter((h) => h > startHour)
      : TIME_HOURS

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/25 px-4 backdrop-blur-[2px]"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {mode === 'edit' ? '일정 수정' : '새 일정'}
        </p>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="일정 제목 입력"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--tomato)] focus:bg-white focus:ring-2 focus:ring-[var(--tomato-soft)]"
        />

        <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-600">
                24
              </span>
              <span className="text-sm font-semibold text-slate-800">종일</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              onClick={() => setAllDay((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                allDay ? 'bg-violet-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  allDay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
            <span className="text-sm font-medium text-slate-700">시작</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <label className="relative">
                <span className="inline-flex cursor-pointer rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {formatDateKorean(startDate)}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    setStartDate(v)
                    if (endDate < v) setEndDate(v)
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              {!allDay && (
                <select
                  value={startHour}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setStartHour(v)
                    if (startDate === endDate && endHour <= v) {
                      if (v < 23) setEndHour(v + 1)
                      else setEndDate(addDays(startDate, 1))
                    }
                  }}
                  className="cursor-pointer appearance-none rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  {TIME_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHourKorean(h)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
            <span className="text-sm font-medium text-slate-700">종료</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <label className="relative">
                <span className="inline-flex cursor-pointer rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {formatDateKorean(endDate)}
                </span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    setEndDate(v < startDate ? startDate : v)
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              {!allDay && (
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="cursor-pointer appearance-none rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  {(endHourOptions.length > 0
                    ? endHourOptions
                    : [0]
                  ).map((h) => (
                    <option key={h} value={h}>
                      {formatHourKorean(h)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {showExtras ? (
          <EventExtrasBar
            value={extras}
            onChange={setExtras}
            repeatAnchorDate={startDate}
          />
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            종일·여러 날 일정에는 반복·장소·링크·메모를 쓸 수 없어요. 하루
            시간 일정으로 바꾸면 다시 나타납니다.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="rounded-xl bg-[var(--tomato)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tomato-deep)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mode === 'edit' ? '저장' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
