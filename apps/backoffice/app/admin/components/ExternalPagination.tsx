"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectNative } from "@/components/ui/select-native";

type ExternalPaginationProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
};

export function ExternalPagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
  itemLabel = "registros",
  pageSizeOptions = [5, 10, 20, 50, 100],
}: ExternalPaginationProps) {
  const safeTotal = Math.max(0, totalItems);
  const totalPages = Math.max(1, Math.ceil(safeTotal / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = safeTotal === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(safePage * itemsPerPage, safeTotal);

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-700/30 bg-neutral-800/20 px-2 py-3 backdrop-blur-sm">
      <div className="flex items-center text-xs text-neutral-400">
        <span>
          Mostrando <span className="font-medium text-neutral-300">{startItem}</span> a{" "}
          <span className="font-medium text-neutral-300">{endItem}</span> de{" "}
          <span className="font-medium text-neutral-300">{safeTotal}</span> {itemLabel}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="pageSize" className="text-neutral-400">
            Por página:
          </label>
          <SelectNative
            id="pageSize"
            value={itemsPerPage}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 min-w-[88px] text-xs"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </SelectNative>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="h-8 w-8 text-neutral-400 hover:text-neutral-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-400">Página</span>
            <span className="rounded bg-neutral-700/50 px-2 py-1 font-medium text-neutral-200">{safePage}</span>
            <span className="text-neutral-400">de {totalPages}</span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="h-8 w-8 text-neutral-400 hover:text-neutral-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

