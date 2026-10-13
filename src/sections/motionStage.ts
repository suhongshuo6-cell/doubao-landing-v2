import { clamp01, lerp, motionPrefs, smoothstep } from '../lib/motionPrefs'
import type { FrameLoop } from '../lib/frameLoop'
import type { ScrollController } from '../motion/lenisSetup'

type Palette = 'peach' | 'blue' | 'mint'
type Landscape = 'coast' | 'city' | 'night'
const palettes: Record<Palette, [string, string, string, string]> = {
  peach: ['#f5d8bb', '#efab95', '#ae665e', '#fff2c8'],
  blue: ['#c6dcdf', '#80a9bd', '#425c83', '#fff1bd'],
  mint: ['#dce3c3', '#a9c5ae', '#5c8175', '#fff4d8'],
}

/** Original vector artwork, shared by the result card and the exportable playground. */
function posterSVG(scene: Landscape, palette: Palette, x = 420, y = 175, id = 'poster'): string {
  const [sky, water, land, sun] = palettes[palette]
  const night = scene === 'night'
  const title = scene === 'coast' ? '把日子，交给山海。' : scene === 'city' ? '在城市里，慢一点。' : '今晚，和星光见面。'
  const terrain = scene === 'city'
    ? `<path d="M0 440H45V290H130V440H165V230H255V440H300V330H375V440H410V275H505V440H550V360H600V720H0Z" fill="${land}"/><path d="M58 313H116M58 340H116M180 260H240M180 290H240M180 320H240M426 306H490M426 337H490" stroke="${sky}" stroke-width="9" opacity=".55"/><path d="M280 720L355 450H425L600 720" fill="${sun}" opacity=".45"/>`
    : `<path d="M0 430L145 260L290 438L438 325L600 460V720H0Z" fill="${land}" opacity=".72"/><path d="M0 475Q160 408 310 474T600 465V720H0Z" fill="${water}"/><path d="M0 584Q170 500 600 561M0 625Q235 553 600 601M100 675Q350 625 600 651" fill="none" stroke="${sun}" stroke-width="2" opacity=".46"/><path d="M0 720V625Q92 555 190 578T360 720" fill="${land}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" role="img" aria-label="${title}"><defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="${night ? '#282f54' : sky}"/><stop offset="1" stop-color="${night ? land : water}"/></linearGradient><pattern id="${id}-grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#fff" opacity=".12"/></pattern></defs><rect width="600" height="720" fill="url(#${id}-sky)"/><circle cx="${x}" cy="${y}" r="67" fill="${sun}"/>${night ? '<path d="M105 105l3 10 10 3-10 3-3 10-3-10-10-3 10-3M490 315l3 10 10 3-10 3-3 10-3-10-10-3 10-3M220 210l2 6 6 2-6 2-2 6-2-6-6-2 6-2" fill="#fff5cf"/><path d="M400 95l75-30" stroke="#fff5cf" opacity=".5"/>' : '<path d="M35 185h150M60 198h80M340 290h170M375 303h85" stroke="#fff" stroke-width="5" opacity=".25"/>'}${terrain}<rect width="600" height="720" fill="url(#${id}-grain)"/><text x="42" y="56" fill="${night ? '#fff2db' : land}" font-family="sans-serif" font-size="14" letter-spacing="4">A LITTLE DAYDREAM</text><text x="42" y="660" fill="${sun}" font-family="PingFang SC, sans-serif" font-size="30">${title}</text><text x="44" y="689" fill="${sun}" font-family="sans-serif" font-size="11" letter-spacing="3">MADE OF A LITTLE CURIOSITY / DOUBAO</text></svg>`
}

export function initMotionStage(scroll: ScrollController, loop: FrameLoop): void {
  const product = document.getElementById('productTour')!
  const runway = document.createElement('div'); runway.className = 'result-runway'; runway.id = 'resultRunway'
  runway.innerHTML = `<div class="result-sticky"><header class="result-intro"><p class="story-label">A THOUGHT IN MOTION / 灵感展开中</p><h2>一个念头，<br />长出很多可能。</h2><p>往下滚，看想法展开。点一张，翻到它的另一面。</p></header><div class="result-space" aria-label="灵感成果卡片"></div><div class="result-navigation"><button type="button" id="resultPrev" aria-label="上一张成果卡">←</button><span id="resultCount" aria-live="polite">01 / 04 · 写作</span><button type="button" id="resultNext" aria-label="下一张成果卡">→</button><button type="button" id="resultUse">把这个想法带去聊 ↗</button></div><div class="result-scroll"><span>散开</span><i><b></b></i><span>聚焦</span></div></div>`
  product.prepend(runway)
  const samples = [
    { label: '写作', title: '把心意，写成一句话。', product: 0, prompt: '帮我给未来的自己写一封信，语气温柔，保留一个具体的生活细节。', art: '<span class="result-letter"><small>TO MY FUTURE SELF</small><b>亲爱的，<br/>未来的自己。</b><span>愿你记得今天的小小勇敢，<br/>也愿你一直有重新出发的心。</span><i>把心意，慢慢写下来。 ↗</i></span>' },
    { label: '创作', title: '给想象，一张画布。', product: 4, prompt: '帮我构思一张山海主题的旅行海报，用落日、层叠山峦和温暖色彩表达松弛感。', art: posterSVG('coast', 'peach', 420, 175, 'gallery') },
    { label: '搜索', title: '把好奇，变成一段旅程。', product: 1, prompt: '帮我规划一个不赶路的周末，先问我所在城市、预算和喜欢的活动。', art: '<span class="result-ticket"><small>A WEEKEND WITHOUT HURRY</small><b>周末，<br/>不赶路。</b><span class="ticket-route">此刻 <i>⤳</i> 想去的地方</span><span class="ticket-stops">09:00 · 一杯咖啡<br/>11:30 · 沿河散步<br/>16:00 · 等一场日落</span><i class="ticket-barcode"></i></span>' },
    { label: '编程', title: '让点子，有一个开始。', product: 3, prompt: '我想做一个能记录每日小确幸的网页，请先拆解结构，再解释代码如何工作。', art: '<span class="result-code"><small>● ● ● &nbsp; little-joy.ts</small><span><em>const</em> today = {<br/>&nbsp; mood: <i>"一点点快乐"</i>,<br/>&nbsp; courage: <i>true</i><br/>};<br/><br/><em>create</em>(today);</span><span class="code-preview"><i>✳</i> 今天，也值得记录。<b>＋ 收藏这一刻</b></span></span>' },
  ]
  const space = runway.querySelector<HTMLElement>('.result-space')!
  let selected = 0
  const cards = samples.map((sample, index) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = `result-card result-card--${index}`; card.dataset.result = String(index)
    card.setAttribute('aria-label', `${sample.label}成果卡：${sample.title}，点击翻面`)
    card.innerHTML = `<span class="result-card__inner"><span class="result-card__front">${sample.art}<span class="result-card__footer"><i>0${index + 1} / ${sample.label}</i><b>翻到另一面 ↗</b></span></span><span class="result-card__back"><small>A LITTLE START</small><b>${sample.title}</b><span>试着对豆包说</span><q>${sample.prompt}</q><i>再点一下，回到画面 ↩</i></span></span>`
    card.addEventListener('click', () => {
      if (selected !== index) select(index)
      card.classList.toggle('is-flipped')
    })
    card.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select((selected + (event.key === 'ArrowRight' ? 1 : -1) + 4) % 4); cards[selected]!.focus({ preventScroll: true }) } })
    space.append(card); return card
  })
  function select(index: number): void {
    selected = (index + 4) % 4
    cards.forEach((card, i) => { card.classList.remove('is-flipped'); card.setAttribute('aria-pressed', String(i === selected)); card.tabIndex = i === selected ? 0 : -1 })
    document.getElementById('resultCount')!.textContent = `0${selected + 1} / 04 · ${samples[selected]!.label}`
    runway.dataset.selected = String(selected)
  }
  select(0)
  document.getElementById('resultPrev')!.addEventListener('click', () => select(selected - 1))
  document.getElementById('resultNext')!.addEventListener('click', () => select(selected + 1))
  document.getElementById('resultUse')!.addEventListener('click', () => {
    const sample = samples[selected]!
    scroll.scrollTo(document.getElementById('chatStage')!, { duration: .85 })
    window.setTimeout(() => (window as unknown as { __askbarFill?: (value: string, send: boolean) => void }).__askbarFill?.(sample.prompt, false), motionPrefs.reduced ? 0 : 950)
  })
  const stageIntro = product.querySelector<HTMLElement>('.float-shell .story-heading')
  if (stageIntro) stageIntro.innerHTML = '找到你的下一步。'
  const chapterLink = document.querySelector<HTMLAnchorElement>('#storyProgress a[href="#productTour"]')
  chapterLink?.setAttribute('aria-label', '一个念头，长出很多可能。')
  if (chapterLink?.firstElementChild) chapterLink.firstElementChild.textContent = '一个念头，长出很多可能。'
  const explore = document.querySelector<HTMLElement>('.hero-scroll')
  if (explore) {
    explore.innerHTML = '<button type="button" id="motionExplore"><span aria-hidden="true">✳</span><span class="motion-explore__label">往下滚，展开灵感</span><i aria-hidden="true"></i></button>'
    document.getElementById('motionExplore')!.addEventListener('click', () => scroll.scrollTo(product.getBoundingClientRect().top + scrollY, { duration: 1.1 }))
  }
  const transform = cards.map(() => ({ x: 0, y: 0, rotate: 0, scale: .7 }))
  let px = 0, py = 0
  space.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse') return; const r = space.getBoundingClientRect(); px = (event.clientX - r.left) / r.width - .5; py = (event.clientY - r.top) / r.height - .5 })
  space.addEventListener('pointerleave', () => { px = 0; py = 0 })
  loop.add((dt, elapsed) => {
    const rect = runway.getBoundingClientRect()
    document.documentElement.classList.toggle('in-result-stage', rect.top < innerHeight * .3 && rect.bottom > innerHeight * .5)
    if (rect.top > innerHeight || rect.bottom < 0) return
    const p = motionPrefs.reduced ? 1 : clamp01(-rect.top / Math.max(1, runway.offsetHeight - innerHeight))
    const gather = smoothstep(clamp01(p / .55)), focus = smoothstep(clamp01((p - .45) / .55))
    const w = space.clientWidth
    runway.style.setProperty('--result-progress', String(p)); runway.dataset.phase = p < .25 ? 'scatter' : p < .7 ? 'gather' : 'focus'
    cards.forEach((card, i) => {
      const dir = i % 2 ? 1 : -1, row = i < 2 ? -1 : 1, delta = i - selected
      const spreadX = dir * w * .25, spreadY = row * 94 + (i % 2) * 16
      const fanX = (i - 1.5) * w * .20, fanY = Math.abs(i - 1.5) * 22 - 12
      const endX = delta * w * .18, endY = Math.abs(delta) * 15
      const tx = lerp(lerp(spreadX, fanX, gather), endX, focus)
      const ty = lerp(lerp(spreadY, fanY, gather), endY, focus)
      const targetScale = lerp(lerp(.68, .78, gather), delta === 0 ? 1 : .68, focus)
      const targetRotate = lerp(lerp(dir * (13 + i * 2), (i - 1.5) * 10, gather), delta * 8, focus)
      const state = transform[i]!, k = motionPrefs.reduced ? 1 : 1 - Math.exp(-9 * dt)
      state.x = lerp(state.x, tx, k); state.y = lerp(state.y, ty, k); state.rotate = lerp(state.rotate, targetRotate, k); state.scale = lerp(state.scale, targetScale, k)
      const float = motionPrefs.reduced || p > .85 ? 0 : Math.sin(elapsed * .8 + i * 1.6) * 4 * (1 - focus)
      card.style.transform = `translate(-50%,-50%) translate3d(${state.x + (motionPrefs.reduced ? 0 : px * (i + 1) * 5)}px,${state.y + float + (motionPrefs.reduced ? 0 : py * 8)}px,0) rotate(${state.rotate}deg) scale(${state.scale})`
      card.style.zIndex = String(i === selected ? 10 : 5 - Math.abs(delta))
      card.style.filter = `blur(${i === selected ? 0 : focus * 1.4}px)`
      card.style.opacity = String(i === selected ? 1 : 1 - focus * .36)
    })
  })

  initArtPlayground(scroll)
  initDaySky()
}

function initArtPlayground(scroll: ScrollController): void {
  const tabs = document.getElementById('playTabs')!
  const tab = document.createElement('button'); tab.type = 'button'; tab.id = 'playTab-art'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); tab.setAttribute('aria-controls', 'playPanel-art'); tab.tabIndex = -1; tab.dataset.play = 'art'; tab.textContent = '灵感画布'
  tabs.append(tab)
  const panel = document.createElement('div'); panel.className = 'glass-panel play-panel art-panel'; panel.dataset.playPanel = 'art'; panel.id = 'playPanel-art'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id); panel.hidden = true
  panel.innerHTML = `<div class="art-panel__head"><p class="mini-label">A LITTLE ART DIRECTOR</p><h3>把今天，调成你喜欢的颜色。</h3><p>选个场景，换种心情。拖动太阳，给这一刻安排一束光。</p></div><div class="art-poster" id="artPoster"><div id="artCanvas"></div><button id="artSun" type="button" aria-label="移动太阳：使用方向键调整位置" title="拖动太阳，也可用方向键"></button><span class="art-drag-hint">↔ 拖动这束光</span></div><fieldset class="art-scenes"><legend>想去哪里</legend><button type="button" data-art-scene="coast" aria-pressed="true">山海之间</button><button type="button" data-art-scene="city" aria-pressed="false">城市漫游</button><button type="button" data-art-scene="night" aria-pressed="false">星光夜话</button></fieldset><fieldset class="art-palettes"><legend>今天的颜色</legend><button type="button" data-art-palette="peach" aria-pressed="true"><i></i>落日桃</button><button type="button" data-art-palette="blue" aria-pressed="false"><i></i>海盐蓝</button><button type="button" data-art-palette="mint" aria-pressed="false"><i></i>薄荷绿</button></fieldset><div class="art-position"><label>日光位置<input id="artLight" type="range" min="90" max="510" value="420" aria-label="太阳水平位置" /></label><button type="button" id="artShuffle">✳ 换个灵感</button></div><div class="play-actions"><button type="button" class="story-action" id="artExport">留住这张画 ↓</button><button type="button" class="quiet-action" id="artPrompt">让豆包接着创作 ↗</button></div><p class="art-status" id="artStatus" role="status">这张画由你在本页调色与构图，点击即可保存。</p>`
  document.querySelector('[data-play-panel="focus"]')!.after(panel)
  const allTabs = (): HTMLButtonElement[] => Array.from(tabs.querySelectorAll('button'))
  tab.addEventListener('click', () => {
    allTabs().forEach(button => { const active = button === tab; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1 })
    document.querySelectorAll<HTMLElement>('[data-play-panel]').forEach(item => { item.hidden = item !== panel })
  })
  // Existing tab handlers query current panels; the new tab participates in their keyboard pattern.
  const invitation = document.createElement('button'); invitation.type = 'button'; invitation.className = 'art-invitation'; invitation.id = 'artInvitation'; invitation.innerHTML = '<span>✳</span><span><b>亲手导演一张画</b><small>换场景 · 调颜色 · 拖动一束光</small></span><i>↗</i>'
  document.querySelector('.playground-head')!.append(invitation)
  invitation.addEventListener('click', () => tab.click())
  let scene: Landscape = 'coast', palette: Palette = 'peach', x = 420, y = 175, dragId: number | null = null
  const canvas = document.getElementById('artCanvas')!, sun = document.getElementById('artSun')!, poster = document.getElementById('artPoster')!, light = document.getElementById('artLight') as HTMLInputElement
  const status = document.getElementById('artStatus')!
  function render(animate = false): void {
    canvas.innerHTML = posterSVG(scene, palette, x, y, 'editable')
    poster.dataset.scene = scene; poster.dataset.palette = palette
    sun.style.left = `${x / 6}%`; sun.style.top = `${y / 7.2}%`; light.value = String(x)
    sun.setAttribute('aria-description', `太阳位置：水平 ${Math.round(x)}，垂直 ${Math.round(y)}`)
    panel.querySelectorAll<HTMLButtonElement>('[data-art-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.artScene === scene)))
    panel.querySelectorAll<HTMLButtonElement>('[data-art-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.artPalette === palette)))
    if (animate && !motionPrefs.reduced) canvas.animate([{ opacity: .35, clipPath: 'circle(5% at 70% 25%)', transform: 'scale(1.06)' }, { opacity: 1, clipPath: 'circle(125% at 70% 25%)', transform: 'scale(1)' }], { duration: 780, easing: 'cubic-bezier(.2,.7,.2,1)' })
  }
  panel.querySelectorAll<HTMLButtonElement>('[data-art-scene]').forEach(button => button.addEventListener('click', () => { scene = button.dataset.artScene as Landscape; render(true); status.textContent = '换个场景，故事也有了新的开头。' }))
  panel.querySelectorAll<HTMLButtonElement>('[data-art-palette]').forEach(button => button.addEventListener('click', () => { palette = button.dataset.artPalette as Palette; render(true); status.textContent = '颜色已换好。继续移动太阳，试试另一种构图。' }))
  light.addEventListener('input', () => { x = Number(light.value); render() })
  sun.addEventListener('pointerdown', event => { dragId = event.pointerId; sun.setPointerCapture(dragId); poster.classList.add('is-directing') })
  sun.addEventListener('pointermove', event => {
    if (dragId !== event.pointerId) return
    const r = poster.getBoundingClientRect(); x = Math.max(90, Math.min(510, (event.clientX - r.left) / r.width * 600)); y = Math.max(90, Math.min(320, (event.clientY - r.top) / r.height * 720)); render()
  })
  const stop = (): void => { dragId = null; poster.classList.remove('is-directing') }
  sun.addEventListener('pointerup', stop); sun.addEventListener('pointercancel', stop); sun.addEventListener('lostpointercapture', stop)
  sun.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    x = Math.max(90, Math.min(510, x + (event.key === 'ArrowLeft' ? -15 : event.key === 'ArrowRight' ? 15 : 0)))
    y = Math.max(90, Math.min(320, y + (event.key === 'ArrowUp' ? -15 : event.key === 'ArrowDown' ? 15 : 0))); render()
  })
  document.getElementById('artShuffle')!.addEventListener('click', () => {
    const scenes: Landscape[] = ['coast', 'city', 'night'], colors: Palette[] = ['peach', 'blue', 'mint']
    scene = scenes[(scenes.indexOf(scene) + 1 + Math.floor(Math.random() * 2)) % 3]!; palette = colors[(colors.indexOf(palette) + 1 + Math.floor(Math.random() * 2)) % 3]!
    x = 150 + Math.round(Math.random() * 300); y = 110 + Math.round(Math.random() * 140); render(true); status.textContent = '新的灵感来了。这一次，你会把光放在哪里？'
  })
  document.getElementById('artExport')!.addEventListener('click', async () => {
    const blob = new Blob([posterSVG(scene, palette, x, y, 'export')], { type: 'image/svg+xml;charset=utf-8' }), url = URL.createObjectURL(blob)
    try {
      const img = new Image(); img.src = url; await img.decode()
      const output = document.createElement('canvas'); output.width = 1200; output.height = 1440
      const ctx = output.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(img, 0, 0, 1200, 1440)
      const png = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Export failed')), 'image/png'))
      const download = URL.createObjectURL(png), a = document.createElement('a'); a.href = download; a.download = `豆包-我的灵感-${scene}-${palette}.png`; a.click(); window.setTimeout(() => URL.revokeObjectURL(download), 2000)
      status.textContent = '已保存你的画。把这一点灵感，带进生活里。'
    } catch { status.textContent = '暂时无法保存，请换个浏览器再试一次。' }
    finally { URL.revokeObjectURL(url) }
  })
  document.getElementById('artPrompt')!.addEventListener('click', () => {
    const place = { coast: '山海之间', city: '城市漫游', night: '星光夜话' }[scene], color = { peach: '落日桃', blue: '海盐蓝', mint: '薄荷绿' }[palette]
    scroll.scrollTo(document.getElementById('chatStage')!, { duration: .85 })
    window.setTimeout(() => (window as unknown as { __askbarFill?: (value: string, send: boolean) => void }).__askbarFill?.(`我刚做了一张「${place}」主题、${color}配色的海报。请帮我写三句适合它的短文案，再给我一个短片创意。`, false), motionPrefs.reduced ? 0 : 950)
  })
  render()
}

function initDaySky(): void {
  const section = document.getElementById('scenes')!, stage = section.querySelector('.day-stage')!
  const sky = document.createElement('div'); sky.className = 'day-sky'; sky.id = 'daySky'; sky.setAttribute('aria-hidden', 'true')
  sky.innerHTML = '<span class="day-sky__clock">08:00</span><span class="day-sky__word">慢慢醒来</span><i class="day-sky__sun"></i><i class="day-sky__stars">✧ &nbsp; · &nbsp; ✦ &nbsp; · &nbsp; ✧</i><i class="day-sky__hill day-sky__hill--back"></i><i class="day-sky__hill"></i>'
  stage.before(sky)
  const sync = (): void => {
    const part = section.dataset.day || 'morning'; sky.dataset.time = part
    sky.querySelector('.day-sky__clock')!.textContent = part === 'morning' ? '08:00' : part === 'noon' ? '13:00' : '21:00'
    sky.querySelector('.day-sky__word')!.textContent = part === 'morning' ? '慢慢醒来' : part === 'noon' ? '给想法一点光' : '把今天说给她听'
  }
  new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['data-day'] }); sync()
}
