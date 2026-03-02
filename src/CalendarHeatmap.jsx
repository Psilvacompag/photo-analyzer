import { useState, useMemo } from 'react'
import './heatmap.css'

const DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

function getDayKey(date) {
  return date.toISOString().slice(0, 10)
}

export default function CalendarHeatmap({ photos }) {
  const [metric, setMetric] = useState('count') // 'count' | 'score'

  const { grid, maxVal, dayMap } = useMemo(() => {
    // Build day map
    const map = {}
    for (const p of photos) {
      if (!p.uploadedAt) continue
      const d = new Date(p.uploadedAt)
      const key = getDayKey(d)
      if (!map[key]) map[key] = { count: 0, scores: [] }
      map[key].count++
      if (p.score > 0) map[key].scores.push(p.score)
    }

    // Build grid: last 90 days
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today.getTime() - (DAYS - 1) * DAY_MS)

    // Adjust start to Monday
    const startDay = start.getDay()
    const adjustDays = startDay === 0 ? 6 : startDay - 1
    start.setDate(start.getDate() - adjustDays)

    const cells = []
    const d = new Date(start)
    let maxV = 0

    while (d <= today) {
      const key = getDayKey(d)
      const info = map[key]
      let val = 0
      if (info) {
        if (metric === 'count') {
          val = info.count
        } else {
          val = info.scores.length > 0
            ? parseFloat((info.scores.reduce((a, b) => a + b, 0) / info.scores.length).toFixed(1))
            : 0
        }
      }
      if (val > maxV) maxV = val
      cells.push({ date: new Date(d), key, val, info })
      d.setDate(d.getDate() + 1)
    }

    // Organize into weeks (columns)
    const weeks = []
    let currentWeek = []
    for (const cell of cells) {
      const dow = cell.date.getDay()
      const mondayBased = dow === 0 ? 6 : dow - 1
      if (mondayBased === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      currentWeek.push({ ...cell, row: mondayBased })
    }
    if (currentWeek.length > 0) weeks.push(currentWeek)

    return { grid: weeks, maxVal: maxV, dayMap: map }
  }, [photos, metric])

  function getLevel(val) {
    if (val === 0) return 0
    if (maxVal === 0) return 0
    const ratio = val / maxVal
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  }

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-header">
        <h3 className="chart-title">📅 Actividad (90 dias)</h3>
        <div className="heatmap-toggle">
          <button
            className={`heatmap-toggle-btn ${metric === 'count' ? 'active' : ''}`}
            onClick={() => setMetric('count')}
          >Fotos</button>
          <button
            className={`heatmap-toggle-btn ${metric === 'score' ? 'active' : ''}`}
            onClick={() => setMetric('score')}
          >Avg Score</button>
        </div>
      </div>

      <div className="heatmap-grid-wrap">
        <div className="heatmap-day-labels">
          {dayLabels.map((l, i) => (
            <div key={i} className="heatmap-day-label">{i % 2 === 0 ? l : ''}</div>
          ))}
        </div>
        <div className="heatmap-grid">
          {grid.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {Array.from({ length: 7 }).map((_, row) => {
                const cell = week.find(c => c.row === row)
                if (!cell) return <div key={row} className="heatmap-cell empty" />
                const level = getLevel(cell.val)
                const tooltip = `${cell.date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}: ${cell.info ? cell.info.count + ' fotos' : '0 fotos'}${cell.info?.scores.length ? ' · avg ' + (cell.info.scores.reduce((a,b)=>a+b,0)/cell.info.scores.length).toFixed(1) : ''}`
                return (
                  <div
                    key={row}
                    className={`heatmap-cell level-${level}`}
                    title={tooltip}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Menos</span>
        {[0, 1, 2, 3, 4].map(l => (
          <div key={l} className={`heatmap-cell level-${l}`} />
        ))}
        <span className="heatmap-legend-label">Mas</span>
      </div>
    </div>
  )
}
