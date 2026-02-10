"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  isActive?: boolean | null;
  compact?: boolean;
};

export default function EventActions({ id, isActive, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    const confirmDelete = window.confirm("¿Eliminar este evento? Se borrarán sus códigos asociados.");
    if (!confirmDelete) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/events/delete", {
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

  const onCloseEvent = () => {
    const confirmClose = window.confirm("¿Cerrar este evento? Se desactivarán sus códigos activos.");
    if (!confirmClose) return;
    const reason = window.prompt("Motivo de cierre (opcional):", "") || "";
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/events/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo cerrar");
        return;
      }
      router.refresh();
    });
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-end gap-2">
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/events/${encodeURIComponent(id)}/edit`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Editar evento"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Editar evento</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={`/admin/events/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        )}

        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onCloseEvent}
                disabled={pending || isActive === false}
                aria-label="Cerrar evento"
              >
                <Lock className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isActive === false ? "Evento ya cerrado" : "Cerrar evento"}</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={onCloseEvent} disabled={pending || isActive === false}>
            <Lock className="h-4 w-4" />
            Cerrar evento
          </Button>
        )}

        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="danger"
                size="icon"
                onClick={onDelete}
                disabled={pending}
                aria-label="Eliminar evento"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar evento</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" variant="danger" size="sm" onClick={onDelete} disabled={pending}>
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        )}
        {error && <span className="text-xs text-red-200">{error}</span>}
      </div>
    </TooltipProvider>
  );
}
