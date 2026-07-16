import * as XLSX from "xlsx";
import type { ParsedCell, ParsedSheet } from "./types";

// Workbook → grid, handling the real-world mess (SPEC §5.1): merged title
// rows above the header, merged cells, trailing blanks, cached formula
// values, 1900/1904 epochs (SheetJS converts when read with cellDates:true).

export function readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(data, { cellDates: true, cellNF: true, cellText: true });
}

export function listSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames;
}

interface GridCell extends ParsedCell {
  isEmpty: boolean;
}

function cellFromSheet(cell: XLSX.CellObject | undefined): GridCell {
  if (!cell || cell.v === undefined || cell.v === null) {
    return { v: null, isEmpty: true };
  }
  // Formulas: cell.v already holds the cached value.
  const value = cell.v;
  if (typeof value === "string" && value.trim() === "") {
    return { v: null, isEmpty: true };
  }
  return {
    v: value instanceof Date ? value : value,
    z: typeof cell.z === "string" ? cell.z : undefined,
    w: cell.w,
    isEmpty: false,
  };
}

function buildGrid(sheet: XLSX.WorkSheet): GridCell[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid: GridCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: GridCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellFromSheet(sheet[XLSX.utils.encode_cell({ r, c })]));
    }
    grid.push(row);
  }

  // Merged cells → forward-fill the top-left value into the covered area.
  for (const merge of sheet["!merges"] ?? []) {
    const source = grid[merge.s.r]?.[merge.s.c];
    if (!source || source.isEmpty) continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        if (grid[r]?.[c]) grid[r][c] = { ...source };
      }
    }
  }
  return grid;
}

function trimGrid(grid: GridCell[][]): GridCell[][] {
  // Drop trailing blank rows.
  let lastRow = grid.length - 1;
  while (lastRow >= 0 && grid[lastRow].every((cell) => cell.isEmpty)) lastRow--;
  // Drop trailing blank columns.
  let lastCol = -1;
  for (let r = 0; r <= lastRow; r++) {
    for (let c = grid[r].length - 1; c > lastCol; c--) {
      if (!grid[r][c].isEmpty) {
        lastCol = c;
        break;
      }
    }
  }
  return grid.slice(0, lastRow + 1).map((row) => row.slice(0, lastCol + 1));
}

/**
 * Find the real header row — NOT assumed to be row 1 (SPEC §5.1). A header
 * row is mostly non-empty strings, mostly unique, and followed by data.
 */
export function detectHeaderRow(grid: { isEmpty: boolean; v: unknown }[][]): number {
  const limit = Math.min(grid.length - 1, 10);
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r <= limit; r++) {
    const row = grid[r];
    const nonEmpty = row.filter((cell) => !cell.isEmpty);
    if (nonEmpty.length < 2) continue;
    const strings = nonEmpty.filter((cell) => typeof cell.v === "string").length;
    const distinct = new Set(nonEmpty.map((cell) => String(cell.v).trim().toLowerCase())).size;
    const nextRow = grid[r + 1];
    const nextNonEmpty = nextRow ? nextRow.filter((cell) => !cell.isEmpty).length : 0;
    const coverage = nonEmpty.length / row.length;
    const uniqueness = distinct / nonEmpty.length;
    const stringness = strings / nonEmpty.length;
    const hasDataBelow = nextNonEmpty >= Math.min(2, nonEmpty.length) ? 1 : 0;
    const score = coverage * 1.5 + uniqueness + stringness * 2 + hasDataBelow;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ParsedSheet {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const grid = trimGrid(buildGrid(sheet));
  if (grid.length === 0) {
    return { name: sheetName, headerRowIndex: 0, columns: [], rowCount: 0 };
  }

  const headerRowIndex = detectHeaderRow(grid);
  const headerRow = grid[headerRowIndex];
  const dataRows = grid.slice(headerRowIndex + 1);

  const columns = headerRow
    .map((cell, index) => ({
      index,
      header: cell.isEmpty ? `Column ${index + 1}` : String(cell.v).trim(),
      cells: dataRows.map((row): ParsedCell => {
        const c = row[index] ?? { v: null, isEmpty: true };
        return { v: c.v, z: c.z, w: c.w };
      }),
    }))
    // Drop columns that are entirely empty AND have a synthetic header.
    .filter(
      (column) =>
        !column.header.startsWith("Column ") ||
        column.cells.some((cell) => cell.v !== null),
    );

  return {
    name: sheetName,
    headerRowIndex,
    columns,
    rowCount: dataRows.length,
  };
}
