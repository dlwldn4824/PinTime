import {
  EVENT_COLORS,
  type EventColorId,
} from '../lib/eventColors'

type ColorPickerProps = {
  value: EventColorId
  onChange: (color: EventColorId) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">색상</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {EVENT_COLORS.map((c) => {
          const on = value === c.id
          return (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              onClick={() => onChange(c.id)}
              className={`h-7 w-7 rounded-full transition ${
                on ? 'ring-2 ring-offset-2 ring-slate-400 scale-105' : 'hover:scale-105'
              }`}
              style={{ background: c.solid }}
            />
          )
        })}
      </div>
    </div>
  )
}
