export function fmtTime(ms: number) {
  const neg = ms < 0
  const x = Math.abs(ms)
  const s = Math.floor(x / 1000)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
