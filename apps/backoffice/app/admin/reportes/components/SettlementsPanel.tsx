import Link from "next/link";
import {
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import {
  formatLima,
  formatPen,
  settlementStatusLabel,
  type EventCloseReport,
} from "@/lib/reports/eventClose";
import ReportPanel from "./ReportPanel";
import ReportPagination, { REPORT_PAGE_SIZE } from "./ReportPagination";

function cashAmount(cents: number | null, currency: string | null) {
  if (cents === null) return "Sin importe registrado";
  const amount = (cents / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "PEN"
    ? formatPen(cents)
    : `${amount} ${currency || "· moneda sin indicar"}`;
}

export default function SettlementsPanel({
  report,
  promoterId,
  onPromoterChange,
  page,
  onPageChange,
}: {
  report: EventCloseReport;
  promoterId: string;
  onPromoterChange: (value: string) => void;
  page: number;
  onPageChange: (value: number) => void;
}) {
  const { settlements } = report;
  const promoters = Array.from(
    new Map(
      settlements.records
        .filter((row) => row.promoterId)
        .map((row) => [row.promoterId as string, row.promoterName]),
    ).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const filtered = promoterId
    ? settlements.records.filter((row) => row.promoterId === promoterId)
    : settlements.records;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / REPORT_PAGE_SIZE) - 1),
  );
  const rows = filtered.slice(
    currentPage * REPORT_PAGE_SIZE,
    (currentPage + 1) * REPORT_PAGE_SIZE,
  );
  return (
    <ReportPanel
      title="Liquidaciones"
      description="Liquidaciones de promotores registradas para este evento."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-400">
          {settlements.count}{" "}
          {settlements.count === 1
            ? "liquidación en el evento"
            : "liquidaciones en el evento"}
        </p>
        <Link
          href="/admin/liquidaciones"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-rose-300"
        >
          Gestionar liquidaciones
        </Link>
      </div>
      {settlements.count > 0 ? (
        <>
          <p className="mb-2 text-xs font-medium text-neutral-400">
            Totales del evento en soles
          </p>
          <dl className="mb-5 grid gap-4 rounded-xl bg-white/[0.025] p-4 sm:grid-cols-3">
            {[
              ["Pendiente en soles", settlements.pendingCents],
              ["Liquidado en soles", settlements.settledCents],
              ["Anulado en soles", settlements.voidCents],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-neutral-400">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatPen(value as number)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-4 text-xs leading-5 text-neutral-400">
            Pendiente incluye borradores y pendientes. Liquidado incluye pagos,
            entregas y cierres.
          </p>
          <div className="mb-5 max-w-md">
            <label
              htmlFor="settlement-promoter"
              className="mb-2 block text-xs font-medium text-neutral-400"
            >
              Filtrar liquidaciones por promotor
            </label>
            <Select
              id="settlement-promoter"
              value={promoterId}
              onChange={(event) => onPromoterChange(event.target.value)}
              options={[
                { value: "", label: "Todos los promotores" },
                ...(promoterId &&
                !promoters.some((row) => row.value === promoterId)
                  ? [
                      {
                        value: promoterId,
                        label: "Promotor sin liquidaciones en este evento",
                      },
                    ]
                  : []),
                ...promoters,
              ]}
              className="w-full border-white/15 bg-[#191919] text-sm text-white [color-scheme:dark] focus:border-rose-400 focus:ring-rose-400/20"
            />
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              El filtro se aplica a la tabla. El Excel y el CSV incluyen todas
              las liquidaciones del evento.
            </p>
          </div>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">
                  Liquidaciones de {report.event.name}
                </caption>
                <TableHeader className="border-b border-white/10 text-xs text-neutral-400">
                  <TableRow>
                    {[
                      "Promotor",
                      "Estado",
                      "Importe",
                      "Unidades en efectivo",
                      "Bebidas",
                      "Fecha",
                    ].map((label) => (
                      <TableHead
                        key={label}
                        scope="col"
                        className="px-2 py-3 font-normal first:pl-0"
                      >
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableHead scope="row" className="py-4 pr-4 font-medium">
                        {row.promoterName}
                      </TableHead>
                      <TableCell className="px-2 py-4">
                        {settlementStatusLabel(row.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2 py-4 tabular-nums">
                        {cashAmount(row.cashTotalCents, row.currencyCode)}
                      </TableCell>
                      <TableCell className="px-2 py-4 tabular-nums">
                        {row.cashUnits.toLocaleString("es-PE")}
                      </TableCell>
                      <TableCell className="px-2 py-4 tabular-nums">
                        {row.drinkUnits.toLocaleString("es-PE")}
                      </TableCell>
                      <TableCell className="px-2 py-4 text-xs text-neutral-400">
                        <span className="block">
                          Creada: {formatLima(row.createdAt)}
                        </span>
                        {row.settledAt && (
                          <span className="mt-1 block">
                            Liquidada: {formatLima(row.settledAt)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-xl bg-white/[0.025] p-5 text-sm leading-6 text-neutral-400">
              Este promotor no tiene liquidaciones registradas en este evento.
            </p>
          )}
          <ReportPagination
            page={currentPage}
            count={filtered.length}
            onChange={onPageChange}
          />
          {settlements.otherCurrencyCount > 0 && (
            <p className="mt-4 text-xs leading-5 text-neutral-400">
              {settlements.otherCurrencyCount} liquidaciones con otra moneda o
              sin moneda indicada, fuera de los totales en soles.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-xl bg-white/[0.025] p-5 text-sm leading-6 text-neutral-400">
          No hay liquidaciones registradas para este evento.
        </p>
      )}
    </ReportPanel>
  );
}
