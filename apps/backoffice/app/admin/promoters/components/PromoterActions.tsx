"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, TicketPlus, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = { id: string; compact?: boolean };

export default function PromoterActions({ id, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    const confirmed = window.confirm("¿Eliminar promotor?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/promoters/delete", {
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
                href={`/admin/promoters/${encodeURIComponent(id)}/codes`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Generar códigos"
              >
                <TicketPlus className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Generar códigos</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={`/admin/promoters/${encodeURIComponent(id)}/codes`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <TicketPlus className="h-4 w-4" />
            Códigos
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
                onClick={onDelete}
                disabled={pending}
                variant="danger"
                size="icon"
                aria-label="Eliminar promotor"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar promotor</TooltipContent>
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
