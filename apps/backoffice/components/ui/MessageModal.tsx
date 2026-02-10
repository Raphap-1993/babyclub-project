"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

type MessageType = "success" | "error" | "warning" | "info";

type Props = {
  message: string | null;
  type?: MessageType;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
};

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colorMap = {
  success: {
    bg: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500",
    icon: "text-green-500",
    title: "text-green-400",
  },
  error: {
    bg: "from-red-500/20 to-rose-500/20",
    border: "border-red-500",
    icon: "text-red-500",
    title: "text-red-400",
  },
  warning: {
    bg: "from-yellow-500/20 to-orange-500/20",
    border: "border-yellow-500",
    icon: "text-yellow-500",
    title: "text-yellow-400",
  },
  info: {
    bg: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500",
    icon: "text-blue-500",
    title: "text-blue-400",
  },
};

export default function MessageModal({
  message,
  type = "info",
  onClose,
  autoClose = true,
  autoCloseDelay = 3000,
}: Props) {
  useEffect(() => {
    if (message && autoClose && type === "success") {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [message, autoClose, autoCloseDelay, type, onClose]);

  if (!message) return null;

  const Icon = iconMap[type];
  const colors = colorMap[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`relative max-w-md w-full bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl shadow-2xl p-6`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${colors.icon}`}>
            <Icon className="w-8 h-8" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className={`font-bold text-lg ${colors.title} mb-2`}>
              {type === "success" && "¡Éxito!"}
              {type === "error" && "Error"}
              {type === "warning" && "Advertencia"}
              {type === "info" && "Información"}
            </h3>
            <p className="text-white text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        {type !== "success" && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
