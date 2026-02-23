// Demo data - se usa cuando GAS_URL no está configurada
// Esto te permite ver la UI funcionando mientras conectás el backend

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1518173946687-a243ed2a540f?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&h=300&fit=crop',
];

export const DEMO_DATA = {
  pending: [
    { filename: 'DSC00481.JPG', fileId: 'demo1', rawFileId: 'raw1', fecha: '23/2/2026' },
    { filename: 'DSC00480.JPG', fileId: 'demo2', rawFileId: 'raw2', fecha: '23/2/2026' },
    { filename: 'DSC00479.JPG', fileId: 'demo3', rawFileId: '', fecha: '23/2/2026' },
    { filename: 'DSC00478.JPG', fileId: 'demo4', rawFileId: 'raw4', fecha: '22/2/2026' },
    { filename: 'DSC00477.JPG', fileId: 'demo5', rawFileId: 'raw5', fecha: '22/2/2026' },
    { filename: 'DSC00476.JPG', fileId: 'demo6', rawFileId: '', fecha: '22/2/2026' },
    { filename: 'DSC00475.JPG', fileId: 'demo7', rawFileId: 'raw7', fecha: '21/2/2026' },
    { filename: 'DSC00474.JPG', fileId: 'demo8', rawFileId: 'raw8', fecha: '21/2/2026' },
  ],
  reviewed: [
    { filename: 'DSC00407.JPG', score: 8.2, category: 'paisajes', tags: 'montaña, atardecer, cielo, nieve', bestOf: true, resumen: 'Composición excelente con la línea del horizonte bien ubicada.', fileId: 'r1', rawFileId: 'rr1', reviewId: 'doc1', fecha: '22/2/2026' },
    { filename: 'DSC00412.JPG', score: 7.5, category: 'mascotas', tags: 'gato, bokeh, retrato, luz natural', bestOf: true, resumen: 'Buen uso del bokeh para aislar al sujeto.', fileId: 'r2', rawFileId: 'rr2', reviewId: 'doc2', fecha: '22/2/2026' },
    { filename: 'DSC00395.JPG', score: 6.1, category: 'arquitectura', tags: 'edificio, líneas, urbano, geometría', bestOf: false, resumen: 'Las líneas guía son interesantes pero la exposición está sobreexpuesta.', fileId: 'r3', rawFileId: '', reviewId: 'doc3', fecha: '21/2/2026' },
    { filename: 'DSC00388.JPG', score: 4.3, category: 'paisajes', tags: 'playa, agua, horizonte', bestOf: false, resumen: 'Horizonte torcido y composición centrada sin punto de interés.', fileId: 'r4', rawFileId: 'rr4', reviewId: 'doc4', fecha: '21/2/2026' },
    { filename: 'DSC00401.JPG', score: 9.1, category: 'personas', tags: 'retrato, golden hour, expresión, contraste', bestOf: true, resumen: 'Captura magistral de la expresión. Luz dorada increíble.', fileId: 'r5', rawFileId: 'rr5', reviewId: 'doc5', fecha: '20/2/2026' },
    { filename: 'DSC00420.JPG', score: 5.5, category: 'comida', tags: 'plato, cenital, colores', bestOf: false, resumen: 'Composición cenital correcta pero falta profundidad en iluminación.', fileId: 'r6', rawFileId: '', reviewId: 'doc6', fecha: '20/2/2026' },
  ],
};

// En modo demo, usar imágenes de Unsplash como thumbnails
export function getDemoThumbUrl(index) {
  return SAMPLE_IMAGES[index % SAMPLE_IMAGES.length];
}

export function isDemoMode() {
  return !import.meta.env.VITE_GAS_URL;
}
