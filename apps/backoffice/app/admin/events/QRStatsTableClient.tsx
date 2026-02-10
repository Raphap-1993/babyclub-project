"use client";
import { useEffect, useState } from "react";
import { QRStatsTable } from "./components/QRStatsTable";

export function QRStatsTableClient() {
  const [qrStats, setQrStats] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/qr-summary-all")
      .then((res) => res.json())
      .then((data) => setQrStats(data.events || []));
  }, []);

  return (
    <div>
      <h2>Resumen de QRs generados</h2>
      <QRStatsTable events={qrStats} />
    </div>
  );
}
