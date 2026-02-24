import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts'
import * as api from './api'

const COLORS = {
  accent: '#6c8cff',
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#f87171',
  orange: '#fb923c',
  purple: '#a78bfa',
  pink: '#f472b6',
  cyan: '#22d3ee',
  surface: '#141418',
  surface2: '#1c1c22',
  border: '#26262e',
  text: '#e8e8ed',
  text2: '#8888a0',
  text3: '#55556a',
}

const CAT_COLORS = {
  paisajes: COLORS.green,
  mascotas: COLORS.yellow,
  arquitectura: COLORS.purple,
  personas: COLORS.pink,
  comida: COLORS.orange,
  otras: COLORS.text3,
}

const CAT_ICONS = { paisajes: '🏔️', mascotas: '🐾', arquitectura: '🏛️', personas: '👤', comida: '🍽️', otras: '📁' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: '10px 14px', fontSize: '0.8em',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: COLORS.text2, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || COLORS.text, fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await api.fetchAnalytics()
        setData(result)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="analytics-loading">
      <div className="spinner-ring" />
      <span>Cargando analytics...</span>
    </div>
  )

  if (error) return (
    <div className="analytics-error">
      <span>⚠️ Error: {error}</span>
    </div>
  )

  if (!data || !data.total) return (
    <div className="analytics-empty">
      <div style={{ fontSize: '3em', marginBottom: 12 }}>📊</div>
      <p>No hay suficientes datos para mostrar analytics</p>
      <p style={{ color: COLORS.text3, fontSize: '0.85em' }}>Analiza algunas fotos primero</p>
    </div>
  )

  // Prepare chart data
  const distData = Object.entries(data.distribution).map(([range, count]) => ({
    range, count,
    fill: range === '9-10' ? COLORS.green : range === '8-9' ? COLORS.green :
          range === '7-8' ? COLORS.accent : range === '5-7' ? COLORS.yellow :
          range === '3-5' ? COLORS.orange : COLORS.red
  }))

  const catData = data.categories.map(c => ({
    ...c,
    fill: CAT_COLORS[c.category] || COLORS.text3,
  }))

  const pieData = data.categories.map(c => ({
    name: c.category,
    value: c.count,
    fill: CAT_COLORS[c.category] || COLORS.text3,
  }))

  const timelineData = data.timeline || []

  return (
    <div className="analytics">
      {/* KPI CARDS */}
      <div className="analytics-kpis">
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: COLORS.accent }}>{data.total}</div>
          <div className="kpi-label">Fotos analizadas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{data.avg_score}</div>
          <div className="kpi-label">Score promedio</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{
              width: `${(data.avg_score / 10) * 100}%`,
              background: data.avg_score >= 7 ? COLORS.green : data.avg_score >= 5 ? COLORS.yellow : COLORS.red
            }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: COLORS.green }}>{data.best_score}</div>
          <div className="kpi-label">Mejor score</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: COLORS.yellow }}>{data.bestOf_count}</div>
          <div className="kpi-label">Best of ({data.bestOf_rate}%)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{data.median_score}</div>
          <div className="kpi-label">Mediana</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: COLORS.red }}>{data.worst_score}</div>
          <div className="kpi-label">Peor score</div>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="analytics-row">
        {/* Score Distribution */}
        <div className="chart-card wide">
          <h3 className="chart-title">📊 Distribución de Scores</h3>
          <p className="chart-sub">¿Cómo se distribuyen tus fotos por calidad?</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="range" tick={{ fill: COLORS.text2, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: COLORS.text3, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Fotos" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {distData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie */}
        <div className="chart-card">
          <h3 className="chart-title">📂 Por Categoría</h3>
          <p className="chart-sub">Distribución de fotos</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                paddingAngle={3} strokeWidth={0}
              >
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {pieData.map((p, i) => (
              <div key={i} className="pie-legend-item">
                <span className="pie-dot" style={{ background: p.fill }} />
                <span>{CAT_ICONS[p.name]} {p.name}</span>
                <span className="pie-count">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div className="analytics-row">
        <div className="chart-card full">
          <h3 className="chart-title">📈 Evolución Temporal</h3>
          <p className="chart-sub">Score individual y promedio móvil (5 fotos)</p>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="filename" tick={false} axisLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: COLORS.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{
                    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, padding: '10px 14px', fontSize: '0.8em',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{ color: COLORS.text2, fontFamily: 'JetBrains Mono', marginBottom: 4 }}>{d?.filename}</div>
                    <div style={{ color: COLORS.text3, marginBottom: 2 }}>{d?.category}</div>
                    <div style={{ color: COLORS.accent }}>Score: <b>{d?.score}</b></div>
                    <div style={{ color: COLORS.green }}>Promedio: <b>{d?.avg}</b></div>
                  </div>
                )
              }} />
              <Area type="monotone" dataKey="score" stroke={COLORS.accent} fill="url(#scoreGrad)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="avg" stroke={COLORS.green} strokeWidth={2.5} dot={false} strokeDasharray="" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CATEGORY COMPARISON */}
      <div className="analytics-row">
        <div className="chart-card full">
          <h3 className="chart-title">🏆 Score Promedio por Categoría</h3>
          <p className="chart-sub">¿En qué categoría eres mejor fotógrafo?</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: COLORS.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fill: COLORS.text2, fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{
                    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, padding: '10px 14px', fontSize: '0.8em',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{ color: COLORS.text2 }}>{CAT_ICONS[d?.category]} {d?.category}</div>
                    <div style={{ color: COLORS.text }}>Promedio: <b>{d?.avg}</b></div>
                    <div style={{ color: COLORS.text3 }}>{d?.count} fotos · {d?.bestOf} best of</div>
                  </div>
                )
              }} />
              <Bar dataKey="avg" name="Promedio" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {catData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TOP & BOTTOM + TAGS */}
      <div className="analytics-row three-col">
        {/* Top 5 */}
        <div className="chart-card">
          <h3 className="chart-title">🌟 Top 5 Fotos</h3>
          <div className="rank-list">
            {data.top5.map((p, i) => (
              <div key={i} className="rank-item">
                <span className="rank-pos" style={{ color: i === 0 ? COLORS.yellow : COLORS.text3 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <div className="rank-info">
                  <span className="rank-name">{p.filename}</span>
                  <span className="rank-cat">{CAT_ICONS[p.category]} {p.category}</span>
                </div>
                <span className="rank-score" style={{ color: COLORS.green }}>{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom 5 */}
        <div className="chart-card">
          <h3 className="chart-title">📉 Bottom 5 Fotos</h3>
          <div className="rank-list">
            {data.bottom5.map((p, i) => (
              <div key={i} className="rank-item">
                <span className="rank-pos" style={{ color: COLORS.text3 }}>#{data.total - i}</span>
                <div className="rank-info">
                  <span className="rank-name">{p.filename}</span>
                  <span className="rank-cat">{CAT_ICONS[p.category]} {p.category}</span>
                </div>
                <span className="rank-score" style={{ color: COLORS.red }}>{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="chart-card">
          <h3 className="chart-title">🏷️ Tags Frecuentes</h3>
          <div className="tags-cloud">
            {data.top_tags.map((t, i) => (
              <span key={i} className="analytics-tag" style={{
                fontSize: `${Math.max(0.7, Math.min(1.1, 0.6 + t.count * 0.08))}em`,
                opacity: Math.max(0.5, 1 - i * 0.04),
              }}>
                #{t.tag} <sup>{t.count}</sup>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
