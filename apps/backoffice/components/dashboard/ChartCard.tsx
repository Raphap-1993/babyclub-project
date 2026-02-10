"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  children,
  footer,
  className,
}: ChartCardProps) {
  return (
    <Card className={`border-0 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-full">{children}</div>
      </CardContent>
      {footer && <div className="border-t border-slate-700 px-6 py-3 text-xs text-slate-400">{footer}</div>}
    </Card>
  );
}
