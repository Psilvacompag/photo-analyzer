import { useState } from 'react'
import * as api from './api'

export default function PortfolioExport({ photos, showToast }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (exporting || !photos.length) return
    setExporting(true)
    showToast('Generando PDF...')

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      // Title page
      doc.setFontSize(32)
      doc.setTextColor(40, 40, 60)
      doc.text('Portfolio', pageW / 2, pageH / 2 - 15, { align: 'center' })
      doc.setFontSize(14)
      doc.setTextColor(120, 120, 140)
      doc.text('PhotoAnalyzer — Best Of', pageW / 2, pageH / 2 + 5, { align: 'center' })
      doc.setFontSize(10)
      doc.text(new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }), pageW / 2, pageH / 2 + 15, { align: 'center' })

      let done = 0
      for (const photo of photos) {
        doc.addPage()
        done++
        showToast(`Generando PDF... ${done}/${photos.length}`)

        // Try to load thumbnail image
        try {
          const thumbUrl = api.getThumbUrl(photo)
          const resp = await fetch(thumbUrl)
          if (resp.ok) {
            const blob = await resp.blob()
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result)
              reader.readAsDataURL(blob)
            })

            const imgMaxW = pageW - 40
            const imgMaxH = pageH - 60
            // Place image centered
            const imgW = Math.min(imgMaxW, 180)
            const imgH = imgW * 0.667
            const imgX = (pageW - imgW) / 2
            doc.addImage(dataUrl, 'JPEG', imgX, 15, imgW, Math.min(imgH, imgMaxH))
          }
        } catch (e) {
          // Skip image on error
        }

        // Info below image
        const textY = pageH - 35
        doc.setFontSize(11)
        doc.setTextColor(40, 40, 60)
        doc.text(photo.filename, 20, textY)

        if (photo.score > 0) {
          doc.setFontSize(16)
          doc.setTextColor(108, 140, 255)
          doc.text(`${photo.score.toFixed(1)}/10`, pageW - 20, textY, { align: 'right' })
        }

        if (photo.category) {
          doc.setFontSize(9)
          doc.setTextColor(120, 120, 140)
          doc.text(photo.category, 20, textY + 7)
        }

        if (photo.resumen) {
          doc.setFontSize(8)
          doc.setTextColor(90, 90, 110)
          const lines = doc.splitTextToSize(photo.resumen, pageW - 40)
          doc.text(lines.slice(0, 2), 20, textY + 14)
        }
      }

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
