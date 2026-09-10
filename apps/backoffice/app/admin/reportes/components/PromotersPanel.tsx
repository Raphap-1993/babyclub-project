import { Fragment, useState } from "react";
import {
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import type { EventCloseReport } from "@/lib/reports/eventClose";
import ReportPanel from "./ReportPanel";
import ReportPagination, { REPORT_PAGE_SIZE } from "./ReportPagination";

const number = (value: number) => value.toLocaleString("es-PE");

export default function PromotersPanel({
  report,
  promoterId,
  page,
  onPromoterChange,
  onPageChange,
}: {
  report: EventCloseReport;
  promoterId: string;
  page: number;
  onPromoterChange: (value: string) => void;
  onPageChange: (value: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = promoterId
    ? report.promoters.filter((row) => row.id === promoterId)
    : report.promoters;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / REPORT_PAGE_SIZE) - 1),
  );
  const rows = filtered.slice(
    currentPage * REPORT_PAGE_SIZE,
    (currentPage + 1) * REPORT_PAGE_SIZE,
  );
  const totals = filtered.reduce(
    (sum, row) => ({
      issued: sum.issued + row.issued,
      invited: sum.invited + row.invited,
      withoutAdmission: sum.withoutAdmission + row.invitationWithoutAdmission,
    }),
    { issued: 0, invited: 0, withoutAdmission: 0 },
  );
  return (
    <ReportPanel
      title="Promotores"
      description="Entradas personales emitidas y accesos confirmados por promotor."
    >
      <div className="mb-5 max-w-md">
        <label
          htmlFor="report-promoter"
          className="mb-2 block text-xs font-medium text-neutral-400"
        >
          Promotor
        </label>
        <Select
          id="report-promoter"
          value={promoterId}
          onChange={(event) => onPromoterChange(event.target.value)}
          options={[
            { value: "", label: "Todos los promotores" },
            ...(promoterId &&
            !report.promoters.some((row) => row.id === promoterId)
              ? [
                  {
                    value: promoterId,
                    label: "Promotor sin actividad en este evento",
                  },
                ]
              : []),
            ...report.promoters.map((row) => ({
              value: row.id,
              label: row.name,
            })),
          ]}
          className="w-full border-white/15 bg-[#191919] text-sm text-white [color-scheme:dark] focus:border-rose-400 focus:ring-rose-400/20"
        />
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          El Excel y el CSV incluyen todos los promotores del evento.
        </p>
      </div>
      {rows.length ? (
        <>
          <dl className="mb-5 grid gap-3 rounded-xl bg-white/[0.025] p-4 sm:grid-cols-3">
            {[
              ["Entradas personales emitidas", totals.issued],
              ["Invitaciones personales emitidas", totals.invited],
              ["Invitaciones personales sin ingreso", totals.withoutAdmission],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-neutral-400">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {number(value as number)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[660px] text-left text-sm">
              <caption className="sr-only">
                Accesos confirmados por promotor para {report.event.name}
              </caption>
              <TableHeader className="border-b border-white/10 text-xs text-neutral-400">
                <TableRow>
                  {[
                    "Promotor",
                    "Accesos",
                    "Con compra",
                    "Mesa",
                    "Invitación / free",
                    "Sin modalidad",
                  ].map((label) => (
                    <TableHead
                      key={label}
                      scope="col"
                      className="px-2 py-3 font-normal first:pl-0 [&:not(:first-child)]:text-right"
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableHead scope="row" className="py-4 pr-4 font-medium">
                        <span className="block">{row.name}</span>
                        <button
                          type="button"
                          aria-expanded={expandedId === row.id}
                          aria-controls={`promoter-detail-${row.id}`}
                          onClick={() =>
                            setExpandedId(expandedId === row.id ? null : row.id)
                          }
                          className="mt-1 rounded py-1 text-xs font-normal text-rose-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-rose-300"
                        >
                          {expandedId === row.id
                            ? "Ocultar entradas"
                            : "Ver entradas"}
                          <span className="sr-only"> de {row.name}</span>
                        </button>
                      </TableHead>
                      {[
                        row.confirmed,
                        row.purchase,
                        row.table,
                        row.courtesy + row.free,
                        row.unclassified + row.unknown,
                      ].map((value, index) => (
                        <TableCell
                          key={index}
                          className="px-2 py-4 text-right tabular-nums text-neutral-300"
                        >
                          {number(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow
                      id={`promoter-detail-${row.id}`}
                      hidden={expandedId !== row.id}
                    >
                      <TableCell colSpan={6} className="bg-white/[0.025] p-4">
                        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                          {[
                            ["Entradas personales emitidas", row.issued],
                            ["Invitaciones personales emitidas", row.invited],
                            [
                              "Invitaciones personales con ingreso",
                              row.invitationAttended,
                            ],
                            [
                              "Invitaciones personales sin ingreso",
                              row.invitationWithoutAdmission,
                            ],
                            [
                              "Invitaciones personales usadas sin confirmación de ingreso",
                              row.invitationUsageWithoutScan,
                            ],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-xs text-neutral-400">
                                {label}
                              </dt>
                              <dd className="mt-1 font-semibold tabular-nums">
                                {number(value as number)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <ReportPagination
            page={currentPage}
            count={filtered.length}
            onChange={onPageChange}
          />
          <p className="mt-4 text-xs leading-5 text-neutral-400">
            {report.event.closed_at
              ? "Asistencia final del evento."
              : "La asistencia se actualiza hasta el cierre del evento."}
          </p>
        </>
      ) : (
        <p className="py-5 text-sm text-neutral-400">
          {promoterId
            ? "Este promotor no tiene entradas ni accesos registrados en este evento."
            : "Todavía no hay entradas ni accesos registrados por promotor."}
        </p>
      )}
    </ReportPanel>
  );
}
