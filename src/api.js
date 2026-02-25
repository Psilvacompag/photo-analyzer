// ==========================================
// API Client - Cloud Run (Mutations Only)
// ==========================================
// Reads: Firebase SDK directo a Firestore
// Writes: Cloud Run API (review, discard, delete, coaching, analytics)
// ==========================================

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://photo-analyzer-agent-81488981381.southamerica-east1.run.app'
const API_KEY =
  import.meta.env.VITE_API_KEY || 'd9aLhZ5SogBEZyse8rnTDrSSJWKqc3mv5OWbk1VpxsY'

// ===== HTTP helpers =====

async function cloudRunGet(endpoint, params = {}, retries = 1) {
  const url = new URL(`${BACKEND_URL}${endpoint}`)
  url.searchParams.set('key', API_KEY)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  })
  const response = await fetch(url.toString())
  if (response.status === 503 && retries > 0) {
    await new Promise(r => setTimeout(r, 1500))
    return cloudRunGet(endpoint, params, retries - 1)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.detail || 'Error del servidor')
  return data.data
}

async function cloudRunPost(endpoint, body = {}, retries = 1) {
  const url = new URL(`${BACKEND_URL}${endpoint}`)
  url.searchParams.set('key', API_KEY)
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 503 && retries > 0) {
    await new Promise(r => setTimeout(r, 1500))
    return cloudRunPost(endpoint, body, retries - 1)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.detail || 'Error del servidor')
  return data.data
}

// ===== Mutations (Cloud Run) =====

export async function reviewPhoto(filename) {
  return cloudRunPost('/api/review', { filename })
}

export async function discardPhotos(filenames) {
  return cloudRunPost('/api/discard', { filenames })
}

export async function deletePhotos(filenames) {
  return cloudRunPost('/api/delete', { filenames })
}

// ===== Aggregations (Cloud Run) =====

export async function fetchAnalytics() {
  return cloudRunGet('/api/analytics')
}

export async function fetchCoaching() {
  return cloudRunGet('/api/coaching')
}

// ===== URL Helpers =====

/**
 * URL del thumbnail (GCS directo, ya viene en el doc de Firestore)
 */
export function getThumbUrl(photo) {
  return photo.thumbUrl || photo.originalUrl || ''
}

/**
 * URL alta resolución para lightbox (original de GCS)
 */
export function getHighResUrl(photo) {
  return photo.originalUrl || photo.thumbUrl || ''
}

/**
 * URL de descarga del RAW
 */
export function getRawDownloadUrl(photo) {
  return photo.rawUrl || ''
}

export function isConfigured() {
  return !!BACKEND_URL
}