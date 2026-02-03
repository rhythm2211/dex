"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, "success", duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, "error", duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, "info", duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, "warning", duration);
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          icon: CheckCircle,
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          iconColor: "text-emerald-400",
          textColor: "text-emerald-300",
        };
      case "error":
        return {
          icon: AlertCircle,
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          iconColor: "text-red-400",
          textColor: "text-red-300",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          iconColor: "text-yellow-400",
          textColor: "text-yellow-300",
        };
      default:
        return {
          icon: Info,
          bgColor: "bg-indigo-500/10",
          borderColor: "border-indigo-500/30",
          iconColor: "text-indigo-400",
          textColor: "text-indigo-300",
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed top-20 right-6 z-[100] space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const config = getToastConfig(toast.type);
            const Icon = config.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto ${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-lg backdrop-blur-sm min-w-[300px] max-w-md`}
              >
                <div className="flex items-start gap-3">
                  <Icon size={20} className={config.iconColor} />
                  <p className={`flex-1 text-sm font-medium ${config.textColor}`}>
                    {toast.message}
                  </p>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
