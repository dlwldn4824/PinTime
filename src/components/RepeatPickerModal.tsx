import { Check, ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

export const REPEAT_OPTIONS = [
  { value: 'none', label: '안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
] as const

export type RepeatPreset = (typeof REPEAT_OPTIONS)[number]['value']

export type RepeatSelection = {
  repeat: string
  /** YYYY-MM-DD inclusive. 없으면 기한 없음 */
  until?: string
}

type RepeatPickerModalProps = {
  open: boolean
  value?: string
  until?: string
  /** 반복 시작 기준일 (종료일 최소값) */
  minUntil?: string
  onClose: () => void
  onSelect: (selection: RepeatSelection) => void
}

function normalizeRepeat(value?: string): string {
  if (!value || value === '안 함') return 'none'
  const preset = REPEAT_OPTIONS.find(
    (o) => o.value === value || o.label === value,
  )
  if (preset) return preset.value
  // 예전 사용자화 문자열 → 표시만 none 취급 (펼치지 않음)
  return 'none'
}

export function repeatLabel(value?: string, until?: string): string {
  if (!value || value === 'none' || value === '안 함') return '반복'
  const preset = REPEAT_OPTIONS.find(
    (o) => o.value === value || o.label === value,
  )
  const base = preset ? preset.label : value
  if (!preset) return '반복'
  if (!until) return base
  const m = until.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return `${base} · ~${until}`
  return `${base} · ~${Number(m[2])}/${Number(m[3])}`
}

/**
 * 반복 선택:
 * - 안 함 / 매일~매년 원탭 → 기한 없음으로 바로 적용
 * - 「기간 정하기」로 종료일 지정 후 적용
 */
export function RepeatPickerModal({
  open,
  value,
  until,
  minUntil,
  onClose,
  onSelect,
}: RepeatPickerModalProps) {
  const [selected, setSelected] = useState('none')
  const [untilOpen, setUntilOpen] = useState(false)
  const [untilDate, setUntilDate] = useState('')

  useEffect(() => {
    if (!open) return
    const n = normalizeRepeat(value)
    setSelected(n === 'none' && value && value !== '안 함' && value !== 'none' ? 'none' : n)
    setUntilDate(until || minUntil || '')
    setUntilOpen(Boolean(until))
  }, [open, value, until, minUntil])

  if (!open) return null

  const applyPreset = (optValue: string, optLabel: string) => {
    if (optValue === 'none') {
      onSelect({ repeat: '', until: undefined })
      onClose()
      return
    }
    onSelect({ repeat: optLabel, until: undefined })
    onClose()
  }

  const applyWithUntil = () => {
    if (selected === 'none') {
      onSelect({ repeat: '', until: undefined })
      onClose()
      return
    }
    const preset = REPEAT_OPTIONS.find((o) => o.value === selected)
    if (!preset || preset.value === 'none') return
    if (!untilDate.trim()) {
      window.alert('종료일을 선택해 주세요.')
      return
    }
    if (minUntil && untilDate < minUntil) {
      window.alert('반복 종료일은 시작일 이후여야 합니다.')
      return
    }
    onSelect({ repeat: preset.label, until: untilDate.trim() })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/30 sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-[#f2f2f7] shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-black/5 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (untilOpen) setUntilOpen(false)
              else onClose()
            }}
            className="absolute left-3 rounded-lg p-1 text-slate-600 hover:bg-black/5"
            aria-label="뒤로"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-[17px] font-semibold text-slate-900">
            {untilOpen ? '반복 기간' : '반복'}
          </h2>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4">
          {!untilOpen ? (
            <>
              <ul className="overflow-hidden rounded-2xl bg-white">
                {REPEAT_OPTIONS.map((opt, i) => {
                  const on = selected === opt.value
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        onClick={() => applyPreset(opt.value, opt.label)}
                        className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] text-slate-900 ${
                          i > 0 ? 'border-t border-slate-100' : ''
                        }`}
                      >
                        <span>{opt.label}</span>
                        {on && (
                          <Check
                            size={20}
                            className="text-emerald-500"
                            strokeWidth={2.5}
                          />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                onClick={() => {
                  if (selected === 'none') setSelected('weekly')
                  setUntilOpen(true)
                  if (!untilDate && minUntil) setUntilDate(minUntil)
                }}
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3.5 text-left text-[15px] font-medium text-slate-800"
              >
                기간 정하기 (종료일)
                <span className="mt-0.5 block text-[12px] font-normal text-slate-400">
                  매주 등 + 이 날까지만 반복
                </span>
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <ul className="overflow-hidden rounded-2xl bg-white">
                {REPEAT_OPTIONS.filter((o) => o.value !== 'none').map(
                  (opt, i) => {
                    const on = selected === opt.value
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          onClick={() => setSelected(opt.value)}
                          className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] text-slate-900 ${
                            i > 0 ? 'border-t border-slate-100' : ''
                          }`}
                        >
                          <span>{opt.label}</span>
                          {on && (
                            <Check
                              size={20}
                              className="text-emerald-500"
                              strokeWidth={2.5}
                            />
                          )}
                        </button>
                      </li>
                    )
                  },
                )}
              </ul>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-medium text-slate-500">
                  이 날까지만 반복
                </p>
                <input
                  type="date"
                  value={untilDate}
                  min={minUntil}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  disabled={!untilDate.trim() || selected === 'none'}
                  onClick={applyWithUntil}
                  className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
