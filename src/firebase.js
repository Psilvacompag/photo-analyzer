// ==========================================
// Firebase + Firestore Real-Time + Auth
// Multi-tenant: queries filter by owner
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
import { resolveSignedUrls } from './api'

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
// Correos autorizados (Firestore whitelist)
// ==========================================

/**
 * Verifica si un email está autorizado consultando Firestore.
 * Retorna true/false. Cache implícito via Firestore SDK.
 */
export async function isEmailAllowed(email) {
  if (!email) return false
  try {
    const docRef = doc(db, 'authorized_users', email.toLowerCase())
    const snap = await getDoc(docRef)
    return snap.exists()
  } catch (err) {
    console.error('[Auth] Error checking authorized_users:', err)
    return false
  }
}

/**
 * Inicia sesión con Google.
 * Retorna el user si está autorizado, o lanza error.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  const user = result.user

  const allowed = await isEmailAllowed(user.email)
  if (!allowed) {
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
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const allowed = await isEmailAllowed(user.email)
      if (!allowed) {
        await signOut(auth)
        callback(null)
        return
      }
    }
    callback(user)
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
// Firestore listeners (multi-tenant)
// ==========================================

export function subscribePending(ownerEmail, callback) {
  const constraints = [
    where('status', '==', 'pending'),
    where('owner', '==', ownerEmail),
    orderBy('uploadedAt', 'desc'),
  ]

  const q = query(collection(db, 'photos'), ...constraints)

  return onSnapshot(q, async (snapshot) => {
    const photos = snapshot.docs.map(doc => ({
      ...doc.data(),
      filename: doc.data().filename || doc.id,
      docId: doc.id,
    }))
    console.log(`[Firestore] Pending: ${photos.length} fotos (owner=${ownerEmail})`)
    await resolveSignedUrls(photos)
    callback(photos)
  }, (error) => {
    console.error('[Firestore] Error en pending listener:', error)
    callback([])
  })
}

export function subscribeReviewed(ownerEmail, callback) {
  const constraints = [
    where('status', '==', 'reviewed'),
    where('owner', '==', ownerEmail),
    orderBy('uploadedAt', 'desc'),
  ]

  const q = query(collection(db, 'photos'), ...constraints)

  return onSnapshot(q, async (snapshot) => {
    const photos = snapshot.docs.map(doc => ({
      ...doc.data(),
      filename: doc.data().filename || doc.id,
      docId: doc.id,
    }))
    console.log(`[Firestore] Reviewed: ${photos.length} fotos (owner=${ownerEmail})`)
    await resolveSignedUrls(photos)
    callback(photos)
  }, (error) => {
    console.error('[Firestore] Error en reviewed listener:', error)
    callback([])
  })
}

export async function getPhotoDetail(docId) {
  const docRef = doc(db, 'photos', docId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { ...docSnap.data(), filename: docSnap.data().filename || docSnap.id }
  }
  return null
}

// ==========================================
// Coaching - Firestore persistence (per-user)
// ==========================================

/**
 * Escucha cambios en el documento de coaching en real-time.
 * Uses userUid as doc ID for per-user isolation.
 */
export function subscribeCoaching(userUid, callback) {
  if (!userUid) {
    callback(null)
    return () => {}
  }
  const docRef = doc(db, 'coaching', userUid)
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
 * Uses userUid as doc ID for per-user isolation.
 */
export async function saveCoaching(userUid, data) {
  if (!userUid) return
  const docRef = doc(db, 'coaching', userUid)
  await setDoc(docRef, {
    ...data,
    generatedAt: serverTimestamp(),
  })
  console.log('[Firestore] Coaching saved to Firestore')
}

// ==========================================
// Sharing - Real-time listener
// ==========================================

/**
 * Subscribe to galleries shared with me.
 */
export function subscribeSharedWithMe(email, callback) {
  if (!email) {
    callback([])
    return () => {}
  }
  const q = query(
    collection(db, 'workspace_shares'),
    where('sharedWithEmail', '==', email)
  )
  return onSnapshot(q, (snapshot) => {
    const shares = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }))
    console.log(`[Firestore] Shared with me: ${shares.length}`)
    callback(shares)
  }, (error) => {
    console.error('[Firestore] Error en shared listener:', error)
    callback([])
  })
}

export { db, auth }
