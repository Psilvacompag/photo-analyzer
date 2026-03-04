import { useState, useEffect } from 'react'
import * as api from './api'
import { subscribeCoaching, saveCoaching } from './firebase'

const STRENGTH_ICONS = ['💪', '🎯', '✨', '🔥', '⭐']
const WEAKNESS_ICONS = ['🔧', '📐', '💡', '🎨', '📷']

export default function Coaching({ userUid }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [initialLoad, setInitialLoad] = useState(true)

  // Real-time listener desde Firestore (per-user via userUid)
  useEffect(() => {
    const unsub = subscribeCoaching(userUid, (coaching) => {
      if (coaching) setData(coaching)
      setInitialLoad(false)
    })
    return unsub
  }, [userUid])

async function loadCoaching() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.fetchCoaching()
      setData(result)              // ← actualiza UI de inmediato
      await saveCoaching(userUid, result)   // persiste en Firestore per-user
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Estado inicial: cargando desde Firestore
  if (initialLoad) {
    return (
      <div className="coaching">
        <div className="coaching-loading">
          <div className="coaching-loading-brain">🧠</div>
          <div className="coaching-loading-ring" />
          <p className="coaching-loading-text">Cargando...</p>
          <p className="coaching-loading-sub">Conectando con Firestore</p>
        </div>
      </div>
    )
  }

  // No hay coaching guardado: mostrar CTA
  if (!data && !loading && !error) {
    return (
      <div className="coaching">
        <div className="coaching-cta">
          <div className="coaching-cta-icon">🤖</div>
          <h2 className="coaching-cta-title">AI Photo Coach</h2>
          <p className="coaching-cta-desc">
            Gemini analiza tus últimas 30 fotos revisadas, detecta patrones recientes,
            identifica fortalezas y debilidades actuales, y genera un plan de mejora personalizado.
          </p>
          <button className="coaching-cta-btn" onClick={loadCoaching}>
            <span className="coaching-cta-btn-icon">🧠</span>
            Obtener Coaching Personalizado
          </button>
          <p className="coaching-cta-note">Toma ~10 segundos · Usa Gemini 2.5 Flash</p>
        </div>
      </div>
    )
  }

  // Generando coaching
  if (loading) {
    return (
      <div className="coaching">
        <div className="coaching-loading">
          <div className="coaching-loading-brain">🧠</div>
          <div className="coaching-loading-ring" />
          <p className="coaching-loading-text">Analizando tus fotos recientes...</p>
          <p className="coaching-loading-sub">Gemini está revisando patrones en tus últimas 30 revisadas</p>
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

  // Coaching cargado: render completo
  return (
    <div className="coaching">
      <div className="coaching-header">
        <div className="coaching-header-left">
          <h2 className="coaching-main-title">🤖 AI Photo Coaching</h2>
          <p className="coaching-main-sub">Basado en tus últimas 30 fotos revisadas</p>
        </div>
        <button className="coaching-refresh-btn" onClick={loadCoaching}>🔄 Regenerar</button>
      </div>

      <div className="coaching-card coaching-resumen">
        <div className="coaching-resumen-icon">📋</div>
        <div>
          <h3>Tu Nivel Actual</h3>
          <p>{data.resumen_nivel}</p>
        </div>
      </div>

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

      {data.patron_errores && (
        <div className="coaching-card coaching-pattern">
          <h3 className="coaching-section-title accent">🔍 Patrón de Errores Recurrentes</h3>
          <p>{data.patron_errores}</p>
        </div>
      )}

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
