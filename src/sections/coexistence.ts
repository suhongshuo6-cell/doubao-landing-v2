import { motionPrefs } from '../lib/motionPrefs'
import type { ScrollController } from '../motion/lenisSetup'
import type { AnchorMap } from '../motion/transitions'

/** Small, bounded interactions: the photographs remain the only full-screen stage. */
export function initCoexistence(scroll: ScrollController, anchors: AnchorMap): void {
  const root = document.documentElement
  const avatar = `${import.meta.env.BASE_URL}img/doubao-official-chibi.png`
  let activeGuide: HTMLElement | null = null, guideTimer = 0
  const guide = (host: HTMLElement, hint: string): ((text: string) => void) => {
    const line = document.createElement('div')
    line.className = 'little-guide'
    line.innerHTML = `<img src="${avatar}" width="28" height="28" alt="" hidden /><span role="status"></span>`
    const image = line.querySelector('img')!, label = line.querySelector('span')!
    label.textContent = hint; host.append(line)
    return text => {
      if (activeGuide && activeGuide !== line) activeGuide.querySelector('img')!.hidden = true
      window.clearTimeout(guideTimer)
      activeGuide = line; image.hidden = false; label.textContent = text
      if (!motionPrefs.reduced) image.animate([{ opacity: 0, transform: 'translateY(5px) rotate(-12deg)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' })
      guideTimer = window.setTimeout(() => { image.hidden = true; label.textContent = hint; activeGuide = null }, 4200)
    }
  }

  const detail = document.getElementById('productDetail')
  const tabs = document.getElementById('productTabs')
  if (detail && tabs) {
    const deck = document.createElement('div'); deck.className = 'ability-deck'
    detail.before(deck); deck.append(detail)
    detail.classList.add('ability-deck__card')
    const controls = document.createElement('div'); controls.className = 'deck-controls'
    controls.innerHTML = '<button type="button" aria-label="上一项能力">←</button><span class="deck-count" aria-live="polite">01 / 08</span><button type="button" aria-label="下一项能力">→</button>'
    deck.after(controls)
    const say = guide(controls, '左右轻推卡片，发现另一种可能。')
    const items = Array.from(tabs.querySelectorAll<HTMLButtonElement>('button'))
    const current = (): number => items.findIndex(item => item.getAttribute('aria-selected') === 'true')
    const update = (): void => { controls.querySelector('.deck-count')!.textContent = `${String(current() + 1).padStart(2, '0')} / 08` }
    const move = (direction: number): void => { items[(current() + direction + items.length) % items.length]?.click() }
    controls.querySelectorAll('button').forEach((button, i) => button.addEventListener('click', () => move(i === 0 ? -1 : 1)))
    tabs.addEventListener('click', () => { update(); say('选好一个方向，再带着问题去聊聊。') })
    let drag: { id: number; x: number; y: number } | null = null
    const reset = (): void => { detail.style.transform = ''; detail.classList.remove('is-dragging'); drag = null }
    detail.addEventListener('pointerdown', event => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('a,button,input,textarea')) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      detail.setPointerCapture(event.pointerId); detail.classList.add('is-dragging')
    })
    detail.addEventListener('pointermove', event => {
      if (motionPrefs.reduced) return
      if (drag) {
        const dx = Math.max(-85, Math.min(85, event.clientX - drag.x))
        detail.style.transform = `translateX(${dx * .55}px) rotate(${dx * .045}deg)`
      } else if (event.pointerType === 'mouse') {
        const rect = detail.getBoundingClientRect()
        detail.style.transform = `perspective(800px) rotateY(${(event.clientX - rect.left - rect.width / 2) / rect.width * 5}deg) rotateX(${-(event.clientY - rect.top - rect.height / 2) / rect.height * 4}deg)`
      }
    })
    detail.addEventListener('pointerup', event => {
      if (!drag) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      reset()
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1)
    })
    detail.addEventListener('pointercancel', reset)
    detail.addEventListener('lostpointercapture', reset)
    detail.addEventListener('pointerleave', () => { if (!drag) reset() })
  }

  const recipeActions = document.querySelector<HTMLElement>('[data-play-panel="recipe"] .play-actions')
  if (recipeActions) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'recipeShuffle'; button.className = 'inspiration-shuffle'; button.textContent = '✳ 抽一份灵感'
    recipeActions.before(button)
    const say = guide(recipeActions.parentElement!, '没有头绪？让灵感先来敲门。')
    button.addEventListener('click', () => {
      for (const field of ['task', 'tone', 'format']) {
        const choices = Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-recipe="${field}"]`)).filter(item => item.getAttribute('aria-pressed') !== 'true')
        const choice = choices[Math.floor(Math.random() * choices.length)]
        choice?.click()
        if (choice && !motionPrefs.reduced) choice.animate([{ transform: 'translateY(-8px) rotate(-5deg)' }, { transform: 'translateY(2px) rotate(2deg)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' })
      }
      const output = document.getElementById('recipeOutput')!
      if (!motionPrefs.reduced) output.animate([{ boxShadow: '0 0 0 4px rgba(191,92,59,.15)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 650 })
      say('新配方出炉。还可以改几个字，让它更像你。')
    })
    document.getElementById('recipeCopy')?.addEventListener('click', () => say('把这份灵感带走，接着写你的下一句。'))
  }

  const dayBar = document.querySelector<HTMLElement>('.day-timeline')
  if (dayBar) {
    const dial = document.createElement('label'); dial.className = 'day-dial'
    dial.innerHTML = '<span>把一天，拨到你喜欢的时刻。</span><input id="dayDial" type="range" min="0" max="2" step="1" value="0" aria-label="一天中的时刻" aria-valuetext="早晨" /><span class="day-dial__marks" aria-hidden="true"><i>早晨</i><i>午间</i><i>夜晚</i></span>'
    dayBar.querySelector('.day-tabs')!.after(dial)
    const input = dial.querySelector('input')!
    const items = Array.from(dayBar.querySelectorAll<HTMLButtonElement>('.day-tab'))
    const say = guide(dayBar, '同一个豆包，陪你走过不同的时刻。')
    const sync = (): void => {
      const index = items.findIndex(item => item.getAttribute('aria-selected') === 'true')
      input.value = String(index); input.setAttribute('aria-valuetext', items[index]!.textContent!)
    }
    input.addEventListener('input', () => items[Number(input.value)]?.click())
    items.forEach((item, index) => {
      item.tabIndex = index === 0 ? 0 : -1
      item.addEventListener('click', () => { items.forEach(button => { button.tabIndex = button === item ? 0 : -1 }); sync(); say(`${item.textContent}的灵感，已经接上了。`) })
    })
    dayBar.querySelector('.day-tabs')!.addEventListener('keydown', event => {
      const key = event as KeyboardEvent
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key.key)) return
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (index < 0) return
      key.preventDefault()
      const next = key.key === 'Home' ? 0 : key.key === 'End' ? 2 : (index + (key.key === 'ArrowRight' ? 1 : -1) + 3) % 3
      items[next]?.click(); items[next]?.focus()
    })
  }

  const studio = document.querySelector<HTMLElement>('.character-studio__copy')
  if (studio) {
    const button = document.createElement('button'); button.id = 'portraitQuiet'; button.type = 'button'; button.className = 'quiet-portrait'; button.innerHTML = '把这一幕留给她 <span>↗</span>'
    studio.append(button)
    const modal = document.createElement('dialog'); modal.id = 'portraitViewer'; modal.className = 'portrait-viewer'; modal.setAttribute('aria-label', '欣赏人物全貌')
    modal.innerHTML = '<div class="portrait-viewer__toolbar"><span>慢一点，看见她。</span><div role="group" aria-label="欣赏模式人物视角"><button type="button" data-view="0">正面</button><button type="button" data-view="1">侧面</button><button type="button" data-view="2">背面</button></div><button type="button" class="portrait-viewer__exit">返回页面 ×</button></div>'
    document.body.append(modal)
    const exit = modal.querySelector<HTMLButtonElement>('.portrait-viewer__exit')!
    const views = Array.from(modal.querySelectorAll<HTMLButtonElement>('[data-view]'))
    const sync = (): void => views.forEach(item => item.setAttribute('aria-pressed', String(document.querySelector(`[data-character-view="${item.dataset.view}"]`)?.getAttribute('aria-pressed') === 'true')))
    views.forEach(item => item.addEventListener('click', () => { document.querySelector<HTMLButtonElement>(`[data-character-view="${item.dataset.view}"]`)?.click(); sync() }))
    const hide = (): void => { modal.close(); root.classList.remove('portrait-quiet'); scroll.lenis?.start(); button.focus({ preventScroll: true }) }
    button.addEventListener('click', () => {
      anchors.refresh(); scroll.scrollTo(anchors.toScroll(.92), { immediate: true }); scroll.lenis?.stop()
      root.classList.add('portrait-quiet'); sync(); modal.showModal(); exit.focus({ preventScroll: true })
    })
    exit.addEventListener('click', hide)
    modal.addEventListener('cancel', event => { event.preventDefault(); hide() })
    modal.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        const index = views.findIndex(item => item.getAttribute('aria-pressed') === 'true')
        views[(index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3]?.click()
      }
    })
    const hint = studio.querySelector('.mini-label')
    if (hint && motionPrefs.coarse) hint.textContent = '点选正面、侧面或背面，换个角度看她。'
  }
}
