import { motionPrefs } from '../lib/motionPrefs'
import type { ScrollController } from '../motion/lenisSetup'

const products = [
  ['写作与表达', '把零散想法整理成清楚的表达。从活动文案、工作邮件到文章初稿，告诉豆包你的主题、对象和语气，再一起打磨内容。', '帮我把这段想法写成一封简洁、友好的工作邮件，先问我需要补充的信息。'],
  ['AI 搜索', '好奇一个新话题，先从一个问题开始。让豆包帮你搜索相关信息、整理关注点，再沿着感兴趣的线索继续追问和阅读。', '我想了解城市骑行，从装备、安全和路线三个方面给我一份入门指南。'],
  ['翻译与双语阅读', '看外文网页、读资料或准备跨语言表达时，可以使用划词、网页对照与 PDF 翻译，让理解和阅读衔接得更顺畅。', '请帮我练习用英语介绍自己的工作。先给我一个自然的表达，再解释可以替换的词。'],
  ['编程与代码理解', '看不懂一段代码，或不知道一个想法如何开始实现？把需求和问题描述清楚，试着让豆包解释代码、讨论思路，陪你推进实践。', '我想做一个简单的待办清单网页，请先拆解实现步骤，解释每一步需要什么。'],
  ['图像与视频创作', '将脑海里的画面写下来，探索图像与视频创作。也可以提供参考素材，描述主体、场景和风格，逐步调整自己的创意方向。', '帮我构思一支关于夏日散步的短片，列出三个画面方向和每个方向的镜头描述。'],
  ['自然语音交流', '不方便打字的时候，直接说出来。用语音讨论问题、练习表达或听一段故事，也可以在交流过程中打断，再换一个方向继续聊。', '陪我练习明天的面试。每次问我一个问题，等我回答后再给建议。'],
  ['文档与办公创作', '从一份工作资料开始，把目标和已有内容交给豆包。探索文档生成、内容编辑与演示文稿创作，再根据自己的需要检查和完善。', '我要做一份五页的项目汇报，请先帮我梳理目录，以及每一页需要回答的问题。'],
  ['看图与屏幕理解', '有些问题，展示画面更容易说明。上传图片，或在官方客户端主动开启视频通话和屏幕共享，围绕眼前的内容向豆包提问。', '我想学习如何分析一张照片的构图，请用主体、光线、色彩和留白四个角度教我观察。'],
] as const

type StoryNode = { text: string; choices?: Array<[string, string]>; ending?: string }
const story: Record<string, StoryNode> = {
  start: { text: '周五傍晚，豆包递来一张没有地址的明信片。背面只有一句话：「在日落之前，找回今天错过的那一点快乐。」你决定先去——', choices: [['沿着河边走', 'river'], ['钻进街角书店', 'book']] },
  river: { text: '河面把天空揉成了橘子色。一只纸船停在岸边，船里藏着半张地图。远处有人在弹琴，你会——', choices: [['循着琴声走过去', 'music'], ['把纸船重新放回水里', 'boat']] },
  book: { text: '店主从旧书里抽出一张车票。「有人留下了它，也许是给你的。」窗边的猫翻了个身，露出脖子上的红丝带。你会——', choices: [['坐下读一页书', 'page'], ['问问车票通向哪里', 'ticket']] },
  music: { text: '你坐到台阶上，听完了一首不知名字的歌。豆包轻轻说：「原来今天缺的，是不赶路的五分钟。」', ending: '01 / 把时间还给自己' },
  boat: { text: '纸船顺流而下，带着半张地图去找下一个人。夕阳落下时，你突然不再急着找到答案。', ending: '02 / 留一点未知给明天' },
  page: { text: '你读到一句恰好需要的话，把它抄在明信片背面。红丝带的猫靠在你的脚边，今晚有了一个小小的开头。', ending: '03 / 让一个句子陪你回家' },
  ticket: { text: '「下一站，是你一直想去的地方。」店主笑了。你在明信片上写下一个名字，决定这个周末真的出发。', ending: '04 / 把想去变成出发' },
}

// Arrow keys, Home and End follow the WAI-ARIA tabs pattern.
function keyboardTabs(host: HTMLElement): void {
  host.addEventListener('keydown', event => {
    const items = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next]?.click(); items[next]?.focus()
  })
}

export function initImmersive(scroll: ScrollController): void {
  const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null
  const completed = new Set<string>()
  try { (JSON.parse(sessionStorage.getItem('doubao-explorations') || '[]') as string[]).forEach(key => completed.add(key)) } catch { /* optional storage */ }
  const stamp = (key: string): void => {
    completed.add(key)
    const badge = byId('experiencePass')
    if (badge) { badge.querySelector('b')!.textContent = `${completed.size} / 5`; badge.title = '探索：捏脸、配方、故事、专注、人物视角' }
    try { sessionStorage.setItem('doubao-explorations', JSON.stringify([...completed])) } catch { /* optional */ }
  }
  const badge = byId('experiencePass')?.querySelector('b')
  if (badge) badge.textContent = `${completed.size} / 5`
  document.addEventListener('doubao:pinch-reward', () => stamp('pinch'))

  const send = (text: string): void => {
    const stage = byId('chatStage')
    if (stage) scroll.scrollTo(stage.offsetTop - 70, { duration: .9 })
    window.setTimeout(() => {
      const win = window as unknown as { __askbarFill?: (value: string, autoSend: boolean) => void }
      win.__askbarFill?.(text, false)
    }, motionPrefs.reduced ? 0 : 950)
  }

  const menu = byId<HTMLButtonElement>('siteMenu')
  const nav = byId('nav')
  const setMenu = (open: boolean): void => { menu?.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('is-menu-open', open) }
  menu?.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'))
  byId('exploreMenu')?.addEventListener('click', () => setMenu(false))
  document.addEventListener('pointerdown', event => { if (!(event.target as HTMLElement).closest('.nav')) setMenu(false) })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus() } })

  const chapters = Array.from(document.querySelectorAll<HTMLElement>('main > section[data-anchor]'))
  const rail = byId('storyProgress')
  chapters.slice(1).forEach(section => {
    const a = document.createElement('a')
    a.href = `#${section.id}`
    const title = section.querySelector('h2')?.textContent?.trim().replace(/\s+/g, ' ') || section.id
    a.setAttribute('aria-label', title)
    const span = document.createElement('span'); span.textContent = title; a.append(span)
    a.addEventListener('click', event => { event.preventDefault(); scroll.scrollTo(section.offsetTop - 70, { duration: 1 }) })
    rail?.append(a)
  })
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) rail?.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
      const active = link.hash === `#${entry.target.id}`
      link.classList.toggle('is-active', active)
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current')
    })
  }, { rootMargin: '-25% 0px -65% 0px' })
  chapters.forEach(section => observer.observe(section))

  let productIndex = 0
  const tabs = byId('productTabs')
  const detail = byId('productDetail')
  const updateProduct = (index: number): void => {
    productIndex = index
    tabs?.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => { button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1 })
    if (!detail) return
    detail.setAttribute('aria-labelledby', `productTab${index}`)
    const h = document.createElement('h3'); h.textContent = products[index]![0]
    const p = document.createElement('p'); p.textContent = products[index]![1]
    const q = document.createElement('blockquote'); q.textContent = `试着问：「${products[index]![2]}」`
    detail.replaceChildren(h, p, q)
    if (!motionPrefs.reduced) detail.animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' })
  }
  products.forEach((item, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = item[0]; button.id = `productTab${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'productDetail'); button.addEventListener('click', () => updateProduct(index)); tabs?.append(button)
  })
  if (tabs) keyboardTabs(tabs)
  updateProduct(0)
  byId('productTry')?.addEventListener('click', () => send(products[productIndex]![2]))

  const playTabs = byId('playTabs')
  playTabs?.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    button.id = `playTab-${button.dataset.play}`; button.setAttribute('aria-controls', `playPanel-${button.dataset.play}`)
    button.tabIndex = button.getAttribute('aria-selected') === 'true' ? 0 : -1
    button.addEventListener('click', () => {
      playTabs.querySelectorAll<HTMLButtonElement>('button').forEach(tab => { const active = tab === button; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1 })
      document.querySelectorAll<HTMLElement>('[data-play-panel]').forEach(panel => { panel.hidden = panel.dataset.playPanel !== button.dataset.play })
    })
  })
  document.querySelectorAll<HTMLElement>('[data-play-panel]').forEach(panel => { panel.id = `playPanel-${panel.dataset.playPanel}`; panel.setAttribute('aria-labelledby', `playTab-${panel.dataset.playPanel}`) })
  if (playTabs) keyboardTabs(playTabs)

  const recipe: Record<string, string> = { task: '安排一次周末旅行', tone: '轻松、有亲近感', format: '一份可以直接使用的清单' }
  const output = byId<HTMLTextAreaElement>('recipeOutput')
  const compose = (): void => { if (output) output.value = `请帮我${recipe.task}。希望表达${recipe.tone}，最后给我${recipe.format}。如果信息不够，请先问我三个关键问题。` }
  document.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('is-selected')))
    button.addEventListener('click', () => {
      recipe[button.dataset.recipe!] = button.dataset.value!
      button.closest('fieldset')?.querySelectorAll('button').forEach(item => { item.classList.toggle('is-selected', item === button); item.setAttribute('aria-pressed', String(item === button)) }); compose()
    })
  })
  compose()
  byId('recipeSend')?.addEventListener('click', () => { if (output?.value.trim()) { stamp('recipe'); send(output.value.trim()) } })
  const copy = byId<HTMLButtonElement>('recipeCopy')
  copy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output?.value || ''); copy.textContent = '已复制 ✓'; stamp('recipe') }
    catch { output?.focus(); output?.select(); copy.textContent = '请按 ⌘ / Ctrl + C 复制' }
    window.setTimeout(() => { copy.textContent = '复制配方' }, 2400)
  })

  const storyLines = byId('storyLines'), storyChoices = byId('storyChoices')
  const renderStory = (key: string, choice?: string): void => {
    const node = story[key]!
    if (choice) { const picked = document.createElement('p'); picked.className = 'story-picked'; picked.textContent = `你选择了：${choice}`; storyLines?.append(picked) }
    const p = document.createElement('p'); p.textContent = node.text; storyLines?.append(p)
    if (!motionPrefs.reduced) p.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380 })
    storyChoices?.replaceChildren()
    node.choices?.forEach(([label, next]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `${label} ↗`; button.addEventListener('click', () => renderStory(next, label)); storyChoices?.append(button) })
    if (node.ending) { const end = document.createElement('p'); end.className = 'story-ending'; end.textContent = node.ending; storyChoices?.append(end); stamp('story') }
  }
  renderStory('start')
  byId('storyRestart')?.addEventListener('click', () => { storyLines?.replaceChildren(); renderStory('start') })

  let duration = 5 * 60_000, remaining = duration, endAt = 0, running = false
  const goal = byId<HTMLInputElement>('focusGoal'), start = byId<HTMLButtonElement>('focusStart'), status = byId('focusStatus')
  try {
    const saved = JSON.parse(sessionStorage.getItem('doubao-focus') || 'null') as { duration: number; remaining: number; endAt: number; running: boolean; goal: string } | null
    if (saved && [300_000, 900_000, 1_500_000].includes(saved.duration) && Number.isFinite(saved.remaining) && Number.isFinite(saved.endAt)) {
      duration = saved.duration; running = Boolean(saved.running); endAt = saved.endAt; remaining = Math.min(duration, Math.max(0, running ? endAt - Date.now() : saved.remaining)); if (goal) goal.value = saved.goal
    }
  } catch { /* optional storage */ }
  const persist = (): void => { try { sessionStorage.setItem('doubao-focus', JSON.stringify({ duration, remaining, endAt, running, goal: goal?.value || '' })) } catch { /* optional */ } }
  const drawClock = (): void => {
    const seconds = Math.ceil(remaining / 1000)
    const time = byId('focusTime'); if (time) time.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    byId('focusClock')?.classList.toggle('is-running', running)
    const ring = document.querySelector<SVGCircleElement>('.focus-clock__progress'); if (ring) ring.style.strokeDashoffset = String(339.292 * (1 - remaining / duration))
    if (start) start.textContent = running ? '暂停一下' : remaining === 0 ? '再来一轮' : remaining < duration ? '继续专注' : '开始专注'
    document.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(button => { const selected = Number(button.dataset.duration) * 60_000 === duration; button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected)) })
  }
  start?.addEventListener('click', () => {
    if (running) { remaining = Math.max(0, endAt - Date.now()); running = false; if (status) status.textContent = '暂停了。准备好再继续。' }
    else { if (remaining <= 0) remaining = duration; endAt = Date.now() + remaining; running = true; stamp('focus'); if (status) status.textContent = goal?.value.trim() ? `现在只做：${goal.value.trim()}` : '慢慢来，把注意力留在这一刻。' }
    persist(); drawClock()
  })
  const resetClock = (): void => { running = false; remaining = duration; endAt = 0; if (status) status.textContent = '准备好，就开始。'; persist(); drawClock() }
  byId('focusReset')?.addEventListener('click', resetClock)
  document.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(button => button.addEventListener('click', () => { duration = Number(button.dataset.duration) * 60_000; resetClock() }))
  goal?.addEventListener('change', persist)
  window.setInterval(() => {
    if (!running) return
    remaining = Math.max(0, endAt - Date.now())
    if (remaining === 0) { running = false; if (status) status.textContent = '这段专注完成了。伸个懒腰，给自己一点掌声。'; persist() }
    drawClock()
  }, 250)
  if (running && status) status.textContent = '已接上你刚才的专注。'
  drawClock()

  let view = 0
  const changeView = (next: number): void => {
    view = (next + 3) % 3
    document.querySelectorAll<HTMLButtonElement>('[data-character-view]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.characterView) === view)))
    document.dispatchEvent(new CustomEvent('doubao:character-view', { detail: view })); stamp('view')
  }
  document.querySelectorAll<HTMLButtonElement>('[data-character-view]').forEach(button => button.addEventListener('click', () => changeView(Number(button.dataset.characterView))))
  let dragX: number | null = null
  byId('characterStudio')?.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse' && !(event.target as HTMLElement).closest('button, input, a, .glass-panel')) dragX = event.clientX })
  window.addEventListener('pointerup', event => { if (dragX !== null && Math.abs(event.clientX - dragX) > 65) changeView(view + (event.clientX < dragX ? 1 : -1)); dragX = null })
  byId<HTMLInputElement>('spotlightRange')?.addEventListener('input', event => {
    const value = Number((event.target as HTMLInputElement).value)
    document.documentElement.style.setProperty('--stage-tint', `hsla(${220 - value * 1.85},70%,65%,.15)`)
  })
  document.addEventListener('pointermove', event => {
    if (motionPrefs.reduced || event.pointerType !== 'mouse') return
    document.documentElement.style.setProperty('--spot-x', `${(event.clientX / innerWidth * 100).toFixed(1)}%`)
    document.documentElement.style.setProperty('--spot-y', `${(event.clientY / innerHeight * 100).toFixed(1)}%`)
  }, { passive: true })
  document.querySelectorAll<HTMLButtonElement>('.faq-item h3 button').forEach((button, index) => {
    const answer = button.closest('.faq-item')?.querySelector<HTMLElement>('.faq-answer')
    if (!answer) return
    answer.id = `faqAnswer${index}`; button.setAttribute('aria-controls', answer.id)
    button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); answer.hidden = !open; if (open && !motionPrefs.reduced) answer.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 250 }) })
  })
}
