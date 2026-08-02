type ToastProps = {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[toast-in_0.28s_ease-out]">
      <div className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-slate-900/20">
        {message}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
