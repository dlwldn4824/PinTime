/**
 * Electron / PWA 앱 아이콘을 달력 베이스(icon-base.png)로 생성.
 * Dock·작업표시줄은 웹 동적 favicon과 달리 빌드 시 고정 아이콘만 씁니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const basePath = path.join(root, 'public', 'icon-base.png')

async function writePng(filePath, pipeline) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await pipeline.png().toFile(filePath)
  console.log('wrote', path.relative(root, filePath))
}

async function main() {
  const base = sharp(basePath).ensureAlpha()

  // 1024 — Electron (macOS .icns / Windows .ico 소스)
  await writePng(
    path.join(root, 'build-resources', 'icon.png'),
    base.clone().resize(1024, 1024, { fit: 'contain', background: '#ffffff' }),
  )

  // electron-builder가 .ico로 변환할 때 참고하는 보조 파일
  await writePng(
    path.join(root, 'build-resources', 'icon.ico.png'),
    base.clone().resize(512, 512, { fit: 'contain', background: '#ffffff' }),
  )

  await writePng(
    path.join(root, 'public', 'pwa-512.png'),
    base.clone().resize(512, 512, { fit: 'contain', background: '#ffffff' }),
  )

  await writePng(
    path.join(root, 'public', 'pwa-192.png'),
    base.clone().resize(192, 192, { fit: 'contain', background: '#ffffff' }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
