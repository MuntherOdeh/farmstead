import type { ParsedCell, ParsedColumn, ParsedSheet } from "../types";

export function column(
  header: string,
  values: Array<string | number | boolean | Date | null | ParsedCell>,
  index = 0,
): ParsedColumn {
  return {
    index,
    header,
    cells: values.map((value): ParsedCell => {
      if (value !== null && typeof value === "object" && !(value instanceof Date)) {
        return value;
      }
      return { v: value };
    }),
  };
}

export function sheet(columns: ParsedColumn[]): ParsedSheet {
  const indexed = columns.map((col, i) => ({ ...col, index: i }));
  return {
    name: "Test",
    headerRowIndex: 0,
    columns: indexed,
    rowCount: Math.max(...indexed.map((col) => col.cells.length), 0),
  };
}
