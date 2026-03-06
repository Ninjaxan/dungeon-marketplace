'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'border-l-[#22c55e]',
  error: 'border-l-[#ef4444]',
  info: 'border-l-[#ffd700]',
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-[#1a1a2e] border border-[#2a2a3e] border-l-4 ${BORDER_COLORS[t.type]} rounded-lg px-4 py-3 text-sm text-[#e8e6f0] shadow-lg animate-[slideIn_0.2s_ease-out]`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
