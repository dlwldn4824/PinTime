import type { AllDayEvent, Schedule } from '../types'
import {
  extractConstraints,
  parseIntent,
  proposeAppointment,
  resolvePeriodRange,
  type AgentProposal,
  type AppointmentCandidate,
  type BusyWindow,
  type ParsedIntent,
} from './agentParse'
import type { AgentMemory, ToolCall, ToolName, ToolResult } from './agentTypes'

export type ToolContext = {
  schedules: Schedule[]
  allDay: AllDayEvent[]
  memory: AgentMemory
  /** calendar.create 전용 — 생성된 schedule id 반환 */
  addSchedule?: (s: Omit<Schedule, 'id'>) => string
}

let callSeq = 0
function nextCallId() {
  callSeq += 1
  return `call_${String(callSeq).padStart(2, '0')}`
}

function queryBusy(
  schedules: Schedule[],
  start: string,
  end: string,
): BusyWindow[] {
  return schedules
    .filter((s) => {
      if (!s.date) return false
      return s.date >= start && s.date <= end
    })
    .map((s) => ({
      date: s.date!,
      start: s.start,
      end: s.end,
      title: s.title,
    }))
}

export function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext,
): { call: ToolCall; result: ToolResult } {
  const call: ToolCall = {
    id: nextCallId(),
    name,
    arguments: args,
    startedAt: Date.now(),
  }
  const t0 = performance.now()

  try {
    let content: unknown

    switch (name) {
      case 'intent.parse': {
        const request = String(args.request ?? '')
        const intent = parseIntent(request)
        content = {
          intent,
          summary: intent.summary,
          participants: intent.participants,
          food: intent.food ?? null,
          period: intent.period,
        }
        break
      }
      case 'chat.extract_constraints': {
        const intent = args.intent as ParsedIntent
        const chat = String(args.chat ?? '')
        const { people, shared } = extractConstraints(intent, chat)
        content = {
          people,
          shared,
          avoidedAreas: [
            ...new Set(people.flatMap((p) => p.avoidAreas)),
          ],
        }
        break
      }
      case 'calendar.query': {
        const start = String(args.start ?? '')
        const end = String(args.end ?? '')
        const busy = queryBusy(ctx.schedules, start, end)
        const allDayHits = ctx.allDay.filter(
          (e) => e.startDate <= end && e.endDate >= start,
        )
        content = {
          range: { start, end },
          busyCount: busy.length,
          busy,
          allDayCount: allDayHits.length,
          allDay: allDayHits.map((e) => ({
            title: e.title,
            startDate: e.startDate,
            endDate: e.endDate,
          })),
        }
        break
      }
      case 'schedule.propose': {
        const intent = args.intent as ParsedIntent
        const chat = String(args.chat ?? '')
        const busy = (args.busy as BusyWindow[] | undefined) ?? []
        const proposal = proposeAppointment(intent, chat, new Date(), { busy })
        content = {
          primary: proposal.primary,
          alternatives: proposal.alternatives,
          people: proposal.people,
          shared: proposal.shared,
          conflictAvoided: busy.length > 0,
        }
        break
      }
      case 'calendar.create': {
        if (!ctx.addSchedule) {
          throw new Error('addSchedule context missing')
        }
        const candidate = args.candidate as AppointmentCandidate
        const title = String(args.title ?? '약속')
        const memo = String(args.memo ?? '')
        const scheduleId = ctx.addSchedule({
          day: candidate.day,
          date: candidate.date,
          start: candidate.start,
          end: candidate.end,
          title,
          color: 'orange',
          location: `${candidate.venue.area} · ${candidate.venue.name}`,
          link: candidate.venue.bookingUrl,
          memo,
          remind: true,
        })
        content = {
          created: true,
          scheduleId,
          date: candidate.date,
          start: candidate.start,
          end: candidate.end,
          title,
        }
        break
      }
      default:
        throw new Error(`unknown tool: ${name}`)
    }

    const endedAt = Date.now()
    const result: ToolResult = {
      callId: call.id,
      name,
      ok: true,
      content,
      endedAt,
      durationMs: Math.max(0, Math.round(performance.now() - t0)),
    }
    return { call, result }
  } catch (err) {
    const endedAt = Date.now()
    const result: ToolResult = {
      callId: call.id,
      name,
      ok: false,
      content: null,
      error: err instanceof Error ? err.message : String(err),
      endedAt,
      durationMs: Math.max(0, Math.round(performance.now() - t0)),
    }
    return { call, result }
  }
}

export function periodRangeForIntent(intent: ParsedIntent) {
  return resolvePeriodRange(intent.period)
}

export type { AgentProposal }
