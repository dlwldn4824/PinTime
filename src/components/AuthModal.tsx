import { Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type AuthModalProps = {
  open: boolean
  onClose: () => void
  initialName?: string
  initialPassword?: string
  onSuccess: (name: string, password: string) => void
}

export function AuthModal({
  open,
  onClose,
  initialName = '',
  initialPassword = '',
  onSuccess,
}: AuthModalProps) {
  const [name, setName] = useState(initialName)
  const [password, setPassword] = useState(initialPassword)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setPassword(initialPassword)
      setLoading(false)
    }
  }, [open, initialName, initialPassword])

  if (!open) return null

  const submit = () => {
    if (!name.trim() || !password) return
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      onSuccess(name.trim(), password)
    }, 500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              PinTime 앱 연동
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              이름·비밀번호로 로그인
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          이름과 비밀번호로 본인을 확인한 뒤, 캘린더의 바쁜 시간을 제외한 가능
          시간이 자동 등록됩니다. 다른 이름·비번이면 새 참가자로 추가됩니다.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="예: 지우"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="방을 구분할 비밀번호"
            />
          </div>
          <button
            type="button"
            disabled={loading || !name.trim() || !password}
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Smartphone size={16} />
            {loading ? '연동 중…' : '로그인하고 앱 일정 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
