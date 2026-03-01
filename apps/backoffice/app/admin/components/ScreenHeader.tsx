"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type ScreenHeaderProps = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function ScreenHeader({ icon: Icon, kicker, title, description, actions }: ScreenHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400/80">
          <Icon className="h-3.5 w-3.5" />
          {kicker}
        </p>
        <h1 className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">{actions}</div> : null}
    </div>
  );
}
