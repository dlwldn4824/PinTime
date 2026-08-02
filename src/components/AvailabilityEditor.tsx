import { Eraser, Paintbrush } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type ShareRoom, type SlotKey } from '../types'
import {
  columnSlotKey,
  formatMinuteShort,
  joinGridMinWidth,
  joinGridTemplate,
  roomColumnKeys,
  roomSlots,
} from '../lib/slots'

const ROW_H = 34
const GREEN = '#22c55e'
const PINK = '#fce7f3'

type AvailabilityEditorProps = {
  room: ShareRoom
  selected: Set<SlotKey>
  onChange: (next: Set<SlotKey>) => void
  title?: string
  disabled?: boolean
}

type DragMode = 'paint' | 'erase'

export function AvailabilityEditor({
  room,
  selected,
  onChange,
  title = '내 되는 시간',
  disabled = false,
}: AvailabilityEditorProps) {
  const dragging = useRef(false)
  const mode = useRef<DragMode>('paint')
  const [draft, setDraft] = useState<Set<SlotKey> | null>(null)
  const draftRef = useRef<Set<SlotKey> | null>(null)

  const columns = useMemo(() => roomColumnKeys(room), [room])
  const slots = useMemo(() => roomSlots(room), [room])
  const view = draft ?? selected
  const colTemplate = joinGridTemplate(columns.length)
  const minWidth = joinGridMinWidth(columns.length)

  const applyCell = useCallback(
    (columnKey: string, minutes: number, m: DragMode, base: Set<SlotKey>) => {
      const key = columnSlotKey(columnKey, minutes)
      const next = new Set(base)
      if (m === 'paint') next.add(key)
      else next.delete(key)
      return next
    },
    [],
  )

  const finish = useCallback(() => {
    if (!dragging.current) {
      setDraft(null)
      draftRef.current = null
      return
    }
    dragging.current = false
    const final = draftRef.current
    setDraft(null)
    draftRef.current = null
    if (final) onChange(final)
  }, [onChange])

  const paintAt = (columnKey: string, minutes: number, m: DragMode) => {
    setDraft((prev) => {
      const next = applyCell(columnKey, minutes, m, prev ?? selected)
      draftRef.current = next
      return next
    })
  }

  const cellFromTouch = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const cell = el?.closest('[data-slot-col]') as HTMLElement | null
    if (!cell) return null
    return {
      columnKey: cell.dataset.slotCol!,
      minutes: Number(cell.dataset.slotMin),
    }
  }

  return (
    <div
      className={`flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white ${
        disabled ? 'opacity-60' : ''
      }`}
      onMouseUp={finish}
      onMouseLeave={() => {
        if (dragging.current) finish()
      }}
      onTouchEnd={finish}
      onTouchCancel={finish}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5 pb-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-800 sm:text-lg">
            {title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Paintbrush size={13} className="shrink-0" />
            칸을 칠하면 되는 시간 · 한 칸 = 30분
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || view.size === 0}
          onClick={() => onChange(new Set())}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
        >
          <Eraser size={16} />
          전부 지우기
        </button>
      </div>

      <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-200 [-webkit-overflow-scrolling:touch]">
        <div style={{ minWidth, width: '100%' }}>
          <div
            className="sticky top-0 z-10 grid gap-px border-b border-slate-100 bg-white px-0.5 py-1.5"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div />
            {columns.map((col) => (
              <div
                key={col.key}
                className="rounded-md bg-slate-50 px-0.5 py-1 text-center"
              >
                <p className="truncate text-[10px] font-bold text-slate-700 sm:text-[11px]">
                  {col.md}
                </p>
                <p className="truncate text-[9px] text-slate-400">{col.wd}</p>
              </div>
            ))}
          </div>

          <div
            className="grid touch-none"
            style={{
              gridTemplateColumns: colTemplate,
              height: Math.max(slots.length, 1) * ROW_H,
            }}
          >
            {slots.map((minutes) => (
              <div key={minutes} className="contents">
                <div
                  className="relative border-b border-slate-100 pr-1 text-right"
                  style={{ height: ROW_H }}
                >
                  <span className="absolute top-0.5 right-1 font-mono text-[9px] font-medium text-slate-400">
                    {formatMinuteShort(minutes)}
                  </span>
                </div>
                {columns.map((col) => {
                  const key = columnSlotKey(col.key, minutes)
                  const on = view.has(key)
                  return (
                    <div
                      key={key}
                      data-slot-col={col.key}
                      data-slot-min={minutes}
                      className={`border-b border-r border-white/40 ${
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{
                        height: ROW_H,
                        background: on ? GREEN : PINK,
                      }}
                      onMouseDown={(e) => {
                        if (disabled || e.button !== 0) return
                        e.preventDefault()
                        dragging.current = true
                        mode.current = on ? 'erase' : 'paint'
                        paintAt(col.key, minutes, mode.current)
                      }}
                      onMouseEnter={() => {
                        if (!dragging.current || disabled) return
                        paintAt(col.key, minutes, mode.current)
                      }}
                      onTouchStart={(e) => {
                        if (disabled) return
                        e.preventDefault()
                        dragging.current = true
                        mode.current = on ? 'erase' : 'paint'
                        paintAt(col.key, minutes, mode.current)
                      }}
                      onTouchMove={(e) => {
                        if (!dragging.current || disabled) return
                        const t = e.touches[0]
                        if (!t) return
                        const hit = cellFromTouch(t.clientX, t.clientY)
                        if (hit) paintAt(hit.columnKey, hit.minutes, mode.current)
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
