/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const RegisterContext = createContext();

const todayKey = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

export const RegisterProvider = ({ children }) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [initialAmount, setInitialAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'register_sessions', todayKey()),
      (snap) => {
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
        setLoading(false);
      }
    );
    return unsub;
  }, []);

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
