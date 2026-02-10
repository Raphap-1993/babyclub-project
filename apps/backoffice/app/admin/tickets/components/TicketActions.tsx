"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import TicketDetailModal from "./TicketDetailModal";

export default function TicketActions({ id, compact = true }: { id: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
          title="Ver ticket"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-700/20 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Eliminar ticket"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {error && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
            {error}
          </div>
        )}
      </div>

      <TicketDetailModal ticketId={id} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
