import {
  CalendarDays,
  Link2,
  ListTodo,
  UserRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '캘린더', icon: CalendarDays, end: true },
  { to: '/share', label: '공유', icon: Link2, end: false },
  { to: '/todo', label: '할일', icon: ListTodo, end: false },
  { to: '/me', label: '마이', icon: UserRound, end: false },
]

export function BottomNav() {
  return (
    <nav className="shrink-0 border-t border-[var(--line)] bg-white/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold transition sm:text-[10px] ${
                isActive
                  ? 'text-[var(--tomato)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                    isActive ? 'bg-[var(--tomato-soft)]' : ''
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
