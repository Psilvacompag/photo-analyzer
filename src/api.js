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

/**
 * Resolves signed URLs for an array of photo objects.
 * Mutates thumbUrl/originalUrl/rawUrl in-place and returns the array.
 * Batches uncached paths into a single API call.
 */
export async function resolveSignedUrls(photos) {
  if (!photos || photos.length === 0) return photos

  const now = Date.now()
  const uncachedPaths = new Set()

  // Collect all GCS paths that need signing
  for (const photo of photos) {
    for (const key of ['thumbUrl', 'originalUrl', 'rawUrl']) {
      const path = extractGcsPath(photo[key])
      if (!path) continue
      const cached = signedUrlCache.get(path)
      if (!cached || cached.expires < now) {
        uncachedPaths.add(path)
      }
    }
  }

  // Fetch missing signed URLs in one batch
  if (uncachedPaths.size > 0) {
    try {
      const paths = [...uncachedPaths]
      // Split into chunks of 200
      for (let i = 0; i < paths.length; i += 200) {
        const chunk = paths.slice(i, i + 200)
        const signed = await cloudRunPost('/api/signed-urls', { paths: chunk })
        const expires = now + SIGNED_URL_TTL
        for (const [path, url] of Object.entries(signed)) {
          signedUrlCache.set(path, { url, expires })
        }
      }
    } catch (err) {
      console.error('[SignedURL] Failed to fetch signed URLs:', err)
      return photos // Return with original URLs as fallback
    }
  }

  // Replace URLs with cached signed versions
  for (const photo of photos) {
    for (const key of ['thumbUrl', 'originalUrl', 'rawUrl']) {
      const path = extractGcsPath(photo[key])
      if (!path) continue
      const cached = signedUrlCache.get(path)
      if (cached && cached.expires > now) {
        photo[key] = cached.url
      }
    }
  }

  return photos
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
