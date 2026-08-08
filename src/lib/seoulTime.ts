/** 앱 전역에서 쓰는 한국 표준시 타임존 (중복 문자열 금지) */
export const SEOUL_TIME_ZONE = 'Asia/Seoul'

const seoulDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SEOUL_TIME_ZONE,
  day: 'numeric',
})

const seoulDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 기준 오늘 일(1–31). `now`로 테스트 가능 */
export function seoulDayOfMonth(now: Date = new Date()): number {
  const day = Number(seoulDayFormatter.format(now))
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid Seoul day of month: ${day}`)
  }
  return day
}

/** Asia/Seoul 기준 YYYY-MM-DD */
export function seoulDateKey(now: Date = new Date()): string {
  return seoulDateFormatter.format(now)
}

/**
 * 다음 Asia/Seoul 자정까지 남은 ms.
 * 이진 탐색으로 타임존 오프셋/서머타임에 의존하지 않음.
 */
export function msUntilNextSeoulMidnight(now: Date = new Date()): number {
  const today = seoulDateKey(now)
  let lo = now.getTime()
  let hi = lo + 36 * 60 * 60 * 1000
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (seoulDateKey(new Date(mid)) === today) lo = mid
    else hi = mid
  }
  return Math.max(hi - now.getTime(), 1)
}
