import { Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { toneOf } from '../lib/eventColors'
import { expandSchedulesInRange } from '../lib/recurrence'
import {
  type AllDayEvent,
  type Schedule,
  parseDateKey,
  weekdayOfDateKey,
} from '../types'

type DayAgendaSheetProps = {
  open: boolean
  date: string
  schedules: Schedule[]
  allDay: AllDayEvent[]
  onClose: () => void
  onAdd: () => void
  onSelectSchedule: (schedule: Schedule) => void
  onSelectAllDay: (event: AllDayEvent) => void
}

function formatDateKo(dateKey: string) {
  const d = parseDateKey(dateKey)
  const day = weekdayOfDateKey(dateKey)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`
}

export function DayAgendaSheet({
  open,
  date,
  schedules,
  allDay,
  onClose,
  onAdd,
  onSelectSchedule,
  onSelectAllDay,
}: DayAgendaSheetProps) {
  const timed = useMemo(
    () =>
      expandSchedulesInRange(schedules, date, date).sort(
        (a, b) => a.start.localeCompare(b.start),
      ),
    [schedules, date],
  )

  const days = useMemo(
    () =>
      allDay
        .filter((e) => e.startDate <= date && e.endDate >= date)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [allDay, date],
  )

  if (!open) return null

  const empty = timed.length === 0 && days.length === 0

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 px-3 pb-3 backdrop-blur-[2px] sm:items-center sm:pb-0"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[min(78dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl shadow-slate-900/15"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
              이날의 일정
            </p>
            <h2 className="mt-0.5 text-base font-bold text-[var(--ink)]">
              {formatDateKo(date)}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--tomato)] px-3 py-2 text-xs font-bold text-white transition hover:bg-[var(--tomato-deep)]"
            >
              <Plus size={14} strokeWidth={2.5} />
              추가
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="pt-scroll min-h-0 flex-1 overflow-auto px-3 py-3">
          {empty ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">
                등록된 일정이 없어요
              </p>
              <p className="text-xs text-slate-400">
                + 추가를 눌러 이 날짜에 일정을 만들어 보세요
              </p>
              <button
                type="button"
                onClick={onAdd}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[var(--tomato)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--tomato-deep)]"
              >
                <Plus size={16} />
                일정 추가
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {days.map((e) => {
                const tone = toneOf(e.color)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelectAllDay(e)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-[0.98]"
                      style={{ background: `${tone.solid}18` }}
                    >
                      <span
                        className="mt-1 h-8 w-1 shrink-0 rounded-full"
                        style={{ background: tone.solid }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          하루 종일
                          {e.startDate !== e.endDate
                            ? ` · ${e.startDate} – ${e.endDate}`
                            : ''}
                        </p>
                        <p
                          className="truncate text-sm font-bold"
                          style={{ color: tone.text }}
                        >
                          {e.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          눌러서 수정
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
              {timed.map((s) => {
                const tone = toneOf(s.color)
                const master =
                  schedules.find((x) => x.id === s.id) ?? (s as Schedule)
                return (
                  <li key={s.occurrenceId}>
                    <button
                      type="button"
                      onClick={() => onSelectSchedule(master)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-[0.98]"
                      style={{ background: `${tone.solid}18` }}
                    >
                      <span
                        className="mt-1 h-8 w-1 shrink-0 rounded-full"
                        style={{ background: tone.solid }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          {s.start} – {s.end}
                        </p>
                        <p
                          className="truncate text-sm font-bold"
                          style={{ color: tone.text }}
                        >
                          {s.title}
                        </p>
                        {s.location ? (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {s.location}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            눌러서 수정
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
