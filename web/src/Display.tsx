import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTime } from './utils/time'
import { decodeShare } from './utils/share'

export default function Display() {
  const [title, setTitle] = useState('未定义阶段')
  const [remainMs, setRemainMs] = useState(0)
  const [totalMs, setTotalMs] = useState(0)
  const [warnSecs, setWarnSecs] = useState<number[]>([])

  const progress = useMemo(() => {
    const total = Math.max(1, totalMs)
    const remain = Math.max(0, Math.min(totalMs, remainMs))
    return 1 - remain / total
  }, [totalMs, remainMs])

  useEffect(() => {
    // seed from share param if provided
    const sp = new URLSearchParams(location.search)
    const share = sp.get('share')
    if (share) {
      const data = decodeShare(share)
      if (data && data.stages) {
        const first = Array.isArray(data.stages) && data.stages[0]
        setTitle(first?.name || '未定义阶段')
        const sec = (first?.seconds ? first.seconds : 60) * 1000
        setTotalMs(sec)
        setRemainMs(sec)
        if (Array.isArray(data.settings?.warnSeconds)) setWarnSecs(data.settings.warnSeconds)
      }
    }
  }, [])

  useEffect(() => {
    let ch: BroadcastChannel | null = null
    try { ch = new BroadcastChannel('debate-timer') } catch {}
    if (!ch) return
    const onMsg = (e: MessageEvent) => {
      const { type, payload } = e.data || {}
      if (type === 'state' && payload) {
        setTitle(payload.title)
        setRemainMs(payload.remainMs)
        setTotalMs(payload.totalMs)
        setWarnSecs(payload.warnSecs || [])
      }
    }
    ch.addEventListener('message', onMsg)
    return () => ch?.removeEventListener('message', onMsg)
  }, [])

  return (
    <div className="min-h-screen w-full bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-xl opacity-80">辩论赛计时器 · 大屏</div>
          <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.() }} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">全屏</button>
        </div>

        <div className="text-3xl font-semibold">{title}</div>

        <div className="relative mt-2 h-3 w-full bg-white/10 rounded overflow-hidden">
          <div className={`absolute left-0 top-0 h-full bg-emerald-400`} style={{ width: `${(progress*100).toFixed(2)}%` }} />
        </div>

        <div className="text-center mt-10 select-none">
          <div className="text-[10rem] leading-none font-mono tabular-nums tracking-wider">{fmtTime(remainMs)}</div>
          <div className="mt-2 text-base opacity-70">预警: {warnSecs.length ? warnSecs.join(',') : '无'}秒</div>
        </div>
      </div>
    </div>
  )
}
