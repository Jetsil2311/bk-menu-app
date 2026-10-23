/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';

const RegisterContext = createContext();

const todayKey = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

export const RegisterProvider = ({ children }) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [initialAmount, setInitialAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isAuthed, setIsAuthed] = useState(false);
  // Today's session id. Re-checked every minute so a POS left open past
  // midnight follows the new day's document (openRegister() always writes
  // to the current day; the listener must watch the same one).
  const [dayKey, setDayKey] = useState(todayKey);

  useEffect(() => {
    const timer = setInterval(() => {
      const key = todayKey();
      setDayKey((prev) => (prev === key ? prev : key));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // register_sessions is admin-only in the Firestore rules, so the listener
  // must start AFTER sign-in. Subscribing before (e.g. at app load, or on the
  // public menu) gets permission-denied, Firestore cancels the listener, and
  // it never recovers — the POS then shows "Caja cerrada" even after the
  // register is opened. Same pattern as StationContext.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthed(!!user);
      if (!user) {
        setIsRegisterOpen(false);
        setInitialAmount(0);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let alive = true;
    let unsub = null;
    setLoading(true);
    unsub = onSnapshot(
      doc(db, 'register_sessions', dayKey),
      (snap) => {
        if (!alive) return;
        if (snap.exists()) {
          const data = snap.data();
          setIsRegisterOpen(!data.isClosed);
          setInitialAmount(data.openingFloat || 0);
        } else {
          setIsRegisterOpen(false);
          setInitialAmount(0);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to register session:", error);
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
      if (unsub) try { unsub(); } catch {}
    };
  }, [isAuthed, dayKey]);

  const openRegister = async (amount) => {
    try {
      await setDoc(doc(db, 'register_sessions', todayKey()), {
        date: todayKey(),
        openingFloat: amount,
        cashSales: 0,
        cardSales: 0,
        loyaltyRedemptions: 0,
        deposits: [],
        withdrawals: [],
        closingCash: null,
        isClosed: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error opening register:", error);
      throw error;
    }
  };

  const closeRegister = async (closingCash = 0) => {
    try {
      await updateDoc(doc(db, 'register_sessions', todayKey()), {
        closingCash,
        isClosed: true,
        closedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error closing register:", error);
      throw error;
    }
  };

  return (
    <RegisterContext.Provider value={{ isRegisterOpen, initialAmount, openRegister, closeRegister, loading }}>
      {children}
    </RegisterContext.Provider>
  );
};

export const useRegisterContext = () => {
  const context = useContext(RegisterContext);
  if (!context) {
    throw new Error('useRegisterContext must be used within a RegisterProvider');
  }
  return context;
};
