import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

export function QRStatsTable({ events }: { events: any[] }) {
  return (
    <Table containerClassName="max-h-[58dvh] min-h-[260px]">
      <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1]">
        <TableRow>
          <TableHead>Evento</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Total QRs</TableHead>
          <TableHead>Entradas</TableHead>
          <TableHead>Mesas</TableHead>
          <TableHead>Cortesía</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-10 text-center text-white/55">
              Sin resultados para el rango seleccionado.
            </TableCell>
          </TableRow>
        ) : null}
        {events.map((ev) => (
          <TableRow key={ev.event_id}>
            <TableCell className="font-semibold text-white/90">{ev.name}</TableCell>
            <TableCell className="text-white/70">{ev.date}</TableCell>
            <TableCell>{ev.total_qr}</TableCell>
            <TableCell>{ev.by_type.general || ev.by_type.entrada || 0}</TableCell>
            <TableCell>{ev.by_type.table || ev.by_type.mesa || 0}</TableCell>
            <TableCell>{ev.by_type.courtesy || ev.by_type.cortesia || 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
