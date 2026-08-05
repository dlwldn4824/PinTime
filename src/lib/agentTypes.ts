import type { AgentProposal, AppointmentCandidate } from './agentParse'

/** 로컬 MCP 형태 도구 이름 */
export type ToolName =
  | 'intent.parse'
  | 'chat.extract_constraints'
  | 'calendar.query'
  | 'schedule.propose'
  | 'calendar.create'

export type ToolCall = {
  id: string
  name: ToolName
  arguments: Record<string, unknown>
  startedAt: number
}

export type ToolResult = {
  callId: string
  name: ToolName
  ok: boolean
  content: unknown
  error?: string
  endedAt: number
  durationMs: number
}

export type AgentMemory = {
  sessionId: string
  updatedAt: number
  lastParticipants: string[]
  lastFood?: string
  preferredAreas: string[]
  avoidedAreas: string[]
  lastConfirmed?: {
    date: string
    start: string
    end: string
    title: string
    venueArea: string
  }
  notes: string[]
}

export type ExecutionLogKind =
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'memory_write'
  | 'user'
  | 'error'

export type ExecutionLogEntry = {
  id: string
  sessionId: string
  runId: string
  ts: number
  kind: ExecutionLogKind
  summary: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  detail?: unknown
}

export type AgentRunTrace = {
  runId: string
  request: string
  chat: string
  calls: ToolCall[]
  results: ToolResult[]
  proposal: AgentProposal | null
  selected: AppointmentCandidate | null
  memorySnapshot: AgentMemory
  log: ExecutionLogEntry[]
}
