// Dev utility: run a real workbook through the app's own parse + inference
// and print what each sheet would look like. Usage: tsx scripts/test-workbook.ts <file>
import { readFileSync } from "node:fs";
import { inferSchema } from "../src/lib/import/infer";
import { listSheetNames, parseSheet, readWorkbook } from "../src/lib/import/parse";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/test-workbook.ts <file.xlsx>");
  process.exit(1);
}
const workbook = readWorkbook(readFileSync(file));
for (const name of listSheetNames(workbook)) {
  const sheet = parseSheet(workbook, name);
  const schema = inferSchema(sheet);
  console.log(`=== ${name} — ${sheet.rowCount} rows, header at ${sheet.headerRowIndex}`);
  for (const column of schema.columns) {
    console.log(
      `  ${column.header} → ${column.role} (${column.physicalType}, conf ${column.roleConfidence})`,
    );
  }
}
