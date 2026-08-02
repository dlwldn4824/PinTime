import { useEffect, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { EventExtrasBar, type EventExtras } from './EventExtrasBar'
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_IDS,
  type EventColorId,
} from '../lib/eventColors'
import { HOURS, hourToLabel } from '../types'

type TitleModalProps = {
  open: boolean
  rangeLabel: string
  mode?: 'create' | 'edit'
  initialTitle?: string
  initialColor?: string
  initialExtras?: EventExtras
  /** 수정 시 시간 변경 */
  editableHours?: boolean
  initialStartHour?: number
  initialEndHour?: number
  onCancel: () => void
  onConfirm: (payload: {
    title: string
    color: EventColorId
    startHour: number
    endHour: number
    extras: EventExtras
  }) => void
  onDelete?: () => void
}

function asColorId(color?: string): EventColorId {
  if (color && (EVENT_COLOR_IDS as readonly string[]).includes(color)) {
    return color as EventColorId
  }
  return DEFAULT_EVENT_COLOR
}

export function TitleModal({
  open,
  rangeLabel,
  mode = 'create',
  initialTitle = '',
  initialColor,
  initialExtras,
  editableHours = false,
  initialStartHour = 10,
  initialEndHour = 11,
  onCancel,
  onConfirm,
  onDelete,
}: TitleModalProps) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<EventColorId>(DEFAULT_EVENT_COLOR)
  const [startHour, setStartHour] = useState(10)
  const [endHour, setEndHour] = useState(11)
  const [extras, setExtras] = useState<EventExtras>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setColor(asColorId(initialColor))
    setStartHour(initialStartHour)
    setEndHour(initialEndHour)
    setExtras(initialExtras ?? {})
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [
    open,
    initialTitle,
    initialColor,
    initialExtras,
    initialStartHour,
    initialEndHour,
  ])

  if (!open) return null

  const canSubmit = title.trim() && endHour > startHour

  const submit = () => {
    if (!canSubmit) return
    onConfirm({
      title: title.trim(),
      color,
      startHour,
      endHour,
      extras,
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
          {mode === 'edit' ? '일정 수정' : '새 일정'}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{rangeLabel}</h2>

        {editableHours && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500">시작</label>
              <select
                value={startHour}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setStartHour(v)
                  if (endHour <= v) setEndHour(Math.min(v + 1, 22))
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
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
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
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
        )}

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

        <EventExtrasBar value={extras} onChange={setExtras} />

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
              className="rounded-xl bg-blue-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mode === 'edit' ? '저장' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
