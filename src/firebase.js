// ==========================================
// Firebase + Firestore Real-Time
// ==========================================

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyC4TukkPAPm3zemEQw_v297HgmUN70zYt8",
  authDomain: "photo-analyzer-agent.firebaseapp.com",
  projectId: "photo-analyzer-agent",
  storageBucket: "photo-analyzer-agent.firebasestorage.app",
  messagingSenderId: "81488981381",
  appId: "1:81488981381:web:ef361bece06968a66ae8ec"
};

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

/**
 * Escucha fotos pendientes en tiempo real.
 * Retorna función unsubscribe.
 */
export function subscribePending(callback) {
  const q = query(
    collection(db, 'photos'),
    where('status', '==', 'pending'),
    orderBy('uploadedAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const photos = snapshot.docs.map(doc => ({
      ...doc.data(),
      filename: doc.id,
    }))
    console.log(`[Firestore] Pending: ${photos.length} fotos`)
    callback(photos)
  }, (error) => {
    console.error('[Firestore] Error en pending listener:', error)
    callback([])
  })
}

/**
 * Escucha fotos revisadas en tiempo real.
 */
export function subscribeReviewed(callback) {
  const q = query(
    collection(db, 'photos'),
    where('status', '==', 'reviewed'),
    orderBy('uploadedAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const photos = snapshot.docs.map(doc => ({
      ...doc.data(),
      filename: doc.id,
    }))
    console.log(`[Firestore] Reviewed: ${photos.length} fotos`)
    callback(photos)
  }, (error) => {
    console.error('[Firestore] Error en reviewed listener:', error)
    callback([])
  })
}

/**
 * Obtiene detalle completo de una foto (one-time read).
 */
export async function getPhotoDetail(filename) {
  const docRef = doc(db, 'photos', filename)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { ...docSnap.data(), filename: docSnap.id }
  }
  return null
}

export { db }