"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Upload, Download, Grid } from "lucide-react";
import MessageModal from "@/components/ui/MessageModal";
import { authedFetch } from "@/lib/authedFetch";

type Table = {
  id: string;
  name: string;
  ticket_count: number | null;
  layout_x: number | null;
  layout_y: number | null;
  layout_size: number | null;
};

type Organizer = {
  id: string;
  name: string;
  slug: string;
  layout_url: string | null;
  layout_canvas_width?: number | null;
  layout_canvas_height?: number | null;
};

type Props = {
  organizer: Organizer;
  tables: Table[];
};

export default function OrganizerLayoutClient({ organizer, tables }: Props) {
  console.log("OrganizerLayoutClient rendered:", { 
    organizerId: organizer.id, 
    organizerName: organizer.name,
    tablesCount: tables.length,
    tables: tables.map(t => ({ id: t.id, name: t.name }))
  });
  
  const [backgroundImage, setBackgroundImage] = useState<string | null>(organizer.layout_url || null);
  const [tablePositions, setTablePositions] = useState<Record<string, { x: number; y: number }>>(
    () => {
      const positions: Record<string, { x: number; y: number }> = {};
      tables.forEach((table) => {
        if (table.layout_x !== null && table.layout_y !== null) {
          positions[table.id] = { x: table.layout_x, y: table.layout_y };
        }
      });
      return positions;
    }
  );
  const [tableSizes, setTableSizes] = useState<Record<string, number>>(
    () => {
      const sizes: Record<string, number> = {};
      tables.forEach((table) => {
        sizes[table.id] = table.layout_size || 60;
      });
      return sizes;
    }
  );
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [tableSize, setTableSize] = useState(() => {
    // Inicializar con el tamaño de la primera mesa posicionada, o 60 por defecto
    const firstPositionedTable = tables.find(t => t.layout_x !== null && t.layout_y !== null);
    return firstPositionedTable?.layout_size || 60;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("organizerId", organizer.id);

    try {
      const res = await authedFetch("/api/uploads/layout", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
      
      console.log("Upload response:", { status: res.status, ok: res.ok, data });
      
      if (!res.ok) {
        const errorMsg = data?.error || data?.message || `Error del servidor (${res.status})`;
        console.error("Upload failed:", { status: res.status, data });
        throw new Error(errorMsg);
      }
      
      if (!data.url) {
        console.error("No URL in response:", data);
        throw new Error("No se recibió URL de la imagen");
      }
      
      setBackgroundImage(data.url);
      setMessageType("success");
      setMessage("Imagen de fondo cargada exitosamente");
    } catch (error: any) {
      console.error("Image upload error:", error);
      setMessageType("error");
      setMessage(error.message || "Error desconocido al subir la imagen");
    } finally {
      setUploading(false);
      // Reset input para permitir subir la misma imagen nuevamente
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImage(file);
    }
  };

  const handleDragStart = (tableId: string) => {
    setDraggingTable(tableId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingTable || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTablePositions((prev) => ({
      ...prev,
      [draggingTable]: { x, y },
    }));
    setDraggingTable(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadImage(file);
    } else if (file) {
      setMessageType("error");
      setMessage("Por favor sube solo imágenes (PNG, JPG, etc.)");
    }
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const canvasWidth = canvasRect?.width ? Math.round(canvasRect.width) : organizer.layout_canvas_width || 800;
      const canvasHeight = canvasRect?.height ? Math.round(canvasRect.height) : organizer.layout_canvas_height || 600;

      const updates = Object.entries(tablePositions).map(([tableId, pos]) => ({
        tableId,
        layout_x: pos.x,
        layout_y: pos.y,
        layout_size: tableSizes[tableId] || 60,
      }));

      const res = await authedFetch(`/api/organizers/${organizer.id}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates,
          layout_url: backgroundImage,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
        }),
      });

      if (!res.ok) throw new Error("Error al guardar");
      setMessageType("success");
      setMessage("Croquis guardado exitosamente");
    } catch (error) {
      setMessageType("error");
      setMessage("Error al guardar el croquis");
    } finally {
      setSaving(false);
    }
  };

  const exportLayout = () => {
    const data = {
      organizer: organizer.slug,
      layout_url: backgroundImage,
      tables: tables.map((t) => ({
        id: t.id,
        name: t.name,
        position: tablePositions[t.id] || null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${organizer.slug}-layout.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/organizers`}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-lg">
            🏢
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              📐 Diseñador de Croquis
            </h1>
            <p className="text-xs text-neutral-400">{organizer.name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Grid className="w-3.5 h-3.5" />
            {showGrid ? "Ocultar" : "Mostrar"}
          </button>
          <div className="flex items-center gap-2 bg-neutral-800 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-neutral-400">Tamaño:</span>
            <input
              type="range"
              min="40"
              max="100"
              value={tableSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setTableSize(newSize);
                // Actualizar tamaño de todas las mesas posicionadas
                const newSizes: Record<string, number> = {};
                Object.keys(tablePositions).forEach(tableId => {
                  newSizes[tableId] = newSize;
                });
                setTableSizes(prev => ({ ...prev, ...newSizes }));
              }}
              className="w-20 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: '#ec4899',
              }}
            />
            <span className="text-xs text-white font-mono w-8">{tableSize}px</span>
          </div>
          <button
            onClick={exportLayout}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Subir
              </>
            )}
          </button>
          <button
            onClick={saveLayout}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Paleta de mesas */}
        <div className="col-span-3 space-y-2">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
            <h3 className="text-white font-semibold text-sm mb-2">
              Mesas Disponibles ({tables.length})
            </h3>
            {tables.length === 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <p className="text-yellow-400 text-sm font-semibold mb-2">
                  ⚠️ No hay mesas
                </p>
                <p className="text-xs text-yellow-300/80 mb-3">
                  Debes crear mesas primero para poder diseñar el croquis
                </p>
                <Link
                  href={`/admin/organizers/${organizer.id}/tables`}
                  className="inline-block px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Ir a crear mesas
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[550px] overflow-y-auto">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    draggable
                    onDragStart={() => handleDragStart(table.id)}
                    className="bg-neutral-900/50 border border-neutral-600 rounded-lg p-2 cursor-move hover:border-pink-500 transition-colors"
                  >
                    <div className="text-white font-semibold text-sm">{table.name}</div>
                    <div className="text-xs text-neutral-400">
                      Cap: {table.ticket_count || "—"}
                    </div>
                    {tablePositions[table.id] && (
                      <div className="text-xs text-green-400 mt-0.5">
                        ✓ Posicionada
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
            <h3 className="text-white font-semibold text-sm mb-1.5">Instrucciones</h3>
            <ul className="text-xs text-neutral-400 space-y-0.5">
              <li>1. 📤 Arrastra una imagen al canvas o usa "Subir Fondo"</li>
              <li>2. 🪑 Arrastra las mesas al croquis</li>
              <li>3. � Arrastra mesas posicionadas para moverlas</li>
              <li>4. 💾 Guarda los cambios</li>
            </ul>
          </div>
        </div>

        {/* Canvas de diseño */}
        <div className="col-span-9">
          <div
            ref={canvasRef}
            onDrop={(e) => {
              // Si es un archivo de imagen, subirlo; si no, es una mesa
              if (e.dataTransfer.files.length > 0) {
                handleCanvasFileDrop(e);
              } else {
                handleDrop(e);
              }
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            className="relative w-full h-[600px] bg-neutral-800/30 border-2 border-dashed border-neutral-600 rounded-xl overflow-hidden"
          >
            {/* Imagen de fondo */}
            {backgroundImage && (
              <img
                src={backgroundImage}
                alt="Croquis background"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            )}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(100, 116, 139, 0.1) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(100, 116, 139, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px",
                    width: '100%',
                    height: '600px',
                  }}
                />
              )}

              {!backgroundImage && !uploading && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500" style={{ width: '100%', height: '600px' }}>
                  <div className="text-center">
                    <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Arrastra una imagen aquí o haz clic en "Subir Fondo"</p>
                    <p className="text-xs mt-2">También puedes arrastrar mesas directamente</p>
                  </div>
                </div>
              )}

              {/* Mesas posicionadas */}
            {Object.entries(tablePositions).map(([tableId, pos]) => {
              const table = tables.find((t) => t.id === tableId);
              if (!table) return null;

              return (
                <div
                  key={tableId}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggingTable(tableId);
                  }}
                  className="absolute bg-gradient-to-br from-pink-500 to-rose-600 border-2 border-pink-400 shadow-lg cursor-move hover:from-pink-600 hover:to-rose-700 transition-all group"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    transform: "translate(-50%, -50%)",
                    width: `${tableSizes[tableId] || 60}px`,
                    height: `${tableSizes[tableId] || 60}px`,
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onDoubleClick={() => {
                    const newPositions = { ...tablePositions };
                    delete newPositions[tableId];
                    setTablePositions(newPositions);
                  }}
                >
                  <div className="text-white font-bold text-center" style={{ fontSize: `${Math.max(12, (tableSizes[tableId] || 60) / 5)}px` }}>
                    {table.name}
                  </div>
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newPositions = { ...tablePositions };
                      delete newPositions[tableId];
                      setTablePositions(newPositions);
                    }}
                  >
                    ×
                  </div>
                </div>
              );
            })}

            {/* Loading overlay cuando se está subiendo */}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm z-50">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white font-semibold text-lg">Subiendo imagen...</p>
                  <p className="text-neutral-400 text-sm mt-2">Por favor espera</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 bg-neutral-800/50 border border-neutral-700 rounded-lg p-2">
            <div className="text-xs text-neutral-400">
              <strong className="text-white text-xs">Tips:</strong>
              <ul className="mt-0.5 space-y-0.5 text-xs">
                <li>• Arrastra mesas posicionadas para moverlas</li>
                <li>• Doble-click o botón × para remover</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </div>
  );
}
