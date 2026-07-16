"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPT = ".xlsx,.xls,.csv,.ods";

export function UploadDropzone({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-ring bg-accent/40" : "border-border hover:bg-muted/40",
        busy && "pointer-events-none opacity-70",
      )}
    >
      {busy ? (
        <>
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="font-medium">Reading the file…</p>
          <p className="text-sm text-muted-foreground">
            Parsing happens in your browser — the file never leaves it whole.
          </p>
        </>
      ) : (
        <>
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            {dragging ? <FileSpreadsheet className="size-6" /> : <Upload className="size-6" />}
          </span>
          <p className="font-medium">Drop a spreadsheet here, or click to browse</p>
          <p className="text-sm text-muted-foreground">
            .xlsx, .xls, .csv or .ods — any column layout. Farmstead works out
            what the columns mean and you confirm before anything is saved.
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </button>
  );
}
