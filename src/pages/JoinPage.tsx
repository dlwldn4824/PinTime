import {
  CalendarPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Pencil,
  Share2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { CommonSlotsList } from '../components/CommonSlotsList'
import { OverlayGrid } from '../components/OverlayGrid'
import { Toast } from '../components/Toast'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../hooks/useToast'
import { RELEASES_URL } from '../lib/appUpdate'
import { isLikelyMobile } from '../lib/platform'
import { getPublicWebOrigin } from '../lib/publicUrl'
import {
  confirmRoomSlot,
  findParticipant,
  inviteLinkFor,
  makeParticipant,
  resolveRoomAsync,
  syncLinkFor,
  updateRoomTitle,
  upsertParticipant,
} from '../lib/room'
import {
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
} from '../lib/session'
import { loadMyRooms, nameExamplePlaceholder } from '../lib/storage'
import {
  SLOT_STEP_MIN,
  type ConfirmRange,
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
  const [namePlaceholder] = useState(() => nameExamplePlaceholder())
  const [myId, setMyId] = useState<string | null>(null)
  const [mySlots, setMySlots] = useState<Set<SlotKey>>(new Set())
  const [importText, setImportText] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [missing, setMissing] = useState(false)
  const [pickedRange, setPickedRange] = useState<ConfirmRange | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [syncUrl, setSyncUrl] = useState('')
  const [syncCopied, setSyncCopied] = useState(false)
  const [showSyncHint, setShowSyncHint] = useState(false)
  /** 나중에 하기로 접어도 sync 미전달이면 배너 유지 */
  const [syncPending, setSyncPending] = useState(false)
  /** 표에서 직접 칠어 저장된 값과 달라진 경우 */
  const slotsDirtyRef = useRef(false)

  const isGuestJoin =
    searchParams.get('g') === '1' || searchParams.get('guest') === '1'

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
    const guest =
      searchParams.get('g') === '1' || searchParams.get('guest') === '1'
    const sync =
      searchParams.get('s') === '1' || searchParams.get('sync') === '1'
    const shareName = searchParams.get('n')?.trim()
    if (shareName) {
      document.title = `${shareName} · PinTime`
    }
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

      // 동기화 링크: 친구 가능시간을 합친 뒤, 주소창을 짧은 로컬 경로로 정리
      if (sync) {
        applySession(resolved)
        setShowSyncHint(false)
        setSyncPending(false)
        setSyncUrl('')
        showToast(
          `참가자 ${resolved.participants.length}명의 가능 시간을 반영했어요`,
        )
        setSearchParams({}, { replace: true })
        return
      }

      // 타임픽식: 초대 링크(guest=1)는 새 참여가 기본.
      // 단, 이미 이 방 세션+참가자가 있으면 호스트/재방문으로 유지 (자기 초대 링크 열기 함정 방지)
      if (guest) {
        const session = loadRoomSession(resolved.id)
        const existing = session
          ? findParticipant(resolved, session.name, session.password)
          : null
        if (existing) {
          applySession(resolved)
          setSearchParams({}, { replace: true })
        } else {
          clearRoomSession(resolved.id)
          resetAsGuest()
          if (encoded) {
            setSearchParams({ g: '1' }, { replace: true })
          }
        }
      } else {
        applySession(resolved)
        // 호스트/재방문: 긴 d가 주소창에 남아 있으면 짧게 정리
        if (encoded && !sync) {
          setSearchParams({}, { replace: true })
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // showToast는 안정적이지 않을 수 있어 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, searchParams, setSearchParams])

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
          // 사용자가 표에서 직접 고치는 중이면 방 동기화로 덮지 않음
          if (!slotsDirtyRef.current) {
            setMySlots(new Set(me.availableSlots))
          }
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

  const register = async (
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

    const cameAsGuest =
      searchParams.get('g') === '1' || searchParams.get('guest') === '1'
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
    slotsDirtyRef.current = false

    // 주소창에서 긴 d·guest 제거 (방은 이미 로컬 저장됨)
    if (cameAsGuest || searchParams.get('d')) {
      setSearchParams({}, { replace: true })
    }

    // When2Meet/타임픽: 서버 없이 친구→호스트로 가능시간을 넘기려면 sync 링크 필요
    const role = loadMyRooms().find((r) => r.id === result.room.id)?.role
    const needsHostSync = cameAsGuest || role === 'guest'
    if (needsHostSync) {
      try {
        const url = await syncLinkFor(result.room)
        setSyncUrl(url)
        setShowSyncHint(true)
        setSyncPending(true)
        setSyncCopied(false)
        try {
          await navigator.clipboard.writeText(url)
          setSyncCopied(true)
          window.setTimeout(() => setSyncCopied(false), 2000)
        } catch {
          /* clipboard may be blocked */
        }
      } catch {
        setShowSyncHint(false)
      }
      showToast(
        cameAsGuest
          ? `${result.participant.name}님 등록 완료 · 전달 링크를 복사해 두었어요. 호스트에게 보내 주세요`
          : `${result.participant.name}님 시간이 업데이트됐어요 · 호스트에게 다시 전달해 주세요`,
      )
      return
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

  const [inviteUrl, setInviteUrl] = useState('')
  useEffect(() => {
    if (!room) {
      setInviteUrl('')
      return
    }
    let cancelled = false
    void inviteLinkFor(room).then((url) => {
      if (!cancelled) setInviteUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [room])

  const openInvitePanel = () => {
    if (!room) return
    setInviteOpen(true)
    setLinkCopied(false)
  }

  const copySyncLink = async () => {
    if (!syncUrl) return
    try {
      await navigator.clipboard.writeText(syncUrl)
      setSyncCopied(true)
      showToast('호스트 전달 링크를 복사했어요')
      window.setTimeout(() => setSyncCopied(false), 2000)
    } catch {
      showToast('복사에 실패했어요')
    }
  }

  const nativeShareSync = async () => {
    if (!syncUrl || !room) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${room.title} · 가능 시간`,
          text: `${name || '참가자'}의 가능 시간을 반영하려면 이 링크를 열어 주세요`,
          url: syncUrl,
        })
        return
      } catch {
        // fall through to copy
      }
    }
    await copySyncLink()
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
          title: `${room.title} · PinTime`,
          text: `PinTime「${room.title}」일정 조율에 참여해 주세요`,
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

  const openPinTimeElsewhere = () => {
    const mobile = isLikelyMobile()
    const url = mobile ? getPublicWebOrigin() : RELEASES_URL
    window.open(url, '_blank', 'noopener,noreferrer')
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
    window.setTimeout(() => navigate('/'), 450)
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
          className="mt-2 rounded-xl bg-[var(--tomato)] px-4 py-2.5 text-sm font-semibold text-white"
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
                className="w-full rounded-xl border border-[var(--tomato)]/40 bg-white px-3 py-1.5 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[var(--tomato-soft)]"
                placeholder="방 이름"
              />
              <button
                type="button"
                onClick={saveTitle}
                className="shrink-0 rounded-lg bg-[var(--tomato)] px-2.5 py-1.5 text-xs font-semibold text-white"
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
                className="shrink-0 text-slate-400 group-hover:text-[var(--tomato)]"
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--tomato)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--tomato-deep)]"
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
            <p className="text-sm font-bold text-slate-900">초대 링크</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              지금 참가자들의 가능 시간이 포함됩니다. 친구가 열면{' '}
              <b>겹치는 시간</b>을 보고 새 이름으로 등록합니다.
            </p>
            <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
              {inviteUrl || '링크 만드는 중…'}
            </p>
            <p className="mt-2 text-[10px] text-slate-400">
              {inviteUrl
                ? `길이 ${inviteUrl.length}자 · 비밀번호는 넣지 않습니다`
                : '압축 중…'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={nativeShareInvite}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tomato)] px-3 py-2.5 text-sm font-semibold text-white"
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

      {showSyncHint && syncUrl && registered && !isGuestJoin && (
        <section className="shrink-0 rounded-2xl border-2 border-[var(--tomato)]/40 bg-[var(--tomato-soft)]/90 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--tomato)] text-white">
              <Share2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--tomato-deep)]">
                호스트에게 가능 시간 전달
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--tomato-deep)]/80">
                서버가 없어서 호스트 기기에 바로 반영되지 않아요. 아래 링크를
                카톡 등으로 보내면, 호스트가 열 때 내 가능 시간이 합쳐집니다.
                {syncCopied ? ' · 클립보드에 복사됨' : ''}
              </p>
            </div>
          </div>
          <p className="mt-3 break-all rounded-xl bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-[var(--tomato-soft)]">
            {syncUrl}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={nativeShareSync}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tomato)] px-3 py-2.5 text-sm font-semibold text-white"
            >
              <Share2 size={15} />
              호스트에게 공유
            </button>
            <button
              type="button"
              onClick={copySyncLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {syncCopied ? <Check size={15} /> : <Copy size={15} />}
              {syncCopied ? '복사 완료' : '링크 복사'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  '지금 보내지 않으면 호스트 캘린더에 내 가능 시간이 반영되지 않습니다. 나중에 할까요?',
                )
              ) {
                return
              }
              setShowSyncHint(false)
              setSyncPending(true)
            }}
            className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white/70"
          >
            나중에 하기
          </button>
        </section>
      )}

      {!showSyncHint && syncPending && syncUrl && registered && !isGuestJoin && (
        <section className="shrink-0 rounded-xl border border-[var(--tomato)]/30 bg-[var(--tomato-soft)]/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[var(--tomato-deep)]">
              아직 호스트에게 전달하지 않았어요
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowSyncHint(true)}
                className="rounded-lg bg-[var(--tomato)] px-2.5 py-1.5 text-[11px] font-bold text-white"
              >
                전달하기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      '전달 안내를 숨길까요? (링크는 다시 만들 수 있어요)',
                    )
                  ) {
                    return
                  }
                  setSyncPending(false)
                  setSyncUrl('')
                }}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-white/80"
              >
                숨기기
              </button>
            </div>
          </div>
        </section>
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
                이름·비밀번호를 정한 뒤, 아래에서 되는 시간을 칠고 등록하세요.
                등록 후 호스트에게 전달 링크가 나옵니다.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
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
              onClick={openPinTimeElsewhere}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {isLikelyMobile() ? (
                <>
                  <ExternalLink size={15} />
                  핀타임 웹 구경가기
                </>
              ) : (
                <>
                  <Download size={15} />
                  앱 깔러 가기
                </>
              )}
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
          <div className="flex flex-wrap items-center gap-2">
            {loadMyRooms().find((r) => r.id === room.id)?.role === 'guest' && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = await syncLinkFor(room)
                    setSyncUrl(url)
                    setShowSyncHint(true)
                    setSyncCopied(false)
                  } catch {
                    showToast('전달 링크를 만들지 못했어요')
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tomato)] hover:text-[var(--tomato-deep)]"
              >
                <Share2 size={12} />
                호스트에게 전달
              </button>
            )}
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tomato)] hover:text-[var(--tomato-deep)]"
            >
              <UserPlus size={12} />
              새 이름으로 참여
            </button>
          </div>
        </div>
      )}

      {/* 모바일: 세로 스택 / 데스크톱: 2열 — 남은 화면을 꽉 채움 */}
      <div className="grid min-w-0 flex-1 gap-3 sm:gap-4 xl:h-[calc(100dvh-9.5rem)] xl:min-h-[560px] xl:grid-cols-2 xl:gap-5">
        <section className="flex h-[min(58dvh,620px)] min-w-0 flex-col xl:h-full xl:min-h-0">
          <AvailabilityEditor
            room={room}
            selected={mySlots}
            onChange={(next) => {
              setMySlots(next)
              slotsDirtyRef.current = true
            }}
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

          <CommonSlotsList
            room={room}
            selectedRange={activeRange}
            onPick={setPickedRange}
          />

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
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--tomato-soft)] bg-[var(--tomato-soft)]/70 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--tomato-deep)]">일정 확정</p>
            {preview && activeRange ? (
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                <span className="text-[var(--tomato-deep)]">{preview.label}</span>
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
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--tomato)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--tomato-deep)] disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className="text-xs font-bold text-slate-900">PinTime 더 보기</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {isLikelyMobile()
                ? '일정 조율 말고, PinTime 웹을 둘러볼 수 있어요'
                : '데스크톱 앱을 받아 캘린더를 써 보세요'}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={openPinTimeElsewhere}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {isLikelyMobile() ? (
                  <>
                    <ExternalLink size={15} />
                    핀타임 웹 구경가기
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    앱 깔러 가기
                  </>
                )}
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

      <Toast message={toast} />
    </div>
  )
}
