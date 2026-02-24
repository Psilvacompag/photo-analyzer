import { useState, useEffect } from 'react'
import * as api from './api'

const STRENGTH_ICONS = ['💪', '🎯', '✨', '🔥', '⭐']
const WEAKNESS_ICONS = ['🔧', '📐', '💡', '🎨', '📷']

const COACHING_CACHE_KEY = 'photoanalyzer_coaching'

export default function Coaching({ data, setData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load from localStorage on mount
// Load from localStorage on mount
  useEffect(() => {
    if (!data) {
      try {
        const cached = localStorage.getItem(COACHING_CACHE_KEY)
        if (cached) setData(JSON.parse(cached))
      } catch {}
    }
  }, [])
  async function loadCoaching() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.fetchCoaching()
      setData(result)
      localStorage.setItem(COACHING_CACHE_KEY, JSON.stringify(result))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Not loaded yet - show CTA
  if (!data && !loading && !error) {
    return (
      <div className="coaching">
        <div className="coaching-cta">
          <div className="coaching-cta-icon">🤖</div>
          <h2 className="coaching-cta-title">AI Photo Coach</h2>
          <p className="coaching-cta-desc">
            Gemini analiza todas tus fotos, detecta patrones, identifica fortalezas y debilidades, 
            y genera un plan de mejora personalizado.
          </p>
          <button className="coaching-cta-btn" onClick={loadCoaching}>
            <span className="coaching-cta-btn-icon">🧠</span>
            Obtener Coaching Personalizado
          </button>
          <p className="coaching-cta-note">Toma ~10 segundos · Usa Gemini 3 Flash</p>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="coaching">
        <div className="coaching-loading">
          <div className="coaching-loading-brain">🧠</div>
          <div className="coaching-loading-ring" />
          <p className="coaching-loading-text">Analizando tu portfolio completo...</p>
          <p className="coaching-loading-sub">Gemini está revisando patrones en todas tus fotos</p>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="coaching">
        <div className="coaching-error">
          <span>⚠️ Error: {error}</span>
          <button className="coaching-retry-btn" onClick={loadCoaching}>Reintentar</button>
        </div>
      </div>
    )
  }

  // Results
  return (
    <div className="coaching">
      {/* Header */}
      <div className="coaching-header">
        <div className="coaching-header-left">
          <h2 className="coaching-main-title">🤖 AI Photo Coaching</h2>
          <p className="coaching-main-sub">Análisis personalizado basado en tus {data.fortalezas?.length + data.debilidades?.length || 0}+ patrones detectados</p>
        </div>
        <button className="coaching-refresh-btn" onClick={loadCoaching}>
          🔄 Regenerar
        </button>
      </div>

      {/* Resumen */}
      <div className="coaching-card coaching-resumen">
        <div className="coaching-resumen-icon">📋</div>
        <div>
          <h3>Tu Nivel Actual</h3>
          <p>{data.resumen_nivel}</p>
        </div>
      </div>

      {/* Fortalezas & Debilidades */}
      <div className="coaching-grid">
        <div className="coaching-card">
          <h3 className="coaching-section-title good">💪 Fortalezas</h3>
          <div className="coaching-items">
            {(data.fortalezas || []).map((f, i) => (
              <div key={i} className="coaching-item strength">
                <div className="coaching-item-header">
                  <span className="coaching-item-icon">{STRENGTH_ICONS[i] || '✨'}</span>
                  <h4>{f.titulo}</h4>
                </div>
                <p className="coaching-item-detail">{f.detalle}</p>
                {f.fotos_ejemplo && (
                  <div className="coaching-item-photos">
                    <span className="coaching-photos-label">📷</span>
                    <span>{f.fotos_ejemplo}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="coaching-card">
          <h3 className="coaching-section-title warn">🔧 A Mejorar</h3>
          <div className="coaching-items">
            {(data.debilidades || []).map((d, i) => (
              <div key={i} className="coaching-item weakness">
                <div className="coaching-item-header">
                  <span className="coaching-item-icon">{WEAKNESS_ICONS[i] || '📷'}</span>
                  <h4>{d.titulo}</h4>
                </div>
                <p className="coaching-item-detail">{d.detalle}</p>
                {d.fotos_ejemplo && (
                  <div className="coaching-item-photos">
                    <span className="coaching-photos-label">📷</span>
                    <span>{d.fotos_ejemplo}</span>
                  </div>
                )}
                {d.como_mejorar && (
                  <div className="coaching-item-fix">
                    <span className="coaching-fix-label">💡 Cómo mejorar:</span>
                    <span>{d.como_mejorar}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patron de errores */}
      {data.patron_errores && (
        <div className="coaching-card coaching-pattern">
          <h3 className="coaching-section-title accent">🔍 Patrón de Errores Recurrentes</h3>
          <p>{data.patron_errores}</p>
        </div>
      )}

      {/* Mision semanal */}
      {data.mision_semanal && (
        <div className="coaching-card coaching-mission">
          <div className="coaching-mission-badge">MISIÓN SEMANAL</div>
          <h3 className="coaching-mission-title">🎯 {data.mision_semanal.titulo}</h3>
          <p className="coaching-mission-desc">{data.mision_semanal.descripcion}</p>
          <div className="coaching-mission-grid">
            <div className="coaching-mission-block">
              <span className="coaching-mission-label">📋 Ejercicio</span>
              <p>{data.mision_semanal.ejercicio}</p>
            </div>
            <div className="coaching-mission-block">
              <span className="coaching-mission-label">⚙️ Settings Sugeridos</span>
              <p>{data.mision_semanal.settings_sugeridos}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sweet spot + Proximo objetivo */}
      <div className="coaching-grid">
        {data.sweet_spot && (
          <div className="coaching-card coaching-sweetspot">
            <h3 className="coaching-section-title green">🎯 Tu Sweet Spot</h3>
            <p>{data.sweet_spot}</p>
          </div>
        )}
        {data.proximo_objetivo && (
          <div className="coaching-card coaching-next">
            <h3 className="coaching-section-title purple">🚀 Próximo Objetivo</h3>
            <p>{data.proximo_objetivo}</p>
          </div>
        )}
      </div>
    </div>
  )
}
