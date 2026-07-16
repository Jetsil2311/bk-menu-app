/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'react';
import { useRegister } from '../../hooks/useRegister';

export const RegisterOverlay = ({ children }) => {
  const { isRegisterOpen, openRegister } = useRegister();
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');

  // Escape closes modal
  useEffect(() => {
    if (!showModal) return
    const handler = (e) => { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showModal])

  const handleOpenRegister = (e) => {
    e.preventDefault();
    const initialAmount = parseFloat(amount) || 0;
    openRegister(initialAmount);
    setShowModal(false);
    setAmount('');
  };

  if (isRegisterOpen) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-white/5 bg-main-900/40 p-12 text-center backdrop-blur-md">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-12 w-12"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </div>

      <h2 className="mb-3 text-3xl font-bold tracking-tight text-light-100">
        Caja Cerrada
      </h2>
      <p className="mb-10 max-w-sm text-lg text-light-200/60">
        Debes abrir la caja con un monto inicial para comenzar a registrar ventas.
      </p>

      <button
        onClick={() => setShowModal(true)}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-main-500 px-10 py-4 text-lg font-bold text-white transition-all hover:bg-main-400 hover:shadow-[0_0_20px_rgba(217,119,6,0.3)] active:scale-95"
      >
        <span className="relative z-10 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 transition-transform group-hover:rotate-12"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Abrir Caja
        </span>
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-main-950/80" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md scale-100 transform overflow-hidden rounded-3xl border border-white/10 bg-main-900 p-8 shadow-2xl transition-all">
            <h3 className="mb-6 text-2xl font-bold text-light-100">Monto Inicial</h3>
            <form onSubmit={handleOpenRegister} className="space-y-6">
              <div className="space-y-2">
                <label className="text-left block text-sm font-medium text-light-200/70">
                  Ingresa el dinero base en caja
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-light-200/40 font-bold">$</span>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-white/10 bg-main-800 px-10 py-4 text-2xl font-bold text-light-100 outline-none transition-all focus:border-main-500/50 focus:ring-4 focus:ring-main-500/10 group-hover:border-white/20"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold text-light-200 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-main-500 px-6 py-4 font-bold text-white transition hover:bg-main-400"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
