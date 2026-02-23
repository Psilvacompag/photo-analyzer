// ==========================================
// Conexión con el backend de Google Apps Script
// ==========================================

const GAS_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbw3AwTjAGw0UqrEoMJzBASqHr4-Soj3tCwHZ8t8WfUTe59jPhVvTzKSz0ROtO32O6H_/exec';

const CACHE_KEY = 'photoanalyzer_cache';
const CACHE_TS_KEY = 'photoanalyzer_cache_ts';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ===== CACHE =====
export function getCachedData() {
  try {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    const data = localStorage.getItem(CACHE_KEY);
    if (!ts || !data) return null;
    return JSON.parse(data);
  } catch { return null; }
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

// ===== GAS API =====
async function gasGet(params) {
  if (!GAS_URL) return null;

  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  const text = await response.text();
  let jsonText = text;

  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];
    else throw new Error('Respuesta inesperada del servidor');
  }

  try {
    const data = JSON.parse(jsonText);
    if (!data.ok) throw new Error(data.error || 'Error del servidor');
    return data.data;
  } catch (e) {
    if (e.message.includes('Error del servidor')) throw e;
    console.error('GAS response:', text.substring(0, 300));
    throw new Error('Error de comunicación con GAS');
  }
}

export async function fetchGalleryData() {
  const data = await gasGet({ action: 'getData' });
  if (data) setCachedData(data);
  return data;
}

export async function fetchPhotoDetail(filename) {
  return await gasGet({ action: 'detail', file: filename });
}

export async function reviewOnePhoto(filename) {
  return await gasGet({ action: 'reviewOne', file: filename });
}

export async function discardPhotos(filenames) {
  return await gasGet({ action: 'discard', files: filenames.join(',') });
}

export async function deletePhotos(filenames) {
  return await gasGet({ action: 'delete', files: filenames.join(',') });
}

export function getDriveThumbUrl(fileId, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function getDriveDownloadUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

export function getReviewDocUrl(reviewId) {
  return `https://docs.google.com/document/d/${reviewId}/edit`;
}

export function isConfigured() {
  return !!GAS_URL;
}
