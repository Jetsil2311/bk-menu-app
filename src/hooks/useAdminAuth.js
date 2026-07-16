import { useEffect, useState, useMemo } from 'react'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getDoc, doc } from 'firebase/firestore'
import { auth } from '../firebase'
import { db } from '../firebase'

const checkEmailAuthorized = async (email) => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'))
    const list = snap.exists() && Array.isArray(snap.data().authorizedEmails)
      ? snap.data().authorizedEmails
      : []
    // No list configured → open access (allow any email)
    if (list.length === 0) return true
    return list.map(e => e.toLowerCase()).includes((email || '').toLowerCase())
  } catch {
    // Network error → allow access (fail open; don't lock out admins on bad connection)
    return true
  }
}

export const useAdminAuth = () => {
  const [user, setUser] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const allowed = await checkEmailAuthorized(currentUser.email)
        if (!active) return
        if (!allowed) {
          setError('Tu cuenta no tiene acceso al panel.')
          await signOut(auth)
          if (!active) return
          setUser(null)
          setIsAuthReady(true)
          return
        }
      }
      if (!active) return
      setUser(currentUser)
      setIsAuthReady(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (err) {
      setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const allowed = await checkEmailAuthorized(result.user?.email)
      if (!allowed) {
        setError('Tu cuenta no tiene acceso al panel.')
        await signOut(auth)
      }
    } catch (err) {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  return {
    user,
    isAuthReady,
    email,
    setEmail,
    password,
    setPassword,
    isSubmitting,
    error,
    handleLogin,
    handleGoogleSignIn,
    handleLogout,
    isAuthenticated: Boolean(user),
  }
}
