/** The static portrait paints immediately. Never preload unrelated body plates
 * or hold the entire page behind a simulated progress bar. */
export function initBootVeil(): () => void {
  const veil = document.getElementById('bootVeil')
  veil?.remove()
  document.documentElement.classList.remove('booting')
  requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('doubao:veil-open')))
  return () => veil?.remove()
}
