import { Button } from "@/components/ui/button";

export const REPORT_PAGE_SIZE = 10;

export default function ReportPagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  if (count <= REPORT_PAGE_SIZE) return null;
  return (
    <nav
      aria-label="Paginación del reporte"
      className="mt-4 flex items-center justify-between gap-3"
    >
      <Button
        variant="ghost"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-xs text-neutral-400">
        Página {page + 1} de {Math.ceil(count / REPORT_PAGE_SIZE)}
      </span>
      <Button
        variant="ghost"
        disabled={(page + 1) * REPORT_PAGE_SIZE >= count}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
