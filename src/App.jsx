import { useState, useEffect, useCallback } from 'react'
import * as api from './api'
import { DEMO_DATA, getDemoThumbUrl, isDemoMode } from './demo-data'

const CAT_ICONS = { paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️', personas: '👤', comida: '🍽️', otras: '📁', todas: '✨' }
const CATEGORIES = ['todas', 'paisajes', 'mascotas', 'arquitectura', 'personas', 'comida', 'otras']

// ==========================================
// HELPER: get thumbnail URL (real or demo)
// ==========================================
function getThumbUrl(fileId, index) {
  if (isDemoMode()) return getDemoThumbUrl(index)
  return api.getDriveThumbUrl(fileId)
}

// ==========================================
// APP
// ==========================================
export default function App() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState({})
  const [processing, setProcessing] = useState({})
  const [removing, setRemoving] = useState({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [sortBy, setSortBy] = useState('newest')
  const [lightbox, setLightbox] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState({ msg: '', visible: false, err: false })

  const selectedCount = Object.keys(selected).length
  const processingCount = Object.keys(processing).length

  // ===== TOAST =====
  const showToast = useCallback((msg, err = false) => {
    setToast({ msg, visible: true, err })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
  }, [])

  // ===== LOAD DATA =====
  const loadData = useCallback(async () => {
    try {
      if (isDemoMode()) {
        setPending(DEMO_DATA.pending)
        setReviewed(DEMO_DATA.reviewed)
      } else {
        const data = await api.fetchGalleryData()
        setPending(data.pending || [])
        setReviewed(data.reviewed || [])
      }
    } catch (e) {
      showToast('Error cargando datos: ' + e.message, true)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

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
    const items = tab === 'pending' ? pending : getFilteredReviewed()
    const next = {}
    items.forEach(p => { if (!processing[p.filename]) next[p.filename] = true })
    setSelected(next)
  }

  function clearSelection() { setSelected({}) }

  // ===== FILTER & SORT =====
  function getFilteredReviewed() {
    let items = [...reviewed]
    if (category !== 'todas') items = items.filter(r => r.category === category)
    if (search) {
      const q = search.toLowerCase()
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
        if (isDemoMode()) {
          await new Promise(r => setTimeout(r, 1500)) // simulate
        } else {
          await api.reviewOnePhoto(fn)
        }
        ok++
      } catch (e) {
        errors++
        showToast(`⚠️ Error en ${fn}`, true)
      }
      // Animate out
      setProcessing(prev => { const n = { ...prev }; delete n[fn]; return n })
      setRemoving(prev => ({ ...prev, [fn]: true }))
      await new Promise(r => setTimeout(r, 600))
      setPending(prev => prev.filter(p => p.filename !== fn))
      setRemoving(prev => { const n = { ...prev }; delete n[fn]; return n })
    }
    let msg = `✅ ${ok} foto(s) analizadas`
    if (errors) msg += ` · ⚠️ ${errors} error(es)`
    showToast(msg)
    if (!isDemoMode()) loadData()
  }

  function handleDiscard() {
    const fns = Object.keys(selected)
    if (!fns.length) return
    setModal({
      icon: '🗑️', title: 'Descartar fotos',
      message: `${fns.length} foto(s) se moverán a descartadas.`,
      confirmLabel: 'Descartar', variant: 'warn',
      onConfirm: async () => {
        setModal(null)
        setSelected({})
        fns.forEach(fn => setRemoving(prev => ({ ...prev, [fn]: true })))
        try {
          if (!isDemoMode()) await api.discardPhotos(fns)
          await new Promise(r => setTimeout(r, 600))
          setPending(prev => prev.filter(p => !fns.includes(p.filename)))
          setRemoving({})
          showToast(`🗑️ ${fns.length} foto(s) descartadas`)
          if (!isDemoMode()) loadData()
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
      icon: '⚠️', title: 'Eliminar fotos',
      message: `${fns.length} foto(s) y archivos asociados serán eliminados.`,
      confirmLabel: 'Eliminar', variant: 'danger',
      onConfirm: async () => {
        setModal(null)
        setSelected({})
        fns.forEach(fn => setRemoving(prev => ({ ...prev, [fn]: true })))
        try {
          if (!isDemoMode()) await api.deletePhotos(fns)
          await new Promise(r => setTimeout(r, 600))
          setReviewed(prev => prev.filter(p => !fns.includes(p.filename)))
          setRemoving({})
          showToast(`Eliminadas ${fns.length} foto(s)`)
          if (!isDemoMode()) loadData()
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
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null)
        else if (modal) setModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, modal])

  // ===== COMPUTED =====
  const avg = reviewed.length > 0
    ? (reviewed.reduce((s, r) => s + r.score, 0) / reviewed.length).toFixed(1)
    : '—'
  const bestCount = reviewed.filter(r => r.bestOf).length
  const filteredReviewed = getFilteredReviewed()

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
          {isDemoMode() ? (
            <div className="camera-badge demo-badge">⚡ Modo Demo</div>
          ) : (
            <div className="camera-badge">◉ Sony A7V · 20mm f/1.8</div>
          )}
        </div>
      </header>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card" style={{ animationDelay: '0ms' }}>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{pending.length}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card" style={{ animationDelay: '80ms' }}>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{reviewed.length}</div>
          <div className="stat-label">Revisadas</div>
        </div>
        <div className="stat-card" style={{ animationDelay: '160ms' }}>
          <div className="stat-value">{avg}</div>
          <div className="stat-label">Score promedio</div>
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
            ✅ Revisadas <span className="count">{reviewed.length}</span>
          </button>
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
            </div>
            <div className="filter-pills">
              {CATEGORIES.map(c => (
                <button key={c} className={`pill ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                  {CAT_ICONS[c]} {c}
                </button>
              ))}
            </div>
            <div className="filter-pills">
              {[['newest','Recientes'],['oldest','Antiguas'],['best','Mejor score'],['worst','Peor score']].map(([k,v]) => (
                <button key={k} className={`pill ${sortBy === k ? 'active' : ''}`} onClick={() => setSortBy(k)}>{v}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* GRID */}
      <div className="grid">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Cargando fotos...</p>
          </div>
        )}

        {!loading && tab === 'pending' && pending.map((p, i) => (
          <PhotoCard
            key={p.filename} photo={p} index={i} tab="pending"
            isSelected={!!selected[p.filename]}
            isProcessing={!!processing[p.filename]}
            isRemoving={!!removing[p.filename]}
            onToggle={toggleSelect}
            onView={(photo) => setLightbox({ photo, imgSrc: getThumbUrl(p.fileId, i) })}
            thumbUrl={getThumbUrl(p.fileId, i)}
            onTagClick={setSearch}
          />
        ))}

        {!loading && tab === 'pending' && pending.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <p>No hay fotos pendientes.</p>
          </div>
        )}

        {!loading && tab === 'reviewed' && filteredReviewed.map((p, i) => (
          <PhotoCard
            key={p.filename} photo={p} index={i} tab="reviewed"
            isSelected={!!selected[p.filename]}
            isProcessing={false}
            isRemoving={!!removing[p.filename]}
            onToggle={toggleSelect}
            onView={(photo) => setLightbox({ photo, imgSrc: getThumbUrl(p.fileId, i) })}
            thumbUrl={getThumbUrl(p.fileId, i)}
            onTagClick={(tag) => { setSearch(tag); setTab('reviewed') }}
          />
        ))}

        {!loading && tab === 'reviewed' && filteredReviewed.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📷</div>
            <p>No se encontraron fotos</p>
          </div>
        )}
      </div>

      {/* TOOLBAR */}
      <div className={`toolbar ${selectedCount > 0 ? 'visible' : ''}`}>
        <span className="toolbar-count">{selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>
        <div className="toolbar-btns">
          <button className="toolbar-btn cancel" onClick={clearSelection}>Cancelar</button>
          {tab === 'pending' && <>
            <button className="toolbar-btn warn" onClick={handleDiscard}>🗑️ Descartar</button>
            <button className="toolbar-btn primary" onClick={handleAnalyze}>🤖 Analizar con IA</button>
          </>}
          {tab === 'reviewed' && (
            <button className="toolbar-btn danger" onClick={handleDelete}>🗑️ Eliminar</button>
          )}
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
            <img src={lightbox.imgSrc?.replace('w=400&h=300', 'w=1200&h=900')} alt={lightbox.photo.filename} />
            <div className="lightbox-info">
              <h2>{lightbox.photo.filename}</h2>
              {lightbox.photo.score != null && (
                <div className="lightbox-meta">
                  <span className={`score-pill ${lightbox.photo.score >= 7 ? 'high' : lightbox.photo.score >= 5 ? 'mid' : 'low'}`}>
                    {lightbox.photo.score.toFixed(1)}/10
                  </span>
                  <span className="cat-pill">{CAT_ICONS[lightbox.photo.category]} {lightbox.photo.category}</span>
                </div>
              )}
              {lightbox.photo.resumen && <p className="lightbox-summary">{lightbox.photo.resumen}</p>}
              <div className="lightbox-actions">
                {lightbox.photo.fileId && (
                  <a className="dl-chip" href={isDemoMode() ? '#' : api.getDriveDownloadUrl(lightbox.photo.fileId)} target="_blank" rel="noreferrer">📷 JPG</a>
                )}
                {lightbox.photo.rawFileId && (
                  <a className="dl-chip raw-chip" href={isDemoMode() ? '#' : api.getDriveDownloadUrl(lightbox.photo.rawFileId)} target="_blank" rel="noreferrer">🎞️ RAW</a>
                )}
                {lightbox.photo.reviewId && (
                  <a className="dl-chip" href={isDemoMode() ? '#' : api.getReviewDocUrl(lightbox.photo.reviewId)} target="_blank" rel="noreferrer">📝 Review</a>
                )}
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
            <p className="modal-msg">{modal.message}</p>
            <div className="modal-btns">
              <button className="modal-btn cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className={`modal-btn ${modal.variant}`} onClick={modal.onConfirm}>{modal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className="toast-container">
        <div className={`toast ${toast.visible ? 'show' : ''} ${toast.err ? 'error' : ''}`}>
          {toast.msg}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// PHOTO CARD COMPONENT
// ==========================================
function PhotoCard({ photo, index, tab, isSelected, isProcessing, isRemoving, onToggle, onView, thumbUrl, onTagClick }) {
  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'

  return (
    <div
      className={`photo-card ${isSelected ? 'selected' : ''} ${isProcessing ? 'processing' : ''} ${isRemoving ? 'removing' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
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
        <img src={thumbUrl} alt={photo.filename} loading="lazy" />
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
          <div className="card-meta">
            <span className="cat-pill">{CAT_ICONS[photo.category] || '📁'} {photo.category}</span>
          </div>
          {photo.tags && (
            <div className="tags-wrap">
              {photo.tags.split(',').map((t, i) => (
                <span key={i} className="tag-pill" onClick={e => { e.stopPropagation(); onTagClick(t.trim()) }}>#{t.trim()}</span>
              ))}
            </div>
          )}
          <p className="card-summary">{photo.resumen}</p>
        </>}

        <div className="card-footer">
          <span className="card-date">{photo.fecha}</span>
          <div className="dl-actions">
            {photo.fileId && (
              <a className="dl-chip" href={isDemoMode() ? '#' : api.getDriveDownloadUrl(photo.fileId)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                📷 JPG
              </a>
            )}
            {photo.rawFileId && (
              <a className="dl-chip raw-chip" href={isDemoMode() ? '#' : api.getDriveDownloadUrl(photo.rawFileId)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                🎞️ RAW
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
