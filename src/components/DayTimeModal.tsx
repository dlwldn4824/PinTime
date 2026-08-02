import { useEffect, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import {
  DEFAULT_EVENT_COLOR,
  type EventColorId,
} from '../lib/eventColors'
import { HOURS, hourToLabel } from '../types'

type DayTimeModalProps = {
  open: boolean
  dateLabel: string
  onCancel: () => void
  onConfirm: (payload: {
    title: string
    startHour: number
    endHour: number
    color: EventColorId
  }) => void
}

export function DayTimeModal({
  open,
  dateLabel,
  onCancel,
  onConfirm,
}: DayTimeModalProps) {
  const [title, setTitle] = useState('')
  const [startHour, setStartHour] = useState(10)
  const [endHour, setEndHour] = useState(11)
  const [color, setColor] = useState<EventColorId>(DEFAULT_EVENT_COLOR)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setStartHour(10)
      setEndHour(11)
      setColor(DEFAULT_EVENT_COLOR)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const canSubmit = title.trim() && endHour > startHour

  const submit = () => {
    if (!canSubmit) return
    onConfirm({
      title: title.trim(),
      startHour,
      endHour,
      color,
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/25 px-4 backdrop-blur-[2px]"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          시간 일정
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{dateLabel}</h2>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">시작</label>
            <select
              value={startHour}
              onChange={(e) => {
                const v = Number(e.target.value)
                setStartHour(v)
                if (endHour <= v) setEndHour(Math.min(v + 1, 22))
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourToLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">종료</label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              {[...HOURS, 22]
                .filter((h) => h > startHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {hourToLabel(h)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="일정 제목 입력"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3">
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
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
            className="rounded-xl bg-blue-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}
