// ============================================
// XMP Sidecar Generator for Adobe Lightroom
// ============================================
// Maps Photo Analyzer edicion_raw values to
// Adobe Camera Raw (crs:) namespace properties.
// ============================================

const CRS_MAP = {
  exposicion: 'Exposure2012',
  contraste: 'Contrast2012',
  highlights: 'Highlights2012',
  shadows: 'Shadows2012',
  whites: 'Whites2012',
  blacks: 'Blacks2012',
  temperatura: 'Temperature',
  tinte: 'Tint',
  saturacion: 'Saturation',
  vibrancia: 'Vibrance',
  claridad: 'Clarity2012',
}

function parseSliderValue(raw) {
  if (raw == null) return null
  const str = String(raw).trim()
  const match = str.match(/([+-]?\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

export function generateXMP(filename, edicionRaw) {
  if (!edicionRaw) return null

  const crsEntries = []
  for (const [key, crsName] of Object.entries(CRS_MAP)) {
    const val = parseSliderValue(edicionRaw[key])
    if (val !== null) {
      crsEntries.push(`         crs:${crsName}="${val}"`)
    }
  }

  if (!crsEntries.length) return null

  const crsAttrs = crsEntries.join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmp:CreatorTool="PhotoAnalyzer v3.4"
${crsAttrs}
    crs:Version="15.0"
    crs:ProcessVersion="11.0">
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`
}

export function downloadXMP(filename, edicionRaw) {
  const xml = generateXMP(filename, edicionRaw)
  if (!xml) return false

  const baseName = filename.replace(/\.\w+$/, '')
  const blob = new Blob([xml], { type: 'application/rdf+xml' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}.xmp`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
