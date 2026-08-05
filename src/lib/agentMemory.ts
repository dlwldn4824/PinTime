import { createId } from '../types'
import type { AgentMemory, ExecutionLogEntry } from './agentTypes'

const MEMORY_KEY = 'pintime:agent:memory:v1'
const LOG_KEY = 'pintime:agent:log:v1'
const LOG_CAP = 120

function emptyMemory(): AgentMemory {
  return {
    sessionId: `mem_${createId().slice(0, 12)}`,
    updatedAt: Date.now(),
    lastParticipants: [],
    preferredAreas: [],
    avoidedAreas: [],
    notes: [],
  }
}

export function loadAgentMemory(): AgentMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    if (!raw) return emptyMemory()
    const parsed = JSON.parse(raw) as AgentMemory
    if (!parsed.sessionId) return emptyMemory()
    return {
      ...emptyMemory(),
      ...parsed,
      lastParticipants: parsed.lastParticipants ?? [],
      preferredAreas: parsed.preferredAreas ?? [],
      avoidedAreas: parsed.avoidedAreas ?? [],
      notes: parsed.notes ?? [],
    }
  } catch {
    return emptyMemory()
  }
}

export function saveAgentMemory(memory: AgentMemory) {
  const next = { ...memory, updatedAt: Date.now() }
  localStorage.setItem(MEMORY_KEY, JSON.stringify(next))
  return next
}

export function loadExecutionLog(): ExecutionLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ExecutionLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendExecutionLog(entries: ExecutionLogEntry[]) {
  if (entries.length === 0) return loadExecutionLog()
  const prev = loadExecutionLog()
  const next = [...entries, ...prev].slice(0, LOG_CAP)
  localStorage.setItem(LOG_KEY, JSON.stringify(next))
  return next
}

export function clearAgentMemoryAndLog() {
  localStorage.removeItem(MEMORY_KEY)
  localStorage.removeItem(LOG_KEY)
}
