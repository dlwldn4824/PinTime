import {
  CalendarDays,
  Link2,
  ListTodo,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '에이전트', icon: Sparkles, end: true },
  { to: '/calendar', label: '캘린더', icon: CalendarDays, end: false },
  { to: '/share', label: '공유', icon: Link2, end: false },
  { to: '/todo', label: '할일', icon: ListTodo, end: false },
  { to: '/me', label: '마이', icon: UserRound, end: false },
] as const

type MainNavProps = {
  /** sidebar: 어두운 사이드바용 · floating: 접힌 뒤 가운데 알약 */
  variant?: 'sidebar' | 'floating'
  className?: string
}

export function MainNav({ variant = 'sidebar', className = '' }: MainNavProps) {
  const floating = variant === 'floating'

  return (
    <nav
      className={`grid grid-cols-5 gap-0.5 rounded-2xl p-1 ${
        floating
          ? 'bg-[var(--sidebar)] shadow-lg shadow-black/10 ring-1 ring-black/5'
          : 'bg-[var(--sidebar-elevated)]'
      } ${className}`}
      aria-label="주요 메뉴"
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-semibold transition sm:flex-row sm:gap-1 sm:px-1.5 sm:py-2 sm:text-[10px] ${
              isActive
                ? 'bg-[var(--tomato)] text-white shadow-sm shadow-[var(--tomato)]/30'
                : floating
                  ? 'text-white/70 hover:bg-white/10 hover:text-white'
                  : 'text-[var(--sidebar-muted)] hover:text-white'
            }`
          }
        >
          <Icon size={13} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
