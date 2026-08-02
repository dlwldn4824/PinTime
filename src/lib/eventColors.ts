export const EVENT_COLOR_IDS = [
  'tomato',
  'orange',
  'banana',
  'basil',
  'sage',
  'peacock',
  'blueberry',
  'lavender',
  'grape',
  'graphite',
] as const

export type EventColorId = (typeof EVENT_COLOR_IDS)[number]

export const DEFAULT_EVENT_COLOR: EventColorId = 'peacock'

export type EventColorTone = {
  id: EventColorId
  solid: string
  soft: string
  text: string
  label: string
}

export const EVENT_COLORS: EventColorTone[] = [
  { id: 'tomato', solid: '#d50000', soft: '#fad2cf', text: '#8b0000', label: '빨강' },
  { id: 'orange', solid: '#f4511e', soft: '#fde0d4', text: '#9a3412', label: '주황' },
  { id: 'banana', solid: '#f6bf26', soft: '#fef3c7', text: '#854d0e', label: '노랑' },
  { id: 'basil', solid: '#0b8043', soft: '#d1fae5', text: '#065f46', label: '초록' },
  { id: 'sage', solid: '#33b679', soft: '#d1fae5', text: '#047857', label: '세이지' },
  { id: 'peacock', solid: '#039be5', soft: '#dbeafe', text: '#075985', label: '파랑' },
  { id: 'blueberry', solid: '#3f51b5', soft: '#e0e7ff', text: '#312e81', label: '남색' },
  { id: 'lavender', solid: '#7986cb', soft: '#e0e7ff', text: '#3730a3', label: '라벤더' },
  { id: 'grape', solid: '#8e24aa', soft: '#f3e8ff', text: '#6b21a8', label: '보라' },
  { id: 'graphite', solid: '#616161', soft: '#e5e7eb', text: '#1f2937', label: '회색' },
]

export function toneOf(color?: string | null): EventColorTone {
  const found = EVENT_COLORS.find((c) => c.id === color)
  return found ?? EVENT_COLORS.find((c) => c.id === DEFAULT_EVENT_COLOR)!
}

/** 겹침 표시용: solid 색을 투명하게 */
export function solidAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
