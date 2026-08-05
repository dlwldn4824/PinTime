import {
  ArrowRight,
  Check,
  ClipboardPaste,
  ImagePlus,
  MapPin,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentRunPanel } from '../components/agent/AgentRunPanel'
import { Toast } from '../components/Toast'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../hooks/useToast'
import { confirmAgentRun, runAgentLoop } from '../lib/agentLoop'
import { loadAgentMemory } from '../lib/agentMemory'
import {
  DEMO_CHAT,
  parseIntent,
  type AppointmentCandidate,
} from '../lib/agentParse'
import type { AgentRunTrace, ToolName } from '../lib/agentTypes'
import { parseDateKey } from '../types'

type Step = 'request' | 'chat' | 'result'

const DEFAULT_REQUEST = '다음 주에 민수, 영희랑 고기 먹게 잡아줘.'

const ANALYZE_TOOLS: ToolName[] = [
  'intent.parse',
  'chat.extract_constraints',
  'calendar.query',
  'schedule.propose',
]

function formatDateKo(dateKey: string, day: string) {
  const d = parseDateKey(dateKey)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`
}

export function AgentPage() {
  const { schedules, allDay, addSchedule, setSelectedDate, setView } =
    useCalendar()
  const { toast, showToast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('request')
  const [request, setRequest] = useState(DEFAULT_REQUEST)
  const [chat, setChat] = useState('')
  const [captureName, setCaptureName] = useState<string | null>(null)
  const [trace, setTrace] = useState<AgentRunTrace | null>(null)
  const [selected, setSelected] = useState<AppointmentCandidate | null>(null)
  const [showAlts, setShowAlts] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [liveTools, setLiveTools] = useState<ToolName[]>([])
  const [memoryTick, setMemoryTick] = useState(0)

  const intentPreview = useMemo(() => {
    if (!request.trim()) return null
    try {
      return parseIntent(request)
    } catch {
      return null
    }
  }, [request])

  const proposal = trace?.proposal ?? null
  const memory = useMemo(() => {
    void memoryTick
    return loadAgentMemory()
  }, [memoryTick, trace])

  const runAnalyze = () => {
    const text = chat.trim() || (captureName ? DEMO_CHAT : '')
    if (!request.trim()) {
      showToast('한 줄로 약속을 지시해 주세요')
      return
    }
    if (!text.trim()) {
      showToast('대화 내용을 붙여넣거나 예시 대화를 넣어 주세요')
      return
    }

    setAnalyzing(true)
    setLiveTools([])
    setTrace(null)
    setStep('result')

    let i = 0
    const reveal = window.setInterval(() => {
      if (i < ANALYZE_TOOLS.length) {
        setLiveTools(ANALYZE_TOOLS.slice(0, i + 1))
        i += 1
        return
      }
      window.clearInterval(reveal)
      const next = runAgentLoop({
        request,
        chat: text,
        schedules,
        allDay,
      })
      setTrace(next)
      setSelected(next.proposal?.primary ?? null)
      setShowAlts(false)
      setLiveTools([])
      setAnalyzing(false)
      setMemoryTick((n) => n + 1)
      if (!next.proposal) {
        showToast('후보를 만들지 못했어요 · 대화를 다시 확인해 주세요')
      }
    }, 280)
  }

  const confirm = () => {
    if (!selected || !proposal || !trace) return

    const { scheduleId } = confirmAgentRun({
      trace,
      selected,
      proposal,
      schedules,
      allDay,
      addSchedule,
    })

    // 화면 trace에도 create 결과 반영
    setTrace((prev) => {
      if (!prev) return prev
      const persisted = loadAgentMemory()
      return {
        ...prev,
        memorySnapshot: persisted,
        selected,
      }
    })
    setMemoryTick((n) => n + 1)

    setSelectedDate(selected.date)
    setView('week')
    showToast(
      scheduleId
        ? `calendar.create 완료 · 캘린더에 등록됐어요`
        : '일정 등록에 실패했어요',
    )
    window.setTimeout(() => navigate('/calendar'), 450)
  }

  const reset = () => {
    setStep('request')
    setChat('')
    setCaptureName(null)
    setTrace(null)
    setSelected(null)
    setShowAlts(false)
    setLiveTools([])
    setAnalyzing(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--line)] bg-white px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--pin)] uppercase">
              AI 일정 에이전트 · tool loop
            </p>
            <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">
              대화를 도구 실행으로 약속까지
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              조건 추출 → 일정 조회 → 후보 제안 → 승인 → 등록 · 실행 로그 저장
            </p>
          </div>
          {step !== 'request' && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              <RotateCcw size={13} />
              다시
            </button>
          )}
        </div>

        <ol className="mt-3 flex gap-1.5">
          {(
            [
              ['request', '지시'],
              ['chat', '대화'],
              ['result', '승인'],
            ] as const
          ).map(([key, label], i) => {
            const order = { request: 0, chat: 1, result: 2 } as const
            const current = order[step]
            const done = i < current
            const on = i === current
            return (
              <li
                key={key}
                className={`flex flex-1 items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                  on
                    ? 'bg-[var(--pin)] text-white'
                    : done
                      ? 'bg-sky-50 text-[var(--pin-text)]'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}. {label}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pt-scroll px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-xl space-y-4">
          {step === 'request' && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_8px_30px_rgba(21,24,31,0.05)]">
              <div className="mb-3 flex items-center gap-2 text-[var(--pin)]">
                <Sparkles size={16} />
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  한 줄로 지시하세요
                </h3>
              </div>
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder="예: 다음 주에 민수, 영희랑 고기 먹게 잡아줘."
              />
              {intentPreview && request.trim() && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {intentPreview.period !== 'unspecified' && (
                    <li className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {intentPreview.period === 'next_week'
                        ? '다음 주'
                        : '이번 주'}
                    </li>
                  )}
                  {intentPreview.participants.map((p) => (
                    <li
                      key={p}
                      className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800"
                    >
                      {p}
                    </li>
                  ))}
                  {intentPreview.food && (
                    <li className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      {intentPreview.food}
                    </li>
                  )}
                </ul>
              )}
              <button
                type="button"
                disabled={!request.trim()}
                onClick={() => setStep('chat')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--pin)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40"
              >
                다음 · 대화 수집
                <ArrowRight size={16} />
              </button>
            </section>
          )}

          {step === 'chat' && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_8px_30px_rgba(21,24,31,0.05)]">
              <div className="mb-1 flex items-center gap-2">
                <ClipboardPaste size={16} className="text-[var(--pin)]" />
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  대화 붙여넣기
                </h3>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
                카카오톡·문자에서 답변을 붙여넣으면, 에이전트가 도구를 순서대로
                호출해 캘린더와 맞춰 후보를 만듭니다.
              </p>

              <textarea
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-slate-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder={DEMO_CHAT}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChat(DEMO_CHAT)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  예시 대화 넣기
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                  <ImagePlus size={14} />
                  캡처 업로드
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setCaptureName(file.name)
                      if (!chat.trim()) setChat(DEMO_CHAT)
                      showToast(
                        '캡처를 첨부했어요. 데모에서는 텍스트로 분석을 이어갑니다',
                      )
                    }}
                  />
                </label>
                {captureName && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                    첨부: {captureName}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  뒤로
                </button>
                <button
                  type="button"
                  disabled={analyzing || (!chat.trim() && !captureName)}
                  onClick={runAnalyze}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--pin)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40"
                >
                  {analyzing ? '도구 실행 중…' : '도구로 후보 만들기'}
                  {!analyzing && <Sparkles size={16} />}
                </button>
              </div>
            </section>
          )}

          {step === 'result' && (
            <>
              <AgentRunPanel
                trace={trace}
                memory={memory}
                liveTools={liveTools}
                analyzing={analyzing}
              />

              {analyzing && (
                <p className="text-center text-xs text-slate-500">
                  calendar.query로 내 일정을 조회한 뒤 충돌을 피해 후보를
                  고르는 중…
                </p>
              )}

              {!analyzing && proposal && selected && (
                <>
                  <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_8px_30px_rgba(21,24,31,0.05)]">
                    <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                      추출된 조건 · 근거
                    </p>
                    <div className="mt-3 space-y-3">
                      {proposal.people.map((p) => (
                        <div
                          key={p.name}
                          className="rounded-xl bg-slate-50 px-3.5 py-2.5"
                        >
                          <p className="text-xs font-bold text-slate-800">
                            {p.name}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {p.bullets.map((b) => (
                              <li
                                key={b}
                                className="flex items-start gap-1.5 text-xs text-slate-600"
                              >
                                <Check
                                  size={12}
                                  className="mt-0.5 shrink-0 text-emerald-500"
                                />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3.5 py-2.5">
                        <p className="text-xs font-bold text-sky-900">
                          공통 조건
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {proposal.shared.bullets.map((b) => (
                            <li
                              key={b}
                              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100"
                            >
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_8px_30px_rgba(21,24,31,0.06)]">
                    <div className="bg-[var(--sidebar)] px-5 py-4 text-white">
                      <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">
                        후보 · 사용자 승인 대기
                      </p>
                      <h3 className="mt-1 text-xl font-bold tracking-tight">
                        {formatDateKo(selected.date, selected.day)}{' '}
                        {selected.start}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                        <MapPin size={14} />
                        {selected.venue.area}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-white/55">
                        {selected.reason}
                      </p>
                    </div>

                    <div className="space-y-3 p-5">
                      <div className="rounded-xl bg-amber-50/90 px-3.5 py-3">
                        <p className="text-sm font-bold text-amber-950">
                          {selected.venue.name}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/70">
                          1인 예상{' '}
                          {selected.venue.costPerPerson.toLocaleString()}원 ·
                          역에서 도보 {selected.venue.walkMin}분
                        </p>
                      </div>

                      {!showAlts && proposal.alternatives.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAlts(true)}
                          className="w-full rounded-xl border border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          다른 후보 보기
                        </button>
                      )}

                      {showAlts && (
                        <ul className="space-y-2">
                          {[proposal.primary, ...proposal.alternatives].map(
                            (c) => {
                              const on = c.id === selected.id
                              return (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onClick={() => setSelected(c)}
                                    className={`w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition ${
                                      on
                                        ? 'bg-sky-50 ring-2 ring-[var(--pin)]'
                                        : 'bg-slate-50 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="font-bold text-slate-800">
                                      {formatDateKo(c.date, c.day)} {c.start}
                                    </span>
                                    <span className="mt-0.5 block text-slate-500">
                                      {c.venue.area} · {c.venue.name}
                                    </span>
                                  </button>
                                </li>
                              )
                            },
                          )}
                        </ul>
                      )}

                      <button
                        type="button"
                        onClick={confirm}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--pin)] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-600"
                      >
                        승인 · calendar.create
                        <Check size={17} strokeWidth={2.5} />
                      </button>
                      <p className="text-center text-[11px] text-[var(--muted)]">
                        승인 시에만 일정 등록 도구가 실행되고, 실행 로그·메모리에
                        남습니다
                      </p>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
