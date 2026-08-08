import { useEffect, useState } from 'react'
import {
  DATE_ICON_BASE_URL,
  getDateIconUrl,
  subscribeDateIcon,
} from '../lib/dateIcon'

type PinTimeLogoProps = {
  className?: string
  /** 기본 36 */
  size?: number
  alt?: string
}

/**
 * 오늘(Asia/Seoul) 날짜가 찍힌 PinTime 앱 로고.
 * favicon과 동일한 동적 아이콘을 구독한다.
 */
export function PinTimeLogo({
  className = '',
  size = 36,
  alt = 'PinTime',
}: PinTimeLogoProps) {
  const [src, setSrc] = useState(
    () => getDateIconUrl() ?? DATE_ICON_BASE_URL,
  )

  useEffect(() => {
    setSrc(getDateIconUrl() ?? DATE_ICON_BASE_URL)
    return subscribeDateIcon(() => {
      setSrc(getDateIconUrl() ?? DATE_ICON_BASE_URL)
    })
  }, [])

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
