import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { subscribePending, subscribeReviewed, getPhotoDetail, signInWithGoogle, logOut, onAuthChange } from './firebase'
import * as api from './api'
import Analytics from './Analytics'
import './analytics.css'
import Coaching from './Coaching'
import './coaching.css'
import Upload from './Upload'
import './upload.css'

const CAT_ICONS = {
  paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️',
  personas: '👤', comida: '🍽️', otras: '📁', todas: '✨',
}
const CATEGORIES = ['todas', 'paisajes', 'mascotas', 'arquitectura', 'personas', 'comida', 'otras']

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

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!loaded && <div className="skeleton-img shimmer" style={{ position: 'absolute', inset: 0 }} />}
      {isVisible && !error && (
        <img src={src} alt={alt} loading="lazy"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          style={{ opacity: loaded ? 1 : 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.3s ease', background: 'var(--surface2)' }}
        />
      )}
      {error && <div className="img-error"><span>📷</span><small>No se pudo cargar</small></div>}
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
  // removing: { filename: 'discard' | 'delete' }
  const [removing, setRemoving] = useState({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [sortBy, setSortBy] = useState('newest')
  const [lightbox, setLightbox] = useState(null)
  const [lightboxDetail, setLightboxDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState({ msg: '', visible: false, err: false })
  const [connected, setConnected] = useState(false)

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const debouncedSearch = useDebounce(search, 250)
  const selectedCount = Object.keys(selected).length
  const removingCount = Object.keys(removing).length

  // ===== TOAST =====
  const showToast = useCallback((msg, err = false) => {
    setToast({ msg, visible: true, err })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000)
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

    const unsubPending = subscribePending((photos) => {
      setPending(photos)
      pendingLoaded = true
      markLoaded()
      // Clean removing state for photos that disappeared from Firestore
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
    })

    const unsubReviewed = subscribeReviewed((photos) => {
      setReviewed(photos)
      reviewedLoaded = true
      markLoaded()
      // Clean removing state for photos that disappeared
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
  }, [showToast])

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
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      items = items.filter(r =>
        r.filename.toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.resumen || '').toLowerCase().includes(q)
      )
    }
    if (sortBy === 'best') items.sort((a, b) => (b.score || 0) - (a.score || 0))
    else if (sortBy === 'worst') items.sort((a, b) => (a.score || 0) - (b.score || 0))
    else if (sortBy === 'oldest') items.sort((a, b) => a.filename.localeCompare(b.filename))
    else items.sort((a, b) => b.filename.localeCompare(a.filename))
    return items
  }, [reviewed, category, debouncedSearch, sortBy])

  // ===== LIGHTBOX =====
  async function openLightbox(photo) {
    setLightbox({ photo })
    setLightboxDetail(null)

    if (photo.score) {
      setDetailLoading(true)
      try {
        const detail = await getPhotoDetail(photo.filename)
        setLightboxDetail(detail)
      } catch (e) {
        console.log('Detail load failed:', e)
      } finally {
        setDetailLoading(false)
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
      message: `${fns.length} foto(s) serán analizadas en segundo plano.`,
      confirmLabel: 'Analizar', variant: 'primary',
      onConfirm: () => {
        setModal(null)
        setSelected({})
        const newProc = {}
        fns.forEach(f => newProc[f] = true)
        setProcessing(prev => ({ ...prev, ...newProc }))
        showToast(`🤖 Analizando ${fns.length} foto(s)...`)
        startBackgroundReview(fns)
      }
    })
  }

  async function startBackgroundReview(filenames) {
    let ok = 0, errors = 0
    for (const fn of filenames) {
      try {
        await api.reviewPhoto(fn)
        ok++
      } catch (e) {
        errors++
        showToast(`⚠️ Error en ${fn}`, true)
      }
      setProcessing(prev => { const n = { ...prev }; delete n[fn]; return n })
    }
    let msg = `✅ ${ok} foto(s) analizadas`
    if (errors) msg += ` · ⚠️ ${errors} error(es)`
    showToast(msg)
  }

  function handleDiscard() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '🗑️', title: 'Descartar fotos',
      message: `${fns.length} foto(s) se marcarán como descartadas.`,
      confirmLabel: 'Descartar', variant: 'warn',
      onConfirm: async () => {
        setModal(null)
        // Mark cards as removing BEFORE clearing selection
        const newRemoving = {}
        fns.forEach(f => newRemoving[f] = 'discard')
        setRemoving(prev => ({ ...prev, ...newRemoving }))
        setSelected({})
        showToast(`🗑️ Descartando ${fns.length} foto(s)...`)
        try {
          const result = await api.discardPhotos(fns)
          const errCount = result.errors || 0
          if (errCount > 0) {
            showToast(`🗑️ ${result.discarded} descartadas · ⚠️ ${errCount} error(es)`, true)
            // Clean removing state for errored ones
            setRemoving(prev => {
              const next = { ...prev }
              fns.forEach(f => delete next[f])
              return next
            })
          } else {
            showToast(`🗑️ ${result.discarded} foto(s) descartadas`)
          }
          // Firestore onSnapshot will clean removing state automatically
        } catch (e) {
          showToast('Error: ' + e.message, true)
          // Revert removing state on error
          setRemoving(prev => {
            const next = { ...prev }
            fns.forEach(f => delete next[f])
            return next
          })
        }
      }
    })
  }

  function handleDelete() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '💀', title: 'Eliminar permanentemente',
      message: `⚠️ ${fns.length} foto(s) serán ELIMINADAS permanentemente.\n\nSe borrarán de GCS y Firestore.\n\nEsta acción NO se puede deshacer.`,
      confirmLabel: `Eliminar ${fns.length} foto(s)`, variant: 'danger',
      onConfirm: async () => {
        setModal(null)
        // Mark cards as removing BEFORE clearing selection
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

  // ===== KEYBOARD =====
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null)
        else if (modal) setModal(null)
        else if (selectedCount > 0) clearSelection()
      }
      if (lightbox) {
        if (e.key === 'ArrowLeft') navigateLightbox(-1)
        if (e.key === 'ArrowRight') navigateLightbox(1)
      }
      if (!lightbox && !modal) {
        if (e.key === '1') { setTab('pending'); clearSelection() }
        if (e.key === '2') { setTab('reviewed'); clearSelection() }
        if (e.key === '3') { setTab('analytics'); clearSelection() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ===== COMPUTED =====
  const avg = reviewed.length > 0
    ? (reviewed.reduce((s, r) => s + (r.score || 0), 0) / reviewed.length).toFixed(1)
    : '—'
  const bestCount = reviewed.filter(r => r.bestOf).length

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
            <div className="camera-badge">◉ Sony A7V · 20mm f/1.8</div>
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
        </div>
        <div className="kbd-hints">
          <kbd>1</kbd><kbd>2</kbd> tabs · <kbd>Esc</kbd> cerrar
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
                {[['newest','Recientes'],['oldest','Antiguas'],['best','Mejor score'],['worst','Peor score']].map(([k,v]) => (
                  <button key={k} className={`pill ${sortBy === k ? 'active' : ''}`} onClick={() => setSortBy(k)}>{v}</button>
                ))}
              </div>
              <div className="select-actions">
                <button className="small-btn" onClick={selectAll}>Seleccionar todas</button>
                {selectedCount > 0 && <button className="small-btn" onClick={clearSelection}>× Deseleccionar</button>}
              </div>
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
      <div className="grid">
        {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`skel-${i}`} index={i} />)}

        {!loading && tab === 'pending' && pending.map((p, i) => (
          <PhotoCard key={p.filename} photo={p} index={i} tab="pending"
            isSelected={!!selected[p.filename]} isProcessing={!!processing[p.filename]}
            removingType={removing[p.filename] || null}
            onToggle={toggleSelect} onView={openLightbox} onTagClick={setSearch} />
        ))}

        {!loading && tab === 'pending' && pending.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <p>No hay fotos pendientes</p>
            <p className="empty-sub">Las fotos aparecerán automáticamente cuando lleguen al bucket</p>
          </div>
        )}

        {!loading && tab === 'reviewed' && filteredReviewed.map((p, i) => (
          <PhotoCard key={p.filename} photo={p} index={i} tab="reviewed"
            isSelected={!!selected[p.filename]} isProcessing={false}
            removingType={removing[p.filename] || null}
            onToggle={toggleSelect} onView={openLightbox}
            onTagClick={tag => { setSearch(tag); setTab('reviewed') }} />
        ))}

        {!loading && tab === 'reviewed' && filteredReviewed.length === 0 && (
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

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <>
          <Analytics />
          <Coaching />
        </>
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
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); navigateLightbox(-1) }}>‹</button>
          <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); navigateLightbox(1) }}>›</button>

          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
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

                {detailLoading && (
                  <div className="lb-detail-loading">
                    <div className="spinner-ring small" />
                    <span>Cargando análisis completo...</span>
                  </div>
                )}

                {lightboxDetail && (
                  <div className="lb-review">
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

      {/* TOAST */}
      <div className="toast-container">
        <div className={`toast ${toast.visible ? 'show' : ''} ${toast.err ? 'error' : ''}`}>{toast.msg}</div>
      </div>
    </div>
  )
}

// ==========================================
// PHOTO CARD
// ==========================================
function PhotoCard({ photo, index, tab, isSelected, isProcessing, removingType, onToggle, onView, onTagClick }) {
  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'
  const thumbUrl = api.getThumbUrl(photo)
  const isRemoving = !!removingType

  const removingLabel = removingType === 'delete' ? 'Eliminando...' : 'Descartando...'
  const removingIcon = removingType === 'delete' ? '💀' : '🗑️'

  return (
    <div
      className={`photo-card ${isSelected ? 'selected' : ''} ${isProcessing ? 'processing' : ''} ${isRemoving ? 'removing' : ''}`}
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
      onClick={e => {
        if (e.target.closest('.dl-actions') || e.target.closest('.tag-pill') || e.target.closest('.view-btn')) return
        if (isProcessing || isRemoving) return
        onToggle(photo.filename)
      }}
    >
      <div className={`check ${isSelected ? 'checked' : ''}`}>
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
        <div className="img-overlay">
          <button className="view-btn" onClick={e => { e.stopPropagation(); onView(photo) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
        </div>
      </div>

      <div className="card-body">
        <div className="card-header">
          <h3 className="card-title">{photo.filename}</h3>
          {tab === 'reviewed' && <span className={`score-pill ${scoreClass}`}>{score.toFixed(1)}</span>}
        </div>

        {tab === 'reviewed' && <>
          <ScoreBar score={score} />
          <div className="card-meta">
            <span className="cat-pill">{CAT_ICONS[photo.category] || '📁'} {photo.category}</span>
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
