import { motionPrefs } from '../lib/motionPrefs'

export type PortraitFrame = 'pending' | 'poster' | 'video'
export interface BootVeil {
  readonly whenOpen: Promise<void>
  painted(mode: PortraitFrame, staticMode?: boolean): void
}

/** Gate on an actual rendered portrait, never elapsed time or body assets. */
export function initBootVeil(): BootVeil {
  const root = document.documentElement
  const veil = document.getElementById('bootVeil')!
  const video = document.getElementById('faceSrc') as HTMLVideoElement
  const poster = document.querySelector<HTMLImageElement>('.hero-poster')!
  const status = document.getElementById('bootStatus')!
  const count = document.getElementById('bootCount')!
  const progress = document.getElementById('bootProgress')!
  const staticButton = document.getElementById('bootStatic') as HTMLButtonElement
  const retry = document.getElementById('bootRetry') as HTMLButtonElement
  const mascot = document.getElementById('bootMascot') as HTMLButtonElement
  const greeting = document.getElementById('bootGreeting')!
  const started = performance.now()
  const steps = new Set<string>()
  let painted: PortraitFrame = 'pending'
  let staticAllowed = motionPrefs.reduced || root.dataset.motion === 'paused' || Boolean(video.error)
  let failedStage = false, opening = false, disposed = false
  let resolveOpen: () => void = () => undefined
  const whenOpen = new Promise<void>(resolve => { resolveOpen = resolve })
  const hiddenContent = Array.from(document.querySelectorAll<HTMLElement>('main, header.nav, footer, .skip, .rail'))
  const inertBefore = hiddenContent.map(el => el.inert)
  const restoration = history.scrollRestoration
  history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  root.dataset.bootController = '1'
  root.dataset.bootState = 'waiting'
  hiddenContent.forEach(el => { el.inert = true })
  veil.focus({ preventScroll: true })

  const cleanups: Array<() => void> = []
  const listen = (target: EventTarget, type: string, callback: EventListener): void => {
    target.addEventListener(type, callback); cleanups.push(() => target.removeEventListener(type, callback))
  }
  const update = (): void => {
    if (opening || disposed) return
    count.textContent = `${String(steps.size).padStart(2, '0')} / 03`
    progress.setAttribute('aria-valuenow', String(steps.size))
    veil.style.setProperty('--boot-progress', String(steps.size / 3))
    document.querySelectorAll<HTMLElement>('[data-boot-step]').forEach(el => el.classList.toggle('is-done', steps.has(el.dataset.bootStep!)))
    status.textContent = steps.has('video') ? '正在让她的微笑出现在画面里…' : steps.has('portrait') ? '照片已就位，等她眨一下眼…' : '正在准备，与你见面的那张脸…'
    if (staticAllowed) status.textContent = steps.has('portrait') ? '静态微笑已就位，正在准备画面…' : '正在准备一张清晰的微笑…'
    progress.setAttribute('aria-valuetext', status.textContent)
  }
  const finish = (): void => {
    if (disposed) return
    disposed = true
    cleanups.forEach(clean => clean())
    window.clearTimeout(slowTimer)
    hiddenContent.forEach((el, i) => { el.inert = inertBefore[i]! })
    root.classList.remove('booting')
    root.dataset.bootState = 'entered'
    history.scrollRestoration = restoration
    const returnFocus = veil.contains(document.activeElement)
    veil.remove()
    if (returnFocus) document.getElementById('heroEnter')?.focus({ preventScroll: true })
    document.dispatchEvent(new CustomEvent('doubao:veil-open'))
    resolveOpen()
  }
  const reveal = (): void => {
    if (opening || disposed) return
    const usableFrame = painted === 'video' || (staticAllowed && painted === 'poster') || (failedStage && steps.has('portrait'))
    if (!usableFrame) return
    opening = true
    root.dataset.bootState = 'ready'
    root.dataset.bootMode = painted === 'video' && !staticAllowed ? 'video' : 'poster'
    if (root.dataset.bootMode === 'poster') document.querySelector<HTMLElement>('[data-boot-step="video"]')!.textContent = '02 · 静帧'
    steps.add('portrait'); steps.add('video'); steps.add('stage')
    count.textContent = '03 / 03'
    progress.setAttribute('aria-valuenow', '3')
    progress.setAttribute('aria-valuetext', '人物画面已准备好')
    veil.style.setProperty('--boot-progress', '1')
    veil.classList.add('is-ready')
    document.querySelectorAll('[data-boot-step]').forEach(el => el.classList.add('is-done'))
    document.getElementById('bootTitle')!.textContent = '你好，见面啦。'
    status.textContent = '微笑已就位，欢迎进来。'
    veil.setAttribute('aria-busy', 'false')
    const delay = motionPrefs.reduced ? 0 : Math.max(0, 950 - (performance.now() - started))
    window.setTimeout(() => {
      if (motionPrefs.reduced) { finish(); return }
      veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 640, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }).finished.then(finish).catch(finish)
      veil.querySelector('.boot-scene')?.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-16px)', opacity: 0 }], { duration: 500, easing: 'ease-in', fill: 'forwards' })
    }, delay)
  }
  const decodedPoster = async (): Promise<void> => {
    try {
      await poster.decode()
      if (!poster.naturalWidth || disposed) return
      steps.add('portrait'); update(); reveal()
    } catch {
      if (!opening && !disposed) { status.textContent = '画面暂时没有送达，可以再试一次。'; retry.hidden = false }
    }
  }
  void decodedPoster()
  listen(video, 'loadeddata', () => { steps.add('video'); update() })
  listen(video, 'error', () => { staticAllowed = true; update(); reveal() })
  listen(document, 'doubao:stage-failed', event => {
    if ((event as CustomEvent<{ scope?: string }>).detail?.scope === 'body') return
    failedStage = true; staticAllowed = true; root.dataset.faceRendered = '0'; update(); reveal()
  })
  const slowTimer = window.setTimeout(() => {
    if (opening || disposed) return
    status.textContent = steps.has('portrait') ? '她还在路上。你可以继续等，也可以先看静态微笑。' : '网络有点慢，我们还在接收画面。'
    retry.hidden = false
    staticButton.hidden = !steps.has('portrait')
  }, 12000)
  retry.removeAttribute('onclick')
  listen(retry, 'click', () => window.location.reload())
  listen(staticButton, 'click', () => {
    staticAllowed = true
    document.dispatchEvent(new CustomEvent('doubao:pause-portrait'))
    video.pause()
    if (painted === 'pending' && steps.has('portrait')) {
      failedStage = true
      root.dataset.faceRendered = '0'
      document.getElementById('stage')!.style.visibility = 'hidden'
    }
    update(); reveal()
  })
  let greetingTimer = 0
  listen(mascot, 'click', () => {
    greeting.textContent = ['收到你的招呼啦。', '围巾系好了，马上见。', '把好奇心也带上吧。'][Math.floor(Math.random() * 3)]!
    if (!motionPrefs.reduced) mascot.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.13,.87) rotate(-7deg)' }, { transform: 'scale(.96,1.06) rotate(3deg)' }, { transform: 'scale(1,1)' }], { duration: 560, easing: 'ease-out' })
    window.clearTimeout(greetingTimer)
    greetingTimer = window.setTimeout(() => { greeting.textContent = '点一下，先打个招呼' }, 2200)
  })
  cleanups.push(() => window.clearTimeout(greetingTimer))
  listen(veil, 'pointermove', event => {
    if (motionPrefs.reduced) return
    const pointer = event as PointerEvent
    veil.style.setProperty('--boot-look-x', `${((pointer.clientX / innerWidth - .5) * 4).toFixed(2)}px`)
    veil.style.setProperty('--boot-look-y', `${((pointer.clientY / innerHeight - .5) * 3).toFixed(2)}px`)
  })
  listen(veil, 'keydown', event => {
    const key = event as KeyboardEvent
    if (key.key !== 'Tab') return
    const buttons = [mascot, retry, staticButton].filter(button => !button.hidden)
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    key.preventDefault()
    buttons[(index + (key.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
  })
  update()
  return {
    whenOpen,
    painted(mode, staticMode = false) {
      if (opening || disposed || mode === 'pending') return
      if (mode === painted && (!staticMode || staticAllowed)) return
      staticAllowed ||= staticMode
      painted = mode
      if (mode === 'video') { steps.add('portrait'); steps.add('video'); steps.add('stage') }
      else if (staticAllowed) { steps.add('portrait'); steps.add('stage') }
      update(); reveal()
    },
  }
}
