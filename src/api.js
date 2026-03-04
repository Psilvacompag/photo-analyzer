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
