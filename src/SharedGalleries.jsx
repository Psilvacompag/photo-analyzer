import { useState, useEffect } from 'react'
import * as api from './api'
import { subscribeSharedWithMe } from './firebase'

function LazyImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return <div className="shared-img-placeholder">📷</div>
  }

  return (
    <>
      {!loaded && <div className="shared-img-placeholder shimmer" />}
      <img
        src={src}
        alt={alt}
        className={`shared-img ${loaded ? 'loaded' : 'loading'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </>
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
      // Refresh my shares
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

  // Viewing a shared gallery
  if (viewingGallery) {
    return (
      <div className="shared-gallery-view">
        <div className="shared-gallery-header">
          <button className="shared-back-btn" onClick={() => { setViewingGallery(null); setGalleryPhotos([]) }}>
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
                  <LazyImage src={photo.thumbUrl || photo.originalUrl} alt={photo.filename} />
                  {photo.score > 0 && (
                    <span className={`shared-score score-${Math.floor(photo.score)}`}>
                      {photo.score.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="shared-photo-info">
                  <span className="shared-photo-name">{photo.filename}</span>
                  {photo.category && <span className="shared-photo-cat">{photo.category}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
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
