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
          <TableHead>Vendidas</TableHead>
          <TableHead>Free</TableHead>
          <TableHead>Cortesías</TableHead>
          <TableHead>Mesas QR</TableHead>
          <TableHead>Mesas separadas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-white/55">
              Sin resultados para el rango seleccionado.
            </TableCell>
          </TableRow>
        ) : null}
        {events.map((ev) => (
          <TableRow key={ev.event_id}>
            <TableCell className="font-semibold text-white/90">{ev.name}</TableCell>
            <TableCell className="text-white/70">{ev.date}</TableCell>
            <TableCell>{ev.total_qr}</TableCell>
            <TableCell>{ev.sold_qr ?? ev.by_type.sold ?? 0}</TableCell>
            <TableCell>{ev.free_qr ?? ev.by_type.free ?? 0}</TableCell>
            <TableCell>{ev.courtesy_qr ?? ev.by_type.courtesy ?? 0}</TableCell>
            <TableCell>{ev.table_qr ?? ev.by_type.table ?? 0}</TableCell>
            <TableCell>{ev.table_count ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
