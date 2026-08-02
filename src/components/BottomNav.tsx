import { CalendarDays, Link2, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '에이전트', icon: Sparkles, end: true },
  { to: '/calendar', label: '캘린더', icon: CalendarDays, end: false },
  { to: '/share', label: '공유', icon: Link2, end: false },
]

export function BottomNav() {
  return (
    <nav className="shrink-0 border-t border-[var(--line)] bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg gap-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-3 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-sky-50 text-[var(--pin)]'
                  : 'text-[var(--muted)] hover:bg-slate-50'
              }`
            }
          >
            <Icon size={20} strokeWidth={2.25} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
