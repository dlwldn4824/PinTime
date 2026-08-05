import {
  DAYS,
  type Day,
  addDays,
  toDateKey,
  weekdayOfDateKey,
} from '../types'

export type ParsedIntent = {
  raw: string
  participants: string[]
  food?: string
  activity: string
  period: 'next_week' | 'this_week' | 'unspecified'
  summary: string
}

export type PersonConstraint = {
  name: string
  bullets: string[]
  excludeDays: Day[]
  preferDays: Day[]
  earliestHour?: number
  eveningOk: boolean
  avoidAreas: string[]
}

export type SharedConstraint = {
  bullets: string[]
  periodLabel: string
  foodLabel?: string
  eveningRequired: boolean
  earliestHour: number
}

export type VenuePick = {
  area: string
  name: string
  costPerPerson: number
  walkMin: number
  bookingUrl: string
}

export type AppointmentCandidate = {
  id: string
  date: string
  day: Day
  start: string
  end: string
  startHour: number
  venue: VenuePick
  reason: string
  score: number
}

export type AgentProposal = {
  intent: ParsedIntent
  people: PersonConstraint[]
  shared: SharedConstraint
  primary: AppointmentCandidate
  alternatives: AppointmentCandidate[]
}

const DAY_ALIASES: Array<{ day: Day; patterns: RegExp[] }> = [
  { day: '월', patterns: [/월요일/, /월요/, /\b월\b/] },
  { day: '화', patterns: [/화요일/, /화요/, /\b화\b/] },
  { day: '수', patterns: [/수요일/, /수요/, /\b수\b/] },
  { day: '목', patterns: [/목요일/, /목요/, /\b목\b/] },
  { day: '금', patterns: [/금요일/, /금요/, /\b금\b/] },
  { day: '토', patterns: [/토요일/, /토요/, /\b토\b/] },
  { day: '일', patterns: [/일요일/, /일요/, /주말/] },
]

const FOOD_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '고기', re: /고기|삼겹|갈비|숯불|한우|스테이크/ },
  { label: '술', re: /술|맥주|호프| thr/ },
  { label: '카페', re: /카페|커피|브런치/ },
  { label: '밥', re: /밥|식사|점심|저녁\s*먹/ },
]

const AREA_AVOID: Array<{ key: string; re: RegExp }> = [
  { key: '강남', re: /강남/ },
  { key: '홍대', re: /홍대/ },
  { key: '잠실', re: /잠실/ },
]

const VENUES: VenuePick[] = [
  {
    area: '건대입구',
    name: '건대입구 숯불고기집',
    costPerPerson: 25000,
    walkMin: 4,
    bookingUrl: 'https://example.com/reserve/konkuk-bbq',
  },
  {
    area: '성수',
    name: '성수 고깃집 골목',
    costPerPerson: 28000,
    walkMin: 6,
    bookingUrl: 'https://example.com/reserve/seongsu-bbq',
  },
  {
    area: '왕십리',
    name: '왕십리 한우촌',
    costPerPerson: 32000,
    walkMin: 5,
    bookingUrl: 'https://example.com/reserve/wangsimni',
  },
]

export const DEMO_CHAT = `민수: 월요일은 안 되고 저녁은 괜찮아
영희: 퇴근하고 가능해. 강남은 너무 멀어
나: 화요일이나 목요일이면 좋을 듯`

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function mondayOfWeek(from: Date): Date {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  const js = d.getDay()
  d.setDate(d.getDate() + (js === 0 ? -6 : 1 - js))
  return d
}

function nextWeekRange(from = new Date()): { start: string; end: string } {
  const thisMon = mondayOfWeek(from)
  const nextMon = new Date(thisMon)
  nextMon.setDate(thisMon.getDate() + 7)
  const nextFri = new Date(nextMon)
  nextFri.setDate(nextMon.getDate() + 4)
  return { start: toDateKey(nextMon), end: toDateKey(nextFri) }
}

function thisWeekRange(from = new Date()): { start: string; end: string } {
  const mon = mondayOfWeek(from)
  const today = toDateKey(from)
  const fri = addDays(toDateKey(mon), 4)
  return { start: today > toDateKey(mon) ? today : toDateKey(mon), end: fri }
}

/** 의도 period → 조회/제안용 날짜 범위 */
export function resolvePeriodRange(
  period: ParsedIntent['period'],
  now = new Date(),
): { start: string; end: string } {
  if (period === 'this_week') return thisWeekRange(now)
  return nextWeekRange(now)
}

export type BusyWindow = {
  date: string
  start: string
  end: string
  title: string
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return timeToMin(aStart) < timeToMin(bEnd) && timeToMin(bStart) < timeToMin(aEnd)
}

function extractDays(text: string): Day[] {
  const found: Day[] = []
  for (const { day, patterns } of DAY_ALIASES) {
    if (patterns.some((re) => re.test(text))) found.push(day)
  }
  return uniq(found)
}

function splitSpeakerLines(chat: string): Array<{ name: string; text: string }> {
  const lines = chat
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const out: Array<{ name: string; text: string }> = []
  for (const line of lines) {
    const m = line.match(/^([^:：\-]{1,12})\s*[:：\-]\s*(.+)$/)
    if (m) {
      out.push({ name: m[1].trim(), text: m[2].trim() })
      continue
    }
    const spaced = line.match(/^([가-힣A-Za-z]{1,8})\s+(.+)$/)
    if (spaced) {
      out.push({ name: spaced[1].trim(), text: spaced[2].trim() })
    }
  }
  return out
}

export function parseIntent(raw: string): ParsedIntent {
  const text = raw.trim()
  const participants: string[] = []

  // "민수, 영희랑" / "민수 영희랑" / "민수와 영희"
  const withMatch = text.match(
    /([가-힣A-Za-z0-9]+(?:\s*[,，]\s*[가-힣A-Za-z0-9]+)*)\s*(?:이랑|랑|와|과)\s*/,
  )
  if (withMatch) {
    for (const p of withMatch[1].split(/\s*[,，]\s*|\s+/)) {
      const name = p.trim()
      if (name && !/다음|이번|주|밥|고기|약속/.test(name)) participants.push(name)
    }
  }

  let food: string | undefined
  for (const f of FOOD_PATTERNS) {
    if (f.re.test(text)) {
      food = f.label
      break
    }
  }

  let period: ParsedIntent['period'] = 'unspecified'
  if (/다음\s*주|담주|차주/.test(text)) period = 'next_week'
  else if (/이번\s*주|금주/.test(text)) period = 'this_week'

  const activity = food
    ? `${food} 약속`
    : /밥|먹|모이|만나/.test(text)
      ? '밥 약속'
      : '약속'

  const who =
    participants.length > 0 ? participants.join(', ') : '참석자'
  const when =
    period === 'next_week'
      ? '다음 주'
      : period === 'this_week'
        ? '이번 주'
        : '조율 가능한 기간'
  const what = food ? `${food}` : '만남'

  return {
    raw: text,
    participants: uniq(participants),
    food,
    activity,
    period,
    summary: `${when} ${who}와 ${what}`,
  }
}

function parsePersonLine(name: string, text: string): PersonConstraint {
  const bullets: string[] = []
  const excludeDays: Day[] = []
  const preferDays: Day[] = []
  const avoidAreas: string[] = []
  let earliestHour: number | undefined
  let eveningOk = false

  const days = extractDays(text)
  const negative =
    /안\s*돼|안돼|불가|빼고|제외|싫어|너무\s*멀|말고|어려|힘들/.test(text)
  const prefer =
    /이면\s*좋|좋을|가능|괜찮|되[고겠]|prefer|좋아|희망/.test(text) &&
    !negative

  // Day exclude: "월요일은 안" patterns near day names
  for (const day of days) {
    const dayRe = new RegExp(
      `${day}요일[^.]{0,8}(안\\s*돼|안돼|불가|빼고|제외)|${day}요[^.]{0,6}(안\\s*돼|안돼)`,
    )
    if (
      dayRe.test(text) ||
      (negative && /안\s*돼|안돼|불가/.test(text) && days.length === 1)
    ) {
      excludeDays.push(day)
    } else if (
      /이나|또는|랑|하고|든지/.test(text) ||
      prefer ||
      /좋/.test(text)
    ) {
      preferDays.push(day)
    } else if (!negative) {
      preferDays.push(day)
    }
  }

  // Refine: "월요일은 안 되고" clearly exclude
  if (/월요일[^.]{0,12}안/.test(text)) {
    if (!excludeDays.includes('월')) excludeDays.push('월')
    preferDays.splice(0, preferDays.length, ...preferDays.filter((d) => d !== '월'))
  }
  if (/화요일[^.]{0,12}안/.test(text)) {
    if (!excludeDays.includes('화')) excludeDays.push('화')
  }
  if (/목요일[^.]{0,12}안/.test(text)) {
    if (!excludeDays.includes('목')) excludeDays.push('목')
  }

  // "화요일이나 목요일"
  if (/화요일이나\s*목요일|화요[^.]{0,4}목요|화\s*[/·,]\s*목/.test(text)) {
    for (const d of ['화', '목'] as Day[]) {
      if (!preferDays.includes(d)) preferDays.push(d)
      const i = excludeDays.indexOf(d)
      if (i >= 0) excludeDays.splice(i, 1)
    }
  }

  if (/저녁/.test(text) && !/저녁\s*안/.test(text)) {
    eveningOk = true
    bullets.push('저녁 가능')
  }
  if (/퇴근/.test(text)) {
    earliestHour = 19
    eveningOk = true
    bullets.push('퇴근 이후(19시~)')
  }
  if (/밤|늦게/.test(text)) {
    earliestHour = Math.max(earliestHour ?? 0, 20) || 20
    eveningOk = true
    bullets.push('늦은 시간 선호')
  }

  for (const area of AREA_AVOID) {
    if (area.re.test(text) && /멀|싫|말고|제외|피하|안\s*가/.test(text)) {
      avoidAreas.push(area.key)
      bullets.push(`${area.key} 제외`)
    }
  }

  for (const d of uniq(excludeDays)) {
    bullets.push(`${d}요일 제외`)
  }
  if (preferDays.length) {
    bullets.push(`${uniq(preferDays).map((d) => `${d}요일`).join('·')} 선호`)
  }

  if (bullets.length === 0) {
    bullets.push(text.slice(0, 40))
  }

  return {
    name,
    bullets: uniq(bullets),
    excludeDays: uniq(excludeDays),
    preferDays: uniq(preferDays),
    earliestHour,
    eveningOk,
    avoidAreas: uniq(avoidAreas),
  }
}

export function extractConstraints(
  intent: ParsedIntent,
  chat: string,
): { people: PersonConstraint[]; shared: SharedConstraint } {
  const lines = splitSpeakerLines(chat)
  const peopleMap = new Map<string, PersonConstraint>()

  for (const p of intent.participants) {
    peopleMap.set(p, {
      name: p,
      bullets: [],
      excludeDays: [],
      preferDays: [],
      eveningOk: false,
      avoidAreas: [],
    })
  }

  for (const line of lines) {
    const key =
      line.name === '나' || line.name === '저' || line.name === 'me'
        ? '나'
        : line.name
    const parsed = parsePersonLine(key, line.text)
    const prev = peopleMap.get(key)
    if (!prev) {
      peopleMap.set(key, parsed)
    } else {
      peopleMap.set(key, {
        name: key,
        bullets: uniq([...prev.bullets, ...parsed.bullets]),
        excludeDays: uniq([...prev.excludeDays, ...parsed.excludeDays]),
        preferDays: uniq([...prev.preferDays, ...parsed.preferDays]),
        earliestHour:
          prev.earliestHour != null && parsed.earliestHour != null
            ? Math.max(prev.earliestHour, parsed.earliestHour)
            : (parsed.earliestHour ?? prev.earliestHour),
        eveningOk: prev.eveningOk || parsed.eveningOk,
        avoidAreas: uniq([...prev.avoidAreas, ...parsed.avoidAreas]),
      })
    }
  }

  const people = [...peopleMap.values()].filter(
    (p) => p.bullets.length > 0 || intent.participants.includes(p.name),
  )

  const avoidAreas = uniq(people.flatMap((p) => p.avoidAreas))
  const eveningRequired =
    people.some((p) => p.eveningOk) || Boolean(intent.food)
  const earliestHour = Math.max(
    18,
    ...people.map((p) => p.earliestHour ?? 18),
  )

  const periodLabel =
    intent.period === 'next_week'
      ? '다음 주 평일'
      : intent.period === 'this_week'
        ? '이번 주 평일'
        : '가까운 평일'

  const sharedBullets = [
    `${periodLabel} 저녁`,
    intent.food ? `${intent.food}집` : '식사',
  ]
  if (avoidAreas.length) sharedBullets.push(`${avoidAreas.join('·')} 제외`)
  if (earliestHour >= 19) sharedBullets.push(`${earliestHour}시 이후`)

  return {
    people,
    shared: {
      bullets: sharedBullets,
      periodLabel,
      foodLabel: intent.food,
      eveningRequired,
      earliestHour,
    },
  }
}

function pickVenue(avoidAreas: string[], food?: string): VenuePick {
  const pool = VENUES.filter((v) => !avoidAreas.some((a) => v.area.includes(a)))
  const list = pool.length ? pool : VENUES
  // 고기 → 건대 우선
  if (food === '고기') {
    return list.find((v) => v.area === '건대입구') ?? list[0]
  }
  return list[0]
}

function hourLabel(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function proposeAppointment(
  intent: ParsedIntent,
  chat: string,
  now = new Date(),
  opts?: { busy?: BusyWindow[] },
): AgentProposal {
  const { people, shared } = extractConstraints(intent, chat)
  const range = resolvePeriodRange(intent.period, now)
  const busy = opts?.busy ?? []

  const excludeDays = uniq(people.flatMap((p) => p.excludeDays))
  const preferDays = uniq(people.flatMap((p) => p.preferDays))
  const avoidAreas = uniq(people.flatMap((p) => p.avoidAreas))
  const venue = pickVenue(avoidAreas, intent.food)

  const startHours = [18.5, 19, 19.5, 20]
  const candidates: AppointmentCandidate[] = []

  let cur = range.start
  while (cur <= range.end) {
    const day = weekdayOfDateKey(cur)
    if (DAYS.indexOf(day) <= 4) {
      for (const startHour of startHours) {
        if (startHour + 0.01 < shared.earliestHour) continue
        let score = 40

        if (excludeDays.includes(day)) score -= 100
        if (preferDays.length) {
          if (preferDays.includes(day)) score += 35
          else score -= 8
        }
        // 퇴근 후 여유: 19:30 가산
        if (Math.abs(startHour - 19.5) < 0.01) score += 18
        else if (Math.abs(startHour - 19) < 0.01) score += 12
        else if (startHour < 19) score -= 6

        if (day === '목' && preferDays.includes('목')) score += 6
        if (day === '화' && preferDays.includes('화')) score += 4

        // 주중 목 > 화 > 수 > 금 > 월 기본 선호
        const dayBias: Partial<Record<Day, number>> = {
          목: 5,
          화: 4,
          수: 2,
          금: 1,
          월: -2,
        }
        score += dayBias[day] ?? 0

        if (venue.area === '건대입구' && avoidAreas.includes('강남')) score += 10

        const endHour = startHour + 2
        const start = hourLabel(startHour)
        const end = hourLabel(endHour)
        const hitBusy = busy.some(
          (b) =>
            b.date === cur && rangesOverlap(start, end, b.start, b.end),
        )
        if (hitBusy) score -= 120

        candidates.push({
          id: `${cur}@${start}`,
          date: cur,
          day,
          start,
          end,
          startHour,
          venue,
          reason: '',
          score,
        })
      }
    }
    cur = addDays(cur, 1)
  }

  candidates.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
  const viable = candidates.filter((c) => c.score > 0)
  const ranked = (viable.length ? viable : candidates).slice(0, 5)

  const primary = ranked[0] ?? {
    id: 'fallback',
    date: range.start,
    day: weekdayOfDateKey(range.start),
    start: '19:30',
    end: '21:30',
    startHour: 19.5,
    venue,
    reason: '',
    score: 0,
  }

  const who =
    intent.participants.length > 0
      ? intent.participants.join('·')
      : people
          .map((p) => p.name)
          .filter((n) => n !== '나')
          .join('·') || '참석자'

  primary.reason = `${who}의 가능 시간·이동 거리를 고려해 ${primary.day}요일 ${primary.start}, ${primary.venue.area}로 잡았어요.`

  const alternatives = ranked.slice(1, 4).map((c) => ({
    ...c,
    reason: `${c.day}요일 ${c.start} · ${c.venue.area}`,
  }))

  return { intent, people, shared, primary, alternatives }
}

export function runAgentPipeline(
  request: string,
  chat: string,
  now = new Date(),
): AgentProposal {
  const intent = parseIntent(request)
  return proposeAppointment(intent, chat, now)
}
