const ORDER_KEY = 'pintime:dayAgendaOrder:v1'

export type DayAgendaOrderMap = Record<string, string[]>

export function loadDayAgendaOrders(): DayAgendaOrderMap {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DayAgendaOrderMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function saveDayAgendaOrder(date: string, ids: string[]) {
  const all = loadDayAgendaOrders()
  if (ids.length === 0) delete all[date]
  else all[date] = ids
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/** 저장된 순서가 있으면 적용, 없으면 null → 호출측에서 시간순 */
export function orderIdsForDate(date: string): string[] | null {
  const ids = loadDayAgendaOrders()[date]
  return ids && ids.length > 0 ? ids : null
}

export function applyCustomOrder<T>(
  items: T[],
  getId: (item: T) => string,
  orderIds: string[] | null,
): T[] {
  if (!orderIds?.length) return items
  const map = new Map(items.map((item) => [getId(item), item]))
  const ordered: T[] = []
  for (const id of orderIds) {
    const hit = map.get(id)
    if (hit) {
      ordered.push(hit)
      map.delete(id)
    }
  }
  for (const item of items) {
    if (map.has(getId(item))) ordered.push(item)
  }
  return ordered
}
