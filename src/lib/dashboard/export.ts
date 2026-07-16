import type { WidgetSpec } from "./widgets";

// Client-side widget exports (SPEC §5.5): CSV of the aggregated data, PNG of
// the rendered SVG — no server round-trip.

export function widgetToCsv(widget: WidgetSpec): void {
  const keys = ["label", ...widget.seriesKeys];
  const lines = [
    keys.join(","),
    ...widget.data.map((point) =>
      keys
        .map((key) => {
          const value = point[key] ?? "";
          const text = String(value);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), `${widget.title}.csv`);
}

export async function widgetToPng(container: HTMLElement, title: string): Promise<boolean> {
  const svg = container.querySelector("svg");
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // Inline currentColor-ish variables by copying computed styles at the root.
  const styles = getComputedStyle(container);
  clone.style.backgroundColor = styles.backgroundColor;

  const serialized = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("svg render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(2, 2);
    ctx.fillStyle = styles.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const png = canvas.toDataURL("image/png");
    triggerDownload(png, `${title}.png`);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
