import {
  CalendarPlus,
  Check,
  Copy,
  LogOut,
  Pencil,
  Share2,
  Smartphone,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { OverlayGrid } from '../components/OverlayGrid'
import { Toast } from '../components/Toast'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../hooks/useToast'
import {
  confirmRoomSlot,
  findParticipant,
  inviteLinkFor,
  makeParticipant,
  resolveRoomAsync,
  updateRoomTitle,
  upsertParticipant,
} from '../lib/room'
import {
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
} from '../lib/session'
import {
  SLOT_STEP_MIN,
  type ConfirmRange,
  busyToAvailableSlotsForRoom,
  filterSlotsToRoom,
  formatRoomRangeLabel,
  slotKeyToAppointment,
} from '../lib/slots'
import {
  type PinTimePayload,
  type ShareRoom,
  type SlotKey,
  payloadToAvailableSlots,
  schedulesToPayload,
} from '../types'

export function JoinPage() {
  const { roomId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { schedules, allDay, addSchedule, setSelectedDate, setView } =
    useCalendar()
  const { toast, showToast } = useToast()

  const [room, setRoom] = useState<ShareRoom | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [myId, setMyId] = useState<string | null>(null)
  const [mySlots, setMySlots] = useState<Set<SlotKey>>(new Set())
  const [importText, setImportText] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [missing, setMissing] = useState(false)
  const [pickedRange, setPickedRange] = useState<ConfirmRange | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const isGuestJoin = searchParams.get('guest') === '1'

  const resetAsGuest = () => {
    setMyId(null)
    setName('')
    setPassword('')
    setMySlots(new Set())
  }

  const applySession = (nextRoom: ShareRoom) => {
    const session = loadRoomSession(nextRoom.id)
    if (!session) {
      resetAsGuest()
      return
    }
    const existing = findParticipant(nextRoom, session.name, session.password)
    if (existing) {
      setMyId(existing.id)
      setName(existing.name)
      setPassword(session.password)
      setMySlots(new Set(existing.availableSlots))
    } else {
      // 세션은 있으나 방에 없음 → 입력값만 복원
      setMyId(null)
      setName(session.name)
      setPassword(session.password)
      setMySlots(new Set())
    }
  }

  useEffect(() => {
    let cancelled = false
    const encoded = searchParams.get('d')
    const guest = searchParams.get('guest') === '1'
    ;(async () => {
      const resolved = await resolveRoomAsync(roomId, encoded)
      if (cancelled) return
      if (!resolved) {
        setMissing(true)
        return
      }
      setMissing(false)
      setRoom(resolved)
      setPickedRange(
        resolved.confirmed
          ? {
              startSlot: resolved.confirmed.slot,
              durationMin: resolved.confirmed.durationMin || SLOT_STEP_MIN,
            }
          : null,
      )

      // 타임픽식: 초대 링크(guest=1)는 기존 로그인 무시 → 새 이름 참여
      if (guest) {
        clearRoomSession(resolved.id)
        resetAsGuest()
      } else {
        applySession(resolved)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId, searchParams])

  useEffect(() => {
    if (!room) return
    const onUpdate = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id !== room.id) return
      void resolveRoomAsync(id, null).then((next) => {
        if (!next) return
        setRoom(next)
        const session = loadRoomSession(next.id)
        if (!session) return
        const me = findParticipant(next, session.name, session.password)
        if (me) {
          setMyId(me.id)
          setMySlots(new Set(me.availableSlots))
        }
      })
    }
    window.addEventListener('pintime:room', onUpdate)
    return () => window.removeEventListener('pintime:room', onUpdate)
  }, [room])

  const registered = useMemo(
    () => !!myId && !!room?.participants.some((p) => p.id === myId),
    [myId, room],
  )

  const register = (
    slots: SlotKey[],
    source: 'app' | 'manual' | 'paste',
    credName = name,
    credPassword = password,
  ) => {
    if (!room) return
    const trimmed = credName.trim()
    if (!trimmed) {
      showToast('이름을 입력해 주세요')
      return
    }
    if (!credPassword) {
      showToast('비밀번호를 입력해 주세요')
      return
    }
    if (slots.length === 0) {
      showToast('가능한 시간을 하나 이상 선택해 주세요')
      return
    }

    const participant = makeParticipant(trimmed, credPassword, slots, {
      id: myId && name.trim() === trimmed ? myId : undefined,
      source,
    })
    const result = upsertParticipant(room, participant)
    if (!result.ok) {
      showToast(result.error)
      return
    }

    saveRoomSession(result.room.id, {
      name: result.participant.name,
      password: credPassword,
    })
    setRoom(result.room)
    setMyId(result.participant.id)
    setMySlots(new Set(result.participant.availableSlots))
    setName(result.participant.name)
    setPassword(credPassword)

    // 초대 링크로 들어왔으면 guest 플래그 제거 → 이후엔 이 이름으로 유지
    if (searchParams.get('guest') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('guest')
      setSearchParams(next, { replace: true })
    }

    showToast(
      source === 'app'
        ? `${result.participant.name}님 앱 일정이 등록됐어요`
        : source === 'paste'
          ? `${result.participant.name}님 붙여넣기 일정이 등록됐어요`
          : `${result.participant.name}님 시간이 등록됐어요`,
    )
  }

  const handleLoginOnly = () => {
    if (!room) return
    const trimmed = name.trim()
    if (!trimmed || !password) {
      showToast('이름과 비밀번호를 입력해 주세요')
      return
    }
    const existing = findParticipant(room, trimmed, password)
    if (!existing) {
      const byName = room.participants.find((p) => p.name === trimmed)
      if (byName) {
        showToast('비밀번호가 맞지 않아요')
        return
      }
      showToast('아직 등록된 적이 없어요. 시간을 칠하고 등록해 주세요')
      saveRoomSession(room.id, { name: trimmed, password })
      setMyId(null)
      setMySlots(new Set())
      return
    }
    saveRoomSession(room.id, { name: existing.name, password })
    setMyId(existing.id)
    setName(existing.name)
    setMySlots(new Set(existing.availableSlots))
    showToast(`${existing.name}님으로 로그인됐어요`)
  }

  const handleSwitchAccount = () => {
    if (!room) return
    clearRoomSession(room.id)
    setMyId(null)
    setName('')
    setPassword('')
    setMySlots(new Set())
    showToast('새 이름·비밀번호로 참여할 수 있어요')
  }

  const inviteUrl = useMemo(
    () => (room ? inviteLinkFor(room) : ''),
    [room],
  )

  const openInvitePanel = () => {
    if (!room) return
    setInviteOpen(true)
    setLinkCopied(false)
  }

  const copyInviteLink = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setLinkCopied(true)
      showToast('공유 링크를 복사했어요')
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      showToast('복사 실패')
    }
  }

  const nativeShareInvite = async () => {
    if (!room || !inviteUrl) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: room.title,
          text: `${room.title} 일정 조율에 새 이름으로 참여해 주세요`,
          url: inviteUrl,
        })
        showToast('친구에게 보냈어요')
      } else {
        await copyInviteLink()
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      await copyInviteLink()
    }
  }

  const startAppSyncAsGuest = () => {
    if (!room) return
    if (!name.trim() || !password) {
      showToast('이름과 비밀번호를 먼저 입력해 주세요')
      return
    }
    saveRoomSession(room.id, { name: name.trim(), password })
    setAuthOpen(true)
  }

  const beginEditTitle = () => {
    if (!room) return
    setTitleDraft(room.title)
    setEditingTitle(true)
  }

  const saveTitle = () => {
    if (!room) return
    const next = updateRoomTitle(room, titleDraft)
    setRoom(next)
    setEditingTitle(false)
    showToast('방 이름을 수정했어요')
  }

  const handleAppSync = (authName: string, authPassword: string) => {
    setAuthOpen(false)
    setName(authName)
    setPassword(authPassword)
    if (!room) return
    const slots = busyToAvailableSlotsForRoom(schedules, allDay, room)
    setMySlots(new Set(slots))
    register(slots, 'app', authName, authPassword)
  }

  const handleCopyMine = async () => {
    const text = JSON.stringify(
      schedulesToPayload(schedules, allDay, [...mySlots], name || undefined),
      null,
      2,
    )
    try {
      await navigator.clipboard.writeText(text)
      showToast('내 가능 일정 JSON을 복사했어요')
    } catch {
      setImportText(text)
      showToast('아래에 JSON을 채워 두었어요')
    }
  }

  const handlePaste = () => {
    try {
      const parsed = JSON.parse(importText) as PinTimePayload
      if (!parsed || parsed.source !== 'PinTime') {
        showToast('PinTime JSON 형식이 아니에요')
        return
      }
      if (!room) return
      const slots = filterSlotsToRoom(payloadToAvailableSlots(parsed), room)
      const nextName = name.trim() || parsed.name || ''
      setMySlots(new Set(slots))
      if (!name.trim() && parsed.name) setName(parsed.name)
      register(slots, 'paste', nextName, password)
    } catch {
      showToast('JSON 파싱에 실패했어요')
    }
  }

  const activeRange: ConfirmRange | null =
    pickedRange ??
    (room?.confirmed
      ? {
          startSlot: room.confirmed.slot,
          durationMin: room.confirmed.durationMin || SLOT_STEP_MIN,
        }
      : null)

  const preview = useMemo(() => {
    if (!room || !activeRange) return null
    return slotKeyToAppointment(
      room,
      activeRange.startSlot,
      activeRange.durationMin,
    )
  }, [room, activeRange])

  const handleConfirm = () => {
    if (!room || !activeRange) {
      showToast('전체 시간표에서 드래그해 확정할 구간을 골라 주세요')
      return
    }
    if (room.participants.length === 0) {
      showToast('참가자가 있어야 일정을 확정할 수 있어요')
      return
    }

    const appointment = slotKeyToAppointment(
      room,
      activeRange.startSlot,
      activeRange.durationMin,
    )
    if (!appointment) {
      showToast('선택한 시간을 해석할 수 없어요')
      return
    }

    const alreadySame =
      room.confirmed?.slot === activeRange.startSlot &&
      room.confirmed?.durationMin === activeRange.durationMin
    if (!alreadySame) {
      const next = confirmRoomSlot(room, activeRange.startSlot, {
        durationMin: activeRange.durationMin,
        confirmedBy: name.trim() || undefined,
      })
      setRoom(next)
      setPickedRange(activeRange)

      addSchedule({
        day: appointment.day,
        date: appointment.date,
        start: appointment.start,
        end: appointment.end,
        title: room.title,
        color: 'blue',
        memo: `조율 방 확정${name.trim() ? ` · ${name.trim()}` : ''}`,
        remind: true,
      })
      showToast(`${appointment.label} · 캘린더에 저장됐어요`)
    } else {
      showToast('이미 확정된 일정이에요 · 캘린더로 이동')
    }

    setSelectedDate(appointment.date)
    setView('week')
    window.setTimeout(() => navigate('/calendar'), 450)
  }

  if (missing) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900">
          방을 찾을 수 없어요
        </h2>
        <p className="text-sm text-slate-500">
          링크가 오래되었거나 데이터가 없을 수 있어요. 최신 링크를 다시 받아
          주세요.
        </p>
        <Link
          to="/share"
          className="mt-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white"
        >
          공유 페이지로
        </Link>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        불러오는 중…
      </div>
    )
  }

  const myTitle = name.trim()
    ? `${name.trim()}의 되는 시간`
    : '내 되는 시간'

  return (
    <div className="pt-scroll flex h-full min-h-0 w-full flex-col gap-3 overflow-x-hidden overflow-y-auto bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-4 sm:p-4 lg:p-5">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex max-w-md items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                className="w-full rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="방 이름"
              />
              <button
                type="button"
                onClick={saveTitle}
                className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                저장
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={beginEditTitle}
              className="group flex max-w-full items-center gap-1.5 text-left"
              title="방 이름 수정"
            >
              <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {room.title}
              </h2>
              <Pencil
                size={14}
                className="shrink-0 text-slate-400 group-hover:text-blue-600"
              />
            </button>
          )}
          <p className="mt-0.5 text-[11px] leading-relaxed break-keep text-slate-500 sm:text-xs">
            {formatRoomRangeLabel(room)}
            <span className="hidden sm:inline"> · 분홍=불가 · 초록=가능</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openInvitePanel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Share2 size={14} />
          친구에게 보내기
        </button>
      </div>

      {inviteOpen && (
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
              타임픽처럼 링크를 연 사람은 항상 <b>새 이름</b>으로 참여합니다.
              (내 로그인 상태는 유지되지 않아요)
            </p>
            <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
              {inviteUrl}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={nativeShareInvite}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white"
              >
                <Share2 size={15} />
                공유하기
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
              >
                {linkCopied ? <Check size={15} /> : <Copy size={15} />}
                {linkCopied ? '복사 완료' : '링크 복사'}
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

      {(!registered || isGuestJoin) && (
        <section className="shrink-0 rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <UserPlus size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-900">
                {isGuestJoin ? '초대 링크로 참여하기' : '새 이름으로 참여하기'}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/80">
                이름·비밀번호를 입력한 뒤, 아래에서 일정을 직접 칠거나 앱
                연동을 누르세요.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 민수"
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="나중에 수정할 때 필요"
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => register([...mySlots], 'manual')}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              일정 직접 입력 · 등록
            </button>
            <button
              type="button"
              onClick={startAppSyncAsGuest}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Smartphone size={15} />
              앱 연동하기
            </button>
          </div>
          <p className="mt-2 text-[11px] text-emerald-900/70">
            직접 입력은 아래 표에서 되는 시간을 칠한 뒤 눌러 주세요.
          </p>
        </section>
      )}

      {registered && !isGuestJoin && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{name}</span>
            님으로 참여 중
          </p>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
          >
            <UserPlus size={12} />
            새 이름으로 참여
          </button>
        </div>
      )}

      {/* 모바일: 세로 스택 / 데스크톱: 2열 — 남은 화면을 꽉 채움 */}
      <div className="grid min-w-0 flex-1 gap-3 sm:gap-4 xl:h-[calc(100dvh-9.5rem)] xl:min-h-[560px] xl:grid-cols-2 xl:gap-5">
        <section className="flex h-[min(58dvh,620px)] min-w-0 flex-col xl:h-full xl:min-h-0">
          <AvailabilityEditor
            room={room}
            selected={mySlots}
            onChange={setMySlots}
            title={myTitle}
          />
        </section>

        <section className="flex h-[min(58dvh,620px)] min-w-0 flex-col gap-2 xl:h-full xl:min-h-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <OverlayGrid
              room={room}
              title="모임 전체 시간표"
              selectedRange={activeRange}
              onSelectRange={setPickedRange}
            />
          </div>

          <aside className="min-w-0 shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3">
            <p className="text-[11px] font-bold text-slate-700">
              참여한 사람들 ({room.participants.length})
            </p>
            {room.participants.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-400">아직 없어요</p>
            ) : (
              <ul className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] xl:flex-wrap xl:overflow-visible">
                {room.participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                      {p.name.slice(0, 1)}
                    </span>
                    <span className="max-w-[7rem] truncate sm:max-w-[10rem]">
                      {p.name}
                      {p.id === myId ? (
                        <span className="ml-1 text-emerald-600">·나</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>
      </div>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 gap-2.5 sm:gap-3">
        {/* 일정 확정 — 한 줄 액션 바 */}
        <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-900">일정 확정</p>
            {preview && activeRange ? (
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                <span className="text-blue-700">{preview.label}</span>
                <span className="ml-1 text-xs font-medium text-slate-500">
                  {activeRange.durationMin}분
                </span>
                {room.confirmed?.slot === activeRange.startSlot &&
                room.confirmed?.durationMin === activeRange.durationMin ? (
                  <span className="ml-1 text-xs font-medium text-amber-600">
                    · 이미 확정됨
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500">
                시간표에서 초록 칸을 드래그해 주세요
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!activeRange || room.participants.length === 0}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CalendarPlus size={16} />
            {room.confirmed?.slot === activeRange?.startSlot &&
            room.confirmed?.durationMin === activeRange?.durationMin
              ? '다시 확정'
              : '확정 · 저장'}
          </button>
        </div>

        {/* 다시 등록 / 연동 — 2열 */}
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900">
                {registered ? '내 시간 다시 등록' : '기존 계정 로그인'}
              </p>
              {registered && (
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  <LogOut size={12} />
                  새 이름
                </button>
              )}
            </div>

            {registered ? (
              <p className="mt-1.5 text-xs text-emerald-700">
                <span className="font-semibold">{name}</span>
                <span className="text-slate-500"> · 표 고친 뒤 등록</span>
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">
                예전에 등록한 이름·비밀번호로 들어오세요
              </p>
            )}

            {!registered && (
              <div className="mt-2 grid gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                registered
                  ? register([...mySlots], 'manual')
                  : handleLoginOnly()
              }
              className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              {registered ? '다시 등록' : '로그인'}
            </button>
          </section>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-900">앱·JSON 연동</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              캘린더 자동 반영, 또는 JSON으로 다른 곳에 옮기기
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Smartphone size={15} />
                앱 연동
              </button>
              <button
                type="button"
                onClick={handleCopyMine}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <Copy size={14} />
                JSON 복사
              </button>
            </div>

            <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 open:bg-white">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600">
                JSON 붙여넣기
              </summary>
              <div className="space-y-1.5 border-t border-slate-100 px-2.5 pb-2.5 pt-2">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="PinTime JSON 붙여넣기"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  붙여넣기로 등록
                </button>
              </div>
            </details>
          </section>
        </div>

      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialName={name}
        initialPassword={password}
        onSuccess={handleAppSync}
      />
      <Toast message={toast} />
    </div>
  )
}
