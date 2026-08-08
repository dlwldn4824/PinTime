/**
 * 숫자 너비를 재며 maxW/maxH 안에 들어가도록 폰트 크기 결정.
 * 측정 함수를 주입해 테스트 가능.
 */
export function fitDayFontSize(
  text: string,
  maxW: number,
  maxH: number,
  measureWidth: (fontSize: number, text: string) => number,
): number {
  let fontSize = maxH
  const min = 8
  while (fontSize > min) {
    if (measureWidth(fontSize, text) <= maxW) return fontSize
    fontSize *= 0.92
  }
  return min
}
