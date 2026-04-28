"use client";

import Link from "next/link";
import { legalLinks } from "lib/legalLinks";

export function LegalFooterLinks({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Información legal"
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[11px] font-semibold text-white/45 ${className}`}
    >
      {!compact ? <span>© 2026 BABYCLUB</span> : null}
      {legalLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="underline-offset-4 transition hover:text-white hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
