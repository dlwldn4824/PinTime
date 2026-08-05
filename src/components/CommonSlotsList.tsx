import { useMemo } from 'react'
import { rankedCommonSlots } from '../lib/room'
import { slotKeyToAppointment, type ConfirmRange } from '../lib/slots'
import type { ShareRoom } from '../types'

type CommonSlotsListProps = {
  room: ShareRoom
  selectedRange?: ConfirmRange | null
  onPick?: (range: ConfirmRange) => void
}

/** 전원·다수가 겹치는 가능 시간 추천 목록 */
export function CommonSlotsList({
  room,
  selectedRange = null,
  onPick,
}: CommonSlotsListProps) {
  const ranked = useMemo(() => rankedCommonSlots(room).slice(0, 8), [room])
  const total = room.participants.length

  if (total < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5">
        <p className="text-[11px] font-bold text-slate-700">공통 가능 시간</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          친구가 가능 시간을 등록·전달하면, 겹치는 시간이 여기에 나타나요.
        </p>
      </div>
    )
  }

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
        <p className="text-[11px] font-bold text-amber-900">공통 가능 시간</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/90">
          아직 겹치는 시간이 없어요. 위 표에서 초록이 진한 칸을 확인하거나,
          시간을 다시 등록해 보세요.
        </p>
      </div>
    )
  }

  const everyone = ranked.filter((r) => r.everyone)
  const shown = everyone.length > 0 ? everyone.slice(0, 6) : ranked.slice(0, 6)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold text-emerald-950">
          {everyone.length > 0 ? '모두 가능한 시간' : '가장 많이 겹치는 시간'}
        </p>
        <p className="text-[10px] font-medium text-emerald-800/70">
          {total}명 기준 · {shown.length}개
        </p>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {shown.map((item) => {
          const appt = slotKeyToAppointment(room, item.slot, 30)
          const label = appt?.label ?? item.slot
          const active =
            selectedRange?.startSlot === item.slot &&
            (selectedRange.durationMin ?? 30) === 30
          return (
            <li key={item.slot}>
              <button
                type="button"
                disabled={!onPick}
                onClick={() =>
                  onPick?.({ startSlot: item.slot, durationMin: 30 })
                }
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-800 ring-1 ring-emerald-100 hover:ring-emerald-300'
                } disabled:cursor-default`}
              >
                <span className="min-w-0 truncate font-semibold">{label}</span>
                <span
                  className={`shrink-0 text-[10px] font-bold ${
                    active ? 'text-emerald-100' : 'text-emerald-700'
                  }`}
                >
                  {item.count}/{total}명
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
