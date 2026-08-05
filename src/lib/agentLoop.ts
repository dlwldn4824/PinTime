import { createId, type AllDayEvent, type Schedule } from '../types'
import type {
  AgentProposal,
  AppointmentCandidate,
  BusyWindow,
  ParsedIntent,
} from './agentParse'
import {
  appendExecutionLog,
  loadAgentMemory,
  saveAgentMemory,
} from './agentMemory'
import type {
  AgentMemory,
  AgentRunTrace,
  ExecutionLogEntry,
  ToolCall,
  ToolResult,
} from './agentTypes'
import { executeTool, periodRangeForIntent, type ToolContext } from './agentTools'

function logEntry(
  partial: Omit<ExecutionLogEntry, 'id' | 'ts'>,
): ExecutionLogEntry {
  return {
    id: `log_${createId().slice(0, 10)}`,
    ts: Date.now(),
    ...partial,
  }
}

function applyMemoryFromProposal(
  memory: AgentMemory,
  proposal: AgentProposal,
): AgentMemory {
  const avoided = [
    ...new Set([
      ...memory.avoidedAreas,
      ...proposal.people.flatMap((p) => p.avoidAreas),
    ]),
  ]
  const notes = [
    ...memory.notes.filter(
      (n) => !n.startsWith('최근 조율:'),
    ),
    `최근 조율: ${proposal.intent.summary}`,
  ].slice(-8)

  return {
    ...memory,
    lastParticipants: proposal.intent.participants,
    lastFood: proposal.intent.food,
    avoidedAreas: avoided,
    preferredAreas: memory.preferredAreas,
    notes,
    updatedAt: Date.now(),
  }
}

export type LoopStepEvent =
  | { type: 'plan'; summary: string }
  | { type: 'tool'; call: ToolCall; result: ToolResult; summary: string }
  | { type: 'done'; trace: AgentRunTrace }

/**
 * 대화 입력 → 조건 추출 → calendar.query → 후보 제안
 * (calendar.create는 사용자 승인 후 confirmAgentRun에서 실행)
 */
export function runAgentLoop(input: {
  request: string
  chat: string
  schedules: Schedule[]
  allDay: AllDayEvent[]
  onStep?: (ev: LoopStepEvent) => void
}): AgentRunTrace {
  const runId = `run_${createId().slice(0, 10)}`
  let memory = loadAgentMemory()
  const calls: ToolCall[] = []
  const results: ToolResult[] = []
  const log: ExecutionLogEntry[] = []

  const push = (
    kind: ExecutionLogEntry['kind'],
    summary: string,
    extra?: Partial<ExecutionLogEntry>,
  ) => {
    const entry = logEntry({
      sessionId: memory.sessionId,
      runId,
      kind,
      summary,
      ...extra,
    })
    log.push(entry)
  }

  const ctx: ToolContext = {
    schedules: input.schedules,
    allDay: input.allDay,
    memory,
  }

  push('plan', '도구 계획: intent → constraints → calendar.query → schedule.propose')
  input.onStep?.({
    type: 'plan',
    summary: 'intent.parse → chat.extract_constraints → calendar.query → schedule.propose',
  })
  push('user', `지시: ${input.request.trim().slice(0, 80)}`)

  // 1) intent.parse
  {
    const { call, result } = executeTool(
      'intent.parse',
      { request: input.request },
      ctx,
    )
    calls.push(call)
    results.push(result)
    push('tool_call', `도구 호출 ${call.name}`, { toolCall: call })
    push(
      result.ok ? 'tool_result' : 'error',
      result.ok
        ? `조건 추출 완료 · 참여자 ${(result.content as { participants: string[] }).participants.join(', ') || '—'}`
        : `intent.parse 실패: ${result.error}`,
      { toolCall: call, toolResult: result },
    )
    input.onStep?.({
      type: 'tool',
      call,
      result,
      summary: 'intent.parse',
    })
    if (!result.ok) {
      const trace = emptyTrace(runId, input, memory, calls, results, log)
      appendExecutionLog(log)
      return trace
    }
  }

  const intent = (results[0].content as { intent: ParsedIntent }).intent

  // 2) chat.extract_constraints
  {
    const { call, result } = executeTool(
      'chat.extract_constraints',
      { intent, chat: input.chat },
      ctx,
    )
    calls.push(call)
    results.push(result)
    push('tool_call', `도구 호출 ${call.name}`, { toolCall: call })
    const peopleCount = result.ok
      ? (result.content as { people: unknown[] }).people.length
      : 0
    push(
      result.ok ? 'tool_result' : 'error',
      result.ok
        ? `대화에서 제약 ${peopleCount}명 추출`
        : `extract_constraints 실패: ${result.error}`,
      { toolCall: call, toolResult: result },
    )
    input.onStep?.({ type: 'tool', call, result, summary: 'chat.extract_constraints' })
  }

  // 3) calendar.query
  const range = periodRangeForIntent(intent)
  let busy: BusyWindow[] = []
  {
    const { call, result } = executeTool(
      'calendar.query',
      { start: range.start, end: range.end },
      ctx,
    )
    calls.push(call)
    results.push(result)
    push('tool_call', `도구 호출 ${call.name}`, { toolCall: call })
    if (result.ok) {
      const body = result.content as {
        busyCount: number
        busy: BusyWindow[]
      }
      busy = body.busy
      push(
        'tool_result',
        `일정 조회 · ${range.start}~${range.end} · busy ${body.busyCount}건`,
        { toolCall: call, toolResult: result },
      )
    } else {
      push('error', `calendar.query 실패: ${result.error}`, {
        toolCall: call,
        toolResult: result,
      })
    }
    input.onStep?.({ type: 'tool', call, result, summary: 'calendar.query' })
  }

  // 4) schedule.propose
  let proposal: AgentProposal | null = null
  {
    const { call, result } = executeTool(
      'schedule.propose',
      { intent, chat: input.chat, busy },
      ctx,
    )
    calls.push(call)
    results.push(result)
    push('tool_call', `도구 호출 ${call.name}`, { toolCall: call })
    if (result.ok) {
      const body = result.content as {
        primary: AppointmentCandidate
        alternatives: AppointmentCandidate[]
        people: AgentProposal['people']
        shared: AgentProposal['shared']
      }
      proposal = {
        intent,
        people: body.people,
        shared: body.shared,
        primary: body.primary,
        alternatives: body.alternatives,
      }
      push(
        'tool_result',
        `후보 제안 · ${body.primary.day} ${body.primary.start} · ${body.primary.venue.area}`,
        { toolCall: call, toolResult: result },
      )
      memory = applyMemoryFromProposal(memory, proposal)
      memory = saveAgentMemory(memory)
      push('memory_write', '세션 메모리에 참여자·회피 지역·최근 조율 저장', {
        detail: {
          participants: memory.lastParticipants,
          avoidedAreas: memory.avoidedAreas,
        },
      })
    } else {
      push('error', `schedule.propose 실패: ${result.error}`, {
        toolCall: call,
        toolResult: result,
      })
    }
    input.onStep?.({ type: 'tool', call, result, summary: 'schedule.propose' })
  }

  const trace: AgentRunTrace = {
    runId,
    request: input.request,
    chat: input.chat,
    calls,
    results,
    proposal,
    selected: proposal?.primary ?? null,
    memorySnapshot: memory,
    log,
  }
  appendExecutionLog(log)
  input.onStep?.({ type: 'done', trace })
  return trace
}

function emptyTrace(
  runId: string,
  input: { request: string; chat: string },
  memory: AgentMemory,
  calls: ToolCall[],
  results: ToolResult[],
  log: ExecutionLogEntry[],
): AgentRunTrace {
  return {
    runId,
    request: input.request,
    chat: input.chat,
    calls,
    results,
    proposal: null,
    selected: null,
    memorySnapshot: memory,
    log,
  }
}

/** 사용자 승인 후 calendar.create + 메모리/로그 저장 */
export function confirmAgentRun(input: {
  trace: AgentRunTrace
  selected: AppointmentCandidate
  proposal: AgentProposal
  schedules: Schedule[]
  allDay: AllDayEvent[]
  addSchedule: (s: Omit<Schedule, 'id'>) => string
}): { scheduleId: string; memory: AgentMemory; log: ExecutionLogEntry[] } {
  const memory = loadAgentMemory()
  const title =
    input.proposal.intent.food != null
      ? `${input.proposal.intent.participants.join('·') || '친구'} ${input.proposal.intent.food} 약속`
      : input.proposal.intent.activity
  const peopleLines = input.proposal.people
    .map((p) => `· ${p.name}: ${p.bullets.join(', ')}`)
    .join('\n')
  const memo = `AI 에이전트 확정 (tool: calendar.create)\n${input.selected.reason}\n\n제약:\n${peopleLines}`

  const ctx: ToolContext = {
    schedules: input.schedules,
    allDay: input.allDay,
    memory,
    addSchedule: input.addSchedule,
  }

  const { call, result } = executeTool(
    'calendar.create',
    {
      candidate: input.selected,
      title,
      memo,
    },
    ctx,
  )

  const log: ExecutionLogEntry[] = [
    logEntry({
      sessionId: memory.sessionId,
      runId: input.trace.runId,
      kind: 'user',
      summary: '사용자 승인 · 일정 등록 요청',
    }),
    logEntry({
      sessionId: memory.sessionId,
      runId: input.trace.runId,
      kind: 'tool_call',
      summary: `도구 호출 ${call.name}`,
      toolCall: call,
    }),
    logEntry({
      sessionId: memory.sessionId,
      runId: input.trace.runId,
      kind: result.ok ? 'tool_result' : 'error',
      summary: result.ok
        ? `일정 등록 완료 · ${(result.content as { scheduleId: string }).scheduleId}`
        : `calendar.create 실패: ${result.error}`,
      toolCall: call,
      toolResult: result,
    }),
  ]

  let nextMemory = memory
  if (result.ok) {
    nextMemory = saveAgentMemory({
      ...memory,
      lastConfirmed: {
        date: input.selected.date,
        start: input.selected.start,
        end: input.selected.end,
        title,
        venueArea: input.selected.venue.area,
      },
      notes: [
        ...memory.notes.filter((n) => !n.startsWith('마지막 확정:')),
        `마지막 확정: ${input.selected.date} ${input.selected.start} ${title}`,
      ].slice(-8),
    })
    log.push(
      logEntry({
        sessionId: nextMemory.sessionId,
        runId: input.trace.runId,
        kind: 'memory_write',
        summary: '메모리에 마지막 확정 일정 저장',
        detail: nextMemory.lastConfirmed,
      }),
    )
  }

  appendExecutionLog(log)
  const scheduleId = result.ok
    ? String((result.content as { scheduleId: string }).scheduleId)
    : ''
  return { scheduleId, memory: nextMemory, log }
}
