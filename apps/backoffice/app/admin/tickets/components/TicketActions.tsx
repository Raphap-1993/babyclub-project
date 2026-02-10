"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function TicketActions({ id, compact }: { id: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    const confirmed = window.confirm("¿Eliminar ticket?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/tickets/delete", {
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
      <div className={`flex ${compact ? "gap-2" : "justify-end gap-2"}`}>
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/tickets/${encodeURIComponent(id)}`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Ver ticket"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Ver detalle</TooltipContent>
          </Tooltip>
        ) : (
          <Link href={`/admin/tickets/${encodeURIComponent(id)}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <Eye className="h-4 w-4" />
            Ver
          </Link>
        )}
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" onClick={onDelete} disabled={pending} variant="danger" size="icon" aria-label="Eliminar ticket">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar ticket</TooltipContent>
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
