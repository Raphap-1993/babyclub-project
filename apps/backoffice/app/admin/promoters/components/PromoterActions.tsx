"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, RotateCcw, TicketPlus } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = { id: string; isActive?: boolean | null; compact?: boolean };

export default function PromoterActions({ id, isActive, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = isActive !== false;

  const onToggleStatus = () => {
    const confirmed = window.confirm(
      active
        ? "¿Desactivar este promotor? No podrá generar códigos ni links nuevos."
        : "¿Reactivar este promotor?",
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/promoters/set-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo actualizar el estado");
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
                href={`/admin/promoters/${encodeURIComponent(id)}/codes`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Ver códigos del promotor"
              >
                <TicketPlus className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              {active ? "Códigos y links" : "Ver historial de códigos"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={`/admin/promoters/${encodeURIComponent(id)}/codes`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <TicketPlus className="h-4 w-4" />
            {active ? "Códigos" : "Historial"}
          </Link>
        )}
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/promoters/${encodeURIComponent(id)}/edit`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Editar promotor"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Editar promotor</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={`/admin/promoters/${encodeURIComponent(id)}/edit`}
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
                onClick={onToggleStatus}
                disabled={pending}
                variant={active ? "danger" : "ghost"}
                size="icon"
                aria-label={active ? "Desactivar promotor" : "Reactivar promotor"}
              >
                {active ? (
                  <Ban className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {active ? "Desactivar promotor" : "Reactivar promotor"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            onClick={onToggleStatus}
            disabled={pending}
            variant={active ? "danger" : "ghost"}
            size="sm"
          >
            {active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {active ? "Desactivar" : "Reactivar"}
          </Button>
        )}
        {error && <span className="text-xs text-red-200">{error}</span>}
      </div>
    </TooltipProvider>
  );
}
