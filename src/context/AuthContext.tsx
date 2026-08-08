import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { bootstrapCloudSync, pushProfile } from '../lib/cloudSync'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { saveMyName } from '../lib/storage'

type AuthContextValue = {
  configured: boolean
  user: User | null
  loading: boolean
  syncing: boolean
  syncError: string | null
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Firebase Auth 에러 → 사용자용 한글 메시지 */
export function firebaseAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : ''
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (/Database is closing|closing\/hidden|IDBDatabase/i.test(msg)) {
    return '구글 로그인 창 때문에 잠시 끊겼어요. 다시 한 번 눌러 주세요.'
  }
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요. 로그인 해 보세요.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않아요.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 맞지 않아요.'
    case 'auth/too-many-requests':
      return '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
    case 'auth/popup-closed-by-user':
      return '구글 로그인 창이 닫혔어요.'
    case 'auth/operation-not-allowed':
      return '이메일 가입 또는 Google 로그인이 아직 켜지지 않았어요.'
    case 'auth/unauthorized-domain':
      return '이 주소는 아직 허용되지 않았어요. localhost로 열어 보세요.'
    default:
      return err instanceof Error ? err.message : '인증에 실패했어요'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }

    let unsubCloud: (() => void) | undefined

    // Google 리다이렉트 로그인 결과 처리 (팝업 IndexedDB 오류 회피)
    void getRedirectResult(auth).catch(() => undefined)

    const unsubAuth = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
      unsubCloud?.()
      unsubCloud = undefined
      setSyncError(null)

      if (!next) return

      if (next.displayName) saveMyName(next.displayName)

      setSyncing(true)
      void bootstrapCloudSync(next.uid)
        .then(async (boot) => {
          unsubCloud = boot.unsub
          await pushProfile(next.uid, {
            displayName: next.displayName ?? '',
            email: next.email,
          }).catch(() => undefined)
        })
        .catch((err: unknown) => {
          setSyncError(
            err instanceof Error ? err.message : '클라우드 동기화에 실패했어요',
          )
        })
        .finally(() => setSyncing(false))
    })

    return () => {
      unsubAuth()
      unsubCloud?.()
    }
  }, [configured])

  const signInGoogle = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('계정 서버가 연결되지 않았어요')
    const provider = new GoogleAuthProvider()
    // 팝업은 포커스 이동 시 IndexedDB "Database is closing/hidden"이 날 수 있어 리다이렉트 사용
    await signInWithRedirect(auth, provider)
  }, [])

  const signInEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('계정 서버가 연결되지 않았어요')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signUpEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('계정 서버가 연결되지 않았어요')

      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )

      const name = displayName?.trim() || ''
      if (name) {
        await updateProfile(cred.user, { displayName: name })
        saveMyName(name)
        await cred.user.reload()
      }

      await pushProfile(cred.user.uid, {
        displayName: name || cred.user.displayName || '',
        email: cred.user.email,
        createdAt: Date.now(),
      })

      setUser(auth.currentUser)
    },
    [],
  )

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (!auth) return
    await firebaseSignOut(auth)
  }, [])

  const value = useMemo(
    () => ({
      configured,
      user,
      loading,
      syncing,
      syncError,
      signInGoogle,
      signInEmail,
      signUpEmail,
      signOut,
    }),
    [
      configured,
      user,
      loading,
      syncing,
      syncError,
      signInGoogle,
      signInEmail,
      signUpEmail,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
