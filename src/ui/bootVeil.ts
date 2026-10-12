/**
 * ui/bootVeil.ts — 开场「暗房显影」加载幕。
 *
 * 设计（已敲定）：
 *  · 概念 A：相纸上用"正在加载的那张真脸"做显影主体 —— 灰阶+高斯模糊+银盐颗粒
 *    随真实进度逐渐清晰上色；配取景器对焦括号做点缀。
 *  · 进度：红细线 + mono 百分比。真实进度源 = 8 张 rig 贴图解码(0→0.7) + 角色 ready(→1.0)。
 *    预解码同时预热缓存，让 three 阶段更快。
 *  · 揭幕：iris 开圆（从脸中心向外扩张 mask）+ 60ms 白闪 + 轻微 scale 回弹，
 *    揭幕同一帧 dispatch 'doubao:veil-open'，main 接到后启动 runIntro，运动无缝接力。
 *  · 门控：最短展示 1.1s（避免一闪而过）；9s 兜底 / 'doubao:stage-failed' 强制揭幕（不困住用户）。
 *  · prefers-reduced-motion：只留纸底，ready 即淡出，不做显影/iris。
 */
import { motionPrefs } from '../lib/motionPrefs'

/** 与 imageRigCharacter 加载一致的主体贴图（face 为 layered:false，无 _bg） */
const RIG = [
  'doubao_face',
  'doubao_neck',
  'doubao_waist',
  'doubao_legs',
  'doubao_toes',
  'doubao_front',
  'doubao_side',
  'doubao_back',
] as const

const MIN_MS = 1100
const FAILSAFE_MS = 9000
const IRIS_MS = 620

export function initBootVeil(): () => void {
  const veil = document.getElementById('bootVeil')
  if (!veil) return () => undefined

  const photo = document.getElementById('bootPhoto') as HTMLImageElement | null
  const pct = document.getElementById('bootPct')
  const bar = document.getElementById('bootBar')
  const label = document.getElementById('bootLabel')
  const root = document.documentElement
  root.classList.add('booting')

  const reduced = motionPrefs.reduced
  const base = import.meta.env.BASE_URL
  const startedAt = performance.now()

  let revealed = false
  let ready = false
  let decoded = 0

  /* ---- 真实进度：预解码 rig 贴图（同时预热 three 阶段要用的缓存） ---- */
  for (const name of RIG) {
    const im = new Image()
    im.decoding = 'async'
    im.onload = (): void => {
      decoded += 1
      tick()
    }
    im.onerror = (): void => {
      decoded += 1
      tick()
    }
    // 与 three 加载器同 URL（含 ?v=2），确保预热命中同一缓存条目
    im.src = `${base}img/rig/${name}.webp?v=2`
  }

  const progress = (): number => {
    const imgP = decoded / RIG.length
    return Math.min(1, 0.12 + imgP * 0.58 + (ready ? 0.3 : 0))
  }

  const tick = (): void => {
    if (revealed) return
    const p = progress()
    if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0')
    if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`
    if (photo && !reduced) {
      const blur = (1 - p) * 22
      photo.style.filter =
        `blur(${blur.toFixed(1)}px) grayscale(${(1 - p).toFixed(2)}) ` +
        `saturate(${(0.6 + p * 0.5).toFixed(2)}) contrast(${(1.05 - p * 0.05).toFixed(2)})`
      photo.style.opacity = (0.2 + p * 0.8).toFixed(2)
    }
    if (label) {
      label.textContent = p >= 0.7 ? '对焦中 · FOCUSING' : '显影中 · DEVELOPING'
    }
  }

  const reveal = (): void => {
    if (revealed) return
    revealed = true
    root.classList.remove('booting')

    if (reduced) {
      veil.style.transition = 'opacity 220ms linear'
      veil.style.opacity = '0'
      document.dispatchEvent(new CustomEvent('doubao:veil-open'))
      window.setTimeout(() => veil.remove(), 260)
      return
    }

    // 对焦锁定节拍 → 白闪 + iris 开圆
    veil.classList.add('is-lock')
    if (label) label.textContent = '对焦锁定 · LOCKED'
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent('doubao:veil-open'))
      veil.classList.add('is-flash')
      const t0 = performance.now()
      const step = (now: number): void => {
        const t = Math.min(1, (now - t0) / IRIS_MS)
        const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
        veil.style.setProperty('--iris', `${(e * 168).toFixed(1)}%`)
        veil.style.setProperty('--vscale', (1.04 - 0.04 * e).toFixed(3))
        if (t < 1) requestAnimationFrame(step)
        else veil.remove()
      }
      requestAnimationFrame(step)
    }, 140)
  }

  const maybeReveal = (): void => {
    const elapsed = performance.now() - startedAt
    if (elapsed >= MIN_MS) reveal()
    else window.setTimeout(reveal, MIN_MS - elapsed)
  }

  const onReady = (): void => {
    ready = true
    tick()
    maybeReveal()
  }
  const onFailed = (): void => reveal()

  document.addEventListener('doubao:stage-ready', onReady)
  document.addEventListener('doubao:stage-failed', onFailed)
  window.setTimeout(reveal, FAILSAFE_MS)

  tick()

  return () => {
    document.removeEventListener('doubao:stage-ready', onReady)
    document.removeEventListener('doubao:stage-failed', onFailed)
    veil.remove()
    root.classList.remove('booting')
  }
}
