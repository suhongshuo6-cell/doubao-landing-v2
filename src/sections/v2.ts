import { motionPrefs } from '../lib/motionPrefs'
import { hasDifyKey } from '../lib/difyClient'
import { hasArkKey } from '../lib/doubaoClient'
import type { ScrollController } from '../motion/lenisSetup'

export function initV2(scroll: ScrollController): () => void {
  const root = document.documentElement
  const cleaners: Array<() => void> = []
  const stage = document.getElementById('chatStage')
  const goToTalk = (seed?: string): void => {
    if (stage) scroll.scrollTo(Math.max(0, stage.offsetTop - (document.getElementById('nav')?.offsetHeight ?? 76)), { duration: .9 })
    if (seed) window.setTimeout(() => {
      const win = window as unknown as { __askbarFill?: (text: string, autoSend?: boolean) => void }
      win.__askbarFill?.(seed, false)
    }, motionPrefs.reduced ? 0 : 500)
  }
  document.querySelectorAll<HTMLButtonElement>('[data-talk-seed]').forEach(btn => {
    const click = (): void => goToTalk(btn.dataset.talkSeed)
    btn.addEventListener('click', click)
    cleaners.push(() => btn.removeEventListener('click', click))
  })
  const enter = document.getElementById('heroEnter')
  const enterTalk = (): void => goToTalk()
  enter?.addEventListener('click', enterTalk)
  cleaners.push(() => enter?.removeEventListener('click', enterTalk))
  document.addEventListener('doubao:go-chat', enterTalk)
  cleaners.push(() => document.removeEventListener('doubao:go-chat', enterTalk))
  document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]').forEach(link => {
    const navigate = (event: MouseEvent): void => {
      const target = document.querySelector<HTMLElement>(link.hash)
      if (!target) return
      event.preventDefault()
      scroll.scrollTo(Math.max(0, target.offsetTop - (document.getElementById('nav')?.offsetHeight ?? 76)), { duration: .9 })
    }
    link.addEventListener('click', navigate)
    cleaners.push(() => link.removeEventListener('click', navigate))
  })

  const motion = document.getElementById('motionToggle') as HTMLButtonElement | null
  let paused = false
  try { paused = sessionStorage.getItem('doubao-motion') === 'paused' } catch { /* private browsing */ }
  const syncMotion = (): void => {
    const staticMode = paused || motionPrefs.reduced
    root.dataset.motion = staticMode ? 'paused' : 'playing'
    motion?.setAttribute('aria-pressed', String(staticMode))
    if (motion) {
      motion.textContent = motionPrefs.reduced ? '已遵循减少动态设置' : staticMode ? '播放人物动态' : '暂停人物动态'
      motion.disabled = motionPrefs.reduced
    }
  }
  const toggleMotion = (): void => {
    paused = !paused
    try { sessionStorage.setItem('doubao-motion', paused ? 'paused' : 'playing') } catch { /* optional */ }
    syncMotion()
  }
  motion?.addEventListener('click', toggleMotion)
  cleaners.push(() => motion?.removeEventListener('click', toggleMotion))
  syncMotion()
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', syncMotion)
  cleaners.push(() => mq.removeEventListener('change', syncMotion))

  const status = document.getElementById('talkStatus')
  const dot = document.getElementById('talkDot')
  let mode = hasDifyKey() ? 'Dify 已配置' : hasArkKey() ? '方舟已配置' : '本地示例'
  const speaking = (event: Event): void => {
    const on = Boolean((event as CustomEvent<{ speaking: boolean }>).detail?.speaking)
    root.dataset.speaking = on ? '1' : '0'
    if (status) status.textContent = on ? '正在回复…' : mode
    dot?.classList.toggle('is-live', on)
  }
  const modeChanged = (event: Event): void => {
    mode = (event as CustomEvent<string>).detail
    if (status && root.dataset.speaking !== '1') status.textContent = mode
  }
  if (status) status.textContent = mode
  document.addEventListener('doubao:speaking', speaking)
  document.addEventListener('doubao:chat-mode', modeChanged)
  cleaners.push(() => document.removeEventListener('doubao:speaking', speaking), () => document.removeEventListener('doubao:chat-mode', modeChanged))

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-links a'))
  const observer = new IntersectionObserver(entries => {
    const active = entries.find(entry => entry.isIntersecting)
    if (!active) return
    links.forEach(link => link.classList.toggle('is-active', link.hash === `#${active.target.id}`))
  }, { rootMargin: '-15% 0px -65% 0px' })
  links.forEach(link => { const target = document.querySelector(link.hash); if (target) observer.observe(target) })
  cleaners.push(() => observer.disconnect())
  return () => cleaners.reverse().forEach(clean => clean())
}
