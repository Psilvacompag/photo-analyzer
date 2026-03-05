// ==========================================
// API Client - Cloud Run (Mutations Only)
// ==========================================
// Reads: Firebase SDK directo a Firestore
// Writes: Cloud Run API (review, discard, delete, coaching, analytics)
// Auth: Firebase ID token (Bearer)
// ==========================================

import { getIdToken } from './firebase'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://photo-analyzer-agent-81488981381.southamerica-east1.run.app'

// ===== HTTP helpers =====

async function getAuthHeaders() {
  const token = await getIdToken()
  if (!token) throw new Error('No autenticado')
  return { Authorization: `Bearer ${token}` }
}

async function cloudRunGet(endpoint, params = {}, retries = 1) {
  const url = new URL(`${BACKEND_URL}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  })
  const headers = await getAuthHeaders()
  const response = await fetch(url.toString(), { headers })
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
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
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

// ===== Queries (Cloud Run) =====

export async function fetchAnalytics() {
  return cloudRunGet('/api/analytics')
}

export async function fetchCoaching() {
  return cloudRunGet('/api/coaching')
}

export async function checkPhotoExists(filename) {
  return cloudRunGet('/api/check-exists', { file: filename })
}

// ===== Signed URL Cache =====

const SIGNED_URL_TTL = 3.5 * 60 * 60 * 1000 // 3.5 hours in ms
const signedUrlCache = new Map() // path -> { url, expires }

const BUCKET_URL = 'https://storage.googleapis.com/photo-analyzer-storage/'

function extractGcsPath(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith(BUCKET_URL)) return null
  return publicUrl.slice(BUCKET_URL.length)
}

// Pending batch: collect individual requests into a single API call
let _batchQueue = []       // [{ path, resolve }]
let _batchTimer = null
const BATCH_DELAY = 50     // ms to wait before flushing batch

function _flushBatch() {
  const batch = _batchQueue.splice(0)
  _batchTimer = null
  if (batch.length === 0) return

  const now = Date.now()
  const uncached = []
  const cached = []

  for (const item of batch) {
    const c = signedUrlCache.get(item.path)
    if (c && c.expires > now) {
      cached.push(item)
    } else {
      uncached.push(item)
    }
  }

  // Resolve cached immediately
  for (const item of cached) {
    item.resolve(signedUrlCache.get(item.path).url)
  }

  if (uncached.length === 0) return

  // Fetch uncached in one batch call
  const paths = [...new Set(uncached.map(i => i.path))]
  cloudRunPost('/api/signed-urls', { paths }).then(signed => {
    const expires = now + SIGNED_URL_TTL
    for (const [path, url] of Object.entries(signed)) {
      signedUrlCache.set(path, { url, expires })
    }
    for (const item of uncached) {
      const c = signedUrlCache.get(item.path)
      item.resolve(c ? c.url : item.path)
    }
  }).catch(err => {
    console.error('[SignedURL] Batch failed:', err)
    for (const item of uncached) item.resolve(null)
  })
}

/**
 * Resolve a single public GCS URL to a signed URL.
 * Batches requests: calls within 50ms window are grouped into one API call.
 */
export function resolveSignedUrl(publicUrl) {
  const path = extractGcsPath(publicUrl)
  if (!path) return Promise.resolve(publicUrl)

  const now = Date.now()
  const cached = signedUrlCache.get(path)
  if (cached && cached.expires > now) return Promise.resolve(cached.url)

  return new Promise(resolve => {
    _batchQueue.push({ path, resolve })
    if (!_batchTimer) {
      _batchTimer = setTimeout(_flushBatch, BATCH_DELAY)
    }
  })
}

/**
 * Invalidate a signed URL from cache (forces re-sign on next resolve).
 */
export function invalidateSignedUrl(publicUrl) {
  const path = extractGcsPath(publicUrl)
  if (path) signedUrlCache.delete(path)
}

/**
 * Resolves signed URLs for a single photo's originalUrl and rawUrl (on-demand).
 * Called when opening lightbox or downloading.
 */
export async function resolvePhotoUrls(photo) {
  if (!photo) return photo

  const now = Date.now()
  const pathsToSign = []

  for (const key of ['originalUrl', 'rawUrl']) {
    const path = extractGcsPath(photo[key])
    if (!path) continue
    const cached = signedUrlCache.get(path)
    if (cached && cached.expires > now) {
      photo[key] = cached.url
    } else {
      pathsToSign.push({ key, path })
    }
  }

  if (pathsToSign.length > 0) {
    try {
      const signed = await cloudRunPost('/api/signed-urls', { paths: pathsToSign.map(p => p.path) })
      const expires = now + SIGNED_URL_TTL
      for (const { key, path } of pathsToSign) {
        if (signed[path]) {
          signedUrlCache.set(path, { url: signed[path], expires })
          photo[key] = signed[path]
        }
      }
    } catch (err) {
      console.error('[SignedURL] Failed to resolve photo URLs:', err)
    }
  }

  return photo
}

// ===== URL Helpers =====

export function getThumbUrl(photo) {
  return photo.thumbUrl || photo.originalUrl || ''
}

export function getHighResUrl(photo) {
  return photo.originalUrl || photo.thumbUrl || ''
}

export function getRawDownloadUrl(photo) {
  return photo.rawUrl || ''
}

export function isConfigured() {
  return !!BACKEND_URL
}

export async function getSignedUrl(filename, fileType) {
  return cloudRunPost('/api/upload/signed-url', { filename, file_type: fileType })
}

export async function uploadComplete(filename, fileType) {
  return cloudRunPost('/api/upload/complete', { filename, file_type: fileType })
}

// ===== User Management =====

export async function fetchCurrentUser() {
  return cloudRunGet('/api/users/me')
}

export async function fetchUsers() {
  return cloudRunGet('/api/users')
}

export async function addUser(email, role = 'user') {
  return cloudRunPost('/api/users', { email, role })
}

// ===== Sharing =====

export async function fetchShares() {
  return cloudRunGet('/api/shares')
}

export async function shareGallery(email) {
  return cloudRunPost('/api/shares', { email })
}

export async function unshareGallery(email) {
  const url = new URL(`${BACKEND_URL}/api/shares`)
  const headers = await getAuthHeaders()
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.detail || 'Error del servidor')
  return data.data
}

export async function fetchSharedGallery(ownerEmail) {
  return cloudRunGet('/api/shared-gallery', { owner_email: ownerEmail })
}

export async function deleteUser(email) {
  const url = new URL(`${BACKEND_URL}/api/users`)
  const headers = await getAuthHeaders()
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.detail || 'Error del servidor')
  return data.data
}
