import { useState } from 'react'
import * as api from './api'

// Colors
const C = {
  dark: [20, 20, 28],
  surface: [28, 28, 36],
  accent: [108, 140, 255],
  gold: [251, 191, 36],
  text: [232, 232, 237],
  muted: [136, 136, 160],
  dim: [85, 85, 106],
  green: [52, 211, 153],
  white: [255, 255, 255],
}

function drawRoundedRect(doc, x, y, w, h, r, fill, stroke) {
  if (fill) {
    doc.setFillColor(...fill)
    doc.roundedRect(x, y, w, h, r, r, 'F')
  }
  if (stroke) {
    doc.setDrawColor(...stroke)
    doc.roundedRect(x, y, w, h, r, r, 'S')
  }
}

function drawScoreBar(doc, x, y, w, score) {
  const h = 2.5
  doc.setFillColor(40, 40, 50)
  doc.roundedRect(x, y, w, h, 1, 1, 'F')
  const pct = Math.min(score / 10, 1) * w
  const color = score >= 7 ? C.green : score >= 5 ? C.gold : [248, 113, 113]
  doc.setFillColor(...color)
  doc.roundedRect(x, y, pct, h, 1, 1, 'F')
}

async function loadImage(url) {
  const resp = await fetch(url)
  if (!resp.ok) return null
  const blob = await resp.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => resolve({ width: 4, height: 3 })
    img.src = dataUrl
  })
}

export default function PortfolioExport({ photos, showToast }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (exporting || !photos.length) return
    setExporting(true)
    showToast('Generando PDF...')

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()   // 297
      const H = doc.internal.pageSize.getHeight()   // 210

      // ========== COVER PAGE ==========
      // Full dark background
      doc.setFillColor(...C.dark)
      doc.rect(0, 0, W, H, 'F')

      // Accent line top
      doc.setFillColor(...C.accent)
      doc.rect(0, 0, W, 1.5, 'F')

      // Title
      doc.setFontSize(42)
      doc.setTextColor(...C.white)
      doc.text('PORTFOLIO', W / 2, H / 2 - 22, { align: 'center' })

      // Accent divider
      const divW = 60
      doc.setFillColor(...C.accent)
      doc.rect((W - divW) / 2, H / 2 - 12, divW, 0.8, 'F')

      // Subtitle
      doc.setFontSize(13)
      doc.setTextColor(...C.muted)
      doc.text('Best Of Collection', W / 2, H / 2 - 2, { align: 'center' })

      // Stats
      const avgScore = photos.reduce((s, p) => s + (p.score || 0), 0) / photos.length
      doc.setFontSize(10)
      doc.setTextColor(...C.dim)
      doc.text(`${photos.length} photos  ·  avg ${avgScore.toFixed(1)}/10`, W / 2, H / 2 + 10, { align: 'center' })

      // Date
      doc.setFontSize(9)
      doc.setTextColor(...C.dim)
      const dateStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
      doc.text(dateStr, W / 2, H / 2 + 20, { align: 'center' })

      // Camera badge
      doc.setFontSize(8)
      doc.setTextColor(...C.dim)
      doc.text('Sony A7V  ·  PhotoAnalyzer', W / 2, H - 15, { align: 'center' })

      // Accent line bottom
      doc.setFillColor(...C.accent)
      doc.rect(0, H - 1.5, W, 1.5, 'F')

      // ========== PHOTO PAGES ==========
      let done = 0
      for (const photo of photos) {
        doc.addPage()
        done++
        showToast(`Generando PDF... ${done}/${photos.length}`)

        const score = photo.score || 0
        const margin = 12

        // Dark background
        doc.setFillColor(...C.dark)
        doc.rect(0, 0, W, H, 'F')

        // Top accent bar
        doc.setFillColor(...C.accent)
        doc.rect(0, 0, W, 0.8, 'F')

        // Load HIGH-RES image (not thumbnail)
        let imgDataUrl = null
        let imgAspect = 3 / 2
        try {
          const url = api.getHighResUrl(photo)
          imgDataUrl = await loadImage(url)
          if (imgDataUrl) {
            const dims = await getImageDimensions(imgDataUrl)
            imgAspect = dims.width / dims.height
          }
        } catch (e) {
          // fallback to thumb
          try {
            imgDataUrl = await loadImage(api.getThumbUrl(photo))
          } catch (e2) { /* skip */ }
        }

        // Layout: image area + info strip at bottom
        const infoH = 38
        const imgAreaH = H - infoH - margin - 6
        const imgAreaW = W - margin * 2
        const imgAreaY = 6

        if (imgDataUrl) {
          // Calculate image size maintaining aspect ratio
          let imgW = imgAreaW
          let imgH = imgW / imgAspect
          if (imgH > imgAreaH) {
            imgH = imgAreaH
            imgW = imgH * imgAspect
          }
          const imgX = margin + (imgAreaW - imgW) / 2
          const imgY = imgAreaY + (imgAreaH - imgH) / 2

          // Subtle dark frame behind image
          drawRoundedRect(doc, imgX - 1, imgY - 1, imgW + 2, imgH + 2, 2, [15, 15, 20])
          doc.addImage(imgDataUrl, 'JPEG', imgX, imgY, imgW, imgH)
        }

        // ---- Info strip ----
        const infoY = H - infoH

        // Info background
        drawRoundedRect(doc, margin, infoY, W - margin * 2, infoH - margin + 4, 3, C.surface)

        const infoLeft = margin + 8
        const infoRight = W - margin - 8

        // Filename
        doc.setFontSize(11)
        doc.setTextColor(...C.white)
        doc.text(photo.filename, infoLeft, infoY + 8)

        // Score pill
        if (score > 0) {
          const scoreText = `${score.toFixed(1)} / 10`
          const scoreColor = score >= 7 ? C.green : score >= 5 ? C.gold : [248, 113, 113]
          doc.setFontSize(14)
          doc.setTextColor(...scoreColor)
          doc.text(scoreText, infoRight, infoY + 8, { align: 'right' })

          // Score bar
          drawScoreBar(doc, infoLeft, infoY + 12, 50, score)
        }

        // Category + tags line
        const metaY = infoY + 19
        doc.setFontSize(8)
        doc.setTextColor(...C.muted)
        const metaParts = []
        if (photo.category) metaParts.push(photo.category.toUpperCase())
        if (photo.tags) {
          const tags = photo.tags.split(',').slice(0, 4).map(t => '#' + t.trim()).join('  ')
          metaParts.push(tags)
        }
        if (metaParts.length) {
          doc.text(metaParts.join('   ·   '), infoLeft, metaY)
        }

        // Best Of badge
        if (photo.bestOf) {
          doc.setFontSize(7)
          doc.setTextColor(...C.gold)
          doc.text('★ BEST OF', infoRight, metaY, { align: 'right' })
        }

        // Resumen
        if (photo.resumen) {
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dim)
          const maxW = W - margin * 2 - 16
          const lines = doc.splitTextToSize(photo.resumen, maxW)
          doc.text(lines.slice(0, 2), infoLeft, metaY + 6)
        }

        // Page number
        doc.setFontSize(7)
        doc.setTextColor(...C.dim)
        doc.text(`${done} / ${photos.length}`, W / 2, H - 4, { align: 'center' })
      }

      // ========== BACK COVER ==========
      doc.addPage()
      doc.setFillColor(...C.dark)
      doc.rect(0, 0, W, H, 'F')

      doc.setFillColor(...C.accent)
      doc.rect(0, 0, W, 0.8, 'F')

      doc.setFontSize(18)
      doc.setTextColor(...C.white)
      doc.text('Gracias', W / 2, H / 2 - 8, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(...C.muted)
      doc.text(`${photos.length} fotos  ·  Score promedio: ${avgScore.toFixed(1)}/10`, W / 2, H / 2 + 4, { align: 'center' })

      doc.setFontSize(8)
      doc.setTextColor(...C.dim)
      doc.text(`Generado con PhotoAnalyzer  ·  ${dateStr}`, W / 2, H / 2 + 14, { align: 'center' })

      doc.setFillColor(...C.accent)
      doc.rect(0, H - 0.8, W, 0.8, 'F')

      doc.save(`portfolio-${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast(`PDF generado con ${photos.length} fotos`)
    } catch (e) {
      showToast('Error generando PDF: ' + e.message, true)
    } finally {
      setExporting(false)
    }
  }

  if (!photos.length) return null

  return (
    <button className="small-btn portfolio-btn" onClick={handleExport} disabled={exporting}>
      {exporting ? 'Generando...' : `PDF Portfolio (${photos.length})`}
    </button>
  )
}
