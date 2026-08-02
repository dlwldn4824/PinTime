import { FileText, Link2, MapPin, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { RepeatPickerModal, repeatLabel } from './RepeatPickerModal'

export type EventExtras = {
  repeat?: string
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
}

export function EventExtrasBar({ value, onChange }: EventExtrasBarProps) {
  const [active, setActive] = useState<FieldKey | null>(null)
  const [repeatOpen, setRepeatOpen] = useState(false)

  const toggle = (key: FieldKey) => {
    setActive((prev) => (prev === key ? null : key))
  }

  const activeChip = CHIPS.find((c) => c.key === active)
  const repeatFilled = Boolean(value.repeat?.trim())

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-violet-400">
          <Plus size={18} strokeWidth={2.25} />
        </span>

        <button
          type="button"
          onClick={() => {
            setActive(null)
            setRepeatOpen(true)
          }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            repeatFilled
              ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
          }`}
        >
          <Repeat
            size={14}
            className={repeatFilled ? 'text-violet-500' : 'text-violet-400'}
          />
          {repeatLabel(value.repeat)}
        </button>

        {CHIPS.map(({ key, label, icon: Icon }) => {
          const filled = Boolean(value[key]?.trim())
          const on = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                on || filled
                  ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Icon
                size={14}
                className={on || filled ? 'text-violet-500' : 'text-violet-400'}
              />
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
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          ) : (
            <input
              value={value[activeChip.key] ?? ''}
              onChange={(e) =>
                onChange({ ...value, [activeChip.key]: e.target.value })
              }
              placeholder={activeChip.placeholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          )}
        </div>
      )}

      <RepeatPickerModal
        open={repeatOpen}
        value={value.repeat}
        onClose={() => setRepeatOpen(false)}
        onSelect={(repeat) => onChange({ ...value, repeat })}
      />
    </div>
  )
}
