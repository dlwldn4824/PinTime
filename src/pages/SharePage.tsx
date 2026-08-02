import { Check, Copy, Link2, Share2, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CandidateDatePicker } from '../components/CandidateDatePicker'
import { Toast } from '../components/Toast'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../hooks/useToast'
import {
  createRoom,
  hostLinkFor,
  inviteLinkFor,
  makeParticipant,
  updateRoomTitle,
  upsertParticipant,
} from '../lib/room'
import { saveRoomSession } from '../lib/session'
import {
  END_HOUR_OPTIONS,
  HOUR_OPTIONS,
  busyToAvailableSlotsForRoom,
  defaultRoomRange,
  formatRoomRangeLabel,
} from '../lib/slots'
import {
  loadMyName,
  loadMyRooms,
  loadRoom,
  loadUserId,
  removeMyRoom,
  saveMyName,
  type MyRoomRef,
} from '../lib/storage'
import {
  DAYS,
  type DateSelectMode,
  type Day,
  type ShareRoom,
  hourToLabel,
} from '../types'

export function SharePage() {
  const { toast, showToast } = useToast()
  const { schedules, allDay } = useCalendar()
  const userId = useMemo(() => loadUserId(), [])
  const defaults = useMemo(() => defaultRoomRange(), [])
  const [displayName, setDisplayName] = useState(loadMyName() || '')
  const [roomTitle, setRoomTitle] = useState('')
  const [mode, setMode] = useState<DateSelectMode>('dates')
  const [selectedDates, setSelectedDates] = useState<string[]>(defaults.dates)
  const [selectedWeekdays, setSelectedWeekdays] = useState<Day[]>([
    '월',
    '수',
    '금',
  ])
  const [startHour, setStartHour] = useState(defaults.startHour)
  const [endHour, setEndHour] = useState(defaults.endHour)
  const [activeRoom, setActiveRoom] = useState<ShareRoom | null>(null)
  const [rooms, setRooms] = useState<MyRoomRef[]>([])
  const [copied, setCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const refreshRooms = () => setRooms(loadMyRooms())

  useEffect(() => {
    refreshRooms()
  }, [])

  const shareUrl = useMemo(
    () => (activeRoom ? inviteLinkFor(activeRoom) : ''),
    [activeRoom],
  )

  const summary =
    mode === 'dates'
      ? `${selectedDates.length}일`
      : `${DAYS.filter((d) => selectedWeekdays.includes(d)).join('') || '요일 없음'}`

  const handleCreate = () => {
    if (mode === 'dates' && selectedDates.length === 0) {
      showToast('후보 날짜를 하나 이상 선택해 주세요')
      return
    }
    if (mode === 'weekdays' && selectedWeekdays.length === 0) {
      showToast('요일을 하나 이상 선택해 주세요')
      return
    }
    if (mode === 'dates' && selectedDates.length > 21) {
      showToast('날짜는 최대 21개까지 선택할 수 있어요')
      return
    }
    if (endHour <= startHour) {
      showToast('종료 시간은 시작 시간보다 늦어야 해요')
      return
    }

    const hostName = displayName.trim() || '나'
    if (displayName.trim()) saveMyName(displayName.trim())

    const created = createRoom({
      title: roomTitle.trim() || '주말 일정 조율',
      mode,
      dates: mode === 'dates' ? selectedDates : [],
      weekdays: mode === 'weekdays' ? selectedWeekdays : [],
      startHour,
      endHour,
    })

    // 방 만들 때 내 캘린더 busy → 가능시간으로 자동 등록·마스킹
    const slots = busyToAvailableSlotsForRoom(schedules, allDay, created)
    const result = upsertParticipant(
      created,
      makeParticipant(hostName, userId, slots, { source: 'app' }),
    )
    const room = result.ok ? result.room : created
    if (result.ok) {
      saveRoomSession(room.id, { name: hostName, password: userId })
    }

    setActiveRoom(room)
    refreshRooms()
    showToast('방 생성 · 내 캘린더 일정이 자동으로 반영됐어요')
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showToast('공유 링크를 복사했어요')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('링크 복사에 실패했어요')
    }
  }

  const handleShareToFriends = async () => {
    if (!activeRoom || !shareUrl) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeRoom.title,
          text: `${activeRoom.title} 일정 조율에 새 이름으로 참여해 주세요`,
          url: shareUrl,
        })
        showToast('친구에게 보냈어요')
        return
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
    }
    await handleCopyLink()
  }

  const openInvitePanel = () => {
    if (!activeRoom) return
    setInviteOpen(true)
    setCopied(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--line)] bg-white px-5 py-3">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">
          일정 공유
        </h2>
        <p className="text-xs text-[var(--muted)]">
          방을 만들면 내 캘린더 일정이 자동으로 반영되고, 링크를 공유할 수
          있어요.
        </p>
      </div>
      <div className="pt-scroll mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <UserRound size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                내 아이디
              </p>
              <p className="truncate font-mono text-sm font-semibold text-slate-900">
                {userId}
              </p>
            </div>
          </div>
          <label className="mt-4 block text-xs font-medium text-slate-600">
            표시 이름
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => {
              if (displayName.trim()) saveMyName(displayName.trim())
            }}
            placeholder="예: 지우"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">새 조율 방</h3>

          <label className="mt-3 block text-xs font-medium text-slate-600">
            방 이름 <span className="font-normal text-slate-400">(수정 가능)</span>
          </label>
          <input
            value={roomTitle}
            onChange={(e) => setRoomTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="예: 주말 일정 조율, 팀플 A 회의"
          />

          <div className="mt-4">
            <CandidateDatePicker
              mode={mode}
              onModeChange={setMode}
              selectedDates={selectedDates}
              onDatesChange={setSelectedDates}
              selectedWeekdays={selectedWeekdays}
              onWeekdaysChange={setSelectedWeekdays}
            />
          </div>

          <p className="mt-4 text-xs font-semibold text-slate-700">
            시간 범위 <span className="font-normal text-slate-400">(30분 단위)</span>
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500">시작 시각</label>
              <select
                value={startHour}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setStartHour(v)
                  if (endHour <= v) setEndHour(Math.min(v + 0.5, 24))
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {hourToLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500">종료 시각</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {END_HOUR_OPTIONS.filter((h) => h > startHour).map((h) => (
                  <option key={h} value={h}>
                    {hourToLabel(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            선택 요약:{' '}
            <span className="font-semibold text-slate-700">
              {summary} · {hourToLabel(startHour)}–{hourToLabel(endHour)} · 30분
              칸
            </span>
            <span className="mt-1 block text-blue-600">
              내 캘린더에 있는 일정 시간은 자동으로 마스킹됩니다.
            </span>
          </p>

          <button
            type="button"
            onClick={handleCreate}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <Link2 size={16} />
            방 만들고 내 일정 반영
          </button>

          {activeRoom && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
              <label className="text-[11px] font-medium text-slate-500">
                방 이름
              </label>
              <input
                defaultValue={activeRoom.title}
                key={activeRoom.id + ':' + activeRoom.title}
                onBlur={(e) => {
                  const next = updateRoomTitle(activeRoom, e.target.value)
                  setActiveRoom(next)
                  setRoomTitle(next.title)
                  refreshRooms()
                  showToast('방 이름을 수정했어요')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                {formatRoomRangeLabel(activeRoom)} · 참가자{' '}
                {activeRoom.participants.length}명
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={openInvitePanel}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Share2 size={14} />
                  친구에게 보내기
                </button>
                <Link
                  to={`/join/${activeRoom.id}?d=${new URL(hostLinkFor(activeRoom)).searchParams.get('d') ?? ''}`}
                  className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"
                >
                  내 방 열기
                </Link>
              </div>
            </div>
          )}

          {inviteOpen && activeRoom && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
              onClick={() => setInviteOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-bold text-slate-900">공유 링크</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  타임픽처럼 이 링크를 연 사람은 항상 새 이름으로 참여합니다.
                </p>
                <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
                  {shareUrl}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleShareToFriends}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    <Share2 size={15} />
                    공유하기
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? '복사 완료' : '링크 복사'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              참여 중인 일정
            </h3>
            <span className="text-xs text-slate-400">{rooms.length}개</span>
          </div>

          {rooms.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              아직 참여 중인 조율 방이 없어요. 위를 눌러 새 방을 만들어 보세요.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rooms.map((ref) => {
                const room = loadRoom(ref.id)
                const count = room?.participants.length ?? 0
                const href = room
                  ? `/join/${ref.id}?d=${new URL(hostLinkFor(room)).searchParams.get('d') ?? ''}`
                  : `/join/${ref.id}`

                return (
                  <li
                    key={ref.id}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-2"
                  >
                    <Link
                      to={href}
                      className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-blue-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {ref.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {room ? formatRoomRangeLabel(room) : ''} · 참가자{' '}
                          {count}명
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-blue-600">
                        열기
                      </span>
                    </Link>
                    <button
                      type="button"
                      title="목록에서 삭제"
                      onClick={() => {
                        removeMyRoom(ref.id)
                        if (activeRoom?.id === ref.id) setActiveRoom(null)
                        refreshRooms()
                        showToast('참여 중인 일정을 삭제했어요')
                      }}
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <Toast message={toast} />
      </div>
    </div>
  )
}
