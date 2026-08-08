import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
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
      return 'Firebase 콘솔에서 이메일/비밀번호 로그인을 켜 주세요.'
    case 'auth/unauthorized-domain':
      return '이 도메인이 Firebase 승인된 도메인에 없어요.'
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
    if (!auth) throw new Error('Firebase가 설정되지 않았어요')
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }, [])

  const signInEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase가 설정되지 않았어요')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signUpEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase가 설정되지 않았어요')

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

      // Auth 계정 생성 직후 Firestore 프로필 문서 저장
      await pushProfile(cred.user.uid, {
        displayName: name || cred.user.displayName || '',
        email: cred.user.email,
        createdAt: Date.now(),
      })

      // onAuthStateChanged가 이미 돌았을 수 있어 표시 이름 갱신
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
