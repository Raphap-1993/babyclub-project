"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Pencil, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function TableActions({ id, reserved, compact }: { id: string; reserved?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRelease = () => {
    const confirmed = window.confirm("¿Liberar reservas activas de esta mesa?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/tables/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo liberar");
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    const confirmed = window.confirm("¿Eliminar mesa?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/tables/delete", {
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
      <div className="flex justify-end gap-2">
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/tables/${encodeURIComponent(id)}/edit`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Editar mesa"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Editar mesa</TooltipContent>
          </Tooltip>
        ) : (
          <Link href={`/admin/tables/${encodeURIComponent(id)}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        )}

        {reserved &&
          (compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" onClick={onRelease} disabled={pending} variant="outline" size="icon" aria-label="Liberar mesa">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Liberar reserva activa</TooltipContent>
            </Tooltip>
          ) : (
            <Button type="button" onClick={onRelease} disabled={pending} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" />
              Liberar
            </Button>
          ))}

        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" onClick={onDelete} disabled={pending} variant="danger" size="icon" aria-label="Eliminar mesa">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar mesa</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" onClick={onDelete} disabled={pending} variant="danger" size="sm">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        )}
        {error && <span className="text-xs text-red-200">{error}</span>}
      </div>
    </TooltipProvider>
  );
}
