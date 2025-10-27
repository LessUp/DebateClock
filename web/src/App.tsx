import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store'
import { fmtTime } from './utils/time'
import { encodeShare, decodeShare } from './utils/share'

function useRafLoop() {
  const running = useStore((s) => s.running)
  const lastTs = useStore((s) => s.lastTs)
  const warnSecs = useStore((s) => s.warnSecs)
  const beep = useStore((s) => s.beep)

  const audioRef = useRef<AudioContext | null>(null)
  function ensureAudio() {
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
    return audioRef.current
  }
  function tone(freq=880, dur=0.15, type: OscillatorType='sine', vol=0.08) {
    const ctx = ensureAudio(); if (!ctx) return
    const t0 = ctx.currentTime
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = type; o.frequency.value = freq; g.gain.value = vol
    o.connect(g).connect(ctx.destination)
    o.start(t0); o.stop(t0 + dur)
  }
  const beepWarn = () => { if (!beep) return; tone(880, 0.12); setTimeout(()=>tone(660,0.12),180) }
  const beepEnd = () => { if (!beep) return; tone(520, 0.25, 'square') }

  useEffect(() => {
    let raf = 0
    let last = lastTs ?? undefined as number | undefined
    function frame(ts: number) {
      if (!useStore.getState().running) return
      if (!last) last = ts
      const d = ts - last
      last = ts
      const prev = useStore.getState().remainMs
      useStore.setState({ lastTs: last, remainMs: prev - d })
      const curRemain = useStore.getState().remainMs
      // warnings
      const setWarned = useStore.getState().warned
      for (const ws of useStore.getState().warnSecs) {
        const wm = ws * 1000
        if (!setWarned.has(ws) && prev > wm && curRemain <= wm && curRemain > 0) {
          setWarned.add(ws)
          beepWarn(); break
        }
      }
      // end
      if (!useStore.getState().ended && curRemain <= 0) {
        const mode = useStore.getState().overtimeMode
        useStore.setState({ ended: true })
        beepEnd()
        const doAutoNext = mode === 'autoNext' || (mode === 'continue' && useStore.getState().autoNext)
        if (mode === 'stop') {
          useStore.setState({ running: false, lastTs: null, remainMs: 0 })
        } else if (doAutoNext) {
          if (useStore.getState().idx < useStore.getState().stages.length - 1) {
            useStore.setState({ running: false, lastTs: null })
            useStore.getState().next()
            useStore.getState().save()
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }
    if (running) raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, lastTs, warnSecs, beep])

  useEffect(() => {
    const onPointerDown = () => { try { ensureAudio()?.resume?.() } catch {} }
    window.addEventListener('pointerdown', onPointerDown, { once: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])
}

function useHotkeys() {
  const toggle = useStore((s) => s.toggle)
  const prev = useStore((s) => s.prev)
  const next = useStore((s) => s.next)
  const adjust = useStore((s) => s.adjust)
  const reset = useStore((s) => s.reset)
  const setBeep = useStore((s) => s.setBeep)
  const beep = useStore((s) => s.beep)
  const fsRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag && /(INPUT|TEXTAREA|SELECT)/.test(tag)) return
      if (e.key === ' ') { e.preventDefault(); toggle() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === '+') { e.preventDefault(); adjust(10_000) }
      else if (e.key === '-') { e.preventDefault(); adjust(-10_000) }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reset() }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); fsRef.current?.click() }
      else if (e.key.toLowerCase() === 'm') { e.preventDefault(); setBeep(!beep) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, prev, next, adjust, reset, setBeep, beep])

  return fsRef
}

export default function App() {
  const s = useStore()
  const fsBtnRef = useHotkeys()
  useRafLoop()
  const bcRef = useRef<BroadcastChannel | null>(null)
  const wakeRef = useRef<any>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSec, setEditSec] = useState(60)
  const [warnText, setWarnText] = useState('60,30')

  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { s.load() }, [])
  // import from URL share param if provided
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const share = sp.get('share')
    if (share) {
      const data = decodeShare(share)
      if (data && (Array.isArray(data.stages) || Array.isArray((data as any)))) {
        try {
          if (Array.isArray((data as any).stages)) s.fromImport(data as any)
          else if (Array.isArray(data)) s.fromImport({ schema: 'debate-timer/v1', stages: data as any, settings: { beepEnabled: s.beep, warnSeconds: s.warnSecs, autoAdvance: s.autoNext } })
        } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { s.save() }, [s.stages, s.idx, s.warnSecs, s.beep, s.autoNext])
  useEffect(() => { setWarnText(s.warnSecs.join(',')) }, [s.warnSecs])
  // BroadcastChannel for display sync
  useEffect(() => {
    try { bcRef.current = new BroadcastChannel('debate-timer') } catch {}
    return () => { try { bcRef.current?.close?.() } catch {} }
  }, [])
  useEffect(() => {
    const cur = s.stages[s.idx]
    bcRef.current?.postMessage({ type: 'state', payload: { title: cur ? cur.name : '未定义阶段', remainMs: s.remainMs, totalMs: s.totalMs, warnSecs: s.warnSecs } })
  }, [s.remainMs, s.totalMs, s.idx, s.stages, s.warnSecs])
  // Wake Lock management
  useEffect(() => {
    const nav: any = navigator as any
    if (!('wakeLock' in nav)) return
    let aborted = false
    async function requestLock() {
      try {
        wakeRef.current = await nav.wakeLock.request('screen')
        if (aborted) { try { await wakeRef.current?.release?.() } catch {} }
      } catch {}
    }
    function releaseLock() {
      try { wakeRef.current?.release?.() } catch {}
      wakeRef.current = null
    }
    if (s.wakeLock) requestLock(); else releaseLock()
    const onVis = () => { if (document.visibilityState === 'visible' && s.wakeLock) requestLock() }
    document.addEventListener('visibilitychange', onVis)
    return () => { aborted = true; document.removeEventListener('visibilitychange', onVis); releaseLock() }
  }, [s.wakeLock])

  const cur = s.stages[s.idx]
  const progress = useMemo(() => {
    const total = Math.max(1, s.totalMs)
    const remain = Math.max(0, Math.min(s.totalMs, s.remainMs))
    return 1 - remain / total
  }, [s.totalMs, s.remainMs])

  function openEdit(id: string) {
    const st = s.stages.find((x) => x.id === id)
    if (!st) return
    setEditId(id)
    setEditName(st.name)
    setEditSec(st.seconds)
    ;(document.getElementById('editDialog') as HTMLDialogElement)?.showModal()
  }
  function closeEdit() {
    setEditId(null)
    try {(document.getElementById('editDialog') as HTMLDialogElement)?.close()} catch {}
  }
  function saveEdit() {
    if (!editId) return
    const sec = Number.isFinite(editSec) && editSec > 0 ? Math.floor(editSec) : 60
    s.editStage(editId, { name: editName.trim() || '未命名', seconds: sec })
    closeEdit()
  }

  function openSettings() {
    ;(document.getElementById('settingsDialog') as HTMLDialogElement)?.showModal()
  }
  function closeSettings() {
    try {(document.getElementById('settingsDialog') as HTMLDialogElement)?.close()} catch {}
  }
  function saveSettings() {
    const arr = warnText
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n < 36000)
      .slice(0, 8)
    s.setWarnSecs(arr)
    s.save()
    closeSettings()
  }

  function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('导入将覆盖当前议程与设置，是否继续？')) { e.target.value = ''; return }
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt)
        // tolerate both our export schema and the static版
        if (Array.isArray(data.stages)) s.fromImport(data)
        else if (Array.isArray(data)) s.fromImport({ schema: 'debate-timer/v1', stages: data, settings: { beepEnabled: s.beep, warnSeconds: s.warnSecs, autoAdvance: s.autoNext } })
        else throw new Error('invalid')
      } catch {
        alert('JSON 解析失败')
      }
    })
  }
  function doExport() {
    const payload = s.toExport()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    const t = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
    a.download = `debate-timer-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.json`
    a.href = URL.createObjectURL(blob)
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 0)
  }

  function openDisplay() {
    const payload = s.toExport()
    const u = new URL(window.location.href)
    u.pathname = u.pathname.replace(/\/[^/]*$/, '') + '/display'
    u.searchParams.set('share', encodeShare(payload))
    window.open(u.toString(), 'debate-display')
  }

  async function copyShare() {
    const payload = s.toExport()
    const u = new URL(window.location.href)
    u.searchParams.set('share', encodeShare(payload))
    try {
      await navigator.clipboard.writeText(u.toString())
      alert('已复制分享链接到剪贴板')
    } catch {
      prompt('复制以下链接：', u.toString())
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">辩论赛计时器</h1>
        <div className="text-sm opacity-70">空格开始/暂停 · ←/→ 切换阶段 · +/- 调整10秒</div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">议程阶段</h2>
              <div className="space-x-2">
                <button onClick={() => { s.addStage(); s.save() }} className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">添加阶段</button>
                <button onClick={() => { if (confirm('重置为预设议程？')) { s.resetPreset(); s.save() } }} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">重置预设</button>
                <button onClick={() => importRef.current?.click()} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">导入</button>
                <button onClick={doExport} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">导出</button>
                <button onClick={openSettings} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">设置</button>
                <button onClick={openDisplay} className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">打开大屏</button>
                <button onClick={copyShare} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">分享</button>
              </div>
            </div>

            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {s.stages.map((st, i) => (
                <li key={st.id} className={`flex items-center gap-2 py-2 px-2 ${i===s.idx ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300 dark:ring-emerald-800 rounded' : ''}`}>
                  <div className="w-6 shrink-0 text-slate-500">{i+1}</div>
                  <div className="flex-1 cursor-pointer" onClick={() => s.select(i)}>
                    <div className="font-medium">{st.name}</div>
                    <div className="text-xs opacity-70">时长 {Math.floor(st.seconds/60)}:{String(st.seconds%60).padStart(2,'0')}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button title="上移" className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs" onClick={() => { s.move(i, -1); s.save() }}>上</button>
                    <button title="下移" className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs" onClick={() => { s.move(i, +1); s.save() }}>下</button>
                    <button title="编辑" className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs" onClick={() => openEdit(st.id)}>改</button>
                    <button title="删除" className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs" onClick={() => { if (confirm('确认删除该阶段？')) { s.deleteStage(st.id); s.save() } }}>删</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 space-y-4">
            <div>
              <div className="text-lg font-medium">{cur ? cur.name : '未定义阶段'}</div>
              <div className="relative mt-2 h-2 w-full bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                <div className={`absolute left-0 top-0 h-full ${s.remainMs<0?'bg-rose-500': s.warnSecs.length && s.remainMs <= Math.max(...s.warnSecs)*1000 ? 'bg-amber-500': 'bg-emerald-500'}`} style={{ width: `${(progress*100).toFixed(2)}%` }} />
              </div>
            </div>

            <div className="text-center select-none">
              <div className="text-7xl font-mono tabular-nums tracking-wider">{fmtTime(s.remainMs)}</div>
              <div className={`mt-1 text-sm text-rose-500 ${s.remainMs<0 ? '' : 'hidden'}`}>已超时</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => s.prev()} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">上一阶段 (←)</button>
              <button onClick={() => s.toggle()} className={`px-3 py-2 rounded ${s.running ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}>{s.running ? '暂停 (空格)' : '开始 (空格)'}</button>
              <button onClick={() => s.next()} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">下一阶段 (→)</button>

              <button onClick={() => s.adjust(-10_000)} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">-10秒 (-)</button>
              <button onClick={() => s.reset()} className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600">重置 (R)</button>
              <button onClick={() => s.adjust(+10_000)} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">+10秒 (+)</button>

              <button onClick={() => { s.setBeep(!s.beep); s.save() }} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">提示音: {s.beep ? '开' : '关'}</button>
              <button ref={fsBtnRef} onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.() }} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">全屏 (F)</button>
              <div className="px-3 py-2 rounded text-center text-sm opacity-70">预警: {s.warnSecs.length ? s.warnSecs.join(',') : '无'}秒</div>
            </div>

            <div className="text-xs opacity-70">- 键盘：空格开始/暂停，←/→ 切换阶段，+/− 调整10秒，R重置，F全屏，M静音。</div>
          </div>
        </section>
      </main>

      {/* 编辑对话框 */}
      <dialog id="editDialog" className="rounded-lg p-0 bg-white dark:bg-slate-800 w-96 max-w-[90vw]">
        <form method="dialog">
          <div className="p-4 space-y-3">
            <div className="text-lg font-semibold">编辑阶段</div>
            <label className="block text-sm">名称
              <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="mt-1 w-full px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 outline-none" />
            </label>
            <label className="block text-sm">时长（秒）
              <input value={editSec} onChange={(e)=>setEditSec(parseInt(e.target.value)||60)} type="number" min={5} step={5} className="mt-1 w-full px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 outline-none" />
            </label>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700 p-3 flex justify-end gap-2">
            <button type="button" onClick={closeEdit} className="px-3 py-1 rounded bg-slate-300 dark:bg-slate-600">取消</button>
            <button type="submit" onClick={(e)=>{ e.preventDefault(); saveEdit() }} className="px-3 py-1 rounded bg-emerald-600 text-white">保存</button>
          </div>
        </form>
      </dialog>

      {/* 设置对话框 */}
      <dialog id="settingsDialog" className="rounded-lg p-0 bg-white dark:bg-slate-800 w-[520px] max-w-[90vw]">
        <form method="dialog">
          <div className="p-4 space-y-4">
            <div className="text-lg font-semibold">设置</div>
            <label className="block text-sm">预警秒数（逗号分隔）
              <input value={warnText} onChange={(e)=>setWarnText(e.target.value)} placeholder="60,30" className="mt-1 w-full px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 outline-none" />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input checked={s.autoNext} onChange={(e)=>s.setAutoNext(e.target.checked)} type="checkbox" />
              <span>倒计时到 0 后自动切换到下一阶段</span>
            </label>
            <label className="block text-sm">到时策略
              <select value={s.overtimeMode} onChange={(e)=>s.setOvertimeMode(e.target.value as any)} className="mt-1 w-full px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 outline-none">
                <option value="continue">继续计时（可配合自动切换）</option>
                <option value="stop">到 0 停止</option>
                <option value="autoNext">到 0 自动切换下一阶段</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input checked={s.wakeLock} onChange={(e)=>s.setWakeLock(e.target.checked)} type="checkbox" />
              <span>屏幕常亮（需要浏览器支持）</span>
            </label>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700 p-3 flex justify-end gap-2">
            <button type="button" onClick={closeSettings} className="px-3 py-1 rounded bg-slate-300 dark:bg-slate-600">取消</button>
            <button type="submit" onClick={(e)=>{ e.preventDefault(); saveSettings() }} className="px-3 py-1 rounded bg-emerald-600 text-white">保存</button>
          </div>
        </form>
      </dialog>

      {/* 隐藏文件选择用于导入 */}
      <input ref={importRef} onChange={doImport} type="file" accept="application/json" className="hidden" />
    </div>
  )
}
