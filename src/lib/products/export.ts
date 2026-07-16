import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import type { ProductRow } from "./queries";

// Client-side export (SPEC §8) — the workbook never touches the server.

export function exportProductsToXlsx(rows: ProductRow[], filename = "products.xlsx"): void {
  const data = rows.map((row) => ({
    SKU: row.sku ?? "",
    Name: row.name,
    Category: row.categoryName,
    Unit: row.unitCode,
    Species: row.species ?? "",
    Breed: row.breed ?? "",
    "Unit price": row.unitPrice ? Number(new Decimal(row.unitPrice).toFixed(2)) : null,
    "Cost price": row.costPrice ? Number(new Decimal(row.costPrice).toFixed(2)) : null,
    Currency: row.currency,
    "Stock qty": Number(new Decimal(row.stockQty).toFixed(2)),
    "Reorder level": row.reorderLevel ? Number(new Decimal(row.reorderLevel).toFixed(2)) : null,
    Status: row.isActive ? "active" : "archived",
    Tags: row.tags?.join(", ") ?? "",
    Notes: row.notes ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Products");
  XLSX.writeFile(book, filename);
}
