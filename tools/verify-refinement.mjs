import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] || 'http://127.0.0.1:4173'
const out = fileURLToPath(new URL('../.preview-out/refinement/', import.meta.url))
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__DOUBAO?.state().ready)
  await page.locator('#motionToggle').click()
  await page.screenshot({ path: out + '01-desktop-hero.png' })
  const portrait = await page.evaluate(() => ({
    character: window.__DOUBAO.character,
    face: window.__DOUBAO.faceLayer.visible,
    paused: document.getElementById('faceSrc').paused,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }))
  assert.equal(portrait.character, null, 'Old character must not overlap the video')
  assert.equal(portrait.face, true)
  assert.equal(portrait.paused, true)
  assert.equal(portrait.horizontalOverflow, false)
  results.push('Desktop: one portrait, motion toggle, no overflow')
  await page.locator('#motionToggle').click()
  const cheek = await page.evaluate(() => {
    for (let y = 220; y < 600; y += 10) for (let x = 760; x < 1250; x += 10) {
      if (window.__DOUBAO.faceLayer.isOnFace(x, y)) return { x, y }
    }
  })
  assert.ok(cheek, 'A cheek should be hittable')
  await page.mouse.move(cheek.x, cheek.y)
  await page.mouse.down()
  await page.mouse.move(cheek.x + 30, cheek.y + 10, { steps: 8 })
  await page.waitForTimeout(250)
  assert.ok(await page.evaluate(() => window.__DOUBAO.faceLayer.pinchStrength > .1))
  await page.screenshot({ path: out + '02-cheek-drag.png' })
  await page.mouse.up()
  await page.waitForTimeout(700)
  assert.ok(await page.evaluate(() => Math.abs(window.__DOUBAO.faceLayer.pinchStrength) < .03))
  results.push('Cheek drag: deformation and spring release')

  await page.locator('#heroEnter').click()
  await page.waitForTimeout(1200)
  const chat = await page.evaluate(() => {
    const r = document.getElementById('heroAsk').getBoundingClientRect()
    return { center: r.x + r.width / 2, width: r.width, face: window.__DOUBAO.faceLayer.visible, paused: document.getElementById('faceSrc').paused }
  })
  assert.ok(Math.abs(chat.center - 720) < 3, 'Chat must be centered')
  assert.ok(chat.width >= 800, `Desktop chat should have a comfortable width: ${JSON.stringify(chat)}`)
  assert.equal(chat.face, false, 'Portrait must fully leave the chat stage')
  assert.equal(chat.paused, true, 'Offscreen decoding should stop')
  await page.screenshot({ path: out + '03-desktop-chat.png' })
  const input = page.locator('#askInput')
  await input.fill('中文输入测试')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  assert.equal(await page.locator('.ask-bubble--user').count(), 0)
  await input.fill('帮我安排一下今天')
  await input.press('Enter')
  await page.getByRole('button', { name: '停止回复', exact: true }).waitFor()
  await page.getByRole('button', { name: '停止回复', exact: true }).click()
  const stoppedCount = await page.locator('.ask-bubble').count()
  await page.waitForTimeout(650)
  assert.equal(await page.locator('.ask-bubble').count(), stoppedCount, 'Stopped generation must not append a stale response')
  await page.locator('#chatReset').click()
  assert.equal(await page.locator('.ask-bubble').count(), 1)
  await input.fill('帮我写周报')
  await input.press('Enter')
  await page.getByRole('button', { name: '发送', exact: true }).waitFor({ timeout: 12000 })
  assert.ok((await page.locator('.ask-bubble--ai').last().innerText()).length > 35)
  await page.screenshot({ path: out + '04-chat-response.png' })
  results.push('Chat: IME Enter, stop, reset, complete local response')

  await page.locator('#capabilities').scrollIntoViewIfNeeded()
  await page.locator('[data-wb="write"]').click()
  await page.locator('[data-write-op="short"]').click()
  assert.ok((await page.locator('[data-write-draft]').innerText()).length < 45)
  await page.waitForTimeout(600)
  await page.screenshot({ path: out + '05-workbench.png' })
  await page.locator('#scenes').scrollIntoViewIfNeeded()
  await page.locator('[data-day="evening"]').click()
  assert.ok((await page.locator('[data-day-title]').innerText()).includes('琐碎'))
  await page.waitForTimeout(750)
  await page.screenshot({ path: out + '06-scenes.png' })
  results.push('Workbench and daily scene tabs work')
  assert.deepEqual(errors, [])

  for (const width of [390, 768]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, isMobile: width < 600 })
    await mobile.goto(base, { waitUntil: 'networkidle' })
    await mobile.waitForFunction(() => window.__DOUBAO?.state().ready)
    await mobile.locator('#motionToggle').click()
    await mobile.screenshot({ path: out + `07-${width}-hero.png` })
    assert.equal(await mobile.evaluate(width => document.documentElement.scrollWidth > width, width), false)
    await mobile.locator('#heroEnter').click()
    await mobile.waitForTimeout(1400)
    assert.ok(await mobile.evaluate(() => document.getElementById('chatStage').getBoundingClientRect().top < 150), 'Mobile CTA must actually reach the chat')
    assert.equal(await mobile.evaluate(() => window.__DOUBAO.faceLayer.visible), false)
    await mobile.screenshot({ path: out + `08-${width}-chat.png` })
    const bounds = await mobile.locator('#heroAsk').boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    await mobile.close()
    results.push(`${width}px: portrait and centered chat fit the viewport`)
  }
  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await reduced.goto(base, { waitUntil: 'networkidle' })
  assert.equal(await reduced.locator('#motionToggle').isDisabled(), true)
  assert.equal(await reduced.evaluate(() => document.getElementById('faceSrc').paused), true)
  results.push('Reduced motion: no autoplay or interaction warping')
  const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await fallback.route('**/*.mp4', route => route.abort())
  await fallback.goto(base, { waitUntil: 'networkidle' })
  await fallback.waitForFunction(() => document.documentElement.dataset.faceRendered === '1')
  await fallback.screenshot({ path: out + '09-video-fallback.png' })
  results.push('Video failure: static portrait fallback paints')
  await writeFile(out + 'report.json', JSON.stringify({ results, errors }, null, 2))
  console.log(JSON.stringify({ passed: results.length, results, screenshots: out }, null, 2))
} finally { await browser.close() }
