// Session grouping and burst detection utilities

function toDate(val) {
  if (!val) return null
  if (val.toDate) return val.toDate() // Firestore Timestamp
  if (val.seconds) return new Date(val.seconds * 1000) // Firestore-like object
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function toDayKey(d) {
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : 'none'
}

/**
 * Groups photos by calendar day based on uploadedAt.
 * @param {Array} photos - Array of photo objects with uploadedAt
 * @returns {Array<{date: string, photos: Array, avgScore: number, startTime: Date}>}
 */
export function groupIntoSessions(photos, { sortByScore = false } = {}) {
  if (!photos.length) return []

  // Group by day
  const dayMap = new Map()
  for (const photo of photos) {
    const d = toDate(photo.uploadedAt)
    const key = toDayKey(d)
    if (!dayMap.has(key)) dayMap.set(key, { photos: [], startTime: d })
    dayMap.get(key).photos.push(photo)
  }

  return Array.from(dayMap.values()).map(s => {
    const scores = s.photos.filter(p => p.score > 0).map(p => p.score)
    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0

    const date = s.startTime
      ? s.startTime.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Sin fecha'

    const sortedPhotos = sortByScore
      ? [...s.photos].sort((a, b) => (b.score || 0) - (a.score || 0))
      : [...s.photos].sort((a, b) => {
          const ta = toDate(a.uploadedAt)?.getTime() || 0
          const tb = toDate(b.uploadedAt)?.getTime() || 0
          return tb - ta
        })
    return { date, photos: sortedPhotos, avgScore, startTime: s.startTime }
  }).sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0))
}

/**
 * Detects burst sequences from filenames (e.g. DSC00641, DSC00642, DSC00643).
 * Returns a Map<filename, { burstId, index, total }>
 */
export function detectBursts(photos) {
  const map = new Map()
  if (!photos.length) return map

  // Extract numeric part from filename
  const parsed = photos
    .map(p => {
      const match = p.filename.match(/(\D+)(\d+)/)
      if (!match) return null
      return { filename: p.filename, prefix: match[1], num: parseInt(match[2], 10) }
    })
    .filter(Boolean)
    .sort((a, b) => a.prefix.localeCompare(b.prefix) || a.num - b.num)

  if (!parsed.length) return map

  // Find consecutive sequences (min 2 photos)
  let burstId = 0
  let start = 0

  for (let i = 1; i <= parsed.length; i++) {
    const isConsecutive = i < parsed.length &&
      parsed[i].prefix === parsed[i - 1].prefix &&
      parsed[i].num === parsed[i - 1].num + 1

    if (!isConsecutive) {
      const len = i - start
      if (len >= 2) {
        burstId++
        for (let j = start; j < i; j++) {
          map.set(parsed[j].filename, {
            burstId,
            index: j - start,
            total: len,
          })
        }
      }
      start = i
    }
  }

  return map
}
