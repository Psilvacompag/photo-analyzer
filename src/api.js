// ==========================================
// API Client - Cloud Run Backend
// ==========================================
// Conecta con el backend en Cloud Run.
// Sin GAS. Paginación. Batch POST.
// ==========================================

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://photo-analyzer-agent-81488981381.southamerica-east1.run.app';
const API_KEY =
  import.meta.env.VITE_API_KEY || 'd9aLhZ5SogBEZyse8rnTDrSSJWKqc3mv5OWbk1VpxsY';

const DEFAULT_PAGE_SIZE = 30;

// ===== CLOUD RUN CALLS =====

async function cloudRunGet(endpoint, params = {}) {
  const url = new URL(`${BACKEND_URL}${endpoint}`);
  url.searchParams.set('key', API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!data.ok) throw new Error(data.detail || 'Error del servidor');
  return data.data;
}

async function cloudRunPost(endpoint, body = {}) {
  const url = new URL(`${BACKEND_URL}${endpoint}`);
  url.searchParams.set('key', API_KEY);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!data.ok) throw new Error(data.detail || 'Error del servidor');
  return data.data;
}

// ===== GALLERY DATA (paginada) =====

export async function fetchGalleryData(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return cloudRunGet('/api/data', { page, page_size: pageSize });
}

export async function fetchMoreReviewed(page, pageSize = DEFAULT_PAGE_SIZE) {
  return cloudRunGet('/api/data', { page, page_size: pageSize, tab: 'reviewed' });
}

// ===== PHOTO DETAIL =====

export async function fetchPhotoDetail(filename) {
  return cloudRunGet('/api/detail', { file: filename });
}

// ===== REVIEW =====

export async function reviewOnePhoto(filename) {
  return cloudRunGet('/api/review', { file: filename });
}

// ===== DISCARD (POST batch) =====

export async function discardPhotos(filenames) {
  return cloudRunPost('/api/discard', { filenames });
}

// ===== DELETE (POST batch) =====

export async function deletePhotos(filenames) {
  return cloudRunPost('/api/delete', { filenames });
}

// ===== ANALYTICS & COACHING =====

export async function fetchAnalytics() {
  return cloudRunGet('/api/analytics');
}

export async function fetchCoaching() {
  return cloudRunGet('/api/coaching');
}

// ===== CACHE INVALIDATION =====

export async function invalidateCache() {
  return cloudRunPost('/api/cache/invalidate');
}

// ===== URL HELPERS =====

/**
 * Retorna la URL del thumbnail.
 * Prioriza thumbUrl de GCS (viene del backend).
 * Fallback a Google Drive thumbnail.
 */
export function getThumbUrl(photo, size = 400) {
  if (photo.thumbUrl) return photo.thumbUrl;
  if (photo.fileId) return `https://drive.google.com/thumbnail?id=${photo.fileId}&sz=w${size}`;
  return '';
}

/**
 * Retorna URL del thumbnail en alta resolución para lightbox.
 */
export function getHighResUrl(photo) {
  // Para lightbox: usar Drive a resolución mayor (GCS thumbs son 400px)
  if (photo.fileId) return `https://drive.google.com/thumbnail?id=${photo.fileId}&sz=w1200`;
  if (photo.thumbUrl) return photo.thumbUrl;
  return '';
}

export function getDriveDownloadUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

export function getReviewDocUrl(reviewId) {
  return `https://docs.google.com/document/d/${reviewId}/edit`;
}

export function isConfigured() {
  return !!BACKEND_URL;
}