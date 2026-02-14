"use client";

import { Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ActionButtonProps {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  variant?: "primary" | "danger";
  className?: string;
  disabled?: boolean;
}

function ActionButton({
  href,
  onClick,
  icon,
  label,
  variant = "primary",
  className = "",
  disabled = false,
}: ActionButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200";
  const variants = {
    primary:
      "border-neutral-600 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed",
    danger:
      "border-red-600/30 text-red-400 hover:border-red-600 hover:bg-red-600/10 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed",
  };

  const classes = `${baseStyles} ${variants[variant]} ${className}`;

  const content = (
    <>
      <span className="h-4 w-4">{icon}</span>
      <span>{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={label}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes} title={label} disabled={disabled}>
      {content}
    </button>
  );
}

interface RowActionsProps {
  id: string;
  editHref?: string;
  viewHref?: string;
  onDelete?: (id: string) => Promise<void>;
  deleteApiEndpoint?: string;
  deleteConfirmMessage?: string;
  showEdit?: boolean;
  showView?: boolean;
  showDelete?: boolean;
}

export function RowActions({
  id,
  editHref,
  viewHref,
  onDelete,
  deleteApiEndpoint,
  deleteConfirmMessage = "¿Estás seguro que deseas eliminar este elemento?",
  showEdit = true,
  showView = false,
  showDelete = true,
}: RowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(deleteConfirmMessage)) return;

    startTransition(async () => {
      try {
        if (onDelete) {
          await onDelete(id);
        } else if (deleteApiEndpoint) {
          const response = await fetch(deleteApiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (!response.ok) throw new Error("Failed to delete");
          router.refresh();
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {showView && viewHref && (
        <ActionButton
          href={viewHref}
          icon={<Eye className="h-4 w-4" />}
          label="Ver detalles"
          variant="primary"
          disabled={isPending}
        />
      )}
      {showEdit && editHref && (
        <ActionButton
          href={editHref}
          icon={<Edit className="h-4 w-4" />}
          label="Editar"
          variant="primary"
          disabled={isPending}
        />
      )}
      {showDelete && (onDelete || deleteApiEndpoint) && (
        <ActionButton
          onClick={handleDelete}
          icon={<Trash2 className="h-4 w-4" />}
          label="Eliminar"
          variant="danger"
          disabled={isPending}
        />
      )}
    </div>
  );
}
