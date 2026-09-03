import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, tone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setToasts((items) => [...items, { id, message, tone }]);

    setTimeout(() => {
      setToasts((items) =>
        items.filter((toast) => toast.id !== id)
      );
    }, 4200);
  }, []);

  const value = useMemo(
    () => ({ showToast }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="toast-stack"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            className={`toast ${toast.tone}`}
            key={toast.id}
          >
            <span>{toast.message}</span>

            <button
              className="icon-button"
              onClick={() =>
                setToasts((items) =>
                  items.filter(
                    (item) => item.id !== toast.id
                  )
                )
              }
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}