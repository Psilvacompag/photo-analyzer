// ==========================================
// API Client - Cloud Run Backend
// ==========================================
// Conecta con el backend en Cloud Run.
// Fallback a GAS si Cloud Run no está configurado.
// ==========================================

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://photo-analyzer-agent-81488981381.southamerica-east1.run.app';
const API_KEY = import.meta.env.VITE_API_KEY || 'd9aLhZ5SogBEZyse8rnTDrSSJWKqc3mv5OWbk1VpxsY';
const GAS_URL = import.meta.env.VITE_GAS_URL || '';

// Usar Cloud Run si hay URL válida
const useCloudRun = !!BACKEND_URL && !BACKEND_URL.includes('XXXXX');

const CACHE_KEY = 'photoanalyzer_cache';
const CACHE_TS_KEY = 'photoanalyzer_cache_ts';
const CACHE_TTL = 5 * 60 * 1000;

// ===== CACHE =====
export function getCachedData() {
  try {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    const data = localStorage.getItem(CACHE_KEY);
    if (!ts || !data) return null;
    return JSON.parse(data);
  } catch { return null; }
}

export async function fetchAnalytics() {
  return useCloudRun
    ? await cloudRunCall('/api/analytics')
    : await gasCall({ action: 'analytics' });
}

export async function fetchCoaching() {
  return useCloudRun
    ? await cloudRunCall('/api/coaching')
    : await gasCall({ action: 'coaching' });
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
  } catch {}
}

export function isCacheStale() {
  try {
    const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0');
    return Date.now() - ts > CACHE_TTL;
  } catch { return true; }
}

// ===== CLOUD RUN =====
async function cloudRunCall(endpoint, params = {}) {
  const url = new URL(`${BACKEND_URL}${endpoint}`);
  url.searchParams.set('key', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!data.ok) throw new Error(data.detail || 'Error del servidor');
  return data.data;
}

// ===== GAS FALLBACK =====
async function gasCall(params) {
  if (!GAS_URL) return null;
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  const text = await response.text();
  let jsonText = text;

  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];
    else throw new Error('Respuesta inesperada del servidor');
  }

  const data = JSON.parse(jsonText);
  if (!data.ok) throw new Error(data.error || 'Error del servidor');
  return data.data;
}

// ===== ENDPOINTS =====

export async function fetchGalleryData() {
  const data = useCloudRun
    ? await cloudRunCall('/api/data')
    : await gasCall({ action: 'getData' });
  if (data) setCachedData(data);
  return data;
}

export async function fetchPhotoDetail(filename) {
  return useCloudRun
    ? await cloudRunCall('/api/detail', { file: filename })
    : await gasCall({ action: 'detail', file: filename });
}

export async function reviewOnePhoto(filename) {
  return useCloudRun
    ? await cloudRunCall('/api/review', { file: filename })
    : await gasCall({ action: 'reviewOne', file: filename });
}

export async function discardPhotos(filenames) {
  return useCloudRun
    ? await cloudRunCall('/api/discard', { files: filenames.join(',') })
    : await gasCall({ action: 'discard', files: filenames.join(',') });
}

export async function deletePhotos(filenames) {
  return useCloudRun
    ? await cloudRunCall('/api/delete', { files: filenames.join(',') })
    : await gasCall({ action: 'delete', files: filenames.join(',') });
}

// ===== HELPERS =====

export function getDriveThumbUrl(fileId, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function getDriveDownloadUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

export function getReviewDocUrl(reviewId) {
  return `https://docs.google.com/document/d/${reviewId}/edit`;
}

export function isDemoMode() {
  return false;
}

export function isConfigured() {
  return useCloudRun || !!GAS_URL;
}

export function getBackendType() {
  return useCloudRun ? 'cloud-run' : 'gas';
}