// ==========================================
// Conexión con el backend de Google Apps Script
// ==========================================

// Pegá acá tu URL de deployment de GAS (la que termina en /exec)
const GAS_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbw3AwTjAGw0UqrEoMJzBASqHr4-Soj3tCwHZ8t8WfUTe59jPhVvTzKSz0ROtO32O6H_/exec';

// GAS redirige (302) a script.googleusercontent.com que sí tiene CORS headers
async function gasRequest(params) {
  if (!GAS_URL) {
    console.warn('GAS_URL no configurada, usando datos de demo');
    return null;
  }

  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), { redirect: 'follow' });
  
  // GAS returns redirected HTML sometimes, we need the final JSON
  const text = await response.text();
  
  try {
    const data = JSON.parse(text);
    if (!data.ok) throw new Error(data.error || 'Error del servidor');
    return data.data;
  } catch (e) {
    // GAS might return HTML on first redirect, try to extract JSON
    console.error('Error parsing GAS response:', text.substring(0, 200));
    throw new Error('Error de comunicación con el servidor');
  }
}

export async function fetchGalleryData() {
  return await gasRequest({ action: 'getData' });
}

export async function reviewOnePhoto(filename) {
  return await gasRequest({ action: 'reviewOne', file: filename });
}

export async function discardPhotos(filenames) {
  return await gasRequest({ action: 'discard', files: filenames.join(',') });
}

export async function deletePhotos(filenames) {
  return await gasRequest({ action: 'delete', files: filenames.join(',') });
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
