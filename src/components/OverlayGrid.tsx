import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { type ShareRoom, type SlotKey } from '../types'
import { slotAvailability } from '../lib/room'
import {
  SLOT_STEP_MIN,
  type ConfirmRange,
  columnSlotKey,
  formatMinuteShort,
  joinGridMinWidth,
  joinGridTemplate,
  minutesToConfirmRange,
  rangeSlotKeys,
  roomColumnKeys,
  roomSlots,
} from '../lib/slots'

const ROW_H = 34

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return v || fallback
}

type FilterMode = 'all' | 'everyone' | 'most'

type OverlayGridProps = {
  room: ShareRoom
  title?: string
  selectedRange?: ConfirmRange | null
  onSelectRange?: (range: ConfirmRange) => void
}

export function OverlayGrid({
  room,
  title = '모임 전체 시간표',
  selectedRange = null,
  onSelectRange,
}: OverlayGridProps) {
  const { theme } = useTheme()
  const accent = useMemo(
    () => ({
      main: cssVar('--main', '#abe2c4'),
      tomato: cssVar('--tomato', '#fe6653'),
    }),
    [theme],
  )
  const [hover, setHover] = useState<{
    names: string[]
    count: number
    x: number
    y: number
  } | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const filterTouched = useRef(false)

  const dragging = useRef(false)
  const dragCol = useRef<string | null>(null)
  const dragStartMin = useRef(0)
  const [draftRange, setDraftRange] = useState<ConfirmRange | null>(null)

  const columns = useMemo(() => roomColumnKeys(room), [room])
  const slots = useMemo(() => roomSlots(room), [room])
  const map = useMemo(() => slotAvailability(room), [room])
  const participantCount = room.participants.length
  const total = Math.max(participantCount, 1)
  const maxCount = useMemo(() => {
    let max = 0
    for (const info of map.values()) {
      if (info.count > max) max = info.count
    }
    return max
  }, [map])
  const everyoneCount = useMemo(() => {
    if (participantCount === 0) return 0
    let n = 0
    for (const info of map.values()) {
      if (info.count === participantCount) n += 1
    }
    return n
  }, [map, participantCount])

  // 2명 이상이고 모두 가능한 칸이 있으면 기본으로「모두 가능」필터
  useEffect(() => {
    if (filterTouched.current) return
    if (participantCount >= 2 && everyoneCount > 0) {
      setFilter('everyone')
    }
  }, [participantCount, everyoneCount])
  const mostCount = useMemo(() => {
    if (maxCount === 0) return 0
    let n = 0
    for (const info of map.values()) {
      if (info.count === maxCount) n += 1
    }
    return n
  }, [map, maxCount])
  const colTemplate = joinGridTemplate(columns.length)
  const minWidth = joinGridMinWidth(columns.length)

  const matchesFilter = (count: number) => {
    if (filter === 'all') return count > 0
    if (filter === 'everyone')
      return participantCount > 0 && count === participantCount
    return maxCount > 0 && count === maxCount
  }

  const confirmedRange: ConfirmRange | null = room.confirmed
    ? {
        startSlot: room.confirmed.slot,
        durationMin: room.confirmed.durationMin || SLOT_STEP_MIN,
      }
    : null

  const activeRange = draftRange ?? selectedRange
  const selectedKeys = useMemo(
    () =>
      activeRange
        ? new Set(rangeSlotKeys(activeRange.startSlot, activeRange.durationMin))
        : new Set<SlotKey>(),
    [activeRange],
  )
  const confirmedKeys = useMemo(
    () =>
      confirmedRange
        ? new Set(
            rangeSlotKeys(
              confirmedRange.startSlot,
              confirmedRange.durationMin,
            ),
          )
        : new Set<SlotKey>(),
    [confirmedRange],
  )

  const finishDrag = () => {
    if (!dragging.current) {
      setDraftRange(null)
      return
    }
    dragging.current = false
    const range = draftRange
    dragCol.current = null
    setDraftRange(null)
    if (range && onSelectRange) onSelectRange(range)
  }

  const paintDrag = (columnKey: string, minutes: number) => {
    if (!dragging.current || dragCol.current !== columnKey) return
    // 구간 안 칸은 필터에 맞는 가능 시간이어야 함
    const lo = Math.min(dragStartMin.current, minutes)
    const hi = Math.max(dragStartMin.current, minutes)
    for (let m = lo; m <= hi; m += SLOT_STEP_MIN) {
      const key = columnSlotKey(columnKey, m)
      const count = map.get(key)?.count ?? 0
      if (!matchesFilter(count)) return
    }
    setDraftRange(minutesToConfirmRange(columnKey, dragStartMin.current, minutes))
  }

  const cellFromPoint = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const cell = el?.closest('[data-overlay-col]') as HTMLElement | null
    if (!cell) return null
    return {
      columnKey: cell.dataset.overlayCol!,
      minutes: Number(cell.dataset.overlayMin),
    }
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white"
      onMouseUp={finishDrag}
      onMouseLeave={() => {
        if (dragging.current) finishDrag()
      }}
      onTouchEnd={finishDrag}
      onTouchCancel={finishDrag}
    >
      <div className="flex shrink-0 flex-col gap-2 px-0.5 pb-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-800 sm:text-lg">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              초록이 진할수록 더 많은 사람이 가능해요
              {onSelectRange ? ' · 초록 칸을 드래그해 구간 선택' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all' as const, label: '전체', hint: '' },
              {
                id: 'everyone' as const,
                label: '모두 가능',
                hint: everyoneCount > 0 ? `${everyoneCount}` : '0',
              },
              {
                id: 'most' as const,
                label:
                  maxCount > 0 && maxCount < participantCount
                    ? `제일 많이 (${maxCount}/${participantCount})`
                    : '제일 많이 가능',
                hint: mostCount > 0 ? `${mostCount}` : '0',
              },
            ] as const
          ).map((opt) => {
            const active = filter === opt.id
            const disabled =
              opt.id === 'everyone'
                ? everyoneCount === 0
                : opt.id === 'most'
                  ? mostCount === 0
                  : false
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  filterTouched.current = true
                  setFilter(opt.id)
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? opt.id === 'everyone'
                      ? 'bg-emerald-600 text-white'
                      : opt.id === 'most'
                        ? 'bg-[var(--tomato)] text-white'
                        : 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
                }`}
              >
                {opt.label}
                {opt.hint ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                      active ? 'bg-white/20' : 'bg-white text-slate-500'
                    }`}
                  >
                    {opt.hint}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
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
            className="grid select-none"
            style={{
              gridTemplateColumns: colTemplate,
              height: Math.max(slots.length, 1) * ROW_H,
            }}
            onTouchMove={(e) => {
              if (!dragging.current || e.touches.length === 0) return
              const t = e.touches[0]
              const cell = cellFromPoint(t.clientX, t.clientY)
              if (cell) paintDrag(cell.columnKey, cell.minutes)
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
                  const info = map.get(key)
                  const count = info?.count ?? 0
                  const visible = matchesFilter(count)
                  const opacity =
                    participantCount === 0 || !visible ? 0 : count / total
                  const isSelected = selectedKeys.has(key)
                  const isConfirmed = confirmedKeys.has(key)
                  const canPick = !!onSelectRange && visible

                  return (
                    <div
                      key={key}
                      role={canPick ? 'button' : undefined}
                      tabIndex={canPick ? 0 : undefined}
                      data-overlay-col={col.key}
                      data-overlay-min={minutes}
                      className={`relative border-b border-r border-slate-100 ${
                        visible ? 'bg-white' : 'bg-slate-50'
                      } ${
                        canPick
                          ? 'cursor-crosshair hover:ring-2 hover:ring-inset hover:ring-[var(--tomato)]'
                          : 'cursor-default'
                      } ${isSelected ? 'ring-2 ring-inset ring-[var(--tomato)]' : ''} ${
                        isConfirmed ? 'ring-2 ring-inset ring-amber-500' : ''
                      }`}
                      style={{ height: ROW_H }}
                      onMouseDown={(e) => {
                        if (!canPick) return
                        e.preventDefault()
                        dragging.current = true
                        dragCol.current = col.key
                        dragStartMin.current = minutes
                        setDraftRange(
                          minutesToConfirmRange(col.key, minutes, minutes),
                        )
                      }}
                      onMouseEnter={(e) => {
                        if (info && visible) {
                          const rect = (
                            e.currentTarget as HTMLElement
                          ).getBoundingClientRect()
                          setHover({
                            names: info.names,
                            count: info.count,
                            x: Math.min(
                              Math.max(rect.left + rect.width / 2, 72),
                              window.innerWidth - 72,
                            ),
                            y: rect.top,
                          })
                        } else {
                          setHover(null)
                        }
                        paintDrag(col.key, minutes)
                      }}
                      onMouseLeave={() => setHover(null)}
                      onTouchStart={(e) => {
                        if (!canPick || e.touches.length === 0) return
                        const t = e.touches[0]
                        dragging.current = true
                        dragCol.current = col.key
                        dragStartMin.current = minutes
                        setDraftRange(
                          minutesToConfirmRange(col.key, minutes, minutes),
                        )
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect()
                        setHover({
                          names: info?.names ?? [],
                          count: info?.count ?? 0,
                          x: Math.min(
                            Math.max(rect.left + rect.width / 2, 72),
                            window.innerWidth - 72,
                          ),
                          y: rect.top,
                        })
                        void t
                      }}
                    >
                      <div
                        className="absolute inset-0 transition-opacity"
                        style={{
                          background: isConfirmed
                            ? '#f59e0b'
                            : isSelected
                              ? accent.tomato
                              : accent.main,
                          opacity:
                            isConfirmed || isSelected
                              ? 0.85
                              : opacity * 0.95,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover && hover.count > 0 && (
        <div
          className="pointer-events-none fixed z-50 max-w-[min(240px,calc(100vw-24px))] -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: hover.x, top: Math.max(hover.y - 8, 48) }}
        >
          <p className="font-semibold text-emerald-300">
            {hover.count}/{room.participants.length}명 가능
          </p>
          <p className="mt-0.5 break-words text-slate-300">
            {hover.names.join(', ')}
          </p>
          {onSelectRange && (
            <p className="mt-1 text-[10px] text-[var(--tomato-soft)]">
              드래그하면 그 길이로 확정할 수 있어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
