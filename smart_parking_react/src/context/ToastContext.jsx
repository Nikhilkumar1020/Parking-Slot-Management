import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

let toastId = 0;

const ICONS = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const COLORS = {
  success: 'bg-secondary-container text-on-secondary-container border-secondary/30',
  error: 'bg-error-container text-on-error-container border-error/30',
  warning: 'bg-tertiary-container text-on-tertiary-container border-outline-variant',
  info: 'bg-primary-container text-on-primary-container border-primary/30',
};

const ICON_COLORS = {
  success: 'text-secondary',
  error: 'text-error',
  warning: 'text-[#856404]',
  info: 'text-primary',
};

function ToastItem({ toast, onRemove }) {
  return (
    <div
      className={`flex items-start gap-sm p-md rounded-xl border shadow-lg backdrop-blur-sm animate-[fadeInUp_0.3s_ease] max-w-sm w-full ${COLORS[toast.type]}`}
      style={{ animation: 'fadeInUp 0.3s ease' }}
    >
      <span className={`material-symbols-outlined text-[22px] mt-[2px] flex-shrink-0 ${ICON_COLORS[toast.type]}`} style={{ fontVariationSettings: "'FILL' 1" }}>
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-bold text-body-md leading-tight">{toast.title}</p>}
        <p className="text-body-md leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const toast = {
    success: (message, title) => addToast({ type: 'success', title, message }),
    error: (message, title) => addToast({ type: 'error', title, message }),
    warning: (message, title) => addToast({ type: 'warning', title, message }),
    info: (message, title) => addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-lg right-lg z-[9999] flex flex-col gap-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
