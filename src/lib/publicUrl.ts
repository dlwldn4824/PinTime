/**
 * 친구에게 보내는 공유/초대 링크는 항상 배포된(짧은) 웹 도메인을 쓴다.
 * Electron·localhost·긴 Netlify 프리뷰 URL이어도 카톡에 붙일 주소는 고정.
 */
const DEFAULT_PUBLIC_WEB_URL = 'https://pintime.vercel.app'

export function getPublicWebOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '')
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv
  return DEFAULT_PUBLIC_WEB_URL
}

/** OG·절대 경로 자산용 */
export function publicAssetUrl(path: string): string {
  const base = getPublicWebOrigin()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
