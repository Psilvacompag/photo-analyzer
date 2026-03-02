import { useState } from 'react'
import * as api from './api'
import './listview.css'

export default function ListView({ photos, selected, onToggle, onView }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = (() => {
    if (!sortCol) return photos
    const arr = [...photos]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortCol === 'filename') return a.filename.localeCompare(b.filename) * dir
      if (sortCol === 'score') return ((a.score || 0) - (b.score || 0)) * dir
      if (sortCol === 'category') return (a.category || '').localeCompare(b.category || '') * dir
      return 0
    })
    return arr
  })()

  const arrow = (col) => {
    if (sortCol !== col) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  return (
    <div className="listview-wrap">
      <table className="listview-table">
        <thead>
          <tr>
            <th className="lv-check-col"></th>
            <th className="lv-thumb-col"></th>
            <th className="lv-sortable" onClick={() => handleSort('filename')}>
              Archivo{arrow('filename')}
            </th>
            <th className="lv-sortable lv-score-col" onClick={() => handleSort('score')}>
              Score{arrow('score')}
            </th>
            <th className="lv-sortable lv-cat-col" onClick={() => handleSort('category')}>
              Categoria{arrow('category')}
            </th>
            <th className="lv-tags-col">Tags</th>
            <th className="lv-summary-col">Resumen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(photo => {
            const score = photo.score || 0
            const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'
            const isSelected = !!selected[photo.filename]

            return (
              <tr
                key={photo.filename}
                className={`lv-row ${isSelected ? 'lv-selected' : ''}`}
                onClick={() => onToggle(photo.filename)}
              >
                <td className="lv-check-cell">
                  <div className={`lv-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </td>
                <td className="lv-thumb-cell" onClick={e => { e.stopPropagation(); onView(photo) }}>
                  <img src={api.getThumbUrl(photo)} alt="" className="lv-thumb" loading="lazy" />
                </td>
                <td className="lv-filename">{photo.filename}</td>
                <td>
                  <span className={`score-pill ${scoreClass}`}>{score.toFixed(1)}</span>
                </td>
                <td className="lv-category">{photo.category || '—'}</td>
                <td className="lv-tags">
                  {photo.tags
                    ? photo.tags.split(',').slice(0, 3).map(t => t.trim()).join(', ')
                    : '—'}
                </td>
                <td className="lv-summary-text">{photo.resumen || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
