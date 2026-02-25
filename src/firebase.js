// ==========================================
// Firebase + Firestore Real-Time + Auth
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
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyC4TukkPAPm3zemEQw_v297HgmUN70zYt8",
  authDomain: "photo-analyzer-agent.firebaseapp.com",
  projectId: "photo-analyzer-agent",
  storageBucket: "photo-analyzer-agent.firebasestorage.app",
  messagingSenderId: "81488981381",
  appId: "1:81488981381:web:ef361bece06968a66ae8ec"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

// ==========================================
// Correos autorizados (whitelist)
// ==========================================
const ALLOWED_EMAILS = [
  'darkside.dx@gmail.com',
  'zachriel@gmail.com',
]

/**
 * Verifica si un email está autorizado.
 */
export function isEmailAllowed(email) {
  return ALLOWED_EMAILS.includes(email?.toLowerCase())
}

/**
 * Inicia sesión con Google.
 * Retorna el user si está autorizado, o lanza error.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  const user = result.user

  if (!isEmailAllowed(user.email)) {
    await signOut(auth)
    throw new Error('NOT_AUTHORIZED')
  }

  return user
}

/**
 * Cierra sesión.
 */
export async function logOut() {
  return signOut(auth)
}

/**
 * Escucha cambios de estado de autenticación.
 * callback(user) - user es null si no hay sesión.
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user && !isEmailAllowed(user.email)) {
      signOut(auth)
      callback(null)
    } else {
      callback(user)
    }
  })
}

/**
 * Obtiene el token JWT del usuario actual (para Cloud Run).
 */
export async function getIdToken() {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

// ==========================================
// Firestore listeners
// ==========================================

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

export async function getPhotoDetail(filename) {
  const docRef = doc(db, 'photos', filename)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { ...docSnap.data(), filename: docSnap.id }
  }
  return null
}

// ==========================================
// Coaching - Firestore persistence
// ==========================================

/**
 * Escucha cambios en el documento de coaching en real-time.
 * callback(data) - data es null si no existe.
 */
export function subscribeCoaching(callback) {
  const docRef = doc(db, 'coaching', 'latest')
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      console.log('[Firestore] Coaching loaded from Firestore')
      callback(snap.data())
    } else {
      callback(null)
    }
  }, (error) => {
    console.error('[Firestore] Error en coaching listener:', error)
    callback(null)
  })
}

/**
 * Guarda el resultado del coaching en Firestore.
 */
export async function saveCoaching(data) {
  const docRef = doc(db, 'coaching', 'latest')
  await setDoc(docRef, {
    ...data,
    generatedAt: serverTimestamp(),
  })
  console.log('[Firestore] Coaching saved to Firestore')
}

export { db, auth }