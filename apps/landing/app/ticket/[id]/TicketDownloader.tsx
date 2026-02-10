"use client";

import { useEffect, useRef } from "react";
import { Download } from "lucide-react";

export function TicketDownloader({ ticketId }: { ticketId: string }) {
  const ticketRef = useRef<HTMLDivElement>(null);

  // Detectar si viene con parámetro download
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('download') === '1') {
      // Esperar un momento para que se carguen las imágenes
      setTimeout(() => {
        handleDownload();
      }, 1500);
    }
  }, []);

  const handleDownload = async () => {
    const ticketElement = document.getElementById('ticket-content');
    if (!ticketElement) return;

    try {
      // Importar html2canvas dinámicamente
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(ticketElement, {
        backgroundColor: '#000000',
        scale: 2, // Mayor calidad
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Convertir a blob y descargar
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-${ticketId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Error al descargar ticket:', err);
      alert('Hubo un error al descargar el ticket. Por favor intenta de nuevo.');
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
    >
      <Download className="h-4 w-4" />
      Descargar ticket
    </button>
  );
}
