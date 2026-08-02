import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

export const REPEAT_OPTIONS = [
  { value: 'none', label: '안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
] as const

export type RepeatPreset = (typeof REPEAT_OPTIONS)[number]['value']

type RepeatPickerModalProps = {
  open: boolean
  value?: string
  onClose: () => void
  onSelect: (value: string) => void
}

function normalizeRepeat(value?: string): string {
  if (!value || value === '안 함') return 'none'
  const preset = REPEAT_OPTIONS.find(
    (o) => o.value === value || o.label === value,
  )
  if (preset) return preset.value
  return 'custom'
}

export function repeatLabel(value?: string): string {
  if (!value || value === 'none' || value === '안 함') return '반복'
  const preset = REPEAT_OPTIONS.find(
    (o) => o.value === value || o.label === value,
  )
  if (preset) return preset.label
  return value
}

export function RepeatPickerModal({
  open,
  value,
  onClose,
  onSelect,
}: RepeatPickerModalProps) {
  const [selected, setSelected] = useState('none')
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')

  useEffect(() => {
    if (!open) return
    const n = normalizeRepeat(value)
    setSelected(n)
    if (n === 'custom') {
      setCustomText(value && !REPEAT_OPTIONS.some((o) => o.value === value || o.label === value) ? value : '')
      setCustomOpen(false)
    } else {
      setCustomText('')
      setCustomOpen(false)
    }
  }, [open, value])

  if (!open) return null

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
              if (customOpen) setCustomOpen(false)
              else onClose()
            }}
            className="absolute left-3 rounded-lg p-1 text-slate-600 hover:bg-black/5"
            aria-label="뒤로"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-[17px] font-semibold text-slate-900">
            {customOpen ? '사용자화' : '반복'}
          </h2>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4">
          {!customOpen ? (
            <>
              <ul className="overflow-hidden rounded-2xl bg-white">
                {REPEAT_OPTIONS.map((opt, i) => {
                  const on = selected === opt.value
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(opt.value)
                          onSelect(opt.value === 'none' ? '' : opt.label)
                          onClose()
                        }}
                        className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] text-slate-900 ${
                          i > 0 ? 'border-t border-slate-100' : ''
                        }`}
                      >
                        <span>{opt.label}</span>
                        {on && (
                          <Check size={20} className="text-emerald-500" strokeWidth={2.5} />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-[16px] text-slate-900"
              >
                <span>사용자화</span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            </>
          ) : (
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-medium text-slate-500">반복 규칙</p>
              <input
                autoFocus
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="예: 2주마다 월·수"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                disabled={!customText.trim()}
                onClick={() => {
                  onSelect(customText.trim())
                  onClose()
                }}
                className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                적용
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
