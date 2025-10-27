import { create } from 'zustand'

export type Stage = { id: string; name: string; seconds: number }

export type ExportPayload = {
  schema: 'debate-timer/v1'
  stages: Stage[]
  settings: { beepEnabled: boolean; warnSeconds: number[]; autoAdvance: boolean; overtimeMode?: 'continue' | 'stop' | 'autoNext'; wakeLock?: boolean }
}

const STORAGE_KEY = 'debateTimer.v2'

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

function defaults(): Stage[] {
  return [
    { id: uid(), name: '正方立论', seconds: 180 },
    { id: uid(), name: '反方立论', seconds: 180 },
    { id: uid(), name: '正方质询', seconds: 120 },
    { id: uid(), name: '反方质询', seconds: 120 },
    { id: uid(), name: '自由辩论', seconds: 480 },
    { id: uid(), name: '正方总结', seconds: 180 },
    { id: uid(), name: '反方总结', seconds: 180 },
  ]
}

export type Store = {
  stages: Stage[]
  idx: number
  running: boolean
  remainMs: number
  totalMs: number
  warnSecs: number[]
  beep: boolean
  autoNext: boolean
  overtimeMode: 'continue' | 'stop' | 'autoNext'
  wakeLock: boolean
  lastTs: number | null
  warned: Set<number>
  ended: boolean
  // actions
  load: () => void
  save: () => void
  select: (i: number) => void
  applyCurrent: () => void
  start: () => void
  stop: () => void
  toggle: () => void
  reset: () => void
  next: () => void
  prev: () => void
  adjust: (deltaMs: number) => void
  addStage: () => void
  editStage: (id: string, patch: Partial<Stage>) => void
  deleteStage: (id: string) => void
  move: (i: number, dir: -1 | 1) => void
  setBeep: (on: boolean) => void
  setWarnSecs: (arr: number[]) => void
  setAutoNext: (on: boolean) => void
  setOvertimeMode: (m: 'continue' | 'stop' | 'autoNext') => void
  setWakeLock: (on: boolean) => void
  resetPreset: () => void
  toExport: () => ExportPayload
  fromImport: (payload: ExportPayload) => void
}

export const useStore = create<Store>((set: any, get: any) => ({
  stages: [],
  idx: 0,
  running: false,
  remainMs: 0,
  totalMs: 0,
  warnSecs: [60],
  beep: true,
  autoNext: false,
  overtimeMode: 'continue',
  wakeLock: false,
  lastTs: null,
  warned: new Set<number>(),
  ended: false,

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        set({
          stages: Array.isArray(d.stages) && d.stages.length ? d.stages : defaults(),
          idx: Number.isInteger(d.idx) ? Math.max(0, Math.min(d.idx, (d.stages?.length ?? 1) - 1)) : 0,
          warnSecs: Array.isArray(d.warnSecs) && d.warnSecs.length ? d.warnSecs : [60],
          beep: typeof d.beep === 'boolean' ? d.beep : true,
          autoNext: !!d.autoNext,
          overtimeMode: (d.overtimeMode === 'stop' || d.overtimeMode === 'autoNext') ? d.overtimeMode : 'continue',
          wakeLock: !!d.wakeLock,
        })
      } else {
        set({ stages: defaults(), idx: 0 })
      }
    } catch {
      set({ stages: defaults(), idx: 0 })
    }
    get().applyCurrent()
  },

  save: () => {
    const s = get()
    const data = {
      stages: s.stages,
      idx: s.idx,
      warnSecs: s.warnSecs,
      beep: s.beep,
      autoNext: s.autoNext,
      overtimeMode: s.overtimeMode,
      wakeLock: s.wakeLock,
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
  },

  select: (i: number) => set({ idx: i, running: false }, get().applyCurrent),
  applyCurrent: () => {
    const s = get()
    const cur = s.stages[s.idx]
    const total = cur ? cur.seconds * 1000 : 0
    set({ totalMs: total, remainMs: total, warned: new Set<number>(), ended: false })
  },

  start: () => set({ running: true, lastTs: null }),
  stop: () => set({ running: false, lastTs: null }),
  toggle: () => set({ running: !get().running, lastTs: null }),
  reset: () => set({ running: false, lastTs: null, remainMs: get().totalMs, warned: new Set<number>(), ended: false }),
  next: () => {
    const s = get()
    if (s.idx < s.stages.length - 1) set({ idx: s.idx + 1, running: false }, get().applyCurrent)
  },
  prev: () => {
    const s = get()
    if (s.idx > 0) set({ idx: s.idx - 1, running: false }, get().applyCurrent)
  },
  adjust: (delta: number) => set({ remainMs: get().remainMs + delta }),

  addStage: () => set((s: Store) => ({ stages: [...s.stages, { id: uid(), name: '新阶段', seconds: 60 }], idx: s.stages.length })),
  editStage: (id: string, patch: Partial<Stage>) => set((s: Store) => {
    const i = s.stages.findIndex((x) => x.id === id)
    if (i < 0) return {}
    const before = s.stages[i]
    const next = { ...before, ...patch }
    const stages = [...s.stages]
    stages[i] = next
    if (i === s.idx && patch.seconds && patch.seconds > 0) {
      const old = s.totalMs
      const nt = next.seconds * 1000
      const ratio = old > 0 ? s.remainMs / old : 1
      return { stages, totalMs: nt, remainMs: Math.round(ratio * nt) }
    }
    return { stages }
  }),
  deleteStage: (id: string) => set((s: Store) => {
    const i = s.stages.findIndex((x) => x.id === id)
    if (i < 0) return {}
    const stages = s.stages.slice(0, i).concat(s.stages.slice(i + 1))
    let idx = s.idx
    if (!stages.length) return { stages: defaults(), idx: 0 }
    if (i === idx) idx = Math.max(0, i - 1)
    if (i < idx) idx -= 1
    return { stages, idx, running: false }
  }),
  move: (i: number, dir: -1 | 1) => set((s: Store) => {
    const j = i + dir
    if (i < 0 || j < 0 || i >= s.stages.length || j >= s.stages.length) return {}
    const stages = [...s.stages]
    const tmp = stages[i]
    stages[i] = stages[j]
    stages[j] = tmp
    let idx = s.idx
    if (idx === i) idx = j
    else if (idx === j) idx = i
    return { stages, idx }
  }),
  setBeep: (on: boolean) => set({ beep: on }),
  setWarnSecs: (arr: number[]) => set({ warnSecs: arr.filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 8) }),
  setAutoNext: (on: boolean) => set({ autoNext: on }),
  setOvertimeMode: (m: 'continue' | 'stop' | 'autoNext') => set({ overtimeMode: m }),
  setWakeLock: (on: boolean) => set({ wakeLock: on }),
  resetPreset: () => {
    set({ stages: defaults(), idx: 0, running: false })
    get().applyCurrent()
  },

  toExport: () => {
    const s = get()
    return {
      schema: 'debate-timer/v1',
      stages: s.stages,
      settings: { beepEnabled: s.beep, warnSeconds: s.warnSecs, autoAdvance: s.autoNext, overtimeMode: s.overtimeMode, wakeLock: s.wakeLock },
    }
  },
  fromImport: (payload: ExportPayload) => {
    const stages = Array.isArray(payload.stages) ? payload.stages.map((x: any) => ({ id: x.id || uid(), name: String(x.name || '阶段'), seconds: Math.max(5, Number(x.seconds) || 60) })) : defaults()
    set({
      stages,
      idx: 0,
      warnSecs: Array.isArray(payload.settings?.warnSeconds) && payload.settings.warnSeconds.length ? payload.settings.warnSeconds : [60],
      beep: typeof payload.settings?.beepEnabled === 'boolean' ? payload.settings.beepEnabled : true,
      autoNext: !!payload.settings?.autoAdvance,
      overtimeMode: (payload.settings?.overtimeMode === 'stop' || payload.settings?.overtimeMode === 'autoNext') ? payload.settings!.overtimeMode! : 'continue',
      wakeLock: !!payload.settings?.wakeLock,
      running: false,
    })
    get().applyCurrent()
  },
}))
