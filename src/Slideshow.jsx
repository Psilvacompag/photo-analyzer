import { useState, useEffect, useCallback, useRef } from 'react'
import * as api from './api'
import './slideshow.css'

const ADVANCE_MS = 5000

export default function Slideshow({ photos, onClose }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  const total = photos.length
  const photo = photos[index]

  const goNext = useCallback(() => {
    setIndex(prev => (prev + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setIndex(prev => (prev - 1 + total) % total)
  }, [total])

  // Auto-advance
  useEffect(() => {
    if (paused || total <= 1) return
    timerRef.current = setInterval(goNext, ADVANCE_MS)
    return () => clearInterval(timerRef.current)
  }, [paused, goNext, total])

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); setPaused(p => !p) }
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev])

  if (!photo) return null

  const score = photo.score || 0
  const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'

  return (
    <div
      className="slideshow-overlay"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Counter */}
      <div className="slideshow-counter">
        {index + 1} / {total}
        {paused && <span className="slideshow-paused-badge">PAUSA</span>}
      </div>

      {/* Close */}
      <button className="slideshow-close" onClick={onClose}>✕</button>

      {/* Nav arrows */}
      {total > 1 && (
        <>
          <button className="slideshow-nav slideshow-prev" onClick={goPrev}>&#8249;</button>
          <button className="slideshow-nav slideshow-next" onClick={goNext}>&#8250;</button>
        </>
      )}

      {/* Image */}
      <div className="slideshow-image-wrap">
        <img
          key={photo.filename}
          src={api.getHighResUrl(photo)}
          alt={photo.filename}
          className="slideshow-image"
        />
      </div>

      {/* Bottom bar */}
      <div className="slideshow-bar">
        <span className="slideshow-filename">{photo.filename}</span>
        {score > 0 && (
          <span className={`score-pill ${scoreClass}`}>{score.toFixed(1)}</span>
        )}
        {photo.category && (
          <span className="slideshow-category">{photo.category}</span>
        )}
        {photo.bestOf && <span className="slideshow-bestof">Best Of</span>}
      </div>
    </div>
  )
}
