// Lightweight toast queue context for transient UI notifications.
import { type ReactNode, createContext, useCallback, useEffect, useMemo, useState } from 'react';

interface Toast {
  id: number;
  message: string;
}

interface ToastApi {
  push: (message: string) => void;
}

export const ToastContext = createContext<ToastApi>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((curr) => [...curr, { id, message }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((curr) => curr.slice(1)), 2000);
    return () => clearTimeout(t);
  }, [toasts]);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-slate-800 text-white text-sm rounded-md px-4 py-2 shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
