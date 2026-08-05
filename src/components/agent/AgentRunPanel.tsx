import { Brain, CheckCircle2, ChevronDown, Terminal, Wrench, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AgentMemory, AgentRunTrace, ToolName } from '../../lib/agentTypes'
import { loadExecutionLog } from '../../lib/agentMemory'

const TOOL_LABEL: Record<ToolName, string> = {
  'intent.parse': '조건 추출',
  'chat.extract_constraints': '대화 제약 파싱',
  'calendar.query': '일정 조회',
  'schedule.propose': '후보 제안',
  'calendar.create': '일정 등록',
}

function briefResult(name: ToolName, content: unknown): string {
  if (!content || typeof content !== 'object') return '—'
  const c = content as Record<string, unknown>
  switch (name) {
    case 'intent.parse':
      return `참여자 ${(c.participants as string[] | undefined)?.join(', ') || '—'} · ${String(c.food ?? c.period ?? '')}`
    case 'chat.extract_constraints':
      return `제약 ${(c.people as unknown[] | undefined)?.length ?? 0}명`
    case 'calendar.query':
      return `busy ${String(c.busyCount ?? 0)}건 · ${JSON.stringify(c.range)}`
    case 'schedule.propose': {
      const p = c.primary as { day?: string; start?: string; venue?: { area?: string } } | undefined
      return p ? `${p.day} ${p.start} · ${p.venue?.area}` : '후보 생성'
    }
    case 'calendar.create':
      return `id ${String(c.scheduleId ?? '').slice(0, 12)}`
    default:
      return 'ok'
  }
}

type AgentRunPanelProps = {
  trace: AgentRunTrace | null
  memory?: AgentMemory | null
  /** 분석 중 스트리밍으로 쌓인 도구 이름 */
  liveTools?: ToolName[]
  analyzing?: boolean
}

export function AgentRunPanel({
  trace,
  memory,
  liveTools = [],
  analyzing = false,
}: AgentRunPanelProps) {
  const [logOpen, setLogOpen] = useState(false)
  const persistedLog = useMemo(() => loadExecutionLog().slice(0, 24), [trace])

  const mem = memory ?? trace?.memorySnapshot
  const pairs =
    trace?.calls.map((call, i) => ({
      call,
      result: trace.results[i],
    })) ?? []

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100 shadow-[0_8px_30px_rgba(21,24,31,0.12)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-emerald-400/90 uppercase">
            Agent runtime · local tools
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-white">
            도구 실행 · 메모리 · 로그
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            대화 → 조건 추출 → calendar.query → 후보 제안 → 승인 → calendar.create
          </p>
        </div>
        <Wrench size={16} className="mt-0.5 shrink-0 text-slate-500" />
      </div>

      {(analyzing || liveTools.length > 0 || pairs.length > 0) && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Terminal size={12} />
            Tool calls
          </p>
          <ol className="space-y-1.5">
            {pairs.map(({ call, result }) => (
              <li
                key={call.id}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-semibold text-sky-300">
                    {call.name}
                  </code>
                  {result?.ok ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : result ? (
                    <XCircle size={13} className="text-rose-400" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {TOOL_LABEL[call.name]}
                  {result
                    ? ` · ${result.durationMs}ms · ${briefResult(call.name, result.content)}`
                    : ''}
                </p>
              </li>
            ))}
            {analyzing &&
              liveTools
                .filter((n) => !pairs.some((p) => p.call.name === n))
                .map((name) => (
                  <li
                    key={`live-${name}`}
                    className="animate-pulse rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2"
                  >
                    <code className="text-[11px] font-semibold text-emerald-300">
                      {name}
                    </code>
                    <p className="mt-0.5 text-[10px] text-emerald-200/70">
                      실행 중…
                    </p>
                  </li>
                ))}
          </ol>
        </div>
      )}

      {mem && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Brain size={12} />
            Session memory
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mem.lastParticipants.map((p) => (
              <span
                key={p}
                className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-200"
              >
                {p}
              </span>
            ))}
            {mem.lastFood && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                {mem.lastFood}
              </span>
            )}
            {mem.avoidedAreas.map((a) => (
              <span
                key={a}
                className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200"
              >
                제외 {a}
              </span>
            ))}
            {mem.lastConfirmed && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                확정 {mem.lastConfirmed.date} {mem.lastConfirmed.start}
              </span>
            )}
            {mem.lastParticipants.length === 0 &&
              !mem.lastFood &&
              !mem.lastConfirmed && (
                <span className="text-[10px] text-slate-500">
                  아직 저장된 메모리가 없어요
                </span>
              )}
          </div>
          {mem.notes[0] && (
            <p className="mt-1.5 text-[10px] text-slate-500">{mem.notes[0]}</p>
          )}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left"
        >
          <span className="text-[11px] font-semibold text-slate-300">
            Execution log
            <span className="ml-1.5 font-normal text-slate-500">
              ({persistedLog.length})
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition ${logOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {logOpen && (
          <ul className="mt-1.5 max-h-40 space-y-1 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
            {(trace?.log.length ? trace.log : persistedLog).map((e) => (
              <li key={e.id}>
                <span className="text-slate-600">
                  {new Date(e.ts).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>{' '}
                <span
                  className={
                    e.kind === 'error'
                      ? 'text-rose-400'
                      : e.kind === 'tool_call'
                        ? 'text-sky-400'
                        : e.kind === 'memory_write'
                          ? 'text-violet-300'
                          : 'text-slate-300'
                  }
                >
                  [{e.kind}]
                </span>{' '}
                {e.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
