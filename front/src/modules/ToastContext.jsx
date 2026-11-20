import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ title, message, type = 'fine', duration = 6000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Fixed top-right notification portal */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-top-4 fade-in duration-200 transition-all ${
              t.type === 'fine'
                ? 'bg-rose-900/95 text-white border-rose-800 shadow-rose-950/20'
                : t.type === 'warning'
                ? 'bg-amber-900/95 text-white border-amber-800 shadow-amber-950/20'
                : 'bg-stone-900/95 text-white border-stone-800 shadow-stone-950/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-200 mb-0.5">
                  Circulation Fine Notice
                </div>
                <div className="font-semibold text-xs leading-snug">
                  {t.title}
                </div>
                {t.message && (
                  <div className="text-[11px] text-stone-200/90 mt-1 leading-relaxed">
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-stone-300 hover:text-white font-bold text-xs p-1 -mr-1 -mt-1 transition-colors"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
