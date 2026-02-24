import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as api from './api'
import Analytics from './Analytics'
import './analytics.css'
import Coaching from './Coaching'
import './coaching.css'

const CAT_ICONS = {
  paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️',
  personas: '👤', comida: '🍽️', otras: '📁', todas: '✨',
}
const CATEGORIES = ['todas', 'paisajes', 'mascotas', 'arquitectura', 'personas', 'comida', 'otras']
const PAGE_SIZE = 30

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
        <img
          src={src} alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            opacity: loaded ? 1 : 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            transition: 'opacity 0.3s ease', background: 'var(--surface2)',
          }}
        />
      )}
      {error && (
        <div className="img-error">
          <span>📷</span>
          <small>No se pudo cargar</small>
        </div>
      )}
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
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState({})
  const [processing, setProcessing] = useState({})
  const [removing, setRemoving] = useState({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [sortBy, setSortBy] = useState('newest')
  const [lightbox, setLightbox] = useState(null)
  const [lightboxDetail, setLightboxDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState({ msg: '', visible: false, err: false })
  const [lastUpdated, setLastUpdated] = useState(null)

  // Pagination state
  const [reviewedPage, setReviewedPage] = useState(1)
  const [reviewedTotal, setReviewedTotal] = useState(0)
  const [reviewedHasMore, setReviewedHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const debouncedSearch = useDebounce(search, 250)
  const selectedCount = Object.keys(selected).length

  // ===== TOAST =====
  const showToast = useCallback((msg, err = false) => {
    setToast({ msg, visible: true, err })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
  }, [])

  // ===== LOAD DATA =====
  const loadData = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) setLoading(true)

      const data = await api.fetchGalleryData(1, PAGE_SIZE)
      setPending(data.pending || [])
      setReviewed(data.reviewed || [])
      setReviewedTotal(data.reviewedTotal || 0)
      setReviewedHasMore(data.reviewedHasMore || false)
      setReviewedPage(1)
      setLastUpdated(new Date())
    } catch (e) {
      showToast('Error cargando datos: ' + e.message, true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  // ===== LOAD MORE REVIEWED =====
  async function loadMoreReviewed() {
    if (loadingMore || !reviewedHasMore) return
    setLoadingMore(true)
    try {
      const nextPage = reviewedPage + 1
      const data = await api.fetchMoreReviewed(nextPage, PAGE_SIZE)
      const paginatedData = data.reviewed || data
      const newItems = paginatedData.items || paginatedData
      setReviewed(prev => [...prev, ...newItems])
      setReviewedPage(nextPage)
      setReviewedHasMore(paginatedData.hasMore ?? false)
    } catch (e) {
      showToast('Error cargando más fotos: ' + e.message, true)
    } finally {
      setLoadingMore(false)
    }
  }

  // ===== REFRESH =====
  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    loadData(false)
  }

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
    items.forEach(p => { if (!processing[p.filename]) next[p.filename] = true })
    setSelected(next)
  }

  function clearSelection() { setSelected({}) }

  // ===== FILTER & SORT (memoized) =====
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
    if (sortBy === 'best') items.sort((a, b) => b.score - a.score)
    else if (sortBy === 'worst') items.sort((a, b) => a.score - b.score)
    else if (sortBy === 'oldest') items.sort((a, b) => a.filename.localeCompare(b.filename))
    else items.sort((a, b) => b.filename.localeCompare(a.filename))
    return items
  }, [reviewed, category, debouncedSearch, sortBy])

  // ===== LIGHTBOX WITH DETAIL =====
  async function openLightbox(photo) {
    setLightbox({ photo })
    setLightboxDetail(null)

    if (photo.score != null) {
      setDetailLoading(true)
      try {
        const detail = await api.fetchPhotoDetail(photo.filename)
        setLightboxDetail(detail)
      } catch (e) {
        console.log('Detail load failed:', e)
      } finally {
        setDetailLoading(false)
      }
    }

    // Preload adjacent images
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

  // ===== LIGHTBOX NAVIGATION =====
  function navigateLightbox(dir) {
    if (!lightbox) return
    const items = tab === 'pending' ? pending : filteredReviewed
    const idx = items.findIndex(p => p.filename === lightbox.photo.filename)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= items.length) return
    openLightbox(items[newIdx])
  }

  // ===== TOUCH SWIPE =====
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      navigateLightbox(dx > 0 ? -1 : 1)
    }
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
        await api.reviewOnePhoto(fn)
        ok++
      } catch (e) {
        errors++
        showToast(`⚠️ Error en ${fn}`, true)
      }
      setProcessing(prev => { const n = { ...prev }; delete n[fn]; return n })
      setRemoving(prev => ({ ...prev, [fn]: true }))
      await new Promise(r => setTimeout(r, 600))
      setPending(prev => prev.filter(p => p.filename !== fn))
      setRemoving(prev => { const n = { ...prev }; delete n[fn]; return n })
    }
    let msg = `✅ ${ok} foto(s) analizadas`
    if (errors) msg += ` · ⚠️ ${errors} error(es)`
    showToast(msg)
    loadData(false)
  }

  function handleDiscard() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '🗑️', title: 'Descartar fotos',
      message: `${fns.length} foto(s) se moverán a descartadas (JPG + RAW). Podrás recuperarlas después.`,
      confirmLabel: 'Descartar', variant: 'warn',
      onConfirm: async () => {
        setModal(null)
        setSelected({})
        fns.forEach(fn => setRemoving(prev => ({ ...prev, [fn]: true })))
        try {
          const result = await api.discardPhotos(fns)
          await new Promise(r => setTimeout(r, 400))
          // Remover del state local
          const discardedSet = new Set(result.details?.ok || fns)
          setPending(prev => prev.filter(p => !discardedSet.has(p.filename)))
          setReviewed(prev => prev.filter(p => !discardedSet.has(p.filename)))
          setRemoving({})

          const errCount = result.errors || 0
          if (errCount > 0) {
            showToast(`🗑️ ${result.discarded} descartadas · ⚠️ ${errCount} error(es)`, errCount > 0)
          } else {
            showToast(`🗑️ ${result.discarded} foto(s) descartadas`)
          }
        } catch (e) {
          setRemoving({})
          showToast('Error: ' + e.message, true)
        }
      }
    })
  }

  function handleDelete() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '💀', title: 'Eliminar permanentemente',
      message: `⚠️ ${fns.length} foto(s) serán ELIMINADAS permanentemente.\n\nSe borrarán: JPG, RAW y review del Sheet.\n\nEsta acción NO se puede deshacer.`,
      confirmLabel: `Eliminar ${fns.length} foto(s)`, variant: 'danger',
      onConfirm: async () => {
        setModal(null)
        setSelected({})
        fns.forEach(fn => setRemoving(prev => ({ ...prev, [fn]: true })))
        try {
          const result = await api.deletePhotos(fns)
          await new Promise(r => setTimeout(r, 400))
          const deletedSet = new Set(result.details?.ok || fns)
          setPending(prev => prev.filter(p => !deletedSet.has(p.filename)))
          setReviewed(prev => prev.filter(p => !deletedSet.has(p.filename)))
          setRemoving({})
          showToast(`💀 ${result.deleted} foto(s) eliminadas permanentemente`)
        } catch (e) {
          setRemoving({})
          showToast('Error: ' + e.message, true)
        }
      }
    })
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
        if (e.key === 'r' || e.key === 'R') handleRefresh()
        if (e.key === '1') { setTab('pending'); clearSelection() }
        if (e.key === '2') { setTab('reviewed'); clearSelection() }
        if (e.key === '3') { setTab('analytics'); clearSelection() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ===== COMPUTED =====
  const totalReviewed = reviewedTotal || reviewed.length
  const avg = reviewed.length > 0
    ? (reviewed.reduce((s, r) => s + r.score, 0) / reviewed.length).toFixed(1)
    : '—'
  const bestCount = reviewed.filter(r => r.bestOf).length
  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : null

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
            <button className={`refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} title="Actualizar (R)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
            {lastUpdatedStr && <div className="updated-badge">{lastUpdatedStr}</div>}
            <div className="camera-badge">◉ Sony A7V · 20mm f/1.8</div>
          </div>
        </div>
      </header>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card clickable" style={{ animationDelay: '0ms' }} onClick={() => { setTab('pending'); clearSelection() }}>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{pending.length}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card clickable" style={{ animationDelay: '80ms' }} onClick={() => { setTab('reviewed'); clearSelection() }}>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{totalReviewed}</div>
          <div className="stat-label">Revisadas</div>
        </div>
        <div className="stat-card" style={{ animationDelay: '160ms' }}>
          <div className="stat-value">{avg}</div>
          <div className="stat-label">Score promedio</div>
          {avg !== '—' && <ScoreBar score={parseFloat(avg)} />}
        </div>
        <div className="stat-card" style={{ animationDelay: '240ms' }}>
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
            ✅ Revisadas <span className="count">{totalReviewed}</span>
          </button>
          <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => { setTab('analytics'); clearSelection() }}>
            📊 Analytics
          </button>
        </div>
        <div className="kbd-hints">
          <kbd>1</kbd><kbd>2</kbd> tabs · <kbd>R</kbd> refresh · <kbd>Esc</kbd> cerrar
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
      <div className="grid">
        {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`skel-${i}`} index={i} />)}

        {!loading && tab === 'pending' && pending.map((p, i) => (
          <PhotoCard key={p.filename} photo={p} index={i} tab="pending"
            isSelected={!!selected[p.filename]} isProcessing={!!processing[p.filename]} isRemoving={!!removing[p.filename]}
            onToggle={toggleSelect}
            onView={openLightbox}
            onTagClick={setSearch} />
        ))}

        {!loading && tab === 'pending' && pending.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <p>No hay fotos pendientes</p>
            <p className="empty-sub">Tus fotos aparecerán aquí cuando se suban a Google Drive</p>
          </div>
        )}

        {!loading && tab === 'reviewed' && filteredReviewed.map((p, i) => (
          <PhotoCard key={p.filename} photo={p} index={i} tab="reviewed"
            isSelected={!!selected[p.filename]} isProcessing={false} isRemoving={!!removing[p.filename]}
            onToggle={toggleSelect}
            onView={openLightbox}
            onTagClick={tag => { setSearch(tag); setTab('reviewed') }} />
        ))}

        {!loading && tab === 'reviewed' && filteredReviewed.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📷</div>
            <p>No se encontraron fotos</p>
            {debouncedSearch && <p className="empty-sub">Prueba con otros términos de búsqueda</p>}
          </div>
        )}
      </div>

      {/* LOAD MORE */}
      {!loading && tab === 'reviewed' && reviewedHasMore && !debouncedSearch && category === 'todas' && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={loadMoreReviewed} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <div className="spinner-ring small" />
                <span>Cargando...</span>
              </>
            ) : (
              <>
                <span>Cargar más fotos</span>
                <span className="load-more-count">
                  {reviewed.length} de {reviewedTotal}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <>
          <Analytics />
          <Coaching />
        </>
      )}

      {/* TOOLBAR */}
      <div className={`toolbar ${selectedCount > 0 ? 'visible' : ''}`}>
        <span className="toolbar-count">{selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>
        <div className="toolbar-btns">
          <button className="toolbar-btn cancel" onClick={clearSelection}>Cancelar</button>
          <button className="toolbar-btn warn" onClick={handleDiscard}>🗑️ Descartar</button>
          {tab === 'reviewed' && (
            <button className="toolbar-btn danger" onClick={handleDelete}>💀 Eliminar</button>
          )}
          {tab === 'pending' && (
            <button className="toolbar-btn primary" onClick={handleAnalyze}>🤖 Analizar con IA</button>
          )}
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

                {lightbox.photo.score != null && (
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
                  {lightbox.photo.fileId && (
                    <a className="dl-chip" href={api.getDriveDownloadUrl(lightbox.photo.fileId)} target="_blank" rel="noreferrer">📷 JPG</a>
                  )}
                  {(lightbox.photo.rawFileId || lightboxDetail?.rawFileId) && (
                    <a className="dl-chip raw-chip" href={api.getDriveDownloadUrl(lightbox.photo.rawFileId || lightboxDetail.rawFileId)} target="_blank" rel="noreferrer">🎞️ RAW</a>
                  )}
                  {lightbox.photo.reviewId && (
                    <a className="dl-chip" href={api.getReviewDocUrl(lightbox.photo.reviewId)} target="_blank" rel="noreferrer">📝 Review Doc</a>
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
function PhotoCard({ photo, index, tab, isSelected, isProcessing, isRemoving, onToggle, onView, onTagClick }) {
  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'
  const thumbUrl = api.getThumbUrl(photo)

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

      {tab === 'pending' && !isProcessing && <div className="badge pending-badge">PENDIENTE</div>}
      {isProcessing && (
        <div className="proc-overlay">
          <div className="spinner-ring" />
          <span className="proc-label">Analizando...</span>
        </div>
      )}
      {photo.bestOf && <div className="badge best-badge">⭐ BEST OF</div>}

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
          <span className="card-date">{photo.fecha}</span>
          <div className="dl-actions">
            {photo.fileId && (
              <a className="dl-chip" href={api.getDriveDownloadUrl(photo.fileId)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>📷 JPG</a>
            )}
            {photo.rawFileId && (
              <a className="dl-chip raw-chip" href={api.getDriveDownloadUrl(photo.rawFileId)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>🎞️ RAW</a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
