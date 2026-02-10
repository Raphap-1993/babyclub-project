import React from "react";

export function QRStatsTable({ events }: { events: any[] }) {
  return (
    <table className="min-w-full text-sm text-left">
      <thead>
        <tr>
          <th>Evento</th>
          <th>Fecha</th>
          <th>Total QRs</th>
          <th>Entradas</th>
          <th>Mesas</th>
          <th>Cortesía</th>
        </tr>
      </thead>
      <tbody>
        {events.map((ev) => (
          <tr key={ev.event_id}>
            <td>{ev.name}</td>
            <td>{ev.date}</td>
            <td>{ev.total_qr}</td>
            <td>{ev.by_type.entrada || 0}</td>
            <td>{ev.by_type.mesa || 0}</td>
            <td>{ev.by_type.cortesia || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
