import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertFixture } from "@/lib/demo/overview";

const SEVERITY_ICON = {
  critical: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

export function AlertsStrip({ data }: { data: AlertFixture[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {data.map((alert) => {
        const Icon = SEVERITY_ICON[alert.severity];
        return (
          <div
            key={alert.title}
            className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5"
          >
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                alert.severity === "critical" ? "text-destructive" : "text-muted-foreground",
              )}
            />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{alert.title}</p>
              <p className="truncate text-muted-foreground">{alert.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
