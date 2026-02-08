import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AdminPageProps = {
  children: ReactNode;
  maxWidth?: "5xl" | "6xl" | "7xl";
};

type AdminHeaderProps = {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

type AdminPanelProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  contentClassName?: string;
};

const widthMap: Record<NonNullable<AdminPageProps["maxWidth"]>, string> = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function AdminPage({ children, maxWidth = "7xl" }: AdminPageProps) {
  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_16%,rgba(166,12,47,0.08),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_50%_108%,rgba(255,255,255,0.04),transparent_42%)]" />
      <div className={`mx-auto w-full space-y-3 ${widthMap[maxWidth]}`}>{children}</div>
    </main>
  );
}

export function AdminHeader({ kicker, title, description, actions }: AdminHeaderProps) {
  return (
    <Card className="border-[#2b2b2b] bg-[#111111]">
      <CardHeader className="gap-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">{kicker}</CardDescription>
            <CardTitle className="mt-1 text-2xl">{title}</CardTitle>
            {description ? <p className="mt-1 text-xs text-white/60">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
    </Card>
  );
}

export function AdminPanel({ children, title, description, actions, contentClassName = "p-4" }: AdminPanelProps) {
  return (
    <Card className="border-[#2b2b2b]">
      {title || description || actions ? (
        <CardHeader className="border-b border-[#252525] pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
              {description ? <CardDescription className="mt-1 text-xs text-white/55">{description}</CardDescription> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
