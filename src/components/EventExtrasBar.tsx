import { FileText, Link2, MapPin, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { toneOf, type EventColorId } from '../lib/eventColors'
import { RepeatPickerModal, repeatLabel } from './RepeatPickerModal'

export type EventExtras = {
  repeat?: string
  /** 반복 종료일 (YYYY-MM-DD, inclusive) */
  repeatUntil?: string
  location?: string
  link?: string
  memo?: string
}

type FieldKey = 'location' | 'link' | 'memo'

const CHIPS: Array<{
  key: FieldKey
  label: string
  icon: typeof Repeat
  placeholder: string
}> = [
  { key: 'location', label: '장소', icon: MapPin, placeholder: '장소 입력' },
  { key: 'link', label: '링크', icon: Link2, placeholder: 'https://' },
  { key: 'memo', label: '메모', icon: FileText, placeholder: '메모 입력' },
]

type EventExtrasBarProps = {
  value: EventExtras
  onChange: (next: EventExtras) => void
  /** 반복 시작 기준일 — 종료일 최소값 */
  repeatAnchorDate?: string
  /** 일정 색상 — 아이콘·칩 강조색 */
  accentColor?: EventColorId | string
}

export function EventExtrasBar({
  value,
  onChange,
  repeatAnchorDate,
  accentColor,
}: EventExtrasBarProps) {
  const [active, setActive] = useState<FieldKey | null>(null)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const tone = toneOf(accentColor)

  const toggle = (key: FieldKey) => {
    setActive((prev) => (prev === key ? null : key))
  }

  const activeChip = CHIPS.find((c) => c.key === active)
  const repeatFilled = Boolean(value.repeat?.trim())

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          style={{ color: tone.solid }}
        >
          <Plus size={18} strokeWidth={2.25} />
        </span>

        <button
          type="button"
          onClick={() => {
            setActive(null)
            setRepeatOpen(true)
          }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            repeatFilled ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
          }`}
          style={
            repeatFilled
              ? {
                  background: tone.soft,
                  color: tone.text,
                  boxShadow: `inset 0 0 0 1px ${tone.solid}40`,
                }
              : undefined
          }
        >
          <Repeat size={14} style={{ color: tone.solid }} />
          {repeatLabel(value.repeat, value.repeatUntil)}
        </button>

        {CHIPS.map(({ key, label, icon: Icon }) => {
          const filled = Boolean(value[key]?.trim())
          const on = active === key
          const accent = on || filled
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                accent ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
              style={
                accent
                  ? {
                      background: tone.soft,
                      color: tone.text,
                      boxShadow: `inset 0 0 0 1px ${tone.solid}40`,
                    }
                  : undefined
              }
            >
              <Icon size={14} style={{ color: tone.solid }} />
              {label}
            </button>
          )
        })}
      </div>

      {activeChip && (
        <div className="mt-2">
          {activeChip.key === 'memo' ? (
            <textarea
              value={value.memo ?? ''}
              onChange={(e) =>
                onChange({ ...value, memo: e.target.value })
              }
              placeholder={activeChip.placeholder}
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:bg-white"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tone.solid
                e.currentTarget.style.boxShadow = `0 0 0 2px ${tone.soft}`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = ''
              }}
            />
          ) : (
            <input
              value={value[activeChip.key] ?? ''}
              onChange={(e) =>
                onChange({ ...value, [activeChip.key]: e.target.value })
              }
              placeholder={activeChip.placeholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:bg-white"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tone.solid
                e.currentTarget.style.boxShadow = `0 0 0 2px ${tone.soft}`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = ''
              }}
            />
          )}
        </div>
      )}

      <RepeatPickerModal
        open={repeatOpen}
        value={value.repeat}
        until={value.repeatUntil}
        minUntil={repeatAnchorDate}
        onClose={() => setRepeatOpen(false)}
        onSelect={({ repeat, until }) =>
          onChange({
            ...value,
            repeat: repeat || undefined,
            repeatUntil: repeat ? until : undefined,
          })
        }
      />
    </div>
  )
}
