"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MessageModal from "@/components/ui/MessageModal";

type Table = {
  id: string;
  name: string;
  ticket_count: number;
  price: number;
  min_consumption: number;
  is_active: boolean;
  availabilityId?: string;
  isAvailable: boolean;
  customPrice?: number | null;
  customMinConsumption?: number | null;
  notes?: string | null;
};

type Event = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function EventTablesClient({
  event,
  tables,
}: {
  event: Event;
  tables: Table[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [customMinConsumptions, setCustomMinConsumptions] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");

  const handleToggleAvailability = async (table: Table) => {
    setLoading(table.id);
    try {
      const res = await fetch(`/api/events/${event.id}/tables`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          isAvailable: !table.isAvailable,
          customPrice: table.customPrice,
          customMinConsumption: table.customMinConsumption,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  const handleSaveCustomPrice = async (table: Table) => {
    setLoading(table.id);
    try {
      const customPrice = customPrices[table.id];
      const customMinConsumption = customMinConsumptions[table.id];

      const res = await fetch(`/api/events/${event.id}/tables`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          isAvailable: table.isAvailable,
          customPrice: customPrice !== undefined ? customPrice : table.customPrice,
          customMinConsumption: customMinConsumption !== undefined ? customMinConsumption : table.customMinConsumption,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      setEditingTable(null);
      setCustomPrices({});
      setCustomMinConsumptions({});
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  const handleResetPrice = async (table: Table) => {
    setLoading(table.id);
    try {
      const res = await fetch(`/api/events/${event.id}/tables`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          isAvailable: table.isAvailable,
          customPrice: null,
          customMinConsumption: null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white">
      <div className="mb-6">
        <button 
          className="px-4 py-2 border border-slate-600 rounded hover:bg-slate-800 transition-colors"
          onClick={() => router.back()}
        >
          ← Volver
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{event.name}</h1>
        <p className="text-slate-400 mt-2">Configuración de mesas disponibles</p>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold">Mesas del organizador</h2>
          <p className="text-sm text-slate-400 mt-1">
            Activa/desactiva mesas para este evento y personaliza precios
          </p>
        </div>

        <div className="divide-y divide-slate-700">
          {tables.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              No hay mesas configuradas para este organizador
            </div>
          )}

          {tables.map((table) => {
            const isEditing = editingTable === table.id;
            const finalPrice = customPrices[table.id] ?? table.customPrice ?? table.price;
            const finalMinConsumption = customMinConsumptions[table.id] ?? table.customMinConsumption ?? table.min_consumption;
            const hasCustom = table.customPrice !== null || table.customMinConsumption !== null;

            return (
              <div key={table.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{table.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${table.isAvailable ? 'bg-green-600' : 'bg-slate-600'}`}>
                        {table.isAvailable ? "Disponible" : "No disponible"}
                      </span>
                      {hasCustom && (
                        <span className="px-2 py-1 text-xs rounded border border-slate-500">Precio personalizado</span>
                      )}
                      {!table.is_active && (
                        <span className="px-2 py-1 text-xs rounded bg-red-600">Inactiva</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Entradas:</span>{" "}
                        <span className="font-medium">{table.ticket_count}</span>
                      </div>
                      
                      {isEditing ? (
                        <>
                          <div>
                            <label className="text-slate-400 block mb-1">Precio:</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
                              placeholder={`Base: ${table.price}`}
                              value={customPrices[table.id] ?? table.customPrice ?? ""}
                              onChange={(e) =>
                                setCustomPrices({
                                  ...customPrices,
                                  [table.id]: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-slate-400 block mb-1">Consumo mín:</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
                              placeholder={`Base: ${table.min_consumption}`}
                              value={customMinConsumptions[table.id] ?? table.customMinConsumption ?? ""}
                              onChange={(e) =>
                                setCustomMinConsumptions({
                                  ...customMinConsumptions,
                                  [table.id]: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-400">Precio:</span>{" "}
                            <span className="font-medium">S/ {finalPrice}</span>
                            {hasCustom && table.customPrice && (
                              <span className="text-xs text-slate-500 ml-2">
                                (base: S/ {table.price})
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400">Consumo mín:</span>{" "}
                            <span className="font-medium">S/ {finalMinConsumption}</span>
                            {hasCustom && table.customMinConsumption && (
                              <span className="text-xs text-slate-500 ml-2">
                                (base: S/ {table.min_consumption})
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                          onClick={() => handleSaveCustomPrice(table)}
                          disabled={loading === table.id}
                        >
                          Guardar
                        </button>
                        <button
                          className="px-3 py-1 text-sm border border-slate-600 rounded hover:bg-slate-800 disabled:opacity-50"
                          onClick={() => {
                            setEditingTable(null);
                            setCustomPrices({});
                            setCustomMinConsumptions({});
                          }}
                          disabled={loading === table.id}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`px-3 py-1 text-sm rounded disabled:opacity-50 ${
                            table.isAvailable 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                          onClick={() => handleToggleAvailability(table)}
                          disabled={loading === table.id || !table.is_active}
                        >
                          {table.isAvailable ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          className="px-3 py-1 text-sm border border-slate-600 rounded hover:bg-slate-800 disabled:opacity-50"
                          onClick={() => setEditingTable(table.id)}
                          disabled={loading === table.id || !table.isAvailable}
                        >
                          Personalizar
                        </button>
                        {hasCustom && (
                          <button
                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50"
                            onClick={() => handleResetPrice(table)}
                            disabled={loading === table.id}
                          >
                            Reset
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
