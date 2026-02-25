import { useState, useRef, useCallback } from 'react'
import * as api from './api'

const ACCEPTED_JPEG = '.jpg,.jpeg,.JPG,.JPEG'
const ACCEPTED_RAW = '.arw,.ARW'

// v2
export default function Upload({ onComplete, showToast }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const jpegInputRef = useRef(null)
  const rawInputRef = useRef(null)

  function classifyFile(file) {
    const ext = file.name.split('.').pop().toUpperCase()
    if (ext === 'JPG' || ext === 'JPEG') return 'jpeg'
    if (ext === 'ARW') return 'raw'
    return null
  }

  function addFiles(newFiles) {
    const classified = []
    for (const file of newFiles) {
      const type = classifyFile(file)
      if (!type) continue
      if (files.some(f => f.file.name === file.name)) continue
      classified.push({ file, type, status: 'pending', progress: 0 })
    }
    if (classified.length > 0) {
      setFiles(prev => [...prev, ...classified])
    }
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function clearAll() {
    setFiles([])
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [files])

  async function handleUpload() {
    if (files.length === 0 || uploading) return
    setUploading(true)

    let ok = 0
    let errors = 0

    for (let i = 0; i < files.length; i++) {
      const entry = files[i]
      if (entry.status === 'done') continue

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 0 } : f))

      try {
        const signed = await api.getSignedUrl(entry.file.name, entry.type)

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 10 } : f))

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', signed.url)
          xhr.setRequestHeader('Content-Type', signed.content_type)

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 80) + 10
              setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Upload failed: ${xhr.status}`))
          }
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.send(entry.file)
        })

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 95 } : f))
        await api.uploadComplete(entry.file.name, entry.type)

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f))
        ok++
      } catch (e) {
        console.error(`Upload error for ${entry.file.name}:`, e)
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', progress: 0 } : f))
        errors++
      }
    }

    setUploading(false)
    if (ok > 0) {
      showToast(`📤 ${ok} archivo(s) subido(s)${errors > 0 ? ` · ⚠️ ${errors} error(es)` : ''}`)
    } else if (errors > 0) {
      showToast(`⚠️ ${errors} error(es) al subir`, true)
    }
    if (onComplete) onComplete()
  }

  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'error').length
  const jpegCount = files.filter(f => f.type === 'jpeg').length
  const rawCount = files.filter(f => f.type === 'raw').length

  return (
    <div className="upload-section">
      <div className="upload-header">
        <h3 className="upload-title">📤 Subir Fotos</h3>
        <p className="upload-subtitle">Arrastra archivos JPG o ARW, o usa los botones</p>
      </div>

      <div
        className={`upload-dropzone ${dragOver ? 'drag-over' : ''} ${files.length > 0 ? 'has-files' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {files.length === 0 ? (
          <div className="upload-empty">
            <div className="upload-empty-icon">📁</div>
            <p>Arrastra JPG o RAW aquí</p>
            <span className="upload-empty-hint">o usa los botones de abajo</span>
          </div>
        ) : (
          <div className="upload-file-list">
            {files.map((entry, i) => (
              <div key={entry.file.name} className={`upload-file-item ${entry.status}`}>
                <div className="upload-file-icon">
                  {entry.type === 'jpeg' ? '📷' : '🎞️'}
                </div>
                <div className="upload-file-info">
                  <span className="upload-file-name">{entry.file.name}</span>
                  <span className="upload-file-size">
                    {(entry.file.size / (1024 * 1024)).toFixed(1)} MB
                    <span className={`upload-file-type-badge ${entry.type}`}>
                      {entry.type.toUpperCase()}
                    </span>
                  </span>
                  {entry.status === 'uploading' && (
                    <div className="upload-progress-track">
                      <div className="upload-progress-fill" style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="upload-file-status">
                  {entry.status === 'pending' && (
                    <button className="upload-file-remove" onClick={() => removeFile(i)}>✕</button>
                  )}
                  {entry.status === 'uploading' && (
                    <span className="upload-file-pct">{entry.progress}%</span>
                  )}
                  {entry.status === 'done' && <span className="upload-file-check">✅</span>}
                  {entry.status === 'error' && <span className="upload-file-error">⚠️</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="upload-actions">
        <div className="upload-add-btns">
          <button className="upload-add-btn jpeg" onClick={() => jpegInputRef.current?.click()}>
            📷 Agregar JPG
          </button>
          <button className="upload-add-btn raw" onClick={() => rawInputRef.current?.click()}>
            🎞️ Agregar RAW
          </button>
          <input ref={jpegInputRef} type="file" accept={ACCEPTED_JPEG} multiple hidden
            onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }} />
          <input ref={rawInputRef} type="file" accept={ACCEPTED_RAW} multiple hidden
            onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        </div>

        {files.length > 0 && (
          <div className="upload-action-btns">
            <span className="upload-summary">
              {jpegCount > 0 && `${jpegCount} JPG`}
              {jpegCount > 0 && rawCount > 0 && ' · '}
              {rawCount > 0 && `${rawCount} RAW`}
            </span>
            {!uploading && (
              <button className="upload-clear-btn" onClick={clearAll}>Limpiar</button>
            )}
            <button
              className="upload-submit-btn"
              onClick={handleUpload}
              disabled={uploading || pendingCount === 0}
            >
              {uploading ? (
                <><div className="spinner-ring small" /> Subiendo...</>
              ) : (
                `📤 Subir ${pendingCount} archivo(s)`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
};