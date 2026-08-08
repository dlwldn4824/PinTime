/** GitHub Releases로 새 버전 확인 (자동 설치 아님 · Releases 페이지 안내) */

export const RELEASES_URL =
  'https://github.com/dlwldn4824/PinTime/releases'
export const LATEST_RELEASE_API =
  'https://api.github.com/repos/dlwldn4824/PinTime/releases/latest'

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

declare const __APP_VERSION__: string

export type UpdateCheckResult =
  | { status: 'up-to-date'; current: string; latest: string }
  | {
      status: 'update-available'
      current: string
      latest: string
      releaseUrl: string
      htmlUrl: string
    }
  | { status: 'error'; current: string; message: string }

function normalizeVersion(v: string) {
  return v.trim().replace(/^v/i, '')
}

/** 단순 semver 비교: a < b 이면 -1, 같으면 0, a > b 이면 1 */
export function compareSemver(a: string, b: string): number {
  const pa = normalizeVersion(a)
    .split('.')
    .map((x) => Number.parseInt(x.replace(/[^0-9].*$/, ''), 10) || 0)
  const pb = normalizeVersion(b)
    .split('.')
    .map((x) => Number.parseInt(x.replace(/[^0-9].*$/, ''), 10) || 0)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i += 1) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da < db) return -1
    if (da > db) return 1
  }
  return 0
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const current = APP_VERSION
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) {
      return {
        status: 'error',
        current,
        message: `릴리스 확인 실패 (${res.status})`,
      }
    }
    const data = (await res.json()) as {
      tag_name?: string
      html_url?: string
    }
    const latest = normalizeVersion(data.tag_name ?? '')
    if (!latest) {
      return { status: 'error', current, message: '최신 버전을 읽지 못했어요' }
    }
    if (compareSemver(current, latest) < 0) {
      return {
        status: 'update-available',
        current,
        latest,
        releaseUrl: RELEASES_URL,
        htmlUrl: data.html_url || `${RELEASES_URL}/tag/v${latest}`,
      }
    }
    return { status: 'up-to-date', current, latest }
  } catch {
    return {
      status: 'error',
      current,
      message: '네트워크 오류로 확인하지 못했어요',
    }
  }
}
