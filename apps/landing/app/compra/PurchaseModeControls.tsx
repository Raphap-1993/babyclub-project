type PurchaseMode = "mesa" | "ticket";

type PurchaseEventOption = {
  id: string;
  name?: string | null;
};

type SaleBlockStatus = "on_sale" | "sold_out" | "paused" | null;

type SaleBlock = {
  status: SaleBlockStatus;
  message: string;
} | null;

type PurchaseModeControlsProps = {
  mode: PurchaseMode;
  onModeChange: (mode: PurchaseMode) => void;
  ticketEventId: string;
  onTicketEventChange: (eventId: string) => void;
  ticketEventOptions: PurchaseEventOption[];
  ticketSaleBlock: SaleBlock;
  selectedEventId: string;
  onMesaEventChange: (eventId: string) => void;
  mesaEventOptions: PurchaseEventOption[];
  mesaSaleBlock: SaleBlock;
  resolveEventSaleBlock: (eventId: string) => SaleBlock;
};

export function PurchaseModeControls({
  mode,
  onModeChange,
  ticketEventId,
  onTicketEventChange,
  ticketEventOptions,
  ticketSaleBlock,
  selectedEventId,
  onMesaEventChange,
  mesaEventOptions,
  mesaSaleBlock,
  resolveEventSaleBlock,
}: PurchaseModeControlsProps) {
  const isTicketMode = mode === "ticket";
  const eventValue = isTicketMode ? ticketEventId : selectedEventId;
  const eventOptions = isTicketMode ? ticketEventOptions : mesaEventOptions;
  const activeSaleBlock = isTicketMode ? ticketSaleBlock : mesaSaleBlock;
  const handleEventChange = isTicketMode
    ? onTicketEventChange
    : onMesaEventChange;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange("ticket")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isTicketMode ? "btn-smoke" : "btn-smoke-outline"
          }`}
        >
          Solo entrada
        </button>
        <button
          type="button"
          onClick={() => onModeChange("mesa")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            !isTicketMode ? "btn-smoke" : "btn-smoke-outline"
          }`}
        >
          Reserva mesa
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            Evento
          </p>
          {eventOptions.length > 0 ? (
            <>
              <select
                value={eventValue}
                onChange={(event) => handleEventChange(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
              >
                <option value="">Selecciona el evento</option>
                {eventOptions.map((eventOption) => {
                  const optionSaleBlock = resolveEventSaleBlock(eventOption.id);
                  const optionStatus = optionSaleBlock?.status;

                  return (
                    <option
                      key={eventOption.id}
                      value={eventOption.id}
                      disabled={Boolean(optionSaleBlock)}
                    >
                      {eventOption.name || `Evento ${eventOption.id.slice(0, 6)}`}
                      {optionStatus === "sold_out"
                        ? " (Sold out)"
                        : optionStatus === "paused"
                          ? " (Pausado)"
                          : ""}
                    </option>
                  );
                })}
              </select>
              {!eventValue && (
                <p className="text-xs text-[#ff9a9a]">
                  Selecciona el evento para continuar.
                </p>
              )}
              {activeSaleBlock && (
                <p className="text-xs font-semibold text-[#ff9a9a]">
                  {activeSaleBlock.message}
                </p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white/60">
              No hay eventos con entradas disponibles ahora.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
