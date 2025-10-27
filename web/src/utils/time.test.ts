import { describe, expect, it } from 'vitest'
import { fmtTime, clamp } from './time'

describe('time utils', () => {
  it('fmtTime formats positive', () => {
    expect(fmtTime(0)).toBe('00:00')
    expect(fmtTime(59000)).toBe('00:59')
    expect(fmtTime(60000)).toBe('01:00')
    expect(fmtTime(125000)).toBe('02:05')
  })
  it('fmtTime formats negative', () => {
    expect(fmtTime(-1000)).toBe('-00:01')
    expect(fmtTime(-61000)).toBe('-01:01')
  })
  it('clamp works', () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })
})
