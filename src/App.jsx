import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { subscribePending, subscribeReviewed, getPhotoDetail, signInWithGoogle, logOut, onAuthChange } from './firebase'
import * as api from './api'
import { downloadXMP } from './xmp'
import { groupIntoSessions } from './sessions'
import { toggleTheme, getTheme } from './theme'
import exifr from 'exifr'
import Analytics from './Analytics'
import './analytics.css'
import Coaching from './Coaching'
import './coaching.css'
import Upload from './Upload'
import './upload.css'
import Slideshow from './Slideshow'
import ListView from './ListView'
import PortfolioExport from './PortfolioExport'
import AdminPanel from './AdminPanel'
import './admin.css'
import SharedGalleries from './SharedGalleries'
import './shared.css'

const CAT_ICONS = {
  paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️',
  personas: '👤', comida: '🍽️', otras: '📁', todas: '✨',
}
const CATEGORIES = ['todas', 'paisajes', 'mascotas', 'arquitectura', 'personas', 'comida', 'otras']
const CONCURRENCY_LIMIT = 3
const UNDO_TIMEOUT_MS = 8000

// ==========================================
// BROWSER NOTIFICATIONS
// ==========================================
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '📸' })
  }
}

// ==========================================
// LOGIN SCREEN
// ==========================================
function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      if (e.message === 'NOT_AUTHORIZED') {
        setError('Tu cuenta no tiene acceso. Contacta al administrador.')
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">📸</div>
        <h1 className="login-title">Photo<span>Analyzer</span></h1>
        <p className="login-subtitle">Curación inteligente con IA</p>

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <><div className="spinner-ring small" /> Conectando...</>
          ) : (
            <><svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg> Iniciar sesión con Google</>
          )}
        </button>

        {error && <div className="login-error">{error}</div>}
        <p className="login-hint">Solo cuentas autorizadas</p>
      </div>
    </div>
  )
}

// ==========================================
// USER MENU
// ==========================================
function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="user-menu-wrap" ref={menuRef}>
      <button className="user-btn" onClick={() => setOpen(!open)} title={user.email}>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-initial">{user.email[0].toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            {user.photoURL && <img src={user.photoURL} alt="" className="user-dropdown-avatar" referrerPolicy="no-referrer" />}
            <div className="user-dropdown-info">
              <span className="user-dropdown-name">{user.displayName || 'Usuario'}</span>
              <span className="user-dropdown-email">{user.email}</span>
            </div>
          </div>
          <div className="user-dropdown-divider" />
          <button className="user-dropdown-btn" onClick={() => { setOpen(false); onLogout() }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// ==========================================
// HOOKS
// ==========================================
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function useIntersectionObserver(options = {}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); obs.disconnect() }
    }, { rootMargin: '200px', ...options })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, isVisible]
}

// ==========================================
// CONCURRENCY HELPER
// ==========================================
async function runWithConcurrency(tasks, limit, onTaskDone) {
  const results = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      try {
        const result = await tasks[i]()
        results[i] = { ok: true, result }
      } catch (e) {
        results[i] = { ok: false, error: e }
      }
      onTaskDone?.(i, results[i])
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ==========================================
// SKELETON CARD
// ==========================================
function SkeletonCard({ index }) {
  return (
    <div className="photo-card skeleton-card" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="card-img-wrap">
        <div className="skeleton-img shimmer" />
      </div>
      <div className="card-body">
        <div className="skeleton-line w60 shimmer" />
        <div className="skeleton-line w40 shimmer" />
        <div className="skeleton-line w80 shimmer" />
      </div>
    </div>
  )
}

// ==========================================
// LAZY IMAGE
// ==========================================
function LazyImage({ src, alt }) {
  const [ref, isVisible] = useIntersectionObserver()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retries, setRetries] = useState(0)
  const MAX_RETRIES = 3

  useEffect(() => {
    setLoaded(false)
    setError(false)
    setRetries(0)
  }, [src])

  useEffect(() => {
    if (!error || retries >= MAX_RETRIES) return
    const t = setTimeout(() => {
      setError(false)
      setRetries(r => r + 1)
    }, 3000)
    return () => clearTimeout(t)
  }, [error, retries])

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!loaded && <div className="skeleton-img shimmer" style={{ position: 'absolute', inset: 0 }} />}
      {isVisible && !error && (
        <img src={`${src}${retries ? `?r=${retries}` : ''}`} alt={alt} loading="lazy"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          style={{ opacity: loaded ? 1 : 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.3s ease', background: 'var(--surface2)' }}
        />
      )}
      {error && retries >= MAX_RETRIES && <div className="img-error"><span>📷</span><small>No se pudo cargar</small></div>}
    </div>
  )
}

// ==========================================
// SCORE BAR
// ==========================================
function ScoreBar({ score }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? 'var(--green)' : score >= 5 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ==========================================
// EXIF BADGE
// ==========================================
function ExifBadge({ exif }) {
  if (!exif) return null
  const parts = []
  if (exif.lens) parts.push(exif.lens)
  else if (exif.focal_length) parts.push(exif.focal_length)
  if (exif.aperture) parts.push(exif.aperture)
  if (exif.shutter_speed) parts.push(exif.shutter_speed)
  if (exif.iso) parts.push(`ISO ${exif.iso}`)
  if (!parts.length) return null

  return (
    <div className="exif-badge">
      <span className="exif-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93"/></svg>
      </span>
      {parts.join(' · ')}
    </div>
  )
}

// ==========================================
// EXIF DETAIL (lightbox)
// ==========================================
function ExifDetail({ exif }) {
  if (!exif || Object.keys(exif).length === 0) return null

  const rows = [
    { label: 'Cámara', value: exif.camera },
    { label: 'Lente', value: exif.lens },
    { label: 'Focal', value: exif.focal_length },
    { label: 'Apertura', value: exif.aperture },
    { label: 'Velocidad', value: exif.shutter_speed },
    { label: 'ISO', value: exif.iso },
    { label: 'Exp. comp.', value: exif.exposure_comp && exif.exposure_comp !== '0' ? `${exif.exposure_comp} EV` : null },
    { label: 'Balance', value: exif.white_balance },
    { label: 'Medición', value: exif.metering },
  ].filter(r => r.value)

  if (!rows.length) return null

  return (
    <div className="review-section exif-section">
      <h4>📷 Datos EXIF</h4>
      <div className="exif-grid">
        {rows.map(({ label, value }) => (
          <div key={label} className="exif-row">
            <span className="exif-label">{label}</span>
            <span className="exif-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==========================================
// APP
// ==========================================
export default function App() {
  const [user, setUser] = useState(undefined)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  if (authLoading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">📸</div>
          <div className="spinner-ring" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return <Gallery user={user} />
}

// ==========================================
// GALLERY (main app content)
// ==========================================
function Gallery({ user }) {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState({})
  const [processing, setProcessing] = useState({})
  const [removing, setRemoving] = useState({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [lightboxDetail, setLightboxDetail] = useState(null)
  const [pendingExif, setPendingExif] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState({ msg: '', visible: false, err: false, action: null })
  const [connected, setConnected] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [comparison, setComparison] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const [theme, setTheme] = useState(getTheme)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) return
    api.fetchCurrentUser()
      .then(data => setIsAdmin(data.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [user])

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const undoTimerRef = useRef(null)
  const debouncedSearch = useDebounce(search, 250)
  const selectedCount = Object.keys(selected).length
  const removingCount = Object.keys(removing).length

  // ===== TOAST =====
  const showToast = useCallback((msg, err = false, action = null) => {
    setToast({ msg, visible: true, err, action })
    if (!action) {
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000)
    }
  }, [])

  const dismissToast = useCallback(() => {
    setToast(t => ({ ...t, visible: false, action: null }))
  }, [])

  // ===== FIRESTORE REAL-TIME =====
  useEffect(() => {
    let pendingLoaded = false
    let reviewedLoaded = false

    const markLoaded = () => {
      if (pendingLoaded && reviewedLoaded) {
        setLoading(false)
        setConnected(true)
      }
    }

    const cleanRemoving = (photos) => {
      setRemoving(prev => {
        const next = { ...prev }
        const currentIds = new Set(photos.map(p => p.filename))
        let changed = false
        for (const fn of Object.keys(next)) {
          if (!currentIds.has(fn)) {
            delete next[fn]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }

    const unsubPending = subscribePending(user.email, (photos) => {
      setPending(photos)
      pendingLoaded = true
      markLoaded()
      cleanRemoving(photos)
    })

    const unsubReviewed = subscribeReviewed(user.email, (photos) => {
      setReviewed(photos)
      reviewedLoaded = true
      markLoaded()
      cleanRemoving(photos)
    })

    const timeout = setTimeout(() => {
      if (!pendingLoaded || !reviewedLoaded) {
        setLoading(false)
        showToast('Conexión lenta con Firestore...', true)
      }
    }, 10000)

    return () => {
      unsubPending()
      unsubReviewed()
      clearTimeout(timeout)
    }
  }, [showToast, user.email])

  // ===== SELECTION =====
  function toggleSelect(fn) {
    if (processing[fn] || removing[fn]) return
    setSelected(prev => {
      const next = { ...prev }
      if (next[fn]) delete next[fn]; else next[fn] = true
      return next
    })
  }

  function selectAll() {
    const items = tab === 'pending' ? pending : filteredReviewed
    const next = {}
    items.forEach(p => { if (!processing[p.filename] && !removing[p.filename]) next[p.filename] = true })
    setSelected(next)
  }

  function clearSelection() { setSelected({}) }

  // ===== FILTER & SORT =====
  const filteredReviewed = useMemo(() => {
    let items = [...reviewed]

    if (category !== 'todas') items = items.filter(r => r.category === category)

    if (minScore > 0) items = items.filter(r => (r.score || 0) >= minScore)

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      items = items.filter(r =>
        r.filename.toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.resumen || '').toLowerCase().includes(q)
      )
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      items = items.filter(r => {
        if (!r.uploadedAt) return false
        return new Date(r.uploadedAt) >= from
      })
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59')
      items = items.filter(r => {
        if (!r.uploadedAt) return false
        return new Date(r.uploadedAt) <= to
      })
    }

    return items
  }, [reviewed, category, debouncedSearch, dateFrom, dateTo, minScore])

  // Session grouping
  const pendingSessions = useMemo(() => groupIntoSessions(pending), [pending])
  const reviewedSessions = useMemo(() => groupIntoSessions(filteredReviewed, { sortByScore: true }), [filteredReviewed])

  // Best Of photos for slideshow
  const bestOfPhotos = useMemo(() => reviewed.filter(r => r.bestOf), [reviewed])

  // ===== LIGHTBOX =====
  // Close lightbox on browser back button (mobile UX)
  const lightboxPushedRef = useRef(false)
  useEffect(() => {
    function onPopState() {
      if (lightboxPushedRef.current) {
        lightboxPushedRef.current = false
        setLightbox(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function closeLightbox() {
    if (lightboxPushedRef.current) {
      lightboxPushedRef.current = false
      window.history.back()  // triggers popstate → setLightbox(null)
    } else {
      setLightbox(null)
    }
  }

  async function openLightbox(photo) {
    lightboxPushedRef.current = true
    window.history.pushState({ lightbox: true }, '')
    setLightbox({ photo })
    setLightboxDetail(null)
    setPendingExif(null)

    if (photo.score) {
      setDetailLoading(true)
      try {
        const detail = await getPhotoDetail(photo.docId || photo.filename)
        setLightboxDetail(detail)
      } catch (e) {
        console.log('Detail load failed:', e)
      } finally {
        setDetailLoading(false)
      }
    } else if (photo.originalUrl) {
      try {
        const raw = await exifr.parse(photo.originalUrl, {
          pick: ['Make', 'Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'ExposureCompensation', 'WhiteBalance', 'MeteringMode'],
        })
        if (raw) {
          const shutter = raw.ExposureTime
            ? (raw.ExposureTime >= 1 ? `${raw.ExposureTime}s` : `1/${Math.round(1 / raw.ExposureTime)}`)
            : null
          setPendingExif({
            camera: [raw.Make, raw.Model].filter(Boolean).join(' '),
            lens: raw.LensModel || null,
            focal_length: raw.FocalLength ? `${raw.FocalLength}mm` : null,
            aperture: raw.FNumber ? `f/${raw.FNumber}` : null,
            shutter_speed: shutter,
            iso: raw.ISO ? String(raw.ISO) : null,
            exposure_comp: raw.ExposureCompensation ? String(raw.ExposureCompensation) : null,
            white_balance: raw.WhiteBalance || null,
            metering: raw.MeteringMode || null,
          })
        }
      } catch (e) {
        console.log('EXIF extraction failed:', e)
      }
    }

    const items = tab === 'pending' ? pending : filteredReviewed
    const idx = items.findIndex(p => p.filename === photo.filename)
    ;[-1, 1].forEach(dir => {
      const ni = idx + dir
      if (ni >= 0 && ni < items.length) {
        const img = new Image()
        img.src = api.getHighResUrl(items[ni])
      }
    })
  }

  function navigateLightbox(dir) {
    if (!lightbox) return
    const items = tab === 'pending' ? pending : filteredReviewed
    const idx = items.findIndex(p => p.filename === lightbox.photo.filename)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= items.length) return
    openLightbox(items[newIdx])
  }

  // ===== TOUCH SWIPE =====
  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY }
  function handleTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) navigateLightbox(dx > 0 ? -1 : 1)
  }

  // ===== ACTIONS =====
  function handleAnalyze() {
    const fns = Object.keys(selected).filter(f => !processing[f])
    if (!fns.length) return
    setModal({
      icon: '🤖', title: 'Analizar con IA',
      message: `${fns.length} foto(s) serán analizadas (${Math.min(CONCURRENCY_LIMIT, fns.length)} en paralelo).`,
      confirmLabel: 'Analizar', variant: 'primary',
      onConfirm: () => {
        setModal(null)
        setSelected({})
        requestNotificationPermission()
        const newProc = {}
        fns.forEach(f => newProc[f] = true)
        setProcessing(prev => ({ ...prev, ...newProc }))
        showToast(`🤖 Analizando ${fns.length} foto(s)...`)
        startBackgroundReview(fns)
      }
    })
  }

  async function startBackgroundReview(filenames) {
    const tasks = filenames.map(fn => () => api.reviewPhoto(fn))

    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT, (i, result) => {
      const fn = filenames[i]
      setProcessing(prev => { const n = { ...prev }; delete n[fn]; return n })
      if (!result.ok) {
        showToast(`Error en ${fn}`, true)
      }
    })

    const ok = results.filter(r => r.ok).length
    const errors = results.filter(r => !r.ok).length
    let msg = `${ok} foto(s) analizadas`
    if (errors) msg += ` · ${errors} error(es)`
    showToast(msg, errors > 0)
    sendNotification('Análisis completado', msg)
  }

  function handleDiscard() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '🗑️', title: 'Descartar fotos',
      message: `${fns.length} foto(s) se marcarán como descartadas.`,
      confirmLabel: 'Descartar', variant: 'warn',
      onConfirm: () => {
        setModal(null)
        const newRemoving = {}
        fns.forEach(f => newRemoving[f] = 'discard')
        setRemoving(prev => ({ ...prev, ...newRemoving }))
        setSelected({})

        // Start undo timer
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        const timer = setTimeout(() => executeDiscard(fns), UNDO_TIMEOUT_MS)
        undoTimerRef.current = timer

        showToast(`🗑️ Descartando ${fns.length} foto(s)...`, false, {
          label: 'Deshacer',
          onClick: () => {
            clearTimeout(timer)
            undoTimerRef.current = null
            // Revert removing state
            setRemoving(prev => {
              const next = { ...prev }
              fns.forEach(f => delete next[f])
              return next
            })
            dismissToast()
            showToast('Descarte cancelado')
          }
        })
      }
    })
  }

  async function executeDiscard(fns) {
    undoTimerRef.current = null
    dismissToast()
    try {
      const result = await api.discardPhotos(fns)
      const errCount = result.errors || 0
      if (errCount > 0) {
        showToast(`🗑️ ${result.discarded} descartadas · ${errCount} error(es)`, true)
        setRemoving(prev => {
          const next = { ...prev }
          fns.forEach(f => delete next[f])
          return next
        })
      } else {
        showToast(`🗑️ ${result.discarded} foto(s) descartadas`)
      }
    } catch (e) {
      showToast('Error: ' + e.message, true)
      setRemoving(prev => {
        const next = { ...prev }
        fns.forEach(f => delete next[f])
        return next
      })
    }
  }

  function handleDelete() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '💀', title: 'Eliminar permanentemente',
      message: `${fns.length} foto(s) serán ELIMINADAS permanentemente.\n\nSe borrarán de GCS y Firestore.\n\nEsta acción NO se puede deshacer.`,
      confirmLabel: `Eliminar ${fns.length} foto(s)`, variant: 'danger',
      onConfirm: async () => {
        setModal(null)
        const newRemoving = {}
        fns.forEach(f => newRemoving[f] = 'delete')
        setRemoving(prev => ({ ...prev, ...newRemoving }))
        setSelected({})
        showToast(`💀 Eliminando ${fns.length} foto(s)...`)
        try {
          const result = await api.deletePhotos(fns)
          showToast(`💀 ${result.deleted} foto(s) eliminadas permanentemente`)
        } catch (e) {
          showToast('Error: ' + e.message, true)
          setRemoving(prev => {
            const next = { ...prev }
            fns.forEach(f => delete next[f])
            return next
          })
        }
      }
    })
  }

  // ===== LOGOUT =====
  async function handleLogout() {
    try {
      await logOut()
    } catch (e) {
      showToast('Error al cerrar sesión', true)
    }
  }

  // ===== COMPARE =====
  async function handleCompare() {
    const fns = Object.keys(selected)
    if (fns.length !== 2) return
    const allPhotos = [...pending, ...reviewed]
    const left = allPhotos.find(p => p.filename === fns[0])
    const right = allPhotos.find(p => p.filename === fns[1])
    if (!left || !right) return

    setComparison({ left, right, leftDetail: null, rightDetail: null })
    setSelected({})

    try {
      const [ld, rd] = await Promise.all([
        left.score ? getPhotoDetail(left.docId || left.filename) : null,
        right.score ? getPhotoDetail(right.docId || right.filename) : null,
      ])
      setComparison(prev => prev ? { ...prev, leftDetail: ld, rightDetail: rd } : null)
    } catch (e) {
      console.log('Compare detail load failed:', e)
    }
  }

  // ===== BULK DOWNLOAD =====
  async function handleBulkDownload() {
    const fns = Object.keys(selected)
    if (!fns.length || downloading) return

    setDownloading(true)
    showToast(`📦 Descargando ${fns.length} foto(s)...`)

    try {
      const JSZip = (await import('jszip')).default
      const { saveAs } = await import('file-saver')
      const zip = new JSZip()
      let done = 0

      const allPhotos = [...pending, ...reviewed]
      for (const fn of fns) {
        const photo = allPhotos.find(p => p.filename === fn)
        if (!photo?.originalUrl) continue
        try {
          const resp = await fetch(photo.originalUrl)
          if (resp.ok) {
            const blob = await resp.blob()
            zip.file(fn, blob)
            done++
            showToast(`📦 Descargando... ${done}/${fns.length}`)
          }
        } catch (e) {
          console.warn(`Download failed for ${fn}:`, e)
        }
      }

      if (done > 0) {
        const content = await zip.generateAsync({ type: 'blob' })
        saveAs(content, `photos-${new Date().toISOString().slice(0, 10)}.zip`)
        showToast(`📦 ${done} foto(s) descargadas`)
      } else {
        showToast('No se pudieron descargar las fotos', true)
      }
    } catch (e) {
      showToast('Error al crear ZIP: ' + e.message, true)
    } finally {
      setDownloading(false)
    }
  }

  // ===== KEYBOARD =====
  const currentItems = useMemo(() =>
    tab === 'pending' ? pending : tab === 'reviewed' ? filteredReviewed : [],
    [tab, pending, filteredReviewed]
  )

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Escape') {
        if (comparison) { setComparison(null); return }
        if (lightbox) { closeLightbox(); return }
        if (modal) { setModal(null); return }
        if (selectedCount > 0) { clearSelection(); return }
      }

      if (lightbox) {
        if (e.key === 'ArrowLeft') navigateLightbox(-1)
        if (e.key === 'ArrowRight') navigateLightbox(1)
        return
      }

      if (comparison) return

      if (!modal) {
        // Tab switching
        if (e.key === '1') { setTab('pending'); clearSelection(); setFocusedIndex(-1) }
        if (e.key === '2') { setTab('reviewed'); clearSelection(); setFocusedIndex(-1) }
        if (e.key === '3') { setTab('analytics'); clearSelection(); setFocusedIndex(-1) }
        if (e.key === '4') { setTab('shared'); clearSelection(); setFocusedIndex(-1) }
        if (e.key === '5' && isAdmin) { setTab('admin'); clearSelection(); setFocusedIndex(-1) }

        // Grid navigation
        if (tab !== 'analytics' && currentItems.length > 0) {
          if (e.key === 'j' || e.key === 'J') {
            e.preventDefault()
            setFocusedIndex(prev => {
              const next = Math.min(prev + 1, currentItems.length - 1)
              document.querySelector(`.photo-card:nth-child(${next + 1})`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              return next
            })
          }
          if (e.key === 'k' || e.key === 'K') {
            e.preventDefault()
            setFocusedIndex(prev => {
              const next = Math.max(prev - 1, 0)
              document.querySelector(`.photo-card:nth-child(${next + 1})`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              return next
            })
          }
          if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < currentItems.length) {
            e.preventDefault()
            toggleSelect(currentItems[focusedIndex].filename)
          }
          if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < currentItems.length) {
            e.preventDefault()
            openLightbox(currentItems[focusedIndex])
          }
        }

        // Actions
        if (e.key === 'a' || e.key === 'A') {
          if (tab === 'pending' && selectedCount > 0) handleAnalyze()
        }
        if (e.key === 'd' || e.key === 'D') {
          if (selectedCount > 0) handleDiscard()
        }
        if (e.key === 'c' || e.key === 'C') {
          if (selectedCount === 2) handleCompare()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Reset focused index on tab change
  useEffect(() => { setFocusedIndex(-1) }, [tab])

  // ===== COMPUTED =====
  const avg = reviewed.length > 0
    ? (reviewed.reduce((s, r) => s + (r.score || 0), 0) / reviewed.length).toFixed(1)
    : '—'
  const bestCount = reviewed.filter(r => r.bestOf).length

  const hasDateFilter = dateFrom || dateTo
  function clearDateFilter() { setDateFrom(''); setDateTo('') }

  // ===== RENDER =====
  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-top">
          <div className="logo">
            <div className="logo-icon">📸</div>
            <div>
              <h1>Photo<span>Analyzer</span></h1>
              <div className="header-sub">Curación inteligente con IA</div>
            </div>
          </div>
          <div className="header-right">
            <div className={`status-dot ${connected ? 'connected' : ''}`} title={connected ? 'Conectado a Firestore' : 'Conectando...'} />
            {bestOfPhotos.length > 0 && (
              <button className="slideshow-trigger-btn" onClick={() => setSlideshowOpen(true)}>
                &#9654; Best Of ({bestOfPhotos.length})
              </button>
            )}
            <button
              className="theme-toggle-btn"
              onClick={() => { const t = toggleTheme(); setTheme(t) }}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </button>
            <div className="camera-badge">◉ Sony A7V</div>
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card clickable" onClick={() => { setTab('pending'); clearSelection() }}>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{pending.length}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card clickable" onClick={() => { setTab('reviewed'); clearSelection() }}>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{reviewed.length}</div>
          <div className="stat-label">Revisadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avg}</div>
          <div className="stat-label">Score promedio</div>
          {avg !== '—' && <ScoreBar score={parseFloat(avg)} />}
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{bestCount}</div>
          <div className="stat-label">Best of</div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs-wrap">
        <div className="tabs">
          <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => { setTab('pending'); clearSelection() }}>
            📥 Pendientes <span className="count">{pending.length}</span>
          </button>
          <button className={`tab ${tab === 'reviewed' ? 'active' : ''}`} onClick={() => { setTab('reviewed'); clearSelection() }}>
            ✅ Revisadas <span className="count">{reviewed.length}</span>
          </button>
          <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => { setTab('analytics'); clearSelection() }}>
            📊 Analytics
          </button>
          <button className={`tab ${tab === 'shared' ? 'active' : ''}`} onClick={() => { setTab('shared'); clearSelection() }}>
            🤝 Compartidas
          </button>
          {isAdmin && (
            <button className={`tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); clearSelection() }}>
              ⚙️ Admin
            </button>
          )}
        </div>
        <div className="kbd-hints">
          <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>{isAdmin && <kbd>5</kbd>} tabs · <kbd>J</kbd><kbd>K</kbd> navegar · <kbd>Space</kbd> seleccionar · <kbd>Enter</kbd> ver · <kbd>Esc</kbd> cerrar
        </div>
      </div>

      {/* CONTROLS */}
      <div className="controls">
        {tab === 'pending' && (
          <div className="select-actions">
            <button className="small-btn" onClick={selectAll}>Seleccionar todas</button>
            <button className="small-btn" onClick={clearSelection}>Deseleccionar</button>
          </div>
        )}
        {tab === 'reviewed' && (
          <>
            <div className="search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="search-input" placeholder="Buscar por tags, categoría, nombre..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
            <div className="filter-pills">
              {CATEGORIES.map(c => (
                <button key={c} className={`pill ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                  {CAT_ICONS[c]} {c}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <div className="filter-pills">
                {[7, 8, 9].map(s => (
                  <button key={s} className={`score-chip ${minScore === s ? 'active' : ''}`}
                    onClick={() => setMinScore(prev => prev === s ? 0 : s)}>{s}+</button>
                ))}
              </div>
              <div className="select-actions">
                <PortfolioExport photos={bestOfPhotos} showToast={showToast} />
                <button className="view-toggle-btn" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                  title={viewMode === 'grid' ? 'Vista lista' : 'Vista grilla'}>
                  {viewMode === 'grid' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  )}
                </button>
                <button className="small-btn" onClick={selectAll}>Seleccionar todas</button>
                {selectedCount > 0 && <button className="small-btn" onClick={clearSelection}>× Deseleccionar</button>}
              </div>
            </div>
            <div className="date-filter-row">
              <label className="date-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input type="date" className="date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </label>
              <span className="date-sep">—</span>
              <label className="date-label">
                <input type="date" className="date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </label>
              {hasDateFilter && (
                <button className="small-btn date-clear" onClick={clearDateFilter}>✕ Limpiar fechas</button>
              )}
            </div>
            {debouncedSearch && (
              <div className="search-results-count">
                {filteredReviewed.length} resultado{filteredReviewed.length !== 1 ? 's' : ''} para "{debouncedSearch}"
              </div>
            )}
          </>
        )}
      </div>

      {/* GRID */}
      {tab === 'pending' && <Upload showToast={showToast} />}

      {/* Pending tab - session grouped grid */}
      {tab === 'pending' && (
        <div className="grid">
          {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`skel-${i}`} index={i} />)}

          {!loading && pendingSessions.map((session, si) => {
            let cardIndex = 0
            return [
              pendingSessions.length > 1 && (
                <div className="session-header" key={`sh-${si}`}>
                  <span className="session-date">{session.date}</span>
                  <span className="session-meta">{session.photos.length} fotos</span>
                  <div className="session-divider" />
                </div>
              ),
              ...session.photos.map(p => {
                const idx = cardIndex++
                return (
                  <PhotoCard key={p.filename} photo={p} index={si * 100 + idx} tab="pending"
                    isSelected={!!selected[p.filename]} isProcessing={!!processing[p.filename]}
                    isFocused={focusedIndex === pending.indexOf(p)}
                    removingType={removing[p.filename] || null}
                    onToggle={toggleSelect} onView={openLightbox} onTagClick={setSearch} />
                )
              })
            ]
          })}

          {!loading && pending.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✨</div>
              <p>No hay fotos pendientes</p>
              <p className="empty-sub">Las fotos aparecerán automáticamente cuando lleguen al bucket</p>
            </div>
          )}
        </div>
      )}

      {/* Reviewed tab - grid or list with sessions */}
      {tab === 'reviewed' && !loading && viewMode === 'list' && (
        <ListView
          photos={filteredReviewed}
          selected={selected}
          onToggle={toggleSelect}
          onView={openLightbox}
        />
      )}

      {tab === 'reviewed' && viewMode === 'grid' && (
        <div className="grid">
          {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`skel-${i}`} index={i} />)}

          {!loading && reviewedSessions.map((session, si) => {
            let cardIndex = 0
            return [
              reviewedSessions.length > 1 && (
                <div className="session-header" key={`rsh-${si}`}>
                  <span className="session-date">{session.date}</span>
                  <span className="session-meta">
                    {session.photos.length} fotos{session.avgScore > 0 ? ` · avg ${session.avgScore}` : ''}
                  </span>
                  <div className="session-divider" />
                </div>
              ),
              ...session.photos.map(p => {
                const idx = cardIndex++
                return (
                  <PhotoCard key={p.filename} photo={p} index={si * 100 + idx} tab="reviewed"
                    isSelected={!!selected[p.filename]} isProcessing={false}
                    isFocused={focusedIndex === filteredReviewed.indexOf(p)}
                    removingType={removing[p.filename] || null}
                    onToggle={toggleSelect} onView={openLightbox}
                    onTagClick={tag => { setSearch(tag); setTab('reviewed') }} />
                )
              })
            ]
          })}

          {!loading && filteredReviewed.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📷</div>
              <p>No se encontraron fotos revisadas</p>
              {debouncedSearch ? (
                <p className="empty-sub">Prueba con otros términos de búsqueda</p>
              ) : (
                <p className="empty-sub">Analiza fotos pendientes con 🤖 para verlas aquí</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <>
          <Analytics reviewed={reviewed} />
          <Coaching userUid={user.uid} />
        </>
      )}

      {/* SHARED */}
      {tab === 'shared' && (
        <SharedGalleries user={user} />
      )}

      {/* ADMIN */}
      {tab === 'admin' && isAdmin && (
        <AdminPanel currentUserEmail={user.email} />
      )}

      {/* TOOLBAR */}
      <div className={`toolbar ${selectedCount > 0 || removingCount > 0 ? 'visible' : ''}`}>
        {removingCount > 0 ? (
          <span className="toolbar-count removing-indicator">
            <div className="spinner-ring small" />
            Procesando {removingCount} foto(s)...
          </span>
        ) : (
          <span className="toolbar-count">{selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>
        )}
        <div className="toolbar-btns">
          {removingCount === 0 && <>
            <button className="toolbar-btn cancel" onClick={clearSelection}>Cancelar</button>
            {selectedCount === 2 && (
              <button className="toolbar-btn secondary" onClick={handleCompare}>🔍 Comparar</button>
            )}
            <button className="toolbar-btn secondary" onClick={handleBulkDownload} disabled={downloading}>
              {downloading ? '⏳ Descargando...' : '📦 Descargar'}
            </button>
            <button className="toolbar-btn warn" onClick={handleDiscard}>🗑️ Descartar</button>
            {tab === 'reviewed' && (
              <button className="toolbar-btn danger" onClick={handleDelete}>💀 Eliminar</button>
            )}
            {tab === 'pending' && (
              <button className="toolbar-btn primary" onClick={handleAnalyze}>🤖 Analizar con IA</button>
            )}
          </>}
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => closeLightbox()}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); navigateLightbox(-1) }}>‹</button>
          <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); navigateLightbox(1) }}>›</button>

          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => closeLightbox()}>✕</button>
            <div className="lb-layout">
              <div className="lb-image-wrap">
                <img src={api.getHighResUrl(lightbox.photo)} alt={lightbox.photo.filename} />
              </div>
              <div className="lb-detail">
                <h2 className="lb-filename">{lightbox.photo.filename}</h2>

                {lightbox.photo.score > 0 && (
                  <>
                    <div className="lb-score-row">
                      <span className={`score-pill big ${lightbox.photo.score >= 7 ? 'high' : lightbox.photo.score >= 5 ? 'mid' : 'low'}`}>
                        {lightbox.photo.score.toFixed(1)}/10
                      </span>
                      <span className="cat-pill">{CAT_ICONS[lightbox.photo.category]} {lightbox.photo.category}</span>
                      {lightbox.photo.bestOf && <span className="best-pill">⭐ Best Of</span>}
                    </div>
                    <ScoreBar score={lightbox.photo.score} />
                  </>
                )}

                {lightbox.photo.resumen && <p className="lb-summary">{lightbox.photo.resumen}</p>}

                {lightbox.photo.tags && (
                  <div className="lb-tags">
                    {lightbox.photo.tags.split(',').map((t, i) => (
                      <span key={i} className="tag-pill">#{t.trim()}</span>
                    ))}
                  </div>
                )}

                {pendingExif && !lightboxDetail && (
                  <ExifDetail exif={pendingExif} />
                )}

                {detailLoading && (
                  <div className="lb-detail-loading">
                    <div className="spinner-ring small" />
                    <span>Cargando análisis completo...</span>
                  </div>
                )}

                {lightboxDetail && (
                  <div className="lb-review">
                    <ExifDetail exif={lightboxDetail.exif} />
                    {lightboxDetail.composicion && <div className="review-section"><h4>📐 Composición</h4><p>{lightboxDetail.composicion}</p></div>}
                    {lightboxDetail.exposicion && <div className="review-section"><h4>💡 Exposición</h4><p>{lightboxDetail.exposicion}</p></div>}
                    {lightboxDetail.enfoque && <div className="review-section"><h4>🎯 Enfoque</h4><p>{lightboxDetail.enfoque}</p></div>}
                    {lightboxDetail.color && <div className="review-section"><h4>🎨 Color</h4><p>{lightboxDetail.color}</p></div>}
                    {lightboxDetail.lo_mejor && <div className="review-section good"><h4>👍 Lo Mejor</h4><p>{lightboxDetail.lo_mejor}</p></div>}
                    {lightboxDetail.a_mejorar && <div className="review-section improve"><h4>🔧 A Mejorar</h4><p>{lightboxDetail.a_mejorar}</p></div>}
                    {lightboxDetail.tip && <div className="review-section tip"><h4>💡 Tip</h4><p>{lightboxDetail.tip}</p></div>}

                    {lightboxDetail.edicion_raw && (
                      <div className="review-section raw-section">
                        <h4>🎨 Edición RAW</h4>
                        <div className="raw-grid">
                          {Object.entries(lightboxDetail.edicion_raw).filter(([k]) => k !== 'notas').map(([k, v]) => (
                            <div key={k} className="raw-item">
                              <span className="raw-label">{k}</span>
                              <span className="raw-value">{v}</span>
                            </div>
                          ))}
                        </div>
                        {lightboxDetail.edicion_raw.notas && <p className="raw-notes">{lightboxDetail.edicion_raw.notas}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="lb-actions">
                  {lightbox.photo.originalUrl && (
                    <a className="dl-chip" href={lightbox.photo.originalUrl} target="_blank" rel="noreferrer">📷 JPG</a>
                  )}
                  {lightbox.photo.rawUrl && (
                    <a className="dl-chip raw-chip" href={lightbox.photo.rawUrl} target="_blank" rel="noreferrer">🎞️ RAW</a>
                  )}
                  {lightboxDetail?.edicion_raw && (
                    <button className="dl-chip xmp-chip" onClick={() => downloadXMP(lightbox.photo.filename, lightboxDetail.edicion_raw)}>🎨 XMP</button>
                  )}
                </div>

                <div className="lb-swipe-hint">← desliza para navegar →</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">{modal.icon}</div>
            <h3 className="modal-title">{modal.title}</h3>
            <p className="modal-msg" style={{ whiteSpace: 'pre-line' }}>{modal.message}</p>
            <div className="modal-btns">
              <button className="modal-btn cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className={`modal-btn ${modal.variant}`} onClick={modal.onConfirm}>{modal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON */}
      {comparison && (
        <div className="comparison-overlay" onClick={() => setComparison(null)}>
          <div className="comparison-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setComparison(null)}>✕</button>
            <div className="comparison-grid">
              <ComparisonSide photo={comparison.left} detail={comparison.leftDetail} />
              <div className="comparison-divider">
                <span className="comparison-vs">VS</span>
                {comparison.left.score > 0 && comparison.right.score > 0 && (
                  <span className="comparison-delta">
                    {(comparison.left.score - comparison.right.score) > 0 ? '+' : ''}{(comparison.left.score - comparison.right.score).toFixed(1)}
                  </span>
                )}
              </div>
              <ComparisonSide photo={comparison.right} detail={comparison.rightDetail} />
            </div>
          </div>
        </div>
      )}

      {/* SLIDESHOW */}
      {slideshowOpen && bestOfPhotos.length > 0 && (
        <Slideshow photos={bestOfPhotos} onClose={() => setSlideshowOpen(false)} />
      )}

      {/* TOAST */}
      <div className="toast-container">
        <div className={`toast ${toast.visible ? 'show' : ''} ${toast.err ? 'error' : ''}`}>
          {toast.msg}
          {toast.action && (
            <button className="toast-action" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// COMPARISON SIDE
// ==========================================
function ComparisonSide({ photo, detail }) {
  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'

  return (
    <div className="comparison-side">
      <div className="comparison-img">
        <img src={api.getHighResUrl(photo)} alt={photo.filename} />
      </div>
      <div className="comparison-info">
        <h3>{photo.filename}</h3>
        {score > 0 && (
          <div className="lb-score-row">
            <span className={`score-pill big ${scoreClass}`}>{score.toFixed(1)}/10</span>
            <span className="cat-pill">{CAT_ICONS[photo.category]} {photo.category}</span>
            {photo.bestOf && <span className="best-pill">⭐ Best Of</span>}
          </div>
        )}
        {photo.resumen && <p className="lb-summary">{photo.resumen}</p>}
        {detail && (
          <>
            <ExifDetail exif={detail.exif} />
            {detail.lo_mejor && <div className="review-section good"><h4>👍 Lo Mejor</h4><p>{detail.lo_mejor}</p></div>}
            {detail.a_mejorar && <div className="review-section improve"><h4>🔧 A Mejorar</h4><p>{detail.a_mejorar}</p></div>}
          </>
        )}
      </div>
    </div>
  )
}

// ==========================================
// PHOTO CARD
// ==========================================
function PhotoCard({ photo, index, tab, isSelected, isProcessing, isFocused, removingType, onToggle, onView, onTagClick }) {
  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'
  const thumbUrl = api.getThumbUrl(photo)
  const isRemoving = !!removingType

  const removingLabel = removingType === 'delete' ? 'Eliminando...' : 'Descartando...'
  const removingIcon = removingType === 'delete' ? '💀' : '🗑️'

  return (
    <div
      className={`photo-card ${isSelected ? 'selected' : ''} ${isProcessing ? 'processing' : ''} ${isRemoving ? 'removing' : ''} ${isFocused ? 'focused' : ''}`}
      style={{ animationDelay: `${Math.min(index, 15) * 0.03}s` }}
      onClick={e => {
        if (e.target.closest('.dl-actions') || e.target.closest('.tag-pill') || e.target.closest('.check')) return
        if (isProcessing || isRemoving) return
        onView(photo)
      }}
    >
      <div className={`check ${isSelected ? 'checked' : ''}`}
        onClick={e => { e.stopPropagation(); if (!isProcessing && !isRemoving) onToggle(photo.filename) }}
      >
        {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>

      {tab === 'pending' && !isProcessing && !isRemoving && <div className="badge pending-badge">PENDIENTE</div>}
      {isProcessing && (
        <div className="proc-overlay">
          <div className="spinner-ring" />
          <span className="proc-label">Analizando...</span>
        </div>
      )}
      {isRemoving && (
        <div className="removing-overlay">
          <div className="removing-icon-pulse">{removingIcon}</div>
          <span className="removing-label">{removingLabel}</span>
          <div className="removing-progress" />
        </div>
      )}
      {photo.bestOf && !isRemoving && <div className="badge best-badge">⭐ BEST OF</div>}

      <div className="card-img-wrap">
        <LazyImage src={thumbUrl} alt={photo.filename} />
        <div className="img-overlay" />
      </div>

      <div className="card-body">
        <div className="card-header">
          <h3 className="card-title">{photo.filename}</h3>
          {tab === 'reviewed' && <span className={`score-pill card-score-prominent ${scoreClass}`}>{score.toFixed(1)}</span>}
        </div>

        {tab === 'reviewed' && <>
          <ScoreBar score={score} />
          <div className="card-meta">
            <span className="cat-pill">{CAT_ICONS[photo.category] || '📁'} {photo.category}</span>
            <ExifBadge exif={photo.exif} />
          </div>
          {photo.tags && (
            <div className="tags-wrap">
              {photo.tags.split(',').slice(0, 4).map((t, i) => (
                <span key={i} className="tag-pill" onClick={e => { e.stopPropagation(); onTagClick(t.trim()) }}>#{t.trim()}</span>
              ))}
              {photo.tags.split(',').length > 4 && <span className="tag-pill tag-more">+{photo.tags.split(',').length - 4}</span>}
            </div>
          )}
          <p className="card-summary">{photo.resumen}</p>
        </>}

        <div className="card-footer">
          <div className="dl-actions">
            {photo.originalUrl && (
              <a className="dl-chip" href={photo.originalUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>📷 JPG</a>
            )}
            {photo.rawUrl && (
              <a className="dl-chip raw-chip" href={photo.rawUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>🎞️ RAW</a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
