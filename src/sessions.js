// Session grouping and burst detection utilities

const SESSION_GAP_MS = 2 * 60 * 60 * 1000 // 2 hours

function toDate(val) {
  if (!val) return null
  if (val.toDate) return val.toDate() // Firestore Timestamp
  if (val.seconds) return new Date(val.seconds * 1000) // Firestore-like object
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Groups photos into sessions based on uploadedAt timestamps.
 * A gap > 2h between consecutive photos starts a new session.
 * @param {Array} photos - Array of photo objects with uploadedAt
 * @returns {Array<{date: string, photos: Array, avgScore: number, startTime: Date}>}
 */
export function groupIntoSessions(photos) {
  if (!photos.length) return []

  const sorted = [...photos].sort((a, b) => {
    const da = toDate(a.uploadedAt)
    const db = toDate(b.uploadedAt)
    const ta = da ? da.getTime() : 0
    const tb = db ? db.getTime() : 0
    return ta - tb
  })

  const sessions = []
  let current = { photos: [sorted[0]], startTime: null }

  const getTime = (p) => { const d = toDate(p.uploadedAt); return d ? d.getTime() : 0 }
  current.startTime = getTime(sorted[0])

  for (let i = 1; i < sorted.length; i++) {
    const prev = getTime(sorted[i - 1])
    const curr = getTime(sorted[i])

    if (prev && curr && (curr - prev) > SESSION_GAP_MS) {
      sessions.push(current)
      current = { photos: [sorted[i]], startTime: curr }
    } else {
      current.photos.push(sorted[i])
    }
  }
  sessions.push(current)

  return sessions.map(s => {
    const scores = s.photos.filter(p => p.score > 0).map(p => p.score)
    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0

    const startDate = s.startTime ? new Date(s.startTime) : null
    const date = startDate
      ? startDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Sin fecha'

    return { date, photos: s.photos, avgScore, startTime: startDate }
  })
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
