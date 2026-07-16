import { inferSchema } from "./infer";
import { listSheetNames, parseSheet, readWorkbook } from "./parse";

// Parsing + inference off the main thread (SPEC §5.1: >50k rows must not
// freeze the UI — we simply always parse in the worker).

export interface ParseWorkerRequest {
  buffer: ArrayBuffer;
  sheetName: string | null; // null → first sheet
}

export type ParseWorkerResponse =
  | {
      ok: true;
      sheetNames: string[];
      sheet: ReturnType<typeof parseSheet>;
      schema: ReturnType<typeof inferSchema>;
    }
  | { ok: false; error: string };

self.onmessage = (event: MessageEvent<ParseWorkerRequest>) => {
  try {
    const workbook = readWorkbook(event.data.buffer);
    const sheetNames = listSheetNames(workbook);
    if (sheetNames.length === 0) {
      throw new Error("The workbook has no sheets.");
    }
    const target = event.data.sheetName ?? sheetNames[0];
    const sheet = parseSheet(workbook, target);
    if (sheet.columns.length === 0 || sheet.rowCount === 0) {
      throw new Error(`Sheet "${target}" has no usable data.`);
    }
    const schema = inferSchema(sheet);
    const response: ParseWorkerResponse = { ok: true, sheetNames, sheet, schema };
    self.postMessage(response);
  } catch (error) {
    const response: ParseWorkerResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read the file.",
    };
    self.postMessage(response);
  }
};
