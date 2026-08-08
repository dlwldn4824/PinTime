/**
 * 카카오톡·슬랙 등 크롤러가 /j|/join 링크를 열 때
 * 방 이름(n) + PinTime OG 메타가 있는 HTML을 돌려준다.
 */
const BOT_UA =
  /bot|crawl|slurp|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp|KakaoTalk|kakaotalk|Line\/|Pinterest|redditbot|Embedly|Quora|vkShare|W3C_Validator|google-inspectiontool/i

const OG_IMAGE = 'https://pintime.vercel.app/og.jpg'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_UA.test(ua)) {
    return // fall through to static SPA
  }

  const url = new URL(request.url)
  const roomName = (url.searchParams.get('n') || '').trim() || '일정 조율'
  const title = `${roomName} · PinTime`
  const description = `PinTime「${roomName}」일정 조율에 참여해 보세요.`
  const canonical = url.toString()
  const safeTitle = escapeHtml(title)
  const safeDesc = escapeHtml(description)
  const safeCanon = escapeHtml(canonical)

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="PinTime" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${safeCanon}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="800" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <link rel="canonical" href="${safeCanon}" />
</head>
<body>
  <p><a href="${safeCanon}">${safeTitle} — PinTime으로 이동</a></p>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

export const config = {
  matcher: ['/j/:path*', '/join/:path*'],
}
