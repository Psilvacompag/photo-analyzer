import { useState, useEffect, useRef } from 'react'
import * as api from './api'
import { subscribeSharedWithMe } from './firebase'

const CAT_ICONS = {
  paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️',
  personas: '👤', comida: '🍽️', otras: '📁',
}

function SharedLazyImage({ src, alt, onClick }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [signedSrc, setSignedSrc] = useState(null)

  useEffect(() => {
    setLoaded(false)
    setError(false)
    setSignedSrc(null)
    if (!src) return
    let cancelled = false
    api.resolveSignedUrl(src).then(url => {
      if (!cancelled) setSignedSrc(url)
    })
    return () => { cancelled = true }
  }, [src])

  if (error) {
    return <div className="shared-img-placeholder">📷</div>
  }

  return (
    <div onClick={onClick} style={{ cursor: 'pointer', width: '100%', height: '100%' }}>
      {!loaded && <div className="shared-img-placeholder shimmer" />}
      {signedSrc && (
        <img
          src={signedSrc}
          alt={alt}
          className={`shared-img ${loaded ? 'loaded' : 'loading'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}

function SharedLightbox({ photo, photos, onClose, onNavigate }) {
  const [signedOriginal, setSignedOriginal] = useState(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Sign original URL on open
  useEffect(() => {
    setSignedOriginal(null)
    setImgLoaded(false)
    if (!photo) return
    api.resolvePhotoUrls({ ...photo }).then(signed => {
      setSignedOriginal(signed.originalUrl || signed.thumbUrl)
    })
  }, [photo?.filename])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNavigate(-1)
      if (e.key === 'ArrowRight') onNavigate(1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNavigate])

  // Swipe support
  const touchStart = useRef(null)

  if (!photo) return null

  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); onNavigate(-1) }}>‹</button>
      <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); onNavigate(1) }}>›</button>

      <div className="lightbox-content" onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchStart.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchStart.current === null) return
          const dx = e.changedTouches[0].clientX - touchStart.current
          touchStart.current = null
          if (Math.abs(dx) > 60) onNavigate(dx > 0 ? -1 : 1)
        }}
      >
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <div className="lb-layout">
          <div className="lb-image-wrap">
            {!imgLoaded && <div className="skeleton-img shimmer" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />}
            {signedOriginal && (
              <img
                src={signedOriginal}
                alt={photo.filename}
                onLoad={() => setImgLoaded(true)}
                style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              />
            )}
          </div>
          <div className="lb-detail">
            <h2 className="lb-filename">{photo.filename}</h2>

            {score > 0 && (
              <>
                <div className="lb-score-row">
                  <span className={`score-pill big ${scoreClass}`}>
                    {score.toFixed(1)}/10
                  </span>
                  <span className="cat-pill">{CAT_ICONS[photo.category] || '📁'} {photo.category}</span>
                  {photo.bestOf && <span className="best-pill">⭐ Best Of</span>}
                </div>
                <div className="score-bar-wrap">
                  <div className="score-bar-track">
                    <div className="score-bar-fill" style={{
                      width: `${(score / 10) * 100}%`,
                      background: score >= 7 ? 'var(--green)' : score >= 5 ? 'var(--yellow)' : 'var(--red)'
                    }} />
                  </div>
                </div>
              </>
            )}

            {photo.resumen && <p className="lb-summary">{photo.resumen}</p>}

            {photo.tags && (
              <div className="lb-tags">
                {photo.tags.split(',').map((t, i) => (
                  <span key={i} className="tag-pill">#{t.trim()}</span>
                ))}
              </div>
            )}

            {photo.exif && (
              <div className="exif-detail">
                {photo.exif.camera && <div className="exif-row"><span className="exif-label">Cámara</span><span className="exif-value">{photo.exif.camera}</span></div>}
                {photo.exif.lens && <div className="exif-row"><span className="exif-label">Lente</span><span className="exif-value">{photo.exif.lens}</span></div>}
                {photo.exif.focal_length && <div className="exif-row"><span className="exif-label">Focal</span><span className="exif-value">{photo.exif.focal_length}</span></div>}
                {photo.exif.aperture && <div className="exif-row"><span className="exif-label">Apertura</span><span className="exif-value">{photo.exif.aperture}</span></div>}
                {photo.exif.shutter_speed && <div className="exif-row"><span className="exif-label">Velocidad</span><span className="exif-value">{photo.exif.shutter_speed}</span></div>}
                {photo.exif.iso && <div className="exif-row"><span className="exif-label">ISO</span><span className="exif-value">{photo.exif.iso}</span></div>}
              </div>
            )}

            {photo.composicion && <div className="review-section"><h4>📐 Composición</h4><p>{photo.composicion}</p></div>}
            {photo.exposicion && <div className="review-section"><h4>💡 Exposición</h4><p>{photo.exposicion}</p></div>}
            {photo.enfoque && <div className="review-section"><h4>🎯 Enfoque</h4><p>{photo.enfoque}</p></div>}
            {photo.color && <div className="review-section"><h4>🎨 Color</h4><p>{photo.color}</p></div>}
            {photo.lo_mejor && <div className="review-section good"><h4>👍 Lo Mejor</h4><p>{photo.lo_mejor}</p></div>}
            {photo.a_mejorar && <div className="review-section improve"><h4>🔧 A Mejorar</h4><p>{photo.a_mejorar}</p></div>}
            {photo.tip && <div className="review-section tip"><h4>💡 Tip</h4><p>{photo.tip}</p></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SharedGalleries({ user }) {
  const [sharedWithMe, setSharedWithMe] = useState([])
  const [myShares, setMyShares] = useState([])
  const [viewingGallery, setViewingGallery] = useState(null)
  const [galleryPhotos, setGalleryPhotos] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareSuccess, setShareSuccess] = useState('')
  const [loadingShares, setLoadingShares] = useState(true)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  // Real-time listener for shares with me
  useEffect(() => {
    const unsub = subscribeSharedWithMe(user.email, (shares) => {
      setSharedWithMe(shares)
      setLoadingShares(false)
    })
    return unsub
  }, [user.email])

  // Fetch my shares (not real-time, just on mount)
  useEffect(() => {
    api.fetchShares()
      .then(data => setMyShares(data.myShares || []))
      .catch(() => {})
  }, [])

  async function openGallery(ownerEmail) {
    setGalleryLoading(true)
    setViewingGallery(ownerEmail)
    try {
      const data = await api.fetchSharedGallery(ownerEmail)
      setGalleryPhotos(data.photos || [])
    } catch (e) {
      setGalleryPhotos([])
    } finally {
      setGalleryLoading(false)
    }
  }

  async function handleShare(e) {
    e.preventDefault()
    if (!shareEmail.trim()) return
    setShareLoading(true)
    setShareError('')
    setShareSuccess('')
    try {
      await api.shareGallery(shareEmail.trim())
      setShareSuccess(`Galeria compartida con ${shareEmail.trim()}`)
      setShareEmail('')
      const data = await api.fetchShares()
      setMyShares(data.myShares || [])
    } catch (err) {
      setShareError(err.message)
    } finally {
      setShareLoading(false)
    }
  }

  async function handleUnshare(email) {
    try {
      await api.unshareGallery(email)
      setMyShares(prev => prev.filter(s => s.sharedWithEmail !== email))
    } catch (err) {
      setShareError(err.message)
    }
  }

  function openLightbox(photo) {
    setLightboxPhoto(photo)
  }

  function closeLightbox() {
    setLightboxPhoto(null)
  }

  function navigateLightbox(dir) {
    if (!lightboxPhoto) return
    const idx = galleryPhotos.findIndex(p => p.filename === lightboxPhoto.filename)
    const newIdx = (idx + dir + galleryPhotos.length) % galleryPhotos.length
    setLightboxPhoto(galleryPhotos[newIdx])
  }

  // Viewing a shared gallery
  if (viewingGallery) {
    return (
      <div className="shared-gallery-view">
        <div className="shared-gallery-header">
          <button className="shared-back-btn" onClick={() => { setViewingGallery(null); setGalleryPhotos([]); setLightboxPhoto(null) }}>
            ← Volver
          </button>
          <h2 className="shared-gallery-title">
            📸 Galeria de {viewingGallery}
          </h2>
          <span className="shared-gallery-count">{galleryPhotos.length} fotos</span>
        </div>

        {galleryLoading ? (
          <div className="shared-loading">
            <div className="spinner-ring" />
            <p>Cargando galeria...</p>
          </div>
        ) : galleryPhotos.length === 0 ? (
          <div className="shared-empty">
            <p>Esta galeria no tiene fotos revisadas aun.</p>
          </div>
        ) : (
          <div className="shared-photo-grid">
            {galleryPhotos.map(photo => (
              <div key={photo.filename} className="shared-photo-card">
                <div className="shared-photo-img-wrap">
                  <SharedLazyImage
                    src={photo.thumbUrl || photo.originalUrl}
                    alt={photo.filename}
                    onClick={() => openLightbox(photo)}
                  />
                  {photo.score > 0 && (
                    <span className={`shared-score score-${Math.floor(photo.score)}`}>
                      {photo.score.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="shared-photo-info">
                  <span className="shared-photo-name">{photo.filename}</span>
                  {photo.category && <span className="shared-photo-cat">{CAT_ICONS[photo.category] || '📁'} {photo.category}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <SharedLightbox
          photo={lightboxPhoto}
          photos={galleryPhotos}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      </div>
    )
  }

  // Main view: list of shared galleries + share controls
  return (
    <div className="shared-galleries">
      {/* Share my gallery */}
      <div className="shared-section">
        <h3 className="shared-section-title">🔗 Compartir mi galeria</h3>
        <form className="shared-share-form" onSubmit={handleShare}>
          <input
            type="email"
            className="shared-input"
            placeholder="Email del usuario..."
            value={shareEmail}
            onChange={e => setShareEmail(e.target.value)}
            disabled={shareLoading}
          />
          <button type="submit" className="shared-share-btn" disabled={shareLoading || !shareEmail.trim()}>
            {shareLoading ? '...' : 'Compartir'}
          </button>
        </form>
        {shareError && <p className="shared-error">{shareError}</p>}
        {shareSuccess && <p className="shared-success">{shareSuccess}</p>}

        {myShares.length > 0 && (
          <div className="shared-my-shares">
            <p className="shared-label">Compartida con:</p>
            {myShares.map(share => (
              <div key={share.id} className="shared-share-item">
                <span className="shared-share-email">{share.sharedWithEmail}</span>
                <button className="shared-unshare-btn" onClick={() => handleUnshare(share.sharedWithEmail)}>
                  Dejar de compartir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Galleries shared with me */}
      <div className="shared-section">
        <h3 className="shared-section-title">📸 Galerias compartidas conmigo</h3>

        {loadingShares ? (
          <div className="shared-loading">
            <div className="spinner-ring" />
            <p>Cargando...</p>
          </div>
        ) : sharedWithMe.length === 0 ? (
          <div className="shared-empty-state">
            <div className="shared-empty-icon">🤝</div>
            <p>Nadie ha compartido su galeria contigo aun.</p>
            <p className="shared-empty-hint">Cuando alguien comparta su galeria, aparecera aqui.</p>
          </div>
        ) : (
          <div className="shared-cards">
            {sharedWithMe.map(share => (
              <button
                key={share.id}
                className="shared-card"
                onClick={() => openGallery(share.ownerEmail)}
              >
                <div className="shared-card-avatar">
                  {share.ownerEmail[0].toUpperCase()}
                </div>
                <div className="shared-card-info">
                  <span className="shared-card-email">{share.ownerEmail}</span>
                  <span className="shared-card-perm">Solo lectura</span>
                </div>
                <span className="shared-card-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
