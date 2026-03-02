const STORAGE_KEY = 'photo-analyzer-theme'

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  const theme = saved || 'dark'
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

export function toggleTheme() {
  const current = getTheme()
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(STORAGE_KEY, next)
  return next
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark'
}
