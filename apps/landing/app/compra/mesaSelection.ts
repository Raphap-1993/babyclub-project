import { hasLayoutPosition } from "../registro/tableSlotUtils";

type MesaProduct = {
  id: string;
  is_active?: boolean | null;
};

type MesaTable = {
  id: string;
  name: string;
  is_reserved?: boolean | null;
  products?: MesaProduct[];
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  layout_x?: number | null;
  layout_y?: number | null;
  layout_size?: number | null;
};

function getFirstActiveProductId(table: MesaTable | undefined) {
  if (!table) return "";
  const firstActiveProduct = table.products?.find(
    (product) => product.is_active !== false,
  );
  return firstActiveProduct?.id || "";
}

export function resolveMesaSelectionAfterReload(input: {
  tables: MesaTable[];
  currentSelectedTableId: string;
  currentSelectedProductId: string;
  selectedEventId: string;
}) {
  const {
    tables,
    currentSelectedTableId,
    currentSelectedProductId,
    selectedEventId,
  } = input;

  const currentTable = currentSelectedTableId
    ? tables.find((table) => table.id === currentSelectedTableId)
    : null;

  if (currentTable) {
    const productStillAvailable = currentSelectedProductId
      ? currentTable.products?.some(
          (product) =>
            product.id === currentSelectedProductId &&
            product.is_active !== false,
        )
      : false;

    return {
      selectedTableId: currentTable.id,
      selectedProductId: productStillAvailable
        ? currentSelectedProductId
        : getFirstActiveProductId(currentTable),
    };
  }

  if (selectedEventId) {
    return {
      selectedTableId: "",
      selectedProductId: "",
    };
  }

  const hasBackofficeLayout = tables.some(hasLayoutPosition);
  const firstAvailable =
    tables.find(
      (table) =>
        !table.is_reserved &&
        (hasBackofficeLayout ? hasLayoutPosition(table) : true),
    ) ||
    tables.find((table) => !table.is_reserved) ||
    tables[0];

  return {
    selectedTableId: firstAvailable?.id || "",
    selectedProductId: getFirstActiveProductId(firstAvailable),
  };
}
