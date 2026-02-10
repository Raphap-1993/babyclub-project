"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ReservationActions({ id, status, compact }: { id: string; status?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const currentStatus = (status || "").toLowerCase();

  const updateStatus = (status: "approved" | "rejected" | "pending") => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await authedFetch("/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo actualizar");
        return;
      }
      if (status === "approved") {
        if (data?.emailError) {
          setError(`Reserva aprobada, pero el correo no salió: ${data.emailError}`);
        } else if (data?.emailSent) {
          setInfo("Reserva aprobada y correo enviado al cliente.");
        }
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    const confirmed = window.confirm("¿Eliminar esta reserva?");
    if (!confirmed) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await authedFetch("/api/admin/reservations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo eliminar");
        return;
      }
      router.refresh();
    });
  };

  return (
    <TooltipProvider>
      <div className="relative flex flex-wrap items-center justify-end gap-2">
        {currentStatus !== "approved" &&
          (compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={pending}
                  onClick={() => updateStatus("approved")}
                  className="border-emerald-500/50 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/10"
                  aria-label="Aprobar reserva"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aprobar</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => updateStatus("approved")}
              className="border-emerald-500/50 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/10"
            >
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
          ))}

        {currentStatus !== "rejected" &&
          (compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={pending}
                  onClick={() => updateStatus("rejected")}
                  className="border-red-500/50 text-red-200 hover:border-red-400 hover:bg-red-500/10"
                  aria-label="Rechazar reserva"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rechazar</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => updateStatus("rejected")}
              className="border-red-500/50 text-red-200 hover:border-red-400 hover:bg-red-500/10"
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
          ))}

        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="danger" size="icon" disabled={pending} onClick={handleDelete} aria-label="Eliminar reserva">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" variant="danger" size="sm" disabled={pending} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        )}

        {(error || info) && (
          <span
            className={`absolute -top-5 right-0 max-w-[220px] text-right text-xs leading-tight ${
              error ? "text-red-200" : "text-emerald-200"
            }`}
          >
            {error || info}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
