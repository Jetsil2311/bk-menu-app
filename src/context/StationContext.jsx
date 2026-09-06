/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import { seedStationsIfEmpty } from '../utils/stations'

const StationContext = createContext()

export const StationProvider = ({ children }) => {
  const [isAuthed, setIsAuthed] = useState(false)
  const [stations, setStations] = useState([])
  // In-memory only — a reload re-shows the station selector by design.
  const [selectedStation, setSelectedStation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthed(!!user)
      if (!user) {
        setStations([])
        setSelectedStation(null)
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    let alive = true
    let unsub = null
    setLoading(true)

    seedStationsIfEmpty().catch((error) => {
      console.error('Error seeding stations:', error)
    })

    unsub = onSnapshot(
      collection(db, 'stations'),
      (snap) => {
        if (!alive) return
        setStations(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (error) => {
        console.error('Error listening to stations:', error)
        if (alive) {
          setStations([])
          setLoading(false)
        }
      }
    )

    return () => {
      alive = false
      if (unsub) try { unsub() } catch {}
    }
  }, [isAuthed])

  const selectStation = useCallback((station) => setSelectedStation(station), [])
  const clearStation = useCallback(() => setSelectedStation(null), [])

  const role = selectedStation?.role ?? null

  return (
    <StationContext.Provider value={{ stations, selectedStation, selectStation, clearStation, role, loading }}>
      {children}
    </StationContext.Provider>
  )
}

export const useStationContext = () => {
  const context = useContext(StationContext)
  if (!context) {
    throw new Error('useStationContext must be used within a StationProvider')
  }
  return context
}
