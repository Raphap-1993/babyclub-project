"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";

type ComingSoonProps = {
  title: string;
  description?: string;
  kicker?: string;
};

export function ComingSoon({ title, description, kicker = "Módulo" }: ComingSoonProps) {
  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={CalendarClock}
        kicker={kicker}
        title={title}
        description={description || "Estamos terminando esta sección. Pronto podrás gestionarla desde aquí."}
      />

      <Card className="border-neutral-700/70 bg-neutral-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-neutral-100">Migración UI</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-300">
            Esta pantalla está en proceso de migración al nuevo flujo operativo.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
