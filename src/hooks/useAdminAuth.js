import { useEffect, useState, useMemo } from 'react'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

export const useAdminAuth = () => {
  const ALLOWED_EMAILS = ['jethrosiloe26@gmail.com', 'anqnmes@gmail.com', 'jzamnacc@gmail.com']
  const [user, setUser] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  const isAllowedEmail = (email) =>
    Boolean(email) &&
    ALLOWED_EMAILS.map((item) => item.toLowerCase()).includes(email.toLowerCase())

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !isAllowedEmail(currentUser.email)) {
        setError('Tu cuenta no tiene acceso al panel.')
        signOut(auth)
        setUser(null)
        setIsAuthReady(true)
        return
      }

      setUser(currentUser)
      setIsAuthReady(true)
    })
    return () => unsubscribe()
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
      if (!isAllowedEmail(result.user?.email)) {
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
