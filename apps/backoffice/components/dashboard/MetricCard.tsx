"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@repo/ui";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
    label: string;
  };
  description?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  trend,
  description,
  className,
}: MetricCardProps) {
  return (
    <Card className={`border-0 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        {icon && <div className="text-slate-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-white">{value}</div>
          {trend && (
            <Badge variant={trend.direction === "up" ? "default" : "error"} className="ml-2">
              <div className="flex items-center gap-1">
                {trend.direction === "up" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {trend.value}%
              </div>
            </Badge>
          )}
        </div>
        {description && <p className="mt-2 text-xs text-slate-400">{description}</p>}
      </CardContent>
    </Card>
  );
}
